'use client';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const COLORS = {
  error: 'text-red-500',
  success: 'text-green-500',
  info: 'text-blue-500',
};

export default function Toasts({ isDark, toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        return (
          <div
            key={toast.id}
            role="status"
            className={`rounded-xl p-3 sm:p-4 border shadow-lg backdrop-blur-md flex items-start gap-3 ${
              isDark
                ? 'bg-gray-800/95 border-gray-700 text-white'
                : 'bg-white/95 border-gray-200 text-gray-900'
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${COLORS[toast.type] || COLORS.info}`} />
            <div className="flex-1 min-w-0">
              {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
              {toast.message && (
                <p className={`text-sm ${toast.title ? 'mt-0.5' : ''} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action.onClick();
                    onDismiss(toast.id);
                  }}
                  className="mt-2 text-sm font-medium text-blue-500 hover:text-blue-400"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className={`p-1 rounded-md transition-all flex-shrink-0 ${
                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
