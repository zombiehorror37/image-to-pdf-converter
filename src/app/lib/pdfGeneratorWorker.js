// Main-thread orchestrator for the PDF worker. Spins up a fresh worker per
// generation, streams progress, supports cancellation via worker.terminate().

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

// Shared worker lifecycle: post `message`, stream progress, resolve when the
// worker reports `doneType` (mapped through `extract`), reject on error/abort.
const runWorker = (message, { onProgress = () => {}, onStep = () => {}, signal, doneType, extract }) =>
  new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url), {
        type: 'module',
      });
    } catch (err) {
      reject(new Error('Failed to create worker: ' + err.message));
      return;
    }

    let settled = false;
    const finalize = () => {
      if (settled) return false;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      worker.terminate();
      return true;
    };

    const onAbort = () => {
      if (finalize()) reject(new CancelledError());
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
      } else if (data.type === doneType) {
        if (finalize()) resolve(extract(data));
      } else if (data.type === 'error') {
        if (finalize()) reject(new Error(data.message || 'Worker failed'));
      }
    };

    worker.onerror = (err) => {
      if (finalize()) reject(new Error(err.message || 'Worker error'));
    };

    worker.postMessage(message);
  });

// Hand the data URLs straight to the worker — it can decode them off the UI
// thread via createImageBitmap. Avoids N fetches on main.
const toPayload = (images) =>
  images.map((img) => ({ dataUrl: img.preview, rotation: img.rotation || 0 }));

// Combine all images into a single multi-page PDF (Blob).
export const generatePDFInWorker = async (
  images,
  settings,
  onProgress = () => {},
  onStep = () => {},
  signal,
) => {
  if (images.length === 0) return null;
  onStep('Preparing images...');
  return runWorker(
    { type: 'generate', images: toPayload(images), settings },
    { onProgress, onStep, signal, doneType: 'done', extract: (d) => d.pdfBlob },
  );
};

// One single-page PDF per image, returned as an array of Blobs in input order.
export const generateSeparatePDFsInWorker = async (
  images,
  settings,
  onProgress = () => {},
  onStep = () => {},
  signal,
) => {
  if (images.length === 0) return [];
  onStep('Preparing images...');
  return runWorker(
    { type: 'generateSeparate', images: toPayload(images), settings },
    { onProgress, onStep, signal, doneType: 'doneSeparate', extract: (d) => d.blobs },
  );
};
