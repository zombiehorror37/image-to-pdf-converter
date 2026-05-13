'use client';
import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { parseRanges } from '../lib/utils';

export default function ExportRangeDialog({ isDark, totalPages, onClose, onExport }) {
  const [input, setInput] = useState('');
  const ranges = input.trim() ? parseRanges(input, totalPages) : [];
  const pageCount = ranges.reduce((sum, [s, e]) => sum + (e - s + 1), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl overflow-hidden ${
        isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Export page range
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Page range
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 1-2, 5-7, 9"
              autoFocus
              className={`w-full p-3 rounded-xl border outline-none transition-all text-sm ${
                isDark
                  ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                  : 'bg-white border-gray-300 focus:border-blue-500'
              }`}
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {totalPages} pages total — separate ranges with commas.
            </p>
          </div>

          {input.trim() && (
            ranges.length > 0 ? (
              <div className={`rounded-xl p-3 text-sm ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Will export {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-500">No valid ranges — check the format.</p>
            )
          )}
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
            onClick={() => onExport(ranges)}
            disabled={ranges.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
