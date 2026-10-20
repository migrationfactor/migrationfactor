import { NextRequest } from 'next/server';
import { jsonResponse, readPublicJson } from '@/lib/api-guard';
import { isToken } from '@/lib/signatures/fields';
import { declineSignatureRequest, SigningError } from '@/lib/signatures/service';
import { clientMeta } from '@/lib/signatures/request-meta';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return jsonResponse({ message: 'This signing link is not valid.' }, 404);
  const parsed = await readPublicJson(req, 'decline', 10);
  if ('response' in parsed) return parsed.response;
  try {
    await declineSignatureRequest(token, clientMeta(req));
    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof SigningError) return jsonResponse({ message: error.message }, error.status);
    return jsonResponse({ message: 'The request could not be declined. Please try again.' }, 500);
  }
}
