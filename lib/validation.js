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

/* ---------- jobs ---------- */
export const jobSchema = z.object({
  title:   z.string().trim().min(3, 'Title is too short').max(120),
  company: z.string().trim().min(2, 'Company is required').max(120),
  city:    z.string().trim().min(2, 'City is required').max(60),
  state:   z.string().trim().max(60).optional().or(z.literal('')),
  salaryMin: z.coerce.number().int().min(0).max(1000000),
  salaryMax: z.coerce.number().int().min(0).max(1000000),
  qualification: z.array(z.enum(QUALIFICATIONS)).min(1, 'Pick at least one qualification'),
  trade:  z.string().trim().max(80).optional().or(z.literal('')),
  shift:  z.enum(['Day shift', 'Rotational', 'Night shift']).default('Day shift'),
  stay:   z.string().trim().max(60).optional().or(z.literal('')),
  openings: z.coerce.number().int().min(0).max(9999).default(1),
  type:   z.enum(['Full time', 'Trainee', 'Contract']).default('Full time'),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
  expiresAt: z.string().optional().or(z.literal(''))
}).refine((d) => d.salaryMax >= d.salaryMin, {
  message: 'Maximum salary cannot be lower than the minimum',
  path: ['salaryMax']
});

/** A readable, unique URL for each job: "cnc-operator-divgi-tts-a3f9". */
export function slugify(title, company) {
  const base = `${title} ${company}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 60);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
