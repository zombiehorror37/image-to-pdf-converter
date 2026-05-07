'use client';
import { Sun, Moon } from 'lucide-react';
import ModeTabs from './ModeTabs';

export default function Header({ isDark, onToggleTheme, mode, onModeChange }) {
  return (
    <header className="mb-6 sm:mb-10">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 text-center">
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold pb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {mode === 'pdfTools' ? 'PDF Tools' : 'Image to PDF Converter'}
          </h1>
          <p className={`text-sm sm:text-base mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {mode === 'pdfTools'
              ? 'View, rotate, merge, split, and annotate PDFs locally'
              : 'Convert your images to PDF in seconds • Ctrl+V to paste'}
          </p>
        </div>
        <button
          onClick={onToggleTheme}
          className={`p-2.5 rounded-xl transition-all ${
            isDark
              ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
              : 'bg-white hover:bg-gray-100 text-gray-700 shadow-md'
          }`}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
      <ModeTabs isDark={isDark} mode={mode} onModeChange={onModeChange} />
    </header>
  );
}
