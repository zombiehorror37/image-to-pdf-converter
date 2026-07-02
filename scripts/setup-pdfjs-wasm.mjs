// Sets up self-hosted pdf.js wasm codec assets under public/pdfjs/. Run once:
// `npm run setup:pdfjs` (and again whenever pdfjs-dist is upgraded — the wasm
// must match the bundled pdf.js version).
//
// pdf.js ≥5.7 decodes JBIG2/CCITT (jbig2.wasm), JPEG2000 (openjpeg.wasm) and
// ICC color profiles (qcms_bg.wasm) with wasm modules fetched at runtime from
// the `wasmUrl` passed to getDocument (see src/app/lib/pdfRender.js). Without
// it the fetch fails silently and scanned pages render without their text
// layer (images are skipped via ignoreErrors) — which also starves the
// auto-rotate OSD of text.
import { mkdirSync, copyFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist', 'wasm');
const out = join(root, 'public', 'pdfjs');
mkdirSync(out, { recursive: true });

for (const name of readdirSync(src)) {
  copyFileSync(join(src, name), join(out, name));
  console.log('copied', name);
}

console.log('done — pdf.js wasm assets ready in public/pdfjs/');
