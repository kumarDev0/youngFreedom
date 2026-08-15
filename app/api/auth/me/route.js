import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth.js';
import { CAPS } from '../../../../lib/permissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Who am I, and what may I do. The dashboard uses this to decide what to
 *  render — but every API still re-checks on its own. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    label: CAPS[session.role]?.label,
    caps: CAPS[session.role]
  });
}
