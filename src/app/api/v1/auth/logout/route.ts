import { NextRequest, NextResponse } from 'next/server';
import { revokeSeoSession } from '@/lib/seo-system/auth';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('seo_session_token')?.value;
  if (sessionToken) {
    await revokeSeoSession(sessionToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('seo_session_token');
  return response;
}
