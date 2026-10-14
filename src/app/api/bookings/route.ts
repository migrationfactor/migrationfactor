import { NextRequest } from 'next/server';
import { jsonResponse, readPublicJson } from '@/lib/api-guard';
import { supabaseConfigured } from '@/lib/supabase/config';
import { validateBooking } from '@/lib/leads/validation';
import { saveBooking, SubmissionConflict } from '@/lib/leads/service';
import { bookingCategories } from '@/features/consultation-booking/model';

export async function POST(req: NextRequest) {
  try {
    const parsed = await readPublicJson(req, 'bookings', 6);
    if ('response' in parsed) return parsed.response;
    const { data, errors } = validateBooking(parsed.input, new Set(bookingCategories));
    if (!data || Object.keys(errors).length) {
      return jsonResponse({ message: errors.form || 'Please check the highlighted fields.', errors }, 422);
    }
    if (!supabaseConfigured()) {
      return jsonResponse({ message: 'Online booking is not available right now. Please contact our team directly.' }, 503);
    }
    const saved = await saveBooking(data);
    return jsonResponse({ id: saved.id, reference: saved.reference, status: 'pending', duplicate: saved.duplicate }, 201);
  } catch (error) {
    if (error instanceof SubmissionConflict) return jsonResponse({ message: error.message }, 409);
    console.error('Booking request failed:', error instanceof Error ? error.message : 'UnknownError');
    return jsonResponse({ message: 'Your booking request could not be saved. Please try again or contact our team directly.' }, 500);
  }
}
