'use client';

import React, { useRef } from 'react';
import type { EvidenceCardData, InteractionMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface EvidenceCardProps {
  card: EvidenceCardData;
  isSelected: boolean;
  mode: InteractionMode;
  dispatch: React.Dispatch<any>;
  viewScale: number;
  selectedCardIds: Set<string>;
}

export function EvidenceCard({ card, isSelected, mode, dispatch, viewScale, selectedCardIds }: EvidenceCardProps) {
  const wasDragged = useRef(false);

  const handleCardClick = (e: React.MouseEvent) => {
    if (wasDragged.current) {
      e.stopPropagation();
      wasDragged.current = false;
      return;
    }
    e.stopPropagation();
    if (mode === 'connect') {
      const fromId = Array.from(selectedCardIds)[0];
        if (fromId) {
            dispatch({ type: 'END_CONNECTION', payload: card.id });
        } else {
            dispatch({ type: 'START_CONNECTION', payload: card.id });
        }
    } else {
        if (e.shiftKey) {
            const newSelectedIds = new Set(selectedCardIds);
            newSelectedIds.add(card.id);
            dispatch({ type: 'SET_SELECTED_CARDS', payload: newSelectedIds });
        } else {
            dispatch({ type: 'SET_SELECTED_CARDS', payload: new Set([card.id]) });
        }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({type: 'START_EDITING', payload: card.id });
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    // Allow pan (middle mouse, ctrl+click) to bubble up to canvas
    if (e.button === 1 || e.ctrlKey) {
        return;
    }
    e.stopPropagation();

    if (mode === 'select' && e.button === 0) {
      wasDragged.current = false; // Reset drag flag
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        return;
    }

    if (!wasDragged.current) {
        // Start treating as a drag after moving a few pixels
        if (e.movementX * e.movementX + e.movementY * e.movementY > 9) {
            wasDragged.current = true;
            document.body.style.cursor = 'grabbing';
        }
    }

    if (wasDragged.current) {
        const delta = {
            x: e.movementX / viewScale,
            y: e.movementY / viewScale,
        };
        dispatch({ type: 'MOVE_CARDS', payload: { cardId: card.id, delta }});
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (wasDragged.current) {
            document.body.style.cursor = 'default';
        }
    }
  };

  return (
    <div
      className={cn(
        'absolute transition-transform duration-200',
        'cursor-grab',
        mode === 'connect' && 'cursor-crosshair'
        )}
      style={{
        left: card.position.x,
        top: card.position.y,
        width: card.width,
        height: card.height,
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Connection Ports - visible only in connect mode */}
      {['top', 'right', 'bottom', 'left'].map(port => (
        <div
            key={port}
            className={cn(
                'absolute w-3 h-3 bg-primary/50 rounded-full border-2 border-white/80 shadow-md -translate-x-1/2 -translate-y-1/2 transition-opacity pointer-events-none',
                mode === 'connect' ? 'opacity-100' : 'opacity-0',
                port === 'top' && 'top-0 left-1/2',
                port === 'bottom' && 'top-full left-1/2',
                port === 'left' && 'top-1/2 left-0',
                port === 'right' && 'top-1/2 left-full',
            )}
        />
      ))}
      <div className="relative w-full h-full">
        {/* Glow effect */}
        <div
          className="pointer-events-none absolute -inset-2 rounded-3xl blur-2xl"
          style={{ background: `radial-gradient(circle at 30% 20%, ${card.accent}40, transparent 60%)` }}
        />

        {/* Main Card Container */}
        <div
          className={cn(
            'relative w-full h-full p-5 flex flex-col gap-4 rounded-3xl border bg-white/25 shadow-[0_18px_40px_rgba(2,6,23,0.10)] backdrop-blur-2xl transition-all duration-200',
            isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-0'
          )}
          style={{ borderColor: card.accent }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl text-white font-bold text-lg shadow-md"
              style={{ backgroundColor: card.accent }}
            >
              {card.sequence}
            </div>
            <div className="flex-grow">
              <h3 className="font-bold text-foreground text-lg leading-tight">{card.title}</h3>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                {card.label} &bull; {card.date}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Fonte: {card.source}</p>
            </div>
          </div>
          
          <div className="text-sm text-foreground/80 leading-snug flex-grow">
              <p>{card.content}</p>
          </div>

          {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
              {card.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs bg-white/10 border-white/20 backdrop-blur-lg">{tag}</Badge>)}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
