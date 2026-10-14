import { NextRequest } from 'next/server';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { validateEnquiry, saveEnquiry, forwardEnquiry } from '@/lib/enquiries-service';
import { jsonResponse, readPublicJson } from '@/lib/api-guard';
import { supabaseConfigured } from '@/lib/supabase/config';
import { saveContactLead, saveToolLead } from '@/lib/leads/service';

export async function POST(req: NextRequest) {
  try {
    const parsed = await readPublicJson(req, 'enquiries');
    if ('response' in parsed) return parsed.response;
    const input = parsed.input;

    const { data, errors } = validateEnquiry(input);
    if (Object.keys(errors).length > 0) {
      return jsonResponse({ message: 'Please check the highlighted fields.', errors }, 422);
    }

    if (supabaseConfigured()) {
      // The homepage visa assessment is a visa tool, so it is filed with tool leads.
      const saved = input.source === 'visa_assessment'
        ? await saveToolLead({
            toolSlug: 'visa-assessment', toolName: 'Visa Assessment', name: data.name, email: data.email.toLowerCase(),
            phone: data.phone, message: '', answers: { service: data.service }, resultSummary: data.message, consent: data.consent,
          })
        : await saveContactLead(data);
      const reference = saved.id.slice(0, 8).toUpperCase();
      return jsonResponse(
        {
          id: saved.id,
          delivery: 'saved',
          message: saved.duplicate
            ? `We already received this enquiry today. Reference: ${reference}. Our team will be in touch.`
            : `Thank you. Your enquiry has been received and our team will be in touch. Reference: ${reference}.`,
        },
        201
      );
    }

    // Fallback for local development without Supabase credentials.
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      name: data.name, email: data.email, phone: data.phone,
      service: data.service, message: data.message, consent: data.consent,
    };
    const dataDir =
      process.env.DATA_DIR ||
      (process.env.VERCEL ? path.join(os.tmpdir(), 'migrationfactor-data') : path.join(process.cwd(), 'data'));
    await saveEnquiry(dataDir, record);
    const webhook = process.env.ENQUIRY_WEBHOOK_URL || '';
    const delivered = await forwardEnquiry(record, webhook, process.env.ENQUIRY_WEBHOOK_TOKEN || '');
    return jsonResponse(
      {
        id: record.id,
        delivery: delivered ? 'forwarded' : 'local',
        message: delivered
          ? `Your enquiry has been saved and forwarded to the enquiry service. Reference: ${record.id.slice(0, 8)}.`
          : `Your enquiry has been saved on this server. It has not been emailed to Migration Factor. Reference: ${record.id.slice(0, 8)}. For a direct response, email info@migrationfactor.com.`,
      },
      201
    );
  } catch (error) {
    console.error('Enquiry request failed:', error instanceof Error ? error.message : 'UnknownError');
    return jsonResponse(
      { message: 'Your enquiry could not be saved. Please try again or email info@migrationfactor.com.' },
      500
    );
  }
}
