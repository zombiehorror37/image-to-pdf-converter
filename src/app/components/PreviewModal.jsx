'use client';
import { Eye, Download, X } from 'lucide-react';

export default function PreviewModal({ isDark, pdfUrl, onClose, onDownload }) {
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
          {pdfUrl && (
            <iframe src={pdfUrl} className="w-full h-full rounded-lg border-0" title="PDF Preview" />
          )}
        </div>
      </div>
    </div>
  );
}
