'use client';
import { Clock, X } from 'lucide-react';

export default function SessionRestoreBanner({ isDark, count, unit = 'image', updatedAt, onRestore, onDiscard }) {
  const ago = Math.max(1, Math.round((Date.now() - updatedAt) / 60000));
  const label = count === 1 ? unit : `${unit}s`;
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 mb-6 border flex items-center gap-3 ${
        isDark
          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100'
          : 'bg-yellow-50 border-yellow-200 text-yellow-900'
      }`}
    >
      <Clock className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm sm:text-base">Resume previous session?</p>
        <p className={`text-xs sm:text-sm ${isDark ? 'text-yellow-200/80' : 'text-yellow-800'}`}>
          {count} {label} from {ago} {ago === 1 ? 'min' : 'mins'} ago
        </p>
      </div>
      <button
        onClick={onRestore}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isDark ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' : 'bg-yellow-500 text-white hover:bg-yellow-600'
        }`}
      >
        Restore
      </button>
      <button
        onClick={onDiscard}
        className={`p-1.5 rounded-lg transition-all ${
          isDark ? 'hover:bg-yellow-500/20' : 'hover:bg-yellow-100'
        }`}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
