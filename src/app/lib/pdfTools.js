// pdf-lib wrappers for the operations the PDF Tools mode exposes:
// rotate pages, reorder, delete, merge, split, embed highlight + ink
// annotations, and rasterize pages to images.

let pdfLibPromise;
const loadPdfLib = async () => {
  if (!pdfLibPromise) pdfLibPromise = import('pdf-lib');
  return pdfLibPromise;
};

const sourceToBytes = async (source) => {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (source instanceof Uint8Array) return source;
  if (source instanceof Blob || source instanceof File) {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new Error('Unsupported PDF source for pdf-lib');
};

const loadDoc = async (source) => {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await sourceToBytes(source);
  return PDFDocument.load(bytes, { ignoreEncryption: true });
};

// Apply per-page operations and return a Blob of the resulting PDF.
//
// pageOps[i] shape: {
//   srcDocId, srcPageIndex (0-based), rotation (0/90/180/270),
//   annotations: { highlights: [{x,y,w,h}], inks: [{points: [{x,y}], color, width}] }
// }
//
// Coordinates are in PDF user-space units, with origin at the bottom-left.
export const exportEditedPdf = async (sourceDocs, pageOps) => {
  const { PDFDocument, degrees, rgb } = await loadPdfLib();
  const out = await PDFDocument.create();

  // Cache loaded docs by id
  const loaded = new Map();
  for (const id in sourceDocs) {
    loaded.set(id, await loadDoc(sourceDocs[id]));
  }

  for (const op of pageOps) {
    const src = loaded.get(op.srcDocId);
    if (!src) continue;
    const [copied] = await out.copyPages(src, [op.srcPageIndex]);
    if (op.rotation) copied.setRotation(degrees(op.rotation));

    // Highlight annotations: yellow rectangles drawn under the page with multiply blend
    if (op.annotations?.highlights?.length) {
      for (const h of op.annotations.highlights) {
        copied.drawRectangle({
          x: h.x,
          y: h.y,
          width: h.w,
          height: h.h,
          color: rgb(1, 0.92, 0.23),
          opacity: 0.4,
          borderWidth: 0,
        });
      }
    }
    // Freehand ink: drawn as a series of short line segments
    if (op.annotations?.inks?.length) {
      for (const stroke of op.annotations.inks) {
        const pts = stroke.points;
        const c = stroke.color || { r: 1, g: 0, b: 0 };
        const lw = stroke.width || 2;
        for (let i = 1; i < pts.length; i++) {
          copied.drawLine({
            start: { x: pts[i - 1].x, y: pts[i - 1].y },
            end: { x: pts[i].x, y: pts[i].y },
            thickness: lw,
            color: rgb(c.r, c.g, c.b),
            opacity: 0.9,
          });
        }
      }
    }

    out.addPage(copied);
  }

  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
