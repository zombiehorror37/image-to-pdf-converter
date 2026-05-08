'use client';
import { useRef, useState } from 'react';
import PdfPageCard from './PdfPageCard';

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
}) {
  const longPressTimerRef = useRef(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchDragIndex, setTouchDragIndex] = useState(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  const handleDragStart = (e, index) => {
    if (isSelectionMode) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOverItem = (e, index) => {
    e.preventDefault();
    if (isSelectionMode) return;
    setDragOverIndex(index);
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleTouchStart = (e, index) => {
    if (isSelectionMode) return;
    const touch = e.touches[0];
    setTouchDragIndex(index);
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setIsTouchDragging(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 200);
  };

  const handleTouchMove = (e) => {
    if (!isTouchDragging || touchDragIndex === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    const elementsAtPoint = document.elementsFromPoint(touch.clientX, touch.clientY);
    const cardElement = elementsAtPoint.find((el) => el.dataset.cardIndex !== undefined);
    if (cardElement) {
      const targetIndex = parseInt(cardElement.dataset.cardIndex);
      if (targetIndex !== touchDragIndex) setDragOverIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    if (isTouchDragging && dragOverIndex !== null && dragOverIndex !== touchDragIndex) {
      onReorder(touchDragIndex, dragOverIndex);
    }
    setTouchDragIndex(null);
    setDragOverIndex(null);
    setIsTouchDragging(false);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {pages.map((page, index) => (
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOverItem={handleDragOverItem}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={onToggleSelection}
            onRotate={onRotate}
            onRemove={onRemove}
            onView={onView}
            onMove={onMove}
          />
        ))}
      </div>

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
