import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The homepage — served directly, not via a redirect or a rewrite.
 *
 * A redirect makes the browser change the URL it's showing (that's how
 * the address bar ended up on "/site.html" the first time). A rewrite
 * asks Next.js to internally hand a request for "/" off to a file in
 * /public, which depends on exactly how a given Next.js version resolves
 * a rewrite target that happens to be a static asset — not something
 * this project can verify without a live deploy to test against.
 *
 * This removes that uncertainty entirely: a request to "/" is answered
 * by this route handler, which reads public/site.html off disk itself
 * and returns its exact bytes as the response. There is no redirect, no
 * rewrite, and no dependency on how any particular framework version
 * treats a rewrite destination — just "read this file, send it back",
 * which is unambiguous at any version.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'site.html');
  const html = await readFile(filePath, 'utf8');

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
