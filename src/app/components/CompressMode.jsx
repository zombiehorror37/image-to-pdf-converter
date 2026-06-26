'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  FileText,
  Download,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Minimize2,
  Package,
} from 'lucide-react';
import UploadDropzone from './UploadDropzone';
import ProcessingStatus from './ProcessingStatus';
import EmptyState from './EmptyState';
import Toasts from './Toasts';
import { useToasts } from '../hooks/useToasts';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import {
  COMPRESSION_LEVELS,
  DEFAULT_LEVEL_ID,
  getLevel,
  compressPdf,
  optimizePdf,
} from '../lib/pdfCompress';
import { formatSize } from '../lib/utils';

const makeId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const baseName = (name) => name.replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '');

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

const isPdf = (f) =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isZip = (f) =>
  f.type === 'application/zip' ||
  f.type === 'application/x-zip-compressed' ||
  /\.zip$/i.test(f.name);

// Pull every .pdf out of a ZIP (recursively, skipping macOS resource forks).
const extractPdfsFromZip = async (file) => {
  const zip = await JSZip.loadAsync(file);
  const out = [];
  const entries = Object.values(zip.files).filter(
    (e) => !e.dir && /\.pdf$/i.test(e.name) && !e.name.includes('__MACOSX'),
  );
  for (const entry of entries) {
    const blob = await entry.async('blob');
    out.push({ name: entry.name.replace(/^.*[\\/]/, ''), file: blob, size: blob.size });
  }
  return out;
};

export default function CompressMode({ isDark, isActive, onSwitchMode }) {
  // items: { id, name, file (Blob), originalSize, status, result?, error? }
  // status: 'ready' | 'compressing' | 'done' | 'error'
  const [items, setItems] = useState([]);
  const [levelId, setLevelId] = useState(DEFAULT_LEVEL_ID);
  const [keepText, setKeepText] = useState(false);
  const op = useAsyncOperation();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  // Keep the latest items in a ref so the (long-running) compress loop reads
  // fresh data without being re-created on every state change.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const level = getLevel(levelId);

  const patchItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;

      const pdfFiles = files.filter(isPdf);
      const zipFiles = files.filter(isZip);
      const ignored = files.filter((f) => !isPdf(f) && !isZip(f));

      const collected = [];
      for (const f of pdfFiles) {
        collected.push({ name: f.name, file: f, size: f.size });
      }

      let zipFailures = 0;
      for (const z of zipFiles) {
        try {
          const fromZip = await extractPdfsFromZip(z);
          if (fromZip.length === 0) {
            pushToast({ type: 'info', message: `No PDFs found in ${z.name}.` });
          }
          collected.push(...fromZip);
        } catch {
          zipFailures += 1;
        }
      }

      if (zipFailures > 0) {
        pushToast({
          type: 'error',
          title: 'Couldn’t read ZIP',
          message: `${zipFailures} ZIP file${zipFailures > 1 ? 's' : ''} could not be opened.`,
        });
      }
      if (ignored.length > 0) {
        pushToast({
          type: 'info',
          message: `${ignored.length} unsupported file${ignored.length > 1 ? 's' : ''} skipped — PDFs and ZIPs only.`,
        });
      }
      if (collected.length === 0) return;

      const newItems = collected.map((c) => ({
        id: makeId(),
        name: c.name,
        file: c.file,
        originalSize: c.size,
        status: 'ready',
        result: null,
        error: null,
      }));
      setItems((prev) => [...prev, ...newItems]);
      pushToast({
        type: 'success',
        message: `Added ${newItems.length} PDF${newItems.length > 1 ? 's' : ''}.`,
      });
    },
    [pushToast],
  );

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));
  const clearAll = () => setItems([]);

  const pendingCount = useMemo(
    () => items.filter((it) => it.status === 'ready' || it.status === 'error').length,
    [items],
  );
  const doneItems = useMemo(() => items.filter((it) => it.status === 'done'), [items]);

  const compressAll = async () => {
    const queue = itemsRef.current.filter(
      (it) => it.status === 'ready' || it.status === 'error',
    );
    if (queue.length === 0) return;

    await op.run(
      async ({ signal, setStep, setProgress }) => {
        let completed = 0;
        for (const it of queue) {
          if (signal.aborted) return;
          setStep(`${keepText ? 'Optimizing' : 'Compressing'} ${it.name} (${completed + 1} of ${queue.length})…`);
          patchItem(it.id, { status: 'compressing', error: null });
          try {
            const result = keepText
              ? await optimizePdf(it.file, { signal })
              : await compressPdf(it.file, {
                  dpi: level.dpi,
                  quality: level.quality,
                  signal,
                  onProgress: (frac) => {
                    setProgress(Math.round(((completed + frac) / queue.length) * 100));
                  },
                });
            if (signal.aborted) return;
            patchItem(it.id, { status: 'done', result, error: null });
          } catch (err) {
            if (signal.aborted || err?.name === 'AbortError') {
              patchItem(it.id, { status: 'ready' });
              return;
            }
            patchItem(it.id, { status: 'error', error: err?.message || 'Compression failed' });
          }
          completed += 1;
          setProgress(Math.round((completed / queue.length) * 100));
        }

        const finished = itemsRef.current.filter((it) => it.status === 'done');
        if (finished.length > 0) {
          pushToast({ type: 'success', message: `Compressed ${finished.length} PDF${finished.length > 1 ? 's' : ''}.` });
        }
      },
      { initialStep: 'Compressing…' },
    );
  };

  const downloadOne = (it) => {
    if (!it.result) return;
    downloadBlob(it.result.blob, it.name);
  };

  const downloadAllZip = async () => {
    const ready = itemsRef.current.filter((it) => it.status === 'done' && it.result);
    if (ready.length === 0) return;
    await op.run(
      async ({ setStep }) => {
        setStep('Packaging ZIP…');
        const zip = new JSZip();
        const used = new Set();
        for (const it of ready) {
          let name = `${baseName(it.name)}.pdf`;
          let n = 1;
          while (used.has(name.toLowerCase())) name = `${baseName(it.name)}-${n++}.pdf`;
          used.add(name.toLowerCase());
          zip.file(name, it.result.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, 'compressed-pdfs.zip');
        pushToast({ type: 'success', message: `Downloaded ${ready.length} PDFs as compressed-pdfs.zip.` });
      },
      { initialStep: 'Packaging ZIP…' },
    );
  };

  const totals = useMemo(() => {
    let original = 0;
    let compressed = 0;
    for (const it of doneItems) {
      original += it.result.originalSize;
      compressed += it.result.compressedSize;
    }
    const saved = original - compressed;
    const pct = original > 0 ? Math.round((saved / original) * 100) : 0;
    return { original, compressed, saved, pct };
  }, [doneItems]);

  return (
    <>
      <UploadDropzone
        isDark={isDark}
        mode="compress"
        onDrop={addFiles}
        onFiles={addFiles}
        inputId="compressFileInput"
      />

      {op.isProcessing && (
        <ProcessingStatus
          isDark={isDark}
          step={op.step}
          progress={op.progress}
          onCancel={op.hasActive() ? op.cancel : null}
        />
      )}

      {items.length > 0 ? (
        <div className="mb-6 sm:mb-8 space-y-4 sm:space-y-6">
          {/* Compression level selector */}
          <div className={`rounded-2xl p-4 sm:p-6 border ${
            isDark
              ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
              : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
          }`}>
            <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              Compression
            </h3>

            {/* Keep-text toggle: switches between rasterize (max savings) and a
                lossless re-save (text stays selectable). */}
            <label className="flex items-start gap-3 cursor-pointer group mb-5">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={keepText}
                  onChange={(e) => setKeepText(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-10 h-6 rounded-full peer-checked:bg-blue-500 transition-colors ${
                  isDark ? 'bg-gray-600' : 'bg-gray-300'
                }`} />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <span className="font-medium block text-sm sm:text-base">Keep text selectable</span>
                <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Re-saves the PDF without rasterizing — preserves text & quality (smaller savings)
                </span>
              </div>
            </label>

            {!keepText ? (
              <>
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Compression level
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {COMPRESSION_LEVELS.map((l) => {
                    const active = l.id === levelId;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setLevelId(l.id)}
                        aria-pressed={active}
                        className={`text-left p-3 sm:p-4 rounded-xl border transition-all ${
                          active
                            ? 'border-blue-500 ring-1 ring-blue-500 ' + (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                            : isDark
                              ? 'border-gray-700 hover:border-gray-600 bg-gray-700/30'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="block font-semibold text-sm sm:text-base">{l.label}</span>
                        <span className={`block text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {l.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Pages are re-rendered as images to maximize compression — text is no longer selectable.
                  If a PDF can’t be made smaller, the original is kept.
                </p>
              </>
            ) : (
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Text, vectors, and image quality are preserved. Size savings are usually modest, and the
                original is kept if it’s already optimized.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={compressAll}
              disabled={op.isProcessing || pendingCount === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minimize2 className="w-4 h-4" />
              {pendingCount > 0 ? `Compress ${pendingCount} PDF${pendingCount > 1 ? 's' : ''}` : 'Compress'}
            </button>
            {doneItems.length > 0 && (
              <button
                onClick={downloadAllZip}
                disabled={op.isProcessing}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-white hover:bg-gray-100 text-gray-700 shadow-sm border border-gray-200'
                }`}
              >
                <Package className="w-4 h-4" />
                Download all (.zip)
              </button>
            )}
            <button
              onClick={clearAll}
              disabled={op.isProcessing}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 ${
                isDark ? 'text-gray-300 hover:bg-gray-700/60' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>

            {totals.original > 0 && (
              <div className={`ml-auto text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Saved <span className="font-semibold text-green-500">{formatSize(totals.saved)}</span>
                {' '}({totals.pct}%) · {formatSize(totals.original)} → {formatSize(totals.compressed)}
              </div>
            )}
          </div>

          {/* File list */}
          <div className={`rounded-2xl border overflow-hidden ${
            isDark ? 'border-gray-700/50' : 'border-gray-200 shadow-sm'
          }`}>
            {items.map((it, idx) => {
              const r = it.result;
              const pct = r && r.originalSize > 0
                ? Math.round(((r.originalSize - r.compressedSize) / r.originalSize) * 100)
                : 0;
              return (
                <div
                  key={it.id}
                  className={`flex items-center gap-3 p-3 sm:p-4 ${
                    idx > 0 ? (isDark ? 'border-t border-gray-700/50' : 'border-t border-gray-100') : ''
                  } ${isDark ? 'bg-gray-800/40' : 'bg-white'}`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                    <FileText className="w-5 h-5 text-red-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{it.name}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {it.status === 'done' && r ? (
                        r.optimized ? (
                          <span>{formatSize(r.originalSize)} · already optimized</span>
                        ) : (
                          <span>
                            {formatSize(r.originalSize)} → <span className="text-green-500 font-medium">{formatSize(r.compressedSize)}</span>
                            {' '}· saved {pct}%
                          </span>
                        )
                      ) : it.status === 'error' ? (
                        <span className="text-red-500">{it.error}</span>
                      ) : it.status === 'compressing' ? (
                        <span>Compressing…</span>
                      ) : (
                        <span>{formatSize(it.originalSize)}</span>
                      )}
                    </p>
                  </div>

                  {/* Status / actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {it.status === 'done' && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500 hidden sm:block" />
                        <button
                          onClick={() => downloadOne(it)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                            isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </>
                    )}
                    {it.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {it.status === 'compressing' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent" />
                    )}
                    {it.status !== 'compressing' && (
                      <button
                        onClick={() => removeItem(it.id)}
                        aria-label={`Remove ${it.name}`}
                        className={`p-1.5 rounded-lg transition-all ${
                          isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !op.isProcessing && (
          <EmptyState isDark={isDark} mode="compress" onSwitchMode={onSwitchMode} />
        )
      )}

      <Toasts isDark={isDark} toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
