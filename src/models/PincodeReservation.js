import mongoose from 'mongoose';

const pincodeReservationSchema = new mongoose.Schema(
  {
    // UNIQUE INDEX — this is the entire race-condition fix. Only one document
    // can ever exist per pincode across the whole system; a second insertOne
    // for the same pincode throws E11000 instead of silently succeeding.
    pincode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['locked', 'confirmed'],
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DistributorLead',
      required: true,
    },
    lockedAt: {
      type: Date,
      required: true,
    },
    // Present ONLY while status = 'locked'. Removed (via $unset) the moment a
    // booking is confirmed, which is what makes the reservation permanent —
    // MongoDB's TTL monitor only deletes docs with an expiresAt in the past,
    // so a confirmed doc with no expiresAt is never touched by it.
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

pincodeReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PincodeReservation', pincodeReservationSchema);