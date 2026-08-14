import mongoose from 'mongoose';

/**
 * Append only. Every destructive or sensitive action lands here:
 * deletes, role changes, exports, phone reveals, refunds, job publishing.
 * This is what tells you an insider is harvesting data.
 */
const AuditLogSchema = new mongoose.Schema({
  actor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorEmail: { type: String },
  action:     { type: String, required: true, index: true },  // 'application.delete'
  target:     { type: String },                               // affected id
  meta:       { type: mongoose.Schema.Types.Mixed },
  ip:         { type: String },
  userAgent:  { type: String, maxlength: 300 }
}, { timestamps: { createdAt: true, updatedAt: false } });

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
