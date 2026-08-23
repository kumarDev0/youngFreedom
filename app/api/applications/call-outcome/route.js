import { NextResponse } from 'next/server';
import { connectDB } from '../../../../lib/db.js';
import Application from '../../../../models/Application.js';
import User from '../../../../models/User.js';
import { requireSession } from '../../../../lib/auth.js';
import { scopeOf } from '../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OUTCOMES = ['not_picked', 'switched_off', 'interested', 'not_interested', 'call_later', 'ready_for_interview'];

/**
 * POST /api/applications/call-outcome  { id, outcome, note }
 *
 * Anyone with an "assigned" scope (a caller) may only log an outcome
 * against a row actually assigned to them — checked server-side by the
 * query filter itself, not by trusting whatever the UI shows. A recruiter
 * or admin can also use this against rows they can otherwise see.
 */
export async function POST(req) {
  try {
    const session = await requireSession();
    const { id, outcome, note } = await req.json();

    if (!OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome.' }, { status: 400 });
    }

    await connectDB();

    const filter = { _id: id, deletedAt: null };
    if (scopeOf(session.role) === 'assigned') filter.assignedTo = session.id;

    const app = await Application.findOne(filter);
    if (!app) return NextResponse.json({ error: 'Not found, or not assigned to you.' }, { status: 404 });

    app.callOutcome = outcome;
    app.callHistory.push({ by: session.id, outcome, note: String(note || '').slice(0, 300) });
    /* moving the pipeline stage forward when a call actually lands — a
       caller's job is calling, not deciding the funnel, so this only ever
       nudges "new" to "called"; later stages are a recruiter's call */
    if (app.stage === 'new' && ['interested', 'ready_for_interview'].includes(outcome)) {
      app.stage = 'called';
    }
    await app.save();

    /* the caller's own running total, read back on the owner's Calling
       Team screen */
    await User.updateOne(
      { _id: session.id },
      {
        $inc: { 'callStats.called': 1, ...(outcome === 'interested' ? { 'callStats.interested': 1 } : {}) },
        $set: { 'callStats.lastActiveAt': new Date() }
      }
    );

    return NextResponse.json({ ok: true });

  } catch (err) {
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[call-outcome] ', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
