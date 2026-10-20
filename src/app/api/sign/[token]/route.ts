import { NextRequest } from 'next/server';
import { jsonResponse, readPublicJson } from '@/lib/api-guard';
import { isToken } from '@/lib/signatures/fields';
import { signDocument, SigningError } from '@/lib/signatures/service';
import { clientMeta } from '@/lib/signatures/request-meta';

/** Signs with the token from the link; the request id is never accepted from the browser. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return jsonResponse({ message: 'This signing link is not valid.' }, 404);
  // Two PNG images (signature and initials) stay well under 4 MB.
  const parsed = await readPublicJson(req, 'sign', 10, 4 * 1024 * 1024);
  if ('response' in parsed) return parsed.response;
  try {
    const result = await signDocument(token, {
      signaturePng: parsed.input.signaturePng, initialPng: parsed.input.initialPng, fieldValues: parsed.input.fieldValues,
    }, clientMeta(req));
    return jsonResponse({ ok: true, complete: result.complete });
  } catch (error) {
    if (error instanceof SigningError) return jsonResponse({ message: error.message }, error.status);
    console.error('Signing failed:', error instanceof Error ? error.message : 'UnknownError');
    return jsonResponse({ message: 'Your signature could not be saved. Please try again.' }, 500);
  }
}
