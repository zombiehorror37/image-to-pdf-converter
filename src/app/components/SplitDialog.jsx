'use client';
import { useState } from 'react';
import { X, Scissors } from 'lucide-react';

// Parse a string like "1-3, 5, 8-10" into ranges (1-based, inclusive)
const parseRanges = (input, max) => {
  const out = [];
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const n = parseInt(part);
      if (n >= 1 && n <= max) out.push([n, n]);
    } else {
      const m = part.match(/^(\d+|start)\s*-\s*(\d+|end)$/i);
      if (!m) continue;
      let start = m[1].toLowerCase() === 'start' ? 1 : parseInt(m[1]);
      let end = m[2].toLowerCase() === 'end' ? max : parseInt(m[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 1 && end <= max && start <= end) {
        out.push([start, end]);
      }
    }
  }
  return out;
};

export default function SplitDialog({ isDark, totalPages, onClose, onSplit }) {
  const [input, setInput] = useState(`1-${Math.min(totalPages, 5)}`);
  const ranges = parseRanges(input, totalPages);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl overflow-hidden ${
        isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scissors className="w-5 h-5 text-blue-500" />
            Split PDF
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Page ranges
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-end"
              className={`w-full p-3 rounded-xl border outline-none transition-all text-sm ${
                isDark
                  ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                  : 'bg-white border-gray-300 focus:border-blue-500'
              }`}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {totalPages} pages total. Each range becomes its own PDF.
            </p>
          </div>

          {ranges.length > 0 ? (
            <div className={`rounded-xl p-3 text-sm ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`font-medium mb-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                Will create {ranges.length} {ranges.length === 1 ? 'PDF' : 'PDFs'}:
              </p>
              <ul className={`space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {ranges.map(([s, e], i) => (
                  <li key={i}>
                    PDF {i + 1}: page{s === e ? '' : 's'} {s}{s === e ? '' : `–${e}`} ({e - s + 1}{' '}
                    {e - s + 1 === 1 ? 'page' : 'pages'})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-red-500">No valid ranges parsed.</p>
          )}
        </div>
        <div className={`flex items-center justify-end gap-2 p-4 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => onSplit(ranges)}
            disabled={ranges.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Split & download
          </button>
        </div>
      </div>
    </div>
  );
}
