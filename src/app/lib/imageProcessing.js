import { decodeImageFile } from './decoders';

const THUMB_MAX = 480;

const makeThumb = (dataUrl, width, height) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

export const createImageObject = async (file) => {
  const { dataUrl, width, height, rotationApplied } = await decodeImageFile(file);
  const thumb = (await makeThumb(dataUrl, width, height)) ?? dataUrl;
  return {
    id: Date.now() + Math.random(),
    preview: dataUrl,
    thumb,
    name: file.name,
    width,
    height,
    rotation: 0,
    size: file.size,
    rotationApplied,
  };
};

export const processImage = (imageObj, quality) =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const { width, height } = img;
      const rotation = imageObj.rotation;

      if (rotation === 90 || rotation === 270) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);

      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = imageObj.preview;
  });
