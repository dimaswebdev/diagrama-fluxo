'use client'

import React from 'react';

interface ConnectionLineProps {
  fromCard: { x: number; y: number; width: number; height: number };
  toCard: { x: number; y: number; width: number; height: number };
  connection: {
    type?: 'normal' | 'dashed' | 'dotted';
    color?: string;
    label?: string;
    fromPoint?: { x: number; y: number };
    toPoint?: { x: number; y: number };
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

  // 🔥 Fallback seguro para conexões antigas
  const startPoint = connection.fromPoint ?? {
    x: fromCard.x + fromCard.width / 2,
    y: fromCard.y + fromCard.height / 2
  };

  const endPoint = connection.toPoint ?? {
    x: toCard.x + toCard.width / 2,
    y: toCard.y + toCard.height / 2
  };

  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;

  // Curva Bézier suave
  const controlPoint1 = { x: midX, y: startPoint.y };
  const controlPoint2 = { x: midX, y: endPoint.y };

  const path = `
    M ${startPoint.x} ${startPoint.y}
    C ${controlPoint1.x} ${controlPoint1.y},
      ${controlPoint2.x} ${controlPoint2.y},
      ${endPoint.x} ${endPoint.y}
  `;

  // Cálculo do ângulo da seta
  const dx = 3 * (endPoint.x - controlPoint2.x);
  const dy = 3 * (endPoint.y - controlPoint2.y);
  const arrowAngle = Math.atan2(dy, dx) * 180 / Math.PI;

  const getDashArray = () => {
    switch (connection.type) {
      case 'dashed': return '6,4';
      case 'dotted': return '2,4';
      default: return undefined;
    }
  };

  const strokeColor =
    connection.color ||
    (isSelected ? '#2563eb' : '#94a3b8');

  return (
    <g
      className="connection-line"
      onClick={onClick}
      style={{ cursor: 'pointer', pointerEvents: 'all' }}
    >
      {/* Área clicável invisível */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Linha principal */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={getDashArray()}
      />

      {/* Seta */}
      <polygon
        points={`
          ${endPoint.x},${endPoint.y}
          ${endPoint.x - 10},${endPoint.y - 5}
          ${endPoint.x - 10},${endPoint.y + 5}
        `}
        fill={strokeColor}
        transform={`rotate(${arrowAngle}, ${endPoint.x}, ${endPoint.y})`}
      />

      {/* Label opcional */}
      {connection.label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          className="text-xs fill-gray-600 select-none"
          pointerEvents="none"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

export default ConnectionLine;