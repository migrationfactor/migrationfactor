'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeCatalogItem, saveCatalogItem } from '@/app/admin/invoice-actions';
import type { CatalogItem } from '@/lib/invoices/service';
import { formatMoney, type Currency } from '@/lib/invoices/totals';

interface Draft { name: string; description: string; default_rate: string; is_active: boolean }
const blank: Draft = { name: '', description: '', default_rate: '0', is_active: true };

export default function CatalogManager({ items, currency }: { items: CatalogItem[]; currency: Currency }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      setMessage({ text: result.message, error: !result.ok });
      if (result.ok) { after?.(); router.refresh(); }
    });
  }
  const save = (id: string | null, value: Draft) => run(() => saveCatalogItem(id, { ...value, default_rate: Number(value.default_rate) }), () => { setEditing(null); setDraft(blank); });
  const form = (id: string | null) => (
    <form className="catalog-form" onSubmit={(e) => { e.preventDefault(); save(id, draft); }}>
      <label>Item name *<input value={draft.name} maxLength={160} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Description<input value={draft.description} maxLength={1000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label>Default rate ({currency})<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.default_rate} onChange={(e) => setDraft({ ...draft, default_rate: e.target.value })} /></label>
      <div className="invoice-actions">
        <button type="submit" className="admin-button" disabled={pending}>{id ? 'Save item' : 'Add item'}</button>
        {id && <button type="button" className="admin-link-action" onClick={() => { setEditing(null); setDraft(blank); }}>Cancel</button>}
      </div>
    </form>
  );

  return (
    <div className="admin-panel">
      <h2>Add a catalog item</h2>
      {editing === null && form(null)}
      <p role="status" aria-live="polite" className={`admin-message${message?.error ? ' error' : ''}`}>{message?.text}</p>
      <h2>Items</h2>
      {items.length ? <ul className="catalog-list">{items.map((item) => (
        <li key={item.id} className={item.is_active ? undefined : 'catalog-inactive'}>
          {editing === item.id ? form(item.id) : <>
            <div><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}{!item.is_active && <small>Inactive — hidden from the invoice editor</small>}</div>
            <span className="admin-num">{formatMoney(item.default_rate, currency)}</span>
            <div className="catalog-actions">
              <button type="button" className="admin-link-action" disabled={pending} onClick={() => { setEditing(item.id); setDraft({ name: item.name, description: item.description || '', default_rate: String(item.default_rate), is_active: item.is_active }); }}>Edit</button>
              <button type="button" className="admin-link-action" disabled={pending} onClick={() => save(item.id, { name: item.name, description: item.description || '', default_rate: String(item.default_rate), is_active: !item.is_active })}>{item.is_active ? 'Deactivate' : 'Activate'}</button>
              <button type="button" className="admin-link-action danger" disabled={pending} onClick={() => { if (window.confirm(`Delete “${item.name}”? Existing invoices keep their own copy of the item.`)) run(() => removeCatalogItem(item.id)); }}>Delete</button>
            </div>
          </>}
        </li>
      ))}</ul> : <p className="admin-empty">No catalog items yet.</p>}
    </div>
  );
}
