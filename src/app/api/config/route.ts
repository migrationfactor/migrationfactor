import { jsonResponse } from '@/lib/api-guard';
import { supabaseConfigured } from '@/lib/supabase/config';

export async function GET() {
  return jsonResponse({ deliveryConfigured: supabaseConfigured() || Boolean(process.env.ENQUIRY_WEBHOOK_URL) });
}
