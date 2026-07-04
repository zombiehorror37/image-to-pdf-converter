// Local, offline auto-orientation via Tesseract OSD (Orientation & Script
// Detection). OSD needs Tesseract's *legacy* engine + the `osd` traineddata,
// all self-hosted under public/tesseract/ (see scripts/setup-tesseract.mjs) so
// user files never leave the browser and it works offline.
//
// tesseract.js + the OSD assets are heavy (~30MB), so the worker is created
// lazily on first use and cached for the rest of the session.

let workerPromise = null;

const loadWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const { createWorker } = await import('tesseract.js');
        return await createWorker('osd', 1, {
          legacyCore: true,
          legacyLang: true,
          workerPath: '/tesseract/worker.min.js',
          corePath: '/tesseract',
          langPath: '/tesseract',
          gzip: false, // we host the plain (un-gzipped) osd.traineddata
        });
      } catch (err) {
        workerPromise = null; // let a later call retry after a failed init
        throw err;
      }
    })();
  }
  return workerPromise;
};

// Orientation confidence below this is treated as "couldn't tell" — we leave
// the page/image untouched rather than risk a wrong flip (blank or sparse-text
// pages, photos). Tuned against fixtures; OSD confidence is a small float where
// solid detections are comfortably above ~1.
const CONFIDENCE_MIN = 1.0;

const norm = (deg) => (((deg % 360) + 360) % 360);

// Tesseract OSD's `orientation_degrees` is already the *clockwise* rotation to
// apply to bring the page upright (identity mapping) — verified in-browser
// against a known 90°-rotated fixture (applying 360−deg came out upside-down).
// The sign is the one tesseract.js quirk worth pinning down, so it lives here
// alone (see naptha/tesseract.js#859).
const correctionFor = (deg) => norm(deg);

// The idle worker holds ~30MB, so it's torn down after a minute without
// detections; the next detectCorrection re-creates it (assets come back from
// the browser cache in a second or two). The in-flight counter keeps the
// timer from firing while overlapping detections are still running.
const IDLE_TIMEOUT_MS = 60_000;
let idleTimer = null;
let activeDetections = 0;

const clearIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

const scheduleIdleTermination = () => {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    terminateAutoRotate();
  }, IDLE_TIMEOUT_MS);
};

// Detect the correction for one image-like input (canvas / dataURL / image).
// Returns the clockwise degrees to rotate it upright, plus whether we're
// confident enough to act on it.
export const detectCorrection = async (imageLike) => {
  clearIdleTimer();
  activeDetections++;
  try {
    const worker = await loadWorker();
    const { data } = await worker.detect(imageLike);
    const raw = norm(data?.orientation_degrees || 0);
    const confidence = data?.orientation_confidence ?? 0;
    return {
      correction: correctionFor(raw),
      confidence,
      certain: confidence >= CONFIDENCE_MIN,
      raw,
    };
  } finally {
    activeDetections--;
    if (activeDetections === 0) scheduleIdleTermination();
  }
};

// Draw an image source (dataURL / URL) onto a width-capped white canvas for
// detection — keeps OSD fast and gives transparent images an opaque background.
export const imageToDetectionCanvas = (src, maxWidth = 1200) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image for detection'));
    img.src = src;
  });

export const terminateAutoRotate = async () => {
  clearIdleTimer();
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
};
