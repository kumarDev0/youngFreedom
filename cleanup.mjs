/**
 * Removes files that a previous version left behind.
 *
 * Extracting a zip over an existing folder replaces files with the same
 * name, but never deletes ones that moved. The old app/admin/ folder would
 * survive and give Next two pages for /admin — the stale one still causing
 * the redirect loop. This clears them out.
 *
 *   node cleanup.mjs
 */
import fs from 'fs';
import path from 'path';

const STALE = [
  'app/admin',              // moved into app/(dashboard) and app/(auth)
  'scripts/backup.js',      // renamed to .mjs
  'scripts/reconcile.js',
  'scripts/seed-owner.js'
];

let removed = 0;
for (const rel of STALE) {
  const target = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(target)) continue;
  fs.rmSync(target, { recursive: true, force: true });
  console.log('removed  ' + rel);
  removed++;
}

console.log(removed ? `\nCleaned ${removed} stale path(s).` : 'Nothing to clean — already up to date.');
console.log('Next: npm install && npm run dev');
