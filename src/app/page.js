'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from './components/Header';

const ConvertMode = dynamic(() => import('./components/ConvertMode'), { ssr: false });
const PdfToolsMode = dynamic(() => import('./components/PdfToolsMode'), { ssr: false });
const CompressMode = dynamic(() => import('./components/CompressMode'), { ssr: false });

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [mode, setMode] = useState('convert');

  useEffect(() => {
    const savedTheme = localStorage.getItem('pdf-converter-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf-converter-theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white'
          : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
      }`}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${
          isDark ? 'bg-blue-500/10' : 'bg-blue-500/20'
        }`} />
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${
          isDark ? 'bg-purple-500/10' : 'bg-purple-500/20'
        }`} />
      </div>

      <main className="relative z-10 px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Header
            isDark={isDark}
            onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
            mode={mode}
            onModeChange={setMode}
          />

          {/* Both modes stay mounted after first render so state survives tab switches. */}
          <div
            role="tabpanel"
            id="panel-convert"
            aria-labelledby="tab-convert"
            className={mode !== 'convert' ? 'hidden' : ''}
          >
            <ConvertMode isDark={isDark} isActive={mode === 'convert'} onSwitchMode={setMode} />
          </div>
          <div
            role="tabpanel"
            id="panel-pdfTools"
            aria-labelledby="tab-pdfTools"
            className={mode !== 'pdfTools' ? 'hidden' : ''}
          >
            <PdfToolsMode isDark={isDark} isActive={mode === 'pdfTools'} onSwitchMode={setMode} />
          </div>
          <div
            role="tabpanel"
            id="panel-compress"
            aria-labelledby="tab-compress"
            className={mode !== 'compress' ? 'hidden' : ''}
          >
            <CompressMode isDark={isDark} isActive={mode === 'compress'} onSwitchMode={setMode} />
          </div>

          <footer className={`mt-8 sm:mt-12 text-center text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <p>Your files are processed locally and never uploaded to any server</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
