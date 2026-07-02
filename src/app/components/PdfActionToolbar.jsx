'use client';
import { useState } from 'react';
import {
  Download, Eye, Image as ImageIcon, CheckSquare, Square,
  RotateCw, Trash2, Undo2, Redo2, Scissors,
  Droplets, Hash, FileText, ListFilter, Wand2,
  ArrowDownUp, SlidersHorizontal, Wrench, Files, FileDown,
  Search, Repeat2,
} from 'lucide-react';
import { parseRanges } from '../lib/utils';
import Menu from './Menu';

export default function PdfActionToolbar({
  isDark,
  pageCount,
  selectedCount,
  isSelectionMode,
  isProcessing,
  onToggleSelection,
  onSelectAll,
  allSelected,
  onSort,
  sortOptions,
  onRotateAll,
  onRotateSelected,
  onAutoRotate,
  onAutoRotateSelected,
  onDeleteSelected,
  onExtractSelected,
  onSelectRange,
  onSelectByText,
  onInvertSelection,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportPdf,
  onExportSeparate,
  onExportImages,
  onSplit,
  onExportRange,
  onPreview,
  onPreviewSelected,
  onWatermark,
  onPageNumbers,
  onMetadata,
}) {
  const [rangeInput, setRangeInput] = useState('');
  const [findInput, setFindInput] = useState('');
  const noPages = isProcessing || pageCount === 0;

  const iconBtn = `p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
    isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
  }`;
  const textBtn = `px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
    isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
  }`;
  const cta = isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800';

  // Arrange ▾ — sort + bulk rotation.
  const arrangeItems = [
    ...(onSort ? sortOptions.map((opt) => ({ icon: ArrowDownUp, label: opt.label, onClick: () => onSort(opt.id) })) : []),
    { divider: true },
    { icon: RotateCw, label: 'Rotate all 90°', onClick: onRotateAll },
    ...(onAutoRotate ? [{ icon: Wand2, label: 'Auto-rotate', onClick: onAutoRotate }] : []),
  ];

  // Tools ▾ — document-level operations that open a dialog or export.
  const toolItems = [
    { icon: Scissors, label: 'Split…', onClick: onSplit },
    { icon: ListFilter, label: 'Export Range…', onClick: onExportRange },
    { icon: ImageIcon, label: 'Export as Images (ZIP)', onClick: onExportImages },
    { divider: true },
    { icon: Droplets, label: 'Add Watermark…', onClick: onWatermark },
    { icon: Hash, label: 'Add Page Numbers…', onClick: onPageNumbers },
    { icon: FileText, label: 'Edit Metadata…', onClick: onMetadata },
  ];

  // Save ▾ — combined PDF (default) vs one PDF per page.
  const saveItems = [
    { icon: FileDown, label: 'Save as PDF', onClick: onExportPdf },
    { icon: Files, label: 'Save each page as separate PDF (ZIP)', onClick: onExportSeparate },
  ];

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
          {/* History */}
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={iconBtn}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={iconBtn}>
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Select */}
          <button
            onClick={onToggleSelection}
            aria-label={isSelectionMode ? 'Cancel selection' : 'Select pages'}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all ${
              isSelectionMode
                ? 'bg-blue-500 text-white'
                : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
          </button>

          {/* Arrange ▾ */}
          <Menu isDark={isDark} label="Arrange" icon={SlidersHorizontal} items={arrangeItems} disabled={noPages} />

          {/* Tools ▾ */}
          <Menu isDark={isDark} label="Tools" icon={Wrench} items={toolItems} disabled={noPages} />

          {/* Preview */}
          <button onClick={onPreview} disabled={noPages} title="Preview PDF" aria-label="Preview PDF" className={textBtn}>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Save split-button */}
          <div className="flex flex-1 sm:flex-none">
            <button
              onClick={onExportPdf}
              disabled={noPages}
              title="Save as PDF"
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-l-xl font-medium flex items-center justify-center gap-2 text-sm
                       active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${cta}`}
            >
              <Download className="w-4 h-4" />
              <span>Save as PDF</span>
            </button>
            <Menu
              isDark={isDark}
              title="More save options"
              items={saveItems}
              disabled={noPages}
              buttonClassName={`px-2 py-2.5 rounded-r-xl flex items-center transition-all disabled:opacity-50 border-l ${
                isDark ? 'border-gray-300' : 'border-gray-700'
              } ${cta}`}
            />
          </div>
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
          {onInvertSelection && (
            <button
              onClick={onInvertSelection}
              title="Invert selection"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
            >
              <Repeat2 className="w-4 h-4" /> Invert
            </button>
          )}
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
          {onSelectByText && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (findInput.trim()) onSelectByText(findInput);
              }}
              className="flex items-center gap-1"
              title="Select every page whose text contains this — then delete, extract, or invert"
            >
              <input
                type="text"
                value={findInput}
                onChange={(e) => setFindInput(e.target.value)}
                placeholder="Find text…"
                disabled={isProcessing}
                className={`px-2.5 py-1.5 rounded-lg text-sm border outline-none w-36 transition-all ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 focus:border-blue-500 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 focus:border-blue-500 placeholder-gray-400'
                }`}
              />
              <button
                type="submit"
                disabled={isProcessing || !findInput.trim()}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
                }`}
              >
                <Search className="w-4 h-4" /> Find
              </button>
            </form>
          )}
          <div className="flex-1" />
          <button
            onClick={onRotateSelected}
            disabled={selectedCount === 0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
          >
            <RotateCw className="w-4 h-4" /> Rotate
          </button>
          {onAutoRotateSelected && (
            <button
              onClick={onAutoRotateSelected}
              disabled={selectedCount === 0 || isProcessing}
              title="Auto-rotate selected"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
            >
              <Wand2 className="w-4 h-4" /> Auto-rotate
            </button>
          )}
          <button
            onClick={onPreviewSelected}
            disabled={selectedCount === 0 || isProcessing}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'}`}
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={onExtractSelected}
            disabled={selectedCount === 0 || isProcessing}
            title="Extract selected pages to one PDF"
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
