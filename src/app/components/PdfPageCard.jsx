'use client';
import { RotateCw, Trash2, Eye, GripVertical, ChevronUp, ChevronDown, CheckSquare, Highlighter } from 'lucide-react';

// Compact card for a single PDF page. Uses CSS rotation for the thumb so
// rotating doesn't require a re-render — the actual page rotation is applied
// during export by pdf-lib.
export default function PdfPageCard({
  page,
  index,
  total,
  isDark,
  isSelectionMode,
  isSelected,
  draggedIndex,
  dragOverIndex,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  isTouchDragging,
  touchDragIndex,
  onClick,
  onRotate,
  onRemove,
  onView,
  onMove,
}) {
  const isBeingDragged = draggedIndex === index || (isTouchDragging && touchDragIndex === index);
  const isDropTarget =
    dragOverIndex === index &&
    (draggedIndex !== null || isTouchDragging) &&
    ((draggedIndex !== null && draggedIndex !== index) || (isTouchDragging && touchDragIndex !== index));

  const hasAnnotations =
    (page.annotations?.highlights?.length || 0) + (page.annotations?.inks?.length || 0) > 0;

  return (
    <div
      data-card-index={index}
      draggable={!isSelectionMode}
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOverItem(e, index)}
      onTouchStart={(e) => onTouchStart(e, index)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => isSelectionMode && onClick(page.id)}
      className={`rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 border flex flex-col ${
        isDark
          ? 'bg-gray-800/80 backdrop-blur-sm border-gray-700/50'
          : 'bg-white border-gray-200 shadow-md'
      } ${isSelectionMode ? 'cursor-pointer' : 'sm:cursor-move'} ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
          : ''
      } ${
        isBeingDragged
          ? 'opacity-50 scale-95 rotate-1'
          : isDropTarget
            ? 'ring-2 ring-blue-500 ring-offset-2 scale-[1.02] shadow-xl shadow-blue-500/30 ' +
              (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
            : ''
      }`}
    >
      <div className={`relative group flex items-center justify-center overflow-hidden ${
        isDark ? 'bg-gray-900/40' : 'bg-gray-50'
      }`} style={{ aspectRatio: '4 / 5' }}>
        {isSelectionMode && (
          <div
            className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-blue-500 text-white'
                : isDark
                  ? 'bg-gray-800/80 border border-gray-600'
                  : 'bg-white/80 border border-gray-300'
            }`}
          >
            {isSelected && <CheckSquare className="w-4 h-4" />}
          </div>
        )}

        {!isSelectionMode && (
          <div className="absolute top-0 left-0 z-10">
            <div
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-semibold tracking-wide uppercase rounded-br-xl rounded-tl-xl backdrop-blur-md ${
                isDark ? 'bg-black/70 text-white/90' : 'bg-white/90 text-gray-700 shadow-sm'
              }`}
            >
              <span className="opacity-60">Page</span> {index + 1}
            </div>
          </div>
        )}

        {hasAnnotations && (
          <div className="absolute top-2 right-2 z-10 pointer-events-none">
            <div
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                isDark ? 'bg-yellow-500/30 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              <Highlighter className="w-3 h-3" />
              annotated
            </div>
          </div>
        )}

        {page.thumb ? (
          <img
            src={page.thumb}
            alt={`Page ${index + 1}`}
            className="max-w-full max-h-full object-contain pointer-events-none"
            style={{ transform: `rotate(${page.rotation}deg)` }}
            draggable={false}
          />
        ) : (
          <div className="text-xs text-gray-400 p-4">Rendering…</div>
        )}

        {!isSelectionMode && (
          <>
            <div className="absolute bottom-2 left-2 right-2 hidden sm:flex justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(page.id);
                }}
                className={`p-2 rounded-lg transition-all ${
                  isDark
                    ? 'bg-black/60 backdrop-blur-sm hover:bg-black/80'
                    : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm'
                }`}
                title="View / annotate"
              >
                <Eye className="w-4 h-4" />
              </button>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRotate(page.id);
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    isDark
                      ? 'bg-black/60 backdrop-blur-sm hover:bg-black/80'
                      : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm'
                  }`}
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(page.id);
                  }}
                  className={`p-2 rounded-lg text-red-400 transition-all ${
                    isDark
                      ? 'bg-black/60 backdrop-blur-sm hover:bg-red-500/80 hover:text-white'
                      : 'bg-white/80 backdrop-blur-sm hover:bg-red-500 hover:text-white shadow-sm'
                  }`}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="absolute top-2 right-2 flex sm:hidden gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(page.id);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  isDark ? 'bg-black/60 backdrop-blur-sm active:bg-black/80' : 'bg-white/80 backdrop-blur-sm active:bg-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRotate(page.id);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  isDark ? 'bg-black/60 backdrop-blur-sm active:bg-black/80' : 'bg-white/80 backdrop-blur-sm active:bg-white'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(page.id);
                }}
                className={`p-1.5 rounded-lg text-red-400 transition-all ${
                  isDark ? 'bg-black/60 backdrop-blur-sm active:bg-red-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-red-500'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="absolute bottom-2 right-2 flex sm:hidden gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(index, 'up');
                }}
                disabled={index === 0}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition-all ${
                  isDark ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
                }`}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(index, 'down');
                }}
                disabled={index === total - 1}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition-all ${
                  isDark ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80' : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="absolute top-2 right-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div
                className={`p-1 rounded-md ${
                  isDark ? 'bg-black/60 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm shadow-sm'
                }`}
              >
                <GripVertical className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-2">
        <p className="text-xs font-medium truncate">{page.docName}</p>
        <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          page {page.srcPageIndex + 1}
          {page.rotation ? ` · rotated ${page.rotation}°` : ''}
        </p>
      </div>
    </div>
  );
}
