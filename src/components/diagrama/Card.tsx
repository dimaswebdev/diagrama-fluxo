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
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(card.content);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getCardStyles = () => {
    const baseStyles = "absolute bg-white border rounded shadow-sm hover:shadow-md transition-all";
    const selectedStyles = isSelected ? "ring-2 ring-blue-500 ring-offset-2" : "border-gray-200";
    
    const typeStyles = {
      default: "bg-white",
      input: "bg-blue-50 border-l-4 border-l-blue-500",
      output: "bg-purple-50 border-l-4 border-l-purple-500",
      process: "bg-orange-50 border-l-4 border-l-orange-500",
      decision: "bg-yellow-50 border-l-4 border-l-yellow-500"
    };

    return `${baseStyles} ${selectedStyles} ${typeStyles[card.type || 'default']}`;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate({ content });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

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
      className={getCardStyles()}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        zIndex: isSelected ? 20 : 10,
        cursor: 'move'
      }}
    >
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-full p-2 border-none resize-none outline-none bg-transparent"
        />
      ) : (
        <>
          <div className="p-2 h-full overflow-hidden">
            {content}
          </div>
          {card.type && card.type !== 'default' && (
            <div className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 bg-black/10 rounded">
              {card.type}
            </div>
          )}
        </>
      )}

      {/* Pontos de conexão - SEMPRE VISÍVEIS quando hover ou selecionado */}
      {(isHovered || isSelected) && connectionPoints.map(point => (
        <div
          key={point.id}
          className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-crosshair hover:bg-blue-600 transition-all z-30"
          style={{ 
            left: point.x - 8, 
            top: point.y - 8,
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          onMouseDown={(e) => handleConnectionPointMouseDown(e, point)}
          onMouseUp={handleConnectionPointMouseUp}
          title={`Conectar ${point.id}`}
        />
      ))}
    </div>
  );
};

export default Card;