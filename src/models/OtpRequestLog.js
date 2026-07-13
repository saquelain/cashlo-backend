import mongoose from 'mongoose';

const otpRequestLogSchema = new mongoose.Schema(
  {
    // email or mobile — whichever channel the OTP was requested on
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

// Fast lookup for "how many requests has this identifier made recently"
otpRequestLogSchema.index({ identifier: 1, createdAt: -1 });

// Self-cleaning — rows older than 1hr are auto-deleted, no cron needed.
// Also means the rate-limit window is naturally exactly 1hr in the past.
otpRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model('OtpRequestLog', otpRequestLogSchema);