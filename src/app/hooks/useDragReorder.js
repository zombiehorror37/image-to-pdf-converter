import { useRef, useState } from 'react';

// Mouse + touch drag-reorder state machine shared by the grid components.
// Mouse: HTML5 dnd; we drive the reorder on dragOver (live-shuffle).
// Touch: long-press to engage, follow with elementsFromPoint on move,
//        commit on touchEnd.
export function useDragReorder({ onReorder, isSelectionMode }) {
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

  return {
    state: {
      draggedIndex,
      dragOverIndex,
      touchDragIndex,
      touchPosition,
      isTouchDragging,
    },
    handlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOverItem: handleDragOverItem,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
