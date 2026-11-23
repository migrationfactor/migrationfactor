'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/seo-admin/DataTable';
import { TITLE_SEPARATORS, applyTitleTemplate } from '@/lib/seo-system/settings-defaults';
import type { SeoSettings } from '@/lib/seo-system/settings-defaults';

const card: React.CSSProperties = { background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #c3c4c7', marginBottom: 20 };
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #8c8f94', fontSize: '0.875rem', boxSizing: 'border-box', background: '#fff' };

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>{label}</span>
      {children}
      {help && <span style={{ display: 'block', fontSize: '0.75rem', color: '#50575e', marginTop: 4 }}>{help}</span>}
    </label>
  );
}

export default function SeoSettingsPage() {
  const [s, setS] = useState<SeoSettings | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [impact, setImpact] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/v1/settings/seo');
      if (!res.ok) {
        setMessage('Error: you do not have permission to change SEO settings.');
        return;
      }
      const d = await res.json();
      setS(d.settings);
      setHistory(d.history);
    })();
  }, []);

  if (!s) return <div style={{ padding: 24 }}>{message || 'Loading…'}</div>;

  const set = (patch: Partial<SeoSettings>) => setS({ ...s, ...patch });
  const setOrg = (patch: Partial<SeoSettings['organization']>) => setS({ ...s, organization: { ...s.organization, ...patch } });

  const save = async (confirm: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/v1/settings/seo', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s, confirm }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.needsConfirmation) {
        setImpact(d.impact);
        return;
      }
      if (!res.ok) {
        setMessage('Error: ' + (d.message || 'Could not save.'));
        return;
      }
      setImpact(null);
      setS(d.settings);
      setMessage('Settings saved. Posts with a manual SEO title or description are unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const preview = applyTitleTemplate(s.titleTemplate, { title: 'Skills in Demand Visa: Requirements', siteName: s.siteName, separator: s.titleSeparator });

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title="SEO Settings" subtitle="Site-wide values used for titles, social cards, organization schema and content rules. Manual values on a post always win." />
      {message && (
        <div style={{ padding: '10px 16px', background: message.startsWith('Error') ? '#fcf0f1' : '#f0f0f1', border: '1px solid ' + (message.startsWith('Error') ? '#f1adad' : '#f0f6fc'), borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>
          {message}
        </div>
      )}

      <div style={card}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.05rem', color: '#1d2327' }}>Titles & descriptions</h2>
        <Field label="Site name" help="Used in titles, Open Graph and WebSite schema.">
          <input style={input} value={s.siteName} onChange={(e) => set({ siteName: e.target.value })} />
        </Field>
        <Field label="Alternate site name (optional)">
          <input style={input} value={s.alternateName} onChange={(e) => set({ alternateName: e.target.value })} />
        </Field>
        <Field label="Title separator">
          <select style={input} value={s.titleSeparator} onChange={(e) => set({ titleSeparator: e.target.value as SeoSettings['titleSeparator'] })}>
            {Object.entries(TITLE_SEPARATORS).map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({k})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post title template" help={`Variables: %title%, %sep%, %sitename%. Preview: “${preview}”. Only used when a post has no SEO title of its own.`}>
          <input style={input} value={s.titleTemplate} onChange={(e) => set({ titleTemplate: e.target.value })} />
        </Field>
        <Field label="Default meta description template (optional)" help="Leave empty to let Google choose the snippet from page content (recommended). Variables: %title%, %sitename%.">
          <input style={input} value={s.descriptionTemplate} onChange={(e) => set({ descriptionTemplate: e.target.value })} />
        </Field>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.05rem', color: '#1d2327' }}>Organization (schema)</h2>
        <Field label="Organization name">
          <input style={input} value={s.organization.name} onChange={(e) => setOrg({ name: e.target.value })} />
        </Field>
        <Field label="Logo URL" help="At least 112 × 112 px, publicly crawlable. Example: /brand/logo.png">
          <input style={input} value={s.organization.logoUrl} onChange={(e) => setOrg({ logoUrl: e.target.value })} />
        </Field>
        <Field label="Profile links (one per line)" help="LinkedIn, Facebook, X, registry pages. Used as sameAs.">
          <textarea style={{ ...input, minHeight: 80 }} value={s.organization.sameAs.join('\n')} onChange={(e) => setOrg({ sameAs: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Contact email">
          <input style={input} value={s.organization.email} onChange={(e) => setOrg({ email: e.target.value })} />
        </Field>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.05rem', color: '#1d2327' }}>Social & content defaults</h2>
        <Field label="Default social image" help="Used when a post has no featured image. 1200 × 630 recommended.">
          <input style={input} value={s.defaultSocialImage} onChange={(e) => set({ defaultSocialImage: e.target.value })} />
        </Field>
        <Field label="X (Twitter) handle" help="Example: @migrationfactor">
          <input style={input} value={s.twitterSite} onChange={(e) => set({ twitterSite: e.target.value })} />
        </Field>
        <Field label="Insert a table of contents automatically when a post has at least this many H2 headings" help="0 turns it off. Posts with their own TOC block are never changed.">
          <input style={{ ...input, maxWidth: 120 }} type="number" min={0} max={20} value={s.autoTocMinH2} onChange={(e) => set({ autoTocMinH2: Number(e.target.value) })} />
        </Field>
        <Field label="Days to keep trashed posts" help="After this many days the daily job deletes them permanently (7 to 365). Media files are never deleted.">
          <input style={{ ...input, maxWidth: 120 }} type="number" min={7} max={365} value={s.trashRetentionDays} onChange={(e) => set({ trashRetentionDays: Number(e.target.value) })} />
        </Field>
        <Field label="Minimum words before a post counts as thin content" help="Posts below this are flagged in the quality checks (50 to 5000).">
          <input style={{ ...input, maxWidth: 120 }} type="number" min={50} max={5000} value={s.minWords} onChange={(e) => set({ minWords: Number(e.target.value) })} />
        </Field>
        <Field label="Trusted source domains" help="One per line. Links to these count as authoritative sources in the GEO and link-quality checks.">
          <textarea style={{ ...input, minHeight: 90 }} value={(s.trustedDomains || []).join(String.fromCharCode(10))} onChange={(e) => set({ trustedDomains: e.target.value.split(String.fromCharCode(10)) })} />
        </Field>
        <Field label="Brand name variants" help="One per line. Spellings that should always be written the same way (for example Migration Factor, MigrationFactor).">
          <textarea style={{ ...input, minHeight: 70 }} value={(s.brandAliases || []).join(String.fromCharCode(10))} onChange={(e) => set({ brandAliases: e.target.value.split(String.fromCharCode(10)) })} />
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={s.requireFeaturedImage} onChange={(e) => set({ requireFeaturedImage: e.target.checked })} />
          Require a featured image before publishing
        </label>
      </div>

      {impact && (
        <div style={{ ...card, border: '2px solid #f59e0b' }}>
          <strong>This will change the title of {impact.titles} post(s) that do not have their own SEO title.</strong>
          {impact.examples.length > 0 && (
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: '0.85rem' }}>
              {impact.examples.map((t: string) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={busy} onClick={() => save(true)} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#3858e9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Confirm and save
            </button>
            <button onClick={() => setImpact(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #8c8f94', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <button disabled={busy} onClick={() => save(false)} style={{ padding: '11px 22px', borderRadius: 8, border: 'none', background: '#3858e9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>

      {history.length > 0 && (
        <div style={{ ...card, marginTop: 24 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.05rem', color: '#1d2327' }}>Change history</h2>
          {history.map((h) => (
            <div key={h.id} style={{ fontSize: '0.8125rem', color: '#50575e', padding: '4px 0' }}>
              {new Date(h.changed_at).toLocaleString()} · {h.changed_by || 'unknown'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
