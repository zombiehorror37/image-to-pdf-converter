'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import UploadDropzone from './UploadDropzone';
import PdfPageGrid from './PdfPageGrid';
import PdfActionToolbar from './PdfActionToolbar';
import PdfViewer from './PdfViewer';
import ProcessingStatus from './ProcessingStatus';
import Toasts from './Toasts';
import SplitDialog from './SplitDialog';
import ExportRangeDialog from './ExportRangeDialog';
import SettingsPanel from './SettingsPanel';
import EmptyState from './EmptyState';
import PreviewModal from './PreviewModal';
import SessionRestoreBanner from './SessionRestoreBanner';
import WatermarkDialog from './WatermarkDialog';
import PageNumbersDialog from './PageNumbersDialog';
import MetadataDialog from './MetadataDialog';
import { loadPdfDocument, renderPageToCanvas, canvasToBlobUrl } from '../lib/pdfRender';
import { getPageTextCached, normalizeQuery } from '../lib/pdfSearch';
import { detectCorrection } from '../lib/autoRotate';
import { exportEditedPdf, applyWatermark, applyPageNumbers, updateMetadata } from '../lib/pdfTools';
import { useHistory } from '../hooks/useHistory';
import { useToasts } from '../hooks/useToasts';
import { usePersistedSettings } from '../hooks/usePersistedSettings';
import { useSessionPersistence } from '../hooks/useSessionPersistence';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { formatSize, naturalCompare } from '../lib/utils';

const THUMB_WIDTH = 200;

// Pages don't have a per-item size, so name (grouped by source doc) and a plain
// reverse cover the useful cases — including "restore order" for a single PDF
// (name sort tie-breaks on original page index) and reversing scanned-backwards
// documents.
const SORT_OPTIONS = [
  { id: 'name-asc', label: 'File name (A → Z)' },
  { id: 'name-desc', label: 'File name (Z → A)' },
  { id: 'reverse', label: 'Reverse order' },
];
const THUMB_CONCURRENCY = 3; // parallel page renders
const SESSION_KEY = 'pdfTools';
const SETTINGS_KEY = 'pdfTools';

const DEFAULT_SETTINGS = {
  imageQuality: 0.92,
  imageDpi: 300,
};

// Old pixel-width values (600/900/1200/2400) → nearest DPI equivalent.
const migrateSettings = (s) => {
  const pixelToDpi = { 600: 150, 900: 200, 1200: 300, 2400: 600 };
  if (s.imageDpi >= 600 && pixelToDpi[s.imageDpi]) {
    return { ...s, imageDpi: pixelToDpi[s.imageDpi] };
  }
  return s;
};

const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function PdfToolsMode({ isDark, isActive, onSwitchMode }) {
  const docsRef = useRef(new Map()); // docId → { name, file, pdfDoc }
  const thumbInFlightRef = useRef(new Set());   // pageIds currently being rendered
  // Every thumb blob: URL ever created. Undo/redo snapshots keep references to
  // old thumbs, so URLs must NOT be revoked eagerly on rotate/delete — doing so
  // leaves restored pages pointing at dead blob: URLs (blank thumbnails).
  // They're revoked in bulk on unmount instead.
  const thumbBlobUrlsRef = useRef(new Set());
  const visiblePageIdsRef = useRef(new Set());  // most-recent visible page IDs from grid
  const {
    value: pages,
    setValue: setPages,
    replaceCurrent: setPagesQuiet,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory([]);

  const op = useAsyncOperation();

  const [selectedPages, setSelectedPages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activePageId, setActivePageId] = useState(null);
  const [showSplit, setShowSplit] = useState(false);
  const [showExportRange, setShowExportRange] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [showWatermark, setShowWatermark] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [metadataBlob, setMetadataBlobUrl] = useState(null);

  const [filename, setFilename] = useState('edited');
  const [pdfSettings, setPdfSettings] = usePersistedSettings(SETTINGS_KEY, DEFAULT_SETTINGS, migrateSettings);

  // Bumped whenever something invalidates a thumb (rotate/annotate/add) so
  // the rendering effect re-fires without scanning the whole pages array.
  const [thumbVersion, setThumbVersion] = useState(0);
  const bumpThumbVersion = useCallback(() => setThumbVersion((v) => v + 1), []);

  const previewPdfUrlRef = useRef(null);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const { restorable, skipNextSave, discard, consumeRestorable } = useSessionPersistence({
    key: SESSION_KEY,
    deps: [pages, filename],
    payloadFn: () => {
      // Thumbs are intentionally not persisted — they're cheap to regenerate
      // and were the bulk of the IDB payload for large PDFs.
      const lightPages = pages.map((p) => ({
        id: p.id,
        srcDocId: p.srcDocId,
        srcPageIndex: p.srcPageIndex,
        docName: p.docName,
        internalRotation: p.internalRotation,
        rotation: p.rotation,
        annotations: p.annotations,
      }));
      const docs = Array.from(docsRef.current.entries()).map(([id, { name, file }]) => ({ id, name, file }));
      return { pages: lightPages, docs, filename };
    },
    isEmpty: () => pages.length === 0,
  });

  const restorableSession =
    restorable &&
    Array.isArray(restorable.pages) &&
    restorable.pages.length > 0 &&
    Array.isArray(restorable.docs)
      ? restorable
      : null;

  // Revoke any lingering preview URL and all thumb URLs on unmount
  useEffect(() => {
    const thumbUrls = thumbBlobUrlsRef.current;
    return () => {
      if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current);
      for (const url of thumbUrls) URL.revokeObjectURL(url);
      thumbUrls.clear();
    };
  }, []);

  // Signature of user-visible edits (order, rotation, annotations). Thumbs
  // resolving in the background change the `pages` array identity but not
  // this signature — keying the stale-preview check on it stops the preview
  // modal from closing itself when a background thumb lands.
  const editSig = useMemo(
    () =>
      pages
        .map((p) => {
          const a = p.annotations || {};
          return `${p.id}:${p.rotation}:${a.highlights?.length || 0},${a.inks?.length || 0},${a.texts?.length || 0},${a.shapes?.length || 0},${a.stamps?.length || 0}`;
        })
        .join('|'),
    [pages],
  );

  // Close stale preview when pages are edited
  const lastEditSigRef = useRef(editSig);
  useEffect(() => {
    if (!showPreview) {
      lastEditSigRef.current = editSig;
      return;
    }
    if (lastEditSigRef.current !== editSig) {
      lastEditSigRef.current = editSig;
      if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current);
      previewPdfUrlRef.current = null;
      setPreviewPdfUrl(null);
      setShowPreview(false);
    }
  }, [editSig, showPreview]);

  const restoreSession = async () => {
    if (!restorableSession) return;
    consumeRestorable();
    skipNextSave();

    const { pages: savedPages, docs: savedDocs, filename: savedFilename } = restorableSession;

    await op.run(async ({ setStep, setProgress }) => {
      setStep('Restoring session...');
      const failures = [];
      for (let i = 0; i < savedDocs.length; i++) {
        const doc = savedDocs[i];
        setStep(`Loading ${doc.name}...`);
        try {
          const pdfDoc = await loadPdfDocument(doc.file);
          docsRef.current.set(doc.id, { name: doc.name, file: doc.file, pdfDoc });
        } catch {
          failures.push(doc.name);
        }
        setProgress(Math.round(((i + 1) / savedDocs.length) * 80));
      }

      const validPages = savedPages.filter((p) => docsRef.current.has(p.srcDocId));
      setPages(validPages);
      bumpThumbVersion();
      if (savedFilename) setFilename(savedFilename);

      if (failures.length > 0) {
        pushToast({ type: 'error', title: 'Some files unavailable', message: failures.join(', ') });
      } else {
        pushToast({ type: 'success', message: `Restored ${validPages.length} pages.` });
      }
    });
  };

  const handleFileUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const pdfFiles = files.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );
      const nonPdfFiles = files.filter(
        (f) => !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')),
      );

      if (pdfFiles.length === 0) {
        pushToast({
          type: 'info',
          title: 'No PDFs found',
          message: 'Switch to the Make PDF tab to convert images.',
          duration: 6000,
        });
        return;
      }
      if (nonPdfFiles.length > 0) {
        pushToast({
          type: 'info',
          message: `${nonPdfFiles.length} non-PDF file${nonPdfFiles.length > 1 ? 's' : ''} skipped — use Make PDF tab for images.`,
        });
      }

      await op.run(async ({ setStep, setProgress }) => {
        setStep('Loading PDFs...');
        const newPages = [];
        const failures = [];

        for (let f = 0; f < pdfFiles.length; f++) {
          const file = pdfFiles[f];
          setStep(`Loading ${file.name}...`);
          try {
            const pdfDoc = await loadPdfDocument(file);
            const docId = `${Date.now()}-${f}-${Math.random().toString(36).slice(2, 8)}`;
            docsRef.current.set(docId, { name: file.name, file, pdfDoc });
            for (let p = 0; p < pdfDoc.numPages; p++) {
              newPages.push({
                id: `${docId}-${p}`,
                srcDocId: docId,
                srcPageIndex: p,
                docName: file.name,
                internalRotation: null,
                rotation: 0,
                annotations: { highlights: [], inks: [], texts: [], shapes: [], stamps: [] },
                thumb: null,
              });
            }
          } catch (err) {
            failures.push({ name: file.name, reason: err?.message || 'Failed to open' });
          }
          setProgress(Math.round(((f + 1) / pdfFiles.length) * 100));
        }

        setPages((prev) => [...prev, ...newPages]);
        bumpThumbVersion();

        if (newPages.length > 0) {
          pushToast({
            type: 'success',
            message: `Loaded ${newPages.length} ${newPages.length === 1 ? 'page' : 'pages'} from ${
              pdfFiles.length - failures.length
            } ${pdfFiles.length - failures.length === 1 ? 'PDF' : 'PDFs'}.`,
          });
        }
        if (failures.length > 0) {
          pushToast({
            type: 'error',
            title: `${failures.length} ${failures.length === 1 ? 'PDF' : 'PDFs'} couldn't be opened`,
            message: failures.map((f) => `${f.name}: ${f.reason}`).join('\n'),
            duration: 8000,
          });
        }
      });
    },
    [op, pushToast, setPages, bumpThumbVersion],
  );

  const handleVisiblePagesChange = useCallback((ids) => {
    visiblePageIdsRef.current = ids;
  }, []);

  // Thumb-render effect: re-fires when something flagged thumbs as invalid
  // (bumpThumbVersion) or the pages array changed. Limited concurrency;
  // visible pages first so the viewport fills before off-screen pages.
  useEffect(() => {
    let cancelled = false;
    const inFlight = thumbInFlightRef.current;
    const visible = visiblePageIdsRef.current;
    const remaining = pages.filter((p) => !p.thumb && !inFlight.has(p.id));
    if (remaining.length === 0) return;

    const visiblePending = visible.size > 0
      ? remaining.filter((p) => visible.has(p.id))
      : [];
    const offscreenPending = visible.size > 0
      ? remaining.filter((p) => !visible.has(p.id))
      : remaining;
    const pending = [...visiblePending, ...offscreenPending];

    let index = 0;
    const worker = async () => {
      while (!cancelled) {
        const page = pending[index++];
        if (!page) return;
        if (inFlight.has(page.id)) continue;
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) continue;
        const startedRotation = page.rotation || 0;
        inFlight.add(page.id);
        try {
          let internalRotation = page.internalRotation;
          if (internalRotation == null) {
            try {
              const pdfPage = await doc.pdfDoc.getPage(page.srcPageIndex + 1);
              internalRotation = pdfPage.rotate || 0;
            } catch {
              internalRotation = 0;
            }
          }
          const resolvedInternal = internalRotation;
          const totalRotation = ((internalRotation || 0) + startedRotation) % 360;
          const { canvas } = await renderPageToCanvas(
            doc.pdfDoc,
            page.srcPageIndex + 1,
            THUMB_WIDTH,
            totalRotation,
            { devicePixelRatio: 1 },
          );
          const blobUrl = await canvasToBlobUrl(canvas, 0.7);
          thumbBlobUrlsRef.current.add(blobUrl);

          // Apply the result even if the effect was cancelled by a re-run —
          // the next effect snapshot will see the updated thumb and skip
          // this page. Discarding here would orphan the render.
          setPagesQuiet((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== page.id) return p;
              if ((p.rotation || 0) !== startedRotation) return p;
              if (p.thumb) return p;
              return {
                ...p,
                thumb: blobUrl,
                ...(p.internalRotation == null ? { internalRotation: resolvedInternal } : {}),
              };
            });
            return updated;
          });
        } catch {
          // ignore — pending was a snapshot; next bump will retry
        } finally {
          inFlight.delete(page.id);
        }
      }
    };
    Promise.all(Array.from({ length: THUMB_CONCURRENCY }, worker));

    return () => {
      cancelled = true;
    };
    // pages is in deps because we want to react to page list changes; the
    // counter handles rotate/annotate invalidations without changing pages
    // ref equality.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, thumbVersion]);

  useEditorShortcuts(undo, redo, isActive);

  const updatePage = (id, patch) => {
    const invalidatesThumb = 'annotations' in patch || 'rotation' in patch;
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, ...(invalidatesThumb ? { thumb: null } : {}) } : p)));
    if (invalidatesThumb) bumpThumbVersion();
  };

  const rotatePage = (id) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360, thumb: null } : p)));
    bumpThumbVersion();
  };

  const removePage = (id) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPages((prev) => { const n = new Set(prev); n.delete(id); return n; });
    if (activePageId === id) setActivePageId(null);
  };

  const reorderPages = (fromIndex, toIndex) => {
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const movePage = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  // One-shot sort, undoable via setPages history; manual drag still works after.
  const sortPages = (id) => {
    setPages((prev) => {
      const next = [...prev];
      if (id === 'reverse') { next.reverse(); return next; }
      // Group by source document, then keep original page order within each.
      const cmp = (a, b) => {
        const n = naturalCompare(a.docName, b.docName);
        return n !== 0 ? n : a.srcPageIndex - b.srcPageIndex;
      };
      if (id === 'name-asc') next.sort(cmp);
      else if (id === 'name-desc') next.sort((a, b) => -cmp(a, b));
      else return prev;
      return next;
    });
  };

  const togglePageSelection = (id) => {
    setSelectedPages((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedPages.size === pages.length) setSelectedPages(new Set());
    else setSelectedPages(new Set(pages.map((p) => p.id)));
  };

  const rotateSelected = () => {
    setPages((prev) => prev.map((p) =>
      selectedPages.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360, thumb: null } : p,
    ));
    bumpThumbVersion();
  };

  const rotateAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360, thumb: null })));
    bumpThumbVersion();
  };

  // Auto-rotate: detect each page's true orientation (OSD) and set rotation to
  // make it upright. Detection runs on the page rendered at its natural (internal
  // /Rotate) orientation, so the correction is absolute — `rotation` is set, not
  // accumulated. Mirrors rotatePage's thumb invalidation so thumbs re-render.
  const autoRotatePages = async (ids) => {
    const targets = ids ? pages.filter((p) => ids.has(p.id)) : pages;
    if (targets.length === 0) return;

    const corrections = new Map();
    let upright = 0;
    let uncertain = 0;
    let cancelled = false;

    await op.run(async ({ signal, setStep, setProgress }) => {
      for (let i = 0; i < targets.length; i++) {
        if (signal.aborted) { cancelled = true; return; }
        setStep(`Detecting orientation ${i + 1} of ${targets.length}…`);
        const page = targets[i];
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) { uncertain++; continue; }
        try {
          let internal = page.internalRotation;
          if (internal == null) {
            try {
              const pdfPage = await doc.pdfDoc.getPage(page.srcPageIndex + 1);
              internal = pdfPage.rotate || 0;
            } catch { internal = 0; }
          }
          const { canvas } = await renderPageToCanvas(
            doc.pdfDoc,
            page.srcPageIndex + 1,
            1200,
            internal,
            { devicePixelRatio: 1 },
          );
          const { correction, certain } = await detectCorrection(canvas);
          canvas.width = 0;
          canvas.height = 0;
          if (!certain) uncertain++;
          else if (((correction - (page.rotation || 0)) % 360 + 360) % 360 === 0) upright++;
          else corrections.set(page.id, { rotation: correction, internalRotation: internal });
        } catch {
          uncertain++;
        }
        setProgress(Math.round(((i + 1) / targets.length) * 100));
      }
    }, { initialStep: 'Loading orientation detector…' });

    if (corrections.size > 0) {
      setPages((prev) => prev.map((p) => {
        const c = corrections.get(p.id);
        return c ? { ...p, rotation: c.rotation, internalRotation: c.internalRotation, thumb: null } : p;
      }));
      bumpThumbVersion();
    }

    const parts = [`Auto-rotated ${corrections.size}`];
    if (upright) parts.push(`${upright} already upright`);
    if (uncertain) parts.push(`${uncertain} uncertain`);
    pushToast({
      type: cancelled ? 'info' : 'success',
      message: (cancelled ? 'Cancelled — ' : '') + parts.join(' · '),
    });
  };

  const deleteSelected = () => {
    setPages((prev) => prev.filter((p) => !selectedPages.has(p.id)));
    setSelectedPages(new Set());
    setIsSelectionMode(false);
  };

  const invertSelection = () => {
    setSelectedPages((prev) => new Set(pages.filter((p) => !prev.has(p.id)).map((p) => p.id)));
  };

  // Select every page whose text contains the query (case-insensitive), so the
  // usual bulk actions (delete / extract / rotate) apply to them. Pages without
  // a text layer (scans with no OCR) can't match and are reported separately.
  const selectPagesByText = async (query) => {
    const q = normalizeQuery(query);
    if (!q || pages.length === 0) return;

    const matched = new Set();
    let noText = 0;
    let cancelled = false;

    await op.run(async ({ signal, setStep, setProgress }) => {
      for (let i = 0; i < pages.length; i++) {
        if (signal.aborted) { cancelled = true; return; }
        setStep(`Searching page ${i + 1} of ${pages.length}…`);
        const page = pages[i];
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) { noText++; continue; }
        try {
          const text = await getPageTextCached(doc.pdfDoc, page.srcPageIndex + 1);
          if (!text) noText++;
          else if (text.includes(q)) matched.add(page.id);
        } catch {
          noText++;
        }
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }
    }, { initialStep: 'Searching…' });

    if (cancelled) {
      pushToast({ type: 'info', message: 'Search cancelled' });
      return;
    }

    setSelectedPages(matched);
    if (!isSelectionMode) setIsSelectionMode(true);

    if (noText === pages.length) {
      pushToast({ type: 'error', message: 'No selectable text in this PDF — it may be a scan without OCR' });
    } else {
      const parts = [`“${query.trim()}” found on ${matched.size} of ${pages.length} pages`];
      if (noText) parts.push(`${noText} without text`);
      pushToast({ type: matched.size > 0 ? 'success' : 'info', message: parts.join(' · ') });
    }
  };

  // Select pages by 1-based range pairs [[s,e], ...]
  const selectPagesByRange = (ranges) => {
    const ids = new Set();
    for (const [s, e] of ranges) {
      pages.slice(s - 1, e).forEach((p) => ids.add(p.id));
    }
    setSelectedPages(ids);
    if (!isSelectionMode) setIsSelectionMode(true);
  };

  // The export map only depends on which docIds are actually in use.
  // Sort+join produces a stable cache key so rotating/annotating doesn't
  // rebuild the map.
  const docIdsKey = useMemo(() => {
    const ids = new Set();
    for (const p of pages) ids.add(p.srcDocId);
    return [...ids].sort().join(',');
  }, [pages]);

  const sourceDocsForExport = useMemo(() => {
    const out = {};
    for (const [id, info] of docsRef.current.entries()) out[id] = info.file;
    return out;
  }, [docIdsKey]);

  const exportPdf = async () => {
    if (pages.length === 0) return;
    await op.run(async ({ signal, setProgress }) => {
      setProgress(0);
      try {
        const blob = await exportEditedPdf(sourceDocsForExport, pages);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}.pdf`);
        pushToast({ type: 'success', message: `${filename}.pdf downloaded.` });
      } catch (err) {
        if (!signal.aborted) {
          pushToast({ type: 'error', title: 'Export failed', message: err?.message || 'Could not produce PDF.' });
        }
      }
    }, { initialStep: 'Building PDF...' });
  };

  const exportRange = async (ranges) => {
    setShowExportRange(false);
    if (!ranges || ranges.length === 0) return;
    const subset = ranges.flatMap(([s, e]) => pages.slice(s - 1, e));
    if (subset.length === 0) return;
    await op.run(async ({ signal, setProgress }) => {
      try {
        const blob = await exportEditedPdf(sourceDocsForExport, subset);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}-range.pdf`);
        pushToast({ type: 'success', message: `${subset.length} pages exported as ${filename}-range.pdf.` });
      } catch (err) {
        if (!signal.aborted) {
          pushToast({ type: 'error', title: 'Export failed', message: err?.message || 'Could not produce PDF.' });
        }
      }
    }, { initialStep: 'Building PDF...' });
  };

  const openPreview = async () => {
    if (pages.length === 0) return;
    const url = await op.run(async ({ signal, setProgress }) => {
      try {
        const blob = await exportEditedPdf(sourceDocsForExport, pages);
        if (signal.aborted) return undefined;
        setProgress(100);
        return URL.createObjectURL(blob);
      } catch (err) {
        pushToast({ type: 'error', title: 'Preview failed', message: err?.message || 'Could not render preview.' });
        return undefined;
      }
    }, { initialStep: 'Building preview...' });
    if (!url) return;
    previewPdfUrlRef.current = url;
    setPreviewPdfUrl(url);
    setShowPreview(true);
  };

  const openPreviewSelected = async () => {
    if (selectedPages.size === 0) return;
    const subset = pages.filter((p) => selectedPages.has(p.id));
    const url = await op.run(async ({ signal, setProgress }) => {
      try {
        const blob = await exportEditedPdf(sourceDocsForExport, subset);
        if (signal.aborted) return undefined;
        setProgress(100);
        return URL.createObjectURL(blob);
      } catch (err) {
        pushToast({ type: 'error', title: 'Preview failed', message: err?.message || 'Could not render preview.' });
        return undefined;
      }
    }, { initialStep: 'Building preview...' });
    if (!url) return;
    previewPdfUrlRef.current = url;
    setPreviewPdfUrl(url);
    setShowPreview(true);
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    previewPdfUrlRef.current = null;
    setPreviewPdfUrl(null);
    setShowPreview(false);
  };

  const downloadFromPreview = () => {
    if (!previewPdfUrl) return;
    const a = document.createElement('a');
    a.href = previewPdfUrl;
    a.download = `${filename}.pdf`;
    a.click();
    pushToast({ type: 'success', message: `${filename}.pdf downloaded.` });
  };

  const extractSelected = async () => {
    if (selectedPages.size === 0) return;
    await op.run(async ({ signal, setProgress }) => {
      try {
        const subset = pages.filter((p) => selectedPages.has(p.id));
        const blob = await exportEditedPdf(sourceDocsForExport, subset);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}-extracted.pdf`);
        pushToast({ type: 'success', message: `Extracted ${subset.length} ${subset.length === 1 ? 'page' : 'pages'}.` });
      } catch (err) {
        pushToast({ type: 'error', title: 'Extract failed', message: err?.message || 'Could not extract pages.' });
      }
    }, { initialStep: 'Extracting pages...' });
  };

  // Additive: one single-page PDF per page. Single page → that PDF; multiple →
  // a ZIP. Reuses the same exportEditedPdf path as Save / Extract.
  const exportSeparatePages = async () => {
    if (pages.length === 0) return;
    await op.run(async ({ signal, setStep, setProgress }) => {
      try {
        if (pages.length === 1) {
          const blob = await exportEditedPdf(sourceDocsForExport, [pages[0]]);
          if (signal.aborted) return;
          downloadBlob(blob, `${filename}.pdf`);
          pushToast({ type: 'success', message: `${filename}.pdf downloaded.` });
          return;
        }
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          if (signal.aborted) return;
          setStep(`Building PDF ${i + 1} of ${pages.length}...`);
          setProgress(Math.round((i / pages.length) * 100));
          const blob = await exportEditedPdf(sourceDocsForExport, [pages[i]]);
          zip.file(`${filename}-page-${String(i + 1).padStart(3, '0')}.pdf`, blob);
        }
        if (signal.aborted) return;
        setStep('Packaging ZIP...');
        setProgress(98);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${filename}-pages.zip`);
        pushToast({ type: 'success', message: `${pages.length} pages exported as ${filename}-pages.zip.` });
      } catch (err) {
        if (!signal.aborted) {
          pushToast({ type: 'error', title: 'Export failed', message: err?.message || 'Could not export pages.' });
        }
      }
    }, { initialStep: 'Building PDFs...' });
  };

  const exportImages = async () => {
    if (pages.length === 0) return;
    await op.run(async ({ signal, setStep, setProgress }) => {
      try {
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          if (signal.aborted) return;
          setStep(`Rendering page ${i + 1} of ${pages.length}...`);
          setProgress(Math.round((i / pages.length) * 100));
          const page = pages[i];
          const doc = docsRef.current.get(page.srcDocId);
          if (!doc) continue;
          const pdfPage = await doc.pdfDoc.getPage(page.srcPageIndex + 1);
          // getViewport's rotation REPLACES the page's internal /Rotate, so
          // the internal rotation has to be folded in — same as thumbs/viewer.
          const internal = page.internalRotation ?? (pdfPage.rotate || 0);
          const totalRotation = (internal + (page.rotation || 0)) % 360;
          const baseVp = pdfPage.getViewport({ scale: 1, rotation: totalRotation });
          const targetWidth = Math.min(Math.round((baseVp.width / 72) * pdfSettings.imageDpi), 8000);
          // devicePixelRatio: 1 — exports are sized by the DPI setting alone;
          // the screen's scale factor must not change file output.
          const { canvas } = await renderPageToCanvas(
            doc.pdfDoc,
            page.srcPageIndex + 1,
            targetWidth,
            totalRotation,
            { devicePixelRatio: 1 },
          );
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', pdfSettings.imageQuality));
          if (blob) zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, blob);
        }
        if (signal.aborted) return;
        setStep('Compressing...');
        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${filename}.zip`);
        pushToast({
          type: 'success',
          message: `${pages.length} pages exported as ${filename}.zip — ${formatSize(zipBlob.size)} at ${pdfSettings.imageDpi} DPI.`,
        });
      } catch (err) {
        if (!signal.aborted) {
          pushToast({ type: 'error', title: 'Image export failed', message: err?.message || 'Could not render pages.' });
        }
      }
    }, { initialStep: 'Rendering pages...' });
  };

  const performSplit = async (ranges) => {
    setShowSplit(false);
    if (!ranges || ranges.length === 0) return;
    await op.run(async ({ signal, setStep, setProgress }) => {
      try {
        for (let r = 0; r < ranges.length; r++) {
          if (signal.aborted) return;
          const [start, end] = ranges[r];
          setStep(`Building part ${r + 1} of ${ranges.length}...`);
          const subset = pages.slice(start - 1, end);
          const blob = await exportEditedPdf(sourceDocsForExport, subset);
          downloadBlob(blob, `${filename}-part${r + 1}-p${start}-${end}.pdf`);
          setProgress(Math.round(((r + 1) / ranges.length) * 100));
        }
        pushToast({ type: 'success', message: `Created ${ranges.length} ${ranges.length === 1 ? 'PDF' : 'PDFs'}.` });
      } catch (err) {
        if (!signal.aborted) {
          pushToast({ type: 'error', title: 'Split failed', message: err?.message || 'Could not split PDF.' });
        }
      }
    }, { initialStep: 'Splitting PDF...' });
  };

  // ── Layer 2: Watermark ──────────────────────────────────────────────────
  const applyWatermarkOp = async (config) => {
    setShowWatermark(false);
    await op.run(async ({ signal, setProgress }) => {
      try {
        const base = await exportEditedPdf(sourceDocsForExport, pages);
        if (signal.aborted) return;
        setProgress(60);
        const blob = await applyWatermark(base, config);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}-watermarked.pdf`);
        pushToast({ type: 'success', message: 'Watermark applied and downloaded.' });
      } catch (err) {
        if (!signal.aborted) pushToast({ type: 'error', title: 'Watermark failed', message: err?.message });
      }
    }, { initialStep: 'Applying watermark…' });
  };

  // ── Layer 2: Page Numbers ────────────────────────────────────────────────
  const applyPageNumbersOp = async (config) => {
    setShowPageNumbers(false);
    await op.run(async ({ signal, setProgress }) => {
      try {
        const base = await exportEditedPdf(sourceDocsForExport, pages);
        if (signal.aborted) return;
        setProgress(60);
        const blob = await applyPageNumbers(base, config);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}-numbered.pdf`);
        pushToast({ type: 'success', message: 'Page numbers added.' });
      } catch (err) {
        if (!signal.aborted) pushToast({ type: 'error', title: 'Page numbers failed', message: err?.message });
      }
    }, { initialStep: 'Adding page numbers…' });
  };

  // ── Layer 2: Metadata ────────────────────────────────────────────────────
  const openMetadata = async () => {
    if (pages.length === 0) return;
    const blob = await op.run(async () => {
      try {
        return await exportEditedPdf(sourceDocsForExport, pages);
      } catch (err) {
        pushToast({ type: 'error', title: 'Could not read metadata', message: err?.message });
        return undefined;
      }
    }, { initialStep: 'Reading metadata…' });
    if (!blob) return;
    setMetadataBlobUrl(blob);
    setShowMetadata(true);
  };

  const applyMetadataOp = async (meta) => {
    setShowMetadata(false);
    if (!metadataBlob) return;
    await op.run(async ({ signal, setProgress }) => {
      try {
        const blob = await updateMetadata(metadataBlob, meta);
        setMetadataBlobUrl(null);
        if (signal.aborted) return;
        setProgress(100);
        downloadBlob(blob, `${filename}.pdf`);
        pushToast({ type: 'success', message: 'Metadata saved.' });
      } catch (err) {
        if (!signal.aborted) pushToast({ type: 'error', title: 'Metadata save failed', message: err?.message });
      }
    }, { initialStep: 'Saving metadata…' });
  };

  const { activePage, activeIndex } = useMemo(() => {
    if (!activePageId) return { activePage: null, activeIndex: -1 };
    const idx = pages.findIndex((p) => p.id === activePageId);
    return { activePage: idx >= 0 ? pages[idx] : null, activeIndex: idx };
  }, [pages, activePageId]);
  const activePdfDoc = activePage ? docsRef.current.get(activePage.srcDocId)?.pdfDoc : null;

  return (
    <>
      {restorableSession && (
        <SessionRestoreBanner
          isDark={isDark}
          count={restorableSession.pages.length}
          unit="page"
          updatedAt={restorableSession.updatedAt || Date.now()}
          onRestore={restoreSession}
          onDiscard={discard}
        />
      )}

      <UploadDropzone
        isDark={isDark}
        mode="pdfTools"
        onDrop={handleFileUpload}
        onFiles={handleFileUpload}
        inputId="pdfFileInput"
      />

      {op.isProcessing && (
        <ProcessingStatus
          isDark={isDark}
          step={op.step}
          progress={op.progress}
          onCancel={op.hasActive() ? op.cancel : null}
        />
      )}

      {pages.length > 0 ? (
        <div className="mb-6 sm:mb-8">
          <SettingsPanel
            mode="pdfTools"
            isDark={isDark}
            filename={filename}
            onFilenameChange={setFilename}
            settings={pdfSettings}
            onSettingsChange={setPdfSettings}
          />
          <PdfActionToolbar
            isDark={isDark}
            pageCount={pages.length}
            selectedCount={selectedPages.size}
            isSelectionMode={isSelectionMode}
            isProcessing={op.isProcessing}
            onToggleSelection={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedPages(new Set());
            }}
            onSelectAll={selectAll}
            allSelected={selectedPages.size === pages.length}
            onSort={sortPages}
            sortOptions={SORT_OPTIONS}
            onRotateAll={rotateAll}
            onRotateSelected={rotateSelected}
            onAutoRotate={() => autoRotatePages()}
            onAutoRotateSelected={() => autoRotatePages(selectedPages)}
            onDeleteSelected={deleteSelected}
            onExtractSelected={extractSelected}
            onSelectRange={selectPagesByRange}
            onSelectByText={selectPagesByText}
            onInvertSelection={invertSelection}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExportPdf={exportPdf}
            onExportSeparate={exportSeparatePages}
            onExportImages={exportImages}
            onSplit={() => setShowSplit(true)}
            onExportRange={() => setShowExportRange(true)}
            onPreview={openPreview}
            onPreviewSelected={openPreviewSelected}
            onWatermark={() => setShowWatermark(true)}
            onPageNumbers={() => setShowPageNumbers(true)}
            onMetadata={openMetadata}
          />
          <PdfPageGrid
            pages={pages}
            isDark={isDark}
            isSelectionMode={isSelectionMode}
            selectedPages={selectedPages}
            onReorder={reorderPages}
            onToggleSelection={togglePageSelection}
            onRotate={rotatePage}
            onRemove={removePage}
            onView={(id) => setActivePageId(id)}
            onMove={movePage}
            onVisiblePagesChange={handleVisiblePagesChange}
          />
        </div>
      ) : (
        !op.isProcessing && (
          <EmptyState isDark={isDark} mode="pdfTools" onSwitchMode={onSwitchMode} />
        )
      )}

      {activePage && activePdfDoc && (
        <PdfViewer
          isDark={isDark}
          page={activePage}
          pdfDoc={activePdfDoc}
          pageIndexInArray={activeIndex}
          totalPages={pages.length}
          onClose={() => setActivePageId(null)}
          onPrev={() => activeIndex > 0 && setActivePageId(pages[activeIndex - 1].id)}
          onNext={() => activeIndex < pages.length - 1 && setActivePageId(pages[activeIndex + 1].id)}
          onAnnotationsChange={(annotations) => updatePage(activePage.id, { annotations })}
          onStampAllPages={(stamp) => {
            setPages((prev) => prev.map((p) => ({
              ...p,
              thumb: null,
              annotations: {
                highlights: [], inks: [], texts: [], shapes: [], stamps: [],
                ...p.annotations,
                stamps: [...(p.annotations?.stamps || []), stamp],
              },
            })));
            bumpThumbVersion();
            pushToast({ type: 'success', message: `Stamp applied to all ${pages.length} pages.` });
          }}
          onRotate={rotatePage}
        />
      )}

      {showSplit && (
        <SplitDialog
          isDark={isDark}
          totalPages={pages.length}
          onClose={() => setShowSplit(false)}
          onSplit={performSplit}
        />
      )}

      {showExportRange && (
        <ExportRangeDialog
          isDark={isDark}
          totalPages={pages.length}
          onClose={() => setShowExportRange(false)}
          onExport={exportRange}
        />
      )}

      {showPreview && (
        <PreviewModal
          isDark={isDark}
          pdfUrl={previewPdfUrl}
          onClose={closePreview}
          onDownload={downloadFromPreview}
        />
      )}

      {showWatermark && (
        <WatermarkDialog
          isDark={isDark}
          onClose={() => setShowWatermark(false)}
          onApply={applyWatermarkOp}
        />
      )}

      {showPageNumbers && (
        <PageNumbersDialog
          isDark={isDark}
          totalPages={pages.length}
          onClose={() => setShowPageNumbers(false)}
          onApply={applyPageNumbersOp}
        />
      )}

      {showMetadata && (
        <MetadataDialog
          isDark={isDark}
          pdfBlob={metadataBlob}
          onClose={() => { setShowMetadata(false); setMetadataBlobUrl(null); }}
          onApply={applyMetadataOp}
        />
      )}

      <Toasts isDark={isDark} toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
