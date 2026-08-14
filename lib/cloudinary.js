import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key:    env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true
});

/**
 * The browser uploads the resume straight to Cloudinary using this
 * signature. The file never passes through our server, which removes an
 * entire class of upload attacks.
 *
 * type: 'authenticated' keeps the file private — a guessed URL returns
 * nothing without a signed link.
 */
export function signResumeUpload() {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: env.cloudinary.resumeFolder,
    type: 'authenticated',
    allowed_formats: 'pdf,doc,docx,png,jpg,jpeg'
  };
  const signature = cloudinary.utils.api_sign_request(params, env.cloudinary.apiSecret);
  return { ...params, signature, apiKey: env.cloudinary.apiKey, cloudName: env.cloudinary.cloudName };
}

/** Short-lived link so a resume cannot be shared outside the dashboard. */
export function signedResumeUrl(publicId, seconds = 900) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    type: 'authenticated',
    sign_url: true,
    secure: true,
    expires_at: Math.round(Date.now() / 1000) + seconds
  });
}

export { cloudinary };
