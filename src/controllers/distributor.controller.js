import PincodeMaster from '../models/PincodeMaster.js';
import PincodeReservation from '../models/PincodeReservation.js';
import DistributorLead from '../models/DistributorLead.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateOtp, hashOtp, compareOtp } from '../utils/otp.js';
import { checkOtpRateLimit, logOtpRequest } from '../utils/otpRateLimiter.js';
import { sendOtpEmail } from '../services/email.service.js';
import { acquirePincodeLock } from '../utils/pincodeLock.js';
import { markLeadPaid } from '../utils/paymentReconciliation.js';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../services/razorpay.service.js';
import { config } from '../config/environment.js';

const PINCODE_REGEX = /^\d{6}$/;
const REQUIRED_CONSENTS = ['nonRefundable', 'terms', 'kyc', 'genuineMerchants'];
const MAX_OTP_ATTEMPTS = 5;
const OTP_VALIDITY_MS = 5 * 60 * 1000;
const BOOKING_AMOUNT_PAISE = 110000; // ₹1,100, inclusive of GST — never charge extra on top

// POST /api/v1/distributor/check-pincode
// Read-only — no lock is taken here. Two people checking the same pincode
// simultaneously is fine, this doesn't touch PincodeReservation writes.
export const checkPincode = asyncHandler(async (req, res) => {
  const { pincode } = req.body;

  if (!pincode || !PINCODE_REGEX.test(pincode)) {
    const error = new Error('Please enter a valid 6-digit pincode');
    error.statusCode = 400;
    throw error;
  }

  const master = await PincodeMaster.findOne({ pincode });

  if (!master) {
    const error = new Error('This pincode was not found in our serviceable areas');
    error.statusCode = 404;
    throw error;
  }

  const reservation = await PincodeReservation.findOne({ pincode });

  let available = true;
  let reason = null;

  if (reservation) {
    if (reservation.status === 'confirmed') {
      available = false;
      reason = 'already_allotted';
    } else if (reservation.status === 'locked' && reservation.expiresAt > new Date()) {
      // Someone else is mid-checkout right now. Not yet sold — softer message
      // than "already allotted", since it may free up shortly.
      available = false;
      reason = 'temporarily_reserved';
    }
    // else: locked but expired — treat as available, Step 4 (lock acquisition)
    // will atomically steal the stale lock when this user actually tries to book.
  }

  res.status(200).json({
    success: true,
    data: {
      pincode: master.pincode,
      district: master.district,
      state: master.statename,
      alternateDistricts: master.alternateDistricts,
      alternateStates: master.alternateStates,
      officeNames: master.offices.map((o) => o.name),
      available,
      reason,
    },
  });
});

// POST /api/v1/distributor/send-otp
// Creates/updates the DistributorLead, sends a fresh OTP. No pincode lock is
// taken here — that happens later, after OTP verification (Step 4 in the HLD).
export const sendOtp = asyncHandler(async (req, res) => {
  const { name, mobile, email, pincode, asmCode, referralCode, consents } = req.body;

  if (!name || !mobile || !email || !pincode) {
    const error = new Error('Name, mobile, email and pincode are required');
    error.statusCode = 400;
    throw error;
  }

  if (!PINCODE_REGEX.test(pincode)) {
    const error = new Error('Please enter a valid 6-digit pincode');
    error.statusCode = 400;
    throw error;
  }

  // Server-side re-validation — never trust the client's checkbox state alone.
  const allConsentsGiven = consents && REQUIRED_CONSENTS.every((key) => consents[key] === true);
  if (!allConsentsGiven) {
    const error = new Error('Please accept all consent terms to proceed');
    error.statusCode = 400;
    throw error;
  }

  const master = await PincodeMaster.findOne({ pincode });
  if (!master) {
    const error = new Error('This pincode was not found in our serviceable areas');
    error.statusCode = 404;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // One distributor = one PIN code, for life. Checked on EITHER email or
  // mobile matching an existing PAID lead — blocks the obvious workaround of
  // reusing one identifier with a different other. Deliberately excludes
  // 'lock_lost' leads: those already paid but didn't end up with a pincode,
  // and are handled separately via manual outreach (see HLD Section 5) —
  // this rule shouldn't lock them out while that's still being resolved.
  const existingPaidLead = await DistributorLead.findOne({
    status: 'paid',
    $or: [{ email: normalizedEmail }, { mobile }],
  });

  if (existingPaidLead) {
    const error = new Error(
      `You have already reserved PIN Code ${existingPaidLead.pincode}. Only one PIN Code reservation is allowed per distributor.`
    );
    error.statusCode = 409;
    throw error;
  }

  // Layer 2 rate limit — identifier-based, survives restarts (Section 4a of the HLD)
  await checkOtpRateLimit(normalizedEmail);

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

  // Idempotency: reuse an in-progress lead for the same email+pincode instead
  // of creating a duplicate on every resend or repeated form submit — but
  // ONLY while it's still pre-verification. A lead that's already otp_verified
  // or beyond (lock_acquired, order_created, ...) must never be touched here,
  // or a stray resend could reset its status out from under an active pincode
  // lock while PincodeReservation still thinks that lead owns it.
  let lead = await DistributorLead.findOne({
    email: normalizedEmail,
    pincode,
    status: { $nin: ['paid', 'failed', 'expired', 'lock_lost'] },
  });

  if (lead) {
    lead.name = name;
    lead.mobile = mobile;
    lead.asmCode = asmCode || '';
    lead.referralCode = referralCode || '';
    lead.district = master.district;
    lead.state = master.statename;
    lead.consents = consents;
    lead.otpHash = otpHash;
    lead.otpExpiresAt = otpExpiresAt;
    lead.otpAttempts = 0;
    lead.otpVerified = false;
    lead.status = 'otp_sent';
    await lead.save();
  } else {
    lead = await DistributorLead.create({
      name,
      mobile,
      email: normalizedEmail,
      asmCode: asmCode || '',
      referralCode: referralCode || '',
      pincode,
      district: master.district,
      state: master.statename,
      consents,
      otpHash,
      otpExpiresAt,
      status: 'otp_sent',
    });
  }

  await sendOtpEmail({ to: normalizedEmail, name, otp });
  await logOtpRequest(normalizedEmail);

  res.status(200).json({
    success: true,
    message: 'OTP sent to your email',
    data: { bookingId: lead._id },
  });
});

// POST /api/v1/distributor/verify-otp
export const verifyOtp = asyncHandler(async (req, res) => {
  const { bookingId, otp } = req.body;

  if (!bookingId || !otp) {
    const error = new Error('bookingId and otp are required');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.isValidObjectId(bookingId)) {
    const error = new Error('Invalid bookingId');
    error.statusCode = 400;
    throw error;
  }

  const lead = await DistributorLead.findById(bookingId).select('+otpHash');
  if (!lead) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (lead.otpVerified) {
    return res.status(200).json({
      success: true,
      message: 'OTP already verified',
      data: { bookingId: lead._id },
    });
  }

  if (!lead.otpExpiresAt || lead.otpExpiresAt < new Date()) {
    const error = new Error('OTP expired. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  if (lead.otpAttempts >= MAX_OTP_ATTEMPTS) {
    const error = new Error('Too many incorrect attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  const isValid = await compareOtp(otp, lead.otpHash);

  if (!isValid) {
    lead.otpAttempts += 1;
    await lead.save();
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - lead.otpAttempts);
    const error = new Error(`Incorrect OTP. ${remaining} attempt(s) remaining.`);
    error.statusCode = 400;
    throw error;
  }

  lead.otpVerified = true;
  lead.otpVerifiedAt = new Date();
  lead.status = 'otp_verified';
  lead.otpHash = undefined;
  await lead.save();

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: { bookingId: lead._id },
  });
});

// POST /api/v1/distributor/create-order
// HLD Steps 4+5 combined: acquire the pincode lock (the race-condition-proof
// step), then create the Razorpay order. Requires OTP already verified.
export const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    const error = new Error('Invalid bookingId');
    error.statusCode = 400;
    throw error;
  }

  const lead = await DistributorLead.findById(bookingId);
  if (!lead) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (!lead.otpVerified) {
    const error = new Error('Please verify your OTP before proceeding');
    error.statusCode = 400;
    throw error;
  }

  if (lead.status === 'paid') {
    const error = new Error('This booking has already been paid for');
    error.statusCode = 400;
    throw error;
  }

  // The critical section — see src/utils/pincodeLock.js for why this is
  // safe under concurrent requests for the same pincode.
  await acquirePincodeLock({ pincode: lead.pincode, bookingId: lead._id });

  lead.status = 'lock_acquired';
  await lead.save();

  let order;
  try {
    order = await createRazorpayOrder({
      amount: BOOKING_AMOUNT_PAISE,
      currency: 'INR',
      receipt: lead._id.toString(),
      notes: { bookingId: lead._id.toString(), pincode: lead.pincode },
    });
  } catch (err) {
    // Order creation failed AFTER the lock was acquired — don't leave the
    // lead stuck at lock_acquired with no way forward. The lock itself will
    // still expire naturally via TTL if nothing follows this up, freeing the
    // pincode for others; that's acceptable here, no manual cleanup needed.
    const error = new Error('Failed to create payment order. Please try again.');
    error.statusCode = 502;
    error.details = err.message;
    throw error;
  }

  // NOTE: ₹1,100 GST breakup below assumes 18% — confirm the actual rate
  // with Yasir before this matters for invoicing; it doesn't affect what's
  // charged (always exactly ₹1,100), only how it's reported.
  const baseAmount = Math.round(BOOKING_AMOUNT_PAISE / 1.18);
  const gstAmount = BOOKING_AMOUNT_PAISE - baseAmount;

  lead.razorpay = {
    orderId: order.id,
    amount: BOOKING_AMOUNT_PAISE,
    currency: 'INR',
    receipt: lead._id.toString(),
  };
  lead.gst = { baseAmount, gstAmount, totalAmount: BOOKING_AMOUNT_PAISE };
  lead.status = 'order_created';
  await lead.save();

  res.status(200).json({
    success: true,
    data: {
      orderId: order.id,
      amount: BOOKING_AMOUNT_PAISE,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      bookingId: lead._id,
      gst: { baseAmount, gstAmount, totalAmount: BOOKING_AMOUNT_PAISE },
    },
  });
});

// POST /api/v1/distributor/verify-payment
// HLD Step 7a — client-side checkout callback. Optimistic, UX-only. NOT the
// source of truth (see razorpayWebhook below) — just lets the frontend show
// a success page immediately without waiting on the webhook round-trip.
export const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    const error = new Error('Invalid bookingId');
    error.statusCode = 400;
    throw error;
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    const error = new Error('Missing payment verification fields');
    error.statusCode = 400;
    throw error;
  }

  const isValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isValid) {
    const error = new Error('Payment signature verification failed');
    error.statusCode = 400;
    throw error;
  }

  const { lockLost } = await markLeadPaid({
    bookingId,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  res.status(200).json({
    success: true,
    message: lockLost
      ? 'Payment received, but there was an issue with your pincode reservation. Our team will contact you shortly.'
      : 'Payment verified successfully',
    data: { bookingId, lockLost },
  });
});

// POST /api/v1/distributor/webhook/razorpay
// HLD Step 7b — the ACTUAL source of truth. Fires independently of what the
// browser does, so this is what catches the case where the user closes the
// tab right after paying and before the client-side redirect fires.
// Requires req.rawBody (raw Buffer, captured before JSON parsing) — see
// app.js instructions for the express.json({ verify }) change needed.
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature || !req.rawBody) {
    // Deliberately 400, not 500 — this is a malformed/unsigned request, not
    // a server error. Do NOT process the body if we can't verify it.
    return res.status(400).json({ success: false, message: 'Missing signature or raw body' });
  }

  const isValid = verifyWebhookSignature(req.rawBody, signature);
  if (!isValid) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const event = req.body;
  const eventType = event.event;

  if (eventType === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const bookingId = payment?.notes?.bookingId;

    if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
      // Shouldn't happen if notes were set correctly at order creation —
      // ack the webhook anyway (Razorpay will retry otherwise) but log loud,
      // this needs manual investigation, not a silent drop.
      console.error('❌ Webhook payment.captured missing/invalid bookingId in notes:', payment?.id);
      return res.status(200).json({ success: true });
    }

    const { lockLost } = await markLeadPaid({
      bookingId,
      orderId: payment.order_id,
      paymentId: payment.id,
    });

    if (lockLost) {
      console.warn(`⚠️  Booking ${bookingId} paid but lock_lost — pincode was re-sold before this webhook arrived. Flagged for manual outreach/refund.`);
    }
  } else if (eventType === 'payment.failed') {
    const payment = event.payload?.payment?.entity;
    const bookingId = payment?.notes?.bookingId;

    if (bookingId && mongoose.isValidObjectId(bookingId)) {
      await DistributorLead.findOneAndUpdate(
        { _id: bookingId, status: { $ne: 'paid' } },
        { $set: { status: 'failed', leadCallStatus: 'pending_call' } }
      );
    }
  }
  // Other event types (refund.processed, etc.) intentionally ignored for now.

  // Always ack 200 quickly once processed — Razorpay retries with backoff
  // for hours otherwise.
  res.status(200).json({ success: true });
});