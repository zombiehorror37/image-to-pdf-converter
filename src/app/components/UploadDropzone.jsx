'use client';
import { useEffect, useRef, useState } from 'react';
import { FileImage, Archive, Clipboard, FileText, Download } from 'lucide-react';

export default function UploadDropzone({ isDark, mode, isActive = true, onDrop, onFiles, inputId = 'fileInput' }) {
  const isPdfMode = mode === 'pdfTools';
  const isCompressMode = mode === 'compress';
  const accept = isCompressMode
    ? 'application/pdf,.pdf,application/zip,.zip'
    : isPdfMode
      ? 'application/pdf,.pdf'
      : 'image/*,.zip,.heic,.heif,.tif,.tiff,.avif';

  // Fullscreen catch-all: while a file drag is anywhere over the window, a
  // whole-viewport overlay takes the drop so the user doesn't have to aim for
  // this dropzone. Gated on isActive so only the visible mode reacts (all
  // modes stay mounted). dragenter/dragleave fire for every element crossed,
  // so a depth counter tracks when the drag truly leaves the window.
  const [isWindowDrag, setIsWindowDrag] = useState(false);
  const dragDepthRef = useRef(0);
  useEffect(() => {
    if (!isActive) return undefined;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const reset = () => {
      dragDepthRef.current = 0;
      setIsWindowDrag(false);
    };
    const onWinDragEnter = (e) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current++;
      setIsWindowDrag(true);
    };
    const onWinDragLeave = () => {
      if (--dragDepthRef.current <= 0) reset();
    };
    // Prevent the browser's default "navigate to file" for drops the overlay
    // didn't catch, and clean up when the drag ends or drops anywhere.
    const onWinDragOver = (e) => e.preventDefault();
    const onWinDrop = (e) => {
      e.preventDefault();
      reset();
    };
    window.addEventListener('dragenter', onWinDragEnter);
    window.addEventListener('dragleave', onWinDragLeave);
    window.addEventListener('dragover', onWinDragOver);
    window.addEventListener('drop', onWinDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', onWinDragEnter);
      window.removeEventListener('dragleave', onWinDragLeave);
      window.removeEventListener('dragover', onWinDragOver);
      window.removeEventListener('drop', onWinDrop);
      window.removeEventListener('dragend', reset);
      reset();
    };
  }, [isActive]);

  const onDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    onDrop(Array.from(e.dataTransfer.files));
  };
  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    // Reset so selecting the same file again re-fires onChange.
    e.target.value = '';
    onFiles(files);
  };
  const triggerInput = () => document.getElementById(inputId).click();
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerInput();
    }
  };

  const dropTitle = isCompressMode
    ? 'Drop PDFs or a ZIP of PDFs here'
    : isPdfMode
      ? 'Drop PDF files here'
      : 'Drop images or ZIP files here';

  return (
    <>
    {isWindowDrag && (
      <div
        onDragOver={onDragOver}
        onDrop={handleDrop}
        className={`fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm ${
          isDark ? 'bg-gray-900/80' : 'bg-white/80'
        }`}
      >
        <div className={`w-full h-full rounded-3xl border-4 border-dashed border-blue-500 flex flex-col
                        items-center justify-center gap-4 pointer-events-none ${
          isDark ? 'bg-blue-500/10' : 'bg-blue-50/60'
        }`}>
          <div className={`p-5 rounded-3xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
            <Download className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500" />
          </div>
          <p className="text-xl sm:text-3xl font-semibold">{dropTitle}</p>
          <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Release anywhere to add your files
          </p>
        </div>
      </div>
    )}
    <div
      role="button"
      tabIndex={0}
      aria-label={isCompressMode ? 'Upload PDFs or a ZIP of PDFs' : isPdfMode ? 'Upload PDF files' : 'Upload images or ZIP files'}
      className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-10 lg:p-12 mb-6 sm:mb-8 text-center
                 transition-all duration-300 cursor-pointer active:scale-[0.99] group ${
        isDark
          ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/5'
          : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
      }`}
      onDragOver={onDragOver}
      onDrop={handleDrop}
      onClick={triggerInput}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="flex space-x-3 sm:space-x-4">
          {isCompressMode ? (
            <>
              <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                isDark ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-red-500" />
              </div>
              <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                isDark ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <Archive className="w-8 h-8 sm:w-12 sm:h-12 text-purple-500" />
              </div>
            </>
          ) : isPdfMode ? (
            <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-red-500" />
            </div>
          ) : (
            <>
              <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                isDark ? 'bg-blue-500/20' : 'bg-blue-100'
              }`}>
                <FileImage className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
              </div>
              <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                isDark ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <Archive className="w-8 h-8 sm:w-12 sm:h-12 text-purple-500" />
              </div>
              <div className={`p-3 sm:p-4 rounded-2xl group-hover:scale-110 transition-transform ${
                isDark ? 'bg-green-500/20' : 'bg-green-100'
              }`}>
                <Clipboard className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
              </div>
            </>
          )}
        </div>
        <div>
          <p className="text-lg sm:text-xl font-medium mb-1">{dropTitle}</p>
          <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {isPdfMode || isCompressMode
              ? 'or tap to browse'
              : 'or tap to browse • Ctrl+V to paste from clipboard'}
          </p>
          <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {isCompressMode
              ? 'Supports: PDF files and ZIP archives containing PDFs'
              : isPdfMode
                ? 'Supports: PDF (multi-page, encrypted, large files)'
                : 'Supports: JPG, PNG, GIF, BMP, WebP, SVG, HEIC, TIFF, AVIF + ZIP archives'}
          </p>
        </div>
      </div>
      <input
        id={inputId}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
    </>
  );
}
