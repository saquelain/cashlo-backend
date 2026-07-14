import mongoose from 'mongoose';

const distributorLeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    asmCode: {
      type: String,
      trim: true,
      default: '',
    },
    referralCode: {
      type: String,
      trim: true,
      default: '',
    },

    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },
    district: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },

    consents: {
      nonRefundable: { type: Boolean, default: false },
      terms: { type: Boolean, default: false },
      kyc: { type: Boolean, default: false },
      genuineMerchants: { type: Boolean, default: false },
      policyViolation: { type: Boolean, default: false },
    },

    // select: false — OTP hash should never come back on a normal .find(),
    // only when explicitly requested during verification.
    otpHash: {
      type: String,
      select: false,
    },
    otpExpiresAt: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    otpVerifiedAt: Date,

    status: {
      type: String,
      enum: [
        'form_submitted',
        'otp_sent',
        'otp_verified',
        'lock_acquired',
        'order_created',
        'paid',
        'failed',
        'expired',
        'lock_lost', // paid, but pincode was re-sold before webhook arrived — see HLD Section 5
      ],
      default: 'form_submitted',
    },

    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
      amount: Number, // paise
      currency: { type: String, default: 'INR' },
      receipt: String,
    },

    gst: {
      baseAmount: Number,
      gstAmount: Number,
      totalAmount: Number, // set explicitly by createOrder once a real order exists — never defaulted here
    },

    // For the admin "call this lead" queue — covers both ordinary payment
    // failures and the lock_lost edge case, distinguished by lostReason.
    leadCallStatus: {
      type: String,
      enum: ['not_required', 'pending_call', 'called', 'converted'],
      default: 'not_required',
    },
    lostReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

distributorLeadSchema.index({ email: 1 });
distributorLeadSchema.index({ mobile: 1 });
distributorLeadSchema.index({ pincode: 1 });
distributorLeadSchema.index({ status: 1 });
distributorLeadSchema.index({ leadCallStatus: 1 });
distributorLeadSchema.index({ 'razorpay.orderId': 1 });

export default mongoose.model('DistributorLead', distributorLeadSchema);