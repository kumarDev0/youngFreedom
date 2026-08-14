import { NextResponse } from 'next/server';
import { signResumeUpload } from '../../../../lib/cloudinary.js';
import { rateLimit, clientIp } from '../../../../lib/ratelimit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/signature
 * Hands the browser a short-lived signature so it can upload the resume
 * directly to Cloudinary. Our server never touches the file bytes.
 */
export async function GET(req) {
  const ip = clientIp(req);
  const limit = await rateLimit(`upload:${ip}`, 10, 3600);
  if (!limit.ok) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });

  try {
    return NextResponse.json(signResumeUpload());
  } catch (err) {
    console.error('[upload-sign] ', err);
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 });
  }
}
