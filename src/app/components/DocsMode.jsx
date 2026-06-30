'use client';
import { useState } from 'react';
import {
  ShieldCheck, FileImage, Minimize2, Keyboard, Wand2, SlidersHorizontal,
  Save, Files, Eye, RotateCw, MousePointerClick, Clipboard, Archive,
  Layers, FileText, ArrowRight,
} from 'lucide-react';

// Static, screenshot-driven documentation. Covers Make PDF + Compress PDF and
// general behavior. (Edit PDF is intentionally not documented here.)
// Screenshots live in /public/docs and lazy-load when the tab is opened.

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: ShieldCheck },
  { id: 'make-pdf', label: 'Make PDF', icon: FileImage },
  { id: 'compress', label: 'Compress PDF', icon: Minimize2 },
  { id: 'tips', label: 'Tips & shortcuts', icon: Keyboard },
];

export default function DocsMode({ isDark, onSwitchMode }) {
  const card = isDark
    ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
    : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg';
  const subtle = isDark ? 'text-gray-400' : 'text-gray-600';
  const heading = isDark ? 'text-white' : 'text-gray-900';
  const chip = isDark ? 'bg-gray-700/60 text-gray-200' : 'bg-gray-100 text-gray-700';

  // Figure with caption. Falls back to a labelled placeholder if the screenshot
  // is missing, so the docs never show a broken-image icon.
  const Figure = ({ src, alt, caption }) => {
    const [failed, setFailed] = useState(false);
    return (
      <figure className={`my-5 rounded-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        {failed ? (
          <div className={`flex items-center justify-center h-48 text-sm ${isDark ? 'bg-gray-900/40 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
            {alt}
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full block"
          />
        )}
        {caption && (
          <figcaption className={`px-4 py-2.5 text-xs sm:text-sm border-t ${isDark ? 'border-gray-700 bg-gray-800/40 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
            {caption}
          </figcaption>
        )}
      </figure>
    );
  };

  const Feature = ({ icon: Icon, title, children }) => (
    <div className={`rounded-xl p-4 border ${isDark ? 'border-gray-700/60 bg-gray-800/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-blue-500 shrink-0" />
        <h4 className="font-semibold text-sm sm:text-base">{title}</h4>
      </div>
      <p className={`text-sm leading-relaxed ${subtle}`}>{children}</p>
    </div>
  );

  const SectionTitle = ({ icon: Icon, children }) => (
    <h2 className={`text-2xl sm:text-3xl font-bold flex items-center gap-3 mb-2 ${heading}`}>
      <Icon className="w-7 h-7 text-blue-500" />
      {children}
    </h2>
  );

  const Pill = ({ children }) => (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mr-1.5 mb-1.5 ${chip}`}>{children}</span>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Section nav */}
      <nav className="lg:w-56 lg:shrink-0">
        <div className={`rounded-2xl p-3 border lg:sticky lg:top-4 ${card}`}>
          <p className={`px-2 pb-2 text-xs font-semibold uppercase tracking-wide ${subtle}`}>On this page</p>
          <div className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                    isDark ? 'hover:bg-gray-700/70 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-blue-500" />
                  {s.label}
                </a>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <article className="flex-1 min-w-0 space-y-10">
        {/* ── Overview ── */}
        <section id="overview" className={`rounded-2xl p-5 sm:p-7 border scroll-mt-4 ${card}`}>
          <SectionTitle icon={ShieldCheck}>Welcome</SectionTitle>
          <p className={`text-sm sm:text-base leading-relaxed ${subtle}`}>
            This is an all-in-one toolkit for working with images and PDFs — right in your browser.
            It has three tools plus this guide:
          </p>
          <div className="grid sm:grid-cols-3 gap-3 my-5">
            <Feature icon={FileImage} title="Make PDF">Turn images into a single PDF, or one PDF per image.</Feature>
            <Feature icon={FileText} title="Edit PDF">View, rotate, merge, split, and annotate PDFs.</Feature>
            <Feature icon={Minimize2} title="Compress PDF">Shrink PDF file sizes, one file or many at once.</Feature>
          </div>
          <div className={`rounded-xl p-4 border-l-4 border-green-500 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
            <p className="flex items-start gap-2 text-sm sm:text-base">
              <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>
                <strong>100% private.</strong> Every file is processed locally on your device. Nothing is ever
                uploaded to a server — it even works offline.
              </span>
            </p>
          </div>
          <Figure
            src="/docs/overview-tabs.png"
            alt="The four tabs: Make PDF, Edit PDF, Compress PDF, Docs"
            caption="Switch tools using the tabs at the top. Use the sun/moon button to toggle light and dark themes."
          />
        </section>

        {/* ── Make PDF ── */}
        <section id="make-pdf" className={`rounded-2xl p-5 sm:p-7 border scroll-mt-4 ${card}`}>
          <SectionTitle icon={FileImage}>Make PDF</SectionTitle>
          <p className={`text-sm sm:text-base leading-relaxed ${subtle}`}>
            Combine any number of images into a polished PDF. This is the default tab when you open the app.
          </p>

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>1 · Add your images</h3>
          <p className={`text-sm leading-relaxed ${subtle}`}>There are four ways to bring images in:</p>
          <div className="grid sm:grid-cols-2 gap-3 my-4">
            <Feature icon={MousePointerClick} title="Drag &amp; drop or browse">Drop files onto the dropzone, or click it to pick from your device.</Feature>
            <Feature icon={Clipboard} title="Paste from clipboard">Copy an image anywhere and press <Pill>Ctrl</Pill>+<Pill>V</Pill> to drop it straight in.</Feature>
            <Feature icon={Archive} title="ZIP archives">Drop a ZIP of images and every picture inside is extracted automatically.</Feature>
            <Feature icon={FileImage} title="Lots of formats">Heic and Tiff included — they're decoded for you.</Feature>
          </div>
          <p className={`text-sm ${subtle}`}>Supported formats:</p>
          <div className="mt-2">
            {['JPG', 'PNG', 'GIF', 'BMP', 'WebP', 'SVG', 'HEIC', 'TIFF', 'AVIF', 'ZIP'].map((f) => <Pill key={f}>{f}</Pill>)}
          </div>
          <Figure
            src="/docs/convert-dropzone.png"
            alt="The Make PDF dropzone"
            caption="Drop images or a ZIP here, tap to browse, or paste with Ctrl+V."
          />

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>2 · Organize the pages</h3>
          <p className={`text-sm leading-relaxed ${subtle}`}>
            Each image becomes one page. Drag the thumbnails (or use the on-card arrows) to reorder — the order
            shown is the order in the PDF. Every card has a rotate and a remove button.
          </p>
          <Figure
            src="/docs/convert-grid.png"
            alt="Image grid with the toolbar above it"
            caption="The toolbar groups actions into menus so it stays uncluttered."
          />
          <div className="grid sm:grid-cols-2 gap-3 my-4">
            <Feature icon={SlidersHorizontal} title="Arrange menu">Sort by name or size, rotate every page 90°, or run Auto-rotate — all in one place.</Feature>
            <Feature icon={Wand2} title="Auto-rotate">Detects each image's true orientation (using on-device OCR) and straightens sideways or upside-down scans automatically.</Feature>
          </div>
          <Figure
            src="/docs/convert-arrange.png"
            alt="The Arrange menu open"
            caption="Arrange ▾ — sorting and bulk rotation, including Auto-rotate."
          />

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>3 · Select multiple at once</h3>
          <p className={`text-sm leading-relaxed ${subtle}`}>
            Hit <strong>Select</strong> to enter selection mode. Pick any subset, then rotate, auto-rotate,
            delete, or <strong>Extract</strong> just those images as separate PDFs.
          </p>
          <Figure
            src="/docs/convert-selection.png"
            alt="Selection mode action bar"
            caption="Selection mode adds bulk actions for the images you tick."
          />

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>4 · Dial in the output</h3>
          <p className={`text-sm leading-relaxed ${subtle}`}>
            The PDF Settings panel controls how the document is built:
          </p>
          <ul className={`list-disc pl-5 my-3 space-y-1.5 text-sm ${subtle}`}>
            <li><strong>Filename</strong> — the name of the downloaded file.</li>
            <li><strong>Preserve original image sizes</strong> — each page exactly matches its image. Turn it off to fit everything to a fixed page.</li>
            <li><strong>Page size &amp; orientation</strong> — A4, A3, Letter, or Legal, portrait or landscape (when not preserving sizes).</li>
            <li><strong>Fit to page</strong> — scales each image to fit within the page margins.</li>
            <li><strong>DPI &amp; Quality</strong> — trade file size against sharpness. A live size estimate updates as you adjust.</li>
          </ul>
          <Figure
            src="/docs/convert-settings.png"
            alt="PDF Settings panel"
            caption="Settings include a rough size estimate so you can balance quality and size."
          />

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>5 · Preview &amp; save</h3>
          <div className="grid sm:grid-cols-3 gap-3 my-4">
            <Feature icon={Eye} title="Preview">Opens the finished PDF in a viewer before you commit.</Feature>
            <Feature icon={Save} title="Save as one PDF">The default — all images combined into a single document.</Feature>
            <Feature icon={Files} title="Separate PDFs">From the Save ▾ menu: export one PDF per image, bundled in a ZIP.</Feature>
          </div>
          <p className={`text-sm leading-relaxed ${subtle}`}>
            The <strong>Save each image as separate PDF</strong> option is additive — your normal "Save as PDF"
            keeps working exactly as before. A single image downloads as one PDF; multiple images come as a ZIP.
          </p>
          <Figure
            src="/docs/convert-save.png"
            alt="The Save menu open showing separate-PDF option"
            caption="Save ▾ — combine into one PDF, or export each image as its own PDF."
          />
        </section>

        {/* ── Compress ── */}
        <section id="compress" className={`rounded-2xl p-5 sm:p-7 border scroll-mt-4 ${card}`}>
          <SectionTitle icon={Minimize2}>Compress PDF</SectionTitle>
          <p className={`text-sm sm:text-base leading-relaxed ${subtle}`}>
            Make PDFs smaller — a single file or a whole batch at once. Drop in PDFs directly, or a ZIP that
            contains PDFs and they'll be unpacked for you.
          </p>
          <Figure
            src="/docs/compress-dropzone.png"
            alt="The Compress dropzone"
            caption="Accepts PDF files and ZIP archives of PDFs."
          />

          <h3 className={`text-lg font-semibold mt-6 mb-2 ${heading}`}>Two ways to compress</h3>
          <div className="grid sm:grid-cols-2 gap-3 my-4">
            <Feature icon={Layers} title="Compression levels">Pages are re-rendered as images for maximum shrinkage. Pick a level from light to aggressive. Text is no longer selectable.</Feature>
            <Feature icon={FileText} title="Keep text selectable">A lossless re-save that preserves text and vectors. Savings are smaller, but the document stays fully selectable.</Feature>
          </div>
          <p className={`text-sm leading-relaxed ${subtle}`}>
            Run <strong>Compress</strong> and each file shows its before/after size and percentage saved. Download
            them one at a time, or grab everything as a single ZIP. If a PDF can't be made smaller, the original
            is kept untouched.
          </p>
          <Figure
            src="/docs/compress-options.png"
            alt="Compression options and per-file results"
            caption="Per-file savings, a running total, and a Download all (.zip) button."
          />
        </section>

        {/* ── Tips ── */}
        <section id="tips" className={`rounded-2xl p-5 sm:p-7 border scroll-mt-4 ${card}`}>
          <SectionTitle icon={Keyboard}>Tips &amp; shortcuts</SectionTitle>
          <ul className={`my-3 space-y-2.5 text-sm ${subtle}`}>
            <li className="flex items-center gap-3"><span><Pill>Ctrl</Pill>+<Pill>V</Pill></span> Paste an image from your clipboard into Make PDF.</li>
            <li className="flex items-center gap-3"><span><Pill>Ctrl</Pill>+<Pill>Z</Pill></span> Undo · <Pill>Ctrl</Pill>+<Pill>Shift</Pill>+<Pill>Z</Pill> Redo (Make PDF &amp; Edit PDF).</li>
            <li className="flex items-start gap-3"><Save className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" /> <span><strong>Session restore</strong> — your work is auto-saved locally, so if you close the tab by accident you can pick up where you left off.</span></li>
            <li className="flex items-start gap-3"><ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" /> <span><strong>Offline-ready</strong> — because nothing leaves your device, the whole app keeps working without a connection.</span></li>
          </ul>
          <button
            onClick={() => onSwitchMode?.('convert')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all"
          >
            Start making a PDF <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </article>
    </div>
  );
}
