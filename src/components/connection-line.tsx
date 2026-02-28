'use client';

import type {
  EvidenceCardData,
  InteractionMode,
  ConnectionData,
  EdgeType
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConnectionLineProps {
  fromCard?: EvidenceCardData;
  toCard?: EvidenceCardData;
  zoom: number;
  mode: InteractionMode;
  connection: ConnectionData;
  dispatch: React.Dispatch<any>;
  edgeType: EdgeType;
}

export function ConnectionLine({
  fromCard,
  toCard,
  zoom,
  mode,
  connection,
  dispatch,
  edgeType
}: ConnectionLineProps) {

  if (!fromCard || !toCard) return null;

  // ==========================================================
  // 🧠 INTELIGÊNCIA DIRECIONAL
  // ==========================================================
  function getBestPortPosition(
    fromCard: EvidenceCardData,
    toCard: EvidenceCardData
  ) {
    const fromCenterX = fromCard.position.x + fromCard.width / 2;
    const fromCenterY = fromCard.position.y + fromCard.height / 2;

    const toCenterX = toCard.position.x + toCard.width / 2;
    const toCenterY = toCard.position.y + toCard.height / 2;

    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
      if (dx > 0) {
        return {
          from: { x: fromCard.position.x + fromCard.width, y: fromCenterY },
          to: { x: toCard.position.x, y: toCenterY }
        };
      } else {
        return {
          from: { x: fromCard.position.x, y: fromCenterY },
          to: { x: toCard.position.x + toCard.width, y: toCenterY }
        };
      }
    }

    if (dy > 0) {
      return {
        from: { x: fromCenterX, y: fromCard.position.y + fromCard.height },
        to: { x: toCenterX, y: toCard.position.y }
      };
    } else {
      return {
        from: { x: fromCenterX, y: fromCard.position.y },
        to: { x: toCenterX, y: toCard.position.y + toCard.height }
      };
    }
  }

  const { from, to } = getBestPortPosition(fromCard, toCard);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // ==========================================================
  // 🔥 PATH STRATEGY AVANÇADA
  // ==========================================================
  function getPath(type: EdgeType) {

    const dynamicRadius = Math.min(30, Math.max(8, Math.min(absDx, absDy) / 3));
    const offset = Math.max(40, Math.min(absDx, absDy));

    switch (type) {

      // ------------------------------------------------------
      case "straight":
        return `M ${from.x},${from.y} L ${to.x},${to.y}`;

      // ------------------------------------------------------
      case "orthogonal": {
        if (absDx > absDy) {
          const midX = from.x + dx / 2;
          return `
            M ${from.x},${from.y}
            L ${midX},${from.y}
            L ${midX},${to.y}
            L ${to.x},${to.y}
          `;
        } else {
          const midY = from.y + dy / 2;
          return `
            M ${from.x},${from.y}
            L ${from.x},${midY}
            L ${to.x},${midY}
            L ${to.x},${to.y}
          `;
        }
      }

      // ------------------------------------------------------
      case "rounded-orthogonal": {
        const isHorizontal = absDx > absDy;
      
        if (isHorizontal) {
          const midX = from.x + dx / 2;
      
          // comprimento dos segmentos
          const seg1 = Math.abs(midX - from.x);
          const seg2 = Math.abs(to.y - from.y);
      
          // limitar raio para nunca ultrapassar segmento
          const r = Math.min(20, seg1 / 2, seg2 / 2);
      
          // direção vertical determina sweep
          const sweep = dy > 0 ? 1 : 0;
      
          const yDir = dy > 0 ? 1 : -1;
      
          return `
            M ${from.x},${from.y}
            L ${midX - r},${from.y}
            A ${r},${r} 0 0 ${sweep} ${midX},${from.y + r * yDir}
            L ${midX},${to.y - r * yDir}
            A ${r},${r} 0 0 ${sweep} ${midX + r},${to.y}
            L ${to.x},${to.y}
          `;
        } else {
          const midY = from.y + dy / 2;
      
          const seg1 = Math.abs(midY - from.y);
          const seg2 = Math.abs(to.x - from.x);
      
          const r = Math.min(20, seg1 / 2, seg2 / 2);
      
          const sweep = dx > 0 ? 1 : 0;
      
          const xDir = dx > 0 ? 1 : -1;
      
          return `
            M ${from.x},${from.y}
            L ${from.x},${midY - r}
            A ${r},${r} 0 0 ${sweep} ${from.x + r * xDir},${midY}
            L ${to.x - r * xDir},${midY}
            A ${r},${r} 0 0 ${sweep} ${to.x},${midY + r}
            L ${to.x},${to.y}
          `;
        }
      }

      // ------------------------------------------------------
      case "bezier": {
        const curveIntensity = 0.5;

        if (absDx > absDy) {
          const controlOffset = absDx * curveIntensity;
          return `
            M ${from.x},${from.y}
            C ${from.x + controlOffset},${from.y}
              ${to.x - controlOffset},${to.y}
              ${to.x},${to.y}
          `;
        } else {
          const controlOffset = absDy * curveIntensity;
          return `
            M ${from.x},${from.y}
            C ${from.x},${from.y + controlOffset}
              ${to.x},${to.y - controlOffset}
              ${to.x},${to.y}
          `;
        }
      }

      // ------------------------------------------------------
      case "manhattan": {
        if (absDx > absDy) {
          return `
            M ${from.x},${from.y}
            L ${from.x + offset},${from.y}
            L ${from.x + offset},${to.y}
            L ${to.x},${to.y}
          `;
        } else {
          return `
            M ${from.x},${from.y}
            L ${from.x},${from.y + offset}
            L ${to.x},${from.y + offset}
            L ${to.x},${to.y}
          `;
        }
      }
    }
  }

  const pathData = getPath(edgeType) || '';

  // ==========================================================
  // SVG BOUNDING BOX
  // ==========================================================
  const padding = 80;

  const svgLeft = Math.min(from.x, to.x) - padding;
  const svgTop = Math.min(from.y, to.y) - padding;
  const svgWidth = Math.abs(from.x - to.x) + padding * 2;
  const svgHeight = Math.abs(from.y - to.y) + padding * 2;

  const handleLineClick = () => {
    if (mode === 'connect') {
      dispatch({ type: 'DELETE_CONNECTION', payload: connection.id });
    }
  };

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: svgLeft,
        top: svgTop,
        width: svgWidth,
        height: svgHeight,
      }}
      viewBox={`${svgLeft} ${svgTop} ${svgWidth} ${svgHeight}`}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
        </marker>
      </defs>

      {/* Hit area */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth={20 / zoom}
        fill="none"
        className={cn(
          mode === 'connect'
            ? 'cursor-pointer pointer-events-auto'
            : 'pointer-events-none'
        )}
        onClick={handleLineClick}
      />

      {/* Visible line */}
      <path
        d={pathData}
        stroke="hsl(var(--primary))"
        strokeWidth={2 / zoom}
        fill="none"
        markerEnd="url(#arrow)"
        strokeDasharray={mode === 'connect' ? '4 4' : 'none'}
        className="pointer-events-none"
      />
    </svg>
  );
}