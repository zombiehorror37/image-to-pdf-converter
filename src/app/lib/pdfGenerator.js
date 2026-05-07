import jsPDF from 'jspdf';
import { processImage } from './imageProcessing';
import { blobToDataURL, loadImageElement } from './utils';

class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

const checkSignal = (signal) => {
  if (signal?.aborted) throw new CancelledError();
};

const objectUrlFromBlob = (blob, urls) => {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
};

export const generatePDF = async (
  images,
  settings,
  onProgress = () => {},
  onStep = () => {},
  signal,
) => {
  if (images.length === 0) return null;

  const urls = [];
  let pdf;
  const totalImages = images.length;

  try {
    if (settings.preserveSize) {
      const pixelsToMM = 25.4 / settings.dpi;

      checkSignal(signal);
      const firstImage = images[0];
      onStep(`Processing image 1 of ${images.length}...`);
      const firstProcessedBlob = await processImage(firstImage, settings.quality);
      const firstImgElement = await loadImageElement(objectUrlFromBlob(firstProcessedBlob, urls));

      const firstWidth = firstImgElement.width * pixelsToMM;
      const firstHeight = firstImgElement.height * pixelsToMM;

      pdf = new jsPDF({
        orientation: firstWidth > firstHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [firstWidth, firstHeight],
      });

      const firstImageData = await blobToDataURL(firstProcessedBlob);
      pdf.addImage(firstImageData, 'JPEG', 0, 0, firstWidth, firstHeight);
      onProgress(Math.round((1 / totalImages) * 100));

      for (let i = 1; i < images.length; i++) {
        checkSignal(signal);
        onStep(`Processing image ${i + 1} of ${images.length}...`);

        const processedBlob = await processImage(images[i], settings.quality);
        const imgElement = await loadImageElement(objectUrlFromBlob(processedBlob, urls));

        const width = imgElement.width * pixelsToMM;
        const height = imgElement.height * pixelsToMM;

        pdf.addPage([width, height], height > width ? 'portrait' : 'landscape');

        const imageData = await blobToDataURL(processedBlob);
        pdf.addImage(imageData, 'JPEG', 0, 0, width, height);
        onProgress(Math.round(((i + 1) / totalImages) * 100));
      }
    } else {
      pdf = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.pageSize.toLowerCase(),
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < images.length; i++) {
        checkSignal(signal);
        onStep(`Processing image ${i + 1} of ${images.length}...`);

        if (i > 0) pdf.addPage();

        const processedBlob = await processImage(images[i], settings.quality);
        const imageData = await blobToDataURL(processedBlob);

        const imgElement = await loadImageElement(objectUrlFromBlob(processedBlob, urls));
        const imgWidth = imgElement.width;
        const imgHeight = imgElement.height;

        // fitToPage: true  → contain (whole image visible, may have margins)
        // fitToPage: false → cover (fill the page, may crop edges)
        const widthRatio = pageWidth / imgWidth;
        const heightRatio = pageHeight / imgHeight;
        const scale = settings.fitToPage
          ? Math.min(widthRatio, heightRatio)
          : Math.max(widthRatio, heightRatio);
        const finalWidth = imgWidth * scale;
        const finalHeight = imgHeight * scale;
        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;

        pdf.addImage(imageData, 'JPEG', x, y, finalWidth, finalHeight);
        onProgress(Math.round(((i + 1) / totalImages) * 100));
      }
    }

    onProgress(100);
    return pdf;
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
};

export { CancelledError };
