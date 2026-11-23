'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { runContentAnalysis, calculateFleschScore, calculatePixelWidth } from '@/lib/seo-system/analysis';
import { renderBlocksToHtml } from '@/lib/seo-system/sanitizer';
import IndexingPanel from './IndexingPanel';
import BlockEditor, { type Block, type PickedMedia } from './BlockEditor';
import MediaPicker from './MediaPicker';
import ClassicEditor from './ClassicEditor';
import { htmlToBlocks } from './paste-clean';
import { WorkflowActions, RevisionsPanel, LinksPanel, SchemaPanel, ReferencesPanel, MoveToTrash } from './PostWorkflow';

interface PostEditorProps {
  initialPost?: any;
  categories: any[];
  authors: any[];
  tags?: any[];
  currentUser: any;
}

export default function PostEditor({
  initialPost,
  categories,
  authors,
  tags = [],
  currentUser,
}: PostEditorProps) {
  const router = useRouter();
  const postId = initialPost?.id;
  const isNew = !postId;

  // Basic post fields
  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [status, setStatus] = useState(initialPost?.status || 'draft');
  const initialBlocks: Block[] = Array.isArray(initialPost?.body_json?.blocks) ? initialPost.body_json.blocks : [];
  const startsClassic = initialBlocks.length === 0 || (initialBlocks.length === 1 && initialBlocks[0].type === 'raw_html');
  const [editorMode, setEditorMode] = useState<'classic' | 'blocks'>(startsClassic ? 'classic' : 'blocks');
  const [blocks, setBlocks] = useState<Block[]>(startsClassic ? [] : initialBlocks);
  const [classicHtml, setClassicHtml] = useState<string>(startsClassic ? (initialBlocks[0]?.data?.html || '') : '');
  const [slugEditing, setSlugEditing] = useState(false);
  const setBody = (bs: Block[]) => {
    if (bs.length === 0 || (bs.length === 1 && bs[0].type === 'raw_html')) { setEditorMode('classic'); setClassicHtml(bs[0]?.data?.html || ''); setBlocks([]); }
    else { setEditorMode('blocks'); setBlocks(bs); }
    setEditorKey((k) => k + 1);
  };
  const switchMode = () => {
    if (editorMode === 'classic') {
      if (classicHtml.trim() && !confirm('Switch to the block editor? Your HTML is converted into blocks; unsupported markup (such as custom styling) may be simplified.')) return;
      setBlocks(classicHtml.trim() ? htmlToBlocks(classicHtml).blocks : []);
      setEditorMode('blocks');
    } else {
      if (!confirm('Switch to the classic (Visual / Code) editor? Blocks are converted to plain HTML.')) return;
      setClassicHtml(renderBlocksToHtml(blocks).html.replace('<!-- TOC_PLACEHOLDER -->', ''));
      setEditorMode('classic');
    }
    setEditorKey((k) => k + 1);
  };
  const [editorKey, setEditorKey] = useState(0);
  const [mediaPicker, setMediaPicker] = useState<null | ((m: PickedMedia | null) => void)>(null);
  const pickMedia = () => new Promise<PickedMedia | null>((resolve) => setMediaPicker(() => resolve));
  const roles: string[] = currentUser?.roles || [];
  const canRawHtml = roles.some((r) => ['super_admin', 'admin', 'seo_manager'].includes(r));

  const [excerpt, setExcerpt] = useState(initialPost?.excerpt || '');
  const [featuredMediaId, setFeaturedMediaId] = useState(initialPost?.featured_media_id || '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialPost?.featured_media_url || '');
  const [featuredAlt, setFeaturedAlt] = useState(initialPost?.featured_alt_override || initialPost?.featured_media_alt || '');
  const [featuredCaption, setFeaturedCaption] = useState(initialPost?.featured_caption_override || '');
  const [primaryCategoryId, setPrimaryCategoryId] = useState(initialPost?.primary_category_id || categories[0]?.id || '');
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>(() => {
    if (initialPost?.authors?.length) return initialPost.authors.map((a: any) => a.id);
    if (authors.length) return [authors[0].id];
    return [];
  });

  const [tagIds, setTagIds] = useState<string[]>(() => (initialPost?.tags || []).map((t: any) => t.id));
  const [reviewedBy, setReviewedBy] = useState<string>(initialPost?.geo_aeo?.reviewed_by || '');
  const [lockedBy, setLockedBy] = useState<null | { name: string; canTakeOver: boolean }>(null);

  // SEO fields (Section 5.2)
  const [focusKeyword, setFocusKeyword] = useState(initialPost?.seo?.focus_keyword || '');
  const [additionalKeywords, setAdditionalKeywords] = useState<string>(() => {
    const kws = initialPost?.seo?.additional_keywords;
    return Array.isArray(kws) ? kws.join(', ') : '';
  });
  const [seoTitle, setSeoTitle] = useState(initialPost?.seo?.seo_title_raw || '');
  const [metaDescription, setMetaDescription] = useState(initialPost?.seo?.meta_description_raw || '');
  const [canonicalUrl, setCanonicalUrl] = useState(initialPost?.seo?.canonical_url || '');
  const [robotsIndex, setRobotsIndex] = useState(initialPost?.seo?.robots_index !== false);
  const [robotsFollow, setRobotsFollow] = useState(initialPost?.seo?.robots_follow !== false);
  const [sitemapInclude, setSitemapInclude] = useState(initialPost?.seo?.sitemap_include !== false);
  const [breadcrumbTitle, setBreadcrumbTitle] = useState(initialPost?.seo?.breadcrumb_title || '');
  const [customH1, setCustomH1] = useState(initialPost?.seo?.custom_h1 || '');
  const [isCornerstone, setIsCornerstone] = useState(Boolean(initialPost?.seo?.is_cornerstone));

  // Social fields
  const [useSeoValues, setUseSeoValues] = useState(initialPost?.social?.use_seo_values !== false);
  const [ogTitle, setOgTitle] = useState(initialPost?.social?.og_title || '');
  const [ogDescription, setOgDescription] = useState(initialPost?.social?.og_description || '');
  const [twitterCard, setTwitterCard] = useState(initialPost?.social?.twitter_card || 'summary_large_image');
  const [twitterTitle, setTwitterTitle] = useState(initialPost?.social?.twitter_title || '');
  const [twitterDescription, setTwitterDescription] = useState(initialPost?.social?.twitter_description || '');

  // Schema fields
  const [articleType, setArticleType] = useState(initialPost?.schema?.article_type || 'BlogPosting');
  const [faqEnabled, setFaqEnabled] = useState(Boolean(initialPost?.schema?.faq_enabled));
  const [howtoEnabled, setHowtoEnabled] = useState(Boolean(initialPost?.schema?.howto_enabled));
  const [customJsonLd, setCustomJsonLd] = useState(initialPost?.schema?.custom_jsonld ? JSON.stringify(initialPost.schema.custom_jsonld, null, 2) : '');

  // GEO & AEO fields
  const [primaryQuestion, setPrimaryQuestion] = useState(initialPost?.geo_aeo?.primary_question || '');
  const [answerSummary, setAnswerSummary] = useState(initialPost?.geo_aeo?.answer_summary || '');
  const [primaryEntityName, setPrimaryEntityName] = useState(initialPost?.geo_aeo?.primary_entity?.name || '');
  const [primaryEntityUrl, setPrimaryEntityUrl] = useState(initialPost?.geo_aeo?.primary_entity?.sameAs || '');

  // References list
  const [references, setReferences] = useState<any[]>((initialPost?.references || []).map((r: any) => ({ title: r.title, url: r.url, publisher: r.publisher || '', publishedDate: r.publishedDate || r.published_date || '', note: r.note })));

  // Editor states
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'social' | 'schema' | 'geo' | 'aeo' | 'indexing'>('general');
  const [serpPreviewDevice, setSerpPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [prepublishResult, setPrepublishResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [minorUpdate, setMinorUpdate] = useState(false);
  const [tagList, setTagList] = useState<any[]>(tags);
  const [catList, setCatList] = useState<any[]>(categories);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => {
    const ids = (initialPost?.categories || []).map((c: any) => c.id);
    if (ids.length) return ids;
    const first = initialPost?.primary_category_id || categories[0]?.id;
    return first ? [first] : [];
  });
  const [catTab, setCatTab] = useState<'all' | 'used'>('all');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showPopularTags, setShowPopularTags] = useState(false);
  const [kwInput, setKwInput] = useState('');
  const [snippetEdit, setSnippetEdit] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [revCount, setRevCount] = useState<number | null>(null);
  useEffect(() => {
    if (!postId) return;
    fetch('/api/v1/posts/' + postId + '/revisions').then((r) => r.json()).then((d) => setRevCount(Array.isArray(d) ? d.length : null)).catch(() => undefined);
  }, [postId]);

  // Auto-slug generator on new post title entry
  useEffect(() => {
    if (isNew && !slug && title) {
      setSlug(title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').substring(0, 100));
    }
  }, [title, isNew, slug]);

  const currentBlocks: Block[] = editorMode === 'classic' ? (classicHtml.trim() ? [{ type: 'raw_html', data: { html: classicHtml } }] : []) : blocks;

  const { html: renderedHtml, wordCount, readingTimeMin, headings } = useMemo(() => {
    return renderBlocksToHtml(currentBlocks);
  }, [currentBlocks]);

  // Live SEO, Readability, Technical, GEO and AEO calculation
  const effectiveTitle = seoTitle || `${title || 'Post Title'} - Migration Factor`;
  const effectiveDesc = metaDescription || excerpt || '';

  const liveAnalysis = useMemo(() => {
    return runContentAnalysis({
      title,
      customH1: customH1 || title,
      seoTitle: effectiveTitle,
      metaDescription: effectiveDesc,
      slug,
      bodyHtml: renderedHtml,
      focusKeyword,
      additionalKeywords: additionalKeywords.split(',').map(k => k.trim()).filter(Boolean),
      canonicalUrl,
      robotsIndex,
      robotsFollow,
      sitemapInclude,
      hasFeaturedImage: Boolean(featuredImageUrl || featuredMediaId),
      featuredImageAlt: featuredAlt,
      categoryAssigned: Boolean(primaryCategoryId),
      authorAssigned: selectedAuthorIds.length > 0,
      primaryQuestion,
      answerSummary,
      references,
    });
  }, [
    title, customH1, effectiveTitle, effectiveDesc, slug, renderedHtml,
    focusKeyword, additionalKeywords, canonicalUrl, robotsIndex, robotsFollow,
    sitemapInclude, featuredImageUrl, featuredMediaId, featuredAlt,
    primaryCategoryId, selectedAuthorIds, primaryQuestion, answerSummary, references
  ]);

  // Pixel and character counters for SERP
  const titleCharCount = seoTitle.length;
  const titlePixelWidth = useMemo(() => calculatePixelWidth(effectiveTitle), [effectiveTitle]);
  const descCharCount = metaDescription.length;

  // Handle Save Draft / Update
  const buildPayload = () => ({
      title,
      slug,
      bodyJson: { blocks: currentBlocks },
      excerpt,
      featuredMediaId: featuredMediaId || null,
      featuredAltOverride: featuredAlt || null,
      featuredCaptionOverride: featuredCaption || null,
      primaryCategoryId: primaryCategoryId || null,
      authorIds: selectedAuthorIds,
      tagIds,
      categoryIds,
      reviewedBy: reviewedBy || null,
      focusKeyword: focusKeyword || null,
      additionalKeywords: additionalKeywords.split(',').map(k => k.trim()).filter(Boolean),
      seoTitleRaw: seoTitle || null,
      metaDescriptionRaw: metaDescription || null,
      canonicalUrl: canonicalUrl || null,
      robotsIndex,
      robotsFollow,
      breadcrumbTitle: breadcrumbTitle || null,
      customH1: customH1 || null,
      sitemapInclude,
      isCornerstone,
      useSeoValues,
      ogTitle: ogTitle || null,
      ogDescription: ogDescription || null,
      twitterCard,
      twitterTitle: twitterTitle || null,
      twitterDescription: twitterDescription || null,
      articleType,
      faqEnabled,
      howtoEnabled,
      primaryQuestion: primaryQuestion || null,
      answerSummary: answerSummary || null,
      primaryEntity: primaryEntityName ? { name: primaryEntityName, sameAs: primaryEntityUrl } : null,
      references,
      minor_update: minorUpdate,
  });

  // Track unsaved changes, autosave drafts and offer to restore one (FR-BLG-002).
  const [version, setVersion] = useState<number | undefined>(initialPost?.version);
  const [conflict, setConflict] = useState<null | number>(null);
  const [restoreOffer, setRestoreOffer] = useState<any>(null);
  const payloadKey = JSON.stringify({ ...buildPayload(), minor_update: undefined });
  const savedKey = useRef(payloadKey);
  const dirty = payloadKey !== savedKey.current;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const latestKey = useRef(payloadKey);
  latestKey.current = payloadKey;
  useEffect(() => {
    if (isNew) return;
    const t = setInterval(async () => {
      if (latestKey.current === savedKey.current) return;
      try {
        await fetch(`/api/v1/posts/${postId}/autosave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: latestKey.current });
        setSaveStatus('Autosaved at ' + new Date().toLocaleTimeString());
      } catch { /* retry next tick */ }
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, isNew]);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/v1/posts/${postId}/autosave`).then((r) => r.json()).then((d) => {
      if (d?.snapshot && JSON.stringify({ ...d.snapshot, minor_update: undefined }) !== savedKey.current) setRestoreOffer(d);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const applyPayload = (p: any) => {
    if (p.title !== undefined) setTitle(p.title || '');
    if (p.slug !== undefined && isNew) setSlug(p.slug || '');
    if (p.excerpt !== undefined) setExcerpt(p.excerpt || '');
    if (p.bodyJson?.blocks) setBody(p.bodyJson.blocks);
    if (p.featuredMediaId !== undefined) setFeaturedMediaId(p.featuredMediaId || '');
    if (p.primaryCategoryId !== undefined) setPrimaryCategoryId(p.primaryCategoryId || '');
    if (Array.isArray(p.authorIds)) setSelectedAuthorIds(p.authorIds);
    if (Array.isArray(p.tagIds)) setTagIds(p.tagIds);
    if (p.focusKeyword !== undefined) setFocusKeyword(p.focusKeyword || '');
    if (Array.isArray(p.additionalKeywords)) setAdditionalKeywords(p.additionalKeywords.join(', '));
    if (p.seoTitleRaw !== undefined) setSeoTitle(p.seoTitleRaw || '');
    if (p.metaDescriptionRaw !== undefined) setMetaDescription(p.metaDescriptionRaw || '');
    if (p.canonicalUrl !== undefined) setCanonicalUrl(p.canonicalUrl || '');
    if (p.robotsIndex !== undefined) setRobotsIndex(p.robotsIndex !== false);
    if (p.robotsFollow !== undefined) setRobotsFollow(p.robotsFollow !== false);
    if (p.breadcrumbTitle !== undefined) setBreadcrumbTitle(p.breadcrumbTitle || '');
    if (p.customH1 !== undefined) setCustomH1(p.customH1 || '');
    if (p.sitemapInclude !== undefined) setSitemapInclude(p.sitemapInclude !== false);
    if (p.ogTitle !== undefined) setOgTitle(p.ogTitle || '');
    if (p.ogDescription !== undefined) setOgDescription(p.ogDescription || '');
    if (p.twitterTitle !== undefined) setTwitterTitle(p.twitterTitle || '');
    if (p.twitterDescription !== undefined) setTwitterDescription(p.twitterDescription || '');
    if (p.articleType) setArticleType(p.articleType);
    if (p.faqEnabled !== undefined) setFaqEnabled(Boolean(p.faqEnabled));
    if (p.howtoEnabled !== undefined) setHowtoEnabled(Boolean(p.howtoEnabled));
    if (p.primaryQuestion !== undefined) setPrimaryQuestion(p.primaryQuestion || '');
    if (p.answerSummary !== undefined) setAnswerSummary(p.answerSummary || '');
    if (p.primaryEntity !== undefined) { setPrimaryEntityName(p.primaryEntity?.name || ''); setPrimaryEntityUrl(p.primaryEntity?.sameAs || ''); }
    if (Array.isArray(p.references)) setReferences(p.references);
  };

  const acquireLock = async (takeover = false) => {
    try {
      const res = await fetch('/api/v1/posts/' + postId + '/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ takeover }) });
      const d = await res.json();
      setLockedBy(d.locked ? { name: d.lockedBy, canTakeOver: Boolean(d.canTakeOver) } : null);
    } catch { /* offline: do not block editing */ }
  };
  useEffect(() => {
    if (isNew) return;
    acquireLock();
    const t = setInterval(() => acquireLock(), 45000);
    const release = () => { try { fetch('/api/v1/posts/' + postId + '/lock', { method: 'DELETE', keepalive: true }); } catch { /* ignore */ } };
    window.addEventListener('pagehide', release);
    return () => { clearInterval(t); window.removeEventListener('pagehide', release); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleSaveDraft = async (force = false, thenPublish = false): Promise<boolean> => {
    if (lockedBy) { setStatusMessage('Saving is disabled: ' + lockedBy.name + ' is editing this post.'); return false; }
    setSaving(true);
    setStatusMessage('');
    const payload: any = buildPayload();
    if (!force && version !== undefined) payload.version = version;
    let ok = false;
    try {
      if (isNew) {
        const res = await fetch('/api/v1/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          savedKey.current = payloadKey;
          if (thenPublish) {
            try { await fetch(`/api/v1/posts/${data.post.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledge_warnings: false }) }); } catch { /* the editor shows Publish again */ }
          }
          router.push(`/seo-admin/blog/${data.post.id}`);
        } else {
          setStatusMessage(`Error: ${data.message || 'Failed to save'}`);
        }
      } else {
        const res = await fetch(`/api/v1/posts/${postId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setSaveStatus('Saved at ' + new Date().toLocaleTimeString());
          setStatusMessage('Post saved successfully.');
          if (typeof data.version === 'number') setVersion(data.version);
          savedKey.current = payloadKey;
          ok = true;
        } else if (res.status === 409) {
          setConflict(data.current_version ?? null);
        } else {
          setStatusMessage(`Error: ${data.message || 'Failed to update'}`);
        }
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
    return ok;
  };

  // Open Publish Modal and Run Pre-Publish Checks
  const handleInitiatePublish = async () => {
    setStatusMessage('');
    try {
      const res = await fetch(`/api/v1/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge_warnings: false }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage('Published successfully!');
        setStatus('published');
        router.refresh();
      } else if (res.status === 409 || res.status === 422) {
        setPrepublishResult(data);
        setPublishModalOpen(true);
      } else {
        setStatusMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // Confirm publish with warnings acknowledged
  const handleConfirmPublishAnyway = async () => {
    try {
      const res = await fetch(`/api/v1/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge_warnings: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setPublishModalOpen(false);
        setStatus('published');
        setStatusMessage('Published with acknowledged warnings.');
        router.refresh();
      } else {
        alert(data.message || 'Publishing failed.');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const chkIcon = (st: string) => {
    const c = st === 'passed' ? '#00a32a' : st === 'needs_improvement' ? '#dba617' : '#d63638';
    const g = st === 'passed' ? '✓' : st === 'needs_improvement' ? '✓' : '✕';
    return st === 'needs_improvement'
      ? <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${c}`, color: c, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{g}</span>
      : <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', background: c, color: '#fff', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{g}</span>;
  };
  const checkGroup = (label: string, checks: any[]) => {
    const real = checks.filter((c) => c.status !== 'not_applicable');
    const errs = real.filter((c) => c.status === 'failed').length;
    return (
      <details open={label === 'Basic SEO'} style={{ borderTop: '1px solid #dcdcde' }}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: '#1d2327' }}>
          {label}
          <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 10px', borderRadius: 12, background: errs ? '#f4a7a7' : '#7ad28a', color: errs ? '#8a1f1f' : '#fff' }}>
            {errs ? `✕ ${errs} Error${errs > 1 ? 's' : ''}` : '✓ All Good'}
          </span>
          <span aria-hidden style={{ marginLeft: 'auto', color: '#787c82' }}>⌃</span>
        </summary>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {real.map((chk) => (
            <div key={chk.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#2c3338' }}>
              {chkIcon(chk.status)}
              <span style={{ flex: 1 }}>{chk.message}{chk.status !== 'passed' && chk.fixAdvice ? <span style={{ color: '#2271b1' }}> {chk.fixAdvice}</span> : null}</span>
              <span title={chk.fixAdvice || chk.name} style={{ width: 16, height: 16, borderRadius: '50%', background: '#b5bfc9', color: '#fff', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', cursor: 'help' }}>?</span>
            </div>
          ))}
        </div>
      </details>
    );
  };
  const addKeyword = (raw: string) => {
    const word = raw.trim().replace(/,$/, '').trim();
    if (!word) return;
    const all = [focusKeyword, ...additionalKeywords.split(',').map((k: string) => k.trim())].filter(Boolean);
    if (all.some((k) => k.toLowerCase() === word.toLowerCase())) return;
    if (!focusKeyword) setFocusKeyword(word);
    else setAdditionalKeywords([...additionalKeywords.split(',').map((k: string) => k.trim()).filter(Boolean), word].join(', '));
  };
  const removeKeyword = (word: string) => {
    const extras = additionalKeywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    if (word === focusKeyword) { setFocusKeyword(extras[0] || ''); setAdditionalKeywords(extras.slice(1).join(', ')); }
    else setAdditionalKeywords(extras.filter((k: string) => k !== word).join(', '));
  };
  const addTags = async () => {
    const names = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (!names.length) return;
    const next = [...tagIds];
    for (const name of names) {
      let t = tagList.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
      if (!t) {
        try {
          const res = await fetch('/api/v1/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
          const created = await res.json();
          if (res.ok) { t = created.tag || created; setTagList((l: any[]) => [...l, t]); }
        } catch { /* ignore */ }
      }
      if (t && !next.includes(t.id)) next.push(t.id);
    }
    setTagIds(next);
    setTagInput('');
  };
  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/v1/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const created = await res.json();
      const c = created.category || created;
      if (res.ok && c?.id) { setCatList((l: any[]) => [...l, c]); setCategoryIds((ids) => [...ids, c.id]); if (!primaryCategoryId) setPrimaryCategoryId(c.id); setNewCatName(''); setAddingCat(false); }
      else setStatusMessage(created.message || 'Could not add the category.');
    } catch (e: any) { setStatusMessage(e.message); }
  };
  const toggleCategory = (id: string) => {
    const on = categoryIds.includes(id);
    const next = on ? categoryIds.filter((x) => x !== id) : [...categoryIds, id];
    setCategoryIds(next);
    if (!on && !primaryCategoryId) setPrimaryCategoryId(id);
    if (on && primaryCategoryId === id) setPrimaryCategoryId(next[0] || '');
  };
  const onPublishClick = async () => {
    if (isNew) { await handleSaveDraft(false, true); return; }
    if (dirty && !(await handleSaveDraft())) return;
    handleInitiatePublish();
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const seoScore = liveAnalysis.overallScore;
  const scoreColor = seoScore >= 80 ? '#00a32a' : seoScore >= 50 ? '#dba617' : '#d63638';
  const scoreBg = seoScore >= 80 ? '#e7f5e9' : seoScore >= 50 ? '#fcf3d8' : '#fcebea';
  const catsShown = catTab === 'used' ? [...catList].sort((a: any, b: any) => (b.post_count || 0) - (a.post_count || 0)).slice(0, 10) : catList;
  const kwList = [focusKeyword, ...additionalKeywords.split(',').map((k: string) => k.trim())].filter(Boolean);
  const hl = (text: string) => {
    const kw = focusKeyword.trim();
    if (!kw) return text;
    const parts = text.split(new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&') + ')', 'i'));
    return parts.map((p, i) => (p.toLowerCase() === kw.toLowerCase() ? <strong key={i}>{p}</strong> : <React.Fragment key={i}>{p}</React.Fragment>));
  };
  const rmTabs: Array<[string, string]> = [['general', 'General'], ['advanced', 'Advanced'], ['schema', 'Schema'], ['social', 'Social'], ['geo', 'GEO'], ['aeo', 'AEO'], ['indexing', 'Indexing']];
  const publishLabel = status === 'published' ? 'Update' : status === 'scheduled' ? 'Update' : 'Publish';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1d2327' }}>
      <h1 style={{ fontSize: 23, fontWeight: 400, margin: '0 0 16px', padding: '9px 0 4px', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 12 }}>
        {isNew ? 'Add Post' : 'Edit Post'}
        {!isNew && <Link href="/seo-admin/blog/new" style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', border: '1px solid #2271b1', borderRadius: 3, color: '#2271b1', textDecoration: 'none', background: '#f6f7f7', lineHeight: 1.6 }}>Add Post</Link>}
      </h1>

      {[
        lockedBy && { kind: 'error', node: <>{lockedBy.name} is editing this post right now, so saving is turned off for you. {lockedBy.canTakeOver && <button type="button" onClick={() => acquireLock(true)} style={{ marginLeft: 8, padding: '2px 10px', border: '1px solid #2271b1', background: '#f6f7f7', color: '#2271b1', borderRadius: 3, cursor: 'pointer' }}>Take over</button>}</> },
        restoreOffer && { kind: 'warning', node: <>An unsaved autosaved version from {new Date(restoreOffer.saved_at || restoreOffer.updated_at || Date.now()).toLocaleString()} was found. <button type="button" onClick={() => { applyPayload(restoreOffer.snapshot); setRestoreOffer(null); }} style={{ marginLeft: 8, padding: '2px 10px', border: '1px solid #2271b1', background: '#f6f7f7', color: '#2271b1', borderRadius: 3, cursor: 'pointer' }}>Restore</button> <button type="button" onClick={() => setRestoreOffer(null)} style={{ padding: '2px 10px', border: '1px solid #c3c4c7', background: '#f6f7f7', borderRadius: 3, cursor: 'pointer' }}>Dismiss</button></> },
        conflict !== null && { kind: 'error', node: <>Someone else updated this post after you opened it. <button type="button" onClick={() => { setConflict(null); handleSaveDraft(true); }} style={{ marginLeft: 8, padding: '2px 10px', border: '1px solid #d63638', background: '#f6f7f7', color: '#d63638', borderRadius: 3, cursor: 'pointer' }}>Overwrite</button> <button type="button" onClick={() => { savedKey.current = payloadKey; window.location.reload(); }} style={{ padding: '2px 10px', border: '1px solid #c3c4c7', background: '#f6f7f7', borderRadius: 3, cursor: 'pointer' }}>Reload</button></> },
        statusMessage && { kind: /^Error|disabled|Could not/i.test(statusMessage) ? 'error' : 'success', node: statusMessage },
      ].filter(Boolean).map((n: any, i) => (
        <div key={i} role="status" style={{ background: '#fff', border: '1px solid #c3c4c7', borderLeft: `4px solid ${n.kind === 'error' ? '#d63638' : n.kind === 'warning' ? '#dba617' : '#00a32a'}`, boxShadow: '0 1px 1px rgba(0,0,0,.04)', margin: '0 0 12px', padding: '10px 12px', fontSize: 13 }}>{n.node}</div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 20, alignItems: 'start' }}>
        {/* ---------------- Main column ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              aria-label="Add title"
              style={{ width: '100%', fontSize: '1.7em', padding: '3px 8px', lineHeight: 1.9, border: '1px solid #8c8f94', borderRadius: 0, outline: 'none', boxSizing: 'border-box', color: '#1d2327', background: '#fff', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.07)' }}
            />
            {(title || slug || initialPost?.legacy_path) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: '#50575e', flexWrap: 'wrap', minHeight: 28 }}>
                <strong>Permalink:</strong>
                {initialPost?.legacy_path ? (
                  <a style={{ color: '#2271b1', textDecoration: 'underline' }}>https://migrationfactor.com{initialPost.legacy_path}</a>
                ) : slugEditing ? (
                  <>
                    <span>https://migrationfactor.com/blog/</span>
                    <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} style={{ border: '1px solid #8c8f94', padding: '1px 6px', fontSize: 13 }} />
                    <span>/</span>
                    <button type="button" onClick={() => setSlugEditing(false)} style={{ padding: '0 10px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontWeight: 600, cursor: 'pointer', lineHeight: '24px' }}>OK</button>
                  </>
                ) : (
                  <>
                    <a style={{ color: '#2271b1', textDecoration: 'underline' }}>https://migrationfactor.com/blog/<strong>{slug}</strong>/</a>
                    <button type="button" onClick={() => setSlugEditing(true)} style={{ padding: '0 10px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontWeight: 600, cursor: 'pointer', fontSize: 12, lineHeight: '24px' }}>Edit</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            {editorMode === 'classic' ? (
              <ClassicEditor value={classicHtml} onChange={setClassicHtml} resetKey={`${postId || 'new'}-${editorKey}`} pickMedia={pickMedia} notify={setStatusMessage} />
            ) : (
              <div style={{ background: '#ffffff', padding: 16, border: '1px solid #c3c4c7' }}>
                <BlockEditor value={blocks} onChange={setBlocks} resetKey={`${postId || 'new'}-${editorKey}`} canRawHtml={canRawHtml} focusKeyword={focusKeyword} pickMedia={pickMedia} notify={setStatusMessage} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f6f7f7', border: '1px solid #c3c4c7', borderTop: 'none', fontSize: 13, color: '#50575e' }}>
              <span>Word count: {wordCount}</span>
              <button type="button" onClick={switchMode} style={{ border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                {editorMode === 'classic' ? 'Switch to block editor' : 'Switch to classic editor'}
              </button>
            </div>
          </div>

          <MetaBox title="Excerpt">
            <label htmlFor="mf-excerpt" style={{ display: 'block', fontSize: 13, margin: '0 0 6px' }}>Excerpt</label>
            <textarea id="mf-excerpt" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: 6, fontSize: 14 }} />
            <p style={{ fontSize: 13, color: '#646970', margin: '6px 0 0' }}>Excerpts are optional hand-crafted summaries of your content that can be used in your theme.</p>
          </MetaBox>

          {/* ---------------- Rank Math SEO metabox ---------------- */}
          <MetaBox title="Rank Math SEO" flush>
            <div style={{ display: 'flex', borderBottom: '1px solid #dcdcde', background: '#f6f7f7', overflowX: 'auto' }}>
              {rmTabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id as any)}
                  style={{ padding: '14px 18px', border: 'none', borderBottom: activeTab === id ? '3px solid #0a95db' : '3px solid transparent', background: 'transparent', fontSize: 14, color: activeTab === id ? '#1d2327' : '#50575e', fontWeight: activeTab === id ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'general' && (
              <div>
                <div style={{ padding: '16px 16px 18px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#50575e', marginBottom: 8 }}>Preview</div>
                  <div style={{ fontFamily: 'arial, sans-serif', maxWidth: serpPreviewDevice === 'mobile' ? 360 : 640 }}>
                    <div style={{ fontSize: 14, color: '#202124', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>https://migrationfactor.com{initialPost?.legacy_path || `/blog/${slug}/`}</span>
                      <button type="button" aria-label="Toggle desktop / mobile preview" title={serpPreviewDevice === 'desktop' ? 'Show mobile preview' : 'Show desktop preview'} onClick={() => setSerpPreviewDevice(serpPreviewDevice === 'desktop' ? 'mobile' : 'desktop')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#70757a', fontSize: 14 }}>⋮</button>
                    </div>
                    <div style={{ color: '#1a0dab', fontSize: 20, lineHeight: 1.3, margin: '3px 0' }}>{hl(effectiveTitle)}</div>
                    <div style={{ color: '#4d5156', fontSize: 14, lineHeight: 1.58 }}>{effectiveDesc ? hl(effectiveDesc) : 'Please provide a meta description by editing the snippet below. If you don’t, Google will use the most relevant part of your post’s content.'}</div>
                  </div>
                  <button type="button" onClick={() => setSnippetEdit((v) => !v)} style={{ marginTop: 14, padding: '6px 14px', background: '#0a95db', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Edit Snippet</button>
                  {snippetEdit && (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Title <span style={{ fontWeight: 400, fontSize: 12, color: titleCharCount > 60 ? '#d63638' : '#646970' }}>{titleCharCount} / 60 · ~{titlePixelWidth}px</span></label>
                        <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={effectiveTitle} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '6px 8px', fontSize: 14 }} />
                      </div>
                      <div>
                        <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Description <span style={{ fontWeight: 400, fontSize: 12, color: descCharCount > 160 ? '#d63638' : '#646970' }}>{descCharCount} / 160</span></label>
                        <textarea rows={3} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '6px 8px', fontSize: 14 }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #dcdcde', padding: '16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#50575e', marginBottom: 8 }}>Focus Keyword <span title="Add the keywords you want this post to rank for. The first one is the primary focus keyword." style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: '#b5bfc9', color: '#fff', fontSize: 11, alignItems: 'center', justifyContent: 'center', cursor: 'help', marginLeft: 4 }}>?</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px solid #8c8f94', background: '#fff', minHeight: 40 }}>
                    {kwList.map((k, i) => (
                      <span key={k} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 16, background: i === 0 ? '#7ad28a' : '#fde6c8', color: i === 0 ? '#fff' : '#d97706', fontSize: 14 }}>
                        <button type="button" aria-label={`Remove ${k}`} onClick={() => removeKeyword(k)} style={{ position: 'absolute', left: -6, top: -8, width: 16, height: 16, borderRadius: '50%', border: '1px solid #c3c4c7', background: '#fff', color: '#50575e', fontSize: 9, lineHeight: '14px', padding: 0, cursor: 'pointer' }}>✕</button>
                        {i === 0 && <span aria-hidden>★</span>}{k}
                      </span>
                    ))}
                    <input
                      value={kwInput}
                      onChange={(e) => { const v = e.target.value; if (v.endsWith(',')) { addKeyword(v); setKwInput(''); } else setKwInput(v); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(kwInput); setKwInput(''); } }}
                      onBlur={() => { addKeyword(kwInput); setKwInput(''); }}
                      placeholder="Example: Rank Math SEO"
                      aria-label="Focus keyword"
                      style={{ flex: 1, minWidth: 140, border: 'none', outline: 'none', fontSize: 14 }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 14, fontWeight: 600 }}>
                    <input type="checkbox" checked={isCornerstone} onChange={(e) => setIsCornerstone(e.target.checked)} /> This post is Pillar Content
                  </label>
                </div>

                <div style={{ background: '#fff' }}>
                  {checkGroup('Basic SEO', liveAnalysis.checks.basic)}
                  {checkGroup('Additional', liveAnalysis.checks.additional)}
                  {checkGroup('Content Readability', liveAnalysis.checks.readability)}
                  {checkGroup('Technical SEO', liveAnalysis.checks.technical)}
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Robots Meta</div>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}><input type="checkbox" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} /> Index</label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}><input type="checkbox" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} /> Follow</label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={sitemapInclude} onChange={(e) => setSitemapInclude(e.target.checked)} /> Include in XML sitemap</label>
                </div>
                <div>
                  <label htmlFor="mf-canonical" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Canonical URL</label>
                  <input id="mf-canonical" type="url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '6px 8px', fontSize: 14 }} />
                  <p style={{ fontSize: 13, color: '#646970', margin: '4px 0 0' }}>The canonical URL informs search engines which version of this page is the preferred one. Leave it empty to use the post URL.</p>
                </div>
                <div>
                  <label htmlFor="mf-breadcrumb" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Breadcrumb Title</label>
                  <input id="mf-breadcrumb" type="text" value={breadcrumbTitle} onChange={(e) => setBreadcrumbTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '6px 8px', fontSize: 14 }} />
                </div>
                <div>
                  <label htmlFor="mf-h1" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Custom H1</label>
                  <input id="mf-h1" type="text" value={customH1} onChange={(e) => setCustomH1(e.target.value)} placeholder="Leave empty to use the post title" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '6px 8px', fontSize: 14 }} />
                </div>
              </div>
            )}

            <div style={{ padding: activeTab === 'general' || activeTab === 'advanced' ? 0 : 16 }}>
          {/* TAB 3: SOCIAL */}
          {activeTab === 'social' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#1d2327' }}>
                <input type="checkbox" checked={useSeoValues} onChange={(e) => setUseSeoValues(e.target.checked)} />
                Use SEO Title and Meta Description for Social
              </label>

              {!useSeoValues && (
                <>
                  <div style={{ borderTop: '1px solid #c3c4c7', paddingTop: 12 }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#2271b1', margin: '0 0 8px' }}>
                      Facebook / Open Graph Custom Overrides
                    </h4>
                    <input
                      type="text"
                      value={ogTitle}
                      onChange={(e) => setOgTitle(e.target.value)}
                      placeholder="Custom OG Title"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', marginBottom: 6, boxSizing: 'border-box' }}
                    />
                    <textarea
                      rows={2}
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="Custom OG Description"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ borderTop: '1px solid #c3c4c7', paddingTop: 12 }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#2271b1', margin: '0 0 8px' }}>
                      X / Twitter Custom Overrides
                    </h4>
                    <input
                      type="text"
                      value={twitterTitle}
                      onChange={(e) => setTwitterTitle(e.target.value)}
                      placeholder="Custom Twitter Title"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', marginBottom: 6, boxSizing: 'border-box' }}
                    />
                    <textarea
                      rows={2}
                      value={twitterDescription}
                      onChange={(e) => setTwitterDescription(e.target.value)}
                      placeholder="Custom Twitter Description"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}

              {/* Social Preview Representation */}
              <div style={{ border: '1px solid #8c8f94', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
                {featuredImageUrl && (
                  <div style={{ height: 140, backgroundColor: '#f0f0f1' }}>
                    <img src={featuredImageUrl} alt="Social Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 12, background: '#f6f7f7' }}>
                  <div style={{ fontSize: '0.7rem', color: '#50575e', textTransform: 'uppercase' }}>migrationfactor.com</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1d2327', marginTop: 2 }}>
                    {(!useSeoValues && ogTitle) ? ogTitle : effectiveTitle}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#50575e', marginTop: 2 }}>
                    {(!useSeoValues && ogDescription) ? ogDescription : effectiveDesc}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEMA */}
          {activeTab === 'schema' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {postId && <SchemaPanel postId={postId} refreshKey={saveStatus} />}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Article Schema Type
                </label>
                <select
                  value={articleType}
                  onChange={(e) => setArticleType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.875rem', background: '#ffffff' }}
                >
                  <option value="BlogPosting">BlogPosting (Recommended)</option>
                  <option value="Article">Article</option>
                  <option value="NewsArticle">NewsArticle</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={faqEnabled} onChange={(e) => setFaqEnabled(e.target.checked)} />
                Include FAQPage Schema (from FAQ blocks)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={howtoEnabled} onChange={(e) => setHowtoEnabled(e.target.checked)} />
                Include HowTo Schema (from Steps blocks)
              </label>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Custom Schema JSON-LD (Advanced)
                </label>
                <textarea
                  rows={5}
                  value={customJsonLd}
                  onChange={(e) => setCustomJsonLd(e.target.value)}
                  placeholder="{ '@type': 'SpecialItem', ... }"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontFamily: 'monospace', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 5: GEO */}
          {activeTab === 'geo' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ReferencesPanel value={references} onChange={setReferences} trusted={['homeaffairs.gov.au', 'immi.homeaffairs.gov.au', 'legislation.gov.au', 'abs.gov.au']} />
              <div style={{ background: '#f0f0f1', border: '1px solid #ddd6fe', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#135e96' }}>
                <strong>Generative Engine Optimization (GEO):</strong> Optimizes for AI overview engines (ChatGPT Search, Perplexity, Google SGE) by asserting structured entities and factual references.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Primary Question Targeted
                </label>
                <input
                  type="text"
                  value={primaryQuestion}
                  onChange={(e) => setPrimaryQuestion(e.target.value)}
                  placeholder="e.g. What are the requirements for Skills in Demand visa?"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Concise Answer Summary (40–60 words)
                </label>
                <textarea
                  rows={3}
                  value={answerSummary}
                  onChange={(e) => setAnswerSummary(e.target.value)}
                  placeholder="Direct, factual answer for AI summary snippets..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Primary Entity Name
                </label>
                <input
                  type="text"
                  value={primaryEntityName}
                  onChange={(e) => setPrimaryEntityName(e.target.value)}
                  placeholder="e.g. Skills in Demand visa"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#1d2327', marginBottom: 4 }}>
                  Official Entity Authority URL (sameAs)
                </label>
                <input
                  type="url"
                  value={primaryEntityUrl}
                  onChange={(e) => setPrimaryEntityUrl(e.target.value)}
                  placeholder="https://immi.homeaffairs.gov.au/..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 6: AEO */}
          {activeTab === 'aeo' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f0f0f1', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#135e96' }}>
                <strong>Answer Engine Optimization (AEO):</strong> Evaluates answer structure, question-based H2/H3 headings, and direct answer speed.
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d2327', marginBottom: 8 }}>
                  Question Outline Inspector ({headings.filter(h => h.text.includes('?') || /^(what|how|who|can|is|why)/i.test(h.text)).length} question headings)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {headings.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#f6f7f7', borderRadius: 4 }}>
                      <span style={{ fontWeight: 700, color: '#2271b1' }}>H{h.level}:</span> {h.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'indexing' && (postId ? <IndexingPanel postId={postId} published={status === 'published'} /> : <div style={{ fontSize: '0.8125rem', color: '#50575e' }}>Save the post first.</div>)}

            </div>
          </MetaBox>

          {postId && (
            <MetaBox title="Revisions" id="mf-revisions">
              <RevisionsPanel postId={postId} onRestore={(p) => { applyPayload(p); setStatusMessage('Revision loaded into the editor. Click Update to keep it.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </MetaBox>
          )}
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <MetaBox title="Publish" flush>
            <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {status !== 'published' ? (
                <button type="button" onClick={() => handleSaveDraft()} disabled={saving} style={{ padding: '0 10px', lineHeight: '28px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save Draft'}</button>
              ) : <span />}
              {postId ? (
                <Link href={`/preview/${postId}`} target="_blank" style={{ padding: '0 10px', lineHeight: '28px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, textDecoration: 'none' }}>{status === 'published' ? 'Preview Changes' : 'Preview'}</Link>
              ) : (
                <button type="button" onClick={() => handleSaveDraft()} style={{ padding: '0 10px', lineHeight: '28px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, cursor: 'pointer' }}>Preview</button>
              )}
            </div>
            <div style={{ padding: '0 12px 8px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>📌 Status: <strong style={{ textTransform: 'capitalize' }}>{status === 'pending_review' ? 'Pending Review' : status}</strong>{postId && <> <button type="button" onClick={() => setStatusOpen((v) => !v)} style={{ border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Edit</button></>}</div>
              {statusOpen && postId && (
                <WorkflowActions
                  postId={postId}
                  status={status}
                  canPublish={roles.some((r) => ['super_admin', 'admin', 'seo_manager', 'editor'].includes(r))}
                  canDelete={false}
                  onMessage={setStatusMessage}
                  onStatus={setStatus}
                  ensureSaved={async () => (dirty ? handleSaveDraft() : true)}
                  wp
                />
              )}
              {postId && <div>🕘 Revisions: <strong>{revCount ?? '…'}</strong> <a href="#mf-revisions" style={{ color: '#2271b1' }}>Browse</a></div>}
              <div>📅 {status === 'published' && initialPost?.published_at ? <>Published on: <strong>{fmtDate(initialPost.published_at)}</strong></> : status === 'scheduled' && initialPost?.scheduled_at ? <>Scheduled for: <strong>{fmtDate(initialPost.scheduled_at)}</strong></> : <>Publish <strong>immediately</strong> {postId && <button type="button" onClick={() => setStatusOpen((v) => !v)} style={{ border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Edit</button>}</>}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span role="switch" aria-checked={minorUpdate} style={{ position: 'relative', width: 40, height: 20, borderRadius: 10, border: '2px solid #1d2327', background: minorUpdate ? '#2271b1' : '#fff', flex: 'none', display: 'inline-block' }}>
                  <span style={{ position: 'absolute', top: 2, left: minorUpdate ? 22 : 2, width: 12, height: 12, borderRadius: '50%', background: minorUpdate ? '#fff' : '#1d2327', transition: 'left .15s' }} />
                </span>
                <input type="checkbox" checked={minorUpdate} onChange={(e) => setMinorUpdate(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                Lock Modified Date
              </label>
            </div>
            {!isNew && <div style={{ background: scoreBg, borderTop: '1px solid #dcdcde', padding: '10px 12px', fontSize: 13, color: scoreColor, fontWeight: 600 }}>SEO: {seoScore} / 100</div>}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #dcdcde', background: '#f6f7f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 }}>
              {postId ? <MoveToTrash postId={postId} onMessage={setStatusMessage} /> : <span />}
              <button
                type="button"
                onClick={status === 'published' || status === 'scheduled' ? () => handleSaveDraft() : onPublishClick}
                disabled={saving || publishing}
                style={{ padding: '0 14px', lineHeight: '30px', border: '1px solid #2271b1', borderRadius: 3, background: '#2271b1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {publishLabel}
              </button>
            </div>
          </MetaBox>

          <MetaBox title="Categories" flush>
            <div style={{ padding: '8px 12px 12px' }}>
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #dcdcde', marginBottom: 8 }}>
                {([['all', 'All Categories'], ['used', 'Most Used']] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setCatTab(id)} style={{ padding: '4px 8px', border: 'none', borderBottom: catTab === id ? '2px solid #1d2327' : '2px solid transparent', background: 'none', color: catTab === id ? '#1d2327' : '#2271b1', fontSize: 13, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #dcdcde', padding: '8px 10px' }}>
                {catsShown.map((c: any) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '3px 0' }}>
                    <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {categoryIds.includes(c.id) && (
                      <input type="radio" name="primary-category" aria-label={`Make ${c.name} the primary category`} title="Primary category" checked={primaryCategoryId === c.id} onChange={() => setPrimaryCategoryId(c.id)} />
                    )}
                  </label>
                ))}
              </div>
              {addingCat ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} placeholder="New Category Name" style={{ flex: 1, minWidth: 0, border: '1px solid #8c8f94', padding: '3px 6px', fontSize: 13 }} />
                  <button type="button" onClick={addCategory} style={{ padding: '0 8px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, cursor: 'pointer' }}>Add</button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingCat(true)} style={{ marginTop: 10, border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>+ Add Category</button>
              )}
            </div>
          </MetaBox>

          <MetaBox title="Tags" flush>
            <div style={{ padding: '10px 12px 12px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTags(); } }} aria-label="Add New Tag" style={{ flex: 1, minWidth: 0, border: '1px solid #8c8f94', padding: '4px 6px', fontSize: 14 }} />
                <button type="button" onClick={addTags} style={{ padding: '0 14px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
              </div>
              <p style={{ fontSize: 12, fontStyle: 'italic', color: '#646970', margin: '6px 0' }}>Separate tags with commas</p>
              {tagIds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '6px 0' }}>
                  {tagIds.map((id) => {
                    const t = tagList.find((x: any) => x.id === id);
                    return t ? (
                      <div key={id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button type="button" aria-label={`Remove term: ${t.name}`} onClick={() => setTagIds(tagIds.filter((x) => x !== id))} style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'none', color: '#d63638', cursor: 'pointer', padding: 0 }}>⊗</button>{t.name}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <button type="button" onClick={() => setShowPopularTags((v) => !v)} style={{ border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0, marginTop: 8 }}>Choose from the most used tags</button>
              {showPopularTags && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[...tagList].sort((a: any, b: any) => (b.post_count || 0) - (a.post_count || 0)).slice(0, 20).map((t: any) => (
                    <button key={t.id} type="button" onClick={() => !tagIds.includes(t.id) && setTagIds([...tagIds, t.id])} style={{ border: 'none', background: 'none', color: '#2271b1', cursor: 'pointer', fontSize: 13, padding: 0 }}>{t.name}</button>
                  ))}
                </div>
              )}
            </div>
          </MetaBox>

          <MetaBox title="Author" flush>
            <div style={{ padding: '10px 12px 12px' }}>
              <select
                multiple
                value={selectedAuthorIds}
                onChange={(e) => setSelectedAuthorIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                aria-label="Author"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', fontSize: 13, minHeight: 70 }}
              >
                {authors.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </div>
          </MetaBox>

          <MetaBox title="Link Suggestions" flush>
            <div style={{ padding: '4px 4px 8px' }}>
              {postId ? <LinksPanel postId={postId} /> : <p style={{ fontSize: 13, fontStyle: 'italic', color: '#646970', margin: 8 }}>We can’t show any link suggestions for this post. Try selecting categories and tags for this post, and mark other posts as Pillar Content to make them show up here.</p>}
            </div>
          </MetaBox>

          <MetaBox title="Featured image" flush>
            <div style={{ padding: '12px' }}>
              {featuredImageUrl ? (
                <>
                  <button type="button" onClick={async () => { const m = await pickMedia(); if (m) { setFeaturedMediaId(m.id); setFeaturedImageUrl(m.url); if (m.alt) setFeaturedAlt(m.alt); } }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block', width: '100%' }} aria-label="Click the image to edit or update">
                    <img src={featuredImageUrl} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </button>
                  <p style={{ fontSize: 13, color: '#646970', margin: '8px 0' }}>Click the image to edit or update</p>
                  <input value={featuredAlt} onChange={(e) => setFeaturedAlt(e.target.value)} placeholder="Alternative Text" aria-label="Alternative Text" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '4px 6px', fontSize: 13, marginBottom: 8 }} />
                  <button type="button" onClick={() => { setFeaturedMediaId(''); setFeaturedImageUrl(''); }} style={{ border: 'none', background: 'none', color: '#b32d2e', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Remove featured image</button>
                </>
              ) : (
                <button type="button" onClick={async () => { const m = await pickMedia(); if (m) { setFeaturedMediaId(m.id); setFeaturedImageUrl(m.url); if (m.alt && !featuredAlt) setFeaturedAlt(m.alt); } }} style={{ border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Set featured image</button>
              )}
            </div>
          </MetaBox>
        </div>
      </div>

      {/* Pre-Publish Check Modal (Section 17.3) */}
      {publishModalOpen && prepublishResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d2327', margin: '0 0 12px' }}>
              Pre-Publish Verification Checks
            </h2>

            {/* Blocking Errors */}
            {prepublishResult.blocking?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#d63638', fontSize: '0.875rem', marginBottom: 6 }}>
                  ❌ Blocking Errors (Must fix before publishing):
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#8a2424' }}>
                  {prepublishResult.blocking.map((b: any, i: number) => (
                    <li key={i}>{b.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {prepublishResult.warnings?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#996800', fontSize: '0.875rem', marginBottom: 6 }}>
                  ⚠️ Warnings (Recommended to review):
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#614200' }}>
                  {prepublishResult.warnings.map((w: any, i: number) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #c3c4c7', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #8c8f94',
                  background: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Go Back & Fix
              </button>

              {prepublishResult.can_publish_with_ack && (
                <button
                  type="button"
                  onClick={handleConfirmPublishAnyway}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    background: '#2271b1',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Acknowledge & Publish Anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {mediaPicker && (
        <MediaPicker
          onPick={(m) => { mediaPicker(m); setMediaPicker(null); }}
          onClose={() => { mediaPicker(null); setMediaPicker(null); }}
        />
      )}
    </div>
  );
}

/** WordPress-style postbox: bordered white box with a heading row and a collapse arrow. */
function MetaBox({ title, children, flush, id }: { title: string; children: React.ReactNode; flush?: boolean; id?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} style={{ background: '#fff', border: '1px solid #c3c4c7', boxShadow: '0 1px 1px rgba(0,0,0,.04)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: 'none', borderBottom: open ? '1px solid #c3c4c7' : 'none', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: '#1d2327' }}>{title}</h2>
        <span aria-hidden style={{ color: '#787c82', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={flush ? undefined : { padding: '6px 12px 12px' }}>{children}</div>}
    </div>
  );
}
