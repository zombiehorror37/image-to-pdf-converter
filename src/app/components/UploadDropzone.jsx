'use client';
import { FileImage, Archive, Clipboard, FileText } from 'lucide-react';

export default function UploadDropzone({ isDark, mode, onDrop, onFiles, inputId = 'fileInput' }) {
  const isPdfMode = mode === 'pdfTools';
  const accept = isPdfMode ? 'application/pdf,.pdf' : 'image/*,.zip,.heic,.heif,.tif,.tiff,.avif';

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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isPdfMode ? 'Upload PDF files' : 'Upload images or ZIP files'}
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
          {isPdfMode ? (
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
          <p className="text-lg sm:text-xl font-medium mb-1">
            {isPdfMode ? 'Drop PDF files here' : 'Drop images or ZIP files here'}
          </p>
          <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {isPdfMode
              ? 'or tap to browse'
              : 'or tap to browse • Ctrl+V to paste from clipboard'}
          </p>
          <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {isPdfMode
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
  );
}
