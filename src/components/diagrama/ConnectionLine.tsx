'use client';

import React from 'react';
import type { Card as CardType, Connection, ConnectionType } from '@/types/diagrama';
import { getConnectionGeometry } from './connectionRouting';

const LABEL_FONT_STACK = "Inter, 'Segoe UI', Arial, sans-serif";

interface ConnectionLineProps {
  fromCard: CardType;
  toCard: CardType;
  connection: Connection;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void;
  zoom?: number;
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

function getLabelMetrics(label: string, zoom: number) {
  const width = Math.max(62 / zoom, (label.length * 7 + 22) / zoom);
  const height = 24 / zoom;
  return { width, height };
}

export default function ConnectionLine({
  fromCard,
  toCard,
  connection,
  isSelected,
  onClick,
  zoom = 1,
}: ConnectionLineProps) {
  const geometry = getConnectionGeometry(fromCard, toCard, {
    fromSide: connection.fromSide,
    toSide: connection.toSide,
  }, connection.routeStyle ?? 'bezier');

  const strokeColor = connection.color || (isSelected ? '#0891b2' : '#94a3b8');
  const strokeWidth = (isSelected ? 3.2 : 2) / zoom;
  const hitWidth = 14 / zoom;

  return (
    <g
      className="connection-line"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ cursor: 'pointer', pointerEvents: 'all', color: strokeColor }}
    >
      <path
        d={geometry.path}
        fill="none"
        stroke="transparent"
        strokeWidth={hitWidth}
        strokeLinecap="round"
        pointerEvents="stroke"
      />

      <path
        d={geometry.path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashArray(connection.type)}
        markerEnd="url(#arrow-head)"
        pointerEvents="none"
      />

      {connection.label && (() => {
        const label = connection.label.trim();
        if (!label) return null;
        const metrics = getLabelMetrics(label, zoom);
        const x = geometry.labelPoint.x - metrics.width / 2;
        const y = geometry.labelPoint.y - metrics.height / 2;

        return (
          <g pointerEvents="none">
            <rect
              x={x}
              y={y}
              width={metrics.width}
              height={metrics.height}
              rx={12 / zoom}
              fill="rgba(255,255,255,0.72)"
              stroke={strokeColor}
              strokeOpacity={0.55}
              strokeWidth={1.2 / zoom}
            />
            <text
              x={geometry.labelPoint.x}
              y={geometry.labelPoint.y + 3.5 / zoom}
              textAnchor="middle"
              className="select-none"
              style={{
                fontFamily: LABEL_FONT_STACK,
                fontSize: 11 / zoom,
                fontWeight: 600,
                fill: strokeColor,
              }}
            >
              {label}
            </text>
          </g>
        );
      })()}
    </g>
  );
}
