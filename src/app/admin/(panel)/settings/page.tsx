import Link from 'next/link';
import { withAdmin } from '@/lib/admin/auth';
import { getSettings } from '@/lib/invoices/settings';
import { getCatalogItems } from '@/lib/invoices/service';
import SettingsForm from '@/components/admin/invoices/SettingsForm';
import CatalogManager from '@/components/admin/invoices/CatalogManager';

export const metadata = { title: 'Settings' };
const tabs: [string, string][] = [['business', 'Business & Branding'], ['invoice', 'Invoice Defaults'], ['catalog', 'Item Catalog']];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab = tabs.some(([key]) => key === requested) ? requested as string : 'business';
  const [settings, catalog] = await withAdmin(Promise.all([getSettings(), getCatalogItems(true)]));
  return (
    <>
      <header className="admin-header"><h1>Settings</h1><p>Invoices, PDFs and emails use these details.</p></header>
      <nav className="admin-tabs" aria-label="Settings sections">
        {tabs.map(([key, label]) => <Link key={key} href={`/admin/settings?tab=${key}`} aria-current={tab === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {tab === 'catalog' ? <CatalogManager items={catalog} currency={settings.invoice_currency} /> : <SettingsForm key={tab} scope={tab as 'business' | 'invoice'} settings={settings} />}
    </>
  );
}
