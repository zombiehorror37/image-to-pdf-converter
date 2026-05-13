'use client';
import { useState } from 'react';
import { X, ArrowUpDown } from 'lucide-react';

export default function PositionDialog({ isDark, currentIndex, total, onClose, onMove }) {
  const [value, setValue] = useState(String(currentIndex + 1));
  const parsed = parseInt(value);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= total && parsed !== currentIndex + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-xs rounded-2xl overflow-hidden ${
        isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-blue-500" />
            Move to position
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Currently at position {currentIndex + 1} of {total}.
          </p>
          <input
            type="number"
            min={1}
            max={total}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && valid && onMove(parsed - 1)}
            autoFocus
            className={`w-full p-3 rounded-xl border outline-none transition-all text-sm text-center ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500 text-white'
                : 'bg-white border-gray-300 focus:border-blue-500'
            }`}
          />
        </div>

        <div className={`flex items-center justify-end gap-2 p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => onMove(parsed - 1)}
            disabled={!valid}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
