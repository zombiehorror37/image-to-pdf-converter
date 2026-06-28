'use client';
import { Download, Eye, CheckSquare, Square, RotateCw, Trash2, Undo2, Redo2, Wand2 } from 'lucide-react';
import SortMenu from './SortMenu';

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
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleSelectionMode}
            aria-label={isSelectionMode ? 'Cancel selection' : 'Select images'}
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
          {onSort && (
            <SortMenu
              isDark={isDark}
              options={sortOptions}
              onSort={onSort}
              disabled={isProcessing || imageCount === 0}
            />
          )}
          <button
            onClick={onRotateAll}
            disabled={isProcessing || imageCount === 0}
            title="Rotate all images"
            aria-label="Rotate all images"
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Rotate all</span>
          </button>
          {onAutoRotate && (
            <button
              onClick={onAutoRotate}
              disabled={isProcessing || imageCount === 0}
              title="Auto-rotate (detect & fix orientation)"
              aria-label="Auto-rotate all images"
              className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Auto-rotate</span>
            </button>
          )}
          <button
            onClick={onPreview}
            disabled={isProcessing}
            title="Preview PDF"
            aria-label="Preview PDF"
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 text-sm transition-all disabled:opacity-50 ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          <button
            onClick={onConvert}
            disabled={isProcessing}
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
              disabled={selectedCount === 0}
              title="Auto-rotate selected"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50 shadow-sm'
              }`}
            >
              <Wand2 className="w-4 h-4" /> Auto-rotate
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
