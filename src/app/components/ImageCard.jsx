'use client';
import { RotateCw, X, ChevronUp, ChevronDown, GripVertical, CheckSquare } from 'lucide-react';
import CardMenu from './CardMenu';

export default function ImageCard({
  image,
  index,
  total,
  isDark,
  isSelectionMode,
  isSelected,
  draggedIndex,
  dragOverIndex,
  isTouchDragging,
  touchDragIndex,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  onRotate,
  onRemove,
  onMove,
  onReorder,
}) {
  const isBeingDragged = draggedIndex === index || (isTouchDragging && touchDragIndex === index);
  const isDropTarget =
    dragOverIndex === index &&
    (draggedIndex !== null || isTouchDragging) &&
    ((draggedIndex !== null && draggedIndex !== index) || (isTouchDragging && touchDragIndex !== index));

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
      onClick={() => isSelectionMode && onClick(image.id)}
      className={`rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 border ${
        isDark
          ? 'bg-gray-800/80 backdrop-blur-sm border-gray-700/50'
          : 'bg-white border-gray-200 shadow-md'
      } ${isSelectionMode ? 'cursor-pointer' : ''} ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
          : ''
      } ${
        isBeingDragged
          ? 'opacity-50 scale-95 rotate-2'
          : isDropTarget
            ? 'ring-2 ring-blue-500 ring-offset-2 scale-[1.02] shadow-xl shadow-blue-500/30 ' +
              (isDark ? 'ring-offset-gray-900' : 'ring-offset-white')
            : !isSelectionMode
              ? isDark
                ? 'hover:bg-gray-800 sm:cursor-move'
                : 'hover:shadow-lg sm:cursor-move'
              : ''
      }`}
    >
      <div className="relative group" style={{ aspectRatio: '4 / 5' }}>
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
          <div
            className={`absolute top-0 left-0 z-10 transition-all duration-200 ${
              isBeingDragged ? 'opacity-50' : isDropTarget ? 'scale-110' : ''
            }`}
          >
            <div
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-semibold tracking-wide uppercase rounded-br-xl rounded-tl-xl backdrop-blur-md ${
                isDark ? 'bg-black/70 text-white/90' : 'bg-white/90 text-gray-700 shadow-sm'
              }`}
            >
              <span className="opacity-60">Page</span> {index + 1}
            </div>
          </div>
        )}

        <img
          src={image.thumb || image.preview}
          alt={image.name}
          loading="lazy"
          className="w-full h-full object-contain pointer-events-none"
          style={{ transform: `rotate(${image.rotation}deg)` }}
          draggable={false}
        />

        {!isSelectionMode && (
          <div className="absolute top-2 right-2 hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRotate(image.id);
              }}
              className={`p-2 rounded-lg transition-all ${
                isDark
                  ? 'bg-black/60 backdrop-blur-sm hover:bg-black/80'
                  : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(image.id);
              }}
              className={`p-2 rounded-lg text-red-400 transition-all ${
                isDark
                  ? 'bg-black/60 backdrop-blur-sm hover:bg-red-500/80 hover:text-white'
                  : 'bg-white/80 backdrop-blur-sm hover:bg-red-500 hover:text-white shadow-sm'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
            <CardMenu isDark={isDark} index={index} total={total} onReorder={onReorder} />
          </div>
        )}

        {!isSelectionMode && (
          <div className="absolute top-2 right-2 flex sm:hidden gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRotate(image.id);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark
                  ? 'bg-black/60 backdrop-blur-sm active:bg-black/80'
                  : 'bg-white/80 backdrop-blur-sm active:bg-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(image.id);
              }}
              className={`p-1.5 rounded-lg text-red-400 transition-all ${
                isDark
                  ? 'bg-black/60 backdrop-blur-sm active:bg-red-500/80'
                  : 'bg-white/80 backdrop-blur-sm active:bg-red-500'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!isSelectionMode && (
          <div className="absolute bottom-2 right-2 flex sm:hidden gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(index, 'up');
              }}
              disabled={index === 0}
              className={`p-1.5 rounded-lg disabled:opacity-30 transition-all ${
                isDark
                  ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80'
                  : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
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
                isDark
                  ? 'bg-black/60 backdrop-blur-sm active:bg-blue-500/80'
                  : 'bg-white/80 backdrop-blur-sm active:bg-blue-500'
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!isSelectionMode && (
          <div className="absolute bottom-2 left-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
            <div
              className={`p-1.5 rounded-lg flex items-center gap-1 ${
                isDark ? 'bg-black/60 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm shadow-sm'
              }`}
            >
              <GripVertical className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Drag</span>
            </div>
          </div>
        )}

        {isDropTarget && (
          <div
            className={`absolute inset-0 border-2 border-dashed rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-[2px] ${
              isDark ? 'bg-white/10 border-white/40' : 'bg-gray-900/10 border-gray-900/40'
            }`}
          >
            <div
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                isDark ? 'bg-white/90 text-gray-900' : 'bg-gray-900/90 text-white'
              }`}
            >
              Move to page {index + 1}
            </div>
          </div>
        )}
      </div>

      <div className="p-2 sm:p-3">
        <p className="text-xs sm:text-sm font-medium truncate">{image.name}</p>
        <p className={`text-[10px] sm:text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {image.width} × {image.height}
        </p>
      </div>
    </div>
  );
}
