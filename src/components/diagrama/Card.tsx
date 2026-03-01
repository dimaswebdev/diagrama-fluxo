'use client'

import React, { useState, useRef } from 'react';
import { Card as CardType, Point } from '@/types/diagrama';

interface CardProps {
  card: CardType;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<CardType>) => void;
  onConnectionStart: (point: Point) => void;
  onConnectionEnd: (targetCardId: string) => void;
}

const Card: React.FC<CardProps> = ({
  card,
  isSelected,
  onClick,
  onDragStart,
  onUpdate,
  onConnectionStart,
  onConnectionEnd
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const accent = card.accent;

  const handleConnectionPointMouseDown = (
    e: React.MouseEvent,
    point: Point
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const worldPoint: Point = {
      x: card.x + point.x,
      y: card.y + point.y
    };

    onConnectionStart(worldPoint);
  };

  const handleConnectionPointMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onConnectionEnd(card.id);
  };

  const connectionPoints = [
    { id: 'top', x: card.width / 2, y: 0 },
    { id: 'right', x: card.width, y: card.height / 2 },
    { id: 'bottom', x: card.width / 2, y: card.height },
    { id: 'left', x: 0, y: card.height / 2 }
  ];

  return (
    <div
      ref={cardRef}
      className="absolute transition-all duration-200 cursor-move group"
      onClick={onClick}
      onMouseDown={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        zIndex: isSelected ? 20 : 10
      }}
    >
      {/* Glow Premium */}
      <div
        className="pointer-events-none absolute -inset-2 rounded-2xl blur-2xl opacity-60"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${accent}40, transparent 60%)`
        }}
      />

      {/* Container */}
      <div
        className={`relative w-full h-full bg-white/95 backdrop-blur-xl border rounded-2xl shadow-[0_12px_30px_rgba(2,6,23,0.08)] p-4 flex flex-col gap-3
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-white' : ''}`}
        style={{ borderColor: accent }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="h-8 w-8 flex items-center justify-center rounded-xl text-white text-xs font-bold"
            style={{ backgroundColor: accent }}
          >
            {card.label}
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {card.title}
            </h3>
            <p className="text-xs text-gray-500">
              {card.date}
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="text-sm text-gray-700 flex-grow overflow-hidden">
          {card.content}
        </div>

        {/* Fonte */}
        {card.source && (
          <div className="text-xs text-gray-500">
            Fonte: {card.source}
          </div>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pontos de Conexão Premium */}
      {(isHovered || isSelected) &&
        connectionPoints.map(point => (
          <div
            key={point.id}
            className="absolute w-4 h-4 rounded-full cursor-crosshair transition-all z-30"
            style={{
              left: point.x - 8,
              top: point.y - 8,
              backgroundColor: accent,
              border: '2px solid white',
              boxShadow: `0 4px 12px ${accent}50`
            }}
            onMouseDown={(e) => handleConnectionPointMouseDown(e, point)}
            onMouseUp={handleConnectionPointMouseUp}
          />
        ))}
    </div>
  );
};

export default Card;