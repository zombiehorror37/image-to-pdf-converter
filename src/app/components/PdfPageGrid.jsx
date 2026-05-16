'use client';
import { useCallback } from 'react';
import PdfPageCard from './PdfPageCard';
import VirtualizedGrid from './VirtualizedGrid';
import { useDragReorder } from '../hooks/useDragReorder';

// Card aspect-ratio is 4:5 plus the text label footer + gap.
const CARD_FOOTER = 48;
const GAP = 16;
const pageRowHeight = (cardWidth) => (cardWidth * 5) / 4 + CARD_FOOTER + GAP;

export default function PdfPageGrid({
  pages,
  isDark,
  isSelectionMode,
  selectedPages,
  onReorder,
  onToggleSelection,
  onRotate,
  onRemove,
  onView,
  onMove,
  onVisiblePagesChange,
}) {
  const { state, handlers } = useDragReorder({ onReorder, isSelectionMode });
  const { draggedIndex, dragOverIndex, touchDragIndex, touchPosition, isTouchDragging } = state;

  const renderCard = useCallback(
    (page, index) => (
      <PdfPageCard
        key={page.id}
        page={page}
        index={index}
        total={pages.length}
        isDark={isDark}
        isSelectionMode={isSelectionMode}
        isSelected={selectedPages.has(page.id)}
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
        onView={onView}
        onMove={onMove}
        onReorder={onReorder}
      />
    ),
    [
      pages.length,
      isDark,
      isSelectionMode,
      selectedPages,
      draggedIndex,
      dragOverIndex,
      isTouchDragging,
      touchDragIndex,
      handlers,
      onToggleSelection,
      onRotate,
      onRemove,
      onView,
      onMove,
      onReorder,
    ],
  );

  return (
    <>
      <VirtualizedGrid
        items={pages}
        renderItem={renderCard}
        rowHeightFor={pageRowHeight}
        getItemId={(p) => p.id}
        onVisibleChange={onVisiblePagesChange}
      />

      {isTouchDragging && touchDragIndex !== null && pages[touchDragIndex] && (
        <div
          className={`fixed pointer-events-none z-50 w-24 h-[120px] rounded-xl overflow-hidden shadow-2xl opacity-90 ${
            isDark ? 'ring-2 ring-white/50 bg-gray-800' : 'ring-2 ring-gray-900/50 bg-white'
          }`}
          style={{
            left: touchPosition.x - 48,
            top: touchPosition.y - 60,
            transform: 'rotate(3deg)',
          }}
        >
          {pages[touchDragIndex].thumb && (
            <img
              src={pages[touchDragIndex].thumb}
              alt=""
              className="w-full h-full object-contain"
              style={{ transform: `rotate(${pages[touchDragIndex].rotation || 0}deg)` }}
            />
          )}
        </div>
      )}
    </>
  );
}
