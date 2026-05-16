// HEIC/HEIF decoder backed by heic2any.
// heic2any converts to PNG/JPEG; we then load it through a normal Image
// to capture pixel dimensions for the canvas pipeline.

import { loadImage, blobToDataUrl } from './imageDecode';

export const decodeHeic = async (file) => {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const dataUrl = await blobToDataUrl(blob);
  const img = await loadImage(dataUrl);
  return {
    dataUrl,
    width: img.width,
    height: img.height,
    rotationApplied: 0,
  };
};
