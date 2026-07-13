import DistributorLead from '../models/DistributorLead.js';
import PincodeReservation from '../models/PincodeReservation.js';
import { confirmPincodeLock } from './pincodeLock.js';

// Idempotent by design: the { status: { $ne: 'paid' } } guard means calling
// this twice (client callback AND webhook, in either order, or the webhook
// retried by Razorpay) only ever does the work once. The second call is a
// silent no-op because the filter simply won't match a lead already paid.
export const markLeadPaid = async ({ bookingId, orderId, paymentId, signature }) => {
  const setFields = { status: 'paid' };
  if (orderId) setFields['razorpay.orderId'] = orderId;
  if (paymentId) setFields['razorpay.paymentId'] = paymentId;
  if (signature) setFields['razorpay.signature'] = signature;

  const lead = await DistributorLead.findOneAndUpdate(
    { _id: bookingId, status: { $ne: 'paid' } },
    { $set: setFields },
    { new: true }
  );

  // Either already paid (idempotent no-op — fine) or bookingId doesn't
  // exist (shouldn't happen if Razorpay's notes were set correctly, but
  // don't crash the webhook handler over it — caller logs this case).
  if (!lead) return { lead: null, lockLost: false };

  const reservation = await PincodeReservation.findOne({ pincode: lead.pincode });

  // Normal case: this booking still owns the pincode's lock (or already-
  // confirmed reservation) — make it permanent.
  if (reservation && String(reservation.bookingId) === String(lead._id)) {
    await confirmPincodeLock({ pincode: lead.pincode, bookingId: lead._id });
    return { lead, lockLost: false };
  }

  // HLD Section 5 edge case: this lead's lock expired and the pincode was
  // re-sold to someone else before this payment confirmation arrived.
  // Decision: manual outreach + manual refund via admin panel, never an
  // automatic refund. Flag it distinctly from an ordinary failed payment.
  lead.status = 'lock_lost';
  lead.lostReason = 'Pincode was re-sold before payment was confirmed';
  lead.leadCallStatus = 'pending_call';
  await lead.save();

  return { lead, lockLost: true };
};