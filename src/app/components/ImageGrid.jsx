'use client';
import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ImageCard from './ImageCard';

const computeCols = (width) => {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return 5;
};

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
  const containerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [touchDragIndex, setTouchDragIndex] = useState(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const update = () => setContainerWidth(containerRef.current?.clientWidth || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const cols = useMemo(() => computeCols(containerWidth || 320), [containerWidth]);
  const rowCount = Math.ceil(images.length / cols);

  // Estimated row height = card width + text label area + gap.
  // Card is square (aspect-square), so width ~ (containerWidth - gaps) / cols.
  const gap = 16; // tailwind gap-4
  const cardWidth = containerWidth ? (containerWidth - gap * (cols - 1)) / cols : 200;
  const rowHeight = cardWidth + 56 + gap;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => (typeof window !== 'undefined' ? window.document.scrollingElement : null),
    estimateSize: () => rowHeight,
    overscan: 4,
    observeElementOffset: (instance, cb) => {
      const onScroll = () => cb(window.scrollY, false);
      let rafId = requestAnimationFrame(onScroll);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    },
    observeElementRect: (instance, cb) => {
      const onResize = () => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        cb({ width: rect.width, height: window.innerHeight });
      };
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    },
    scrollToFn: (offset) => window.scrollTo({ top: offset, behavior: 'auto' }),
  });

  // Force re-measure when row height changes (cols change)
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

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
      if (targetIndex !== touchDragIndex) {
        setDragOverIndex(targetIndex);
      }
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

  const renderCard = (image, index) => (
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOverItem={handleDragOverItem}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onToggleSelection}
      onRotate={onRotate}
      onRemove={onRemove}
      onMove={onMove}
      onReorder={onReorder}
    />
  );

  // Skip virtualization for small batches — saves complexity, no benefit
  const VIRTUALIZE_THRESHOLD = 60;
  const useVirtual = images.length >= VIRTUALIZE_THRESHOLD && containerWidth > 0;

  return (
    <>
      <div ref={containerRef} className="w-full">
        {!useVirtual ? (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
          >
            {images.map((image, index) => renderCard(image, index))}
          </div>
        ) : (
          <div
            style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const startIdx = virtualRow.index * cols;
              const endIdx = Math.min(startIdx + cols, images.length);
              const rowItems = [];
              for (let i = startIdx; i < endIdx; i++) {
                rowItems.push(renderCard(images[i], i));
              }
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 pb-4"
                >
                  {rowItems}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isTouchDragging && touchDragIndex !== null && (
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
            src={images[touchDragIndex]?.thumb || images[touchDragIndex]?.preview}
            alt=""
            className="w-full h-full object-cover"
            style={{ transform: `rotate(${images[touchDragIndex]?.rotation || 0}deg)` }}
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
