// pdf-lib wrappers for all PDF Tools operations:
// rotate / reorder / delete / merge / split / annotate / watermark / page-numbers / metadata

// @cantoo/pdf-lib is an API-compatible fork of pdf-lib that can decrypt the
// Standard security handler. Plain pdf-lib only *ignores* encryption — it
// copies the still-encrypted content streams verbatim, so exporting a
// "secured" PDF produced blank pages.
let pdfLibPromise;
const loadPdfLib = async () => {
  if (!pdfLibPromise) pdfLibPromise = import('@cantoo/pdf-lib');
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
  try {
    // An empty password decrypts permission-only / owner-password "secured"
    // PDFs (the common case) so copied pages keep their real content. Plain
    // PDFs load unaffected.
    return await PDFDocument.load(bytes, { password: '' });
  } catch (err) {
    // A genuine open-password PDF can't be decrypted blindly. Surface that
    // clearly instead of silently emitting blank pages.
    if (/password|encrypt/i.test(err?.message || '')) {
      throw new Error('This PDF is password-protected and can’t be exported. Remove the password first, then try again.');
    }
    throw err;
  }
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
    // Read the page's own /Rotate rather than trusting op.internalRotation,
    // which is resolved lazily by the thumbnail renderer and can still be null.
    const internal = ((copied.getRotation().angle % 360) + 360) % 360;
    const total = (internal + (op.rotation || 0)) % 360;
    if (op.rotation) copied.setRotation(degrees(total));

    // Annotation coordinates were captured in the *rotated display frame* the
    // user saw in the editor (origin bottom-left of the rotated view). Drawing
    // happens in the page's unrotated user space, so map them back. W/H are
    // the unrotated page size; the mapping mirrors pdf.js's viewport transform.
    const { width: W, height: H } = copied.getSize();
    const toUser = (ax, ay) => {
      switch (total) {
        case 90:  return { x: W - ay, y: ax };
        case 180: return { x: W - ax, y: H - ay };
        case 270: return { x: ay, y: H - ax };
        default:  return { x: ax, y: ay };
      }
    };
    // Axis-aligned display rect → axis-aligned user rect (rotations are
    // multiples of 90°, so boxes stay axis-aligned — just normalize corners).
    const toUserRect = (ax, ay, w, h) => {
      const p1 = toUser(ax, ay);
      const p2 = toUser(ax + w, ay + h);
      return {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        width: Math.abs(p2.x - p1.x),
        height: Math.abs(p2.y - p1.y),
      };
    };
    // Text drawn in user space gets rotated by /Rotate at display time;
    // pre-rotating by the same angle (pdf-lib: positive = CCW) keeps it
    // upright in the rotated view.
    const textRotate = degrees(total);

    const ann = op.annotations || {};

    // ── Highlights ──
    for (const h of ann.highlights || []) {
      copied.drawRectangle({
        ...toUserRect(h.x, h.y, h.w, h.h),
        color: rgb(1, 0.92, 0.23),
        opacity: 0.4,
        borderWidth: 0,
      });
    }

    // ── Freehand inks ──
    for (const stroke of ann.inks || []) {
      const pts = stroke.points.map((p) => toUser(p.x, p.y));
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
          start: toUser(s.x1, s.y1),
          end:   toUser(s.x2, s.y2),
          thickness: lw,
          color: rgb(c.r, c.g, c.b),
        });
      } else if (s.type === 'ellipse') {
        const r = toUserRect(s.x, s.y, s.w, s.h);
        copied.drawEllipse({
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          xScale: r.width / 2,
          yScale: r.height / 2,
          color:       s.filled ? rgb(c.r, c.g, c.b) : undefined,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: lw,
          opacity: s.filled ? 0.25 : 1,
        });
      } else {
        // rect
        copied.drawRectangle({
          ...toUserRect(s.x, s.y, s.w, s.h),
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
          ...toUser(t.x, t.y),
          size: sz,
          font,
          color: rgb(c.r, c.g, c.b),
          rotate: textRotate,
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
      // Center the box around the glyphs' visual center. PDF y grows up;
      // ascent ~0.7·sz / descent ~0.2·sz puts the visual center 0.25·sz
      // above the baseline, so the box bottom sits 0.25·sz below it.
      // Box computed in the display frame, then mapped, so it stays wrapped
      // around the (pre-rotated) label.
      copied.drawRectangle({
        ...toUserRect(st.x - pad, st.y - sz * 0.25 - pad, tw + pad * 2, sz + pad * 2),
        borderColor: rgb(c.r, c.g, c.b),
        borderWidth: 1.5,
      });
      try {
        copied.drawText(st.label, {
          ...toUser(st.x, st.y),
          size: sz,
          font: boldFont,
          color: rgb(c.r, c.g, c.b),
          rotate: textRotate,
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
