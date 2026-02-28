import type { EvidenceCardData } from '@/lib/types';

interface ConnectionLineProps {
  fromCard?: EvidenceCardData;
  toCard?: EvidenceCardData;
  zoom: number;
}

export function ConnectionLine({ fromCard, toCard, zoom }: ConnectionLineProps) {
  if (!fromCard || !toCard) {
    return null;
  }

  const from = {
    x: fromCard.position.x + fromCard.width / 2,
    y: fromCard.position.y + fromCard.height / 2,
  };
  const to = {
    x: toCard.position.x + toCard.width / 2,
    y: toCard.position.y + toCard.height / 2,
  };

  const midX = from.x + (to.x - from.x) / 2;
  
  const pathData = `M ${from.x},${from.y} L ${midX},${from.y} L ${midX},${to.y} L ${to.x},${to.y}`;

  const svgLeft = Math.min(from.x, to.x) - 20;
  const svgTop = Math.min(from.y, to.y) - 20;
  const svgWidth = Math.abs(from.x - to.x) + 40;
  const svgHeight = Math.abs(from.y - to.y) + 40;

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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--ring))" />
        </marker>
      </defs>
      <path
        d={pathData}
        stroke="hsl(var(--ring))"
        strokeWidth={2 / zoom}
        fill="none"
        markerEnd="url(#arrow)"
      />
    </svg>
  );
}
