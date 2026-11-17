'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { runContentAnalysis, calculateFleschScore, calculatePixelWidth } from '@/lib/seo-system/analysis';
import { renderBlocksToHtml } from '@/lib/seo-system/sanitizer';
import IndexingPanel from './IndexingPanel';

interface PostEditorProps {
  initialPost?: any;
  categories: any[];
  authors: any[];
  currentUser: any;
}

export default function PostEditor({
  initialPost,
  categories,
  authors,
  currentUser,
}: PostEditorProps) {
  const router = useRouter();
  const postId = initialPost?.id;
  const isNew = !postId;

  // Basic post fields
  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [status, setStatus] = useState(initialPost?.status || 'draft');
  const [contentMarkdown, setContentMarkdown] = useState(() => {
    if (initialPost?.body_json?.blocks) {
      // Reconstitute from blocks
      return initialPost.body_json.blocks
        .map((b: any) => {
          if (b.type === 'heading') return `${'#'.repeat(b.data?.level || 2)} ${b.data?.text || ''}`;
          if (b.type === 'paragraph') return b.data?.text || '';
          if (b.type === 'quote') return `> ${b.data?.text || ''}`;
          return b.data?.text || '';
        })
        .join('\n\n');
    }
    return '';
  });

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
  const [references, setReferences] = useState<any[]>(initialPost?.references || []);

  // Editor states
  const [activeTab, setActiveTab] = useState<'post' | 'seo' | 'social' | 'schema' | 'geo' | 'aeo' | 'indexing'>('seo');
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

  // Convert markdown-like content to blocks for rendering and analysis
  const currentBlocks = useMemo(() => {
    const lines = contentMarkdown.split('\n\n');
    const blocks: any[] = [];

    for (const paragraph of lines) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        // Enforce FR-EDT-002: H1 converted to H2!
        blocks.push({ type: 'heading', data: { level: 2, text: trimmed.replace(/^#\s+/, '') } });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({ type: 'heading', data: { level: 2, text: trimmed.replace(/^##\s+/, '') } });
      } else if (trimmed.startsWith('### ')) {
        blocks.push({ type: 'heading', data: { level: 3, text: trimmed.replace(/^###\s+/, '') } });
      } else if (trimmed.startsWith('#### ')) {
        blocks.push({ type: 'heading', data: { level: 4, text: trimmed.replace(/^####\s+/, '') } });
      } else if (trimmed.startsWith('> ')) {
        blocks.push({ type: 'quote', data: { text: trimmed.replace(/^>\s+/, '') } });
      } else {
        blocks.push({ type: 'paragraph', data: { text: trimmed } });
      }
    }

    return blocks;
  }, [contentMarkdown]);

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
  const handleSaveDraft = async () => {
    setSaving(true);
    setStatusMessage('');

    const payload = {
      title,
      slug,
      bodyJson: { blocks: currentBlocks },
      excerpt,
      featuredMediaId: featuredMediaId || null,
      featuredAltOverride: featuredAlt || null,
      featuredCaptionOverride: featuredCaption || null,
      primaryCategoryId: primaryCategoryId || null,
      authorIds: selectedAuthorIds,
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
    };

    try {
      if (isNew) {
        const res = await fetch('/api/v1/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
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
        } else {
          setStatusMessage(`Error: ${data.message || 'Failed to update'}`);
        }
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
            onClick={handleSaveDraft}
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
                onClick={handleSaveDraft}
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

      {statusMessage && (
        <div style={{ padding: '12px 16px', background: '#e9f3f3', border: '1px solid #d4efec', borderRadius: 8, color: '#07484b', fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      {/* 2-Column Editor Layout (Main Content + Right Sidebar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        {/* Main Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Post Title Input */}
          <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #cfe3e3' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#3d5557', textTransform: 'uppercase', marginBottom: 6 }}>
              Post Title (Main H1)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Skills in Demand Visa Australia: Complete Guide to Requirements and Process"
              style={{
                width: '100%',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#042628',
                padding: '10px 14px',
                border: '1px solid #b9d3d4',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Permalink Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.8125rem', color: '#3d5557' }}>
              <span style={{ fontWeight: 600 }}>Permalink:</span>
              <span>https://migrationfactor.com/blog/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                style={{
                  border: '1px solid #b9d3d4',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontFamily: 'monospace',
                  color: '#0b666a',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              />
              <span>/</span>
            </div>
          </div>

          {/* Block Content Editor */}
          <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #cfe3e3' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#3d5557', textTransform: 'uppercase' }}>
                Article Body Content
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['## H2', '### H3', 'Quote', 'List'].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === '## H2') setContentMarkdown((prev: string) => prev + '\n\n## Section Title\n\n');
                      if (btn === '### H3') setContentMarkdown((prev: string) => prev + '\n\n### Sub-heading\n\n');
                      if (btn === 'Quote') setContentMarkdown((prev: string) => prev + '\n\n> Key quote or citation here\n\n');
                      if (btn === 'List') setContentMarkdown((prev: string) => prev + '\n\n- Item 1\n- Item 2\n- Item 3\n\n');
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid #cfe3e3',
                      background: '#f2f8f8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    +{btn}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={22}
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              placeholder="Write your article using structured headings (## H2, ### H3), paragraphs, and bullet points..."
              style={{
                width: '100%',
                padding: 16,
                fontSize: '1rem',
                lineHeight: 1.7,
                borderRadius: 8,
                border: '1px solid #b9d3d4',
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box',
              }}
            />

            {/* Editor Status Bar (FR-EDT-001) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f2f8f8',
                border: '1px solid #cfe3e3',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                fontSize: '0.8125rem',
                color: '#3d5557',
              }}
            >
              <span>Words: <strong style={{ color: '#042628' }}>{wordCount}</strong></span>
              <span>Reading time: <strong style={{ color: '#042628' }}>~{readingTimeMin} min</strong></span>
              <span>Headings: <strong style={{ color: '#042628' }}>{headings.length}</strong></span>
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

              {/* Featured Image */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#042628', marginBottom: 4 }}>
                  Featured Image URL *
                </label>
                <input
                  type="text"
                  value={featuredImageUrl}
                  onChange={(e) => setFeaturedImageUrl(e.target.value)}
                  placeholder="/uploads/blog/... or https://..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
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
    </div>
  );
}
