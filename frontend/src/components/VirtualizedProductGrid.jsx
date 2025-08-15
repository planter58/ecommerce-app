import { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import ProductCard from './ProductCard';

// Virtualized grid that renders only visible product cards.
// Note: Uses its own scroll container to avoid large DOM; keeps data/order intact.
export default function VirtualizedProductGrid({ items, minCols = 2, maxCols = 5, gap = 12, rowHeight = 340 }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 600 });

  // Measure container width and viewport height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setDims(prev => ({ ...prev, width: Math.max(0, rect.width) }));
    });
    ro.observe(el);

    const onWin = () => {
      // Try to allocate nearly full viewport height minus some header space (~180px)
      const h = Math.max(320, window.innerHeight - 180);
      setDims(prev => ({ ...prev, height: h }));
    };
    onWin();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, []);

  // Determine columns based on available width (simple breakpoints)
  const columnCount = useMemo(() => {
    const w = dims.width;
    if (w <= 0) return minCols;
    if (w < 640) return Math.max(minCols, 2);
    if (w < 900) return Math.min(maxCols, 3);
    if (w < 1200) return Math.min(maxCols, 4);
    return Math.min(maxCols, 5);
  }, [dims.width, minCols, maxCols]);

  const columnWidth = useMemo(() => {
    const w = dims.width;
    if (w <= 0) return 200;
    const totalGaps = (columnCount - 1) * gap;
    return Math.max(160, Math.floor((w - totalGaps) / columnCount));
  }, [dims.width, columnCount, gap]);

  const rowCount = useMemo(() => {
    return Math.ceil((items?.length || 0) / columnCount);
  }, [items, columnCount]);

  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= (items?.length || 0)) return null;
    const product = items[index];
    const cellStyle = {
      ...style,
      left: style.left + (columnIndex > 0 ? gap * columnIndex : 0),
      top: style.top + (rowIndex > 0 ? gap * rowIndex : 0),
      width: columnWidth,
      height: rowHeight,
    };
    return (
      <div style={cellStyle}>
        <ProductCard key={product.id} product={product} />
      </div>
    );
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <Grid
        columnCount={columnCount}
        columnWidth={columnWidth}
        height={dims.height}
        rowCount={rowCount}
        rowHeight={rowHeight}
        width={dims.width}
        itemKey={({ columnIndex, rowIndex }) => {
          const idx = rowIndex * columnCount + columnIndex;
          return items[idx]?.id ?? `empty-${rowIndex}-${columnIndex}`;
        }}
        style={{ overflowX: 'hidden' }}
      >
        {Cell}
      </Grid>
    </div>
  );
}
