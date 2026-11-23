'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { runContentAnalysis, calculateFleschScore, calculatePixelWidth } from '@/lib/seo-system/analysis';
import { renderBlocksToHtml } from '@/lib/seo-system/sanitizer';
import BlockEditor, { type Block, type PickedMedia } from './BlockEditor';
import MediaPicker from './MediaPicker';
import ClassicEditor from './ClassicEditor';
import { htmlToBlocks } from './paste-clean';
import { SITE_URL, SITE_HOST } from '@/lib/seo-system/site-config';
import { applyTitleTemplate } from '@/lib/seo-system/settings-defaults';
import { buildChecklist } from '@/lib/seo-system/rankmath-checks';
import { scoreSeo } from '@/lib/seo-system/seo-score';
import { WorkflowActions, RevisionsPanel, LinksPanel, SchemaPanel, ReferencesPanel, MoveToTrash } from './PostWorkflow';

interface PostEditorProps {
  initialPost?: any;
  categories: any[];
  authors: any[];
  tags?: any[];
  currentUser: any;
  /** Title template and name from Settings, used for the live search-result preview. */
  site?: { name: string; titleTemplate: string; titleSeparator: string };
}

export default function PostEditor({
  initialPost,
  categories,
  authors,
  tags = [],
  currentUser,
  site,
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
  const [featuredWidth, setFeaturedWidth] = useState<number>(Number(initialPost?.featured_media_width) || 0);
  const [requireFeatured, setRequireFeatured] = useState(true);
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
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'social' | 'schema'>('general');
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
  const [visOpen, setVisOpen] = useState(false);
  useEffect(() => {
    fetch('/api/v1/settings/seo').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.settings && d.settings.requireFeaturedImage === false) setRequireFeatured(false); }).catch(() => undefined);
  }, []);
  const [kwUsedBefore, setKwUsedBefore] = useState(0);
  useEffect(() => {
    const kw = focusKeyword.trim();
    if (!kw) { setKwUsedBefore(0); return; }
    const t = setTimeout(() => {
      fetch('/api/v1/keyword-usage?keyword=' + encodeURIComponent(kw) + (postId ? '&exclude=' + postId : ''))
        .then((r) => r.json()).then((d) => setKwUsedBefore(Number(d.count) || 0)).catch(() => undefined);
    }, 600);
    return () => clearTimeout(t);
  }, [focusKeyword, postId]);
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ 'Basic SEO': true });
  const DEFAULT_ORDER = { main: ['rankmath', 'revisions'], side: ['publish', 'format', 'categories', 'tags', 'author', 'links', 'featured'] };
  const [order, setOrder] = useState<{ main: string[]; side: string[] }>(DEFAULT_ORDER);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mf-editor-box-order') || 'null');
      if (saved && DEFAULT_ORDER.main.every((i) => saved.main?.includes(i)) && DEFAULT_ORDER.side.every((i) => saved.side?.includes(i))) setOrder(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const effectiveTitle = seoTitle || (site ? applyTitleTemplate(site.titleTemplate, { title, siteName: site.name, separator: site.titleSeparator as any }) : title);
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
            try { await fetch(`/api/v1/posts/${data.post.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledge_warnings: true }) }); } catch { /* the editor shows Publish again */ }
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
        body: JSON.stringify({ acknowledge_warnings: true }),
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

  const BLUE = '#3858e9';
  const chkIcon = (st: string) => {
    if (st === 'needs_improvement') {
      return <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #f6ad55', color: '#f6ad55', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxSizing: 'border-box' }}>✓</span>;
    }
    const ok = st === 'passed';
    return <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', background: ok ? '#7ad28a' : '#f0908d', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{ok ? '✓' : '✕'}</span>;
  };
  const helpDot = (tip: string) => (
    <span title={tip} style={{ width: 18, height: 18, borderRadius: '50%', background: '#b5bfc9', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', cursor: 'help' }}>?</span>
  );
  const pubUrl = `${SITE_URL}${initialPost?.legacy_path || `/blog/${slug}/`}`;
  const checklist = buildChecklist({
    focusKeyword,
    seoTitle: effectiveTitle,
    metaDescription: effectiveDesc,
    url: pubUrl,
    bodyHtml: renderedHtml,
    keywordUsedBefore: kwUsedBefore,
  });
  const sections: Array<[string, any[]]> = [
    ['Basic SEO', checklist.basic],
    ['Additional', checklist.additional],
    ['Title Readability', checklist.titleReadability],
    ['Content Readability', checklist.contentReadability],
  ];
  const checkGroup = ([label, checks]: [string, any[]]) => {
    const real = checks.filter((c) => c.status !== 'not_applicable');
    const errs = real.filter((c) => c.status === 'failed').length;
    const open = openSec[label] === true;
    return (
      <div key={label} style={{ borderTop: '1px solid #dcdcde' }}>
        <button type="button" onClick={() => setOpenSec((o) => ({ ...o, [label]: !open }))} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', border: 'none', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 16, fontWeight: 600, color: '#1e1e1e' }}>
          {label}
          <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 12px', borderRadius: 14, background: errs ? '#f0908d' : '#7ad28a', color: '#fff' }}>{errs ? `✕ ${errs} Errors` : '✓ All Good'}</span>
          <span aria-hidden style={{ marginLeft: 'auto' }}><Chevron up={open} /></span>
        </button>
        {open && (
          <div style={{ padding: '4px 20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {real.map((chk) => (
              <div key={chk.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#2c3338' }}>
                {chkIcon(chk.status)}
                <span style={{ flex: 1 }}>{chk.message}</span>
                {helpDot(chk.tip || chk.message)}
              </div>
            ))}
          </div>
        )}
      </div>
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
  const sheetScore = scoreSeo({
    focusKeyword,
    seoTitle: effectiveTitle,
    metaDescription: effectiveDesc,
    url: pubUrl,
    bodyHtml: renderedHtml,
    keywordUsedBefore: kwUsedBefore,
    robotsIndex,
    canonicalUrl,
    articleSchema: true,
  });
  const seoScore = sheetScore.total;
  const scoreTip = sheetScore.grade + ': ' + sheetScore.categories.map((c) => c.name + ' ' + c.earned + '/' + c.max).join(', ');
  const scoreColor = seoScore >= 80 ? '#2e9b4e' : seoScore >= 60 ? '#b7791f' : '#c53030';
  const scoreBg = seoScore >= 80 ? '#e8f5ea' : seoScore >= 60 ? '#fcf3d8' : '#fcebea';
  const catsShown = catTab === 'used' ? [...catList].sort((a: any, b: any) => (b.post_count || 0) - (a.post_count || 0)).slice(0, 10) : catList;
  const kwList = [focusKeyword, ...additionalKeywords.split(',').map((k: string) => k.trim())].filter(Boolean);
  const hl = (text: string) => {
    const kw = focusKeyword.trim();
    if (!kw) return text;
    const parts = text.split(new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&') + ')', 'i'));
    return parts.map((p, i) => (p.toLowerCase() === kw.toLowerCase() ? <strong key={i}>{p}</strong> : <React.Fragment key={i}>{p}</React.Fragment>));
  };
  const publishLabel = status === 'published' || status === 'scheduled' ? 'Update' : 'Publish';
  const snippetUrlParts = pubUrl.slice(SITE_URL.length);
  const mv = (col: 'main' | 'side', id: string, dir: -1 | 1) => setOrder((o) => {
    const list = [...o[col]];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return o;
    [list[i], list[j]] = [list[j], list[i]];
    const next = { ...o, [col]: list };
    try { localStorage.setItem('mf-editor-box-order', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const box = (col: 'main' | 'side', id: string, title: string, children: React.ReactNode, opts: { flush?: boolean; defaultOpen?: boolean } = {}) => (
    <MetaBox key={id} id={`mf-box-${id}`} title={title} flush={opts.flush} defaultOpen={opts.defaultOpen} onUp={() => mv(col, id, -1)} onDown={() => mv(col, id, 1)}>{children}</MetaBox>
  );
  const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: BLUE, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, padding: 0 };
  const outBtn: React.CSSProperties = { padding: '0 14px', lineHeight: '36px', minHeight: 38, border: `1px solid ${BLUE}`, borderRadius: 3, background: '#fff', color: BLUE, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
  const radio = (on: boolean, disabled?: boolean) => (
    <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', border: on ? `6px solid ${BLUE}` : '1px solid #8c8f94', background: '#fff', boxSizing: 'border-box', flex: 'none', opacity: disabled ? 0.5 : 1 }} />
  );

  const publishBox = (
    <>
      <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {status !== 'published' ? (
          <button type="button" onClick={() => handleSaveDraft()} disabled={saving} style={outBtn}>{saving ? 'Saving…' : 'Save Draft'}</button>
        ) : <span />}
        {postId ? (
          <Link href={`/preview/${postId}`} target="_blank" style={outBtn}>{status === 'published' ? 'Preview Changes' : 'Preview'}</Link>
        ) : (
          <button type="button" onClick={() => handleSaveDraft()} style={outBtn}>Preview</button>
        )}
      </div>
      <div style={{ padding: '4px 16px 16px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 16, color: '#1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconPin /><span>Status: <strong style={{ textTransform: 'capitalize' }}>{status === 'pending_review' ? 'Pending Review' : status}</strong>{postId && <> <button type="button" onClick={() => setStatusOpen((v) => !v)} style={linkBtn}>Edit</button></>}</span></div>
        {statusOpen && postId && (
          <WorkflowActions postId={postId} status={status} canPublish={roles.some((r) => ['super_admin', 'admin', 'seo_manager', 'editor'].includes(r))} canDelete={false} onMessage={setStatusMessage} onStatus={setStatus} ensureSaved={async () => (dirty ? handleSaveDraft() : true)} wp />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconEye /><span>Visibility: <strong>Public</strong> <button type="button" onClick={() => setVisOpen((v) => !v)} style={linkBtn}>Edit</button></span></div>
        {visOpen && (
          <div style={{ marginLeft: 32, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked readOnly /> Public <span style={{ color: '#646970' }}>Visible to everyone</span></label>
            <button type="button" onClick={() => setVisOpen(false)} style={{ ...linkBtn, marginTop: 6 }}>OK</button>
          </div>
        )}
        {postId && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconClock /><span>Revisions: <strong>{revCount ?? '…'}</strong> <a href="#mf-box-revisions" style={{ color: BLUE }}>Browse</a></span></div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconCal />
          <span>
            {status === 'published' && initialPost?.published_at ? <>Published on: <strong>{fmtDate(initialPost.published_at)}</strong></> : status === 'scheduled' && initialPost?.scheduled_at ? <>Scheduled for: <strong>{fmtDate(initialPost.scheduled_at)}</strong></> : <>Publish <strong>immediately</strong></>}
            {postId && <> <button type="button" onClick={() => setStatusOpen((v) => !v)} style={linkBtn}>Edit</button></>}
          </span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span role="switch" aria-checked={minorUpdate} style={{ position: 'relative', width: 42, height: 22, borderRadius: 11, border: '2px solid #1e1e1e', background: minorUpdate ? BLUE : '#fff', borderColor: minorUpdate ? BLUE : '#1e1e1e', flex: 'none', display: 'inline-block', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', top: 3, left: minorUpdate ? 22 : 3, width: 12, height: 12, borderRadius: '50%', background: minorUpdate ? '#fff' : '#1e1e1e', transition: 'left .15s' }} />
          </span>
          <input type="checkbox" checked={minorUpdate} onChange={(e) => setMinorUpdate(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          Lock Modified Date
        </label>
      </div>
      {true && (
        <div title={scoreTip} style={{ background: scoreBg, borderTop: '1px solid #dcdcde', padding: '14px 16px', fontSize: 14, color: scoreColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBars /> SEO: {seoScore} / 100
        </div>
      )}
      <div style={{ padding: '16px', borderTop: '1px solid #dcdcde', background: '#f6f7f7', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
        {postId && <MoveToTrash postId={postId} onMessage={setStatusMessage} />}
        <button
          type="button"
          onClick={status === 'published' || status === 'scheduled' ? () => handleSaveDraft() : onPublishClick}
          disabled={saving || publishing}
          style={{ padding: '0 22px', lineHeight: '38px', minHeight: 40, border: `1px solid ${BLUE}`, borderRadius: 3, background: BLUE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {publishLabel}
        </button>
      </div>
    </>
  );

  const FORMATS: Array<[string, string]> = [['Standard', '📌'], ['Gallery', '🖼'], ['Image', '🖼'], ['Link', '🔗'], ['Quote', '❝'], ['Video', '🎞'], ['Audio', '🎵'], ['Status', '💬'], ['Aside', '📄']];

  const sideBoxes: Record<string, React.ReactNode> = {
    publish: box('side', 'publish', 'Publish', publishBox, { flush: true }),
    format: box('side', 'format', 'Format', (
      <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FORMATS.map(([name, icon], i) => (
          <label key={name} title={i === 0 ? undefined : 'This site publishes standard posts only.'} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#1e1e1e', opacity: i === 0 ? 1 : 0.9, cursor: i === 0 ? 'default' : 'not-allowed' }}>
            {radio(i === 0, i !== 0)}
            <span aria-hidden style={{ width: 24, textAlign: 'center', filter: 'grayscale(1)', opacity: 0.45, fontSize: 18 }}>{icon}</span>
            {name}
          </label>
        ))}
      </div>
    ), { flush: true }),
    categories: box('side', 'categories', 'Categories', (
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: -1, position: 'relative' }}>
          {([['all', 'All Categories'], ['used', 'Most Used']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setCatTab(id)} style={{ padding: '6px 10px', border: catTab === id ? '1px solid #dcdcde' : '1px solid transparent', borderBottom: catTab === id ? '1px solid #fff' : '1px solid transparent', background: '#fff', color: catTab === id ? '#1e1e1e' : BLUE, fontSize: 14, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        <div className="mf-scroll" style={{ maxHeight: 230, overflowY: 'scroll', border: '1px solid #dcdcde', padding: '12px 12px 4px 14px' }}>
          {catsShown.map((c: any) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, padding: '5px 0', color: '#1e1e1e' }}>
              <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} style={{ width: 20, height: 20, margin: 0 }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              {categoryIds.includes(c.id) && (
                <button type="button" aria-label={`Make ${c.name} the primary category`} title="Primary category" onClick={(e) => { e.preventDefault(); setPrimaryCategoryId(c.id); }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>{radio(primaryCategoryId === c.id)}</button>
              )}
            </label>
          ))}
        </div>
        {addingCat ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} placeholder="New Category Name" style={{ flex: 1, minWidth: 0, border: '1px solid #8c8f94', padding: '4px 8px', fontSize: 14 }} />
            <button type="button" onClick={addCategory} style={{ ...outBtn, lineHeight: '28px', minHeight: 30 }}>Add</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingCat(true)} style={{ ...linkBtn, marginTop: 14, fontWeight: 600 }}>+ Add Category</button>
        )}
      </div>
    ), { flush: true }),
    tags: box('side', 'tags', 'Tags', (
      <div style={{ padding: '14px 12px 16px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTags(); } }} aria-label="Add New Tag" style={{ flex: 1, minWidth: 0, border: '1px solid #8c8f94', padding: '0 8px', minHeight: 40, fontSize: 14 }} />
          <button type="button" onClick={addTags} style={{ ...outBtn, minHeight: 40, padding: '0 20px' }}>Add</button>
        </div>
        <p style={{ fontSize: 14, color: '#50575e', margin: '12px 0' }}>Separate tags with commas</p>
        {tagIds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' }}>
            {tagIds.map((id) => {
              const t = tagList.find((x: any) => x.id === id);
              return t ? (
                <div key={id} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" aria-label={`Remove term: ${t.name}`} onClick={() => setTagIds(tagIds.filter((x) => x !== id))} style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'none', color: '#b32d2e', cursor: 'pointer', padding: 0 }}>⊗</button>{t.name}
                </div>
              ) : null;
            })}
          </div>
        )}
        <button type="button" onClick={() => setShowPopularTags((v) => !v)} style={{ ...linkBtn, marginTop: 14 }}>Choose from the most used tags</button>
        {showPopularTags && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...tagList].sort((a: any, b: any) => (b.post_count || 0) - (a.post_count || 0)).slice(0, 20).map((t: any) => (
              <button key={t.id} type="button" onClick={() => !tagIds.includes(t.id) && setTagIds([...tagIds, t.id])} style={{ border: 'none', background: 'none', color: BLUE, cursor: 'pointer', fontSize: 14, padding: 0 }}>{t.name}</button>
            ))}
          </div>
        )}
      </div>
    ), { flush: true }),
    author: box('side', 'author', 'Author', (
      <div style={{ padding: '12px' }}>
        <select multiple value={selectedAuthorIds} onChange={(e) => setSelectedAuthorIds(Array.from(e.target.selectedOptions).map((o) => o.value))} aria-label="Author" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', fontSize: 14, minHeight: 70 }}>
          {authors.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select>
      </div>
    ), { flush: true }),
    links: box('side', 'links', 'Link Suggestions', (
      <div style={{ padding: '12px 14px' }}>
        {postId ? <LinksPanel postId={postId} /> : <p style={{ fontSize: 14, fontStyle: 'italic', color: '#50575e', margin: 0 }}>We can’t show any link suggestions for this post. Try selecting categories and tags for this post, and mark other posts as Pillar Content to make them show up here.</p>}
      </div>
    ), { flush: true }),
    featured: box('side', 'featured', 'Featured image', (
      <div style={{ padding: '12px' }}>
        {featuredImageUrl ? (
          <>
            <button type="button" onClick={async () => { const m = await pickMedia(); if (m) { setFeaturedMediaId(m.id); setFeaturedImageUrl(m.url); setFeaturedWidth(Number(m.width) || 0); if (m.alt) setFeaturedAlt(m.alt); } }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block', width: '100%' }} aria-label="Click the image to edit or update">
              <img src={featuredImageUrl} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </button>
            <p style={{ fontSize: 15, color: '#50575e', margin: '16px 0' }}>Click the image to edit or update</p>
            <button type="button" onClick={() => { setFeaturedMediaId(''); setFeaturedImageUrl(''); setFeaturedWidth(0); }} style={{ ...linkBtn, color: '#b32d2e', fontSize: 15 }}>Remove featured image</button>
          </>
        ) : (
          <button type="button" onClick={async () => { const m = await pickMedia(); if (m) { setFeaturedMediaId(m.id); setFeaturedImageUrl(m.url); setFeaturedWidth(Number(m.width) || 0); if (m.alt && !featuredAlt) setFeaturedAlt(m.alt); } }} style={{ ...linkBtn, fontSize: 15 }}>Set featured image</button>
        )}
      </div>
    ), { flush: true }),
  };

  const rankMathBox = (
    <>
      <div style={{ display: 'flex', borderBottom: '1px solid #dcdcde', background: '#f6f7f7', overflowX: 'auto' }}>
        {([['general', 'General', <IconGear key="g" />], ['advanced', 'Advanced', <IconBriefcase key="a" />], ['schema', 'Schema', <IconSchema key="s" />], ['social', 'Social', <IconShare key="so" />]] as Array<[string, string, React.ReactNode]>).map(([id, label, icon]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id as any)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '18px 20px', border: 'none', borderBottom: activeTab === id ? '3px solid #0f9fe0' : '3px solid transparent', background: 'transparent', fontSize: 15, color: activeTab === id ? '#1e1e1e' : '#50575e', cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1 }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div>
          <div style={{ padding: '24px 26px 28px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#50575e', marginBottom: 14 }}>Preview</div>
            <div style={{ fontFamily: 'arial, sans-serif', maxWidth: serpPreviewDevice === 'mobile' ? 380 : 700 }}>
              <div style={{ fontSize: 16, color: '#202124', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span>{SITE_URL}{hl(snippetUrlParts)}</span>
                <button type="button" aria-label="Toggle desktop / mobile preview" title={serpPreviewDevice === 'desktop' ? 'Show mobile preview' : 'Show desktop preview'} onClick={() => setSerpPreviewDevice(serpPreviewDevice === 'desktop' ? 'mobile' : 'desktop')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#70757a', fontSize: 16, padding: 0 }}>⋮</button>
              </div>
              <div style={{ color: '#1a0dab', fontSize: 22, lineHeight: 1.3, margin: '6px 0 4px' }}>{hl(effectiveTitle)}</div>
              <div style={{ color: '#4d5156', fontSize: 15, lineHeight: 1.55 }}>{effectiveDesc ? hl(effectiveDesc) : 'Please provide a meta description by editing the snippet below. If you don’t, Google will use the most relevant part of your post’s content.'}</div>
            </div>
            <button type="button" onClick={() => setSnippetEdit((v) => !v)} style={{ marginTop: 20, padding: '0 16px', lineHeight: '38px', background: '#0f9fe0', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Edit Snippet</button>
            {snippetEdit && (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Title <span style={{ fontWeight: 400, fontSize: 13, color: titleCharCount > 60 ? '#d63638' : '#646970' }}>{titleCharCount} / 60 · ~{titlePixelWidth}px</span></label>
                  <input type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={effectiveTitle} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '8px 10px', fontSize: 15 }} />
                </div>
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Description <span style={{ fontWeight: 400, fontSize: 13, color: descCharCount > 160 ? '#d63638' : '#646970' }}>{descCharCount} / 160</span></label>
                  <textarea rows={3} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '8px 10px', fontSize: 15 }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #dcdcde', padding: '24px 26px 20px' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1e1e1e', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>Focus Keyword {helpDot('Add the keywords you want this post to rank for. The first one is the primary focus keyword.')}</div>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #8c8f94', background: '#fff', minHeight: 52 }}>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 10px' }}>
                {kwList.map((k, i) => (
                  <span key={k} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 18, background: i === 0 ? '#7ad28a' : '#fde8cd', color: i === 0 ? '#fff' : '#f59e0b', fontSize: 16 }}>
                    <button type="button" aria-label={`Remove ${k}`} onClick={() => removeKeyword(k)} style={{ position: 'absolute', left: -6, top: -9, width: 18, height: 18, borderRadius: '50%', border: '1px solid #dcdcde', background: '#fff', color: '#50575e', fontSize: 10, lineHeight: '16px', padding: 0, cursor: 'pointer' }}>✕</button>
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
                  style={{ flex: 1, minWidth: 160, border: 'none', outline: 'none', fontSize: 15, color: '#50575e' }}
                />
              </div>
              {true && <div title={scoreTip} style={{ display: 'flex', alignItems: 'center', padding: '0 22px', background: scoreBg, color: scoreColor, fontWeight: 600, fontSize: 16 }}>{seoScore} / 100</div>}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, fontSize: 15, fontWeight: 600, color: '#1e1e1e' }}>
              <input type="checkbox" checked={isCornerstone} onChange={(e) => setIsCornerstone(e.target.checked)} style={{ width: 20, height: 20, margin: 0 }} /> This post is Pillar Content {helpDot('Pillar content is your most important, in-depth article on a topic. Other posts get link suggestions that point to it.')}
            </label>
          </div>

          <div>{sections.map(checkGroup)}</div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, fontSize: 15 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Robots Meta</div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} /> Index</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} /> Follow</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={sitemapInclude} onChange={(e) => setSitemapInclude(e.target.checked)} /> Include in XML sitemap</label>
          </div>
          <div>
            <label htmlFor="mf-canonical" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Canonical URL</label>
            <input id="mf-canonical" type="url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '8px 10px', fontSize: 15 }} />
            <p style={{ fontSize: 14, color: '#646970', margin: '6px 0 0' }}>The canonical URL informs search engines which version of this page is the preferred one. Leave it empty to use the post URL.</p>
          </div>
          <div>
            <label htmlFor="mf-breadcrumb" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Breadcrumb Title</label>
            <input id="mf-breadcrumb" type="text" value={breadcrumbTitle} onChange={(e) => setBreadcrumbTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '8px 10px', fontSize: 15 }} />
          </div>
          <div>
            <label htmlFor="mf-h1" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Custom H1</label>
            <input id="mf-h1" type="text" value={customH1} onChange={(e) => setCustomH1(e.target.value)} placeholder="Leave empty to use the post title" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', padding: '8px 10px', fontSize: 15 }} />
          </div>
        </div>
      )}

      <div style={{ padding: activeTab === 'schema' || activeTab === 'social' ? 16 : 0 }}>
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
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#3858e9', margin: '0 0 8px' }}>
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
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#3858e9', margin: '0 0 8px' }}>
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
                  <div style={{ fontSize: '0.7rem', color: '#50575e', textTransform: 'uppercase' }}>{SITE_HOST}</div>
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


      </div>
    </>
  );

  const mainBoxes: Record<string, React.ReactNode> = {
    rankmath: box('main', 'rankmath', 'Rank Math SEO', rankMathBox, { flush: true }),
    revisions: postId ? box('main', 'revisions', 'Revisions', (
      <div style={{ padding: '10px 14px 14px' }}>
        <RevisionsPanel postId={postId} onRestore={(p) => { applyPayload(p); setStatusMessage('Revision loaded into the editor. Click Update to keep it.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>
    ), { flush: true }) : null,
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1e1e1e' }}>
      <style>{`.mf-scroll::-webkit-scrollbar{width:16px}.mf-scroll::-webkit-scrollbar-thumb{background:#8e8e8e;border-radius:10px;border:4px solid #fff}.mf-scroll::-webkit-scrollbar-track{background:#fff}`}</style>
      <h1 style={{ fontSize: 23, fontWeight: 400, margin: '0 0 16px', padding: '9px 0 4px', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 12 }}>
        {isNew ? 'Add Post' : 'Edit Post'}
        {!isNew && <Link href="/seo-admin/blog/new" style={{ fontSize: 14, fontWeight: 600, padding: '6px 14px', border: `1px solid ${BLUE}`, borderRadius: 3, color: BLUE, textDecoration: 'none', background: '#fff', lineHeight: 1.2 }}>Add Post</Link>}
      </h1>

      {[
        lockedBy && { kind: 'error', node: <>{lockedBy.name} is editing this post right now, so saving is turned off for you. {lockedBy.canTakeOver && <button type="button" onClick={() => acquireLock(true)} style={{ marginLeft: 8, padding: '2px 10px', border: `1px solid ${BLUE}`, background: '#fff', color: BLUE, borderRadius: 3, cursor: 'pointer' }}>Take over</button>}</> },
        restoreOffer && { kind: 'warning', node: <>An unsaved autosaved version from {new Date(restoreOffer.saved_at || restoreOffer.updated_at || Date.now()).toLocaleString()} was found. <button type="button" onClick={() => { applyPayload(restoreOffer.snapshot); setRestoreOffer(null); }} style={{ marginLeft: 8, padding: '2px 10px', border: `1px solid ${BLUE}`, background: '#fff', color: BLUE, borderRadius: 3, cursor: 'pointer' }}>Restore</button> <button type="button" onClick={() => setRestoreOffer(null)} style={{ padding: '2px 10px', border: '1px solid #c3c4c7', background: '#fff', borderRadius: 3, cursor: 'pointer' }}>Dismiss</button></> },
        conflict !== null && { kind: 'error', node: <>Someone else updated this post after you opened it. <button type="button" onClick={() => { setConflict(null); handleSaveDraft(true); }} style={{ marginLeft: 8, padding: '2px 10px', border: '1px solid #d63638', background: '#fff', color: '#d63638', borderRadius: 3, cursor: 'pointer' }}>Overwrite</button> <button type="button" onClick={() => { savedKey.current = payloadKey; window.location.reload(); }} style={{ padding: '2px 10px', border: '1px solid #c3c4c7', background: '#fff', borderRadius: 3, cursor: 'pointer' }}>Reload</button></> },
        statusMessage && { kind: /^Error|disabled|Could not/i.test(statusMessage) ? 'error' : 'success', node: statusMessage },
      ].filter(Boolean).map((n: any, i) => (
        <div key={i} role="status" style={{ background: '#fff', border: '1px solid #c3c4c7', borderLeft: `4px solid ${n.kind === 'error' ? '#d63638' : n.kind === 'warning' ? '#dba617' : '#00a32a'}`, boxShadow: '0 1px 1px rgba(0,0,0,.04)', margin: '0 0 12px', padding: '10px 12px', fontSize: 14 }}>{n.node}</div>
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
              style={{ width: '100%', fontSize: '1.7em', padding: '3px 8px', lineHeight: 1.9, border: '1px solid #8c8f94', borderRadius: 0, outline: 'none', boxSizing: 'border-box', color: '#1e1e1e', background: '#fff', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.07)' }}
            />
            {(title || slug || initialPost?.legacy_path) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, color: '#50575e', flexWrap: 'wrap', minHeight: 28 }}>
                <strong>Permalink:</strong>
                {initialPost?.legacy_path ? (
                  <a style={{ color: BLUE, textDecoration: 'underline' }}>{pubUrl}</a>
                ) : slugEditing ? (
                  <>
                    <span>{SITE_URL}/blog/</span>
                    <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} style={{ border: '1px solid #8c8f94', padding: '1px 6px', fontSize: 14 }} />
                    <span>/</span>
                    <button type="button" onClick={() => setSlugEditing(false)} style={{ ...outBtn, lineHeight: '24px', minHeight: 26, padding: '0 10px', fontSize: 13 }}>OK</button>
                  </>
                ) : (
                  <>
                    <a style={{ color: BLUE, textDecoration: 'underline' }}>{SITE_URL}/blog/<strong>{slug}</strong>/</a>
                    <button type="button" onClick={() => setSlugEditing(true)} style={{ ...outBtn, lineHeight: '24px', minHeight: 26, padding: '0 10px', fontSize: 13 }}>Edit</button>
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
              {editorMode === 'blocks' && (
                <button type="button" onClick={switchMode} style={{ border: 'none', background: 'none', color: BLUE, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0 }}>Switch to classic editor</button>
              )}
            </div>
          </div>

          {order.main.map((id) => mainBoxes[id] ?? null)}
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {order.side.map((id) => sideBoxes[id] ?? null)}
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
                    background: '#3858e9',
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

/** WordPress-style postbox: bordered white box, heading row with move up / move down / collapse controls. */
function MetaBox({ title, children, flush, id, onUp, onDown, defaultOpen = true }: { title: string; children: React.ReactNode; flush?: boolean; id?: string; onUp?: () => void; onDown?: () => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ctl: React.CSSProperties = { width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#3c434a', padding: 0 };
  return (
    <div id={id} style={{ background: '#fff', border: '1px solid #c3c4c7', boxShadow: '0 1px 1px rgba(0,0,0,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, borderBottom: open ? '1px solid #c3c4c7' : 'none', minHeight: 46 }}>
        <h2 onClick={() => setOpen((v) => !v)} style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: '#1e1e1e', flex: 1, cursor: 'pointer', padding: '10px 0' }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button type="button" aria-label={'Move ' + title + ' up'} onClick={onUp} style={ctl}><Chevron up /></button>
          <button type="button" aria-label={'Move ' + title + ' down'} onClick={onDown} style={ctl}><Chevron /></button>
          <button type="button" aria-label={open ? 'Collapse ' + title : 'Expand ' + title} aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ ...ctl, width: 30, color: '#787c82' }}><span aria-hidden style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span></button>
        </div>
      </div>
      {open && <div style={flush ? undefined : { padding: '6px 12px 12px' }}>{children}</div>}
    </div>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const ico = { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
function IconPin() { return <svg {...ico} style={{ flex: 'none' }}><path d="M14 3l7 7-2 2-1.5-1.5-3.8 3.8.8 4.2-1.6 1.6-3.4-3.4L4 21l-1-1 5.3-5.3-3.4-3.4L6.5 9.7l4.2.8 3.8-3.8L13 5.2 14 3z" fill="#1e1e1e" /></svg>; }
function IconEye() { return <svg {...ico} style={{ flex: 'none' }}><path d="M12 5C6.5 5 2.7 9 1 12c1.7 3 5.5 7 11 7s9.3-4 11-7c-1.7-3-5.5-7-11-7zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" fill="#1e1e1e" /></svg>; }
function IconClock() { return <svg {...ico} style={{ flex: 'none' }}><path d="M12 3a9 9 0 11-8.5 6H1l3.5-4L8 9H5.6A7 7 0 1012 5v2h-1V4.5l1-.5zm-1 5h1.5v4.2l3 1.8-.8 1.3L11 13V8z" fill="#1e1e1e" /></svg>; }
function IconCal() { return <svg {...ico} style={{ flex: 'none' }}><path d="M5 4h2V2h2v2h6V2h2v2h2a1 1 0 011 1v15a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm0 5v10h14V9H5zm2 2h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2z" fill="#1e1e1e" /></svg>; }
function IconBars() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}><path d="M3 19l4-6 3 3 4-8 3 4 4-6v13H3z" fill="currentColor" /></svg>; }
function IconGear() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.4 5.1l1.8 1.4-2 3.4-2.1-.8a7 7 0 01-1.5.9L16.2 20H12.2l-.4-2.3a7 7 0 01-1.5-.9l-2.1.8-2-3.4 1.8-1.4a7 7 0 010-1.8L6.2 9.6l2-3.4 2.1.8a7 7 0 011.5-.9L12.2 4h4l.4 2.1a7 7 0 011.5.9l2.1-.8 2 3.4-1.8 1.4a7 7 0 010 1.8z" transform="translate(-2 0) scale(.92)" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>; }
function IconBriefcase() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5V4h6v1M3 7h18v12H3zM3 12h18" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function IconSchema() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v14H3zM3 18l3 3h12l3-3M8 9h8M8 13h5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function IconShare() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="6" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="18" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.6" /></svg>; }
