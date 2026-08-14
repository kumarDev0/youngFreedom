import mongoose from 'mongoose';

const InviteSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, index: true },
  role:      { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },   // raw token is never stored
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  usedAt:    { type: Date }
}, { timestamps: true });

/* Mongo deletes expired invites on its own */
InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Invite || mongoose.model('Invite', InviteSchema);
