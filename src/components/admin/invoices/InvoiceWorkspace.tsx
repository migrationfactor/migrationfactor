'use client';
import { useState } from 'react';
import type { AppSettings } from '@/lib/invoices/settings';
import type { CatalogItem, CustomerSuggestion, InvoiceWithItems } from '@/lib/invoices/service';
import type { InvoiceInput } from '@/lib/invoices/validation';
import InvoiceEditor from './InvoiceEditor';
import InvoiceView from './InvoiceView';

interface Props {
  invoice: InvoiceWithItems | null;
  defaults: InvoiceInput | null;
  catalog: CatalogItem[];
  customers: CustomerSuggestion[];
  settings: AppSettings;
  startEditing: boolean;
  today: string;
}

/** Switches one invoice between its PDF-style view and the editor; `invoice = null` means create mode. */
export default function InvoiceWorkspace({ invoice, defaults, catalog, customers, settings, startEditing, today }: Props) {
  const [editing, setEditing] = useState(startEditing || !invoice);
  const [notice, setNotice] = useState('');
  if (editing || !invoice) {
    return <InvoiceEditor invoice={invoice} defaults={defaults} catalog={catalog} customers={customers}
      onCancel={invoice ? () => setEditing(false) : undefined} onSaved={(message) => { setNotice(message); setEditing(false); }} />;
  }
  return <InvoiceView invoice={invoice} settings={settings} today={today} notice={notice} onEdit={() => { setNotice(''); setEditing(true); }} />;
}
