'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import UploadDropzone from './UploadDropzone';
import SettingsPanel from './SettingsPanel';
import ProcessingStatus from './ProcessingStatus';
import Toolbar from './Toolbar';
import ImageGrid from './ImageGrid';
import EmptyState from './EmptyState';
import PreviewModal from './PreviewModal';
import Toasts from './Toasts';
import SessionRestoreBanner from './SessionRestoreBanner';
import { isImageFile, getImageMimeType, naturalSort } from '../lib/utils';
import { createImageObject } from '../lib/imageProcessing';
import { CancelledError, generatePDFInWorker } from '../lib/pdfGeneratorWorker';
import { useHistory } from '../hooks/useHistory';
import { useToasts } from '../hooks/useToasts';
import { usePersistedSettings } from '../hooks/usePersistedSettings';
import { useSessionPersistence } from '../hooks/useSessionPersistence';
import { useEditorShortcuts } from '../hooks/useEditorShortcuts';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

const SESSION_KEY = 'convert';
const SETTINGS_KEY = 'convert';
const DECODE_CONCURRENCY = 4;

const DEFAULT_SETTINGS = {
  preserveSize: true,
  quality: 0.92,
  dpi: 96,
  pageSize: 'A4',
  orientation: 'portrait',
  fitToPage: true,
};

// Run `fn` over `items` with at most `limit` operations in flight.
// Preserves index order in the returned array.
const runWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
};

export default function ConvertMode({ isDark, isActive, onSwitchMode }) {
  const {
    value: images,
    setValue: setImages,
    replace: replaceImages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory([]);

  const [filename, setFilename] = useState('converted-images');
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [estimatedSize, setEstimatedSize] = useState(0);

  const [pdfSettings, setPdfSettings] = usePersistedSettings(SETTINGS_KEY, DEFAULT_SETTINGS);

  const op = useAsyncOperation();
  const previewPdfUrlRef = useRef(null);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const { restorable, skipNextSave, discard, consumeRestorable } = useSessionPersistence({
    key: SESSION_KEY,
    deps: [images, filename],
    payloadFn: () => ({
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        width: img.width,
        height: img.height,
        rotation: img.rotation,
        size: img.size,
        preview: img.preview,
        thumb: img.thumb,
      })),
      filename,
    }),
    isEmpty: () => images.length === 0,
  });

  // Filter restorable to require images array
  const restorableSession =
    restorable && Array.isArray(restorable.images) && restorable.images.length > 0
      ? restorable
      : null;

  // Revoke any lingering preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current);
    };
  }, []);

  const restoreSession = () => {
    if (!restorableSession) return;
    skipNextSave();
    replaceImages(restorableSession.images);
    if (restorableSession.filename) setFilename(restorableSession.filename);
    consumeRestorable();
    pushToast({
      type: 'success',
      title: 'Session restored',
      message: `${restorableSession.images.length} ${restorableSession.images.length === 1 ? 'image' : 'images'} loaded.`,
    });
  };

  const handleFileUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;

      // Cross-mode routing: if only PDFs are dropped, suggest Edit PDF
      const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      const imageFiles = files.filter((f) => isImageFile(f.name) || f.type === 'application/zip' || f.name.endsWith('.zip'));

      if (pdfFiles.length > 0 && imageFiles.length === 0) {
        pushToast({
          type: 'info',
          title: 'PDF files detected',
          message: 'Switch to the Edit PDF tab to work with PDFs.',
          duration: 6000,
        });
        return;
      }
      if (pdfFiles.length > 0 && imageFiles.length > 0) {
        pushToast({
          type: 'info',
          message: `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} skipped — use the Edit PDF tab for PDFs.`,
        });
      }

      await op.run(async ({ setStep, setProgress }) => {
        setStep('Processing files...');

        // 1) Flatten ZIPs into a list of plain image Files.
        const allImageFiles = [];
        const failures = [];
        for (const file of imageFiles) {
          if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            setStep(`Extracting ${file.name}...`);
            try {
              const zip = new JSZip();
              const zipContent = await zip.loadAsync(file);
              for (const entryName in zipContent.files) {
                const zipFile = zipContent.files[entryName];
                if (!zipFile.dir && isImageFile(entryName)) {
                  try {
                    const blob = await zipFile.async('blob');
                    allImageFiles.push(new File([blob], entryName, { type: getImageMimeType(entryName) }));
                  } catch (err) {
                    failures.push({ name: entryName, reason: err?.message || 'Decode failed' });
                  }
                }
              }
            } catch (err) {
              failures.push({ name: file.name, reason: err?.message || 'ZIP read failed' });
            }
          } else if (isImageFile(file.name)) {
            allImageFiles.push(file);
          } else {
            failures.push({ name: file.name, reason: 'Unsupported file type' });
          }
        }

        // 2) Decode in parallel (bounded). Track progress as decodes complete.
        setStep('Decoding images...');
        let done = 0;
        const total = allImageFiles.length;
        const newImages = total === 0 ? [] : (
          await runWithConcurrency(allImageFiles, DECODE_CONCURRENCY, async (file) => {
            try {
              const obj = await createImageObject(file);
              done++;
              setProgress(Math.round((done / total) * 100));
              return obj;
            } catch (err) {
              failures.push({ name: file.name, reason: err?.message || 'Decode failed' });
              done++;
              setProgress(Math.round((done / total) * 100));
              return null;
            }
          })
        ).filter(Boolean);

        newImages.sort(naturalSort);
        if (newImages.length > 0) setImages((prev) => [...prev, ...newImages]);

        if (failures.length > 0) {
          const sample = failures.slice(0, 3).map((f) => `${f.name}: ${f.reason}`).join('\n');
          const more = failures.length > 3 ? `\n…and ${failures.length - 3} more` : '';
          pushToast({
            type: 'error',
            title: `${failures.length} ${failures.length === 1 ? 'file' : 'files'} couldn't be added`,
            message: sample + more,
            duration: 9000,
          });
        }
        if (newImages.length > 0 && failures.length === 0) {
          pushToast({ type: 'success', message: `Added ${newImages.length} ${newImages.length === 1 ? 'image' : 'images'}.` });
        }
      });
    },
    [op, pushToast, setImages],
  );

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e) => {
      if (!isActive) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFileUpload(imageFiles);
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFileUpload, isActive]);

  useEditorShortcuts(undo, redo, isActive);

  // Estimated size
  useEffect(() => {
    if (images.length === 0) { setEstimatedSize(0); return; }
    let totalBytes = 0;
    images.forEach((img) => {
      totalBytes += img.width * img.height * 0.5 * pdfSettings.quality;
    });
    totalBytes += images.length * 1024 + 10240;
    setEstimatedSize(totalBytes);
  }, [images, pdfSettings.quality]);

  const removeImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedImages((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const rotateImage = (id) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img)));
  };

  const rotateAll = () => {
    setImages((prev) => prev.map((img) => ({ ...img, rotation: (img.rotation + 90) % 360 })));
  };

  const toggleImageSelection = (id) => {
    setSelectedImages((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedImages.size === images.length) setSelectedImages(new Set());
    else setSelectedImages(new Set(images.map((img) => img.id)));
  };

  const deleteSelected = () => {
    setImages((prev) => prev.filter((img) => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
    setIsSelectionMode(false);
  };

  const rotateSelected = () => {
    setImages((prev) => prev.map((img) =>
      selectedImages.has(img.id) ? { ...img, rotation: (img.rotation + 90) % 360 } : img,
    ));
  };

  const moveImage = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const reorderImages = (fromIndex, toIndex) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const runGeneration = async (forPreview) => {
    if (images.length === 0) return;
    const result = await op.run(async ({ signal, setStep, setProgress }) => {
      setStep('Generating PDF...');
      try {
        return await generatePDFInWorker(
          images,
          pdfSettings,
          (p) => setProgress(p),
          (s) => setStep(s),
          signal,
        );
      } catch (err) {
        if (err instanceof CancelledError) {
          pushToast({ type: 'info', message: 'PDF generation cancelled.' });
          return undefined;
        }
        pushToast({ type: 'error', title: 'PDF generation failed', message: err?.message || 'An unknown error occurred.' });
        return undefined;
      }
    });

    if (!result) return;
    if (forPreview) {
      const url = URL.createObjectURL(result);
      previewPdfUrlRef.current = url;
      setPreviewPdfUrl(url);
      setShowPreview(true);
    } else {
      const url = URL.createObjectURL(result);
      const a = document.createElement('a');
      a.href = url;
      const safeName = filename.trim() || 'converted-images';
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast({ type: 'success', message: `${safeName}.pdf downloaded.` });
    }
  };

  const closePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    previewPdfUrlRef.current = null;
    setPreviewPdfUrl(null);
    setShowPreview(false);
  };

  const downloadFromPreview = () => {
    if (!previewPdfUrl) return;
    const safeName = filename.trim() || 'converted-images';
    const a = document.createElement('a');
    a.href = previewPdfUrl;
    a.download = `${safeName}.pdf`;
    a.click();
    pushToast({ type: 'success', message: `${safeName}.pdf downloaded.` });
  };

  return (
    <>
      {restorableSession && (
        <SessionRestoreBanner
          isDark={isDark}
          count={restorableSession.images.length}
          unit="image"
          updatedAt={restorableSession.updatedAt || Date.now()}
          onRestore={restoreSession}
          onDiscard={discard}
        />
      )}

      <UploadDropzone
        isDark={isDark}
        mode="convert"
        onDrop={handleFileUpload}
        onFiles={handleFileUpload}
        inputId="fileInput"
      />

      {images.length > 0 && (
        <SettingsPanel
          mode="convert"
          isDark={isDark}
          filename={filename}
          onFilenameChange={setFilename}
          settings={pdfSettings}
          onSettingsChange={setPdfSettings}
          estimatedSize={estimatedSize}
        />
      )}

      {op.isProcessing && (
        <ProcessingStatus
          isDark={isDark}
          step={op.step}
          progress={op.progress}
          onCancel={op.hasActive() ? op.cancel : null}
        />
      )}

      {images.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <Toolbar
            isDark={isDark}
            imageCount={images.length}
            isProcessing={op.isProcessing}
            isSelectionMode={isSelectionMode}
            selectedCount={selectedImages.size}
            allSelected={selectedImages.size === images.length}
            onToggleSelectionMode={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedImages(new Set());
            }}
            onSelectAll={selectAll}
            onPreview={() => runGeneration(true)}
            onConvert={() => runGeneration(false)}
            onRotateSelected={rotateSelected}
            onRotateAll={rotateAll}
            onDeleteSelected={deleteSelected}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <ImageGrid
            images={images}
            isDark={isDark}
            isSelectionMode={isSelectionMode}
            selectedImages={selectedImages}
            onReorder={reorderImages}
            onToggleSelection={toggleImageSelection}
            onRotate={rotateImage}
            onRemove={removeImage}
            onMove={moveImage}
          />
        </div>
      )}

      {images.length === 0 && !op.isProcessing && (
        <EmptyState isDark={isDark} mode="convert" onSwitchMode={onSwitchMode} />
      )}

      {showPreview && (
        <PreviewModal
          isDark={isDark}
          pdfUrl={previewPdfUrl}
          onClose={closePreview}
          onDownload={downloadFromPreview}
        />
      )}

      <Toasts isDark={isDark} toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
