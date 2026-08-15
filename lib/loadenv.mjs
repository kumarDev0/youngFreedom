import fs from 'fs';
import path from 'path';

/**
 * Loads .env.local for scripts run directly with `node`.
 *
 * Next.js reads .env.local automatically, which is why the dev server works
 * without this. A standalone script gets no such help — plain Node knows
 * nothing about .env files — so MONGODB_URI arrives as undefined. This fills
 * that gap, and never overwrites a variable that is already set (so Render's
 * real environment always wins in production).
 */
export function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const file = path.resolve(process.cwd(), name);
    if (!fs.existsSync(file)) continue;

    for (let line of fs.readFileSync(file, 'utf8').split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      /* strip surrounding quotes if someone wrapped the value */
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) process.env[key] = value;
    }
    return name;
  }
  return null;
}
