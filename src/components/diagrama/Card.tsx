'use client';

import React from 'react';
import { Card as CardType, Point } from '@/types/diagrama';

interface CardProps {
  card: CardType;
  scale: number; 
  offset: { x: number; y: number };
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<CardType>) => void;
  onConnectionStart: (point: Point) => void;
  onConnectionEnd: (targetCardId: string) => void;
}

const Card: React.FC<CardProps> = ({
  card,
  scale,
  offset,
  isSelected,
  onClick,
  onDragStart,
  onConnectionStart,
}) => {
  return (
    <div
      className="card absolute rounded-2xl shadow-md transition-all duration-200 select-none"
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        backgroundColor: `${card.accent}20`, // opacidade leve
        border: `2px solid ${card.accent}`,
        boxShadow: isSelected
          ? `0 0 0 3px ${card.accent}55`
          : '0 4px 10px rgba(0,0,0,0.08)',
        cursor: 'move',
      }}
      onMouseDown={onDragStart}
      onClick={onClick}
    >
      <div className="p-4 h-full flex flex-col">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-3">

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: card.accent }}
          >
            {card.sequence}
          </div>

          <div>
            <div className="font-semibold text-gray-800 leading-tight">
              {card.title}
            </div>
            <div className="text-xs text-gray-500">
              {card.date}
            </div>
          </div>

        </div>

        {/* CONTENT */}
        <div className="flex-1 text-sm text-gray-700 overflow-hidden">
          {card.content}
        </div>

        {/* FOOTER (opcional: label / source) */}
        {(card.label || card.source) && (
          <div className="mt-3 text-xs text-gray-500 flex justify-between">
            <span>{card.label}</span>
            <span>{card.source}</span>
          </div>
        )}
      </div>

      {/* CONNECTION POINTS */}
      {['top', 'right', 'bottom', 'left'].map((side) => {
        const baseStyle = "connection-point absolute w-3 h-3 rounded-full bg-white border-2 cursor-crosshair";
        const styleMap: Record<string, React.CSSProperties> = {
          top: {
            top: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            borderColor: card.accent
          },
          right: {
            right: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            borderColor: card.accent
          },
          bottom: {
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            borderColor: card.accent
          },
          left: {
            left: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            borderColor: card.accent
          },
        };

        return (
          <div
            key={side}
            className={baseStyle}
            style={styleMap[side]}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            
              const rect = e.currentTarget.getBoundingClientRect();
              const canvasRect = (
                e.currentTarget.closest('[data-diagram-canvas]') as HTMLElement
              )?.getBoundingClientRect();
            
              if (!canvasRect) return;
            
              const mouseX = rect.left + rect.width / 2 - canvasRect.left;
              const mouseY = rect.top + rect.height / 2 - canvasRect.top;
            
              // CONVERSÃO CORRETA PARA WORLD SPACE
              const worldX = (mouseX - offset.x) / scale;
              const worldY = (mouseY - offset.y) / scale;
            
              onConnectionStart({ x: worldX, y: worldY });
            }}
          />
        );
      })}
    </div>
  );
};

export default Card;