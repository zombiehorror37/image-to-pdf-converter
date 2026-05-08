'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

const POSITIONS = [
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'bottom-left',   label: 'Bottom Left' },
  { id: 'bottom-right',  label: 'Bottom Right' },
  { id: 'top-center',    label: 'Top Center' },
  { id: 'top-left',      label: 'Top Left' },
  { id: 'top-right',     label: 'Top Right' },
];

const FORMATS = [
  { id: 'N',      label: '1, 2, 3…' },
  { id: 'Page N', label: 'Page 1, Page 2…' },
  { id: 'N / T',  label: '1 / 10, 2 / 10…' },
  { id: 'N of T', label: '1 of 10, 2 of 10…' },
];

const COLORS = [
  { label: 'Black', r: 0.05, g: 0.05, b: 0.05 },
  { label: 'Gray',  r: 0.5,  g: 0.5,  b: 0.5  },
  { label: 'Blue',  r: 0.1,  g: 0.4,  b: 0.85 },
  { label: 'Red',   r: 0.85, g: 0.1,  b: 0.1  },
];

export default function PageNumbersDialog({ isDark, totalPages, onClose, onApply }) {
  const [position, setPosition] = useState('bottom-center');
  const [format,   setFormat]   = useState('N');
  const [startAt,  setStartAt]  = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [colorIdx, setColorIdx] = useState(0);

  const select = `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
  }`;

  const pill = (active) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
      active
        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
        : isDark
          ? 'border-gray-700 text-gray-300 hover:border-gray-500'
          : 'border-gray-200 text-gray-600 hover:border-gray-400'
    }`;

  // Preview label for current settings
  const previewLabel = (() => {
    const n = startAt;
    const t = totalPages;
    switch (format) {
      case 'Page N': return `Page ${n}`;
      case 'N / T':  return `${n} / ${t}`;
      case 'N of T': return `${n} of ${t}`;
      default:       return `${n}`;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-semibold">Add Page Numbers</h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Position</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map(p => (
                <button key={p.id} onClick={() => setPosition(p.id)} className={pill(position === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Format</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} className={pill(format === f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Start at</label>
              <input type="number" min={1} value={startAt}
                onChange={e => setStartAt(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={select} />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Font size: {fontSize}pt
              </label>
              <input type="range" min={8} max={20} value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full mt-2 accent-blue-500" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Color</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={c.label}
                  onClick={() => setColorIdx(i)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                    colorIdx === i ? 'border-blue-500' : isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}
                  style={{
                    backgroundColor: `rgb(${c.r * 255},${c.g * 255},${c.b * 255})`,
                    color: c.r + c.g + c.b > 1.5 ? '#000' : '#fff',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className={`rounded-xl p-4 relative overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className={`text-center text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Preview</div>
            <div className="h-16 relative border rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center">
              <span className={`absolute text-xs ${
                position.includes('bottom') ? 'bottom-1' : 'top-1'
              } ${
                position.includes('center') ? 'left-1/2 -translate-x-1/2' :
                position.includes('left')   ? 'left-2' : 'right-2'
              }`}
                style={{
                  fontSize: Math.max(8, fontSize * 0.9),
                  color: `rgb(${COLORS[colorIdx].r * 255},${COLORS[colorIdx].g * 255},${COLORS[colorIdx].b * 255})`,
                }}
              >
                {previewLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply({ position, format, startAt: Number(startAt), fontSize, color: COLORS[colorIdx] })}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            Add to all pages
          </button>
        </div>
      </div>
    </div>
  );
}
