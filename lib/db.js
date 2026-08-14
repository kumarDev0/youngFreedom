import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * One pooled connection per Node process, reused across requests.
 *
 * This is the single most important reason we run a persistent server
 * instead of serverless: 10k concurrent submissions on serverless would
 * open thousands of connections and take Atlas down. Here they all share
 * one pool.
 *
 * Note: `sanitizeFilter` is deliberately NOT enabled. It strips every `$`
 * operator from queries — including the ones we write ourselves — which
 * silently broke range queries like { createdAt: { $gte: ... } }. Injection
 * is prevented the correct way instead: every request body passes a Zod
 * schema before any value reaches a query, so user input can never be an
 * object like { $ne: null }.
 */
let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);

    cached.promise = mongoose.connect(env.mongoUri, {
      maxPoolSize: env.mongoPool,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',          // no "success" until a majority of nodes stored it
      compressors: ['zlib']
    }).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

mongoose.connection.on('disconnected', () => {
  console.error('[db] disconnected');
  cached.conn = null; cached.promise = null;
});
