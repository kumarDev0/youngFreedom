import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  /**
   * Unique. Cashfree retries webhooks, and a retry must never create a
   * second row — the duplicate insert fails, which is exactly what we want.
   */
  paymentId: { type: String, required: true, unique: true },
  orderId:   { type: String, required: true, index: true },

  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
  appId:         { type: String, index: true },

  amount:   { type: Number, required: true },   // rupees
  currency: { type: String, default: 'INR' },
  status:   { type: String, enum: ['captured', 'failed', 'refunded'], required: true, index: true },
  method:   { type: String },
  email:    { type: String },
  contact:  { type: String },

  refund: { amount: Number, refundId: String, at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } },

  reconciled: { type: Boolean, default: false, index: true },
  raw:        { type: mongoose.Schema.Types.Mixed }   // the webhook payload, kept for disputes
}, { timestamps: true });

PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
