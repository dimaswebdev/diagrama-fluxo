'use client'

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { EvidenceCardData, ConnectionData, InteractionMode } from '@/lib/types';
import { EvidenceCard } from './evidence-card';
import { ConnectionLine } from './connection-line';
import { cn } from '@/lib/utils';

interface TimelineCanvasProps {
  cards: EvidenceCardData[];
  connections: ConnectionData[];
  mode: InteractionMode;
  selectedCardIds: Set<string>;
  dispatch: React.Dispatch<any>;
}

export const TimelineCanvas = forwardRef<HTMLDivElement, TimelineCanvasProps>(({
  cards,
  connections,
  mode,
  selectedCardIds,
  dispatch,
}, ref) => {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);
  const startPanPoint = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => canvasContainerRef.current as HTMLDivElement);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? view.zoom * zoomFactor : view.zoom / zoomFactor;
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
    setView(v => ({ ...v, zoom: clampedZoom }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // Middle mouse button or Ctrl+Click
      setIsPanning(true);
      startPanPoint.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    } else if (e.button === 0 && mode === 'select' && e.target === canvasContainerRef.current) {
      setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - startPanPoint.current.x;
      const newY = e.clientY - startPanPoint.current.y;
      setView(v => ({ ...v, x: newX, y: newY }));
    } else if (selectionRect) {
        const newWidth = e.clientX - selectionRect.x;
        const newHeight = e.clientY - selectionRect.y;
        setSelectionRect(rect => rect ? {...rect, width: newWidth, height: newHeight } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
        setIsPanning(false);
    }
    if (selectionRect && canvasContainerRef.current) {
        const canvasRect = canvasContainerRef.current.getBoundingClientRect();
        const rect = {
            x: Math.min(selectionRect.x, selectionRect.x + selectionRect.width) - canvasRect.left,
            y: Math.min(selectionRect.y, selectionRect.y + selectionRect.height) - canvasRect.top,
            width: Math.abs(selectionRect.width),
            height: Math.abs(selectionRect.height)
        };
        
        const idsInRect = new Set<string>();
        cards.forEach(card => {
            const cardX = (card.position.x * view.zoom) + view.x;
            const cardY = (card.position.y * view.zoom) + view.y;
            const cardWidth = card.width * view.zoom;
            const cardHeight = card.height * view.zoom;

            if (cardX < rect.x + rect.width && cardX + cardWidth > rect.x &&
                cardY < rect.y + rect.height && cardY + cardHeight > rect.y) {
                idsInRect.add(card.id);
            }
        });
        
        if (e.shiftKey) {
            dispatch({ type: 'SET_SELECTED_CARDS', payload: new Set([...selectedCardIds, ...idsInRect])});
        } else {
            dispatch({ type: 'SET_SELECTED_CARDS', payload: idsInRect });
        }
        
        setSelectionRect(null);
    }
  };
  
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasContainerRef.current) {
        dispatch({ type: 'SET_SELECTED_CARDS', payload: new Set() });
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target === canvasContainerRef.current) {
        dispatch({ type: 'SET_SELECTED_CARDS', payload: new Set(cards.map(c => c.id)) });
    }
  }

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (el) {
      if (isPanning) {
        el.style.cursor = 'grabbing';
      } else if (isCtrlPressed) {
        el.style.cursor = 'grab';
      } else {
        el.style.cursor = 'default';
      }
    }
  }, [isPanning, isCtrlPressed]);


  return (
    <div
      ref={canvasContainerRef}
      className="w-full h-full overflow-hidden absolute top-0 left-0"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
    >
      <div
        data-canvas-content="true"
        className="absolute top-0 left-0"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: 'top left' }}
      >
        {connections.map(conn => (
          <ConnectionLine
            key={conn.id}
            fromCard={cards.find(c => c.id === conn.from)}
            toCard={cards.find(c => c.id === conn.to)}
            zoom={view.zoom}
          />
        ))}
        {cards.map(card => (
          <EvidenceCard
            key={card.id}
            card={card}
            isSelected={selectedCardIds.has(card.id)}
            mode={mode}
            dispatch={dispatch}
            viewScale={view.zoom}
          />
        ))}
      </div>
       {selectionRect && (
        <div
          className="absolute border-2 border-dashed border-ring/70 bg-ring/20 pointer-events-none"
          style={{
            left: Math.min(selectionRect.x, selectionRect.x + selectionRect.width),
            top: Math.min(selectionRect.y, selectionRect.y + selectionRect.height),
            width: Math.abs(selectionRect.width),
            height: Math.abs(selectionRect.height)
          }}
        />
      )}
    </div>
  );
});

TimelineCanvas.displayName = 'TimelineCanvas';
