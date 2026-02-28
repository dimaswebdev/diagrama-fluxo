'use client'

import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle
} from 'react';

import type {
  EvidenceCardData,
  ConnectionData,
  InteractionMode,
  EdgeType,
  NodeShape
} from '@/lib/types';

import { EvidenceCard } from './evidence-card';
import { ConnectionLine } from './connection-line';
import { LeftToolbar } from './left-toolbar';

interface TimelineCanvasProps {
  cards: EvidenceCardData[];
  connections: ConnectionData[];
  mode: InteractionMode;
  selectedCardIds: Set<string>;
  dispatch: React.Dispatch<any>;
}

export const TimelineCanvas = forwardRef<any, TimelineCanvasProps>(({
  cards,
  connections,
  mode,
  selectedCardIds,
  dispatch,
}, ref) => {

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    container: canvasContainerRef.current,
    content: canvasContentRef.current
  }));

  const [edgeType, setEdgeType] = useState<EdgeType>("orthogonal");
  const [nodeShape, setNodeShape] = useState<NodeShape>("rectangle");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(false);
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (isCtrlPressed && mode === 'select')) {
      setIsPanning(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = 'grabbing';
    } else if (mode === 'select') {
      dispatch({ type: 'SET_SELECTED_CARDS', payload: new Set() });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setView(v => ({ ...v, x: v.x + e.movementX, y: v.y + e.movementY }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      document.body.style.cursor = 'default';
    }
  };

  return (
    <div
      ref={canvasContainerRef}
      className="w-full h-full overflow-hidden absolute top-0 left-0 dotted-grid"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        backgroundSize: `${32 * view.zoom}px ${32 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: isPanning ? 'grabbing' : 'default',
      }}
    >
      <LeftToolbar
        nodeShape={nodeShape}
        setNodeShape={setNodeShape}
        edgeType={edgeType}
        setEdgeType={setEdgeType}
      />

      <div
        ref={canvasContentRef}
        data-canvas-content="true"
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {connections.map(conn => (
          <ConnectionLine
            key={conn.id}
            connection={conn}
            dispatch={dispatch}
            fromCard={cards.find(c => c.id === conn.from)}
            toCard={cards.find(c => c.id === conn.to)}
            zoom={view.zoom}
            mode={mode}
            edgeType={edgeType}
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
            selectedCardIds={selectedCardIds}
            nodeShape={nodeShape}
          />
        ))}
      </div>
    </div>
  );
});

TimelineCanvas.displayName = 'TimelineCanvas';