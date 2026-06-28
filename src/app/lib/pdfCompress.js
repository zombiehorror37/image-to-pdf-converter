// Client-side PDF compression.
//
// The only reliable way to meaningfully shrink an arbitrary PDF in the browser
// is to re-render each page to a raster image at a reduced resolution/quality
// and rebuild the document around those images. This is what aggressive
// "compress PDF" tools do — it trades selectable text/vector crispness for a
// much smaller file. Pages keep their original physical size and rotation.
//
// If the rasterised result isn't actually smaller (already-optimised or
// vector/text-only PDFs), the original bytes are kept instead so we never hand
// back a *bigger* file.

import { loadPdfDocument, renderPageToCanvas } from './pdfRender';

// @cantoo/pdf-lib is an API-compatible fork of pdf-lib that can decrypt the
// Standard security handler, so the keep-text re-save below works on "secured"
// PDFs instead of emitting blank/corrupt pages.
let pdfLibPromise;
const loadPdfLib = async () => {
  if (!pdfLibPromise) pdfLibPromise = import('@cantoo/pdf-lib');
  return pdfLibPromise;
};

// Render dimensions are capped so a huge page can't blow past the browser's
// max canvas size (varies, but ~8k on a side is the safe ceiling).
const MAX_RENDER_PX = 5000;

// dpi  — target render resolution; lower = smaller file, softer image.
// quality — JPEG quality for the re-encoded page (0–1).
export const COMPRESSION_LEVELS = [
  { id: 'light',   label: 'Light',       hint: 'Best quality, modest savings', dpi: 200, quality: 0.82 },
  { id: 'balanced', label: 'Recommended', hint: 'Great balance of size & quality', dpi: 144, quality: 0.7 },
  { id: 'strong',  label: 'Strong',      hint: 'Smaller file, visible softening', dpi: 110, quality: 0.6 },
  { id: 'extreme', label: 'Extreme',     hint: 'Smallest file, for screen viewing', dpi: 80, quality: 0.5 },
];

export const DEFAULT_LEVEL_ID = 'balanced';

export const getLevel = (id) =>
  COMPRESSION_LEVELS.find((l) => l.id === id) ||
  COMPRESSION_LEVELS.find((l) => l.id === DEFAULT_LEVEL_ID);

const toBytes = async (source) => {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (source instanceof Blob || source instanceof File) {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new Error('Unsupported PDF source');
};

const loadDoc = async (bytes) => {
  const { PDFDocument } = await loadPdfLib();
  try {
    // Empty password decrypts permission-only "secured" PDFs; plain PDFs load
    // unaffected. Without this the re-save copies still-encrypted streams.
    return await PDFDocument.load(bytes, { password: '' });
  } catch (err) {
    if (/password|encrypt/i.test(err?.message || '')) {
      throw new Error('This PDF is password-protected and can’t be processed. Remove the password first, then try again.');
    }
    throw err;
  }
};

// Lossless "keep text" path: re-serialize the PDF with object streams and drop
// unused/duplicated structure. Text, vectors, and image quality are left
// untouched, so the savings are usually modest — but the file stays fully
// selectable and print-sharp. Falls back to the original when the rewrite
// isn't actually smaller.
export const optimizePdf = async (source, { signal } = {}) => {
  const originalBytes = await toBytes(source);
  const originalSize = originalBytes.byteLength;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // pdf-lib reads the buffer in place; hand it a copy so the original bytes
  // stay intact for the keep-original fallback.
  const doc = await loadDoc(originalBytes.slice());
  const pages = doc.getPageCount();
  const bytes = await doc.save({ useObjectStreams: true });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const compressedSize = bytes.byteLength;

  if (compressedSize >= originalSize) {
    return {
      blob: new Blob([originalBytes], { type: 'application/pdf' }),
      originalSize,
      compressedSize: originalSize,
      pages,
      optimized: true,
    };
  }

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    originalSize,
    compressedSize,
    pages,
    optimized: false,
  };
};

const canvasToJpegBytes = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Failed to encode page image'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      quality,
    );
  });

// Compress one PDF. Returns:
//   { blob, originalSize, compressedSize, pages, optimized }
// `optimized` is true when the source was already smaller than anything we
// could produce, so the returned blob is the original untouched bytes.
export const compressPdf = async (
  source,
  { dpi, quality, signal, onProgress } = {},
) => {
  const originalBytes = await toBytes(source);
  const originalSize = originalBytes.byteLength;

  // pdf.js wants its own copy — it transfers/detaches the buffer it's given.
  const pdfDoc = await loadPdfDocument(originalBytes.slice());
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();

  const numPages = pdfDoc.numPages;

  for (let i = 1; i <= numPages; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const page = await pdfDoc.getPage(i);
    // getViewport's rotation parameter REPLACES the page's internal /Rotate,
    // so fold the page's own rotation in to render it the way it displays.
    const rotation = page.rotate || 0;
    const baseViewport = page.getViewport({ scale: 1, rotation });

    const targetWidth = Math.min(
      Math.round((baseViewport.width / 72) * dpi),
      MAX_RENDER_PX,
    );
    const { canvas } = await renderPageToCanvas(pdfDoc, i, targetWidth, rotation, {
      devicePixelRatio: 1,
    });

    const jpegBytes = await canvasToJpegBytes(canvas, quality);
    // Free the canvas backing store right away — large PDFs otherwise pile up
    // many full-page bitmaps before GC catches up.
    canvas.width = 0;
    canvas.height = 0;

    const img = await out.embedJpg(jpegBytes);
    // Keep the page at its original point size so physical dimensions are
    // unchanged; the rotated raster is drawn full-bleed.
    const newPage = out.addPage([baseViewport.width, baseViewport.height]);
    newPage.drawImage(img, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height,
    });

    onProgress?.(i / numPages);
  }

  const bytes = await out.save({ useObjectStreams: true });
  const compressedSize = bytes.byteLength;

  if (compressedSize >= originalSize) {
    return {
      blob: new Blob([originalBytes], { type: 'application/pdf' }),
      originalSize,
      compressedSize: originalSize,
      pages: numPages,
      optimized: true,
    };
  }

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    originalSize,
    compressedSize,
    pages: numPages,
    optimized: false,
  };
};
