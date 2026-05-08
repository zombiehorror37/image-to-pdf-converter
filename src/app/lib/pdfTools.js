// pdf-lib wrappers for all PDF Tools operations:
// rotate / reorder / delete / merge / split / annotate / watermark / page-numbers / metadata

let pdfLibPromise;
const loadPdfLib = async () => {
  if (!pdfLibPromise) pdfLibPromise = import('pdf-lib');
  return pdfLibPromise;
};

const sourceToBytes = async (source) => {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (source instanceof Uint8Array) return source;
  if (source instanceof Blob || source instanceof File) return new Uint8Array(await source.arrayBuffer());
  throw new Error('Unsupported PDF source for pdf-lib');
};

const loadDoc = async (source) => {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await sourceToBytes(source);
  return PDFDocument.load(bytes, { ignoreEncryption: true });
};

// ─── exportEditedPdf ────────────────────────────────────────────────────────
//
// pageOps[i] shape:
//   srcDocId, srcPageIndex (0-based), rotation (0/90/180/270),
//   annotations: {
//     highlights: [{x,y,w,h}],
//     inks:       [{points:[{x,y}], color:{r,g,b}, width}],
//     texts:      [{x,y,text,fontSize,color:{r,g,b}}],
//     shapes:     [{type:'rect'|'ellipse'|'line', x,y,w,h OR x1,y1,x2,y2,
//                   color:{r,g,b}, strokeWidth, filled}],
//     stamps:     [{x,y,label,color:{r,g,b},fontSize}],
//   }
//
// All coordinates are in PDF user-space (origin bottom-left).
export const exportEditedPdf = async (sourceDocs, pageOps) => {
  const { PDFDocument, degrees, rgb, StandardFonts } = await loadPdfLib();
  const out = await PDFDocument.create();

  // Embed fonts once for annotation drawing
  const font     = await out.embedFont(StandardFonts.Helvetica);
  const boldFont = await out.embedFont(StandardFonts.HelveticaBold);

  // Cache loaded source docs
  const loaded = new Map();
  for (const id in sourceDocs) {
    loaded.set(id, await loadDoc(sourceDocs[id]));
  }

  for (const op of pageOps) {
    const src = loaded.get(op.srcDocId);
    if (!src) continue;
    const [copied] = await out.copyPages(src, [op.srcPageIndex]);
    if (op.rotation) copied.setRotation(degrees(op.rotation));

    const ann = op.annotations || {};

    // ── Highlights ──
    for (const h of ann.highlights || []) {
      copied.drawRectangle({
        x: h.x, y: h.y, width: h.w, height: h.h,
        color: rgb(1, 0.92, 0.23),
        opacity: 0.4,
        borderWidth: 0,
      });
    }

    // ── Freehand inks ──
    for (const stroke of ann.inks || []) {
      const pts = stroke.points;
      const c   = stroke.color || { r: 1, g: 0, b: 0 };
      const lw  = stroke.width || 2;
      for (let i = 1; i < pts.length; i++) {
        copied.drawLine({
          start: { x: pts[i - 1].x, y: pts[i - 1].y },
          end:   { x: pts[i].x,     y: pts[i].y },
          thickness: lw,
          color: rgb(c.r, c.g, c.b),
          opacity: 0.9,
        });
      }
    }

    // ── Shapes (rect / ellipse / line) ──
    for (const s of ann.shapes || []) {
      const c  = s.color || { r: 0, g: 0, b: 0 };
      const lw = s.strokeWidth || 2;
      if (s.type === 'line') {
        copied.drawLine({
          start: { x: s.x1, y: s.y1 },
          end:   { x: s.x2, y: s.y2 },
          thickness: lw,
          color: rgb(c.r, c.g, c.b),
        });
      } else if (s.type === 'ellipse') {
        copied.drawEllipse({
          x: s.x + s.w / 2,
          y: s.y + s.h / 2,
          xScale: s.w / 2,
          yScale: s.h / 2,
          color:       s.filled ? rgb(c.r, c.g, c.b) : undefined,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: lw,
          opacity: s.filled ? 0.25 : 1,
        });
      } else {
        // rect
        copied.drawRectangle({
          x: s.x, y: s.y, width: s.w, height: s.h,
          color:       s.filled ? rgb(c.r, c.g, c.b) : undefined,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: lw,
          opacity: s.filled ? 0.25 : 1,
        });
      }
    }

    // ── Text annotations ──
    for (const t of ann.texts || []) {
      const c  = t.color || { r: 0, g: 0, b: 0 };
      const sz = t.fontSize || 14;
      try {
        copied.drawText(t.text, {
          x: t.x, y: t.y,
          size: sz,
          font,
          color: rgb(c.r, c.g, c.b),
        });
      } catch {
        // skip if text contains unsupported chars
      }
    }

    // ── Stamps ──
    for (const st of ann.stamps || []) {
      const c   = st.color || { r: 0.1, g: 0.4, b: 0.85 };
      const sz  = st.fontSize || 24;
      const pad = 6;
      let tw = sz * st.label.length * 0.6;
      try { tw = boldFont.widthOfTextAtSize(st.label, sz); } catch { /* use estimate */ }
      copied.drawRectangle({
        x: st.x - pad,
        y: st.y - pad,
        width:  tw + pad * 2,
        height: sz + pad * 2,
        borderColor: rgb(c.r, c.g, c.b),
        borderWidth: 1.5,
      });
      try {
        copied.drawText(st.label, {
          x: st.x, y: st.y,
          size: sz,
          font: boldFont,
          color: rgb(c.r, c.g, c.b),
        });
      } catch { /* skip */ }
    }

    out.addPage(copied);
  }

  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
};

// ─── applyWatermark ─────────────────────────────────────────────────────────
//
// config: { text, fontSize, color:{r,g,b}, opacity, rotation, pages:'all'|number[] }
export const applyWatermark = async (pdfBlob, config) => {
  const { PDFDocument, rgb, degrees, StandardFonts } = await loadPdfLib();
  const doc  = await loadDoc(pdfBlob);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const all  = doc.getPages();

  const targetPages = config.pages === 'all'
    ? all
    : (config.pages || []).map(i => all[i]).filter(Boolean);

  for (const page of targetPages) {
    const { width, height } = page.getSize();
    const text  = config.text  || 'WATERMARK';
    const size  = config.fontSize || 60;
    const c     = config.color || { r: 0.5, g: 0.5, b: 0.5 };
    const alpha = config.opacity ?? 0.25;
    const rot   = config.rotation ?? -45;

    // Center the text on the page
    let textW = size * text.length * 0.55;
    try { textW = font.widthOfTextAtSize(text, size); } catch { /* estimate */ }

    page.drawText(text, {
      x: (width  - textW) / 2,
      y: (height - size)  / 2,
      size,
      font,
      color:   rgb(c.r, c.g, c.b),
      opacity: alpha,
      rotate:  degrees(rot),
    });
  }

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
};

// ─── applyPageNumbers ────────────────────────────────────────────────────────
//
// config: { position, format, startAt, fontSize, color:{r,g,b} }
// position: 'bottom-center'|'bottom-left'|'bottom-right'|'top-center'|'top-left'|'top-right'
// format:   'N'|'Page N'|'N / T'|'N of T'
export const applyPageNumbers = async (pdfBlob, config) => {
  const { PDFDocument, rgb, StandardFonts } = await loadPdfLib();
  const doc    = await loadDoc(pdfBlob);
  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const pages  = doc.getPages();
  const total  = pages.length;
  const start  = config.startAt   ?? 1;
  const size   = config.fontSize  ?? 11;
  const c      = config.color     || { r: 0, g: 0, b: 0 };
  const margin = 20;

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const n = i + start;
    let label;
    switch (config.format) {
      case 'Page N': label = `Page ${n}`; break;
      case 'N / T':  label = `${n} / ${total}`; break;
      case 'N of T': label = `${n} of ${total}`; break;
      default:       label = `${n}`;
    }

    let tw = size * label.length * 0.55;
    try { tw = font.widthOfTextAtSize(label, size); } catch { /* estimate */ }

    let x, y;
    switch (config.position) {
      case 'bottom-left':  x = margin;               y = margin; break;
      case 'bottom-right': x = width - tw - margin;  y = margin; break;
      case 'top-center':   x = (width - tw) / 2;     y = height - margin - size; break;
      case 'top-left':     x = margin;               y = height - margin - size; break;
      case 'top-right':    x = width - tw - margin;  y = height - margin - size; break;
      default:             x = (width - tw) / 2;     y = margin; // bottom-center
    }

    page.drawText(label, { x, y, size, font, color: rgb(c.r, c.g, c.b) });
  });

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
};

// ─── readMetadata ────────────────────────────────────────────────────────────
export const readMetadata = async (pdfBlob) => {
  const doc = await loadDoc(pdfBlob);
  return {
    title:    doc.getTitle()    || '',
    author:   doc.getAuthor()   || '',
    subject:  doc.getSubject()  || '',
    keywords: (doc.getKeywords() || []).join(', '),
  };
};

// ─── updateMetadata ──────────────────────────────────────────────────────────
export const updateMetadata = async (pdfBlob, meta) => {
  const { PDFDocument } = await loadPdfLib();
  const doc = await loadDoc(pdfBlob);
  if (meta.title    !== undefined) doc.setTitle(meta.title);
  if (meta.author   !== undefined) doc.setAuthor(meta.author);
  if (meta.subject  !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) {
    const kw = meta.keywords.split(',').map(k => k.trim()).filter(Boolean);
    doc.setKeywords(kw);
  }
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
