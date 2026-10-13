'use client';
import { useState } from 'react';
import Link from 'next/link';
import { csolData, searchOccupations } from '@/features/immigration-tools/csol';
import { disclaimer, sources } from '@/features/immigration-tools/catalog';

export default function OccupationSearch() {
  const [query, setQuery] = useState('');
  const [stream, setStream] = useState<'sid' | 'ens'>('sid');
  const [page, setPage] = useState(0);
  const matches = searchOccupations(query);
  const pageSize = 20;
  return <div className="feature-workspace">
    <p className="feature-note">{disclaimer} This list applies to 482 Core Skills and 186 Direct Entry. It is not the occupation list for 189, 190, 491 or 494, and does not establish eligibility for other streams.</p>
    <div className="feature-fields"><label htmlFor="occupation-query">Occupation or ANZSCO code<input id="occupation-query" type="search" value={query} autoComplete="off" onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="For example, engineer or 261313" /></label><label htmlFor="occupation-stream">Show requirements for<select id="occupation-stream" value={stream} onChange={e => setStream(e.target.value as 'sid' | 'ens')}><option value="sid">482 Core Skills</option><option value="ens">186 Direct Entry</option></select></label></div>
    <h2>Matching occupations</h2><p className="tool-sources" role="status">{matches.length} matching occupations · official snapshot checked {csolData.checked}</p>
    {!matches.length && <p className="feature-note">No matching title or code in this snapshot. Try a broader term or verify the current official list. An unsuccessful search is not a visa eligibility decision.</p>}
    <div className="occupation-results">{matches.slice(page * pageSize, (page + 1) * pageSize).map(row => {
      const ids = stream === 'sid' ? row.sidCaveats : row.ensCaveats;
      const caveats = csolData.caveats[stream] as Record<string, string>;
      return <article key={row.code} className="tool-card"><h3>{row.name}</h3><p><strong>ANZSCO {row.code}</strong> · {stream === 'sid' ? '482 Core Skills' : '186 Direct Entry'}</p>{stream === 'ens' && <p>Relevant assessing authority: <strong>{row.authority}</strong>. Refer to section 9 of the instrument for full authority names.</p>}{ids.length ? <details><summary>Occupation exclusions / caveats ({ids.length})</summary><p>The occupation does not apply where a listed exclusion is met. Check the full instrument and any exceptions.</p><ul>{ids.map(id => <li key={id}><strong>Circumstance {id}: </strong>{caveats[id]}</li>)}</ul></details> : <p>No occupation-specific caveat is listed in this snapshot. Salary, sponsorship, skills and all other requirements still apply.</p>}</article>;
    })}</div>
    {matches.length > pageSize && <div className="feature-actions"><button className="feature-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(matches.length / pageSize)}</span><button className="feature-secondary" disabled={(page + 1) * pageSize >= matches.length} onClick={() => setPage(p => p + 1)}>Next</button></div>}
    <section className="tool-sources" aria-labelledby="tool-sources-title"><h2 id="tool-sources-title">Official occupation data and updates</h2><ul><li><a href={csolData.sources.sid}>482 occupation instrument — compilation 7 November 2025</a></li><li><a href={csolData.sources.ens}>186 occupation and assessing authority instrument — compilation 28 March 2026</a></li><li><a href={sources.occupations}>Home Affairs: current occupation lists and caveats</a></li></ul><p>456 entries transcribed from each official instrument. Check for amendments before relying on an entry. A job title match does not establish that your duties, skills or position meet the legal definition.</p><Link href="/tools">Explore all migration tools</Link></section>
  </div>;
}
