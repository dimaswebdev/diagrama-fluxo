'use client';

import type { Card, Point, ConnectionRouteStyle } from '@/types/diagrama';

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';

type SideVector = { x: number; y: number };

const SIDE_VECTORS: Record<ConnectionSide, SideVector> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const ALL_SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

export function getCardSidePoint(card: Card, side: ConnectionSide): Point {
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

const getCardCenter = (card: Card): Point => ({
  x: card.x + card.width / 2,
  y: card.y + card.height / 2,
});

const scoreSidePair = (
  fromCard: Card,
  toCard: Card,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
) => {
  const start = getCardSidePoint(fromCard, fromSide);
  const end = getCardSidePoint(toCard, toSide);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  const fromVector = SIDE_VECTORS[fromSide];
  const toVector = SIDE_VECTORS[toSide];

  const fromPenalty = Math.max(0, -(dx * fromVector.x + dy * fromVector.y)) * 1.35;
  const toPenalty = Math.max(0, dx * toVector.x + dy * toVector.y) * 1.35;
  const crossingPenalty = fromSide === toSide ? 24 : 0;

  return distance + fromPenalty + toPenalty + crossingPenalty;
};

export function resolveConnectionSides(
  fromCard: Card,
  toCard: Card,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>
): { fromSide: ConnectionSide; toSide: ConnectionSide } {
  const candidateFromSides = preferred?.fromSide ? [preferred.fromSide] : ALL_SIDES;
  const candidateToSides = preferred?.toSide ? [preferred.toSide] : ALL_SIDES;

  let best = {
    fromSide: candidateFromSides[0],
    toSide: candidateToSides[0],
    score: Number.POSITIVE_INFINITY,
  };

  for (const fromSide of candidateFromSides) {
    for (const toSide of candidateToSides) {
      const score = scoreSidePair(fromCard, toCard, fromSide, toSide);
      if (score < best.score) {
        best = { fromSide, toSide, score };
      }
    }
  }

  return {
    fromSide: best.fromSide,
    toSide: best.toSide,
  };
}

const getControlOffset = (start: Point, end: Point) => {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return Math.max(48, Math.min(140, Math.max(dx, dy) * 0.35));
};

const offsetPointBySide = (point: Point, side: ConnectionSide, amount: number): Point => {
  const vector = SIDE_VECTORS[side];
  return {
    x: point.x + vector.x * amount,
    y: point.y + vector.y * amount,
  };
};

const getLongestSegmentMidpoint = (points: Point[]) => {
  let bestMidpoint = {
    x: (points[0].x + points[points.length - 1].x) / 2,
    y: (points[0].y + points[points.length - 1].y) / 2,
  };
  let bestLength = -1;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);

    if (length > bestLength) {
      bestLength = length;
      bestMidpoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
    }
  }

  return bestMidpoint;
};

export function buildBezierPath(
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
) {
  const offset = getControlOffset(start, end);
  const controlPoint1 = offsetPointBySide(start, fromSide, offset);
  const controlPoint2 = offsetPointBySide(end, toSide, offset);

  return {
    path: `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`,
    controlPoint2,
    labelPoint: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
  };
}

export function buildOrthogonalPath(
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
) {
  const lead = Math.max(26, Math.min(52, Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) * 0.18));
  const startLead = offsetPointBySide(start, fromSide, lead);
  const endLead = offsetPointBySide(end, toSide, lead);
  const points: Point[] = [{ ...start }, startLead];

  const sameHorizontalAxis =
    (fromSide === 'right' && toSide === 'left') || (fromSide === 'left' && toSide === 'right');
  const sameVerticalAxis =
    (fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom');

  if (sameHorizontalAxis) {
    const canUseCenterLane =
      (fromSide === 'right' && startLead.x <= endLead.x) ||
      (fromSide === 'left' && startLead.x >= endLead.x);

    if (canUseCenterLane) {
      const middleX = (startLead.x + endLead.x) / 2;
      points.push({ x: middleX, y: startLead.y });
      points.push({ x: middleX, y: endLead.y });
    } else {
      const outerX =
        fromSide === 'right'
          ? Math.max(startLead.x, endLead.x) + lead
          : Math.min(startLead.x, endLead.x) - lead;
      points.push({ x: outerX, y: startLead.y });
      points.push({ x: outerX, y: endLead.y });
    }
  } else if (sameVerticalAxis) {
    const canUseCenterLane =
      (fromSide === 'bottom' && startLead.y <= endLead.y) ||
      (fromSide === 'top' && startLead.y >= endLead.y);

    if (canUseCenterLane) {
      const middleY = (startLead.y + endLead.y) / 2;
      points.push({ x: startLead.x, y: middleY });
      points.push({ x: endLead.x, y: middleY });
    } else {
      const outerY =
        fromSide === 'bottom'
          ? Math.max(startLead.y, endLead.y) + lead
          : Math.min(startLead.y, endLead.y) - lead;
      points.push({ x: startLead.x, y: outerY });
      points.push({ x: endLead.x, y: outerY });
    }
  } else if (fromSide === 'left' || fromSide === 'right') {
    points.push({ x: endLead.x, y: startLead.y });
  } else {
    points.push({ x: startLead.x, y: endLead.y });
  }

  points.push(endLead);
  points.push({ ...end });

  const radiusBase = Math.min(
    18,
    Math.abs(end.x - start.x) / 4 || 18,
    Math.abs(end.y - start.y) / 4 || 18
  );
  const radius = Math.max(8, radiusBase);

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    const inDx = current.x - previous.x;
    const inDy = current.y - previous.y;
    const outDx = next.x - current.x;
    const outDy = next.y - current.y;

    const inLength = Math.hypot(inDx, inDy);
    const outLength = Math.hypot(outDx, outDy);
    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);

    const entry = {
      x: current.x - (inDx / (inLength || 1)) * cornerRadius,
      y: current.y - (inDy / (inLength || 1)) * cornerRadius,
    };
    const exit = {
      x: current.x + (outDx / (outLength || 1)) * cornerRadius,
      y: current.y + (outDy / (outLength || 1)) * cornerRadius,
    };

    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  path += ` L ${end.x} ${end.y}`;

  return {
    path,
    labelPoint: getLongestSegmentMidpoint(points),
  };
}

export function getConnectionGeometry(
  fromCard: Card,
  toCard: Card,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>,
  routeStyle: ConnectionRouteStyle = 'bezier'
) {
  const { fromSide, toSide } = resolveConnectionSides(fromCard, toCard, preferred);
  const startPoint = getCardSidePoint(fromCard, fromSide);
  const endPoint = getCardSidePoint(toCard, toSide);
  const geometry =
    routeStyle === 'orthogonal'
      ? buildOrthogonalPath(startPoint, endPoint, fromSide, toSide)
      : buildBezierPath(startPoint, endPoint, fromSide, toSide);

  return {
    fromSide,
    toSide,
    startPoint,
    endPoint,
    ...geometry,
  };
}

export function resolvePreviewTargetSide(start: Point, end: Point): ConnectionSide {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'left' : 'right';
  }

  return dy >= 0 ? 'top' : 'bottom';
}

export function getPreviewConnectionGeometry(
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  routeStyle: ConnectionRouteStyle = 'bezier'
) {
  const toSide = resolvePreviewTargetSide(start, end);
  return {
    fromSide,
    toSide,
    startPoint: start,
    endPoint: end,
    ...(routeStyle === 'orthogonal'
      ? buildOrthogonalPath(start, end, fromSide, toSide)
      : buildBezierPath(start, end, fromSide, toSide)),
  };
}

export function getClosestSideForPoint(card: Card, point: Point): ConnectionSide {
  const center = getCardCenter(card);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
}
