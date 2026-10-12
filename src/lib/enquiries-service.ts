import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { services } from '@/content/services';
import { coaching } from '@/content/coaching';
import { validateEnquiryFields, EnquiryData } from '@/lib/enquiry-validation';

export type EnquiryRecord = Omit<EnquiryData, 'website'> & {
  id: string;
  createdAt: string;
};

const serviceNames = new Set([...services, ...coaching].map((s) => s.name));

export function validateEnquiry(input: Record<string, unknown>) {
  return validateEnquiryFields(input, serviceNames);
}

export async function saveEnquiry(dataDir: string, record: EnquiryRecord): Promise<void> {
  try {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const file = await open(path.join(dataDir, 'enquiries.ndjson'), 'a', 0o600);
    try {
      await file.writeFile(JSON.stringify(record) + '\n');
      await file.sync();
    } finally {
      await file.close();
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err.code === 'EROFS' || err.code === 'EACCES')) {
      const fallbackDir = path.join(os.tmpdir(), 'migrationfactor-data');
      await mkdir(fallbackDir, { recursive: true, mode: 0o700 });
      const file = await open(path.join(fallbackDir, 'enquiries.ndjson'), 'a', 0o600);
      try {
        await file.writeFile(JSON.stringify(record) + '\n');
        await file.sync();
      } finally {
        await file.close();
      }
    } else {
      throw err;
    }
  }
}

export async function forwardEnquiry(
  record: EnquiryRecord,
  webhook?: string,
  token?: string
): Promise<boolean> {
  if (!webhook) return false;
  try {
    if (new URL(webhook).protocol !== 'https:') {
      throw new Error('HTTPS required');
    }
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) {
      console.warn('Enquiry saved; delivery rejected. Reference:', record.id);
    }
    return response.ok;
  } catch {
    console.warn('Enquiry saved; delivery failed. Reference:', record.id);
    return false;
  }
}
