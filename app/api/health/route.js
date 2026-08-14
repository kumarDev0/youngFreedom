import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Render pings this. If the database is unreachable it returns 503 and
 *  Render stops sending traffic to the bad instance. */
export async function GET() {
  try {
    await connectDB();
    const ok = mongoose.connection.readyState === 1;
    return NextResponse.json(
      { status: ok ? 'ok' : 'degraded', db: ok, uptime: Math.round(process.uptime()) },
      { status: ok ? 200 : 503 }
    );
  } catch {
    return NextResponse.json({ status: 'down', db: false }, { status: 503 });
  }
}
