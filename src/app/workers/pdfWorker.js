// Web Worker that generates PDFs off the main thread.
// Receives images as Blobs, renders them via OffscreenCanvas, and assembles
// a jsPDF document. Posts progress updates and the final blob back to main.

import jsPDF from 'jspdf';

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const processImageInWorker = async (blob, rotation, quality) => {
  const bitmap = await createImageBitmap(blob);
  const w = bitmap.width;
  const h = bitmap.height;
  const swap = rotation === 90 || rotation === 270;
  const canvas = new OffscreenCanvas(swap ? h : w, swap ? w : h);
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob: outBlob, width: canvas.width, height: canvas.height };
};

const generate = async ({ images, settings }) => {
  const total = images.length;
  let pdf;

  if (settings.preserveSize) {
    const pixelsToMM = 25.4 / settings.dpi;

    self.postMessage({ type: 'progress', progress: 0, step: `Processing image 1 of ${total}...` });
    const first = images[0];
    const { blob: firstBlob, width: fw, height: fh } = await processImageInWorker(
      first.blob,
      first.rotation,
      settings.quality,
    );
    const firstWidth = fw * pixelsToMM;
    const firstHeight = fh * pixelsToMM;

    pdf = new jsPDF({
      orientation: firstWidth > firstHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [firstWidth, firstHeight],
    });

    pdf.addImage(await blobToDataUrl(firstBlob), 'JPEG', 0, 0, firstWidth, firstHeight);
    self.postMessage({ type: 'progress', progress: Math.round((1 / total) * 100), step: `Processing image 1 of ${total}...` });

    for (let i = 1; i < images.length; i++) {
      self.postMessage({ type: 'progress', progress: Math.round((i / total) * 100), step: `Processing image ${i + 1} of ${total}...` });
      const { blob: pBlob, width, height } = await processImageInWorker(
        images[i].blob,
        images[i].rotation,
        settings.quality,
      );
      const wMm = width * pixelsToMM;
      const hMm = height * pixelsToMM;
      pdf.addPage([wMm, hMm], hMm > wMm ? 'portrait' : 'landscape');
      pdf.addImage(await blobToDataUrl(pBlob), 'JPEG', 0, 0, wMm, hMm);
      self.postMessage({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), step: `Processing image ${i + 1} of ${total}...` });
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
      self.postMessage({ type: 'progress', progress: Math.round((i / total) * 100), step: `Processing image ${i + 1} of ${total}...` });
      if (i > 0) pdf.addPage();
      const { blob: pBlob, width, height } = await processImageInWorker(
        images[i].blob,
        images[i].rotation,
        settings.quality,
      );
      const widthRatio = pageWidth / width;
      const heightRatio = pageHeight / height;
      const scale = settings.fitToPage
        ? Math.min(widthRatio, heightRatio)
        : Math.max(widthRatio, heightRatio);
      const finalWidth = width * scale;
      const finalHeight = height * scale;
      const x = (pageWidth - finalWidth) / 2;
      const y = (pageHeight - finalHeight) / 2;
      pdf.addImage(await blobToDataUrl(pBlob), 'JPEG', x, y, finalWidth, finalHeight);
      self.postMessage({ type: 'progress', progress: Math.round(((i + 1) / total) * 100), step: `Processing image ${i + 1} of ${total}...` });
    }
  }

  self.postMessage({ type: 'progress', progress: 100, step: 'Finalizing PDF...' });
  const pdfBlob = pdf.output('blob');
  self.postMessage({ type: 'done', pdfBlob });
};

self.onmessage = async (event) => {
  if (event.data?.type !== 'generate') return;
  try {
    await generate(event.data);
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
