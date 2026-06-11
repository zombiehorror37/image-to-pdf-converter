// Generates test PDFs for manual verification:
//  - test-a4.pdf: 3 A4 portrait pages with big labels
//  - test-letter-landscape.pdf: 3 letter landscape pages
//  - test-rotated.pdf: 2 pages with /Rotate 90 (simulates a scanned doc)
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('test-fixtures', { recursive: true });

const make = async (name, pages, { rotate = 0 } = {}) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const [i, [w, h, label, color]] of pages.entries()) {
    const page = doc.addPage([w, h]);
    page.drawRectangle({ x: 10, y: 10, width: w - 20, height: h - 20, borderColor: rgb(...color), borderWidth: 4 });
    page.drawText(`${label} p${i + 1}`, { x: 40, y: h / 2, size: 48, font, color: rgb(...color) });
    page.drawCircle({ x: 60, y: h - 60, size: 30, color: rgb(...color) });
    if (rotate) page.setRotation(degrees(rotate));
  }
  writeFileSync(`test-fixtures/${name}`, await doc.save());
  console.log('wrote test-fixtures/' + name);
};

await make('test-a4.pdf', [
  [595, 842, 'A4 RED', [0.8, 0.1, 0.1]],
  [595, 842, 'A4 GREEN', [0.1, 0.6, 0.1]],
  [595, 842, 'A4 BLUE', [0.1, 0.2, 0.8]],
]);
await make('test-letter-landscape.pdf', [
  [792, 612, 'LTR ORANGE', [0.9, 0.5, 0]],
  [792, 612, 'LTR PURPLE', [0.5, 0.1, 0.7]],
  [792, 612, 'LTR TEAL', [0, 0.5, 0.5]],
]);
await make('test-rotated.pdf', [
  [595, 842, 'ROT MAGENTA', [0.85, 0, 0.5]],
  [595, 842, 'ROT NAVY', [0, 0.1, 0.5]],
], { rotate: 90 });
