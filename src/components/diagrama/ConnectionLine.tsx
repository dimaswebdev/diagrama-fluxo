'use client';

import React, { useState } from 'react';
import type {
  Card as CardType,
  Connection,
  ConnectionStrokeWidth,
  ConnectionType,
  ConnectionVariant,
} from '@/types/diagrama';
import { getConnectionGeometry } from './connectionRouting';
import {
  buildBezierEmphasisArrowHead,
  buildBezierEmphasisStrokeShape,
  buildEmphasisArrowHead,
  buildOrthogonalEmphasisStrokeShape,
} from './connectionEmphasisShape';

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

function getBaseStrokeWidth(strokeWidth?: ConnectionStrokeWidth, variant: ConnectionVariant = 'default') {
  if (variant === 'emphasis') {
    const emphasisMap: Record<ConnectionStrokeWidth, number> = {
      thin: 5.5,
      medium: 9.75,
      thick: 15,
    };
    return emphasisMap[strokeWidth ?? 'medium'];
  }

  const widthMap: Record<ConnectionStrokeWidth, number> = {
    thin: 1.5,
    medium: 2,
    thick: 3.25,
  };
  return widthMap[strokeWidth ?? 'medium'];
}

function getArrowMarkerId(variant: ConnectionVariant = 'default') {
  return variant === 'emphasis' ? 'url(#arrow-head-emphasis)' : 'url(#arrow-head)';
}

function getArrowPolygonPoints(
  end: { x: number; y: number },
  prev: { x: number; y: number },
  length: number,
  halfWidth: number
) {
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const px = -uy;
  const py = ux;
  const baseCenter = {
    x: end.x - ux * length,
    y: end.y - uy * length,
  };
  const p1 = {
    x: baseCenter.x + px * halfWidth,
    y: baseCenter.y + py * halfWidth,
  };
  const p2 = {
    x: baseCenter.x - px * halfWidth,
    y: baseCenter.y - py * halfWidth,
  };
  return `${end.x},${end.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
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
  const variant = connection.variant ?? 'default';
  const strokeColor = connection.color || (isSelected ? '#0891b2' : '#94a3b8');
  const baseStrokeWidth = getBaseStrokeWidth(connection.strokeWidth, variant);
  const strokeWidth = (baseStrokeWidth + (isSelected ? 1.2 : isHovered ? 0.45 : 0)) / zoom;
  const hitWidth = Math.max(18, baseStrokeWidth * (variant === 'emphasis' ? 4.5 : 5)) / zoom;
  const defaultArrowLength = 10 / zoom;
  const defaultArrowHalfWidth = 4.5 / zoom;
  const arrowPolygon =
    variant === 'emphasis'
      ? (
          connection.routeStyle === 'bezier'
            ? buildBezierEmphasisArrowHead(geometry.endPoint, geometry.arrowReferencePoint, strokeWidth)
            : buildEmphasisArrowHead(geometry.endPoint, geometry.arrowReferencePoint, strokeWidth)
        ).points
      : getArrowPolygonPoints(
          geometry.endPoint,
          geometry.arrowReferencePoint,
          defaultArrowLength,
          defaultArrowHalfWidth
        );
  const emphasisStrokeShape =
    variant === 'emphasis' &&
    connection.routeStyle === 'orthogonal' &&
    'points' in geometry
      ? buildOrthogonalEmphasisStrokeShape(geometry.points, strokeWidth)
      : variant === 'emphasis' &&
        connection.routeStyle === 'bezier' &&
        'controlPoint1' in geometry &&
        'controlPoint2' in geometry
      ? buildBezierEmphasisStrokeShape(
          geometry.startPoint,
          geometry.controlPoint1,
          geometry.controlPoint2,
          geometry.endPoint,
          strokeWidth
        )
      : null;

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
          strokeWidth={(Math.max(6, baseStrokeWidth * (variant === 'emphasis' ? 1.8 : 2.8)) + (isSelected ? 2 : 0)) / zoom}
          strokeLinecap="round"
          strokeLinejoin="round"
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

      {emphasisStrokeShape ? (
        <>
          <path
            d={emphasisStrokeShape.bodyPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          <polygon
            points={emphasisStrokeShape.arrowPolygon}
            fill={strokeColor}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          <path
            d={geometry.path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashArray(connection.type)}
            markerEnd={variant === 'emphasis' ? undefined : getArrowMarkerId(variant)}
            pointerEvents="none"
          />

          {variant === 'emphasis' && (
            <polygon
              points={arrowPolygon}
              fill={strokeColor}
              pointerEvents="none"
            />
          )}
        </>
      )}

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
