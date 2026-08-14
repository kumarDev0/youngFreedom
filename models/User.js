import mongoose from 'mongoose';

/**
 * owner     — everything, including team management and payment data
 * admin     — applications, jobs, reports. Cannot manage users.
 * recruiter — only their own jobs and those applicants. No payment data,
 *             no export, phone numbers masked with a daily reveal cap.
 * viewer    — read only
 */
export const ROLES = ['owner', 'admin', 'recruiter', 'viewer'];

const UserSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  passwordHash: { type: String },          // scrypt, see lib/password.js
  role: { type: String, enum: ROLES, default: 'recruiter', index: true },

  twoFactor: {
    enabled:       { type: Boolean, default: false },
    secret:        { type: String },        // encrypted at rest
    backupCodes:   [{ type: String }],      // hashed
    confirmedAt:   { type: Date }
  },

  status: { type: String, enum: ['invited', 'active', 'disabled'], default: 'invited', index: true },

  failedLogins: { type: Number, default: 0 },
  lockedUntil:  { type: Date },
  lastLoginAt:  { type: Date },
  lastLoginIp:  { type: String },

  /* rolling counter for phone reveals, reset daily */
  reveals: { date: String, count: { type: Number, default: 0 } },

  sessionVersion: { type: Number, default: 1 },   // bump to force logout everywhere
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
