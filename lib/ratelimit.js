import { env } from './env.js';

/**
 * Upstash Redis when configured (works across multiple Render instances),
 * with an in-memory fallback so local dev and a single instance still work.
 */
/* Lazily created on first use — a top-level await here would break the build. */
let redis = null, redisTried = false;
async function getRedis() {
  if (redisTried) return redis;
  redisTried = true;
  if (env.redis.url && env.redis.token) {
    try {
      const { Redis } = await import('@upstash/redis');
      redis = new Redis({ url: env.redis.url, token: env.redis.token });
    } catch { redis = null; }
  }
  return redis;
}

const memory = new Map();

export async function rateLimit(key, limit, windowSec) {
  const now = Date.now();
  const r = await getRedis();

  if (r) {
    const k = `rl:${key}`;
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, windowSec);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  }

  const entry = memory.get(key);
  if (!entry || now > entry.reset) {
    memory.set(key, { count: 1, reset: now + windowSec * 1000 });
    if (memory.size > 10000) {                       // keep the map bounded
      for (const [k, v] of memory) if (now > v.reset) memory.delete(k);
    }
    return { ok: true, remaining: limit - 1 };
  }
  entry.count++;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

/** Cloudflare gives the real client IP; everything else can be spoofed. */
export function clientIp(req) {
  return req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || '0.0.0.0';
}
