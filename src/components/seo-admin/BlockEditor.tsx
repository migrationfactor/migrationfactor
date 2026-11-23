'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeReport, htmlToBlocks } from './paste-clean';

/**
 * Block-based content editor (FR-EDT-001..006). The block tree is the source of truth; the
 * server renders sanitized HTML from it. Every block is keyboard operable (move / duplicate /
 * delete buttons) and heading rules from FR-EDT-002 are enforced live.
 */

export interface Block {
  type: string;
  data: any;
}
interface Item {
  id: string;
  block: Block;
}
export interface PickedMedia {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

const BRAND = { dark: '#1d2327', teal: '#3858e9', line: '#c3c4c7', soft: '#f6f7f7', muted: '#50575e', red: '#d63638', amber: '#996800' };
const box: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' };
const smallBtn: React.CSSProperties = { padding: '3px 8px', borderRadius: 4, border: `1px solid ${BRAND.line}`, background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: BRAND.dark };
const GENERIC_ANCHORS = /^(click here|read more|here|this link|link|more)$/i;

let counter = 0;
const uid = () => `b${Date.now().toString(36)}${counter++}`;
const toItems = (blocks: Block[]): Item[] => (blocks || []).map((b) => ({ id: uid(), block: b }));

const BLOCK_TYPES: Array<{ type: string; label: string; make: () => any; adminOnly?: boolean }> = [
  { type: 'paragraph', label: 'Paragraph', make: () => ({ text: '' }) },
  { type: 'heading', label: 'Heading', make: () => ({ level: 2, text: '' }) },
  { type: 'list', label: 'List', make: () => ({ style: 'unordered', items: [''] }) },
  { type: 'table', label: 'Table', make: () => ({ withHeaderRow: true, caption: '', content: [['Column 1', 'Column 2'], ['', '']] }) },
  { type: 'image', label: 'Image', make: () => ({ url: '', alt: '', caption: '', isDecorative: false }) },
  { type: 'gallery', label: 'Gallery', make: () => ({ images: [] }) },
  { type: 'quote', label: 'Quote', make: () => ({ text: '', caption: '' }) },
  { type: 'callout', label: 'Callout / note', make: () => ({ tone: 'info', title: '', text: '' }) },
  { type: 'key_takeaways', label: 'Key takeaways', make: () => ({ title: 'Key Takeaways', items: [''] }) },
  { type: 'faq', label: 'FAQ', make: () => ({ heading: 'Frequently Asked Questions', items: [{ question: '', answer: '' }, { question: '', answer: '' }] }) },
  { type: 'steps', label: 'Steps (how-to)', make: () => ({ title: 'Steps', steps: [{ name: '', text: '' }] }) },
  { type: 'toc', label: 'Table of contents', make: () => ({}) },
  { type: 'code', label: 'Code', make: () => ({ code: '', language: '' }) },
  { type: 'video', label: 'Video link', make: () => ({ url: '', title: '' }) },
  { type: 'divider', label: 'Divider', make: () => ({}) },
  { type: 'button', label: 'Button / call to action', make: () => ({ text: '', url: '' }) },
  { type: 'raw_html', label: 'Custom HTML (admin)', make: () => ({ html: '' }), adminOnly: true },
];
const LABEL = Object.fromEntries(BLOCK_TYPES.map((t) => [t.type, t.label]));

const stripTags = (s: string) => (s || '').replace(/<[^>]*>/g, '').trim();

/* ------------------------------ inline text field with formatting ------------------------------ */

function InlineField({
  value, onChange, rows = 3, placeholder, onPasteBlocks, onMarkdownShortcut, large,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  onPasteBlocks?: (html: string) => boolean;
  onMarkdownShortcut?: (v: string) => boolean;
  large?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [link, setLink] = useState<{ url: string; blank: boolean; rel: string } | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [warn, setWarn] = useState('');

  const wrap = (open: string, close: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || 'text';
    onChange(value.slice(0, a) + open + sel + close + value.slice(b));
    setTimeout(() => { el.focus(); el.setSelectionRange(a + open.length, a + open.length + sel.length); }, 0);
  };

  const applyLink = () => {
    if (!link) return;
    const el = ref.current;
    const sel = el ? value.slice(el.selectionStart, el.selectionEnd) : '';
    const anchor = sel || 'link text';
    if (GENERIC_ANCHORS.test(anchor.trim())) { setWarn('Use descriptive anchor text instead of "' + anchor + '".'); }
    else setWarn('');
    if (/^\s*(javascript|data|vbscript):/i.test(link.url)) { setWarn('That URL type is not allowed.'); return; }
    const rel = [link.blank ? 'noopener' : '', ...link.rel.split(' ').filter(Boolean)].filter(Boolean).join(' ');
    const html = `<a href="${link.url.replace(/"/g, '&quot;')}"${link.blank ? ' target="_blank"' : ''}${rel ? ` rel="${rel}"` : ''}>${anchor}</a>`;
    if (el) onChange(value.slice(0, el.selectionStart) + html + value.slice(el.selectionEnd));
    setLink(null);
    setResults([]);
  };

  const search = async (q: string) => {
    if (q.length < 3 || /^https?:/i.test(q)) return setResults([]);
    const res = await fetch(`/api/v1/posts?status=published&search=${encodeURIComponent(q)}&limit=6`);
    if (res.ok) setResults(((await res.json()).posts || []).slice(0, 6));
  };

  const tools: Array<[string, string, string, string]> = [['B', '<strong>', '</strong>', 'Bold'], ['I', '<em>', '</em>', 'Italic'], ['U', '<u>', '</u>', 'Underline'], ['S', '<s>', '</s>', 'Strikethrough'], ['</>', '<code>', '</code>', 'Inline code'], ['x²', '<sup>', '</sup>', 'Superscript'], ['x₂', '<sub>', '</sub>', 'Subscript']];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
        {tools.map(([l, o, c, t]) => (
          <button key={t} type="button" title={t} aria-label={t} style={smallBtn} onClick={() => wrap(o, c)}>{l}</button>
        ))}
        <button type="button" style={smallBtn} title="Insert link (Ctrl+K)" onClick={() => setLink({ url: '', blank: false, rel: '' })}>🔗 Link</button>
        <button type="button" style={smallBtn} title="Clear formatting" onClick={() => onChange(value.replace(/<\/?(strong|em|u|s|code|sup|sub|a)(\s[^>]*)?>/gi, ''))}>Clear</button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { if (onMarkdownShortcut?.(e.target.value)) return; onChange(e.target.value); }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setLink({ url: '', blank: false, rel: '' }); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('<strong>', '</strong>'); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('<em>', '</em>'); }
        }}
        onPaste={(e) => {
          const html = e.clipboardData.getData('text/html');
          if (html && onPasteBlocks?.(html)) e.preventDefault();
        }}
        style={{ ...box, fontSize: large ? '1.05rem' : '0.95rem', lineHeight: 1.6, resize: 'vertical' }}
      />
      {warn && <div style={{ color: BRAND.amber, fontSize: '0.75rem', marginTop: 4 }}>⚠ {warn}</div>}
      {link && (
        <div style={{ border: `1px solid ${BRAND.line}`, background: BRAND.soft, padding: 10, borderRadius: 8, marginTop: 6 }}>
          <input autoFocus placeholder="https://… or type to search your posts" value={link.url} onChange={(e) => { setLink({ ...link, url: e.target.value }); search(e.target.value); }} style={box} />
          {results.map((r) => (
            <button key={r.id} type="button" onClick={() => { setLink({ ...link, url: r.legacy_path || `/blog/${r.slug}` }); setResults([]); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem' }}>
              {r.title} <span style={{ color: BRAND.muted }}>{r.legacy_path || `/blog/${r.slug}`}</span>
            </button>
          ))}
          <div style={{ display: 'flex', gap: 14, margin: '8px 0', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            <label><input type="checkbox" checked={link.blank} onChange={(e) => setLink({ ...link, blank: e.target.checked })} /> Open in new tab</label>
            {['nofollow', 'sponsored', 'ugc'].map((r) => (
              <label key={r}><input type="checkbox" checked={link.rel.split(' ').includes(r)} onChange={(e) => setLink({ ...link, rel: e.target.checked ? `${link.rel} ${r}`.trim() : link.rel.split(' ').filter((x) => x !== r).join(' ') })} /> {r}</label>
            ))}
          </div>
          <button type="button" onClick={applyLink} style={{ ...smallBtn, background: BRAND.teal, color: '#fff' }}>Insert link</button>{' '}
          <button type="button" onClick={() => setLink(null)} style={smallBtn}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ main editor ------------------------------ */

export default function BlockEditor({
  value, onChange, resetKey, canRawHtml, focusKeyword, pickMedia, notify,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  resetKey: string | number;
  canRawHtml: boolean;
  focusKeyword?: string;
  pickMedia: () => Promise<PickedMedia | null>;
  notify: (msg: string) => void;
}) {
  const [items, setItems] = useState<Item[]>(() => toItems(value));
  const history = useRef<Item[][]>([]);
  const future = useRef<Item[][]>([]);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setItems(toItems(value));
    history.current = [];
    future.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const commit = useCallback((next: Item[], record = true) => {
    if (record) { history.current = [...history.current.slice(-49), items]; future.current = []; }
    setItems(next);
    onChange(next.map((i) => i.block));
  }, [items, onChange]);

  const undo = () => { const prev = history.current.pop(); if (!prev) return; future.current.push(items); setItems(prev); onChange(prev.map((i) => i.block)); };
  const redo = () => { const nxt = future.current.pop(); if (!nxt) return; history.current.push(items); setItems(nxt); onChange(nxt.map((i) => i.block)); };

  const update = (id: string, data: any) => commit(items.map((i) => (i.id === id ? { ...i, block: { ...i.block, data: { ...i.block.data, ...data } } } : i)));
  const replace = (id: string, block: Block) => commit(items.map((i) => (i.id === id ? { ...i, block } : i)));
  const remove = (id: string) => commit(items.filter((i) => i.id !== id));
  const move = (idx: number, dir: -1 | 1) => { const j = idx + dir; if (j < 0 || j >= items.length) return; const n = [...items]; [n[idx], n[j]] = [n[j], n[idx]]; commit(n); };
  const duplicate = (idx: number) => { const n = [...items]; n.splice(idx + 1, 0, { id: uid(), block: JSON.parse(JSON.stringify(items[idx].block)) }); commit(n); };
  const insertAt = (idx: number, type: string) => {
    const def = BLOCK_TYPES.find((t) => t.type === type);
    if (!def) return;
    const n = [...items];
    n.splice(idx, 0, { id: uid(), block: { type, data: def.make() } });
    commit(n);
  };

  // heading outline + rules (FR-EDT-002)
  const outline = useMemo(() => {
    const out: Array<{ idx: number; level: number; text: string; warnings: string[] }> = [];
    let prev = 1;
    const seen = new Map<string, number>();
    items.forEach((it, idx) => {
      if (it.block.type !== 'heading') return;
      const level = Number(it.block.data.level) || 2;
      const text = stripTags(it.block.data.text || '');
      const warnings: string[] = [];
      if (!text) warnings.push('Empty heading: blocks publishing.');
      if (level > prev + 1) warnings.push(`Skipped level: H${prev} followed by H${level}.`);
      if (text.length > 90) warnings.push('Long headings are hard to scan.');
      const key = `${level}:${text.toLowerCase()}`;
      if (text && seen.has(key)) warnings.push('Repeated identical heading.');
      seen.set(key, idx);
      out.push({ idx, level, text, warnings });
      prev = level;
    });
    const kw = (focusKeyword || '').toLowerCase().trim();
    const sub = out.filter((h) => h.level <= 3 && h.text);
    if (kw && sub.length >= 3 && sub.filter((h) => h.text.toLowerCase().includes(kw)).length / sub.length > 0.75) {
      out.forEach((h) => h.warnings.push('Possible keyword stuffing in headings.'));
    }
    return out;
  }, [items, focusKeyword]);

  const allowedLevels = (idx: number): number[] => {
    let prev: number | null = null;
    for (let i = 0; i < idx; i++) if (items[i].block.type === 'heading') prev = Number(items[i].block.data.level) || 2;
    if (prev === null) return [2];
    if (prev === 2) return [2, 3];
    return [2, 3, 4];
  };

  const pasteBlocks = (idx: number, html: string): boolean => {
    if (!/<(p|h[1-6]|ul|ol|table|blockquote)[\s>]/i.test(html)) return false;
    const { blocks, report } = htmlToBlocks(html);
    if (!blocks.length) return false;
    const n = [...items];
    n.splice(idx + 1, 0, ...blocks.map((b) => ({ id: uid(), block: b })));
    commit(n);
    notify(describeReport(report));
    return true;
  };

  const markdownShortcut = (id: string, v: string): boolean => {
    const h = /^(#{2,4})\s(.*)$/.exec(v);
    if (h) { replace(id, { type: 'heading', data: { level: h[1].length, text: h[2] } }); return true; }
    if (/^#\s/.test(v)) { replace(id, { type: 'heading', data: { level: 2, text: v.slice(2) } }); notify('A heading level 1 was converted to H2 (the post title is the only H1).'); return true; }
    if (/^[-*]\s/.test(v)) { replace(id, { type: 'list', data: { style: 'unordered', items: [v.slice(2)] } }); return true; }
    if (/^1\.\s/.test(v)) { replace(id, { type: 'list', data: { style: 'ordered', items: [v.slice(3)] } }); return true; }
    return false;
  };

  const words = useMemo(() => items.map((i) => JSON.stringify(i.block.data).replace(/<[^>]*>|"[a-zA-Z_]+":|[{}\[\]",]/g, ' ')).join(' ').split(/\s+/).filter(Boolean).length, [items]);

  const inserter = (idx: number) => (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
      <select
        aria-label="Add block"
        value=""
        onChange={(e) => e.target.value && insertAt(idx, e.target.value)}
        style={{ padding: '4px 10px', borderRadius: 14, border: `1px dashed ${BRAND.teal}`, color: BRAND.teal, background: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
      >
        <option value="">+ Add block</option>
        {BLOCK_TYPES.filter((t) => !t.adminOnly || canRawHtml).map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
      </select>
    </div>
  );

  const renderBody = (it: Item, idx: number) => {
    const d = it.block.data || {};
    const set = (patch: any) => update(it.id, patch);
    switch (it.block.type) {
      case 'paragraph':
        return <InlineField value={d.text || ''} onChange={(v) => set({ text: v })} rows={4} placeholder="Write a paragraph… (type ## for a heading, - for a list)" onPasteBlocks={(h) => pasteBlocks(idx, h)} onMarkdownShortcut={(v) => markdownShortcut(it.id, v)} />;
      case 'heading': {
        const lv = Number(d.level) || 2;
        const ok = allowedLevels(idx);
        const w = outline.find((o) => o.idx === idx)?.warnings || [];
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <select value={lv} onChange={(e) => set({ level: Number(e.target.value) })} style={{ ...box, width: 90 }} aria-label="Heading level">
                {[2, 3, 4].map((l) => <option key={l} value={l} disabled={!ok.includes(l) && l !== lv}>H{l}</option>)}
              </select>
              <input value={d.anchorId || ''} onChange={(e) => set({ anchorId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="anchor id (optional)" style={{ ...box, flex: 1 }} />
            </div>
            <input value={d.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder="Heading text" style={{ ...box, fontWeight: 700, fontSize: lv === 2 ? '1.25rem' : lv === 3 ? '1.1rem' : '1rem' }} />
            {w.map((m) => <div key={m} style={{ color: m.startsWith('Empty') ? BRAND.red : BRAND.amber, fontSize: '0.75rem', marginTop: 4 }}>⚠ {m}</div>)}
            <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => { const t = (d.text || '').trim(); if (t && !/\?$/.test(t)) set({ text: `What ${/^(is|are)\b/i.test(t) ? '' : 'Is '}${t}?`.replace(/\s+/g, ' ') }); }}>Suggest question form</button>
          </div>
        );
      }
      case 'list':
        return (
          <div>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={d.style === 'ordered'} onChange={(e) => set({ style: e.target.checked ? 'ordered' : 'unordered' })} /> Numbered list</label>
            {d.style === 'ordered' && <input type="number" min={1} value={d.start || 1} onChange={(e) => set({ start: Number(e.target.value) })} style={{ ...box, width: 80, marginLeft: 8 }} aria-label="Start at" />}
            {(d.items || []).map((li: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input value={typeof li === 'string' ? li : li?.text || ''} onChange={(e) => { const n = [...d.items]; n[i] = e.target.value; set({ items: n }); }} style={box} placeholder={`Item ${i + 1}`} />
                <button type="button" style={smallBtn} onClick={() => set({ items: d.items.filter((_: any, k: number) => k !== i) })} aria-label="Remove item">✕</button>
              </div>
            ))}
            <button type="button" style={{ ...smallBtn, marginTop: 6 }} onClick={() => set({ items: [...(d.items || []), ''] })}>+ Add item</button>
          </div>
        );
      case 'table': {
        const rows: string[][] = d.content || [['', '']];
        const cols = rows[0]?.length || 1;
        return (
          <div>
            <input value={d.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (recommended)" style={{ ...box, marginBottom: 6 }} />
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={d.withHeaderRow !== false} onChange={(e) => set({ withHeaderRow: e.target.checked })} /> First row is a header</label>
            <div style={{ overflowX: 'auto', marginTop: 6 }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => (
                        <td key={ci} style={{ border: `1px solid ${BRAND.line}`, padding: 2 }}>
                          <input value={c} onChange={(e) => { const n = rows.map((x) => [...x]); n[ri][ci] = e.target.value; set({ content: n }); }} style={{ ...box, minWidth: 110, fontWeight: ri === 0 && d.withHeaderRow !== false ? 700 : 400 }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <button type="button" style={smallBtn} onClick={() => set({ content: [...rows, new Array(cols).fill('')] })}>+ Row</button>
              <button type="button" style={smallBtn} onClick={() => rows.length > 1 && set({ content: rows.slice(0, -1) })}>− Row</button>
              <button type="button" style={smallBtn} onClick={() => set({ content: rows.map((r) => [...r, '']) })}>+ Column</button>
              <button type="button" style={smallBtn} onClick={() => cols > 1 && set({ content: rows.map((r) => r.slice(0, -1)) })}>− Column</button>
            </div>
            {(rows.length < 2 || cols < 2) && <div style={{ color: BRAND.amber, fontSize: '0.75rem', marginTop: 4 }}>⚠ Consider a list instead of a table with fewer than 2 rows or columns.</div>}
          </div>
        );
      }
      case 'image':
        return (
          <div>
            {d.url ? <img src={d.url} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, display: 'block', marginBottom: 8 }} /> : <div style={{ color: BRAND.muted, fontSize: '0.85rem', marginBottom: 8 }}>No image chosen.</div>}
            <button type="button" style={smallBtn} onClick={async () => { const m = await pickMedia(); if (m) set({ url: m.url, alt: d.alt || m.alt || '', width: m.width, height: m.height, mediaId: m.id }); }}>{d.url ? 'Replace image' : 'Choose / upload image'}</button>
            <label style={{ marginLeft: 12, fontSize: '0.8rem' }}><input type="checkbox" checked={Boolean(d.isDecorative)} onChange={(e) => set({ isDecorative: e.target.checked })} /> Decorative (no alt text)</label>
            {!d.isDecorative && <input value={d.alt || ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Alt text (required): describe the image" style={{ ...box, marginTop: 8, borderColor: d.url && !d.alt ? BRAND.red : '#8c8f94' }} />}
            <input value={d.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)" style={{ ...box, marginTop: 6 }} />
          </div>
        );
      case 'gallery':
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(d.images || []).map((g: any, i: number) => (
                <div key={i} style={{ width: 150 }}>
                  <img src={g.url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 4 }} />
                  <input value={g.alt || ''} onChange={(e) => { const n = [...d.images]; n[i] = { ...g, alt: e.target.value }; set({ images: n }); }} placeholder="Alt text" style={{ ...box, padding: '4px 6px', fontSize: '0.75rem' }} />
                  <button type="button" style={smallBtn} onClick={() => set({ images: d.images.filter((_: any, k: number) => k !== i) })}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" style={{ ...smallBtn, marginTop: 8 }} onClick={async () => { const m = await pickMedia(); if (m) set({ images: [...(d.images || []), { url: m.url, alt: m.alt || '', width: m.width, height: m.height }] }); }}>+ Add image</button>
          </div>
        );
      case 'quote':
        return (
          <div>
            <InlineField value={d.text || ''} onChange={(v) => set({ text: v })} rows={3} placeholder="Quote" />
            <input value={d.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Citation (optional)" style={{ ...box, marginTop: 6 }} />
          </div>
        );
      case 'callout':
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <select value={d.tone || 'info'} onChange={(e) => set({ tone: e.target.value })} style={{ ...box, width: 130 }}><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option></select>
              <input value={d.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Title (optional)" style={box} />
            </div>
            <InlineField value={d.text || ''} onChange={(v) => set({ text: v })} rows={3} placeholder="Callout text" />
          </div>
        );
      case 'key_takeaways':
        return (
          <div>
            <input value={d.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Title" style={{ ...box, marginBottom: 6 }} />
            <textarea rows={4} value={(d.items || []).join('\n')} onChange={(e) => set({ items: e.target.value.split('\n') })} placeholder="One takeaway per line" style={box} />
          </div>
        );
      case 'faq':
        return (
          <div>
            <input value={d.heading || ''} onChange={(e) => set({ heading: e.target.value })} placeholder="Section heading (H2)" style={{ ...box, marginBottom: 8, fontWeight: 700 }} />
            {(d.items || []).map((q: any, i: number) => (
              <div key={i} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <input value={q.question || ''} onChange={(e) => { const n = [...d.items]; n[i] = { ...q, question: e.target.value }; set({ items: n }); }} placeholder={`Question ${i + 1} (5–150 characters)`} style={{ ...box, marginBottom: 6, borderColor: !q.question ? BRAND.red : '#8c8f94' }} />
                <InlineField value={q.answer || ''} onChange={(v) => { const n = [...d.items]; n[i] = { ...q, answer: v }; set({ items: n }); }} rows={3} placeholder="Answer (always visible text)" />
                <button type="button" style={{ ...smallBtn, marginTop: 4 }} onClick={() => set({ items: d.items.filter((_: any, k: number) => k !== i) })}>Remove question</button>
              </div>
            ))}
            <button type="button" style={smallBtn} onClick={() => set({ items: [...(d.items || []), { question: '', answer: '' }] })}>+ Add question</button>
            {new Set((d.items || []).map((q: any) => (q.question || '').trim().toLowerCase())).size < (d.items || []).length && <div style={{ color: BRAND.amber, fontSize: '0.75rem', marginTop: 4 }}>⚠ Duplicate questions.</div>}
          </div>
        );
      case 'steps':
        return (
          <div>
            <input value={d.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Title" style={{ ...box, marginBottom: 8 }} />
            {(d.steps || []).map((st: any, i: number) => (
              <div key={i} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <input value={st.name || ''} onChange={(e) => { const n = [...d.steps]; n[i] = { ...st, name: e.target.value }; set({ steps: n }); }} placeholder={`Step ${i + 1} title (imperative)`} style={{ ...box, marginBottom: 6 }} />
                <InlineField value={st.text || ''} onChange={(v) => { const n = [...d.steps]; n[i] = { ...st, text: v }; set({ steps: n }); }} rows={2} placeholder="What to do" />
                <button type="button" style={{ ...smallBtn, marginTop: 4 }} onClick={() => set({ steps: d.steps.filter((_: any, k: number) => k !== i) })}>Remove step</button>
              </div>
            ))}
            <button type="button" style={smallBtn} onClick={() => set({ steps: [...(d.steps || []), { name: '', text: '' }] })}>+ Add step</button>
          </div>
        );
      case 'toc':
        return <div style={{ color: BRAND.muted, fontSize: '0.85rem' }}>A table of contents of your H2 and H3 headings is generated automatically on the page.</div>;
      case 'code':
        return (
          <div>
            <input value={d.language || ''} onChange={(e) => set({ language: e.target.value.replace(/[^a-z0-9+#-]/gi, '') })} placeholder="Language (optional)" style={{ ...box, width: 200, marginBottom: 6 }} />
            <textarea rows={5} value={d.code || ''} onChange={(e) => set({ code: e.target.value })} style={{ ...box, fontFamily: 'monospace' }} />
          </div>
        );
      case 'video':
        return (
          <div>
            <input value={d.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="YouTube or Vimeo link" style={{ ...box, marginBottom: 6 }} />
            <input value={d.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Video title (shown as the link text)" style={box} />
            {d.url && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(d.url) && <div style={{ color: BRAND.red, fontSize: '0.75rem', marginTop: 4 }}>Only YouTube and Vimeo links are supported.</div>}
          </div>
        );
      case 'divider':
        return <hr style={{ border: 'none', borderTop: `2px solid ${BRAND.line}` }} />;
      case 'button':
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={d.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder="Button text" style={box} />
            <input value={d.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://… or /contact" style={box} />
          </div>
        );
      case 'raw_html':
        return canRawHtml ? (
          <div>
            <div style={{ color: BRAND.amber, fontSize: '0.8rem', marginBottom: 6 }}>Custom HTML is sanitized on save (scripts, iframes, forms and event handlers are removed). Imported WordPress articles live in one of these blocks.</div>
            <textarea rows={16} value={d.html || ''} onChange={(e) => set({ html: e.target.value })} style={{ ...box, fontFamily: 'monospace', fontSize: '0.8rem' }} />
          </div>
        ) : (
          <div style={{ color: BRAND.muted, fontSize: '0.85rem' }}>This block contains custom HTML ({(d.html || '').length.toLocaleString()} characters) and can only be edited by an Admin or SEO Manager. It is preserved as-is.</div>
        );
      default:
        return <div style={{ color: BRAND.muted, fontSize: '0.85rem' }}>Unknown block type &quot;{it.block.type}&quot; is preserved unchanged.</div>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" style={smallBtn} onClick={undo} disabled={history.current.length === 0}>↶ Undo</button>
        <button type="button" style={smallBtn} onClick={redo} disabled={future.current.length === 0}>↷ Redo</button>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: BRAND.muted }}>~{words.toLocaleString()} words · {Math.max(1, Math.ceil(words / 225))} min read · {outline.length} headings</span>
      </div>

      {outline.length > 0 && (
        <details style={{ marginBottom: 10, border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: '6px 10px', background: BRAND.soft }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: BRAND.dark }}>Heading outline{outline.some((o) => o.warnings.length) ? ' ⚠' : ''}</summary>
          {outline.map((o, i) => (
            <div key={i} style={{ paddingLeft: (o.level - 2) * 16, fontSize: '0.8rem', color: o.warnings.length ? BRAND.amber : BRAND.dark }}>
              H{o.level} {o.text || <em>(empty)</em>} {o.warnings.length > 0 && <span title={o.warnings.join(' ')}>⚠</span>}
            </div>
          ))}
        </details>
      )}

      {inserter(0)}
      {items.map((it, idx) => (
        <div key={it.id}>
          <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: BRAND.soft, borderBottom: `1px solid ${BRAND.line}` }}>
              <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: BRAND.teal }}>{LABEL[it.block.type] || it.block.type}</strong>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button type="button" style={smallBtn} onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">↑</button>
                <button type="button" style={smallBtn} onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Move down">↓</button>
                <button type="button" style={smallBtn} onClick={() => duplicate(idx)} aria-label="Duplicate block">⧉</button>
                <button type="button" style={{ ...smallBtn, color: BRAND.red }} onClick={() => remove(it.id)} aria-label="Delete block">🗑</button>
              </span>
            </div>
            <div style={{ padding: 12 }}>{renderBody(it, idx)}</div>
          </div>
          {inserter(idx + 1)}
        </div>
      ))}
      {items.length === 0 && <div style={{ textAlign: 'center', color: BRAND.muted, padding: 24 }}>Start with a paragraph or heading, or paste content from Word / Google Docs.</div>}
    </div>
  );
}
