import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  title:   { type: String, required: true, trim: true, maxlength: 120 },
  company: { type: String, required: true, trim: true, maxlength: 120 },
  slug:    { type: String, required: true, unique: true },

  location: { city: String, state: String },

  salary: {
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },

  qualification: [{ type: String }],       // ['ITI','Diploma']
  trade:    { type: String },
  shift:    { type: String, enum: ['Day shift', 'Rotational', 'Night shift'], default: 'Day shift' },
  stay:     { type: String },              // "Stay provided", "Canteen"
  openings: { type: Number, default: 1, min: 0 },
  type:     { type: String, enum: ['Full time', 'Trainee', 'Contract'], default: 'Full time' },

  description:  { type: String, maxlength: 4000 },
  requirements: [{ type: String }],

  verified:  { type: Boolean, default: true },
  status:    { type: String, enum: ['draft', 'published', 'closed'], default: 'draft', index: true },
  expiresAt: { type: Date, index: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  applicantCount: { type: Number, default: 0 },

  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ qualification: 1, status: 1 });
JobSchema.index({ title: 'text', company: 'text', trade: 'text' });

export default mongoose.models.Job || mongoose.model('Job', JobSchema);
