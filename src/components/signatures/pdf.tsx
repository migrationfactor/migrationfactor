'use client';
import { useEffect, useRef, useState } from 'react';

// Minimal typings for the self-hosted pdf.js 3.11 build in /public/vendor/pdfjs.
interface PdfViewport { width: number; height: number }
interface PdfRenderTask { promise: Promise<void>; cancel(): void }
export interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): PdfRenderTask;
}
export interface PdfDocumentProxy { numPages: number; getPage(n: number): Promise<PdfPageProxy>; destroy(): Promise<void> }
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { url: string; isEvalSupported: boolean; withCredentials?: boolean }): { promise: Promise<PdfDocumentProxy> };
}
declare global { interface Window { pdfjsLib?: PdfJs } }

let loader: Promise<PdfJs> | null = null;

/** Loads pdf.js once from this site (no CDN), with its worker on the same origin. */
export function loadPdfJs(): Promise<PdfJs> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  loader ??= new Promise<PdfJs>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/pdfjs/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) { reject(new Error('PDF viewer failed to load.')); return; }
      lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
      resolve(lib);
    };
    script.onerror = () => { loader = null; reject(new Error('PDF viewer failed to load.')); };
    document.head.appendChild(script);
  });
  return loader;
}

export interface LoadedPdf { doc: PdfDocumentProxy; pages: PdfPageProxy[]; sizes: { width: number; height: number }[] }

export function usePdf(url: string | null) {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let loaded: PdfDocumentProxy | null = null;
    (async () => {
      try {
        const lib = await loadPdfJs();
        // eval stays off so the page works under the site's Content Security Policy.
        loaded = await lib.getDocument({ url, isEvalSupported: false }).promise;
        const pages = await Promise.all(Array.from({ length: loaded.numPages }, (_, i) => (loaded as PdfDocumentProxy).getPage(i + 1)));
        const sizes = pages.map((p) => { const v = p.getViewport({ scale: 1 }); return { width: v.width, height: v.height }; });
        if (!cancelled) setPdf({ doc: loaded, pages, sizes });
      } catch {
        if (!cancelled) setError('The document could not be displayed. Refresh the page to try again.');
      }
    })();
    return () => { cancelled = true; loaded?.destroy().catch(() => undefined); };
  }, [url]);
  return { pdf, error };
}

/** Renders one page into a canvas at the given CSS width, sharp on high-density screens. */
export function PdfCanvas({ page, width, label }: { page: PdfPageProxy; width: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || width <= 0) return;
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (width / base.width) * ratio });
    el.width = Math.floor(viewport.width);
    el.height = Math.floor(viewport.height);
    el.style.width = `${width}px`;
    el.style.height = `${(width / base.width) * base.height}px`;
    const context = el.getContext('2d');
    if (!context) return;
    const task = page.render({ canvasContext: context, viewport });
    task.promise.catch(() => undefined);
    return () => task.cancel();
  }, [page, width]);
  return <canvas ref={canvas} className="pdf-canvas" role="img" aria-label={label} />;
}

/** Tracks an element's content width so pages can fit their container. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export const signerColours = ['#0b666a', '#c2410c', '#6d28d9', '#0369a1', '#be123c', '#4d7c0f', '#a16207', '#0f766e'];
