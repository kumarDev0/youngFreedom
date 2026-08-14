/**
 * Nightly backup.
 *
 * The Atlas free tier has NO point-in-time recovery. If the database is
 * corrupted or wiped, everything is gone. Run this on a Render cron job
 * until you move to M10, which has proper backups built in.
 *
 *   Render → New → Cron Job → schedule "0 20 * * *" (01:30 IST)
 *   Command: node scripts/backup.js
 */
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const stamp = new Date().toISOString().slice(0, 10);
const out = `/tmp/yf-backup-${stamp}`;

try {
  console.log('dumping database...');
  execSync(`mongodump --uri="${process.env.MONGODB_URI}" --archive=${out}.gz --gzip`, { stdio: 'inherit' });

  console.log('uploading...');
  const res = await cloudinary.uploader.upload(`${out}.gz`, {
    resource_type: 'raw',
    folder: 'youngfreedom/backups',
    public_id: `backup-${stamp}`,
    type: 'authenticated'
  });

  fs.unlinkSync(`${out}.gz`);
  console.log('backup stored:', res.public_id);

  /* keep 30 days */
  const old = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  await cloudinary.uploader.destroy(`youngfreedom/backups/backup-${old}`, { resource_type: 'raw', type: 'authenticated' })
    .catch(() => {});
} catch (e) {
  console.error('BACKUP FAILED', e);
  process.exit(1);   // non-zero makes Render alert you
}
