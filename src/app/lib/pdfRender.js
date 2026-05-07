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
  const task = pdfjs.getDocument({ data });
  return task.promise;
};

// Render a page to a canvas at the given target width (in CSS pixels).
export const renderPageToCanvas = async (pdfDoc, pageNumber, targetWidth, rotation = 0) => {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1, rotation });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = Math.ceil(viewport.width * dpr);
  canvas.height = Math.ceil(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { canvas, width: viewport.width, height: viewport.height };
};

export const renderPageToDataUrl = async (pdfDoc, pageNumber, targetWidth, rotation = 0) => {
  const { canvas, width, height } = await renderPageToCanvas(pdfDoc, pageNumber, targetWidth, rotation);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height };
};
