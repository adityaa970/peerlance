import { GoogleGenAI } from '@google/genai';

// Free-tier model by default. Override with GEMINI_MODEL in .env / Vercel.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;

/** Shared Gemini client (Google AI Studio key in GEMINI_API_KEY). */
export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Download an image so it can be sent to Gemini inline (the Gemini API can't
 * fetch arbitrary URLs itself). Callers must only pass trusted URLs.
 */
export async function fetchImageAsInlineData(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);

  const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!mimeType.startsWith('image/')) throw new Error('File is not an image');

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Image is too large');

  return { mimeType, data: bytes.toString('base64') };
}

/** True when Gemini rejected the call because the (free-tier) quota was hit. */
export function isRateLimited(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 429;
}
