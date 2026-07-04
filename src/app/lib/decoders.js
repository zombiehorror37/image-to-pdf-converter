import { applyExifOrientation, orientationSwapsAxes } from './exifOrientation';
import { loadImage, blobToDataUrl } from './imageDecode';

const isHeic = (file) =>
  /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);

const isTiff = (file) =>
  /\.(tif|tiff)$/i.test(file.name) || /tiff/i.test(file.type);

const readOrientation = async (file) => {
  try {
    const exifr = (await import('exifr')).default;
    const orientation = await exifr.orientation(file);
    return orientation || 1;
  } catch {
    return 1;
  }
};

// Modern browsers (Chrome 81+, Firefox 77+, Safari 13.1+) apply EXIF
// orientation during <img> decode: img.width/height and drawImage are already
// upright. Applying the EXIF transform on top of that double-rotates (and
// un-fixably mirrors orientations 2/4/5/7). Feature-test once with a 2×1
// orientation-6 JPEG: an auto-orienting browser reports it as 1×2.
const ORIENTATION_TEST_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';

let autoOrientPromise = null;
const browserAutoOrients = () => {
  if (!autoOrientPromise) {
    autoOrientPromise = loadImage(ORIENTATION_TEST_JPEG)
      .then((img) => img.width === 1)
      // If the probe fails to decode, assume auto-orientation — true for
      // every browser released since 2020.
      .catch(() => true);
  }
  return autoOrientPromise;
};

const decodeNative = async (file) => {
  const dataUrl = await blobToDataUrl(file);
  const img = await loadImage(dataUrl);
  const orientation = await readOrientation(file);

  if (orientation === 1) {
    return {
      dataUrl,
      width: img.width,
      height: img.height,
      rotationApplied: 0,
    };
  }

  // EXIF-tagged image: bake upright pixels into a canvas and strip the tag.
  // Re-encoding is required either way — jsPDF embeds the raw JPEG bytes and
  // PDF viewers ignore EXIF, so the pixels themselves must be upright.
  const canvas = document.createElement('canvas');
  if (await browserAutoOrients()) {
    // img is already upright; draw as-is.
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
  } else {
    const swap = orientationSwapsAxes(orientation);
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext('2d');
    applyExifOrientation(ctx, orientation, img.width, img.height);
    ctx.drawImage(img, 0, 0);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
    width: canvas.width,
    height: canvas.height,
    rotationApplied: orientation,
  };
};

export const decodeImageFile = async (file) => {
  if (isHeic(file)) {
    const { decodeHeic } = await import('./decoderHeic');
    return decodeHeic(file);
  }
  if (isTiff(file)) {
    const { decodeTiff } = await import('./decoderTiff');
    return decodeTiff(file);
  }
  return decodeNative(file);
};
