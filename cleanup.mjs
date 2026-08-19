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
  'app/admin',                              // moved into app/(dashboard) and app/(auth)
  'app/(dashboard)/admin/LogoutButton.js',  // folded into Shell.js
  'scripts/backup.js',      // renamed to .mjs
  'scripts/reconcile.js',
  'scripts/seed-owner.js',

  /* replaced by smaller WebP versions of the same photographs */
  'public/img/team.jpg',
  'public/img/sunset.jpg',
  'public/img/portrait.jpg',
  'public/img/batch1.jpg',
  'public/img/batch2.jpg',
  'public/img/batch3.jpg',
  'public/img/batch4.jpg',
  'public/img/batch5.jpg',
  'public/img/batch6.jpg',

  /* replaced by the Cashfree integration */
  'lib/razorpay.js'
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
