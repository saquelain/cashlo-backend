/**
 * Imports India Post pincode data (CSV or TSV export) into PincodeMaster.
 * Source has ~1 row per post office; this aggregates to 1 doc per unique pincode.
 *
 * Usage:
 *   node scripts/importPincodes.js /path/to/pincode-data.csv
 *
 * Requires: npm install csv-parse
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { connectDB } from '../src/config/database.js';
import PincodeMaster from '../src/models/PincodeMaster.js';
import mongoose from 'mongoose';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/importPincodes.js <path-to-csv-or-tsv>');
  process.exit(1);
}

const run = async () => {
  await connectDB();

  console.log(`📂 Reading ${filePath}...`);
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Auto-detect delimiter from the header line — source files vary between
  // tab-separated exports and comma-separated CSV.
  const firstLine = raw.split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  console.log(`🔎 Detected delimiter: ${delimiter === '\t' ? 'tab' : 'comma'}`);

  const records = parse(raw, {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  console.log(`📊 Parsed ${records.length} raw office rows`);

  // "NA" is India Post's placeholder for missing data (also seen in lat/long)
  // — treat it as empty, not as a real value, everywhere it might appear.
  const clean = (v) => {
    const t = (v || '').trim();
    return t.toUpperCase() === 'NA' ? '' : t;
  };

  // Aggregate: pincode -> raw tallies, resolved to a canonical doc after all rows are seen
  const pincodeMap = new Map();

  for (const row of records) {
    const pincode = clean(row.pincode);
    if (!/^\d{6}$/.test(pincode)) continue; // skip malformed rows

    const district = clean(row.district);
    const statename = clean(row.statename);
    const circlename = clean(row.circlename);
    const officename = clean(row.officename);
    const officetype = clean(row.officetype);
    const delivery = clean(row.delivery);

    if (!pincodeMap.has(pincode)) {
      pincodeMap.set(pincode, {
        pincode,
        circlename,
        districtCounts: new Map(),
        stateCounts: new Map(),
        offices: [],
      });
    }

    const entry = pincodeMap.get(pincode);
    if (district) entry.districtCounts.set(district, (entry.districtCounts.get(district) || 0) + 1);
    if (statename) entry.stateCounts.set(statename, (entry.stateCounts.get(statename) || 0) + 1);
    if (officename) entry.offices.push({ name: officename, type: officetype, delivery });
  }

  console.log(`🧮 Aggregated into ${pincodeMap.size} unique pincodes`);

  // Resolve canonical district/state as the most frequent value seen for that
  // pincode. Ties broken alphabetically for determinism. Districts genuinely
  // do vary within one pincode zone (e.g. newly split districts in Telangana)
  // — that's expected, not corrupt data — so we keep the losers as alternates
  // rather than discarding them.
  const pickMode = (counts) => {
    let best = null;
    let bestCount = -1;
    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  };

  const docs = [];
  let districtVarianceCount = 0;
  let stateVarianceCount = 0;
  const stateAnomalies = [];

  for (const entry of pincodeMap.values()) {
    const district = pickMode(entry.districtCounts);
    const statename = pickMode(entry.stateCounts);
    const alternateDistricts = [...entry.districtCounts.keys()].filter((d) => d !== district);
    const alternateStates = [...entry.stateCounts.keys()].filter((s) => s !== statename);

    if (alternateDistricts.length) districtVarianceCount += 1;

    if (alternateStates.length) {
      stateVarianceCount += 1;
      const counts = [...entry.stateCounts.entries()];
      const isRealTie = counts.length === 2 && counts[0][1] === counts[1][1];
      stateAnomalies.push({
        pincode: entry.pincode,
        states: [...entry.stateCounts.keys()],
        counts: Object.fromEntries(entry.stateCounts),
        tie: isRealTie,
      });
    }

    docs.push({
      pincode: entry.pincode,
      district,
      alternateDistricts,
      statename,
      alternateStates,
      circlename: entry.circlename,
      offices: entry.offices,
    });
  }

  console.log(`ℹ️  ${districtVarianceCount} pincodes span more than one district (kept as alternateDistricts) — expected in states with recently split districts.`);

  if (stateAnomalies.length) {
    const ties = stateAnomalies.filter((a) => a.tie);
    console.warn(`⚠️  ${stateVarianceCount} pincodes span more than one STATE (mostly Telangana/Andhra Pradesh border lag in India Post data). Canonical state picked by majority count; alternates kept in alternateStates.`);
    if (ties.length) {
      console.warn(`   ${ties.length} of those were exact ties (equal office count on each state) — worth a manual glance since majority-vote can't break these confidently:`);
      console.warn(ties.slice(0, 10));
    }
  } else {
    console.log('✅ No pincode spans more than one state.');
  }
  const BATCH_SIZE = 1000;
  let upserted = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const ops = batch.map((doc) => ({
      updateOne: {
        filter: { pincode: doc.pincode },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const result = await PincodeMaster.bulkWrite(ops, { ordered: false });
    upserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    console.log(`  ...batch ${Math.floor(i / BATCH_SIZE) + 1} done (${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length})`);
  }

  console.log(`✅ Import complete. ${upserted} pincodes written.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});