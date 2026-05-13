'use client';
import { useEffect, useRef, useState } from 'react';
import {
  X, Highlighter, Pen, MousePointer2, Eraser, RotateCw,
  ChevronLeft, ChevronRight, Type, Square, Circle, Minus as LineIcon,
} from 'lucide-react';
import { renderPageToCanvas } from '../lib/pdfRender';

const COLORS = [
  { r: 0.05, g: 0.05, b: 0.05, hex: '#0d0d0d' },
  { r: 0.85, g: 0.1,  b: 0.1,  hex: '#d91a1a' },
  { r: 0.1,  g: 0.4,  b: 0.85, hex: '#1a66d9' },
  { r: 0.1,  g: 0.7,  b: 0.2,  hex: '#1ab233' },
  { r: 0.6,  g: 0.1,  b: 0.8,  hex: '#9919cc' },
  { r: 1,    g: 0.55, b: 0,    hex: '#ff8c00' },
];

const STAMPS = [
  { label: 'DRAFT',        color: { r: 0.1,  g: 0.4,  b: 0.85 }, hex: '#1a66d9' },
  { label: 'APPROVED',     color: { r: 0.05, g: 0.55, b: 0.15 }, hex: '#0d8c26' },
  { label: 'CONFIDENTIAL', color: { r: 0.85, g: 0.1,  b: 0.1  }, hex: '#d91a1a' },
  { label: 'REVIEWED',     color: { r: 0.5,  g: 0.3,  b: 0.0  }, hex: '#804d00' },
  { label: 'VOID',         color: { r: 0.5,  g: 0.0,  b: 0.0  }, hex: '#800000' },
];

const STROKE_WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [10, 14, 18, 24, 36];

const TOOLS = [
  { id: 'pan',     Icon: MousePointer2, label: 'View' },
  { id: 'highlight',Icon: Highlighter,  label: 'Highlight' },
  { id: 'pen',     Icon: Pen,           label: 'Pen' },
  { id: 'text',    Icon: Type,          label: 'Text' },
  { id: 'rect',    Icon: Square,        label: 'Rectangle' },
  { id: 'ellipse', Icon: Circle,        label: 'Ellipse' },
  { id: 'line',    Icon: LineIcon,      label: 'Line' },
  { id: 'stamp',   Icon: null,          label: 'Stamp' },
  { id: 'eraser',  Icon: Eraser,        label: 'Eraser' },
];

const COLOR_TOOLS  = new Set(['pen', 'text', 'rect', 'ellipse', 'line']);
const WIDTH_TOOLS  = new Set(['pen', 'rect', 'ellipse', 'line']);
const FILL_TOOLS   = new Set(['rect', 'ellipse']);

const pointToSegDist = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

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
  onStampAllPages,
  onRotate,
}) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const textInputRef = useRef(null);

  const [renderInfo,   setRenderInfo]   = useState(null);
  const [tool,         setTool]         = useState('pan');
  const [color,        setColor]        = useState(COLORS[0]);
  const [strokeWidth,  setStrokeWidth]  = useState(2);
  const [filled,       setFilled]       = useState(false);
  const [fontSize,     setFontSize]     = useState(14);
  const [stampIndex,    setStampIndex]    = useState(0);
  const [stampAllPages, setStampAllPages] = useState(false);
  const [drawing,       setDrawing]       = useState(null);
  const [pendingText,  setPendingText]  = useState(null);
  const [textValue,    setTextValue]    = useState('');

  useEffect(() => {
    if (!pdfDoc || !page) return;
    let active = true;
    const capturedPageId = page.id;
    (async () => {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const targetWidth = Math.min(containerWidth - 32, 1100);
      const totalRotation = ((page.internalRotation || 0) + (page.rotation || 0)) % 360;
      const { canvas, width, height } = await renderPageToCanvas(
        pdfDoc, page.srcPageIndex + 1, targetWidth, totalRotation,
      );
      if (!active) return;
      const node = canvasRef.current;
      if (!node) return;
      // Guard against out-of-order renders: only commit if this is still the active page.
      if (node.dataset.pageId && node.dataset.pageId !== capturedPageId) return;
      node.dataset.pageId = capturedPageId;
      node.replaceChildren(canvas);
      if (!active) return;
      const pdfPage = await pdfDoc.getPage(page.srcPageIndex + 1);
      if (!active) return;
      const vp = pdfPage.getViewport({ scale: 1, rotation: totalRotation });
      setRenderInfo({ width, height, pdfWidth: vp.width, pdfHeight: vp.height });
    })();
    return () => { active = false; };
  }, [pdfDoc, page]);

  // Focus text input when it appears
  useEffect(() => {
    if (pendingText) textInputRef.current?.focus();
  }, [pendingText]);

  const annotations = {
    highlights: [],
    inks: [],
    texts: [],
    shapes: [],
    stamps: [],
    ...page?.annotations,
  };

  const toPdfCoords = (xPx, yPx) => {
    if (!renderInfo) return { x: 0, y: 0 };
    return {
      x: xPx * (renderInfo.pdfWidth / renderInfo.width),
      y: (renderInfo.height - yPx) * (renderInfo.pdfHeight / renderInfo.height),
    };
  };

  const toScreenRect = (pdfX, pdfY, pdfW, pdfH) => {
    if (!renderInfo) return { x: 0, y: 0, w: 0, h: 0 };
    const sx = renderInfo.width / renderInfo.pdfWidth;
    const sy = renderInfo.height / renderInfo.pdfHeight;
    return { x: pdfX * sx, y: renderInfo.height - (pdfY + pdfH) * sy, w: pdfW * sx, h: pdfH * sy };
  };

  const toScreenPoint = (pdfX, pdfY) => {
    if (!renderInfo) return { x: 0, y: 0 };
    return {
      x: pdfX * (renderInfo.width / renderInfo.pdfWidth),
      y: renderInfo.height - pdfY * (renderInfo.height / renderInfo.pdfHeight),
    };
  };

  const getLocalPoint = (e) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const commitText = () => {
    if (!pendingText) return;
    const val = textValue.trim();
    if (val) {
      onAnnotationsChange({
        ...annotations,
        texts: [...annotations.texts, {
          x: pendingText.pdfX,
          y: pendingText.pdfY,
          text: val,
          fontSize,
          color,
        }],
      });
    }
    setPendingText(null);
    setTextValue('');
  };

  const eraseAt = (px, py) => {
    const T = 14;
    const newH = annotations.highlights.filter(h => {
      const r = toScreenRect(h.x, h.y, h.w, h.h);
      return !(px >= r.x - T && px <= r.x + r.w + T && py >= r.y - T && py <= r.y + r.h + T);
    });
    const newT = annotations.texts.filter(t => {
      const sp = toScreenPoint(t.x, t.y);
      return Math.hypot(px - sp.x, py - sp.y) > T * 2;
    });
    const newSh = annotations.shapes.filter(s => {
      if (s.type === 'line') {
        const sp = toScreenPoint(s.x1, s.y1);
        const ep = toScreenPoint(s.x2, s.y2);
        return pointToSegDist(px, py, sp.x, sp.y, ep.x, ep.y) > T;
      }
      const r = toScreenRect(s.x, s.y, s.w, s.h);
      return !(px >= r.x - T && px <= r.x + r.w + T && py >= r.y - T && py <= r.y + r.h + T);
    });
    const newSt = annotations.stamps.filter(st => {
      const sp = toScreenPoint(st.x, st.y);
      return Math.hypot(px - sp.x, py - sp.y) > T * 5;
    });
    const newI = annotations.inks.filter(stroke =>
      !stroke.points.some(pt => {
        const sp = toScreenPoint(pt.x, pt.y);
        return Math.hypot(px - sp.x, py - sp.y) <= T;
      }),
    );
    const anyChanged =
      newH.length !== annotations.highlights.length ||
      newT.length !== annotations.texts.length ||
      newSh.length !== annotations.shapes.length ||
      newSt.length !== annotations.stamps.length ||
      newI.length !== annotations.inks.length;
    if (anyChanged) {
      onAnnotationsChange({ highlights: newH, inks: newI, texts: newT, shapes: newSh, stamps: newSt });
    }
  };

  const onPointerDown = (e) => {
    if (tool === 'pan' || !renderInfo) return;
    e.preventDefault();
    const p = getLocalPoint(e);

    if (tool === 'text') {
      commitText();
      const pdf = toPdfCoords(p.x, p.y);
      setPendingText({ screenX: p.x, screenY: p.y, pdfX: pdf.x, pdfY: pdf.y });
      setTextValue('');
      return;
    }
    if (tool === 'stamp') {
      const stamp = STAMPS[stampIndex];
      const pdf = toPdfCoords(p.x, p.y);
      const stampObj = { x: pdf.x, y: pdf.y, label: stamp.label, color: stamp.color, fontSize: 24 };
      if (stampAllPages && onStampAllPages) {
        onStampAllPages(stampObj);
      } else {
        onAnnotationsChange({ ...annotations, stamps: [...annotations.stamps, stampObj] });
      }
      return;
    }
    if (tool === 'eraser') {
      eraseAt(p.x, p.y);
      setDrawing({ type: 'eraser', x: p.x, y: p.y });
      return;
    }
    if (tool === 'highlight') {
      setDrawing({ type: 'highlight', startX: p.x, startY: p.y, x: p.x, y: p.y });
    } else if (tool === 'pen') {
      setDrawing({ type: 'pen', points: [p] });
    } else if (tool === 'rect' || tool === 'ellipse') {
      setDrawing({ type: 'shape', shapeType: tool, startX: p.x, startY: p.y, x: p.x, y: p.y });
    } else if (tool === 'line') {
      setDrawing({ type: 'line', startX: p.x, startY: p.y, x: p.x, y: p.y });
    }
  };

  const onPointerMove = (e) => {
    if (!drawing || !renderInfo) return;
    e.preventDefault();
    const p = getLocalPoint(e);
    if (drawing.type === 'eraser') {
      eraseAt(p.x, p.y);
      setDrawing({ ...drawing, x: p.x, y: p.y });
    } else if (drawing.type === 'pen') {
      setDrawing({ ...drawing, points: [...drawing.points, p] });
    } else {
      setDrawing({ ...drawing, x: p.x, y: p.y });
    }
  };

  const onPointerUp = () => {
    if (!drawing || !renderInfo) { setDrawing(null); return; }

    if (drawing.type === 'highlight') {
      const x1 = Math.min(drawing.startX, drawing.x);
      const y1 = Math.min(drawing.startY, drawing.y);
      const x2 = Math.max(drawing.startX, drawing.x);
      const y2 = Math.max(drawing.startY, drawing.y);
      if (x2 - x1 > 4 && y2 - y1 > 4) {
        const tl = toPdfCoords(x1, y1);
        const br = toPdfCoords(x2, y2);
        onAnnotationsChange({
          ...annotations,
          highlights: [...annotations.highlights, {
            x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y),
            w: Math.abs(br.x - tl.x), h: Math.abs(tl.y - br.y),
          }],
        });
      }
    } else if (drawing.type === 'pen') {
      if (drawing.points.length > 1) {
        onAnnotationsChange({
          ...annotations,
          inks: [...annotations.inks, {
            points: drawing.points.map(p => toPdfCoords(p.x, p.y)),
            color, width: strokeWidth,
          }],
        });
      }
    } else if (drawing.type === 'shape') {
      const x1 = Math.min(drawing.startX, drawing.x);
      const y1 = Math.min(drawing.startY, drawing.y);
      const x2 = Math.max(drawing.startX, drawing.x);
      const y2 = Math.max(drawing.startY, drawing.y);
      if (x2 - x1 > 4 && y2 - y1 > 4) {
        const tl = toPdfCoords(x1, y1);
        const br = toPdfCoords(x2, y2);
        onAnnotationsChange({
          ...annotations,
          shapes: [...annotations.shapes, {
            type: drawing.shapeType,
            x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y),
            w: Math.abs(br.x - tl.x), h: Math.abs(tl.y - br.y),
            color, strokeWidth, filled,
          }],
        });
      }
    } else if (drawing.type === 'line') {
      if (Math.hypot(drawing.x - drawing.startX, drawing.y - drawing.startY) > 4) {
        const start = toPdfCoords(drawing.startX, drawing.startY);
        const end   = toPdfCoords(drawing.x, drawing.y);
        onAnnotationsChange({
          ...annotations,
          shapes: [...annotations.shapes, {
            type: 'line',
            x1: start.x, y1: start.y,
            x2: end.x,   y2: end.y,
            color, strokeWidth,
          }],
        });
      }
    }
    setDrawing(null);
  };

  const clearAll = () =>
    onAnnotationsChange({ highlights: [], inks: [], texts: [], shapes: [], stamps: [] });

  const hasAnnotations =
    annotations.highlights.length + annotations.inks.length +
    annotations.texts.length + annotations.shapes.length + annotations.stamps.length > 0;

  const showColor  = COLOR_TOOLS.has(tool);
  const showWidth  = WIDTH_TOOLS.has(tool);
  const showFill   = FILL_TOOLS.has(tool);
  const showFont   = tool === 'text';
  const showStamp  = tool === 'stamp';
  const showCtx    = showColor || showWidth || showFill || showFont || showStamp;

  const cursor = tool === 'pan' ? 'auto' : tool === 'eraser' ? 'cell' : 'crosshair';

  // Scale factors: PDF user units → screen CSS pixels.
  // sx is used for stroke widths and horizontal sizing so what the user
  // draws in the editor matches what pdf-lib produces on export (which works
  // in PDF user units).
  const sx = renderInfo ? renderInfo.width / renderInfo.pdfWidth : 1;
  const sy = renderInfo ? renderInfo.height / renderInfo.pdfHeight : 1;

  const btnBase = (active) =>
    `p-2 rounded-lg transition-all shrink-0 ${
      active
        ? 'bg-blue-500 text-white'
        : isDark
          ? 'bg-gray-800 hover:bg-gray-700'
          : 'bg-white hover:bg-gray-100 shadow-sm'
    }`;

  const ctrlPill = (active) =>
    `px-2 py-1 rounded text-xs font-medium transition-all ${
      active
        ? 'bg-blue-500 text-white'
        : isDark
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          : 'bg-white hover:bg-gray-100 text-gray-600 shadow-sm'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm">
      <div className={`flex flex-col w-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>

        {/* ── Main toolbar ── */}
        <div className={`flex items-center gap-2 p-2 sm:p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {/* Close + page info */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="hidden sm:block min-w-0">
              <p className="font-semibold text-sm truncate max-w-[160px]">{page?.docName}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Page {pageIndexInArray + 1} / {totalPages}
              </p>
            </div>
          </div>

          {/* Tools */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 justify-center">
            {TOOLS.map(({ id, Icon, label }) => {
              const active = tool === id;
              if (id === 'stamp') {
                return (
                  <button
                    key={id}
                    onClick={() => setTool(id)}
                    title={label}
                    className={btnBase(active)}
                  >
                    <span className="text-[10px] font-black leading-none tracking-tight px-0.5">STM</span>
                  </button>
                );
              }
              return (
                <button key={id} onClick={() => setTool(id)} title={label} className={btnBase(active)}>
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Rotate + Clear */}
          <div className="flex items-center gap-1 shrink-0">
            <div className={`w-px h-5 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
            <button
              onClick={() => onRotate(page.id)}
              title="Rotate 90°"
              className={`p-2 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'}`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={clearAll}
              disabled={!hasAnnotations}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'}`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* ── Contextual controls ── */}
        {showCtx && (
          <div className={`flex flex-wrap items-center gap-3 px-3 py-2 border-b ${isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            {showColor && (
              <div className="flex items-center gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${color.hex === c.hex ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.hex}
                  />
                ))}
              </div>
            )}
            {showWidth && (
              <div className="flex items-center gap-1">
                {STROKE_WIDTHS.map(w => (
                  <button key={w} onClick={() => setStrokeWidth(w)} title={`${w}px`} className={ctrlPill(strokeWidth === w)}>
                    {w}px
                  </button>
                ))}
              </div>
            )}
            {showFill && (
              <button onClick={() => setFilled(!filled)} className={ctrlPill(filled)}>
                Fill
              </button>
            )}
            {showFont && (
              <div className="flex items-center gap-1">
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Size:</span>
                {FONT_SIZES.map(s => (
                  <button key={s} onClick={() => setFontSize(s)} className={ctrlPill(fontSize === s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {showStamp && (
              <div className="flex items-center gap-2 flex-wrap">
                {STAMPS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setStampIndex(i)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all ${stampIndex === i ? 'ring-2 ring-blue-400' : ''}`}
                    style={{ color: s.hex, border: `1.5px solid ${s.hex}` }}
                  >
                    {s.label}
                  </button>
                ))}
                {totalPages > 1 && (
                  <button
                    onClick={() => setStampAllPages((v) => !v)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                      stampAllPages
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : isDark
                          ? 'border-gray-600 text-gray-300 hover:border-gray-400'
                          : 'border-gray-300 text-gray-600 hover:border-gray-500'
                    }`}
                    title="Apply stamp to every page at this position"
                  >
                    All pages
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Canvas area ── */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
          <div
            className="relative inline-block"
            style={{ touchAction: tool === 'pan' ? 'auto' : 'none' }}
          >
            <div ref={canvasRef} />

            {renderInfo && (
              <svg
                width={renderInfo.width}
                height={renderInfo.height}
                viewBox={`0 0 ${renderInfo.width} ${renderInfo.height}`}
                className="absolute inset-0"
                style={{ cursor, pointerEvents: tool === 'pan' ? 'none' : 'auto' }}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              >
                {/* Highlights */}
                {annotations.highlights.map((h, i) => {
                  const r = toScreenRect(h.x, h.y, h.w, h.h);
                  return (
                    <rect key={`h-${i}-${h.x.toFixed(1)}-${h.y.toFixed(1)}`} x={r.x} y={r.y} width={r.w} height={r.h}
                      fill="#ffeb3b" fillOpacity="0.4" style={{ mixBlendMode: 'multiply' }} />
                  );
                })}

                {/* Shapes (rect, ellipse, line) */}
                {annotations.shapes.map((s, i) => {
                  const c = s.color || COLORS[0];
                  const stroke = `rgb(${c.r * 255},${c.g * 255},${c.b * 255})`;
                  const fill   = s.filled ? `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.2)` : 'none';
                  const sw     = (s.strokeWidth || 2) * sx;
                  if (s.type === 'line') {
                    const sp = toScreenPoint(s.x1, s.y1);
                    const ep = toScreenPoint(s.x2, s.y2);
                    return <line key={`sh-${i}-${s.x1?.toFixed(1)}-${s.y1?.toFixed(1)}`} x1={sp.x} y1={sp.y} x2={ep.x} y2={ep.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
                  }
                  const r = toScreenRect(s.x, s.y, s.w, s.h);
                  if (s.type === 'ellipse') {
                    return <ellipse key={`sh-${i}-${s.x.toFixed(1)}-${s.y.toFixed(1)}`} cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} stroke={stroke} strokeWidth={sw} fill={fill} />;
                  }
                  return <rect key={`sh-${i}-${s.x.toFixed(1)}-${s.y.toFixed(1)}`} x={r.x} y={r.y} width={r.w} height={r.h} stroke={stroke} strokeWidth={sw} fill={fill} />;
                })}

                {/* Texts */}
                {annotations.texts.map((t, i) => {
                  const sp = toScreenPoint(t.x, t.y);
                  const c  = t.color || COLORS[0];
                  return (
                    <text key={`t-${i}-${t.x.toFixed(1)}-${t.y.toFixed(1)}`} x={sp.x} y={sp.y}
                      fontSize={(t.fontSize || 14) * sy}
                      fill={`rgb(${c.r * 255},${c.g * 255},${c.b * 255})`}
                      fontFamily="Helvetica, Arial, sans-serif">
                      {t.text}
                    </text>
                  );
                })}

                {/* Stamps */}
                {annotations.stamps.map((st, i) => {
                  const sp     = toScreenPoint(st.x, st.y);
                  const szPdf  = st.fontSize || 24;
                  const sz     = szPdf * sy;
                  const c      = st.color || STAMPS[0].color;
                  const clr    = `rgb(${c.r * 255},${c.g * 255},${c.b * 255})`;
                  // Mirror the export-side estimate so preview width matches the
                  // exported stamp width (~0.6 ratio for Helvetica-Bold ASCII).
                  const w      = szPdf * st.label.length * 0.6 * sx;
                  const pad    = 6 * sy;
                  // Center the box around the glyphs' visual center. The text
                  // baseline is at sp.y; glyph mass sits ~0.25·sz above the
                  // baseline (ascent ~0.7·sz, descent ~0.2·sz). In SVG y grows
                  // downward, so the visual center is at sp.y - 0.25·sz.
                  const visualCenter = sp.y - sz * 0.25;
                  return (
                    <g key={`st-${i}-${st.x.toFixed(1)}-${st.y.toFixed(1)}-${st.label}`}>
                      <rect
                        x={sp.x - pad}
                        y={visualCenter - (sz / 2 + pad)}
                        width={w + pad * 2}
                        height={sz + pad * 2}
                        stroke={clr} strokeWidth={1.5 * sx} fill="none" />
                      <text x={sp.x} y={sp.y} fontSize={sz} fill={clr}
                        fontFamily="Helvetica, Arial, sans-serif" fontWeight="bold">
                        {st.label}
                      </text>
                    </g>
                  );
                })}

                {/* Inks */}
                {annotations.inks.map((stroke, i) => {
                  if (stroke.points.length < 2) return null;
                  const pts = stroke.points.map(p => toScreenPoint(p.x, p.y));
                  const d   = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const c   = stroke.color || COLORS[1];
                  return (
                    <path key={`i-${i}-${stroke.points.length}-${stroke.points[0]?.x.toFixed(1)}`} d={d}
                      stroke={`rgb(${c.r * 255},${c.g * 255},${c.b * 255})`}
                      strokeWidth={(stroke.width || 2) * sx}
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                })}

                {/* In-progress: highlight */}
                {drawing?.type === 'highlight' && (
                  <rect
                    x={Math.min(drawing.startX, drawing.x)} y={Math.min(drawing.startY, drawing.y)}
                    width={Math.abs(drawing.x - drawing.startX)} height={Math.abs(drawing.y - drawing.startY)}
                    fill="#ffeb3b" fillOpacity="0.35" style={{ mixBlendMode: 'multiply' }} />
                )}

                {/* In-progress: pen */}
                {drawing?.type === 'pen' && drawing.points.length > 1 && (
                  <path
                    d={drawing.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                    stroke={color.hex} strokeWidth={strokeWidth * sx}
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* In-progress: shape (rect/ellipse) */}
                {drawing?.type === 'shape' && (() => {
                  const x1 = Math.min(drawing.startX, drawing.x);
                  const y1 = Math.min(drawing.startY, drawing.y);
                  const w  = Math.abs(drawing.x - drawing.startX);
                  const h  = Math.abs(drawing.y - drawing.startY);
                  const fillPrev = filled ? `${color.hex}33` : 'none';
                  if (drawing.shapeType === 'ellipse') {
                    return <ellipse cx={x1 + w / 2} cy={y1 + h / 2} rx={w / 2} ry={h / 2} stroke={color.hex} strokeWidth={strokeWidth * sx} fill={fillPrev} />;
                  }
                  return <rect x={x1} y={y1} width={w} height={h} stroke={color.hex} strokeWidth={strokeWidth * sx} fill={fillPrev} />;
                })()}

                {/* In-progress: line */}
                {drawing?.type === 'line' && (
                  <line x1={drawing.startX} y1={drawing.startY} x2={drawing.x} y2={drawing.y}
                    stroke={color.hex} strokeWidth={strokeWidth * sx} strokeLinecap="round" />
                )}
              </svg>
            )}

            {/* Floating text input */}
            {pendingText && renderInfo && (
              <div
                style={{
                  position: 'absolute',
                  left: pendingText.screenX,
                  top: pendingText.screenY,
                  transform: 'translateY(-100%)',
                  pointerEvents: 'auto',
                  zIndex: 10,
                }}
              >
                <input
                  ref={textInputRef}
                  value={textValue}
                  onChange={e => setTextValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitText(); }
                    if (e.key === 'Escape') { setPendingText(null); setTextValue(''); }
                  }}
                  onBlur={commitText}
                  className="outline-none border-b-2 border-blue-500 bg-transparent min-w-[80px]"
                  style={{
                    fontSize: `${fontSize * sy}px`,
                    color: color.hex,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                  }}
                  placeholder="Type here…"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation footer ── */}
        <div className={`flex items-center justify-between p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={onPrev}
            disabled={pageIndexInArray === 0}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all disabled:opacity-30 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'}`}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {tool === 'pan'     ? 'Pick a tool to annotate'
            : tool === 'text'   ? 'Click to place text · Enter to commit'
            : tool === 'stamp'  ? `Click to place ${STAMPS[stampIndex].label} stamp`
            : tool === 'eraser' ? 'Click or drag over annotations to erase'
            : 'Drag to draw'}
          </p>
          <button
            onClick={onNext}
            disabled={pageIndexInArray >= totalPages - 1}
            className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-all disabled:opacity-30 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'}`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
