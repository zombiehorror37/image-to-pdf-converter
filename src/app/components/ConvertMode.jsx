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
import { CancelledError } from '../lib/pdfGenerator';
import { generatePDFInWorker } from '../lib/pdfGeneratorWorker';
import { loadSettings, saveSettings } from '../lib/storage';
import { saveSession, loadSession, clearSession } from '../lib/storageDb';
import { useHistory } from '../hooks/useHistory';
import { useToasts } from '../hooks/useToasts';

const SESSION_KEY = 'convert';
const SETTINGS_KEY = 'convert';

const DEFAULT_SETTINGS = {
  preserveSize: true,
  quality: 0.92,
  dpi: 96,
  pageSize: 'A4',
  orientation: 'portrait',
  fitToPage: true,
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  const [filename, setFilename] = useState('converted-images');
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [pdfSettings, setPdfSettings] = useState(DEFAULT_SETTINGS);
  const [restorableSession, setRestorableSession] = useState(null);

  const abortControllerRef = useRef(null);
  const sessionSaveTimer = useRef(null);
  const skipNextSessionSave = useRef(false);
  const previewPdfUrlRef = useRef(null);

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // Revoke any lingering preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setPdfSettings(loadSettings(SETTINGS_KEY, DEFAULT_SETTINGS));
  }, []);

  useEffect(() => {
    saveSettings(SETTINGS_KEY, pdfSettings);
  }, [pdfSettings]);

  useEffect(() => {
    let cancelled = false;
    loadSession(SESSION_KEY).then((session) => {
      if (cancelled) return;
      if (session && Array.isArray(session.images) && session.images.length > 0) {
        setRestorableSession(session);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (skipNextSessionSave.current) {
      skipNextSessionSave.current = false;
      return;
    }
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    if (images.length === 0) {
      clearSession(SESSION_KEY);
      return;
    }
    sessionSaveTimer.current = setTimeout(() => {
      const lightImages = images.map((img) => ({
        id: img.id,
        name: img.name,
        width: img.width,
        height: img.height,
        rotation: img.rotation,
        size: img.size,
        preview: img.preview,
        thumb: img.thumb,
      }));
      saveSession(SESSION_KEY, { images: lightImages, filename });
    }, 600);
    return () => { if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current); };
  }, [images, filename]);

  const restoreSession = () => {
    if (!restorableSession) return;
    skipNextSessionSave.current = true;
    replaceImages(restorableSession.images);
    if (restorableSession.filename) setFilename(restorableSession.filename);
    setRestorableSession(null);
    pushToast({
      type: 'success',
      title: 'Session restored',
      message: `${restorableSession.images.length} ${restorableSession.images.length === 1 ? 'image' : 'images'} loaded.`,
    });
  };

  const discardSession = () => {
    clearSession(SESSION_KEY);
    setRestorableSession(null);
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

      setIsProcessing(true);
      setProcessingStep('Processing files...');
      setProcessingProgress(0);

      const newImages = [];
      const failures = [];
      const totalFiles = imageFiles.length;

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        setProcessingProgress(Math.round((i / totalFiles) * 100));

        if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
          setProcessingStep(`Extracting ${file.name}...`);
          try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);
            for (let entryName in zipContent.files) {
              const zipFile = zipContent.files[entryName];
              if (!zipFile.dir && isImageFile(entryName)) {
                try {
                  const blob = await zipFile.async('blob');
                  const imageFile = new File([blob], entryName, { type: getImageMimeType(entryName) });
                  newImages.push(await createImageObject(imageFile));
                } catch (err) {
                  failures.push({ name: entryName, reason: err?.message || 'Decode failed' });
                }
              }
            }
          } catch (err) {
            failures.push({ name: file.name, reason: err?.message || 'ZIP read failed' });
          }
        } else if (isImageFile(file.name)) {
          try {
            newImages.push(await createImageObject(file));
          } catch (err) {
            failures.push({ name: file.name, reason: err?.message || 'Decode failed' });
          }
        } else {
          failures.push({ name: file.name, reason: 'Unsupported file type' });
        }
      }

      setProcessingProgress(100);
      newImages.sort(naturalSort);
      if (newImages.length > 0) setImages((prev) => [...prev, ...newImages]);
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);

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
    },
    [setImages, pushToast],
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

  // Keyboard shortcuts (only when this mode is active)
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

  const cancelGeneration = () => { abortControllerRef.current?.abort(); };

  const runGeneration = async (forPreview) => {
    if (images.length === 0) return;
    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setProcessingStep('Generating PDF...');
    setProcessingProgress(0);
    try {
      const pdfBlob = await generatePDFInWorker(
        images,
        pdfSettings,
        (p) => setProcessingProgress(p),
        (s) => setProcessingStep(s),
        abortControllerRef.current.signal,
      );
      if (!pdfBlob) return;
      if (forPreview) {
        const url = URL.createObjectURL(pdfBlob);
        previewPdfUrlRef.current = url;
        setPreviewPdfUrl(url);
        setShowPreview(true);
      } else {
        setProcessingStep('Saving PDF...');
        const url = URL.createObjectURL(pdfBlob);
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
    } catch (err) {
      if (err instanceof CancelledError) {
        pushToast({ type: 'info', message: 'PDF generation cancelled.' });
      } else {
        pushToast({ type: 'error', title: 'PDF generation failed', message: err?.message || 'An unknown error occurred.' });
      }
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
      setProcessingStep('');
      setProcessingProgress(0);
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
          onDiscard={discardSession}
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

      {isProcessing && (
        <ProcessingStatus
          isDark={isDark}
          step={processingStep}
          progress={processingProgress}
          onCancel={abortControllerRef.current ? cancelGeneration : null}
        />
      )}

      {images.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <Toolbar
            isDark={isDark}
            imageCount={images.length}
            isProcessing={isProcessing}
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

      {images.length === 0 && !isProcessing && (
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
