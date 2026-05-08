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
import SettingsPanel from './SettingsPanel';
import EmptyState from './EmptyState';
import PreviewModal from './PreviewModal';
import SessionRestoreBanner from './SessionRestoreBanner';
import WatermarkDialog from './WatermarkDialog';
import PageNumbersDialog from './PageNumbersDialog';
import MetadataDialog from './MetadataDialog';
import { loadPdfDocument, renderPageToCanvas } from '../lib/pdfRender';
import { exportEditedPdf, applyWatermark, applyPageNumbers, updateMetadata } from '../lib/pdfTools';
import { loadSettings, saveSettings } from '../lib/storage';
import { saveSession, loadSession, clearSession } from '../lib/storageDb';
import { useHistory } from '../hooks/useHistory';
import { useToasts } from '../hooks/useToasts';

const THUMB_WIDTH = 240;
const SESSION_KEY = 'pdfTools';
const SETTINGS_KEY = 'pdfTools';

const DEFAULT_SETTINGS = {
  imageQuality: 0.92,
  imageDpi: 1200,
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
  const {
    value: pages,
    setValue: setPages,
    replaceCurrent: setPagesQuiet,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const abortControllerRef = useRef(null);

  const [selectedPages, setSelectedPages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activePageId, setActivePageId] = useState(null);
  const [showSplit,       setShowSplit]       = useState(false);
  const [showPreview,     setShowPreview]     = useState(false);
  const [previewPdfUrl,   setPreviewPdfUrl]   = useState(null);
  const [showWatermark,   setShowWatermark]   = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  const [showMetadata,    setShowMetadata]    = useState(false);
  const [metadataBlobUrl, setMetadataBlobUrl] = useState(null);

  const [filename, setFilename] = useState('edited');
  const [pdfSettings, setPdfSettings] = useState(DEFAULT_SETTINGS);
  const [restorableSession, setRestorableSession] = useState(null);

  const sessionSaveTimer = useRef(null);
  const skipNextSessionSave = useRef(false);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // Load persisted settings
  useEffect(() => {
    setPdfSettings(loadSettings(SETTINGS_KEY, DEFAULT_SETTINGS));
  }, []);

  useEffect(() => {
    saveSettings(SETTINGS_KEY, pdfSettings);
  }, [pdfSettings]);

  // Load restorable session on mount
  useEffect(() => {
    let cancelled = false;
    loadSession(SESSION_KEY).then((session) => {
      if (cancelled) return;
      if (session && Array.isArray(session.pages) && session.pages.length > 0 && Array.isArray(session.docs)) {
        setRestorableSession(session);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Auto-save session whenever pages change
  useEffect(() => {
    if (skipNextSessionSave.current) {
      skipNextSessionSave.current = false;
      return;
    }
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    if (pages.length === 0) {
      clearSession(SESSION_KEY);
      return;
    }
    sessionSaveTimer.current = setTimeout(() => {
      const lightPages = pages.map((p) => ({
        id: p.id,
        srcDocId: p.srcDocId,
        srcPageIndex: p.srcPageIndex,
        docName: p.docName,
        rotation: p.rotation,
        annotations: p.annotations,
        thumb: p.thumb,
      }));
      const docs = Array.from(docsRef.current.entries()).map(([id, { name, file }]) => ({ id, name, file }));
      saveSession(SESSION_KEY, { pages: lightPages, docs, filename });
    }, 600);
    return () => { if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current); };
  }, [pages, filename]);

  const restoreSession = async () => {
    if (!restorableSession) return;
    setRestorableSession(null);
    skipNextSessionSave.current = true;
    setIsProcessing(true);
    setProcessingStep('Restoring session...');
    setProcessingProgress(0);

    const { pages: savedPages, docs: savedDocs, filename: savedFilename } = restorableSession;
    const failures = [];

    for (let i = 0; i < savedDocs.length; i++) {
      const doc = savedDocs[i];
      setProcessingStep(`Loading ${doc.name}...`);
      try {
        const pdfDoc = await loadPdfDocument(doc.file);
        docsRef.current.set(doc.id, { name: doc.name, file: doc.file, pdfDoc });
      } catch {
        failures.push(doc.name);
      }
      setProcessingProgress(Math.round(((i + 1) / savedDocs.length) * 80));
    }

    const validPages = savedPages.filter((p) => docsRef.current.has(p.srcDocId));
    setPages(validPages);
    if (savedFilename) setFilename(savedFilename);
    setIsProcessing(false);
    setProcessingStep('');
    setProcessingProgress(0);

    if (failures.length > 0) {
      pushToast({ type: 'error', title: 'Some files unavailable', message: failures.join(', ') });
    } else {
      pushToast({ type: 'success', message: `Restored ${validPages.length} pages.` });
    }
  };

  const discardSession = () => {
    clearSession(SESSION_KEY);
    setRestorableSession(null);
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

      setIsProcessing(true);
      setProcessingStep('Loading PDFs...');
      setProcessingProgress(0);

      const newPages = [];
      const failures = [];

      for (let f = 0; f < pdfFiles.length; f++) {
        const file = pdfFiles[f];
        setProcessingStep(`Loading ${file.name}...`);
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
              rotation: 0,
              annotations: { highlights: [], inks: [], texts: [], shapes: [], stamps: [] },
              thumb: null,
            });
          }
        } catch (err) {
          failures.push({ name: file.name, reason: err?.message || 'Failed to open' });
        }
        setProcessingProgress(Math.round(((f + 1) / pdfFiles.length) * 100));
      }

      setPages((prev) => [...prev, ...newPages]);
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);

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
    },
    [setPages, pushToast],
  );

  // Background thumbnail rendering
  useEffect(() => {
    let cancelled = false;
    const pending = pages.filter((p) => !p.thumb);
    if (pending.length === 0) return;

    (async () => {
      for (const page of pending) {
        if (cancelled) return;
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) continue;
        try {
          const { canvas } = await renderPageToCanvas(doc.pdfDoc, page.srcPageIndex + 1, THUMB_WIDTH, 0);
          if (cancelled) return;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPagesQuiet((prev) => prev.map((p) => (p.id === page.id ? { ...p, thumb: dataUrl } : p)));
        } catch {
          // skip
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  // Keyboard shortcuts (only when active)
  useEffect(() => {
    const onKey = (e) => {
      if (!isActive) return;
      const target = e.target;
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditable) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, isActive]);

  const updatePage = (id, patch) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const rotatePage = (id) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
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

  const togglePageSelection = (id) => {
    setSelectedPages((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedPages.size === pages.length) setSelectedPages(new Set());
    else setSelectedPages(new Set(pages.map((p) => p.id)));
  };

  const rotateSelected = () => {
    setPages((prev) => prev.map((p) =>
      selectedPages.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
    ));
  };

  const rotateAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
  };

  const deleteSelected = () => {
    setPages((prev) => prev.filter((p) => !selectedPages.has(p.id)));
    setSelectedPages(new Set());
    setIsSelectionMode(false);
  };

  const sourceDocsForExport = useMemo(() => {
    const out = {};
    for (const [id, info] of docsRef.current.entries()) out[id] = info.file;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const cancelOperation = () => { abortControllerRef.current?.abort(); };

  const exportPdf = async () => {
    if (pages.length === 0) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Building PDF...');
    setProcessingProgress(0);
    try {
      const blob = await exportEditedPdf(sourceDocsForExport, pages);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      downloadBlob(blob, `${filename}.pdf`);
      pushToast({ type: 'success', message: `${filename}.pdf downloaded.` });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        pushToast({ type: 'error', title: 'Export failed', message: err?.message || 'Could not produce PDF.' });
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const openPreview = async () => {
    if (pages.length === 0) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Building preview...');
    setProcessingProgress(0);
    try {
      const blob = await exportEditedPdf(sourceDocsForExport, pages);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setShowPreview(true);
    } catch (err) {
      pushToast({ type: 'error', title: 'Preview failed', message: err?.message || 'Could not render preview.' });
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
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
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Extracting pages...');
    setProcessingProgress(0);
    try {
      const subset = pages.filter((p) => selectedPages.has(p.id));
      const blob = await exportEditedPdf(sourceDocsForExport, subset);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      downloadBlob(blob, `${filename}-extracted.pdf`);
      pushToast({ type: 'success', message: `Extracted ${subset.length} ${subset.length === 1 ? 'page' : 'pages'}.` });
    } catch (err) {
      pushToast({ type: 'error', title: 'Extract failed', message: err?.message || 'Could not extract pages.' });
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const exportImages = async () => {
    if (pages.length === 0) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Rendering pages...');
    setProcessingProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        if (abortControllerRef.current?.signal.aborted) return;
        setProcessingStep(`Rendering page ${i + 1} of ${pages.length}...`);
        setProcessingProgress(Math.round((i / pages.length) * 100));
        const page = pages[i];
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) continue;
        const { canvas } = await renderPageToCanvas(
          doc.pdfDoc,
          page.srcPageIndex + 1,
          pdfSettings.imageDpi,
          page.rotation || 0,
        );
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', pdfSettings.imageQuality));
        if (blob) zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, blob);
      }
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingStep('Compressing...');
      setProcessingProgress(95);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${filename}.zip`);
      pushToast({ type: 'success', message: `${pages.length} pages exported as ${filename}.zip.` });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        pushToast({ type: 'error', title: 'Image export failed', message: err?.message || 'Could not render pages.' });
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const performSplit = async (ranges) => {
    setShowSplit(false);
    if (!ranges || ranges.length === 0) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Splitting PDF...');
    setProcessingProgress(0);
    try {
      for (let r = 0; r < ranges.length; r++) {
        if (abortControllerRef.current?.signal.aborted) return;
        const [start, end] = ranges[r];
        setProcessingStep(`Building part ${r + 1} of ${ranges.length}...`);
        const subset = pages.slice(start - 1, end);
        const blob = await exportEditedPdf(sourceDocsForExport, subset);
        downloadBlob(blob, `${filename}-part${r + 1}-p${start}-${end}.pdf`);
        setProcessingProgress(Math.round(((r + 1) / ranges.length) * 100));
      }
      pushToast({ type: 'success', message: `Created ${ranges.length} ${ranges.length === 1 ? 'PDF' : 'PDFs'}.` });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        pushToast({ type: 'error', title: 'Split failed', message: err?.message || 'Could not split PDF.' });
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  // ── Layer 2: Watermark ──────────────────────────────────────────────────
  const applyWatermarkOp = async (config) => {
    setShowWatermark(false);
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Applying watermark…');
    setProcessingProgress(0);
    try {
      const base = await exportEditedPdf(sourceDocsForExport, pages);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(60);
      const blob = await applyWatermark(base, config);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      downloadBlob(blob, `${filename}-watermarked.pdf`);
      pushToast({ type: 'success', message: 'Watermark applied and downloaded.' });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted)
        pushToast({ type: 'error', title: 'Watermark failed', message: err?.message });
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  // ── Layer 2: Page Numbers ────────────────────────────────────────────────
  const applyPageNumbersOp = async (config) => {
    setShowPageNumbers(false);
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Adding page numbers…');
    setProcessingProgress(0);
    try {
      const base = await exportEditedPdf(sourceDocsForExport, pages);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(60);
      const blob = await applyPageNumbers(base, config);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      downloadBlob(blob, `${filename}-numbered.pdf`);
      pushToast({ type: 'success', message: 'Page numbers added.' });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted)
        pushToast({ type: 'error', title: 'Page numbers failed', message: err?.message });
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  // ── Layer 2: Metadata ────────────────────────────────────────────────────
  const openMetadata = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingStep('Reading metadata…');
    try {
      const blob = await exportEditedPdf(sourceDocsForExport, pages);
      setMetadataBlobUrl(blob);
      setShowMetadata(true);
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not read metadata', message: err?.message });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const applyMetadataOp = async (meta) => {
    setShowMetadata(false);
    if (!metadataBlobUrl) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Saving metadata…');
    setProcessingProgress(0);
    try {
      const blob = await updateMetadata(metadataBlobUrl, meta);
      setMetadataBlobUrl(null);
      if (abortControllerRef.current?.signal.aborted) return;
      setProcessingProgress(100);
      downloadBlob(blob, `${filename}.pdf`);
      pushToast({ type: 'success', message: 'Metadata saved.' });
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted)
        pushToast({ type: 'error', title: 'Metadata save failed', message: err?.message });
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const activePage = pages.find((p) => p.id === activePageId);
  const activeIndex = pages.findIndex((p) => p.id === activePageId);
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
          onDiscard={discardSession}
        />
      )}

      <UploadDropzone
        isDark={isDark}
        mode="pdfTools"
        onDrop={handleFileUpload}
        onFiles={handleFileUpload}
        inputId="pdfFileInput"
      />

      {isProcessing && (
        <ProcessingStatus
          isDark={isDark}
          step={processingStep}
          progress={processingProgress}
          onCancel={abortControllerRef.current ? cancelOperation : null}
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
            isProcessing={isProcessing}
            onToggleSelection={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedPages(new Set());
            }}
            onSelectAll={selectAll}
            allSelected={selectedPages.size === pages.length}
            onRotateAll={rotateAll}
            onRotateSelected={rotateSelected}
            onDeleteSelected={deleteSelected}
            onExtractSelected={extractSelected}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExportPdf={exportPdf}
            onExportImages={exportImages}
            onSplit={() => setShowSplit(true)}
            onPreview={openPreview}
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
          />
        </div>
      ) : (
        !isProcessing && (
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
          pdfBlob={metadataBlobUrl}
          onClose={() => { setShowMetadata(false); setMetadataBlobUrl(null); }}
          onApply={applyMetadataOp}
        />
      )}

      <Toasts isDark={isDark} toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
