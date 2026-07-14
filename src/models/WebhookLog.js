import mongoose from 'mongoose';

const webhookLogSchema = new mongoose.Schema(
  {
    eventType: { type: String, default: 'unknown' },
    razorpayEventId: { type: String },
    signatureValid: { type: Boolean, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    relatedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'DistributorLead' },
    processingStatus: {
      type: String,
      enum: ['processed', 'ignored', 'error', 'invalid_signature'],
      default: 'processed',
    },
    processingNote: { type: String, default: '' },
  },
  { timestamps: true }
);

webhookLogSchema.index({ createdAt: -1 });
webhookLogSchema.index({ relatedBookingId: 1 });

export default mongoose.model('WebhookLog', webhookLogSchema);