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
import { loadPdfDocument, renderPageToCanvas } from '../lib/pdfRender';
import { exportEditedPdf } from '../lib/pdfTools';
import { useHistory } from '../hooks/useHistory';
import { useToasts } from '../hooks/useToasts';

const THUMB_WIDTH = 240;

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

export default function PdfToolsMode({ isDark }) {
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

  const [selectedPages, setSelectedPages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [activePageId, setActivePageId] = useState(null);
  const [showSplit, setShowSplit] = useState(false);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const handleFileUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const pdfFiles = files.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfFiles.length === 0) {
        pushToast({ type: 'error', title: 'No PDFs found', message: 'Drop PDF files to use PDF Tools.' });
        return;
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
              annotations: { highlights: [], inks: [] },
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

  // Background thumbnail rendering for any pages without thumbs.
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

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isEditable =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditable) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const updatePage = (id, patch) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const rotatePage = (id) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    );
  };

  const removePage = (id) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    setSelectedPages((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
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
    setSelectedPages((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedPages.size === pages.length) setSelectedPages(new Set());
    else setSelectedPages(new Set(pages.map((p) => p.id)));
  };

  const rotateSelected = () => {
    setPages((prev) =>
      prev.map((p) =>
        selectedPages.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
      ),
    );
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

  const exportPdf = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingStep('Building PDF...');
    setProcessingProgress(0);
    try {
      const blob = await exportEditedPdf(sourceDocsForExport, pages);
      setProcessingProgress(100);
      downloadBlob(blob, 'edited.pdf');
      pushToast({ type: 'success', message: 'edited.pdf downloaded.' });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Export failed',
        message: err?.message || 'Could not produce PDF.',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const exportImages = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProcessingStep('Rendering pages...');
    setProcessingProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        setProcessingStep(`Rendering page ${i + 1} of ${pages.length}...`);
        setProcessingProgress(Math.round((i / pages.length) * 100));
        const page = pages[i];
        const doc = docsRef.current.get(page.srcDocId);
        if (!doc) continue;
        const { canvas } = await renderPageToCanvas(
          doc.pdfDoc,
          page.srcPageIndex + 1,
          1200,
          page.rotation || 0,
        );
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
        if (blob) zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, blob);
      }
      setProcessingStep('Compressing zip...');
      setProcessingProgress(95);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'pages.zip');
      pushToast({ type: 'success', message: `${pages.length} pages exported as pages.zip.` });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Image export failed',
        message: err?.message || 'Could not render pages.',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
    }
  };

  const performSplit = async (ranges) => {
    setShowSplit(false);
    if (!ranges || ranges.length === 0) return;
    setIsProcessing(true);
    setProcessingStep('Splitting PDF...');
    setProcessingProgress(0);
    try {
      for (let r = 0; r < ranges.length; r++) {
        const [start, end] = ranges[r];
        setProcessingStep(`Building part ${r + 1} of ${ranges.length}...`);
        const subset = pages.slice(start - 1, end);
        const blob = await exportEditedPdf(sourceDocsForExport, subset);
        downloadBlob(blob, `split-part-${r + 1}-pages-${start}-${end}.pdf`);
        setProcessingProgress(Math.round(((r + 1) / ranges.length) * 100));
      }
      pushToast({
        type: 'success',
        message: `Created ${ranges.length} ${ranges.length === 1 ? 'PDF' : 'PDFs'}.`,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Split failed',
        message: err?.message || 'Could not split PDF.',
      });
    } finally {
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
      <UploadDropzone
        isDark={isDark}
        mode="pdfTools"
        onDrop={handleFileUpload}
        onFiles={handleFileUpload}
        inputId="pdfFileInput"
      />

      {isProcessing && (
        <ProcessingStatus isDark={isDark} step={processingStep} progress={processingProgress} />
      )}

      {pages.length > 0 ? (
        <div className="mb-6 sm:mb-8">
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
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onExportPdf={exportPdf}
            onExportImages={exportImages}
            onSplit={() => setShowSplit(true)}
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
          <div
            className={`rounded-2xl p-6 sm:p-8 border ${
              isDark
                ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
                : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
            }`}
          >
            <h3 className={`text-lg sm:text-xl font-semibold mb-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              What you can do here
            </h3>
            <ul
              className={`text-sm sm:text-base space-y-2 max-w-2xl mx-auto ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <li>· View any PDF page-by-page with zoom and full navigation.</li>
              <li>· Rotate, reorder, or delete pages — drag to reorder.</li>
              <li>· Drop multiple PDFs to merge into one. Page order preserved.</li>
              <li>· Split a PDF into multiple files using ranges (e.g. 1-3, 5, 8-end).</li>
              <li>· Highlight or draw on pages — annotations are embedded in the saved PDF.</li>
              <li>· Export every page as a JPG image (zipped).</li>
            </ul>
          </div>
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
          onNext={() =>
            activeIndex < pages.length - 1 && setActivePageId(pages[activeIndex + 1].id)
          }
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

      <Toasts isDark={isDark} toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
