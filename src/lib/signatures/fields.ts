/** Dependency-free e-signature field model shared by the editor, the signing page and the server. */

export const fieldTypes = ['signature', 'initial', 'sign_date', 'full_name', 'first_name', 'last_name', 'email', 'checkbox', 'text'] as const;
export type FieldType = typeof fieldTypes[number];

/** Coordinates are percentages of the page with a top-left origin, so they ignore zoom and screen size. */
export interface SignField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
  label?: string;
  value?: string | boolean | null;
}

export const fieldLabels: Record<FieldType, string> = {
  signature: 'Signature', initial: 'Initial', sign_date: 'Sign Date', full_name: 'Full Name',
  first_name: 'First Name', last_name: 'Last Name', email: 'Email', checkbox: 'Checkbox', text: 'Text',
};

/** Default sizes in % of the page (width × height). */
export const defaultSizes: Record<FieldType, [number, number]> = {
  signature: [24, 4], initial: [8, 3], sign_date: [15, 2], full_name: [28, 2], first_name: [28, 2],
  last_name: [28, 2], email: [30, 2], checkbox: [3, 2], text: [20, 2],
};

export const fieldPrompts: Record<FieldType, string> = {
  signature: 'Sign here.', initial: 'Initial here.', sign_date: 'Enter date.', full_name: 'Enter your full name.',
  first_name: 'Enter your first name.', last_name: 'Enter your last name.', email: 'Enter your email.',
  checkbox: 'Tick if it applies.', text: 'Fill in this field.',
};

export const isImageField = (type: FieldType) => type === 'signature' || type === 'initial';
export const isRequired = (field: Pick<SignField, 'type' | 'required'>) => field.required ?? field.type !== 'checkbox';

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
export const isToken = (value: unknown): value is string => typeof value === 'string' && TOKEN_PATTERN.test(value);

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Cleans fields sent by the admin editor: known types only, clamped to the page, rounded to 2 decimals. */
export function sanitizeFields(input: unknown, pageCount: number): SignField[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SignField[] = [];
  for (const raw of input.slice(0, 300)) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as Record<string, unknown>;
    const type = f.type as FieldType;
    const id = typeof f.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(f.id) ? f.id : '';
    if (!id || seen.has(id) || !(fieldTypes as readonly string[]).includes(type)) continue;
    const page = Math.trunc(Number(f.page));
    if (!(page >= 1 && page <= Math.max(1, pageCount))) continue;
    const w = clamp(Number(f.w) || defaultSizes[type][0], 1, 100);
    const h = clamp(Number(f.h) || defaultSizes[type][1], 0.5, 100);
    const x = clamp(Number(f.x) || 0, 0, 100 - w);
    const y = clamp(Number(f.y) || 0, 0, 100 - h);
    seen.add(id);
    out.push({
      id, type, page,
      x: round2(x), y: round2(y), w: round2(w), h: round2(h),
      required: typeof f.required === 'boolean' ? f.required : type !== 'checkbox',
      ...(typeof f.label === 'string' && f.label.trim() ? { label: f.label.trim().slice(0, 80) } : {}),
    });
  }
  return out;
}

/** dd/mm/yyyy for signers; accepts an ISO yyyy-mm-dd date. */
export function formatSignDate(value: string | Date): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Perth', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}

export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

/**
 * Accepts only values for fields that already exist on the request (client coordinates and types are
 * ignored) and reports the first required field left empty.
 */
export function applyFieldValues(fields: SignField[], values: unknown, hasSignature: boolean, hasInitial: boolean): { fields: SignField[]; missing: SignField | null } {
  const submitted = values && typeof values === 'object' && !Array.isArray(values) ? values as Record<string, unknown> : {};
  let missing: SignField | null = null;
  const filled = fields.map((field) => {
    const raw = submitted[field.id];
    let value: string | boolean | null = null;
    if (field.type === 'checkbox') value = raw === true;
    else if (isImageField(field.type)) value = (field.type === 'initial' ? hasInitial || hasSignature : hasSignature) ? 'signed' : null;
    else if (typeof raw === 'string') value = raw.trim().slice(0, field.type === 'email' ? 254 : 200) || null;
    if (field.type === 'sign_date' && typeof value === 'string' && !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) value = formatSignDate(value);
    if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) value = null;
    const empty = value === null || value === '' || (field.type === 'checkbox' && value === false);
    if (!missing && isRequired(field) && empty) missing = field;
    return { ...field, value };
  });
  return { fields: filled, missing };
}

export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

export const expiryOptions = [7, 15, 30, 60] as const;
export const reminderOptions: [number | null, string][] = [[null, 'Do Not Remind'], [3, 'Every 3 days'], [5, 'Every 5 days'], [7, 'Every 7 days'], [10, 'Every 10 days']];
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
