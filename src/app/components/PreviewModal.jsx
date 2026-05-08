'use client';
import { useState } from 'react';
import { Eye, Download, X, AlertTriangle } from 'lucide-react';

export default function PreviewModal({ isDark, pdfUrl, onClose, onDownload }) {
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col ${
        isDark ? 'bg-gray-900' : 'bg-white'
      }`}>
        <div className={`flex items-center justify-between p-4 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-500" />
            PDF Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all text-sm ${
                isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-all ${
                isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4">
          {pdfUrl && !loadError && (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-lg border-0"
              title="PDF Preview"
              onError={() => setLoadError(true)}
            />
          )}
          {loadError && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Preview unavailable — download the file to view it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
