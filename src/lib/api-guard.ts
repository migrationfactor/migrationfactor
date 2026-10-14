import { NextRequest, NextResponse } from 'next/server';
import { readBoundedBody } from '@/lib/request-body';

export const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...securityHeaders, ...extra } });
}

const buckets = new Map<string, { start: number; count: number }>();
const windowMs = 600000;

/**
 * Shared checks for public form endpoints: JSON content type, same-origin submission,
 * a per-process rate limit and a bounded body. Returns the parsed object or a response.
 */
export async function readPublicJson(
  req: NextRequest,
  scope: string,
  maxRequests = 8
): Promise<{ input: Record<string, unknown> } | { response: NextResponse }> {
  const contentType = req.headers.get('content-type') || '';
  if (!/^application\/json(?:;|$)/i.test(contentType)) {
    return { response: jsonResponse({ message: 'JSON content is required.' }, 415) };
  }

  const origin = req.headers.get('origin');
  if (origin) {
    let originUrl: URL | null = null;
    try { originUrl = new URL(origin); } catch { originUrl = null; }
    const expectedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (!originUrl || !['http:', 'https:'].includes(originUrl.protocol) || !expectedHost || originUrl.host !== expectedHost) {
      return { response: jsonResponse({ message: 'Submit the form from this website.' }, 403) };
    }
  }

  const now = Date.now();
  for (const [key, value] of buckets) if (now - value.start > windowMs) buckets.delete(key);
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || 'local';
  const key = `${scope}:${ip}`;
  const bucket = buckets.get(key) || { start: now, count: 0 };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > maxRequests) {
    const retryAfter = Math.ceil((windowMs - now + bucket.start) / 1000);
    return {
      response: jsonResponse(
        { message: 'Too many attempts. Please wait a few minutes or email info@migrationfactor.com.' },
        429,
        { 'Retry-After': String(retryAfter) }
      ),
    };
  }

  const raw = await readBoundedBody(req);
  if (raw === null) return { response: jsonResponse({ message: 'Your submission is too large. Please use fewer characters.' }, 413) };
  try {
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid');
    return { input };
  } catch {
    return { response: jsonResponse({ message: 'Invalid request. Please try again.' }, 400) };
  }
}
