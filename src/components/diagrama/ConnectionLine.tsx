'use client'

import React from 'react';

interface ConnectionLineProps {
  fromCard: { x: number; y: number; width: number; height: number };
  toCard: { x: number; y: number; width: number; height: number };
  connection: {
    type?: 'normal' | 'dashed' | 'dotted';
    color?: string;
    label?: string;
  };
  isSelected?: boolean;
  onClick?: () => void;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ 
  fromCard, 
  toCard, 
  connection,
  isSelected,
  onClick 
}) => {
  const getConnectionPoints = () => {
    const fromCenter = {
      x: fromCard.x + fromCard.width / 2,
      y: fromCard.y + fromCard.height / 2
    };
    
    const toCenter = {
      x: toCard.x + toCard.width / 2,
      y: toCard.y + toCard.height / 2
    };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    let startPoint = { x: fromCenter.x, y: fromCenter.y };
    let endPoint = { x: toCenter.x, y: toCenter.y };

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        startPoint.x = fromCard.x + fromCard.width;
        endPoint.x = toCard.x;
      } else {
        startPoint.x = fromCard.x;
        endPoint.x = toCard.x + toCard.width;
      }
      startPoint.y = fromCenter.y;
      endPoint.y = toCenter.y;
    } else {
      if (dy > 0) {
        startPoint.y = fromCard.y + fromCard.height;
        endPoint.y = toCard.y;
      } else {
        startPoint.y = fromCard.y;
        endPoint.y = toCard.y + toCard.height;
      }
      startPoint.x = fromCenter.x;
      endPoint.x = toCenter.x;
    }

    return { startPoint, endPoint };
  };

  const getDashArray = () => {
    switch (connection.type) {
      case 'dashed': return '5,5';
      case 'dotted': return '2,2';
      default: return 'none';
    }
  };

  const { startPoint, endPoint } = getConnectionPoints();
  
  const midX = (startPoint.x + endPoint.x) / 2;
  
  const controlPoint1 = { x: midX, y: startPoint.y };
  const controlPoint2 = { x: midX, y: endPoint.y };

  const path = `M ${startPoint.x} ${startPoint.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${endPoint.x} ${endPoint.y}`;

  const getArrowRotation = () => {
    const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x) * 180 / Math.PI;
    return angle;
  };

  return (
    <g 
      className="connection-line"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke={connection.color || (isSelected ? '#2563eb' : '#94a3b8')}
        strokeWidth={isSelected ? '3' : '2'}
        strokeLinecap="round"
        strokeDasharray={getDashArray()}
      />
      <polygon
        points={`${endPoint.x},${endPoint.y} ${endPoint.x - 8},${endPoint.y - 4} ${endPoint.x - 8},${endPoint.y + 4}`}
        fill={connection.color || (isSelected ? '#2563eb' : '#94a3b8')}
        transform={`rotate(${getArrowRotation()}, ${endPoint.x}, ${endPoint.y})`}
      />
      {connection.label && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          className="text-xs fill-gray-600"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

export default ConnectionLine;
