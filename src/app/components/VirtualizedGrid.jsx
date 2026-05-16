'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const computeCols = (width) => {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  return 5;
};

const GAP = 16;

// Grid that switches to TanStack virtualization above `threshold` items.
// `rowHeightFor(cardWidth)` returns the row height in CSS px so the
// container can size correctly before any cards mount.
//
// `onVisibleChange` (optional) receives a Set<itemId> whenever the visible
// page set changes — used by callers that lazily render thumbs.
export default function VirtualizedGrid({
  items,
  renderItem,
  rowHeightFor,
  threshold = 60,
  onVisibleChange,
  getItemId,
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4',
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const update = () => setContainerWidth(containerRef.current?.clientWidth || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const cols = useMemo(() => computeCols(containerWidth || 320), [containerWidth]);
  const rowCount = Math.ceil(items.length / cols);
  const cardWidth = containerWidth ? (containerWidth - GAP * (cols - 1)) / cols : 200;
  const rowHeight = rowHeightFor(cardWidth);

  const useVirtual = items.length >= threshold && containerWidth > 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () =>
      typeof window !== 'undefined' ? window.document.scrollingElement : null,
    estimateSize: () => rowHeight,
    overscan: 4,
    observeElementOffset: (instance, cb) => {
      const onScroll = () => cb(window.scrollY, false);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
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

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  // Report visible IDs whenever the visible row range changes.
  const visibleSigRef = useRef('');
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    if (!onVisibleChange || !getItemId) return;
    if (!useVirtual) {
      const sig = `all:${items.length}`;
      if (sig === visibleSigRef.current) return;
      visibleSigRef.current = sig;
      onVisibleChange(new Set(items.map(getItemId)));
      return;
    }
    const indices = virtualItems.map((v) => v.index);
    const sig = `${cols}:${items.length}:${indices.join(',')}`;
    if (sig === visibleSigRef.current) return;
    visibleSigRef.current = sig;
    const ids = new Set();
    for (const vrow of virtualItems) {
      const start = vrow.index * cols;
      const end = Math.min(start + cols, items.length);
      for (let i = start; i < end; i++) {
        const item = items[i];
        if (item) ids.add(getItemId(item));
      }
    }
    onVisibleChange(ids);
  }, [virtualItems, cols, items, useVirtual, onVisibleChange, getItemId]);

  return (
    <div ref={containerRef} className="w-full">
      {!useVirtual ? (
        <div className={gridClassName}>
          {items.map((item, index) => renderItem(item, index))}
        </div>
      ) : (
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map((virtualRow) => {
            const startIdx = virtualRow.index * cols;
            const endIdx = Math.min(startIdx + cols, items.length);
            const rowItems = [];
            for (let i = startIdx; i < endIdx; i++) {
              rowItems.push(renderItem(items[i], i));
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
                className={`${gridClassName} pb-4`}
              >
                {rowItems}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
