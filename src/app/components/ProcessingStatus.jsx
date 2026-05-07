'use client';
import { X } from 'lucide-react';

export default function ProcessingStatus({ isDark, step, progress, onCancel }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 ${
      isDark
        ? 'bg-blue-900/50 backdrop-blur-sm border border-blue-700/50'
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
        </div>
        <span className="text-sm sm:text-base flex-1">{step}</span>
        {onCancel && (
          <button
            onClick={onCancel}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 transition-all ${
              isDark ? 'bg-gray-700 hover:bg-red-500/80 text-white' : 'bg-white hover:bg-red-500 hover:text-white text-gray-700 shadow-sm'
            }`}
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-blue-100'}`}>
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {progress}% complete
      </p>
    </div>
  );
}
