import mongoose from 'mongoose';
import { QUALIFICATIONS } from '../lib/fees.js';

const NoteSchema = new mongoose.Schema({
  by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, maxlength: 2000 },
  at:   { type: Date, default: Date.now }
}, { _id: false });

const ApplicationSchema = new mongoose.Schema({
  appId:  { type: String, required: true, unique: true },      // YF-2026-000123
  token:  { type: String, required: true, unique: true },      // for the private status link

  name:          { type: String, required: true, trim: true, maxlength: 80 },
  phone:         { type: String, required: true, index: true, match: /^[6-9]\d{9}$/ },
  email:         { type: String, trim: true, lowercase: true, maxlength: 120 },
  district:      { type: String, required: true, trim: true, maxlength: 60 },
  qualification: { type: String, required: true, enum: QUALIFICATIONS },
  trade:         { type: String, trim: true, maxlength: 80 },
  experience:    { type: String, enum: ['Fresher', '<1 yr', '1-3 yrs', '3+ yrs'], default: 'Fresher' },
  message:       { type: String, maxlength: 500 },

  resumeUrl:      { type: String },      // optional for now, compulsory later
  resumePublicId: { type: String },

  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true },

  fee: {
    tier:   { type: String, required: true },   // qualification the fee was based on
    amount: { type: Number, required: true }    // rupees, decided server-side
  },

  payment: {
    status:    { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
    orderId:   { type: String, index: true },
    paymentId: { type: String },
    method:    { type: String },
    amount:    { type: Number },
    paidAt:    { type: Date }
  },

  stage:      { type: String, enum: ['new', 'called', 'shortlisted', 'interviewed', 'placed', 'rejected'], default: 'new', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  notes:      [NoteSchema],

  source:    { type: String, default: 'website' },
  ipHash:    { type: String },      // hashed, never the raw IP
  userAgent: { type: String, maxlength: 300 },

  deletedAt: { type: Date, default: null, index: true }   // soft delete only
}, { timestamps: true });

/* Indexes — without these the dashboard collapses past ~50k rows. */
ApplicationSchema.index({ createdAt: -1 });
ApplicationSchema.index({ deletedAt: 1, createdAt: -1 });
ApplicationSchema.index({ 'payment.status': 1, createdAt: -1 });
ApplicationSchema.index({ stage: 1, createdAt: -1 });
ApplicationSchema.index({ district: 1, qualification: 1 });
ApplicationSchema.index({ assignedTo: 1, stage: 1 });
ApplicationSchema.index({ name: 'text', phone: 'text', trade: 'text' });

export default mongoose.models.Application || mongoose.model('Application', ApplicationSchema);
