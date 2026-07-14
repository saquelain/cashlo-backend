import DistributorLead from '../models/DistributorLead.js';
import PincodeReservation from '../models/PincodeReservation.js';
import { confirmPincodeLock } from './pincodeLock.js';
import { sendPaymentConfirmationEmail } from '../services/email.service.js';

export const markLeadPaid = async ({ bookingId, orderId, paymentId, signature }) => {
  const setFields = { status: 'paid', leadCallStatus: 'not_required' };
  if (orderId) setFields['razorpay.orderId'] = orderId;
  if (paymentId) setFields['razorpay.paymentId'] = paymentId;
  if (signature) setFields['razorpay.signature'] = signature;

  const lead = await DistributorLead.findOneAndUpdate(
    { _id: bookingId, status: { $ne: 'paid' } },
    { $set: setFields },
    { returnDocument: 'after' }
  );

  if (!lead) return { lead: null, lockLost: false };

  const reservation = await PincodeReservation.findOne({ pincode: lead.pincode });

  if (reservation && String(reservation.bookingId) === String(lead._id)) {
    await confirmPincodeLock({ pincode: lead.pincode, bookingId: lead._id });

    // Fire-and-log, never blocks the payment confirmation itself
    await sendPaymentConfirmationEmail({
      to: lead.email,
      name: lead.name,
      pincode: lead.pincode,
      district: lead.district,
      state: lead.state,
      amount: lead.gst?.totalAmount ?? lead.razorpay?.amount,
      paymentId: lead.razorpay?.paymentId,
    });

    return { lead, lockLost: false };
  }

  lead.status = 'lock_lost';
  lead.lostReason = 'Pincode was re-sold before payment was confirmed';
  lead.leadCallStatus = 'pending_call';
  await lead.save();

  return { lead, lockLost: true };
};