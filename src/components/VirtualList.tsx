import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area
  className?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = ''
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Get visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, visibleRange]);

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Scroll to top when items change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={index}
              style={{ height: itemHeight }}
              className="flex items-center"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for virtual scrolling with dynamic item heights
export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  estimatedItemHeight: number = 60
) {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate cumulative heights
  const cumulativeHeights = useMemo(() => {
    const heights: number[] = [];
    let total = 0;
    
    for (let i = 0; i < items.length; i++) {
      heights.push(total);
      total += itemHeights.get(i) || estimatedItemHeight;
    }
    
    return { heights, total };
  }, [items.length, itemHeights, estimatedItemHeight]);

  // Find visible range
  const visibleRange = useMemo(() => {
    const { heights, total } = cumulativeHeights;
    
    let startIndex = 0;
    let endIndex = items.length - 1;
    
    // Find start index
    for (let i = 0; i < heights.length; i++) {
      if (heights[i] + (itemHeights.get(i) || estimatedItemHeight) > scrollTop) {
        startIndex = i;
        break;
      }
    }
    
    // Find end index
    for (let i = startIndex; i < heights.length; i++) {
      if (heights[i] > scrollTop + containerHeight) {
        endIndex = i - 1;
        break;
      }
    }
    
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, cumulativeHeights, items.length, itemHeights, estimatedItemHeight]);

  // Update item height
  const updateItemHeight = (index: number, height: number) => {
    setItemHeights(prev => new Map(prev).set(index, height));
  };

  // Scroll to item
  const scrollToItem = (index: number) => {
    if (containerRef.current) {
      const { heights } = cumulativeHeights;
      const targetScrollTop = heights[index] || 0;
      containerRef.current.scrollTop = targetScrollTop;
    }
  };

  return {
    containerRef,
    scrollTop,
    setScrollTop,
    visibleRange,
    totalHeight: cumulativeHeights.total,
    offsetY: cumulativeHeights.heights[visibleRange.startIndex] || 0,
    updateItemHeight,
    scrollToItem
  };
}

