'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const link: React.CSSProperties = { border: 'none', background: 'none', padding: 0, color: '#3858e9', cursor: 'pointer', fontSize: 13, textDecoration: 'none' };

/** Row actions shown under a post title on hover: Edit | Trash | View (or Restore | Delete Permanently in Trash). */
export default function PostRowActions({ id, title, status, viewHref }: { id: string; title: string; status: string; viewHref: string }) {
  const router = useRouter();
  const [err, setErr] = useState('');

  const call = async (url: string, method: string, body?: any) => {
    setErr('');
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.message || 'Action failed.');
      return false;
    }
    router.refresh();
    return true;
  };

  return (
    <div className="wp-rowactions">
      {status === 'trashed' ? (
        <>
          <button type="button" style={link} onClick={() => call(`/api/v1/posts/${id}/restore`, 'POST')}>Restore</button> |{' '}
          <button type="button" style={{ ...link, color: '#b32d2e' }} onClick={() => { if (confirm(`Delete “${title}” permanently? This cannot be undone.`)) call(`/api/v1/posts/${id}`, 'DELETE', { confirm: 'DELETE' }); }}>Delete Permanently</button>
        </>
      ) : (
        <>
          <Link href={`/seo-admin/blog/${id}`} style={link}>Edit</Link> |{' '}
          <button type="button" style={{ ...link, color: '#b32d2e' }} onClick={() => { if (confirm(`Move “${title}” to the Trash? Its address will return 410 Gone.`)) call(`/api/v1/posts/${id}/trash`, 'POST', { behavior: '410' }); }}>Trash</button> |{' '}
          {status === 'published'
            ? <Link href={viewHref} target="_blank" style={link}>View</Link>
            : <Link href={`/preview/${id}`} target="_blank" style={link}>Preview</Link>}
        </>
      )}
      {err && <span style={{ color: '#b32d2e', marginLeft: 8 }}>{err}</span>}
    </div>
  );
}
