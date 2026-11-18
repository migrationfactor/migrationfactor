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
import { WorkflowActions, RevisionsPanel, LinksPanel, SchemaPanel, ReferencesPanel } from './PostWorkflow';

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
  const [activeTab, setActiveTab] = useState<'post' | 'seo' | 'social' | 'schema' | 'geo' | 'aeo' | 'indexing' | 'links' | 'history'>('seo');
  const [serpPreviewDevice, setSerpPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('All changes saved');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [prepublishResult, setPrepublishResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [minorUpdate, setMinorUpdate] = useState(false);

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

  const handleSaveDraft = async (force = false): Promise<boolean> => {
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

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar (Section 16.2) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff',
          padding: '14px 24px',
          borderRadius: 12,
          border: '1px solid #cfe3e3',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/seo-admin/blog" style={{ color: '#0b666a', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
            ← All Posts
          </Link>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              backgroundColor: status === 'published' ? '#d4efec' : '#e9f3f3',
              color: status === 'published' ? '#0b666a' : '#3d5557',
            }}
          >
            {status}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b8183' }}>{saveStatus}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {postId && (
            <Link
              href={`/preview/${postId}`}
              target="_blank"
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid #b9d3d4',
                color: '#042628',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              👁️ Preview
            </Link>
          )}

          <button
            onClick={() => handleSaveDraft()}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: '#e9f3f3',
              color: '#042628',
              border: '1px solid #b9d3d4',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          {status === 'published' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: '0.8rem', color: '#3d5557', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={minorUpdate}
                  onChange={(e) => setMinorUpdate(e.target.checked)}
                />
                Minor update
              </label>
              <button
                onClick={() => handleSaveDraft()}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#0b666a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Update Live
              </button>
            </div>
          ) : (
            <button
              onClick={handleInitiatePublish}
              disabled={publishing || isNew}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: isNew ? '#6b8183' : '#0b666a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: isNew ? 'not-allowed' : 'pointer',
              }}
            >
              Publish Post
            </button>
          )}
        </div>
      </div>

      {lockedBy && (
        <div role="alert" style={{ padding: '12px 16px', background: '#fdecee', border: '1px solid #e8b4ba', borderRadius: 8, fontSize: '0.875rem', color: '#6b1020', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {lockedBy.name} is editing this post right now, so saving is turned off for you.
          {lockedBy.canTakeOver && <button type="button" onClick={() => acquireLock(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #a01b2b', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Take over</button>}
        </div>
      )}
      {restoreOffer && (
        <div style={{ padding: '12px 16px', background: '#fff8e1', border: '1px solid #f0d890', borderRadius: 8, fontSize: '0.875rem', color: '#5c4400', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          An unsaved autosaved version from {new Date(restoreOffer.saved_at || restoreOffer.updated_at || Date.now()).toLocaleString()} was found.
          <button type="button" onClick={() => { applyPayload(restoreOffer.snapshot); setRestoreOffer(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #0b666a', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Restore it</button>
          <button type="button" onClick={() => setRestoreOffer(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cfe3e3', background: '#fff', cursor: 'pointer' }}>Discard</button>
        </div>
      )}
      {conflict !== null && (
        <div role="alertdialog" style={{ padding: '12px 16px', background: '#fdecee', border: '1px solid #e8b4ba', borderRadius: 8, fontSize: '0.875rem', color: '#6b1020', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          Someone else saved a newer version of this post. Overwrite it with yours, or reload their version?
          <button type="button" onClick={() => { setConflict(null); handleSaveDraft(true); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #a01b2b', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Overwrite with mine</button>
          <button type="button" onClick={() => { savedKey.current = payloadKey; window.location.reload(); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cfe3e3', background: '#fff', cursor: 'pointer' }}>Reload theirs</button>
        </div>
      )}
      {statusMessage && (
        <div style={{ padding: '12px 16px', background: '#e9f3f3', border: '1px solid #d4efec', borderRadius: 8, color: '#07484b', fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      {/* 2-Column Editor Layout (Main Content + Right Sidebar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        {/* Main Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Title, permalink and editor (WordPress classic layout) */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              aria-label="Post title"
              style={{ width: '100%', fontSize: '1.7rem', padding: '3px 10px', lineHeight: 1.9, border: '1px solid #8c8f94', borderRadius: 4, outline: 'none', boxSizing: 'border-box', color: '#1d2327', background: '#fff' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.8125rem', color: '#50575e', flexWrap: 'wrap', minHeight: 28 }}>
              <strong>Permalink:</strong>
              {initialPost?.legacy_path ? (
                <span style={{ color: '#2271b1' }}>https://migrationfactor.com{initialPost.legacy_path}</span>
              ) : slugEditing ? (
                <>
                  <span>https://migrationfactor.com/blog/</span>
                  <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} style={{ border: '1px solid #8c8f94', borderRadius: 3, padding: '2px 6px', fontFamily: 'monospace' }} />
                  <span>/</span>
                  <button type="button" onClick={() => setSlugEditing(false)} style={{ padding: '2px 10px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontWeight: 600, cursor: 'pointer' }}>OK</button>
                </>
              ) : (
                <>
                  <a style={{ color: '#2271b1' }}>https://migrationfactor.com/blog/<strong>{slug || 'your-post-title'}</strong>/</a>
                  <button type="button" onClick={() => setSlugEditing(true)} style={{ padding: '1px 10px', border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                </>
              )}
              <button type="button" onClick={switchMode} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#2271b1', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem' }}>
                {editorMode === 'classic' ? 'Switch to block editor' : 'Switch to classic editor'}
              </button>
            </div>
          </div>

          <div>
            {editorMode === 'classic' ? (
              <ClassicEditor value={classicHtml} onChange={setClassicHtml} resetKey={`${postId || 'new'}-${editorKey}`} pickMedia={pickMedia} notify={setStatusMessage} />
            ) : (
              <div style={{ background: '#ffffff', padding: 16, borderRadius: 4, border: '1px solid #c3c4c7' }}>
                <BlockEditor
                  value={blocks}
                  onChange={setBlocks}
                  resetKey={`${postId || 'new'}-${editorKey}`}
                  canRawHtml={canRawHtml}
                  focusKeyword={focusKeyword}
                  pickMedia={pickMedia}
                  notify={setStatusMessage}
                />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginTop: 8, background: '#f6f7f7', border: '1px solid #c3c4c7', fontSize: '0.8125rem', color: '#50575e' }}>
              <span>Words: <strong>{wordCount}</strong></span>
              <span>Reading time: <strong>~{readingTimeMin} min</strong></span>
              <span>Headings: <strong>{headings.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sticky Score Summary Row (Section 16.2) */}
          <div
            style={{
              background: '#042628',
              color: '#ffffff',
              padding: '14px 16px',
              borderRadius: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <div
              onClick={() => setActiveTab('seo')}
              style={{ cursor: 'pointer', padding: 4, borderRadius: 6, background: activeTab === 'seo' ? '#07484b' : 'transparent' }}
            >
              <div style={{ fontSize: '0.6875rem', color: '#6b8183', textTransform: 'uppercase', fontWeight: 700 }}>SEO</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: liveAnalysis.overallScore >= 80 ? '#4ade80' : liveAnalysis.overallScore >= 50 ? '#fde047' : '#b4424f' }}>
                {liveAnalysis.overallScore}
              </div>
            </div>

            <div
              onClick={() => setActiveTab('seo')}
              style={{ cursor: 'pointer', padding: 4, borderRadius: 6, background: activeTab === 'seo' ? '#07484b' : 'transparent' }}
            >
              <div style={{ fontSize: '0.6875rem', color: '#6b8183', textTransform: 'uppercase', fontWeight: 700 }}>Read</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#35b5ac' }}>
                {liveAnalysis.readabilityScore}
              </div>
            </div>

            <div
              onClick={() => setActiveTab('geo')}
              style={{ cursor: 'pointer', padding: 4, borderRadius: 6, background: activeTab === 'geo' ? '#07484b' : 'transparent' }}
            >
              <div style={{ fontSize: '0.6875rem', color: '#6b8183', textTransform: 'uppercase', fontWeight: 700 }}>GEO</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#35b5ac' }}>
                {liveAnalysis.geoScore}
              </div>
            </div>

            <div
              onClick={() => setActiveTab('aeo')}
              style={{ cursor: 'pointer', padding: 4, borderRadius: 6, background: activeTab === 'aeo' ? '#07484b' : 'transparent' }}
            >
              <div style={{ fontSize: '0.6875rem', color: '#6b8183', textTransform: 'uppercase', fontWeight: 700 }}>AEO</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#35b5ac' }}>
                {liveAnalysis.aeoScore}
              </div>
            </div>
          </div>

          {/* Sidebar Tab Buttons */}
          <div style={{ display: 'flex', background: '#cfe3e3', borderRadius: 8, padding: 3, gap: 2, overflowX: 'auto' }}>
            {[
              { id: 'post', label: 'Post' },
              { id: 'seo', label: 'SEO' },
              { id: 'social', label: 'Social' },
              { id: 'schema', label: 'Schema' },
              { id: 'geo', label: 'GEO' },
              { id: 'aeo', label: 'AEO' },
              { id: 'indexing', label: 'Indexing' },
              { id: 'links', label: 'Links' },
              { id: 'history', label: 'History' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  backgroundColor: activeTab === t.id ? '#ffffff' : 'transparent',
                  color: activeTab === t.id ? '#0b666a' : '#3d5557',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: POST SETTINGS */}
          {activeTab === 'post' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {postId && (
                <WorkflowActions
                  postId={postId}
                  status={status}
                  canPublish={roles.some((r) => ['super_admin', 'admin', 'seo_manager', 'editor'].includes(r))}
                  canDelete={roles.some((r) => ['super_admin', 'admin', 'seo_manager', 'editor'].includes(r))}
                  onMessage={setStatusMessage}
                  onStatus={setStatus}
                  ensureSaved={async () => (dirty ? handleSaveDraft() : true)}
                />
              )}
              {/* Primary Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Primary Category *
                </label>
                <select
                  value={primaryCategoryId}
                  onChange={(e) => setPrimaryCategoryId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', background: '#ffffff' }}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Authors Multi-select */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Authors (Ordered) *
                </label>
                <select
                  multiple
                  value={selectedAuthorIds}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setSelectedAuthorIds(opts);
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', minHeight: 80, background: '#ffffff' }}
                >
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name} ({a.job_title || 'Specialist'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>Tags</label>
                <select multiple value={tagIds} onChange={(e) => setTagIds(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', minHeight: 80, background: '#ffffff' }}>
                  {tags.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>Reviewed by (expert reviewer)</label>
                <select value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', background: '#ffffff' }}>
                  <option value="">Not reviewed</option>
                  {authors.filter((a: any) => a.is_reviewer).map((a: any) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              </div>

              {/* Featured Image */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Featured Image URL *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => { const m = await pickMedia(); if (m) { setFeaturedMediaId(m.id); setFeaturedImageUrl(m.url); if (m.alt && !featuredAlt) setFeaturedAlt(m.alt); } }}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #0b666a', background: '#fff', color: '#0b666a', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {featuredImageUrl ? 'Replace image' : 'Choose / upload image'}
                  </button>
                  {featuredImageUrl && (
                    <button type="button" onClick={() => { setFeaturedMediaId(''); setFeaturedImageUrl(''); }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cfe3e3', background: '#fff', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
                {featuredImageUrl && (
                  <div style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', height: 120 }}>
                    <img src={featuredImageUrl} alt="Featured preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#3d5557', marginBottom: 2 }}>
                    Featured Image Alt Text * (Required)
                  </label>
                  <input
                    type="text"
                    value={featuredAlt}
                    onChange={(e) => setFeaturedAlt(e.target.value)}
                    placeholder="Descriptive alt text describing the image"
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Excerpt (Summary)
                </label>
                <textarea
                  rows={3}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Short post summary for listings and fallback meta description..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: SEO (Rank Math inspired) */}
          {activeTab === 'seo' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Focus Keyword */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Focus Keyword *
                </label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g. skills in demand visa"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '2px solid #0b666a',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#042628',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 6 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#3d5557', marginBottom: 2 }}>
                    Additional Keywords (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={additionalKeywords}
                    onChange={(e) => setAdditionalKeywords(e.target.value)}
                    placeholder="e.g. skills in demand visa requirements, employer sponsorship australia"
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Live Google SERP Preview (Desktop / Mobile) */}
              <div style={{ background: '#f2f8f8', padding: 14, borderRadius: 8, border: '1px solid #cfe3e3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3d5557', textTransform: 'uppercase' }}>
                    Google SERP Snippet Preview
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setSerpPreviewDevice('desktop')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: serpPreviewDevice === 'desktop' ? '#042628' : '#cfe3e3',
                        color: serpPreviewDevice === 'desktop' ? '#ffffff' : '#3d5557',
                        cursor: 'pointer',
                      }}
                    >
                      Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setSerpPreviewDevice('mobile')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: serpPreviewDevice === 'mobile' ? '#042628' : '#cfe3e3',
                        color: serpPreviewDevice === 'mobile' ? '#ffffff' : '#3d5557',
                        cursor: 'pointer',
                      }}
                    >
                      Mobile
                    </button>
                  </div>
                </div>

                {/* Google Snippet Representation */}
                <div style={{ fontFamily: 'arial, sans-serif', fontSize: '0.875rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#202124', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#5f6368' }}>https://migrationfactor.com &gt; blog &gt; {slug || '...'}</span>
                  </div>
                  <div style={{ color: '#1a0dab', fontSize: '1.15rem', fontWeight: 500, lineHeight: 1.3, marginTop: 2, cursor: 'pointer' }}>
                    {effectiveTitle}
                  </div>
                  <div style={{ color: '#4d5156', fontSize: '0.85rem', lineHeight: 1.4, marginTop: 4 }}>
                    {effectiveDesc || 'Please provide a meta description for this article to help Google display an accurate summary in search results.'}
                  </div>
                </div>
              </div>

              {/* Edit SEO Snippet Inputs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#042628' }}>
                    SEO Title Tag
                  </label>
                  <span style={{ fontSize: '0.75rem', color: titleCharCount > 60 ? '#a01b2b' : titleCharCount >= 30 ? '#0b666a' : '#d97706' }}>
                    {titleCharCount} chars · ~{titlePixelWidth}px / 580px
                  </span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Defaults to Post Title - Migration Factor"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#042628' }}>
                    Meta Description
                  </label>
                  <span style={{ fontSize: '0.75rem', color: descCharCount > 160 ? '#a01b2b' : descCharCount >= 120 ? '#0b666a' : '#d97706' }}>
                    {descCharCount} / 160 chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Concise, compelling description containing focus keyword..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Checklist Breakdown Groups (Rank Math style) */}
              <div style={{ marginTop: 8 }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#042628', marginBottom: 10 }}>
                  Rank Math Inspired Checks
                </h3>

                {/* Basic SEO Accordion */}
                <details open style={{ marginBottom: 10, border: '1px solid #cfe3e3', borderRadius: 6, padding: 8 }}>
                  <summary style={{ fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', color: '#0b666a' }}>
                    Basic SEO ({liveAnalysis.checks.basic.filter(c => c.status === 'passed').length} / {liveAnalysis.checks.basic.length} passed)
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveAnalysis.checks.basic.map(chk => (
                      <div key={chk.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem', padding: '4px 0' }}>
                        <span>{chk.status === 'passed' ? '🟢' : chk.status === 'needs_improvement' ? '🟡' : '🔴'}</span>
                        <div>
                          <strong>{chk.name}:</strong> <span style={{ color: '#3d5557' }}>{chk.message}</span>
                          {chk.status !== 'passed' && chk.fixAdvice && (
                            <div style={{ color: '#0b666a', marginTop: 2, fontStyle: 'italic' }}>Tip: {chk.fixAdvice}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Additional SEO Accordion */}
                <details style={{ marginBottom: 10, border: '1px solid #cfe3e3', borderRadius: 6, padding: 8 }}>
                  <summary style={{ fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', color: '#0b666a' }}>
                    Additional SEO ({liveAnalysis.checks.additional.filter(c => c.status === 'passed').length} / {liveAnalysis.checks.additional.length} passed)
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveAnalysis.checks.additional.map(chk => (
                      <div key={chk.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem', padding: '4px 0' }}>
                        <span>{chk.status === 'passed' ? '🟢' : chk.status === 'needs_improvement' ? '🟡' : '🔴'}</span>
                        <div>
                          <strong>{chk.name}:</strong> <span style={{ color: '#3d5557' }}>{chk.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Readability Accordion */}
                <details style={{ marginBottom: 10, border: '1px solid #cfe3e3', borderRadius: 6, padding: 8 }}>
                  <summary style={{ fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', color: '#0b666a' }}>
                    Readability ({liveAnalysis.checks.readability.filter(c => c.status === 'passed').length} / {liveAnalysis.checks.readability.length} passed)
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveAnalysis.checks.readability.map(chk => (
                      <div key={chk.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem', padding: '4px 0' }}>
                        <span>{chk.status === 'passed' ? '🟢' : chk.status === 'needs_improvement' ? '🟡' : '🔴'}</span>
                        <div>
                          <strong>{chk.name}:</strong> <span style={{ color: '#3d5557' }}>{chk.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Technical SEO Accordion */}
                <details style={{ border: '1px solid #cfe3e3', borderRadius: 6, padding: 8 }}>
                  <summary style={{ fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', color: '#0b666a' }}>
                    Technical SEO ({liveAnalysis.checks.technical.filter(c => c.status === 'passed').length} / {liveAnalysis.checks.technical.length} passed)
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveAnalysis.checks.technical.map(chk => (
                      <div key={chk.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem', padding: '4px 0' }}>
                        <span>{chk.status === 'passed' ? '🟢' : chk.status === 'needs_improvement' ? '🟡' : '🔴'}</span>
                        <div>
                          <strong>{chk.name}:</strong> <span style={{ color: '#3d5557' }}>{chk.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* Advanced Directives Toggle */}
              <details style={{ marginTop: 12, borderTop: '1px solid #cfe3e3', paddingTop: 10 }}>
                <summary style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#3d5557', cursor: 'pointer' }}>
                  Advanced Robots & Canonical Settings
                </summary>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                    <input type="checkbox" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} />
                    Index this post (Uncheck for noindex)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                    <input type="checkbox" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} />
                    Follow links (Uncheck for nofollow)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                    <input type="checkbox" checked={sitemapInclude} onChange={(e) => setSitemapInclude(e.target.checked)} />
                    Include in XML Sitemap
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}>
                    <input type="checkbox" checked={isCornerstone} onChange={(e) => setIsCornerstone(e.target.checked)} />
                    Mark as Cornerstone Content
                  </label>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#3d5557', marginBottom: 2 }}>
                      Canonical URL Override
                    </label>
                    <input
                      type="url"
                      value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)}
                      placeholder="Leave blank for self-canonical"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#3d5557', marginBottom: 2 }}>
                      Custom H1 (if different from title)
                    </label>
                    <input
                      type="text"
                      value={customH1}
                      onChange={(e) => setCustomH1(e.target.value)}
                      placeholder="Custom H1 heading"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* TAB 3: SOCIAL */}
          {activeTab === 'social' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#042628' }}>
                <input type="checkbox" checked={useSeoValues} onChange={(e) => setUseSeoValues(e.target.checked)} />
                Use SEO Title and Meta Description for Social
              </label>

              {!useSeoValues && (
                <>
                  <div style={{ borderTop: '1px solid #cfe3e3', paddingTop: 12 }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0b666a', margin: '0 0 8px' }}>
                      Facebook / Open Graph Custom Overrides
                    </h4>
                    <input
                      type="text"
                      value={ogTitle}
                      onChange={(e) => setOgTitle(e.target.value)}
                      placeholder="Custom OG Title"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', marginBottom: 6, boxSizing: 'border-box' }}
                    />
                    <textarea
                      rows={2}
                      value={ogDescription}
                      onChange={(e) => setOgDescription(e.target.value)}
                      placeholder="Custom OG Description"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ borderTop: '1px solid #cfe3e3', paddingTop: 12 }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0b666a', margin: '0 0 8px' }}>
                      X / Twitter Custom Overrides
                    </h4>
                    <input
                      type="text"
                      value={twitterTitle}
                      onChange={(e) => setTwitterTitle(e.target.value)}
                      placeholder="Custom Twitter Title"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', marginBottom: 6, boxSizing: 'border-box' }}
                    />
                    <textarea
                      rows={2}
                      value={twitterDescription}
                      onChange={(e) => setTwitterDescription(e.target.value)}
                      placeholder="Custom Twitter Description"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}

              {/* Social Preview Representation */}
              <div style={{ border: '1px solid #b9d3d4', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
                {featuredImageUrl && (
                  <div style={{ height: 140, backgroundColor: '#e9f3f3' }}>
                    <img src={featuredImageUrl} alt="Social Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 12, background: '#f2f8f8' }}>
                  <div style={{ fontSize: '0.7rem', color: '#3d5557', textTransform: 'uppercase' }}>migrationfactor.com</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#042628', marginTop: 2 }}>
                    {(!useSeoValues && ogTitle) ? ogTitle : effectiveTitle}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3d5557', marginTop: 2 }}>
                    {(!useSeoValues && ogDescription) ? ogDescription : effectiveDesc}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEMA */}
          {activeTab === 'schema' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {postId && <SchemaPanel postId={postId} refreshKey={saveStatus} />}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Article Schema Type
                </label>
                <select
                  value={articleType}
                  onChange={(e) => setArticleType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', background: '#ffffff' }}
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
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Custom Schema JSON-LD (Advanced)
                </label>
                <textarea
                  rows={5}
                  value={customJsonLd}
                  onChange={(e) => setCustomJsonLd(e.target.value)}
                  placeholder="{ '@type': 'SpecialItem', ... }"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontFamily: 'monospace', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 5: GEO */}
          {activeTab === 'geo' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ReferencesPanel value={references} onChange={setReferences} trusted={['homeaffairs.gov.au', 'immi.homeaffairs.gov.au', 'legislation.gov.au', 'abs.gov.au']} />
              <div style={{ background: '#e9f3f3', border: '1px solid #ddd6fe', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#07484b' }}>
                <strong>Generative Engine Optimization (GEO):</strong> Optimizes for AI overview engines (ChatGPT Search, Perplexity, Google SGE) by asserting structured entities and factual references.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Primary Question Targeted
                </label>
                <input
                  type="text"
                  value={primaryQuestion}
                  onChange={(e) => setPrimaryQuestion(e.target.value)}
                  placeholder="e.g. What are the requirements for Skills in Demand visa?"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Concise Answer Summary (40–60 words)
                </label>
                <textarea
                  rows={3}
                  value={answerSummary}
                  onChange={(e) => setAnswerSummary(e.target.value)}
                  placeholder="Direct, factual answer for AI summary snippets..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Primary Entity Name
                </label>
                <input
                  type="text"
                  value={primaryEntityName}
                  onChange={(e) => setPrimaryEntityName(e.target.value)}
                  placeholder="e.g. Skills in Demand visa"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Official Entity Authority URL (sameAs)
                </label>
                <input
                  type="url"
                  value={primaryEntityUrl}
                  onChange={(e) => setPrimaryEntityUrl(e.target.value)}
                  placeholder="https://immi.homeaffairs.gov.au/..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* TAB 6: AEO */}
          {activeTab === 'aeo' && (
            <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#e9f3f3', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#07484b' }}>
                <strong>Answer Engine Optimization (AEO):</strong> Evaluates answer structure, question-based H2/H3 headings, and direct answer speed.
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#042628', marginBottom: 8 }}>
                  Question Outline Inspector ({headings.filter(h => h.text.includes('?') || /^(what|how|who|can|is|why)/i.test(h.text)).length} question headings)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {headings.map((h, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#f2f8f8', borderRadius: 4 }}>
                      <span style={{ fontWeight: 700, color: '#0b666a' }}>H{h.level}:</span> {h.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (postId ? <LinksPanel postId={postId} /> : <div style={{ fontSize: '0.8125rem', color: '#3d5557' }}>Save the post first.</div>)}
          {activeTab === 'history' && (postId ? <RevisionsPanel postId={postId} onRestore={(p) => { applyPayload(p); setStatusMessage('Revision loaded into the editor. Click Save to keep it.'); setActiveTab('post'); }} /> : <div style={{ fontSize: '0.8125rem', color: '#3d5557' }}>Save the post first.</div>)}

          {/* TAB 7: INDEXING */}
          {activeTab === 'indexing' && (postId ? <IndexingPanel postId={postId} published={status === 'published'} /> : <div style={{ fontSize: '0.8125rem', color: '#3d5557' }}>Save the post first.</div>)}
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
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#042628', margin: '0 0 12px' }}>
              Pre-Publish Verification Checks
            </h2>

            {/* Blocking Errors */}
            {prepublishResult.blocking?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#a01b2b', fontSize: '0.875rem', marginBottom: 6 }}>
                  ❌ Blocking Errors (Must fix before publishing):
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#7a1f2b' }}>
                  {prepublishResult.blocking.map((b: any, i: number) => (
                    <li key={i}>{b.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {prepublishResult.warnings?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#8a5a00', fontSize: '0.875rem', marginBottom: 6 }}>
                  ⚠️ Warnings (Recommended to review):
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#6b4500' }}>
                  {prepublishResult.warnings.map((w: any, i: number) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #cfe3e3', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #b9d3d4',
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
                    background: '#0b666a',
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
