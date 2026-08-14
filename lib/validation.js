import { z } from 'zod';
import { QUALIFICATIONS } from './fees.js';

/**
 * Anything that fails this schema never reaches the database.
 * Note there is no `amount` field — the client does not get to say
 * what it owes.
 */
export const applicationSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80)
        .regex(/^[a-zA-Z\u0900-\u097F .'-]+$/, 'Name contains invalid characters'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  district: z.string().trim().min(2).max(60),
  qualification: z.enum(QUALIFICATIONS),
  trade: z.string().trim().max(80).optional().or(z.literal('')),
  experience: z.enum(['Fresher', '<1 yr', '1-3 yrs', '3+ yrs']).default('Fresher'),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  resumeUrl: z.string().url().max(400).optional().or(z.literal('')),
  resumePublicId: z.string().max(200).optional().or(z.literal('')),
  jobId: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('')),
  turnstileToken: z.string().max(2000).optional(),
  website: z.string().max(0).optional()      // honeypot: bots fill it, humans cannot see it
});

export function firstError(err) {
  const issue = err.issues?.[0];
  return issue ? issue.message : 'Invalid data';
}
