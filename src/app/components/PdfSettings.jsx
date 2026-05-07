'use client';
import { FileText } from 'lucide-react';
import { formatSize } from '../lib/utils';

export default function PdfSettings({
  isDark,
  filename,
  onFilenameChange,
  pdfSettings,
  onSettingsChange,
  estimatedSize,
}) {
  const update = (patch) => onSettingsChange({ ...pdfSettings, ...patch });

  return (
    <div className={`rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border ${
      isDark
        ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50'
        : 'bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg'
    }`}>
      <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        PDF Settings
      </h3>

      <div className="mb-4 sm:mb-6">
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <FileText className="w-4 h-4 inline mr-2" />
          Filename
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filename}
            onChange={(e) => onFilenameChange(e.target.value || 'converted-images')}
            placeholder="converted-images"
            className={`flex-1 p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
            }`}
          />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>.pdf</span>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={pdfSettings.preserveSize}
              onChange={(e) => update({ preserveSize: e.target.checked })}
              className="sr-only peer"
            />
            <div className={`w-10 h-6 rounded-full peer-checked:bg-blue-500 transition-colors ${
              isDark ? 'bg-gray-600' : 'bg-gray-300'
            }`}></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
          </div>
          <div>
            <span className="font-medium block text-sm sm:text-base">Preserve original image sizes</span>
            <span className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Each page will match the image dimensions
            </span>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!pdfSettings.preserveSize && (
          <>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Page Size</label>
              <select
                value={pdfSettings.pageSize}
                onChange={(e) => update({ pageSize: e.target.value })}
                className={`w-full p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
                  isDark
                    ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                    : 'bg-white border-gray-300 focus:border-blue-500'
                }`}
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Orientation</label>
              <select
                value={pdfSettings.orientation}
                onChange={(e) => update({ orientation: e.target.value })}
                className={`w-full p-3 rounded-xl border outline-none transition-all text-sm sm:text-base ${
                  isDark
                    ? 'bg-gray-700/50 border-gray-600 focus:border-blue-500'
                    : 'bg-white border-gray-300 focus:border-blue-500'
                }`}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            DPI: {pdfSettings.dpi}
          </label>
          <input
            type="range"
            min="72"
            max="300"
            step="12"
            value={pdfSettings.dpi}
            onChange={(e) => update({ dpi: parseInt(e.target.value) })}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Lower DPI = larger images, Higher DPI = better print quality
          </p>
        </div>

        <div className={pdfSettings.preserveSize ? 'sm:col-span-2 lg:col-span-4' : ''}>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Quality: {Math.round(pdfSettings.quality * 100)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={pdfSettings.quality}
            onChange={(e) => update({ quality: parseFloat(e.target.value) })}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          />
        </div>

        {!pdfSettings.preserveSize && (
          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={pdfSettings.fitToPage}
                onChange={(e) => update({ fitToPage: e.target.checked })}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm sm:text-base">Fit to page</span>
            </label>
          </div>
        )}
      </div>

      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Estimated PDF size: <span className="font-semibold text-blue-500">{formatSize(estimatedSize)}</span>
        </p>
      </div>
    </div>
  );
}
