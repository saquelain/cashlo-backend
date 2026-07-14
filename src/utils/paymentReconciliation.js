import DistributorLead from '../models/DistributorLead.js';
import PincodeReservation from '../models/PincodeReservation.js';
import { confirmPincodeLock } from './pincodeLock.js';
import { sendPaymentConfirmationEmail } from '../services/email.service.js';
import { generateReceiptPdfBuffer } from '../services/receipt.service.js';
import { uploadFile } from '../services/s3.service.js';

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

    // Generate + store the permanent receipt PDF. Wrapped so a storage/PDF
    // failure never undoes the payment confirmation itself — same principle
    // as the email below.
    let receiptUrl = '';
    try {
      const pdfBuffer = await generateReceiptPdfBuffer({
        bookingId: String(lead._id),
        name: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        pincode: lead.pincode,
        district: lead.district,
        state: lead.state,
        baseAmount: lead.gst?.baseAmount ?? 0,
        gstAmount: lead.gst?.gstAmount ?? 0,
        totalAmount: lead.gst?.totalAmount ?? lead.razorpay?.amount ?? 0,
        paymentId: lead.razorpay?.paymentId ?? '',
        orderId: lead.razorpay?.orderId ?? '',
        date: new Date().toISOString(),
      });

      const uploaded = await uploadFile(pdfBuffer, `receipt-${lead._id}.pdf`, 'application/pdf', 'receipts');
      receiptUrl = uploaded.publicUrl;
      lead.receiptUrl = receiptUrl;
      await lead.save();
    } catch (err) {
      console.error('❌ Failed to generate/upload receipt PDF:', err.message);
    }

    await sendPaymentConfirmationEmail({
      to: lead.email,
      name: lead.name,
      pincode: lead.pincode,
      district: lead.district,
      state: lead.state,
      amount: lead.gst?.totalAmount ?? lead.razorpay?.amount,
      paymentId: lead.razorpay?.paymentId,
      receiptUrl,
    });

    return { lead, lockLost: false };
  }

  lead.status = 'lock_lost';
  lead.lostReason = 'Pincode was re-sold before payment was confirmed';
  lead.leadCallStatus = 'pending_call';
  await lead.save();

  return { lead, lockLost: true };
};