'use client';
import {
  Download, Eye, CheckSquare, Square, RotateCw, Trash2, Undo2, Redo2,
  Wand2, ArrowDownUp, SlidersHorizontal, Files, FileDown,
} from 'lucide-react';
import Menu from './Menu';

export default function Toolbar({
  isDark,
  imageCount,
  isProcessing,
  isSelectionMode,
  selectedCount,
  onToggleSelectionMode,
  onSelectAll,
  onPreview,
  onConvert,
  onExportSeparate,
  onExtractSelected,
  onRotateSelected,
  onRotateAll,
  onDeleteSelected,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  allSelected,
  onSort,
  sortOptions,
  onAutoRotate,
  onAutoRotateSelected,
}) {
  const noImages = isProcessing || imageCount === 0;

  const iconBtn = `p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
    isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
  }`;
  const textBtn = `px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
    isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
  }`;
  const cta = isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800';

  // Arrange ▾ — sort + bulk rotation, the "organize the whole set" actions.
  const arrangeItems = [
    ...(onSort ? sortOptions.map((opt) => ({ icon: ArrowDownUp, label: opt.label, onClick: () => onSort(opt.id) })) : []),
    { divider: true },
    { icon: RotateCw, label: 'Rotate all 90°', onClick: onRotateAll },
    ...(onAutoRotate ? [{ icon: Wand2, label: 'Auto-rotate', onClick: onAutoRotate }] : []),
  ];

  // Save ▾ — combined PDF (default) vs one PDF per image.
  const saveItems = [
    { icon: FileDown, label: 'Save as one PDF', onClick: onConvert },
    { icon: Files, label: 'Save each image as separate PDF (ZIP)', onClick: onExportSeparate },
  ];

  return (
    <div className="flex flex-col gap-4 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">
            {imageCount} {imageCount === 1 ? 'Image' : 'Images'} Ready
          </h3>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="hidden sm:inline">Drag to reorder · </span>
            <span className="sm:hidden">Use arrows to reorder · </span>
            Page order reflects PDF order
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
            onClick={onToggleSelectionMode}
            aria-label={isSelectionMode ? 'Cancel selection' : 'Select images'}
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
          <Menu isDark={isDark} label="Arrange" icon={SlidersHorizontal} items={arrangeItems} disabled={noImages} />

          {/* Preview */}
          <button onClick={onPreview} disabled={isProcessing} title="Preview PDF" aria-label="Preview PDF" className={textBtn}>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Save split-button: primary = combined PDF, caret = more options */}
          <div className="flex flex-1 sm:flex-none">
            <button
              onClick={onConvert}
              disabled={isProcessing}
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
              disabled={isProcessing}
              buttonClassName={`px-2 py-2.5 rounded-r-xl flex items-center transition-all disabled:opacity-50 border-l ${
                isDark ? 'border-gray-300' : 'border-gray-700'
              } ${cta}`}
            />
          </div>
        </div>
      </div>

      {isSelectionMode && (
        <div className={`flex flex-wrap items-center gap-2 p-3 rounded-xl ${
          isDark ? 'bg-gray-800/80' : 'bg-gray-100'
        }`}>
          <button
            onClick={onSelectAll}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
              isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
            }`}
          >
            {allSelected ? (
              <><CheckSquare className="w-4 h-4" /> Deselect All</>
            ) : (
              <><Square className="w-4 h-4" /> Select All</>
            )}
          </button>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedCount} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={onRotateSelected}
            disabled={selectedCount === 0}
            title="Rotate selected"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
            }`}
          >
            <RotateCw className="w-4 h-4" /> Rotate
          </button>
          {onAutoRotateSelected && (
            <button
              onClick={onAutoRotateSelected}
              disabled={selectedCount === 0 || isProcessing}
              title="Auto-rotate selected"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
              }`}
            >
              <Wand2 className="w-4 h-4" /> Auto-rotate
            </button>
          )}
          {onExtractSelected && (
            <button
              onClick={onExtractSelected}
              disabled={selectedCount === 0 || isProcessing}
              title="Export selected as separate PDFs"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              <Download className="w-4 h-4" /> Extract
            </button>
          )}
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            title="Delete selected"
            className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5
                     bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
