// TIFF decoder backed by utif.
// Decodes the first IFD (page) to RGBA, paints to a canvas, exports as JPEG.

export const decodeTiff = async (file) => {
  const UTIF = (await import('utif')).default;
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error('No images found in TIFF');
  }
  const ifd = ifds[0];
  UTIF.decodeImage(buffer, ifd);
  const rgba = UTIF.toRGBA8(ifd);
  const width = ifd.width;
  const height = ifd.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imageData, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width,
    height,
    rotationApplied: 0,
  };
};
