// pdf.js wrapper. Lazy-loads the library and configures the worker.

let pdfjsPromise;

const loadPdfJs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      } catch {
        // Fall back to inline worker if URL pattern fails
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
};

export const loadPdfDocument = async (source) => {
  const pdfjs = await loadPdfJs();
  let data;
  if (source instanceof ArrayBuffer) {
    data = source;
  } else if (source instanceof Blob || source instanceof File) {
    data = await source.arrayBuffer();
  } else if (source instanceof Uint8Array) {
    // Avoid mutating the input buffer
    data = source.slice().buffer;
  } else {
    throw new Error('Unsupported PDF source');
  }
  // wasmUrl points at self-hosted copies of pdfjs-dist/wasm (see
  // scripts/setup-pdfjs-wasm.mjs). pdf.js ≥5.7 needs these to decode
  // JBIG2/CCITT, JPEG2000 and ICC profiles; without the option it fails
  // silently and scanned pages lose their (JBIG2) text layer entirely.
  const task = pdfjs.getDocument({ data, wasmUrl: '/pdfjs/' });
  return task.promise;
};

// Render a page to a canvas at the given target width (in CSS pixels).
// Pass `devicePixelRatio: 1` for thumbnails to skip the retina-multiplier cost.
export const renderPageToCanvas = async (pdfDoc, pageNumber, targetWidth, rotation = 0, opts = {}) => {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement('canvas');
  const dpr = opts.devicePixelRatio
    ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  canvas.width = Math.ceil(viewport.width * dpr);
  canvas.height = Math.ceil(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');

  // The retina multiplier must go through the `transform` render parameter:
  // pdf.js v5 resets the canvas context transform before drawing, so a manual
  // ctx.scale(dpr, dpr) is silently discarded and the page renders at 1x into
  // the dpr-scaled canvas (shrunken page in the top-left corner, rest blank).
  // `background: '#ffffff'` paints the page white so PDFs without their own
  // background don't come out transparent (black in JPEG thumbnails/exports).
  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
    background: '#ffffff',
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
  });
  await renderTask.promise;

  return { canvas, width: viewport.width, height: viewport.height };
};

export const renderPageToDataUrl = async (pdfDoc, pageNumber, targetWidth, rotation = 0) => {
  const { canvas, width, height } = await renderPageToCanvas(pdfDoc, pageNumber, targetWidth, rotation);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height };
};

// Render a canvas to a JPEG blob URL asynchronously. Caller owns the URL —
// remember to URL.revokeObjectURL when discarding.
export const canvasToBlobUrl = (canvas, quality = 0.7) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('canvas.toBlob returned null'));
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      quality,
    );
  });
