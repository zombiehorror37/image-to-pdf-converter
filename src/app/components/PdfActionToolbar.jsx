'use client';
import { Download, Image as ImageIcon, CheckSquare, Square, RotateCw, Trash2, Undo2, Redo2, Scissors } from 'lucide-react';

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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportPdf,
  onExportImages,
  onSplit,
}) {
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
            Click eye icon to view & annotate
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleSelection}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all ${
              isSelectionMode
                ? 'bg-blue-500 text-white'
                : isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
          </button>
          <button
            onClick={onRotateAll}
            disabled={isProcessing || pageCount === 0}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rotate all</span>
          </button>
          <button
            onClick={onSplit}
            disabled={isProcessing || pageCount === 0}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={onExportImages}
            disabled={isProcessing || pageCount === 0}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Export images</span>
          </button>
          <button
            onClick={onExportPdf}
            disabled={isProcessing || pageCount === 0}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2
                     active:scale-[0.98] transition-all text-sm
                     ${isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            <Download className="w-4 h-4" />
            <span>Save PDF</span>
          </button>
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
            }`}
          >
            <RotateCw className="w-4 h-4" /> Rotate
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
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
