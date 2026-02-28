'use client';

import React, { useRef, useState } from 'react';
import type { EvidenceCardData, InteractionMode } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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

  // Attach listeners to the window to handle dragging outside the card
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
      className="absolute"
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
      <Card
        className={cn(
          'w-full h-full flex flex-col transition-all duration-200 shadow-xl hover:shadow-2xl rounded-2xl bg-card/45 backdrop-blur-2xl border-white/20',
          isSelected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : 'ring-0',
          isDragging ? 'cursor-grabbing shadow-2xl' : 'cursor-grab',
          mode === 'connect' && 'cursor-crosshair'
        )}
      >
        <CardHeader className="flex-shrink-0">
          <div className='flex justify-between items-start'>
            <CardTitle className="text-lg">{card.title}</CardTitle>
            <Badge variant="secondary" className="font-mono text-base">{card.sequence}</Badge>
          </div>
          {card.summary && <CardDescription className='pt-2 text-xs italic'>Resumo: {card.summary}</CardDescription>}
        </CardHeader>
        <CardContent className="flex-grow text-sm overflow-auto">
          <p>{card.content}</p>
          {card.tags && card.tags.length > 0 && (
             <div className="mt-4 flex flex-wrap gap-2">
                {card.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
