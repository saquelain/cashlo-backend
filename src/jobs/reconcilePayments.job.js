import cron from 'node-cron';
import DistributorLead from '../models/DistributorLead.js';
import PincodeReservation from '../models/PincodeReservation.js';
import { fetchOrderPayments } from '../services/razorpay.service.js';
import { markLeadPaid } from '../utils/paymentReconciliation.js';

// Deliberately short — well inside the 15-minute pincode lock window, so a
// recovered payment usually still finds its own lock intact and confirms
// cleanly, instead of falling into the lock_lost edge case unnecessarily.
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

export const reconcileStuckPayments = async () => {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckLeads = await DistributorLead.find({
    status: 'order_created',
    updatedAt: { $lt: cutoff },
    'razorpay.orderId': { $exists: true, $ne: null },
  });

  if (!stuckLeads.length) return;

  console.log(`🔍 Reconciliation: checking ${stuckLeads.length} stuck booking(s)`);

  for (const lead of stuckLeads) {
    try {
      const { items: payments } = await fetchOrderPayments(lead.razorpay.orderId);
      const captured = payments.find((p) => p.status === 'captured');

      if (captured) {
        // A real payment succeeded and BOTH the client callback and the
        // webhook missed it — exactly the scenario this job exists for.
        const { lockLost } = await markLeadPaid({
          bookingId: lead._id,
          orderId: captured.order_id,
          paymentId: captured.id,
        });
        console.log(`✅ Reconciliation: booking ${lead._id} was actually paid (missed webhook) — recovered${lockLost ? ' as lock_lost' : ''}`);
        continue;
      }

      // No successful payment on Razorpay's side. Before declaring this
      // abandoned, check if the pincode lock is still legitimately active
      // for this exact booking — the user might just be slow on the
      // checkout page, not gone. If so, leave it alone for this run.
      const reservation = await PincodeReservation.findOne({ pincode: lead.pincode });
      const stillActivelyLocked =
        reservation &&
        String(reservation.bookingId) === String(lead._id) &&
        reservation.status === 'locked' &&
        reservation.expiresAt > new Date();

      if (stillActivelyLocked) continue;

      const failedAttempt = payments.find((p) => p.status === 'failed');

      if (failedAttempt) {
        await DistributorLead.findOneAndUpdate(
          { _id: lead._id, status: { $ne: 'paid' } },
          { $set: { status: 'failed', leadCallStatus: 'pending_call' } }
        );
        console.log(`⚠️  Reconciliation: booking ${lead._id} payment failed — flagged for callback`);
        continue;
      }

      // No payment attempt at all, and the lock's gone — genuinely abandoned.
      await DistributorLead.findOneAndUpdate(
        { _id: lead._id, status: { $ne: 'paid' } },
        { $set: { status: 'expired' } }
      );
      console.log(`⌛ Reconciliation: booking ${lead._id} abandoned, marked expired`);
    } catch (err) {
      // One bad lookup shouldn't stop the rest of the batch from being checked.
      console.error(`❌ Reconciliation failed for booking ${lead._id}:`, err.message);
    }
  }
};

export const startReconciliationCron = () => {
  cron.schedule('*/3 * * * *', () => {
    reconcileStuckPayments().catch((err) => console.error('❌ Reconciliation job crashed:', err));
  });
  console.log('🕐 Reconciliation cron scheduled (every 3 minutes)');
};