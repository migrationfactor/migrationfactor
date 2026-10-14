import { NextRequest } from 'next/server';
import { jsonResponse, readPublicJson } from '@/lib/api-guard';
import { supabaseConfigured } from '@/lib/supabase/config';
import { validateToolLead } from '@/lib/leads/validation';
import { saveToolLead } from '@/lib/leads/service';
import { allTools } from '@/features/immigration-tools/catalog';

const toolNames = new Map<string, string>(allTools.map((tool) => [tool.slug, tool.name]));

export async function POST(req: NextRequest) {
  try {
    const parsed = await readPublicJson(req, 'tool-leads');
    if ('response' in parsed) return parsed.response;
    const { data, errors } = validateToolLead(parsed.input, new Set(toolNames.keys()));
    if (!data || Object.keys(errors).length) {
      return jsonResponse({ message: errors.form || 'Please check the highlighted fields.', errors }, 422);
    }
    if (!supabaseConfigured()) {
      return jsonResponse({ message: 'Online requests are not available right now. Please email info@migrationfactor.com.' }, 503);
    }
    const saved = await saveToolLead({ ...data, toolName: toolNames.get(data.toolSlug) as string });
    const reference = saved.id.slice(0, 8).toUpperCase();
    return jsonResponse(
      {
        id: saved.id,
        message: saved.duplicate
          ? `We already received this result today. Reference: ${reference}.`
          : `Thank you. Your result has been sent to our team, who will contact you. Reference: ${reference}.`,
      },
      201
    );
  } catch (error) {
    console.error('Tool lead request failed:', error instanceof Error ? error.message : 'UnknownError');
    return jsonResponse({ message: 'Your request could not be saved. Please try again or email info@migrationfactor.com.' }, 500);
  }
}
