// Web Worker that generates PDFs off the main thread.
// Receives images as data URLs, decodes them via createImageBitmap +
// OffscreenCanvas, and assembles a jsPDF document. Posts progress and the
// final blob back to main.

import jsPDF from 'jspdf';

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl);
  return res.blob();
};

const processImageInWorker = async (dataUrl, rotation, quality) => {
  const blob = await dataUrlToBlob(dataUrl);
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

// Build a one-page PDF (Blob) for a single image, honoring the same
// preserve-size / page-size / fit-to-page settings as the combined export.
// Used by `generateSeparate` so each image becomes its own PDF.
const buildSinglePagePdf = async (image, settings) => {
  const { blob, width, height } = await processImageInWorker(
    image.dataUrl,
    image.rotation,
    settings.quality,
  );
  const dataUrl = await blobToDataUrl(blob);
  let pdf;

  if (settings.preserveSize) {
    const pixelsToMM = 25.4 / settings.dpi;
    const wMm = width * pixelsToMM;
    const hMm = height * pixelsToMM;
    pdf = new jsPDF({
      orientation: wMm > hMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [wMm, hMm],
    });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, wMm, hMm);
  } else {
    pdf = new jsPDF({
      orientation: settings.orientation,
      unit: 'mm',
      format: settings.pageSize.toLowerCase(),
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scale = settings.fitToPage
      ? Math.min(pageWidth / width, pageHeight / height)
      : Math.max(pageWidth / width, pageHeight / height);
    const finalWidth = width * scale;
    const finalHeight = height * scale;
    pdf.addImage(
      dataUrl, 'JPEG',
      (pageWidth - finalWidth) / 2,
      (pageHeight - finalHeight) / 2,
      finalWidth, finalHeight,
    );
  }

  return pdf.output('blob');
};

const reportProgress = (done, total) => {
  const progress = Math.round((done / total) * 100);
  const step = done < total
    ? `Processing image ${done + 1} of ${total}...`
    : 'Finalizing PDF...';
  self.postMessage({ type: 'progress', progress, step });
};

const generate = async ({ images, settings }) => {
  const total = images.length;
  let pdf;

  if (settings.preserveSize) {
    const pixelsToMM = 25.4 / settings.dpi;

    reportProgress(0, total);
    const first = images[0];
    const { blob: firstBlob, width: fw, height: fh } = await processImageInWorker(
      first.dataUrl,
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

    const firstDataUrl = await blobToDataUrl(firstBlob);
    pdf.addImage(firstDataUrl, 'JPEG', 0, 0, firstWidth, firstHeight);
    reportProgress(1, total);

    for (let i = 1; i < total; i++) {
      const { blob: pBlob, width, height } = await processImageInWorker(
        images[i].dataUrl,
        images[i].rotation,
        settings.quality,
      );
      const wMm = width * pixelsToMM;
      const hMm = height * pixelsToMM;

      pdf.addPage([wMm, hMm], hMm > wMm ? 'portrait' : 'landscape');
      pdf.setPage(pdf.internal.getNumberOfPages());

      const imageDataUrl = await blobToDataUrl(pBlob);
      pdf.addImage(imageDataUrl, 'JPEG', 0, 0, wMm, hMm);

      reportProgress(i + 1, total);
    }
  } else {
    pdf = new jsPDF({
      orientation: settings.orientation,
      unit: 'mm',
      format: settings.pageSize.toLowerCase(),
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < total; i++) {
      reportProgress(i, total);

      if (i > 0) {
        pdf.addPage();
        pdf.setPage(pdf.internal.getNumberOfPages());
      }

      const { blob: pBlob, width, height } = await processImageInWorker(
        images[i].dataUrl,
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

      const imageDataUrl = await blobToDataUrl(pBlob);
      pdf.addImage(imageDataUrl, 'JPEG', x, y, finalWidth, finalHeight);
    }
    reportProgress(total, total);
  }

  self.postMessage({ type: 'progress', progress: 100, step: 'Finalizing PDF...' });
  const pdfBlob = pdf.output('blob');
  self.postMessage({ type: 'done', pdfBlob });
};

// One PDF per image (in input order), returned as an array of Blobs. The host
// names them and bundles a ZIP — keeps the worker focused on PDF building.
const generateSeparate = async ({ images, settings }) => {
  const total = images.length;
  const blobs = [];
  for (let i = 0; i < total; i++) {
    self.postMessage({
      type: 'progress',
      progress: Math.round((i / total) * 100),
      step: `Building PDF ${i + 1} of ${total}...`,
    });
    blobs.push(await buildSinglePagePdf(images[i], settings));
  }
  self.postMessage({ type: 'progress', progress: 100, step: 'Finalizing...' });
  self.postMessage({ type: 'doneSeparate', blobs });
};

self.onmessage = async (event) => {
  const type = event.data?.type;
  if (type !== 'generate' && type !== 'generateSeparate') return;
  try {
    if (type === 'generateSeparate') await generateSeparate(event.data);
    else await generate(event.data);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
