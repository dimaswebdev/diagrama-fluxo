'use client';

import React, { useRef, useState } from 'react';
import type { EvidenceCardData, InteractionMode } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { getContrast } from 'polished';

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

  const textColor = getContrast(card.accent, '#FFF') < 3.5 ? '#000' : '#FFF';

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
          'w-full h-full flex flex-col transition-all duration-200 shadow-xl hover:shadow-2xl rounded-2xl bg-card/45 backdrop-blur-xl border-t-4',
          isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-0',
          isDragging ? 'cursor-grabbing shadow-2xl' : 'cursor-grab',
          mode === 'connect' && 'cursor-crosshair'
        )}
        style={{ borderTopColor: card.accent }}
      >
        <CardHeader className="flex-shrink-0 pb-2">
          <div className='flex justify-between items-center'>
            <Badge style={{ backgroundColor: card.accent, color: textColor }} className="font-bold shadow-sm border-none">{card.label}</Badge>
            <span className="text-xs text-muted-foreground font-mono">{card.date}</span>
          </div>
          <CardTitle className="text-base pt-2">{card.title}</CardTitle>
          {card.summary && <CardDescription className='pt-1 text-xs italic'>Resumo: {card.summary}</CardDescription>}
        </CardHeader>
        <CardContent className="flex-grow text-sm overflow-auto py-2">
          <p>{card.content}</p>
          {card.tags && card.tags.length > 0 && (
             <div className="mt-2 flex flex-wrap gap-1">
                {card.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
             </div>
          )}
        </CardContent>
        <CardFooter className="flex-shrink-0 pt-0 pb-3 px-6">
            <p className="text-xs text-muted-foreground italic w-full truncate">Fonte: {card.source}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
