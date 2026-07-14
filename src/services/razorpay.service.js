import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config/environment.js';

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

export const createRazorpayOrder = ({ amount, currency = 'INR', receipt, notes }) =>
  razorpay.orders.create({ amount, currency, receipt, notes, payment_capture: 1, });

// Used by the reconciliation cron — asks Razorpay directly what actually
// happened to an order, bypassing the webhook entirely. This is the backstop
// for the rare case where BOTH the client callback and the webhook failed
// to reach us (e.g. server was mid-redeploy at the wrong moment).
export const fetchOrderPayments = (orderId) => razorpay.orders.fetchPayments(orderId);

// Client-side checkout callback verification — HMAC over "orderId|paymentId"
// using the API key secret. This alone is NOT trusted as the source of truth
// (see HLD Step 7a/7b) — it's UX-only, the webhook below is authoritative.
export const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
};

// Webhook signature verification — HMAC over the RAW request body using the
// separate webhook secret (not the API key secret). Requires req.rawBody to
// have been captured before JSON parsing — see app.js instructions.
export const verifyWebhookSignature = (rawBody, signature) => {
  if (!config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};