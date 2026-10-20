import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin/auth';
import { getInvoiceById } from '@/lib/invoices/service';
import { getSettings } from '@/lib/invoices/settings';
import { generateInvoicePdf } from '@/lib/invoices/pdf';
import { isUuid } from '@/lib/invoices/validation';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ message: 'Admin sign-in required.' }, { status: 401, headers });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ message: 'Invoice not found.' }, { status: 404, headers });
  const [invoice, settings] = await Promise.all([getInvoiceById(id), getSettings()]);
  if (!invoice) return NextResponse.json({ message: 'Invoice not found.' }, { status: 404, headers });
  const pdf = await generateInvoicePdf(invoice, settings);
  const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      ...headers,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${invoice.invoice_number.replace(/[^A-Za-z0-9._-]/g, '')}.pdf"`,
    },
  });
}
