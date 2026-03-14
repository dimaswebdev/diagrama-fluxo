'use client';

import React, { useState } from 'react';
import type { Card as CardType, Connection, ConnectionType } from '@/types/diagrama';
import { getConnectionGeometry } from './connectionRouting';

const LABEL_FONT_STACK = "Inter, 'Segoe UI', Arial, sans-serif";

interface ConnectionLineProps {
  fromCard: CardType;
  toCard: CardType;
  connection: Connection;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void;
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

function ConnectionLine({
  fromCard,
  toCard,
  connection,
  isSelected,
  onClick,
  onDoubleClick,
  zoom = 1,
}: ConnectionLineProps) {
  const [isHovered, setIsHovered] = useState(false);
  const geometry = getConnectionGeometry(fromCard, toCard, {
    fromSide: connection.fromSide,
    toSide: connection.toSide,
  }, connection.routeStyle ?? 'bezier');

  const isInteractive = isSelected || isHovered;
  const strokeColor = connection.color || (isSelected ? '#0891b2' : '#94a3b8');
  const strokeWidth = (isSelected ? 3.25 : isHovered ? 2.45 : 2) / zoom;
  const hitWidth = 18 / zoom;

  return (
    <g
      className="connection-line"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer', pointerEvents: 'all', color: strokeColor }}
    >
      {isInteractive && (
        <path
          d={geometry.path}
          fill="none"
          stroke={strokeColor}
          strokeOpacity={isSelected ? 0.18 : 0.1}
          strokeWidth={(isSelected ? 8 : 6) / zoom}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

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
              fill={isInteractive ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.72)'}
              stroke={strokeColor}
              strokeOpacity={isInteractive ? 0.7 : 0.55}
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

export default React.memo(ConnectionLine, (prev, next) => {
  return (
    prev.fromCard === next.fromCard &&
    prev.toCard === next.toCard &&
    prev.connection === next.connection &&
    prev.isSelected === next.isSelected &&
    prev.zoom === next.zoom
  );
});
