import mongoose from 'mongoose';

/**
 * Atomic sequence for human-readable ids (YF-2026-000123).
 * findOneAndUpdate with $inc is atomic, so two simultaneous submissions
 * can never receive the same number.
 */
const CounterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

export async function nextAppId() {
  const year = new Date().getFullYear();
  const doc = await Counter.findOneAndUpdate(
    { _id: 'application-' + year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return `YF-${year}-${String(doc.seq).padStart(6, '0')}`;
}

export default Counter;
