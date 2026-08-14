import mongoose from 'mongoose';
import { QUALIFICATIONS } from '../lib/fees.js';

/**
 * A holding area, not a record.
 *
 * Razorpay needs an order created before the candidate can pay, and the
 * webhook that confirms payment only sends back an orderId — no name, no
 * phone. So the details have to live somewhere for the few minutes between
 * "submitted" and "paid", or a successful payment would arrive with nobody
 * attached to it.
 *
 * This collection is that gap and nothing more. The TTL index below makes
 * MongoDB delete every unpaid row automatically after 24 hours — no cron,
 * no cleanup script, no way to forget. Only paid candidates are ever copied
 * into `applications`, so dashboards, exports and reports never show a row
 * that was not paid for.
 *
 * 24 hours rather than 1: if a webhook is delayed or fails, the nightly
 * reconciliation still finds the pending row and completes the record.
 * Deleting sooner would mean money arriving with the details already gone.
 */
const PendingApplicationSchema = new mongoose.Schema({
  appId: { type: String, required: true, unique: true },
  token: { type: String, required: true },

  name:          { type: String, required: true, trim: true, maxlength: 80 },
  phone:         { type: String, required: true, index: true },
  email:         { type: String, trim: true, lowercase: true, maxlength: 120 },
  district:      { type: String, required: true, trim: true, maxlength: 60 },
  qualification: { type: String, required: true, enum: QUALIFICATIONS },
  trade:         { type: String, trim: true, maxlength: 80 },
  experience:    { type: String, default: 'Fresher' },
  message:       { type: String, maxlength: 500 },

  resumeUrl:      { type: String },
  resumePublicId: { type: String },
  jobId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },

  fee: {
    tier:   { type: String, required: true },
    amount: { type: Number, required: true }
  },

  orderId: { type: String, required: true, index: true },

  ipHash:    { type: String },
  userAgent: { type: String, maxlength: 300 },

  createdAt: { type: Date, default: Date.now }
});

/* MongoDB removes these rows on its own, 24 hours after creation. */
PendingApplicationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.models.PendingApplication
  || mongoose.model('PendingApplication', PendingApplicationSchema);
