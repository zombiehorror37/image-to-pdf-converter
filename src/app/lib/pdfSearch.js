// Page-text extraction for select-by-text ("find pages containing…").
//
// Text is pulled once per page via pdf.js getTextContent and cached per
// document, so the first search pays the extraction cost and repeat searches
// are instant. WeakMap keys on the pdf.js document instance — replacing or
// closing a document frees its cache automatically.

const textCache = new WeakMap(); // pdfDoc → Map(pageNumber → normalized text)

// Lowercased, whitespace-collapsed text so callers can substring-match a
// query normalized the same way. Returns '' for pages with no text layer
// (e.g. scans without OCR).
export const getPageTextCached = async (pdfDoc, pageNumber) => {
  let cache = textCache.get(pdfDoc);
  if (!cache) {
    cache = new Map();
    textCache.set(pdfDoc, cache);
  }
  if (cache.has(pageNumber)) return cache.get(pageNumber);

  const page = await pdfDoc.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  cache.set(pageNumber, text);
  return text;
};

export const normalizeQuery = (query) =>
  query.replace(/\s+/g, ' ').trim().toLowerCase();
