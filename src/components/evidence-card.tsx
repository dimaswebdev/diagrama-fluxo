'use client';

import React, { useRef, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleCardClick = (e: React.MouseEvent) => {
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'select' && e.button === 0 && !e.shiftKey && !e.ctrlKey) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX / viewScale - card.position.x,
        y: e.clientY / viewScale - card.position.y,
      };
      document.body.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const delta = {
        x: (e.clientX / viewScale) - dragStartPos.current.x - card.position.x,
        y: (e.clientY / viewScale) - dragStartPos.current.y - card.position.y,
      };
      dispatch({ type: 'MOVE_CARDS', payload: { cardId: card.id, delta }});
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);


  return (
    <div
      className={cn(
        'absolute transition-all duration-200',
        isDragging ? 'cursor-grabbing z-10' : 'cursor-grab',
        mode === 'connect' && 'cursor-crosshair'
        )}
      style={{
        left: card.position.x,
        top: card.position.y,
        width: card.width,
        height: card.height,
      }}
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn(
          'w-full h-full p-5 flex flex-col gap-3 rounded-3xl transition-all duration-200 shadow-xl hover:shadow-2xl bg-white/70 backdrop-blur-md border-2',
          isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-0'
        )}
        style={{ borderColor: card.accent }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-white font-bold text-lg shadow-md"
            style={{ backgroundColor: card.accent }}
          >
            {card.sequence}
          </div>
          <div className="flex-grow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {card.label} &bull; {card.date}
            </p>
            <h3 className="font-bold text-slate-800 text-base leading-tight mt-0.5">{card.title}</h3>
            <p className="text-xs text-slate-500 mt-1">Fonte: {card.source}</p>
          </div>
        </div>
        
        <div className="text-sm text-slate-700 leading-snug flex-grow">
            <p>{card.content}</p>
        </div>

        {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
            {card.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs bg-black/5 border-black/10">{tag}</Badge>)}
            </div>
        )}
      </div>
    </div>
  );
}
