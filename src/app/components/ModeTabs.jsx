'use client';
import { FileImage, FileText } from 'lucide-react';

export default function ModeTabs({ isDark, mode, onModeChange }) {
  const tabs = [
    { id: 'convert', label: 'Make PDF', icon: FileImage, panelId: 'panel-convert' },
    { id: 'pdfTools', label: 'Edit PDF', icon: FileText, panelId: 'panel-pdfTools' },
  ];

  return (
    <div
      className={`inline-flex p-1 rounded-2xl mx-auto ${
        isDark ? 'bg-gray-800/60 border border-gray-700/50' : 'bg-white border border-gray-200 shadow-sm'
      } w-full sm:w-auto`}
      role="tablist"
    >
      <div className="flex w-full sm:w-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={active}
              aria-controls={tab.panelId}
              onClick={() => onModeChange(tab.id)}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                active
                  ? 'bg-blue-500 text-white shadow-md'
                  : isDark
                    ? 'text-gray-300 hover:bg-gray-700/60'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
