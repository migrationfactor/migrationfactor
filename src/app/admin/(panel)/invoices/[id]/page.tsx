import { notFound } from 'next/navigation';
import { withAdmin } from '@/lib/admin/auth';
import { getCatalogItems, getCustomerSuggestions, getInvoiceById, newInvoiceDefaults } from '@/lib/invoices/service';
import { getSettings } from '@/lib/invoices/settings';
import { isUuid } from '@/lib/invoices/validation';
import { businessToday } from '@/lib/invoices/totals';
import InvoiceWorkspace from '@/components/admin/invoices/InvoiceWorkspace';

export const metadata = { title: 'Invoice' };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booking?: string; edit?: string }> }) {
  const [{ id }, { booking, edit }] = await Promise.all([params, searchParams]);
  const isNew = id === 'new';
  if (!isNew && !isUuid(id)) notFound();
  const [invoice, defaults, catalog, customers, settings] = await withAdmin(Promise.all([
    isNew ? Promise.resolve(null) : getInvoiceById(id),
    isNew ? newInvoiceDefaults(isUuid(booking) ? booking : undefined) : Promise.resolve(null),
    getCatalogItems(),
    getCustomerSuggestions(),
    getSettings(),
  ]));
  if (!isNew && !invoice) notFound();
  return (
    <InvoiceWorkspace
      key={invoice?.updated_at ?? 'new'}
      invoice={invoice}
      defaults={defaults}
      catalog={catalog}
      customers={customers}
      settings={settings}
      startEditing={isNew || edit === '1'}
      today={businessToday()}
    />
  );
}
