'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

const PRESET_COLORS = [
  { label: 'Gray',  r: 0.5,  g: 0.5,  b: 0.5  },
  { label: 'Red',   r: 0.85, g: 0.1,  b: 0.1  },
  { label: 'Blue',  r: 0.1,  g: 0.4,  b: 0.85 },
  { label: 'Black', r: 0.05, g: 0.05, b: 0.05 },
];

export default function WatermarkDialog({ isDark, onClose, onApply }) {
  const [text,     setText]     = useState('DRAFT');
  const [fontSize, setFontSize] = useState(60);
  const [colorIdx, setColorIdx] = useState(0);
  const [opacity,  setOpacity]  = useState(25);
  const [rotation, setRotation] = useState(-45);

  const base = `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
  }`;

  const handle = () => {
    if (!text.trim()) return;
    onApply({
      text:     text.trim(),
      fontSize: Number(fontSize),
      color:    PRESET_COLORS[colorIdx],
      opacity:  opacity / 100,
      rotation: Number(rotation),
      pages:    'all',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-lg font-semibold">Add Watermark</h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Watermark text</label>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              className={base}
              placeholder="e.g. CONFIDENTIAL"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Font size: {fontSize}pt
              </label>
              <input type="range" min={20} max={120} value={fontSize}
                onChange={e => setFontSize(e.target.value)}
                className="w-full accent-blue-500" />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Opacity: {opacity}%
              </label>
              <input type="range" min={5} max={80} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-full accent-blue-500" />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Rotation: {rotation}°
            </label>
            <input type="range" min={-90} max={90} value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="w-full accent-blue-500" />
          </div>

          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={c.label}
                  onClick={() => setColorIdx(i)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                    colorIdx === i ? 'border-blue-500' : isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'
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

          {/* Live preview */}
          <div className={`rounded-xl h-24 flex items-center justify-center overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <span
              style={{
                fontSize: Math.min(fontSize * 0.4, 36),
                color: `rgba(${PRESET_COLORS[colorIdx].r * 255},${PRESET_COLORS[colorIdx].g * 255},${PRESET_COLORS[colorIdx].b * 255},${opacity / 100})`,
                transform: `rotate(${rotation}deg)`,
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                userSelect: 'none',
              }}
            >
              {text || 'WATERMARK'}
            </span>
          </div>
        </div>

        <div className={`flex gap-3 p-5 pt-0`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={!text.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-40"
          >
            Apply to all pages
          </button>
        </div>
      </div>
    </div>
  );
}
