'use client';
import { useCallback } from 'react';
import ImageCard from './ImageCard';
import VirtualizedGrid from './VirtualizedGrid';
import { useDragReorder } from '../hooks/useDragReorder';

// Card is square (aspect-square) + label + gap.
const CARD_FOOTER = 56;
const GAP = 16;
const imageRowHeight = (cardWidth) => cardWidth + CARD_FOOTER + GAP;

export default function ImageGrid({
  images,
  isDark,
  isSelectionMode,
  selectedImages,
  onReorder,
  onToggleSelection,
  onRotate,
  onRemove,
  onMove,
}) {
  const { state, handlers } = useDragReorder({ onReorder, isSelectionMode });
  const { draggedIndex, dragOverIndex, touchDragIndex, touchPosition, isTouchDragging } = state;

  const renderCard = useCallback(
    (image, index) => (
      <ImageCard
        key={image.id}
        image={image}
        index={index}
        total={images.length}
        isDark={isDark}
        isSelectionMode={isSelectionMode}
        isSelected={selectedImages.has(image.id)}
        draggedIndex={draggedIndex}
        dragOverIndex={dragOverIndex}
        isTouchDragging={isTouchDragging}
        touchDragIndex={touchDragIndex}
        onDragStart={handlers.onDragStart}
        onDragEnd={handlers.onDragEnd}
        onDragOverItem={handlers.onDragOverItem}
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
        onClick={onToggleSelection}
        onRotate={onRotate}
        onRemove={onRemove}
        onMove={onMove}
        onReorder={onReorder}
      />
    ),
    [
      images.length,
      isDark,
      isSelectionMode,
      selectedImages,
      draggedIndex,
      dragOverIndex,
      isTouchDragging,
      touchDragIndex,
      handlers,
      onToggleSelection,
      onRotate,
      onRemove,
      onMove,
      onReorder,
    ],
  );

  return (
    <>
      <VirtualizedGrid
        items={images}
        renderItem={renderCard}
        rowHeightFor={imageRowHeight}
        getItemId={(img) => img.id}
      />

      {isTouchDragging && touchDragIndex !== null && images[touchDragIndex] && (
        <div
          className={`fixed pointer-events-none z-50 w-24 h-[120px] rounded-xl overflow-hidden shadow-2xl opacity-90 ${
            isDark ? 'ring-2 ring-white/50' : 'ring-2 ring-gray-900/50'
          }`}
          style={{
            left: touchPosition.x - 48,
            top: touchPosition.y - 60,
            transform: 'rotate(3deg)',
          }}
        >
          <img
            src={images[touchDragIndex].thumb || images[touchDragIndex].preview}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${images[touchDragIndex].rotation || 0}deg)` }}
          />
          <div
            className={`absolute top-0 left-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-br-lg ${
              isDark ? 'bg-black/70 text-white' : 'bg-white/90 text-gray-700'
            }`}
          >
            Page {touchDragIndex + 1}
          </div>
        </div>
      )}
    </>
  );
}
