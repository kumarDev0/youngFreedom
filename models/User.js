import mongoose from 'mongoose';

/* Roles and what each may do are defined in lib/permissions.js */
export const ROLES = ['owner', 'admin', 'recruiter', 'caller', 'viewer'];

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

  /* rolling counter for phone reveals, reset daily. A caller who reveals
     far more numbers than they mark as called is the clearest signal that
     a list is being copied rather than worked. */
  reveals: { date: String, count: { type: Number, default: 0 } },

  /* calling-team stats, updated as outcomes are logged */
  callStats: {
    assigned:   { type: Number, default: 0 },
    called:     { type: Number, default: 0 },
    interested: { type: Number, default: 0 },
    lastActiveAt: { type: Date }
  },

  sessionVersion: { type: Number, default: 1 },   // bump to force logout everywhere
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
