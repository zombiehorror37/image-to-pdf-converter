import { applyExifOrientation, orientationSwapsAxes } from './exifOrientation';

const isHeic = (file) =>
  /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);

const isTiff = (file) =>
  /\.(tif|tiff)$/i.test(file.name) || /tiff/i.test(file.type);

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const readOrientation = async (file) => {
  try {
    const exifr = (await import('exifr')).default;
    const orientation = await exifr.orientation(file);
    return orientation || 1;
  } catch {
    return 1;
  }
};

const decodeNative = async (file) => {
  const dataUrl = await fileToDataUrl(file);
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

  const swap = orientationSwapsAxes(orientation);
  const canvas = document.createElement('canvas');
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext('2d');
  applyExifOrientation(ctx, orientation, img.width, img.height);
  ctx.drawImage(img, 0, 0);

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
