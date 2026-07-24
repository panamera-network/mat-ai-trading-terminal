import React, { useRef, useEffect, useState, useCallback } from 'react';

interface DragLine {
  id: string;
  type: 'SL' | 'TP';
  price: number;
  color: string;
  y: number; // pixel position on chart
}

interface SLTPDragOverlayProps {
  chartRef: React.RefObject<HTMLDivElement>;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  sl?: number;
  tp?: number;
  entryPrice?: number;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

export const SLTPDragOverlay: React.FC<SLTPDragOverlayProps> = ({
  chartRef,
  priceToY,
  yToPrice,
  sl,
  tp,
  entryPrice,
  onSlChange,
  onTpChange
}) => {
  const [lines, setLines] = useState<DragLine[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize lines from props
  useEffect(() => {
    const newLines: DragLine[] = [];
    if(sl !== undefined) {
      newLines.push({
        id: 'sl',
        type: 'SL',
        price: sl,
        color: '#ef4444', // red
        y: priceToY(sl)
      });
    }
    if(tp !== undefined) {
      newLines.push({
        id: 'tp',
        type: 'TP',
        price: tp,
        color: '#22c55e', // green
        y: priceToY(tp)
      });
    }
    setLines(newLines);
  }, [sl, tp, priceToY]);

  const handleMouseDown = useCallback((e: React.MouseEvent, lineId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(lineId);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if(!dragging || !chartRef.current) return;
    
    const rect = chartRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const price = yToPrice(y);
    
    setLines(prev => prev.map(line => 
      line.id === dragging ? { ...line, y, price } : line
    ));
  }, [dragging, chartRef, yToPrice]);

  const handleMouseUp = useCallback(() => {
    if(!dragging) return;
    
    const line = lines.find(l => l.id === dragging);
    if(line) {
      if(line.type === 'SL' && onSlChange) onSlChange(line.price);
      if(line.type === 'TP' && onTpChange) onTpChange(line.price);
    }
    
    setDragging(null);
  }, [dragging, lines, onSlChange, onTpChange]);

  useEffect(() => {
    if(dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Calculate pip distance from entry
  const getPipDistance = (price: number) => {
    if(!entryPrice) return 0;
    return Math.abs(price - entryPrice) * 10000; // For 5-digit brokers
  };

  return (
    <div 
      ref={overlayRef}
      className="sltp-overlay"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        pointerEvents: dragging ? 'all' : 'none',
        cursor: dragging ? 'ns-resize' : 'default'
      }}
    >
      {lines.map(line => (
        <div
          key={line.id}
          className={`drag-line ${line.type.toLowerCase()}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: line.y,
            height: 2,
            backgroundColor: line.color,
            pointerEvents: 'all',
            cursor: 'ns-resize'
          }}
          onMouseDown={e => handleMouseDown(e, line.id)}
        >
          {/* Label */}
          <div 
            className="line-label"
            style={{
              position: 'absolute',
              right: 10,
              top: -20,
              backgroundColor: line.color,
              color: 'white',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            {line.type} {line.price.toFixed(5)} 
            {entryPrice && ` (${getPipDistance(line.price).toFixed(1)} pips)`}
          </div>
          
          {/* Drag handle */}
          <div 
            className="drag-handle"
            style={{
              position: 'absolute',
              left: '50%',
              top: -6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: line.color,
              transform: 'translateX(-50%)',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          />
        </div>
      ))}
    </div>
  );
};