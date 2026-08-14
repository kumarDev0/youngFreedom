import { redirect } from 'next/navigation';

/**
 * The marketing site is still the standalone HTML file in /public.
 * Phase 4 converts it into real Next.js components so the job board can be
 * driven by the database. Until then this just serves it.
 */
export default function Home() {
  redirect('/site.html');
}
