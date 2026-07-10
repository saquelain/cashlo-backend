import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/database.js';
import CalculatorType from '../src/models/CalculatorType.js';
import Calculator from '../src/models/Calculator.js';
import mongoose from 'mongoose';

const types = [
  {
    name: 'EMI Calculator',
    key: 'emi',
    slug: 'emi-calculator',
    icon: 'Landmark',
    shortDescription: 'Calculate your loan EMI, total interest, and repayment schedule.',
    order: 1,
  },
  {
    name: 'SIP Calculator',
    key: 'sip',
    slug: 'sip-calculator',
    icon: 'TrendingUp',
    shortDescription: 'Estimate returns on your monthly SIP mutual fund investments.',
    order: 2,
  },
  {
    name: 'SWP Calculator',
    key: 'swp',
    slug: 'swp-calculator',
    icon: 'ArrowDownToLine',
    shortDescription: 'Plan systematic withdrawals from your investment corpus.',
    order: 3,
  },
  {
    name: 'FD Calculator',
    key: 'fd',
    slug: 'fd-calculator',
    icon: 'PiggyBank',
    shortDescription: 'Calculate maturity value on your fixed deposit investments.',
    order: 4,
  },
  {
    name: 'RD Calculator',
    key: 'rd',
    slug: 'rd-calculator',
    icon: 'Wallet',
    shortDescription: 'Estimate returns on your recurring deposit savings.',
    order: 5,
  },
];

const run = async () => {
  await connectDB();

  // 1. Seed CalculatorType docs (upsert, so re-running is safe)
  const typeDocs = {};
  for (const t of types) {
    const doc = await CalculatorType.findOneAndUpdate(
      { key: t.key },
      t,
      { upsert: true, new: true }
    );
    typeDocs[t.key] = doc;
    console.log(`✅ Type ready: ${doc.name}`);
  }

  // 2. Seed base type calculator pages (the /sip-calculator page itself)
  const baseCalculators = [
    {
      calculatorType: typeDocs.sip._id,
      slug: 'sip-calculator',
      title: 'SIP Calculator',
      metaTitle: 'SIP Calculator - Calculate SIP Returns Online | Cashlo',
      metaDescription: 'Use Cashlo\'s free SIP calculator to estimate returns on your monthly mutual fund investments.',
      isBankVariant: false,
      defaults: { amount: 5000, rate: 12, minRate: 1, maxRate: 30, years: 10, minYears: 1, maxYears: 30 },
      isFeatured: true,
      faqs: [
        { question: 'How much can I invest in a SIP?', answer: 'There is no upper limit. Most funds allow SIPs starting from ₹100-₹500 per month.' },
        { question: 'What is the maximum tenure of a SIP?', answer: 'SIPs can run indefinitely until you choose to stop them, or for a fixed tenure you select at setup.' },
      ],
    },
    {
      calculatorType: typeDocs.emi._id,
      slug: 'emi-calculator',
      title: 'EMI Calculator',
      metaTitle: 'EMI Calculator - Calculate Loan EMI Online | Cashlo',
      metaDescription: 'Use Cashlo\'s free EMI calculator to estimate your monthly loan installment instantly.',
      isBankVariant: false,
      defaults: { amount: 500000, rate: 10.5, minRate: 5, maxRate: 25, years: 5, minYears: 1, maxYears: 30 },
      isFeatured: true,
      faqs: [
        { question: 'What sort of loans can I use the EMI calculator for?', answer: 'Personal loans, home loans, car loans, and education loans — just adjust the amount, rate, and tenure.' },
        { question: 'What happens if I fail to pay my EMIs?', answer: 'Missed EMIs attract late fees and negatively impact your credit score. Contact your lender immediately if you anticipate a missed payment.' },
      ],
    },
  ];

  for (const c of baseCalculators) {
    const doc = await Calculator.findOneAndUpdate({ slug: c.slug }, c, { upsert: true, new: true });
    console.log(`✅ Base calculator ready: ${doc.title}`);
  }

  // 3. Seed a couple of sample bank variants (proves the pattern before you bulk-add the rest)
  const variants = [
    {
      calculatorType: typeDocs.sip._id,
      slug: 'axis-bank-sip-calculator',
      title: 'Axis Bank SIP Calculator',
      metaTitle: 'Axis Bank SIP Calculator | Cashlo',
      metaDescription: 'Calculate your Axis Bank mutual fund SIP returns with Cashlo\'s free calculator.',
      isBankVariant: true,
      bankName: 'Axis Bank',
      defaults: { amount: 5000, rate: 12, minRate: 1, maxRate: 30, years: 10, minYears: 1, maxYears: 30 },
      blurb: 'Axis Bank offers a range of mutual fund SIP options through Axis AMC, with historical average returns of 10-14% annually.',
      isFeatured: true,
      faqs: [
        { question: 'Can I start a SIP directly with Axis Bank?', answer: 'Yes, Axis Bank offers SIP investments through Axis Mutual Fund and its net banking/app platforms.' },
      ],
    },
    {
      calculatorType: typeDocs.emi._id,
      slug: 'hdfc-bank-emi-calculator',
      title: 'HDFC Bank EMI Calculator',
      metaTitle: 'HDFC Bank EMI Calculator | Cashlo',
      metaDescription: 'Calculate your HDFC Bank loan EMI instantly with Cashlo\'s free calculator.',
      isBankVariant: true,
      bankName: 'HDFC Bank',
      defaults: { amount: 500000, rate: 10.5, minRate: 10.5, maxRate: 21, years: 5, minYears: 1, maxYears: 6 },
      blurb: 'HDFC Bank offers personal loans starting at 10.5% p.a. with flexible tenures up to 6 years.',
      isFeatured: true,
      faqs: [
        { question: 'What is the minimum interest rate on an HDFC personal loan?', answer: 'HDFC Bank personal loans start at 10.5% p.a. for eligible salaried applicants, subject to credit profile.' },
      ],
    },
  ];

  for (const v of variants) {
    const doc = await Calculator.findOneAndUpdate({ slug: v.slug }, v, { upsert: true, new: true });
    console.log(`✅ Bank variant ready: ${doc.title}`);
  }

  console.log('\n🎉 Seed complete.');
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});