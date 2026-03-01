'use client';

import React from 'react';
import type { Card as CardType, Connection, ConnectionType } from '@/types/diagrama';

type Side = 'top' | 'right' | 'bottom' | 'left';

interface ConnectionLineProps {
  fromCard: CardType;
  toCard: CardType;
  connection: Connection;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void;

  // opcional: pra ajustar espessura quando estiver dando zoom
  zoom?: number;
}

function getPoint(card: CardType, side: Side) {
  switch (side) {
    case 'top':
      return { x: card.x + card.width / 2, y: card.y };
    case 'bottom':
      return { x: card.x + card.width / 2, y: card.y + card.height };
    case 'left':
      return { x: card.x, y: card.y + card.height / 2 };
    case 'right':
    default:
      return { x: card.x + card.width, y: card.y + card.height / 2 };
  }
}

function dashArray(type?: ConnectionType) {
  switch (type) {
    case 'dashed':
      return '6,4';
    case 'dotted':
      return '2,4';
    default:
      return undefined;
  }
}

export default function ConnectionLine({
  fromCard,
  toCard,
  connection,
  isSelected,
  onClick,
  zoom = 1,
}: ConnectionLineProps) {
  // 🔥 fallback: se não vier lado salvo, assume right->left
  const fromSide: Side = (connection.fromSide as Side) ?? 'right';
  const toSide: Side = (connection.toSide as Side) ?? 'left';

  // ✅ recalcula SEMPRE a partir do estado atual dos cards
  const startPoint = getPoint(fromCard, fromSide);
  const endPoint = getPoint(toCard, toSide);

  // proteção extra
  if (!startPoint || !endPoint) return null;

  const midX = (startPoint.x + endPoint.x) / 2;

  // curva bezier simples e estável
  const controlPoint1 = { x: midX, y: startPoint.y };
  const controlPoint2 = { x: midX, y: endPoint.y };

  const path = `M ${startPoint.x} ${startPoint.y}
                C ${controlPoint1.x} ${controlPoint1.y},
                  ${controlPoint2.x} ${controlPoint2.y},
                  ${endPoint.x} ${endPoint.y}`;

  // cor da linha (selecionada ganha destaque)
  const strokeColor = connection.color || (isSelected ? '#2563eb' : '#94a3b8');

  // espessuras “world-friendly” no zoom (hit area e stroke)
  const strokeWidth = (isSelected ? 3 : 2) / zoom;
  const hitWidth = 14 / zoom;

  return (
    <g
      className="connection-line"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()} // não deixa o canvas iniciar selection box
      style={{ cursor: 'pointer', pointerEvents: 'all', color: strokeColor }} // <-- "color" alimenta currentColor do marker
    >
      {/* Hit area (clicável) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        strokeLinecap="round"
        pointerEvents="stroke"
      />

      {/* Linha visível */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashArray(connection.type)}
        markerEnd="url(#arrow-head)"
        pointerEvents="none"
      />

      {/* Label opcional */}
      {connection.label && (
        <text
          x={(startPoint.x + endPoint.x) / 2}
          y={(startPoint.y + endPoint.y) / 2 - 8 / zoom}
          textAnchor="middle"
          className="select-none"
          style={{ fontSize: 12 / zoom, fill: '#4b5563' }}
          pointerEvents="none"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
}