'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/** Categories and Tags screens in the WordPress layout: Add form on the left, list table on the right. */

const C = { blue: '#2271b1', text: '#1d2327', muted: '#646970', line: '#c3c4c7', red: '#b32d2e', stripe: '#f6f7f7' };
const btn: React.CSSProperties = { padding: '0 10px', lineHeight: '28px', minHeight: 30, border: `1px solid ${C.blue}`, borderRadius: 3, background: '#f6f7f7', color: C.blue, fontSize: 13, cursor: 'pointer' };
const primary: React.CSSProperties = { ...btn, background: C.blue, color: '#fff', fontWeight: 600 };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', borderRadius: 4, padding: '0 8px', lineHeight: '2', minHeight: 30, fontSize: 14, background: '#fff', color: C.text };
const link: React.CSSProperties = { border: 'none', background: 'none', padding: 0, color: C.blue, cursor: 'pointer', fontSize: 13, textDecoration: 'none' };

type Kind = 'category' | 'tag';
type SortKey = 'name' | 'description' | 'slug' | 'post_count';

export default function TaxonomyScreen({ kind }: { kind: Kind }) {
  const isCat = kind === 'category';
  const label = isCat ? 'Category' : 'Tag';
  const plural = isCat ? 'Categories' : 'Tags';
  const api = isCat ? '/api/v1/categories' : '/api/v1/tags';
  const viewBase = isCat ? '/blog/category/' : '/blog/tag/';

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState('');
  const [editing, setEditing] = useState<null | { id: string; full: boolean; draft: any }>(null);
  const [form, setForm] = useState({ name: '', slug: '', parentId: '', description: '' });
  const [busy, setBusy] = useState(false);
  const upd = (patch: Record<string, unknown>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  const load = useCallback(async () => {
    try {
      const res = await fetch(api);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => !q || [r.name, r.slug, r.description].some((v) => String(v || '').toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      const av = sort.key === 'post_count' ? Number(a.post_count || 0) : String(a[sort.key] || '').toLowerCase();
      const bv = sort.key === 'post_count' ? Number(b.post_count || 0) : String(b[sort.key] || '').toLowerCase();
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
    });
  }, [rows, search, sort]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, slug: form.slug || undefined, parentId: isCat && form.parentId ? form.parentId : undefined, description: form.description || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setForm({ name: '', slug: '', parentId: '', description: '' }); setMsg({ ok: true, text: `${label} added.` }); load(); }
      else setMsg({ ok: false, text: data.message || `Could not add the ${label.toLowerCase()}.` });
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const d = editing.draft;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(api, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, name: d.name, slug: d.slug, description: d.description ?? null, ...(isCat && editing.full ? { parentId: d.parent_id || null, seoTitle: d.seo_title || null, metaDescription: d.meta_description || null, robotsIndex: d.robots_index !== false } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setEditing(null); setMsg({ ok: true, text: `${label} updated.` }); load(); }
      else setMsg({ ok: false, text: data.message || 'Update failed.' });
    } finally { setBusy(false); }
  };

  const remove = async (ids: string[]) => {
    if (!ids.length) return;
    const names = rows.filter((r) => ids.includes(r.id)).map((r) => r.name).join(', ');
    if (!confirm(isCat
      ? `You are about to delete: ${names}. Posts only in a deleted category move to the default category, and its archive URL redirects to /blog/. Continue?`
      : `You are about to delete: ${names}. Continue?`)) return;
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(`${api}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) failed++;
    }
    setSelected([]);
    setMsg(failed ? { ok: false, text: `${failed} could not be deleted.` } : { ok: true, text: ids.length > 1 ? `${ids.length} ${plural.toLowerCase()} deleted.` : `${label} deleted.` });
    load();
  };

  const sortHead = (key: SortKey, text: string, align: 'left' | 'right' = 'left') => (
    <th scope="col" style={{ textAlign: align, padding: '8px 10px', fontWeight: 400, fontSize: 14 }}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} style={{ ...link, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {text}
        <span aria-hidden style={{ display: 'inline-flex', flexDirection: 'column', fontSize: 8, lineHeight: '8px', color: '#a7aaad' }}>
          <span style={{ color: sort.key === key && sort.dir === 1 ? C.text : undefined }}>▲</span>
          <span style={{ color: sort.key === key && sort.dir === -1 ? C.text : undefined }}>▼</span>
        </span>
      </button>
    </th>
  );

  const allChecked = shown.length > 0 && shown.every((r) => selected.includes(r.id));
  const toggleAll = (on: boolean) => setSelected(on ? shown.map((r) => r.id) : []);
  const bulkBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk actions" style={{ ...field, width: 'auto', minWidth: 130, lineHeight: '2' }}>
        <option value="">Bulk actions</option>
        <option value="delete">Delete</option>
      </select>
      <button type="button" style={btn} onClick={() => { if (bulk === 'delete') remove(selected); setBulk(''); }}>Apply</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: C.text }}>
      <style>{`.wp-rowactions{visibility:hidden;font-size:13px;padding-top:2px;color:#a7aaad}tr:hover .wp-rowactions,.wp-rowactions:focus-within{visibility:visible}`}</style>
      <h1 style={{ fontSize: 23, fontWeight: 400, margin: '0 0 16px', padding: '9px 0 4px', lineHeight: 1.3 }}>{plural}</h1>

      {msg && (
        <div role="status" style={{ background: '#fff', border: `1px solid ${C.line}`, borderLeft: `4px solid ${msg.ok ? '#00a32a' : '#d63638'}`, padding: '10px 12px', margin: '0 0 12px', fontSize: 13 }}>{msg.text}</div>
      )}

      <form role="search" onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, margin: '10px 0' }}>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={`Search ${plural}`} style={{ ...field, width: 220 }} />
        <button type="submit" style={btn}>Search {plural}</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 33fr) minmax(0, 67fr)', gap: 24, alignItems: 'start' }}>
        {/* Add form */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 12px' }}>Add {label}</h2>
          <form onSubmit={create}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="tax-name" style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>Name</label>
              <input id="tax-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={field} />
              <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>The name is how it appears on your site.</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="tax-slug" style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>Slug</label>
              <input id="tax-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={field} />
              <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>The “slug” is the URL-friendly version of the name. It is usually all lowercase and contains only letters, numbers, and hyphens.</p>
            </div>
            {isCat && (
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="tax-parent" style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>Parent Category</label>
                <select id="tax-parent" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} style={{ ...field, width: 'auto', minWidth: 150 }}>
                  <option value="">None</option>
                  {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Categories, unlike tags, can have a hierarchy. You might have a Jazz category, and under that have children categories for Bebop and Big Band. Totally optional.</p>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="tax-desc" style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>Description</label>
              <textarea id="tax-desc" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...field, lineHeight: 1.4, padding: 6 }} />
              <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>The description is not prominent by default; however, some themes may show it.</p>
            </div>
            <button type="submit" disabled={busy} style={primary}>Add {label}</button>
          </form>
        </div>

        {/* List table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 8px' }}>
            {bulkBar}
            <span style={{ fontSize: 13, color: '#50575e' }}>{shown.length} {shown.length === 1 ? 'item' : 'items'}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: `1px solid ${C.line}`, boxShadow: '0 1px 1px rgba(0,0,0,.04)', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ width: 28, padding: '8px 0 8px 10px' }}><input type="checkbox" aria-label="Select all" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></td>
                {sortHead('name', 'Name')}
                {sortHead('description', 'Description')}
                {sortHead('slug', 'Slug')}
                {sortHead('post_count', 'Count', 'right')}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 12 }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 12 }}>No {plural.toLowerCase()} found.</td></tr>
              ) : shown.map((r, i) => (
                editing && editing.id === r.id ? (
                  <tr key={r.id} style={{ background: '#f0f6fc' }}>
                    <td colSpan={5} style={{ padding: 12 }}>
                      <strong style={{ display: 'block', marginBottom: 8 }}>{editing.full ? `Edit ${label}` : 'Quick Edit'}</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ fontSize: 13 }}>Name<input value={editing.draft.name || ''} onChange={(e) => upd({ name: e.target.value })} style={field} /></label>
                        <label style={{ fontSize: 13 }}>Slug<input value={editing.draft.slug || ''} onChange={(e) => upd({ slug: e.target.value })} style={field} /></label>
                        {editing.full && (
                          <>
                            {isCat && (
                              <label style={{ fontSize: 13 }}>Parent Category
                                <select value={editing.draft.parent_id || ''} onChange={(e) => upd({ parent_id: e.target.value })} style={field}>
                                  <option value="">None</option>
                                  {rows.filter((x) => x.id !== r.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </select>
                              </label>
                            )}
                            <label style={{ fontSize: 13, gridColumn: '1 / -1' }}>Description<textarea rows={3} value={editing.draft.description || ''} onChange={(e) => upd({ description: e.target.value })} style={{ ...field, lineHeight: 1.4, padding: 6 }} /></label>
                            {isCat && (
                              <>
                                <label style={{ fontSize: 13 }}>SEO Title<input value={editing.draft.seo_title || ''} onChange={(e) => upd({ seo_title: e.target.value })} style={field} /></label>
                                <label style={{ fontSize: 13 }}>Meta Description<input value={editing.draft.meta_description || ''} onChange={(e) => upd({ meta_description: e.target.value })} style={field} /></label>
                                <label style={{ fontSize: 13, gridColumn: '1 / -1' }}><input type="checkbox" checked={editing.draft.robots_index !== false} onChange={(e) => upd({ robots_index: e.target.checked })} /> Allow search engines to index this archive</label>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button type="button" style={primary} disabled={busy} onClick={saveEdit}>Update</button>
                        <button type="button" style={btn} onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? C.stripe : '#fff', verticalAlign: 'top' }}>
                    <th scope="row" style={{ padding: '8px 0 8px 10px', width: 28, fontWeight: 400 }}><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} /></th>
                    <td style={{ padding: '8px 10px' }}>
                      <button type="button" onClick={() => setEditing({ id: r.id, full: true, draft: { ...r } })} style={{ ...link, fontWeight: 600, fontSize: 14 }}>{r.parent_name ? `— ${r.name}` : r.name}</button>
                      <div className="wp-rowactions">
                        <button type="button" style={link} onClick={() => setEditing({ id: r.id, full: true, draft: { ...r } })}>Edit</button> |{' '}
                        <button type="button" style={link} onClick={() => setEditing({ id: r.id, full: false, draft: { ...r } })}>Quick Edit</button> |{' '}
                        <button type="button" style={{ ...link, color: C.red }} onClick={() => remove([r.id])}>Delete</button> |{' '}
                        <Link href={`${viewBase}${r.slug}/`} target="_blank" style={{ ...link }}>View</Link>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#50575e' }}>{r.description || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#50575e' }}>{r.slug}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <Link href={`/seo-admin/blog?${isCat ? 'category_id' : 'tag_id'}=${r.id}&status=all`} style={{ color: C.blue, textDecoration: 'none' }}>{r.post_count || 0}</Link>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: '8px 0 8px 10px' }}><input type="checkbox" aria-label="Select all" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></td>
                {['Name', 'Description', 'Slug'].map((h) => <td key={h} style={{ padding: '8px 10px', fontSize: 14 }}>{h}</td>)}
                <td style={{ padding: '8px 10px', fontSize: 14, textAlign: 'right' }}>Count</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
            {bulkBar}
            <span style={{ fontSize: 13, color: '#50575e' }}>{shown.length} {shown.length === 1 ? 'item' : 'items'}</span>
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 20 }}>
            {isCat
              ? <>Deleting a category does not delete the posts in that category. Instead, posts that were only assigned to the deleted category are set to the default category <strong>Uncategorized</strong>.</>
              : <>Tag archives default to noindex until they have at least 3 published posts.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
