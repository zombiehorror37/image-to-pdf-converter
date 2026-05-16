// Main-thread orchestrator for the PDF worker. Spins up a fresh worker per
// generation, streams progress, supports cancellation via worker.terminate().

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

export const generatePDFInWorker = async (
  images,
  settings,
  onProgress = () => {},
  onStep = () => {},
  signal,
) => {
  if (images.length === 0) return null;

  onStep('Preparing images...');

  // Hand the data URLs straight to the worker — it can decode them off the
  // UI thread via createImageBitmap. Avoids N fetches on main.
  const payloadImages = images.map((img) => ({
    dataUrl: img.preview,
    rotation: img.rotation || 0,
  }));

  return new Promise((resolve, reject) => {
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
      } else if (data.type === 'done') {
        if (finalize()) resolve(data.pdfBlob);
      } else if (data.type === 'error') {
        if (finalize()) reject(new Error(data.message || 'Worker failed'));
      }
    };

    worker.onerror = (err) => {
      if (finalize()) reject(new Error(err.message || 'Worker error'));
    };

    worker.postMessage({ type: 'generate', images: payloadImages, settings });
  });
};
