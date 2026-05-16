export const isImageFile = (filename) =>
  /\.(jpg|jpeg|png|gif|bmp|webp|svg|heic|heif|tif|tiff|avif)$/i.test(filename);

export const getImageMimeType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif',
  };
  return mimeTypes[ext] || 'image/jpeg';
};

export const naturalSort = (a, b) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

export const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Parse a range string like "1-3, 5, 8-10" into inclusive 1-based pairs.
export const parseRanges = (input, max) => {
  const out = [];
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part);
      if (n >= 1 && n <= max) out.push([n, n]);
    } else {
      const m = part.match(/^(\d+|start)\s*-\s*(\d+|end)$/i);
      if (!m) continue;
      let start = m[1].toLowerCase() === 'start' ? 1 : parseInt(m[1]);
      let end   = m[2].toLowerCase() === 'end'   ? max : parseInt(m[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 1 && end <= max && start <= end) {
        out.push([start, end]);
      }
    }
  }
  return out;
};
