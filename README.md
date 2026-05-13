# Image to PDF Converter & PDF Editor

A fast, private web app for working with images and PDFs — fully in your browser. No file uploads, no accounts, no limits.

## Features

### Make PDF (image → PDF)
- **Multiple formats**: JPG, PNG, GIF, BMP, WebP, SVG, HEIC, TIFF, AVIF
- **ZIP support**: Upload a ZIP archive of images and convert them all at once
- **Clipboard paste**: Ctrl+V to paste images directly from clipboard
- **Drag & drop**: Easy file uploading with drop zone
- **Reorder pages**: Drag-and-drop or use up/down arrows on mobile
- **Rotate images**: 90° rotation controls per image or for all at once
- **Select & bulk edit**: Selection mode for rotating or deleting multiple images
- **Undo / Redo**: Full history for your edits
- **Settings**: Preserve original image dimensions, choose quality, DPI, page size, orientation, and fit-to-page

### Edit PDF
- **Merge**: Combine multiple PDFs into one
- **Split**: Extract pages or ranges into separate PDFs
- **Reorder / Delete pages**: Drag pages around or remove them
- **Rotate pages**: Per-page rotation applied on export
- **Annotations**: Highlights, freehand drawing, text, shapes, and stamps
- **Watermark**: Add a text watermark to all pages
- **Page numbers**: Automatically number pages
- **Metadata editor**: Edit title, author, subject, and keywords
- **Export to images**: Save all pages as JPEGs in a ZIP archive
- **Session persistence**: Your work is saved in the browser and restored on reload

### Privacy
- **No uploads**: All processing happens locally in your browser. Files never leave your device.

## Quick Start

```bash
git clone https://github.com/yourusername/image-to-pdf-converter.git
cd image-to-pdf-converter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Built With

- [Next.js](https://nextjs.org/) — React framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation from images
- [pdf-lib](https://pdf-lib.js.org/) — PDF manipulation (merge, split, annotate, metadata)
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering & thumbnails
- [JSZip](https://stuk.github.io/jszip/) — ZIP file handling
- [Lucide React](https://lucide.dev/) — Icons

## How to Use

1. **Upload**: Switch between "Make PDF" and "Edit PDF" tabs. Drop files or click to browse.
2. **Arrange**: Rotate and reorder images or pages. Use Ctrl+V to paste images from clipboard.
3. **Settings** (Make PDF): Choose page size, orientation, quality, and whether to preserve original dimensions.
4. **Export**: Click "Save as PDF" to download. All processing is instant and local.

## License

MIT License — see LICENSE file for details.
