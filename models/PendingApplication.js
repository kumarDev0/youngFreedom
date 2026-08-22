import mongoose from 'mongoose';
import { QUALIFICATIONS } from '../lib/fees.js';

/**
 * A holding area, not a record.
 *
 * Cashfree needs an order created before the candidate can pay, and the
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

  /**
   * Manual UPI verification — used only while PAYMENT_MODE=MANUAL_UPI.
   * A candidate pays a fixed UPI ID directly and self-reports the UTR; a
   * staff member checks it against their own bank/UPI app and approves or
   * rejects it. The unique index on utr is the actual fraud control: it
   * makes it impossible for the same real payment's reference number to be
   * submitted against two different applications, whether by mistake or on
   * purpose — the second submission fails at the database, not on trust.
   */
  manualPayment: {
    utr:          { type: String, trim: true, uppercase: true },
    status:       { type: String, enum: ['submitted', 'rejected'], default: undefined },
    submittedAt:  { type: Date },
    rejectedAt:   { type: Date },
    rejectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectReason: { type: String, maxlength: 200 }
  },

  createdAt: { type: Date, default: Date.now },
  /**
   * A plain unpaid form expires after 24 hours (createdAt-based, below). A
   * candidate who has already submitted a UTR for manual verification gets
   * a longer window instead — staff review isn't instant, and deleting the
   * row while a real payment is sitting in a "please check this" queue
   * would silently disappear a paid candidate's application.
   */
  expiresAt: { type: Date }
});

/* MongoDB removes unpaid rows automatically. If manual-payment review
   extended expiresAt, that later date takes over for this document instead
   of the fixed 24-hour default — see the TTL note above. */
PendingApplicationSchema.index({ createdAt: 1 }, {
  expireAfterSeconds: 86400,
  partialFilterExpression: { expiresAt: { $exists: false } }
});
PendingApplicationSchema.index({ expiresAt: 1 }, {
  expireAfterSeconds: 0,
  partialFilterExpression: { expiresAt: { $exists: true } }
});

/* Sparse: only enforced once a UTR is actually present, and normalized to
   uppercase above so "abc123" and "ABC123" collide as the same value. */
PendingApplicationSchema.index({ 'manualPayment.utr': 1 }, { unique: true, sparse: true });

export default mongoose.models.PendingApplication
  || mongoose.model('PendingApplication', PendingApplicationSchema);
