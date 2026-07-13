import PincodeReservation from '../models/PincodeReservation.js';

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Atomically acquires a lock on a pincode for this booking. Relies on the
// UNIQUE INDEX on PincodeReservation.pincode as the actual mutex — insertOne
// either succeeds (lock acquired) or throws E11000 (someone already has it).
// There is no check-then-insert gap here; that's the whole point.
export const acquirePincodeLock = async ({ pincode, bookingId }) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

  try {
    await PincodeReservation.create({ pincode, status: 'locked', bookingId, lockedAt: now, expiresAt });
    return; // lock acquired, done
  } catch (err) {
    if (err.code !== 11000) throw err; // some other DB error, not a lock conflict — bubble up

    const existing = await PincodeReservation.findOne({ pincode });

    if (!existing) {
      // Vanished between our failed insert and this read — extremely
      // unlikely (would mean it was deleted in that instant), retry once.
      return acquirePincodeLock({ pincode, bookingId });
    }

    if (existing.status === 'confirmed') {
      const error = new Error('This pincode has already been allotted to another distributor');
      error.statusCode = 409;
      error.reason = 'already_allotted';
      throw error;
    }

    if (existing.status === 'locked' && existing.expiresAt > now) {
      const error = new Error('This pincode is currently being reserved by another user. Please try again shortly.');
      error.statusCode = 409;
      error.reason = 'temporarily_reserved';
      throw error;
    }

    // Locked but expired (abandoned checkout) — atomically steal the stale
    // lock. The filter re-checks expiry so two people racing to steal the
    // same stale lock can't both succeed.
    const stolen = await PincodeReservation.findOneAndReplace(
      { pincode, status: 'locked', expiresAt: { $lt: now } },
      { pincode, status: 'locked', bookingId, lockedAt: now, expiresAt },
      { returnDocument: 'after' }
    );

    if (!stolen) {
      const error = new Error('This pincode just got reserved by someone else. Please try again.');
      error.statusCode = 409;
      error.reason = 'race_lost';
      throw error;
    }
  }
};

// Makes a lock permanent — removes expiresAt so the TTL monitor never
// touches it. Only called once payment is actually confirmed.
export const confirmPincodeLock = ({ pincode, bookingId }) =>
  PincodeReservation.findOneAndUpdate(
    { pincode, bookingId },
    { $set: { status: 'confirmed' }, $unset: { expiresAt: '' } }
  );