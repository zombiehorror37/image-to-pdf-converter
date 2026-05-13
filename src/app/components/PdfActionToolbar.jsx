'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Download, Eye, Image as ImageIcon, CheckSquare, Square,
  RotateCw, Trash2, Undo2, Redo2, Scissors,
  Droplets, Hash, FileText, ChevronDown, ListFilter,
} from 'lucide-react';
import { parseRanges } from '../lib/utils';

export default function PdfActionToolbar({
  isDark,
  pageCount,
  selectedCount,
  isSelectionMode,
  isProcessing,
  onToggleSelection,
  onSelectAll,
  allSelected,
  onRotateAll,
  onRotateSelected,
  onDeleteSelected,
  onExtractSelected,
  onSelectRange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportPdf,
  onExportImages,
  onSplit,
  onExportRange,
  onPreview,
  onWatermark,
  onPageNumbers,
  onMetadata,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setToolsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const iconBtn = (disabled = false) =>
    `p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
      isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    }${disabled ? '' : ''}`;

  const textBtn = (disabled = false) =>
    `px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
      isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    }`;

  const menuItem = (Icon, label, handler) => (
    <button
      onClick={() => { setToolsOpen(false); handler?.(); }}
      disabled={isProcessing || pageCount === 0}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-40 ${
        isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">
            {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
          </h3>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="hidden sm:inline">Drag to reorder · </span>
            <span className="sm:hidden">Use arrows · </span>
            Click eye icon to view &amp; annotate
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Undo / Redo */}
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={iconBtn(!canUndo)}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={iconBtn(!canRedo)}>
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Select */}
          <button
            onClick={onToggleSelection}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all ${
              isSelectionMode
                ? 'bg-blue-500 text-white'
                : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
          </button>

          {/* Rotate All */}
          <button onClick={onRotateAll} disabled={isProcessing || pageCount === 0}
            title="Rotate all pages" aria-label="Rotate all pages" className={textBtn()}>
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rotate all</span>
          </button>

          {/* Split */}
          <button onClick={onSplit} disabled={isProcessing || pageCount === 0}
            title="Split PDF" aria-label="Split PDF" className={textBtn()}>
            <Scissors className="w-4 h-4" />
            <span className="hidden sm:inline">Split</span>
          </button>

          {/* Export Images */}
          <button onClick={onExportImages} disabled={isProcessing || pageCount === 0}
            title="Export as images (ZIP)" aria-label="Export as images" className={textBtn()}>
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Images</span>
          </button>

          {/* Tools dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              disabled={isProcessing || pageCount === 0}
              title="Document tools"
              className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-1.5 text-sm transition-all disabled:opacity-50 ${
                toolsOpen
                  ? isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {toolsOpen && (
              <div className={`absolute right-0 top-full mt-1.5 w-52 rounded-xl shadow-lg border z-20 py-1 ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                {menuItem(ListFilter, 'Export Range…',      onExportRange)}
                {menuItem(Droplets,  'Add Watermark…',     onWatermark)}
                {menuItem(Hash,      'Add Page Numbers…',  onPageNumbers)}
                {menuItem(FileText,  'Edit Metadata…',     onMetadata)}
              </div>
            )}
          </div>

          {/* Preview */}
          <button onClick={onPreview} disabled={isProcessing || pageCount === 0}
            title="Preview PDF" aria-label="Preview PDF" className={textBtn()}>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Save as PDF */}
          <button
            onClick={onExportPdf}
            disabled={isProcessing || pageCount === 0}
            title="Save as PDF"
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2
                     active:scale-[0.98] transition-all text-sm
                     ${isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            <Download className="w-4 h-4" />
            <span>Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {isSelectionMode && (
        <div className={`flex flex-wrap items-center gap-2 p-3 rounded-xl ${isDark ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
          <button
            onClick={onSelectAll}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
          >
            {allSelected ? <><CheckSquare className="w-4 h-4" /> Deselect All</> : <><Square className="w-4 h-4" /> Select All</>}
          </button>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedCount} selected
          </span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ranges = parseRanges(rangeInput, pageCount);
              if (ranges.length > 0) onSelectRange?.(ranges);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1-3, 5-7"
              className={`px-2.5 py-1.5 rounded-lg text-sm border outline-none w-32 transition-all ${
                isDark
                  ? 'bg-gray-700 border-gray-600 focus:border-blue-500 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 focus:border-blue-500 placeholder-gray-400'
              }`}
            />
            <button
              type="submit"
              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
              }`}
            >
              Select
            </button>
          </form>
          <div className="flex-1" />
          <button
            onClick={onRotateSelected}
            disabled={selectedCount === 0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
          >
            <RotateCw className="w-4 h-4" /> Rotate
          </button>
          <button
            onClick={onExtractSelected}
            disabled={selectedCount === 0 || isProcessing}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
          >
            <Download className="w-4 h-4" /> Extract
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
