'use client';

import React, { useRef } from 'react';
import type {
  EvidenceCardData,
  InteractionMode,
  NodeShape
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface EvidenceCardProps {
  card: EvidenceCardData;
  isSelected: boolean;
  mode: InteractionMode;
  dispatch: React.Dispatch<any>;
  viewScale: number;
  selectedCardIds: Set<string>;
  nodeShape: NodeShape;
}

export function EvidenceCard({
  card,
  isSelected,
  mode,
  dispatch,
  viewScale,
  selectedCardIds,
  nodeShape
}: EvidenceCardProps) {

  const wasDragged = useRef(false);

  // ==========================================================
  // 🔥 CÍRCULO REAL (GEOMETRIA CORRETA)
  // ==========================================================

  const circleSize =
    nodeShape === 'circle'
      ? Math.min(card.width, card.height)
      : undefined;

  const width = nodeShape === 'circle'
    ? circleSize
    : card.width;

  const height = nodeShape === 'circle'
    ? circleSize
    : card.height;

  // ==========================================================
  // 🔥 TIPOGRAFIA DINÂMICA
  // ==========================================================

  const diameter = circleSize ?? 0;

  const dynamicTitleSize =
    nodeShape === 'circle'
      ? `clamp(0.85rem, ${diameter / 260}rem, 1.5rem)`
      : undefined;

  const dynamicContentSize =
    nodeShape === 'circle'
      ? `clamp(0.7rem, ${diameter / 320}rem, 1rem)`
      : undefined;

  const dynamicPadding =
    nodeShape === 'circle'
      ? Math.max(16, diameter * 0.08)
      : 20;

  // ==========================================================
  // 🎯 INTERAÇÕES
  // ==========================================================

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
    dispatch({ type: 'START_EDITING', payload: card.id });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.ctrlKey) return;
    e.stopPropagation();

    if (mode === 'select' && e.button === 0) {
      wasDragged.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;

    if (!wasDragged.current) {
      if (e.movementX * e.movementX + e.movementY * e.movementY > 9) {
        wasDragged.current = true;
        document.body.style.cursor = 'grabbing';
      }
    }

    if (wasDragged.current) {
      const delta = {
        x: e.movementX / viewScale,
        y: e.movementY / viewScale
      };

      dispatch({
        type: 'MOVE_CARDS',
        payload: { cardId: card.id, delta }
      });
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

  // ==========================================================
  // 🎨 RENDER
  // ==========================================================

  return (
    <div
      className={cn(
        'absolute transition-transform duration-200 cursor-grab',
        mode === 'connect' && 'cursor-crosshair'
      )}
      style={{
        left: card.position.x,
        top: card.position.y,
        width,
        height,
        transform: isSelected ? 'scale(1.02)' : 'scale(1)'
      }}
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Glow */}
      <div
        className={cn(
          'pointer-events-none absolute -inset-2 blur-2xl',
          nodeShape === 'circle' ? 'rounded-full' : 'rounded-3xl'
        )}
        style={{
          background: `radial-gradient(circle at 30% 20%, ${card.accent}40, transparent 60%)`
        }}
      />

      {/* Main Container */}
      <div
        className={cn(
          'relative w-full h-full border bg-white/25 shadow-[0_18px_40px_rgba(2,6,23,0.10)] backdrop-blur-2xl transition-all duration-200 overflow-hidden',
          nodeShape === 'circle'
            ? 'rounded-full flex flex-col items-center justify-center text-center'
            : 'rounded-3xl flex flex-col gap-4',
          isSelected
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            : 'ring-0'
        )}
        style={{
          borderColor: card.accent,
          padding: dynamicPadding
        }}
      >
        {nodeShape === 'circle' ? (
          <div className="flex flex-col items-center justify-center gap-3 w-full max-w-[80%]">

            <div
              className="flex items-center justify-center rounded-full text-white font-bold shadow-md"
              style={{
                backgroundColor: card.accent,
                width: diameter * 0.18,
                height: diameter * 0.18,
                fontSize: `clamp(0.7rem, ${diameter / 300}rem, 1.2rem)`
              }}
            >
              {card.sequence}
            </div>

            <h3
              className="font-semibold leading-tight break-words"
              style={{ fontSize: dynamicTitleSize }}
            >
              {card.title}
            </h3>

            <div
              className="leading-snug break-words overflow-hidden"
              style={{
                fontSize: dynamicContentSize,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                maskImage:
                  'linear-gradient(to bottom, black 70%, transparent 100%)'
              }}
            >
              {card.content}
            </div>

          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl text-white font-bold text-lg shadow-md"
                style={{ backgroundColor: card.accent }}
              >
                {card.sequence}
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-foreground text-lg leading-tight">
                  {card.title}
                </h3>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">
                  {card.label} • {card.date}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fonte: {card.source}
                </p>
              </div>
            </div>

            <div className="text-sm text-foreground/80 leading-snug flex-grow">
              <p>{card.content}</p>
            </div>

            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-white/10 border-white/20 backdrop-blur-lg"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}