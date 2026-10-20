import type { NextRequest } from 'next/server';

/** IP (first x-forwarded-for entry, else x-real-ip) and user agent for the signing audit trail. */
export function clientMeta(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown';
  return { ip, userAgent: req.headers.get('user-agent') || 'unknown' };
}
