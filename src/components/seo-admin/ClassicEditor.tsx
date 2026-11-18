'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PickedMedia } from './BlockEditor';

/**
 * WordPress-style editor: "Add Media" button, Visual / Code tabs and the familiar toolbar
 * (format dropdown, bold, italic, lists, quote, alignment, link, more, fullscreen).
 * Content is plain HTML; the server sanitizes it on save.
 */

const FORMATS: Array<{ tag: string; label: string; size: string; weight: number; key: string }> = [
  { tag: 'p', label: 'Paragraph', size: '0.95rem', weight: 400, key: '7' },
  { tag: 'h1', label: 'Heading 1', size: '1.9rem', weight: 700, key: '1' },
  { tag: 'h2', label: 'Heading 2', size: '1.6rem', weight: 700, key: '2' },
  { tag: 'h3', label: 'Heading 3', size: '1.35rem', weight: 700, key: '3' },
  { tag: 'h4', label: 'Heading 4', size: '1.15rem', weight: 700, key: '4' },
  { tag: 'h5', label: 'Heading 5', size: '1rem', weight: 700, key: '5' },
  { tag: 'h6', label: 'Heading 6', size: '0.9rem', weight: 700, key: '6' },
  { tag: 'pre', label: 'Preformatted', size: '0.9rem', weight: 400, key: '' },
];

const WP = { bg: '#f0f0f1', border: '#c3c4c7', blue: '#2271b1', text: '#1d2327', toolbar: '#f6f7f7' };

const tbBtn = (active = false): React.CSSProperties => ({
  width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: active ? `1px solid ${WP.border}` : '1px solid transparent', borderRadius: 3,
  background: active ? '#e0e0e0' : 'transparent', cursor: 'pointer', color: '#3c434a', fontSize: 15, padding: 0,
});

function Btn({ title, onClick, children, active }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} style={tbBtn(active)} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

const Sep = () => <span style={{ width: 1, height: 20, background: WP.border, margin: '0 4px' }} />;

export default function ClassicEditor({
  value, onChange, resetKey, pickMedia, notify,
}: {
  value: string;
  onChange: (html: string) => void;
  resetKey: string | number;
  pickMedia: () => Promise<PickedMedia | null>;
  notify: (m: string) => void;
}) {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [fullscreen, setFullscreen] = useState(false);
  const [format, setFormat] = useState('p');
  const [menu, setMenu] = useState(false);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [linkBox, setLinkBox] = useState<null | { url: string; blank: boolean }>(null);
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const last = useRef(value);

  // Load external changes (revision restore, autosave restore, mode switch) into the visual surface.
  useEffect(() => {
    if (ref.current && mode === 'visual') ref.current.innerHTML = value;
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, mode]);

  const emit = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    last.current = html;
    onChange(html === '<br>' ? '' : html);
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
    refreshState();
  };

  const refreshState = () => {
    try {
      setBold(document.queryCommandState('bold'));
      setItalic(document.queryCommandState('italic'));
      const block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '');
      setFormat(FORMATS.some((f) => f.tag === block) ? block : 'p');
    } catch { /* not supported */ }
  };

  const applyFormat = (tag: string) => { setMenu(false); exec('formatBlock', tag === 'p' ? 'p' : tag); };

  const rememberSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && saved.current) { sel.removeAllRanges(); sel.addRange(saved.current); }
  };

  const insertLink = () => {
    if (!linkBox) return;
    const url = linkBox.url.trim();
    if (!url || /^\s*(javascript|data|vbscript):/i.test(url)) { notify('Enter a valid link (https://…, /path, mailto: or tel:).'); return; }
    ref.current?.focus();
    restoreSelection();
    exec('createLink', url);
    if (linkBox.blank) ref.current?.querySelectorAll(`a[href="${CSS.escape(url)}"]`).forEach((a) => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); });
    emit();
    setLinkBox(null);
  };

  const addMedia = async () => {
    rememberSelection();
    const m = await pickMedia();
    if (!m) return;
    const alt = (m.alt || '').replace(/"/g, '&quot;');
    const img = `<img src="${m.url}" alt="${alt}"${m.width ? ` width="${m.width}"` : ''}${m.height ? ` height="${m.height}"` : ''} loading="lazy" />`;
    if (mode === 'code') {
      onChange(`${value}\n<figure>${img}</figure>`);
      return;
    }
    ref.current?.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, `<figure>${img}</figure><p><br></p>`);
    emit();
    if (!m.alt) notify('This image has no alt text. Add it in the media library.');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); rememberSelection(); setLinkBox({ url: '', blank: false }); }
    if (e.shiftKey && e.altKey) {
      const f = FORMATS.find((x) => x.key && x.key === e.key.replace('&', '7'));
      if (f) { e.preventDefault(); applyFormat(f.tag); }
    }
  };

  const wrap: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 900, background: '#fff', display: 'flex', flexDirection: 'column', padding: 16, overflow: 'auto' }
    : {};

  const current = FORMATS.find((f) => f.tag === format) || FORMATS[0];

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={addMedia}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1px solid ${WP.blue}`, borderRadius: 3, background: '#f6f7f7', color: WP.blue, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}
        >
          <span aria-hidden>🖼</span> Add Media
        </button>
        <div style={{ display: 'flex' }}>
          {(['visual', 'code'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { if (mode === 'visual') emit(); setMode(m); }}
              style={{ padding: '6px 14px', border: `1px solid ${WP.border}`, borderBottom: mode === m ? '1px solid #fff' : `1px solid ${WP.border}`, background: mode === m ? '#fff' : '#ebebeb', color: mode === m ? WP.text : '#50575e', fontSize: 13, cursor: 'pointer', marginLeft: -1, marginBottom: -1, position: 'relative', zIndex: mode === m ? 1 : 0 }}
            >
              {m === 'visual' ? 'Visual' : 'Code'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: `1px solid ${WP.border}`, background: '#fff', display: 'flex', flexDirection: 'column', flex: fullscreen ? 1 : undefined, minHeight: 0 }}>
        {mode === 'visual' && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '4px 6px', background: WP.toolbar, borderBottom: `1px solid ${WP.border}`, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); rememberSelection(); }}
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={menu}
                style={{ width: 150, height: 30, textAlign: 'left', padding: '0 8px', border: `1px solid ${WP.border}`, background: '#fff', borderRadius: 3, fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                {current.label} <span aria-hidden style={{ fontSize: 9 }}>▼</span>
              </button>
              {menu && (
                <ul role="listbox" style={{ position: 'absolute', top: 32, left: 0, zIndex: 20, margin: 0, padding: '4px 0', listStyle: 'none', background: '#fff', border: `1px solid ${WP.border}`, boxShadow: '0 3px 8px rgba(0,0,0,.2)', width: 300 }}>
                  {FORMATS.map((f) => (
                    <li key={f.tag} role="option" aria-selected={f.tag === format}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { restoreSelection(); applyFormat(f.tag); }}
                        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', border: 'none', background: f.tag === format ? '#f0f0f1' : '#fff', cursor: 'pointer', fontFamily: 'Georgia, serif', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: f.size, fontWeight: f.weight, fontFamily: f.tag === 'pre' ? 'monospace' : 'Georgia, serif', color: '#50575e' }}>{f.label}</span>
                        {f.key && <span style={{ fontSize: 11, color: '#8c8f94', fontFamily: 'system-ui, sans-serif' }}>(Shift+Alt+{f.key})</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Btn title="Bold (Ctrl+B)" active={bold} onClick={() => exec('bold')}><b>B</b></Btn>
            <Btn title="Italic (Ctrl+I)" active={italic} onClick={() => exec('italic')}><i style={{ fontFamily: 'serif' }}>I</i></Btn>
            <Btn title="Underline (Ctrl+U)" onClick={() => exec('underline')}><u>U</u></Btn>
            <Btn title="Strikethrough" onClick={() => exec('strikeThrough')}><s>S</s></Btn>
            <Sep />
            <Btn title="Bulleted list" onClick={() => exec('insertUnorderedList')}>≡•</Btn>
            <Btn title="Numbered list" onClick={() => exec('insertOrderedList')}>1.</Btn>
            <Btn title="Blockquote" onClick={() => exec('formatBlock', 'blockquote')}>❝</Btn>
            <Sep />
            <Btn title="Align left" onClick={() => exec('justifyLeft')}>⯇</Btn>
            <Btn title="Align center" onClick={() => exec('justifyCenter')}>≣</Btn>
            <Btn title="Align right" onClick={() => exec('justifyRight')}>⯈</Btn>
            <Sep />
            <Btn title="Insert/edit link (Ctrl+K)" onClick={() => { rememberSelection(); setLinkBox({ url: '', blank: false }); }}>🔗</Btn>
            <Btn title="Remove link" onClick={() => exec('unlink')}>⛓</Btn>
            <Btn title="Insert horizontal line" onClick={() => exec('insertHorizontalRule')}>―</Btn>
            <Btn title="Clear formatting" onClick={() => exec('removeFormat')}>Tx</Btn>
            <Btn title="Undo (Ctrl+Z)" onClick={() => exec('undo')}>↶</Btn>
            <Btn title="Redo (Ctrl+Y)" onClick={() => exec('redo')}>↷</Btn>
            <span style={{ marginLeft: 'auto' }}>
              <Btn title={fullscreen ? 'Exit fullscreen' : 'Distraction-free writing mode'} onClick={() => setFullscreen((v) => !v)}>{fullscreen ? '⤡' : '⤢'}</Btn>
            </span>
          </div>
        )}

        {linkBox && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 8, background: '#fff', borderBottom: `1px solid ${WP.border}` }}>
            <input autoFocus value={linkBox.url} onChange={(e) => setLinkBox({ ...linkBox, url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertLink(); } if (e.key === 'Escape') setLinkBox(null); }} placeholder="Paste URL or type to search" style={{ flex: '1 1 260px', padding: '6px 8px', border: `1px solid ${WP.border}`, borderRadius: 3 }} />
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={linkBox.blank} onChange={(e) => setLinkBox({ ...linkBox, blank: e.target.checked })} /> Open in new tab</label>
            <button type="button" onClick={insertLink} style={{ padding: '5px 12px', background: WP.blue, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>Add Link</button>
            <button type="button" onClick={() => setLinkBox(null)} style={{ padding: '5px 12px', border: `1px solid ${WP.border}`, background: '#f6f7f7', borderRadius: 3, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}

        {mode === 'visual' ? (
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Post content"
            onInput={emit}
            onKeyUp={refreshState}
            onMouseUp={() => { refreshState(); rememberSelection(); }}
            onBlur={rememberSelection}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const html = e.clipboardData.getData('text/html');
              if (html) {
                e.preventDefault();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('script,style,meta,link,iframe,object,embed,form').forEach((n) => n.remove());
                doc.querySelectorAll('*').forEach((n) => { n.removeAttribute('style'); n.removeAttribute('class'); n.removeAttribute('id'); Array.from(n.attributes).forEach((a) => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); }); });
                document.execCommand('insertHTML', false, doc.body.innerHTML);
                emit();
              }
            }}
            className="wp-visual-surface"
            style={{ minHeight: fullscreen ? 0 : 420, flex: fullscreen ? 1 : undefined, padding: '16px 24px', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 17, lineHeight: 1.9, color: '#333', outline: 'none', overflow: 'auto' }}
          />
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            aria-label="Post content (HTML)"
            style={{ minHeight: fullscreen ? 0 : 420, flex: fullscreen ? 1 : undefined, padding: 16, border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, lineHeight: 1.6, color: '#1d2327', width: '100%', boxSizing: 'border-box' }}
          />
        )}
      </div>
      <style>{`
        .wp-visual-surface h1{font-size:2rem;margin:0 0 .5em}
        .wp-visual-surface h2{font-size:1.65rem;margin:1em 0 .5em}
        .wp-visual-surface h3{font-size:1.35rem;margin:1em 0 .5em}
        .wp-visual-surface h4,.wp-visual-surface h5,.wp-visual-surface h6{margin:1em 0 .5em}
        .wp-visual-surface p{margin:0 0 1.1em}
        .wp-visual-surface img{max-width:100%;height:auto}
        .wp-visual-surface blockquote{border-left:4px solid #0b666a;margin:1em 0;padding:.2em 1em;color:#444}
        .wp-visual-surface pre{background:#f6f7f7;padding:12px;overflow:auto;font-family:monospace}
        .wp-visual-surface table{border-collapse:collapse}
        .wp-visual-surface td,.wp-visual-surface th{border:1px solid #c3c4c7;padding:6px 10px}
        .wp-visual-surface a{color:#2271b1}
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: WP.toolbar, border: `1px solid ${WP.border}`, borderTop: 'none', fontSize: 12, color: '#50575e' }}>
        <span>Word count: {(value.replace(/<[^>]*>/g, ' ').match(/\S+/g) || []).length}</span>
        <span>Use Shift+Alt+1–6 for headings. Heading 1 is converted to Heading 2 on save (the post title is the only H1).</span>
      </div>
    </div>
  );
}
