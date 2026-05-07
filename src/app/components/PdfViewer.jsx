'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Highlighter, Pen, MousePointer2, Eraser, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { renderPageToCanvas } from '../lib/pdfRender';

const TOOLS = {
  pan: { label: 'View', Icon: MousePointer2 },
  highlight: { label: 'Highlight', Icon: Highlighter },
  pen: { label: 'Pen', Icon: Pen },
};

const PEN_COLORS = [
  { r: 0.85, g: 0.1, b: 0.1, hex: '#d91a1a' },
  { r: 0.1, g: 0.4, b: 0.85, hex: '#1a66d9' },
  { r: 0.1, g: 0.7, b: 0.2, hex: '#1ab233' },
  { r: 0.05, g: 0.05, b: 0.05, hex: '#0d0d0d' },
];

// Renders one page at large size with an SVG annotation overlay.
// Annotations are stored in PDF user-space coordinates (origin bottom-left)
// so they can be passed straight to pdf-lib at export time.
export default function PdfViewer({
  isDark,
  page,
  pdfDoc,
  pageIndexInArray,
  totalPages,
  onClose,
  onPrev,
  onNext,
  onAnnotationsChange,
  onRotate,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [renderInfo, setRenderInfo] = useState(null); // { width, height, pdfWidth, pdfHeight }
  const [tool, setTool] = useState('pan');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [drawing, setDrawing] = useState(null); // current in-progress annotation

  useEffect(() => {
    if (!pdfDoc || !page) return;
    let active = true;
    (async () => {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const targetWidth = Math.min(containerWidth - 32, 1100);
      const { canvas, width, height } = await renderPageToCanvas(
        pdfDoc,
        page.srcPageIndex + 1,
        targetWidth,
        page.rotation || 0,
      );
      if (!active) return;
      const node = canvasRef.current;
      if (!node) return;
      node.replaceChildren(canvas);
      // pdf-lib expects coords in PDF user-space points. Get the original
      // (unrotated) page size from pdf.js for the conversion math.
      const pdfPage = await pdfDoc.getPage(page.srcPageIndex + 1);
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation: page.rotation || 0 });
      setRenderInfo({
        width,
        height,
        pdfWidth: baseViewport.width,
        pdfHeight: baseViewport.height,
      });
    })();
    return () => {
      active = false;
    };
  }, [pdfDoc, page]);

  const annotations = page?.annotations || { highlights: [], inks: [] };

  // Convert SVG/screen pixel coords to PDF user-space coords (origin bottom-left).
  const toPdfCoords = (xPx, yPx) => {
    if (!renderInfo) return { x: 0, y: 0 };
    const sx = renderInfo.pdfWidth / renderInfo.width;
    const sy = renderInfo.pdfHeight / renderInfo.height;
    return { x: xPx * sx, y: (renderInfo.height - yPx) * sy };
  };

  // Convert PDF user-space (bottom-left origin) back to SVG/screen px (top-left).
  const toScreenRect = (pdfX, pdfY, pdfW, pdfH) => {
    if (!renderInfo) return { x: 0, y: 0, w: 0, h: 0 };
    const sx = renderInfo.width / renderInfo.pdfWidth;
    const sy = renderInfo.height / renderInfo.pdfHeight;
    return {
      x: pdfX * sx,
      y: renderInfo.height - (pdfY + pdfH) * sy,
      w: pdfW * sx,
      h: pdfH * sy,
    };
  };

  const toScreenPoint = (pdfX, pdfY) => {
    if (!renderInfo) return { x: 0, y: 0 };
    const sx = renderInfo.width / renderInfo.pdfWidth;
    const sy = renderInfo.height / renderInfo.pdfHeight;
    return { x: pdfX * sx, y: renderInfo.height - pdfY * sy };
  };

  const getLocalPoint = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (tool === 'pan' || !renderInfo) return;
    e.preventDefault();
    const p = getLocalPoint(e);
    if (tool === 'highlight') {
      setDrawing({ type: 'highlight', startX: p.x, startY: p.y, x: p.x, y: p.y });
    } else if (tool === 'pen') {
      setDrawing({ type: 'pen', points: [p] });
    }
  };

  const onPointerMove = (e) => {
    if (!drawing || !renderInfo) return;
    e.preventDefault();
    const p = getLocalPoint(e);
    if (drawing.type === 'highlight') {
      setDrawing({ ...drawing, x: p.x, y: p.y });
    } else if (drawing.type === 'pen') {
      setDrawing({ ...drawing, points: [...drawing.points, p] });
    }
  };

  const onPointerUp = () => {
    if (!drawing || !renderInfo) {
      setDrawing(null);
      return;
    }
    if (drawing.type === 'highlight') {
      const x1 = Math.min(drawing.startX, drawing.x);
      const y1 = Math.min(drawing.startY, drawing.y);
      const x2 = Math.max(drawing.startX, drawing.x);
      const y2 = Math.max(drawing.startY, drawing.y);
      if (x2 - x1 > 4 && y2 - y1 > 4) {
        const tl = toPdfCoords(x1, y1);
        const br = toPdfCoords(x2, y2);
        const newHighlight = {
          x: Math.min(tl.x, br.x),
          y: Math.min(tl.y, br.y),
          w: Math.abs(br.x - tl.x),
          h: Math.abs(tl.y - br.y),
        };
        onAnnotationsChange({
          ...annotations,
          highlights: [...(annotations.highlights || []), newHighlight],
        });
      }
    } else if (drawing.type === 'pen') {
      if (drawing.points.length > 1) {
        const pdfPoints = drawing.points.map((p) => toPdfCoords(p.x, p.y));
        onAnnotationsChange({
          ...annotations,
          inks: [...(annotations.inks || []), { points: pdfPoints, color, width: 2 }],
        });
      }
    }
    setDrawing(null);
  };

  const clearAnnotations = () => {
    onAnnotationsChange({ highlights: [], inks: [] });
  };

  const eraseLast = () => {
    const inks = annotations.inks || [];
    const hls = annotations.highlights || [];
    if (inks.length > 0) {
      onAnnotationsChange({ ...annotations, inks: inks.slice(0, -1) });
    } else if (hls.length > 0) {
      onAnnotationsChange({ ...annotations, highlights: hls.slice(0, -1) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm">
      <div
        className={`flex flex-col w-full ${
          isDark ? 'bg-gray-900' : 'bg-gray-100'
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 p-3 sm:p-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${
                isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
              }`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{page?.docName}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Page {pageIndexInArray + 1} of {totalPages}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {Object.entries(TOOLS).map(([key, t]) => {
              const Icon = t.Icon;
              const active = tool === key;
              return (
                <button
                  key={key}
                  onClick={() => setTool(key)}
                  title={t.label}
                  className={`p-2 rounded-lg transition-all ${
                    active
                      ? 'bg-blue-500 text-white'
                      : isDark
                        ? 'bg-gray-800 hover:bg-gray-700'
                        : 'bg-white hover:bg-gray-100 shadow-sm'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}

            {tool === 'pen' && (
              <div className="flex items-center gap-1 ml-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color.hex === c.hex ? 'border-blue-500' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Color ${c.hex}`}
                  />
                ))}
              </div>
            )}

            <div className={`mx-1 w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

            <button
              onClick={() => onRotate(page.id)}
              title="Rotate"
              className={`p-2 rounded-lg transition-all ${
                isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={eraseLast}
              title="Undo last annotation"
              disabled={(annotations.highlights?.length || 0) + (annotations.inks?.length || 0) === 0}
              className={`p-2 rounded-lg transition-all disabled:opacity-30 ${
                isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
              }`}
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              onClick={clearAnnotations}
              disabled={(annotations.highlights?.length || 0) + (annotations.inks?.length || 0) === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 ${
                isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
              }`}
            >
              Clear all
            </button>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
          <div className="relative inline-block" style={{ touchAction: tool === 'pan' ? 'auto' : 'none' }}>
            <div ref={canvasRef} />
            {renderInfo && (
              <svg
                width={renderInfo.width}
                height={renderInfo.height}
                viewBox={`0 0 ${renderInfo.width} ${renderInfo.height}`}
                className={`absolute inset-0 ${tool === 'pan' ? 'pointer-events-none' : 'cursor-crosshair'}`}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              >
                {(annotations.highlights || []).map((h, i) => {
                  const r = toScreenRect(h.x, h.y, h.w, h.h);
                  return (
                    <rect
                      key={`h-${i}`}
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      fill="#ffeb3b"
                      fillOpacity="0.4"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  );
                })}
                {(annotations.inks || []).map((stroke, i) => {
                  if (stroke.points.length < 2) return null;
                  const screenPts = stroke.points.map((p) => toScreenPoint(p.x, p.y));
                  const d = screenPts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                    .join(' ');
                  const c = stroke.color || { r: 0.85, g: 0.1, b: 0.1 };
                  return (
                    <path
                      key={`i-${i}`}
                      d={d}
                      stroke={`rgb(${c.r * 255},${c.g * 255},${c.b * 255})`}
                      strokeWidth={stroke.width || 2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {drawing?.type === 'highlight' && (
                  <rect
                    x={Math.min(drawing.startX, drawing.x)}
                    y={Math.min(drawing.startY, drawing.y)}
                    width={Math.abs(drawing.x - drawing.startX)}
                    height={Math.abs(drawing.y - drawing.startY)}
                    fill="#ffeb3b"
                    fillOpacity="0.35"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                )}
                {drawing?.type === 'pen' && drawing.points.length > 1 && (
                  <path
                    d={drawing.points
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                      .join(' ')}
                    stroke={color.hex}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            )}
          </div>
        </div>

        <div
          className={`flex items-center justify-between p-3 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <button
            onClick={onPrev}
            disabled={pageIndexInArray === 0}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all disabled:opacity-30 ${
              isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {tool === 'pan'
              ? 'Pick a tool to highlight or annotate.'
              : `Drag to ${tool === 'highlight' ? 'highlight' : 'draw'}.`}
          </p>
          <button
            onClick={onNext}
            disabled={pageIndexInArray >= totalPages - 1}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all disabled:opacity-30 ${
              isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
            }`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
