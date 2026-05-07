// Main-thread orchestrator for the PDF worker. Spins up a fresh worker per
// generation, streams progress, supports cancellation via worker.terminate().

import { CancelledError } from './pdfGenerator';

const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return res.blob();
};

export const generatePDFInWorker = async (
  images,
  settings,
  onProgress = () => {},
  onStep = () => {},
  signal,
) => {
  if (images.length === 0) return null;

  onStep('Preparing images...');
  const payloadImages = await Promise.all(
    images.map(async (img) => ({
      blob: await dataUrlToBlob(img.preview),
      rotation: img.rotation || 0,
    })),
  );

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url), {
      type: 'module',
    });

    let settled = false;
    const cleanup = () => {
      worker.terminate();
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new CancelledError());
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'progress') {
        onProgress(data.progress);
        if (data.step) onStep(data.step);
      } else if (data.type === 'done') {
        if (settled) return;
        settled = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        cleanup();
        resolve(data.pdfBlob);
      } else if (data.type === 'error') {
        if (settled) return;
        settled = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        cleanup();
        reject(new Error(data.message || 'Worker failed'));
      }
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      cleanup();
      reject(new Error(err.message || 'Worker error'));
    };

    worker.postMessage({ type: 'generate', images: payloadImages, settings });
  });
};
