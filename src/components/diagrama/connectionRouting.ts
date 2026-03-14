'use client';

import type { Card, Point, ConnectionRouteStyle, SelectionBox } from '@/types/diagrama';

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';

type SideVector = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const SIDE_VECTORS: Record<ConnectionSide, SideVector> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const ALL_SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];
const OVERLAP_PADDING = 12;

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

const getExpandedRect = (card: Card, padding = OVERLAP_PADDING): Rect => ({
  left: card.x - padding,
  top: card.y - padding,
  right: card.x + card.width + padding,
  bottom: card.y + card.height + padding,
});

const isPointInsideRect = (point: Point, rect: Rect) =>
  point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;

const segmentIntersectsRect = (start: Point, end: Point, rect: Rect) => {
  if (start.x === end.x) {
    const x = start.x;
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return x > rect.left && x < rect.right && maxY > rect.top && minY < rect.bottom;
  }

  if (start.y === end.y) {
    const y = start.y;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    return y > rect.top && y < rect.bottom && maxX > rect.left && minX < rect.right;
  }

  return false;
};

const pointInSelectionBox = (point: Point, box: SelectionBox) =>
  point.x >= box.x &&
  point.x <= box.x + box.width &&
  point.y >= box.y &&
  point.y <= box.y + box.height;

const lineSegmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, r.x) <= q.x &&
    q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y &&
    q.y <= Math.max(p.y, r.y);

  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(a1, b1, a2)) return true;
  if (d2 === 0 && onSegment(a1, b2, a2)) return true;
  if (d3 === 0 && onSegment(b1, a1, b2)) return true;
  if (d4 === 0 && onSegment(b1, a2, b2)) return true;

  return false;
};

const segmentIntersectsSelectionBox = (start: Point, end: Point, box: SelectionBox) => {
  if (pointInSelectionBox(start, box) || pointInSelectionBox(end, box)) {
    return true;
  }

  const topLeft = { x: box.x, y: box.y };
  const topRight = { x: box.x + box.width, y: box.y };
  const bottomLeft = { x: box.x, y: box.y + box.height };
  const bottomRight = { x: box.x + box.width, y: box.y + box.height };

  return (
    lineSegmentsIntersect(start, end, topLeft, topRight) ||
    lineSegmentsIntersect(start, end, topRight, bottomRight) ||
    lineSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
    lineSegmentsIntersect(start, end, bottomLeft, topLeft)
  );
};

const getExpectedSide = (source: Card, target: Card): ConnectionSide => {
  const sourceCenter = getCardCenter(source);
  const targetCenter = getCardCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
};

const getOppositeSide = (side: ConnectionSide): ConnectionSide => {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
    default:
      return 'right';
  }
};

const getControlOffset = (start: Point, end: Point) => {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return Math.max(56, Math.min(164, Math.max(dx, dy) * 0.3));
};

const offsetPointBySide = (point: Point, side: ConnectionSide, amount: number): Point => {
  const vector = SIDE_VECTORS[side];
  return {
    x: point.x + vector.x * amount,
    y: point.y + vector.y * amount,
  };
};

const getCubicBezierPoint = (
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  t: number
): Point => {
  const inverse = 1 - t;
  const inverseSquared = inverse * inverse;
  const inverseCubed = inverseSquared * inverse;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return {
    x:
      inverseCubed * start.x +
      3 * inverseSquared * t * controlPoint1.x +
      3 * inverse * tSquared * controlPoint2.x +
      tCubed * end.x,
    y:
      inverseCubed * start.y +
      3 * inverseSquared * t * controlPoint1.y +
      3 * inverse * tSquared * controlPoint2.y +
      tCubed * end.y,
  };
};

const getCubicBezierMidpointByLength = (
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point
): Point => {
  const steps = 40;
  const sampledPoints = Array.from({ length: steps + 1 }, (_, index) =>
    getCubicBezierPoint(start, controlPoint1, controlPoint2, end, index / steps)
  );

  let totalLength = 0;
  const lengths: number[] = [0];

  for (let index = 1; index < sampledPoints.length; index += 1) {
    totalLength += Math.hypot(
      sampledPoints[index].x - sampledPoints[index - 1].x,
      sampledPoints[index].y - sampledPoints[index - 1].y
    );
    lengths.push(totalLength);
  }

  const targetLength = totalLength / 2;

  for (let index = 1; index < lengths.length; index += 1) {
    if (lengths[index] >= targetLength) {
      const previousLength = lengths[index - 1];
      const segmentLength = lengths[index] - previousLength || 1;
      const localRatio = (targetLength - previousLength) / segmentLength;
      const previousPoint = sampledPoints[index - 1];
      const currentPoint = sampledPoints[index];

      return {
        x: previousPoint.x + (currentPoint.x - previousPoint.x) * localRatio,
        y: previousPoint.y + (currentPoint.y - previousPoint.y) * localRatio,
      };
    }
  }

  return sampledPoints[Math.floor(sampledPoints.length / 2)];
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

const normalizePoints = (points: Point[]) => {
  const normalized: Point[] = [];

  for (const point of points) {
    const previous = normalized[normalized.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) {
      continue;
    }
    normalized.push(point);
  }

  return normalized;
};

const getSegmentOrientation = (start: Point, end: Point) => {
  if (start.x === end.x) {
    return 'vertical';
  }

  if (start.y === end.y) {
    return 'horizontal';
  }

  return 'diagonal';
};

const getSideAxisPosition = (card: Card, side: ConnectionSide) => {
  switch (side) {
    case 'top':
      return card.y;
    case 'bottom':
      return card.y + card.height;
    case 'left':
      return card.x;
    case 'right':
    default:
      return card.x + card.width;
  }
};

const scoreOrthogonalPoints = (points: Point[], fromRect: Rect, toRect: Rect) => {
  let length = 0;
  let overlapPenalty = 0;
  let bendPenalty = Math.max(0, points.length - 2) * 18;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    length += Math.hypot(end.x - start.x, end.y - start.y);

    if (segmentIntersectsRect(start, end, fromRect) || segmentIntersectsRect(start, end, toRect)) {
      overlapPenalty += 220;
    }
  }

  return length + bendPenalty + overlapPenalty;
};

type BezierGeometry = {
  path: string;
  labelPoint: Point;
  arrowReferencePoint: Point;
  controlPoint1: Point;
  controlPoint2: Point;
};

type OrthogonalGeometry = {
  path: string;
  labelPoint: Point;
  arrowReferencePoint: Point;
  points: Point[];
};

export function buildBezierPath(
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
): BezierGeometry {
  const offset = getControlOffset(start, end);
  const controlPoint1 = offsetPointBySide(start, fromSide, offset);
  const controlPoint2 = offsetPointBySide(end, toSide, offset);

  return {
    path: `M ${start.x} ${start.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${end.x} ${end.y}`,
    controlPoint1,
    controlPoint2,
    arrowReferencePoint: controlPoint2,
    labelPoint: getCubicBezierMidpointByLength(start, controlPoint1, controlPoint2, end),
  };
}

const getBezierSamplePoints = (
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide,
  steps = 24
) => {
  const offset = getControlOffset(start, end);
  const controlPoint1 = offsetPointBySide(start, fromSide, offset);
  const controlPoint2 = offsetPointBySide(end, toSide, offset);

  return Array.from({ length: steps + 1 }, (_, index) =>
    getCubicBezierPoint(start, controlPoint1, controlPoint2, end, index / steps)
  );
};

const getOrthogonalPoints = (
  fromCard: Card,
  toCard: Card,
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
) => {
  const lead = Math.max(30, Math.min(64, Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) * 0.2));
  const startLead = offsetPointBySide(start, fromSide, lead);
  const endLead = offsetPointBySide(end, toSide, lead);
  const fromRect = getExpandedRect(fromCard, lead * 0.65);
  const toRect = getExpandedRect(toCard, lead * 0.65);
  const candidates: Point[][] = [];
  const laneTop = Math.min(fromRect.top, toRect.top) - lead;
  const laneBottom = Math.max(fromRect.bottom, toRect.bottom) + lead;
  const laneLeft = Math.min(fromRect.left, toRect.left) - lead;
  const laneRight = Math.max(fromRect.right, toRect.right) + lead;
  const sourceOuterX = fromSide === 'left' ? laneLeft : fromSide === 'right' ? laneRight : startLead.x;
  const sourceOuterY = fromSide === 'top' ? laneTop : fromSide === 'bottom' ? laneBottom : startLead.y;
  const targetOuterX = toSide === 'left' ? laneLeft : toSide === 'right' ? laneRight : endLead.x;
  const targetOuterY = toSide === 'top' ? laneTop : toSide === 'bottom' ? laneBottom : endLead.y;

  const sameHorizontalAxis =
    (fromSide === 'right' && toSide === 'left') || (fromSide === 'left' && toSide === 'right');
  const sameVerticalAxis =
    (fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom');

  const pushCandidate = (...points: Point[]) => {
    candidates.push(normalizePoints(points));
  };

  if (sameHorizontalAxis) {
    if (
      (fromSide === 'right' && startLead.x <= endLead.x) ||
      (fromSide === 'left' && startLead.x >= endLead.x)
    ) {
      const middleX = (startLead.x + endLead.x) / 2;
      pushCandidate({ ...start }, startLead, { x: middleX, y: startLead.y }, { x: middleX, y: endLead.y }, endLead, { ...end });
    }

    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneTop }, { x: endLead.x, y: laneTop }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneBottom }, { x: endLead.x, y: laneBottom }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: laneTop }, { x: endLead.x, y: laneTop }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: laneBottom }, { x: endLead.x, y: laneBottom }, endLead, { ...end });
  } else if (sameVerticalAxis) {
    if (
      (fromSide === 'bottom' && startLead.y <= endLead.y) ||
      (fromSide === 'top' && startLead.y >= endLead.y)
    ) {
      const middleY = (startLead.y + endLead.y) / 2;
      pushCandidate({ ...start }, startLead, { x: startLead.x, y: middleY }, { x: endLead.x, y: middleY }, endLead, { ...end });
    }

    pushCandidate({ ...start }, startLead, { x: laneLeft, y: startLead.y }, { x: laneLeft, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneRight, y: startLead.y }, { x: laneRight, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneLeft, y: startLead.y }, { x: laneLeft, y: targetOuterY }, { x: endLead.x, y: targetOuterY }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneRight, y: startLead.y }, { x: laneRight, y: targetOuterY }, { x: endLead.x, y: targetOuterY }, endLead, { ...end });
  } else if (fromSide === 'left' || fromSide === 'right') {
    const elbow = { x: endLead.x, y: startLead.y };
    pushCandidate({ ...start }, startLead, elbow, endLead, { ...end });

    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneTop }, { x: endLead.x, y: laneTop }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneBottom }, { x: endLead.x, y: laneBottom }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneLeft, y: startLead.y }, { x: laneLeft, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneRight, y: startLead.y }, { x: laneRight, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: targetOuterY }, { x: endLead.x, y: targetOuterY }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: laneTop }, { x: endLead.x, y: laneTop }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: laneBottom }, { x: endLead.x, y: laneBottom }, endLead, { ...end });
  } else {
    const elbow = { x: startLead.x, y: endLead.y };
    pushCandidate({ ...start }, startLead, elbow, endLead, { ...end });

    pushCandidate({ ...start }, startLead, { x: laneLeft, y: startLead.y }, { x: laneLeft, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneRight, y: startLead.y }, { x: laneRight, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneTop }, { x: endLead.x, y: laneTop }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: startLead.x, y: laneBottom }, { x: endLead.x, y: laneBottom }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: sourceOuterX, y: startLead.y }, { x: sourceOuterX, y: endLead.y }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: startLead.x, y: sourceOuterY }, { x: targetOuterX, y: sourceOuterY }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneLeft, y: startLead.y }, { x: laneLeft, y: targetOuterY }, { x: endLead.x, y: targetOuterY }, endLead, { ...end });
    pushCandidate({ ...start }, startLead, { x: laneRight, y: startLead.y }, { x: laneRight, y: targetOuterY }, { x: endLead.x, y: targetOuterY }, endLead, { ...end });
  }

  const ranked = candidates
    .map((candidate) => ({
      points: candidate,
      score: scoreOrthogonalPoints(candidate, fromRect, toRect),
    }))
    .sort((left, right) => left.score - right.score);

  return ranked[0]?.points ?? normalizePoints([{ ...start }, startLead, endLead, { ...end }]);
};

export function buildOrthogonalPath(
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide,
  fromCard?: Card,
  toCard?: Card
): OrthogonalGeometry {
  const points =
    fromCard && toCard
      ? getOrthogonalPoints(fromCard, toCard, start, end, fromSide, toSide)
      : [{ ...start }, offsetPointBySide(start, fromSide, 40), offsetPointBySide(end, toSide, 40), { ...end }];

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
    points,
    arrowReferencePoint: points[points.length - 2] ?? start,
    labelPoint: getLongestSegmentMidpoint(points),
  };
}

const getBezierOverlapPenalty = (
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide,
  fromCard: Card,
  toCard: Card
) => {
  const route = buildBezierPath(start, end, fromSide, toSide);
  const fromRect = getExpandedRect(fromCard, 6);
  const toRect = getExpandedRect(toCard, 6);
  let penalty = 0;

  for (let step = 1; step < 23; step += 1) {
    const t = step / 24;
    const point = getCubicBezierPoint(
      start,
      route.controlPoint1,
      route.controlPoint2,
      end,
      t
    );

    if (isPointInsideRect(point, fromRect) || isPointInsideRect(point, toRect)) {
      penalty += 120;
    }
  }

  return penalty;
};

const getOrthogonalOverlapPenalty = (
  fromCard: Card,
  toCard: Card,
  start: Point,
  end: Point,
  fromSide: ConnectionSide,
  toSide: ConnectionSide
) => {
  const route = buildOrthogonalPath(start, end, fromSide, toSide, fromCard, toCard);
  const fromRect = getExpandedRect(fromCard, 8);
  const toRect = getExpandedRect(toCard, 8);
  let penalty = 0;
  const fromAxis = getSideAxisPosition(fromCard, fromSide);
  const toAxis = getSideAxisPosition(toCard, toSide);

  for (let index = 1; index < route.points.length; index += 1) {
    const segmentStart = route.points[index - 1];
    const segmentEnd = route.points[index];
    const orientation = getSegmentOrientation(segmentStart, segmentEnd);

    if (
      segmentIntersectsRect(segmentStart, segmentEnd, fromRect) ||
      segmentIntersectsRect(segmentStart, segmentEnd, toRect)
    ) {
      penalty += 180;
    }

    if (index >= 2 && orientation === 'horizontal') {
      if (
        (fromSide === 'top' || fromSide === 'bottom') &&
        Math.sign(segmentStart.y - fromAxis) !== 0 &&
        Math.sign(segmentStart.y - fromAxis) !== Math.sign(SIDE_VECTORS[fromSide].y)
      ) {
        penalty += 140;
      }

      if (
        (toSide === 'top' || toSide === 'bottom') &&
        Math.sign(segmentStart.y - toAxis) !== 0 &&
        Math.sign(segmentStart.y - toAxis) !== Math.sign(SIDE_VECTORS[toSide].y)
      ) {
        penalty += 140;
      }
    }

    if (index >= 2 && orientation === 'vertical') {
      if (
        (fromSide === 'left' || fromSide === 'right') &&
        Math.sign(segmentStart.x - fromAxis) !== 0 &&
        Math.sign(segmentStart.x - fromAxis) !== Math.sign(SIDE_VECTORS[fromSide].x)
      ) {
        penalty += 140;
      }

      if (
        (toSide === 'left' || toSide === 'right') &&
        Math.sign(segmentStart.x - toAxis) !== 0 &&
        Math.sign(segmentStart.x - toAxis) !== Math.sign(SIDE_VECTORS[toSide].x)
      ) {
        penalty += 140;
      }
    }
  }

  return penalty;
};

const scoreSidePair = (
  fromCard: Card,
  toCard: Card,
  fromSide: ConnectionSide,
  toSide: ConnectionSide,
  routeStyle: ConnectionRouteStyle,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>
) => {
  const start = getCardSidePoint(fromCard, fromSide);
  const end = getCardSidePoint(toCard, toSide);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  const fromVector = SIDE_VECTORS[fromSide];
  const toVector = SIDE_VECTORS[toSide];
  const expectedFromSide = getExpectedSide(fromCard, toCard);
  const expectedToSide = getOppositeSide(expectedFromSide);

  const fromPenalty = Math.max(0, -(dx * fromVector.x + dy * fromVector.y)) * 1.35;
  const toPenalty = Math.max(0, dx * toVector.x + dy * toVector.y) * 1.35;
  const expectedSidePenalty = (fromSide === expectedFromSide ? 0 : 40) + (toSide === expectedToSide ? 0 : 40);
  const sameSidePenalty = fromSide === toSide ? 18 : 0;
  const preferenceBonus =
    (preferred?.fromSide && preferred.fromSide === fromSide ? 18 : 0) +
    (preferred?.toSide && preferred.toSide === toSide ? 18 : 0);
  const overlapPenalty =
    routeStyle === 'orthogonal'
      ? getOrthogonalOverlapPenalty(fromCard, toCard, start, end, fromSide, toSide)
      : getBezierOverlapPenalty(start, end, fromSide, toSide, fromCard, toCard);

  return (
    distance +
    fromPenalty +
    toPenalty +
    expectedSidePenalty +
    sameSidePenalty +
    overlapPenalty -
    preferenceBonus
  );
};

export function resolveConnectionSides(
  fromCard: Card,
  toCard: Card,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>,
  routeStyle: ConnectionRouteStyle = 'bezier'
): { fromSide: ConnectionSide; toSide: ConnectionSide } {
  if (preferred?.fromSide && preferred?.toSide) {
    return {
      fromSide: preferred.fromSide,
      toSide: preferred.toSide,
    };
  }

  if (preferred?.fromSide) {
    const target = getClosestSideForPoint(toCard, getCardSidePoint(fromCard, preferred.fromSide));
    return {
      fromSide: preferred.fromSide,
      toSide: target,
    };
  }

  if (preferred?.toSide) {
    const source = getClosestSideForPoint(fromCard, getCardSidePoint(toCard, preferred.toSide));
    return {
      fromSide: source,
      toSide: preferred.toSide,
    };
  }

  let best = {
    fromSide: ALL_SIDES[0],
    toSide: ALL_SIDES[0],
    score: Number.POSITIVE_INFINITY,
  };

  for (const fromSide of ALL_SIDES) {
    for (const toSide of ALL_SIDES) {
      const score = scoreSidePair(fromCard, toCard, fromSide, toSide, routeStyle, preferred);
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

export function getConnectionGeometry(
  fromCard: Card,
  toCard: Card,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>,
  routeStyle: ConnectionRouteStyle = 'bezier'
) {
  const { fromSide, toSide } = resolveConnectionSides(fromCard, toCard, preferred, routeStyle);
  const startPoint = getCardSidePoint(fromCard, fromSide);
  const endPoint = getCardSidePoint(toCard, toSide);
  const geometry =
    routeStyle === 'orthogonal'
      ? buildOrthogonalPath(startPoint, endPoint, fromSide, toSide, fromCard, toCard)
      : buildBezierPath(startPoint, endPoint, fromSide, toSide);

  return {
    fromSide,
    toSide,
    startPoint,
    endPoint,
    ...geometry,
  };
}

export function doesConnectionIntersectSelectionBox(
  fromCard: Card,
  toCard: Card,
  selection: SelectionBox,
  preferred?: Partial<{ fromSide: ConnectionSide; toSide: ConnectionSide }>,
  routeStyle: ConnectionRouteStyle = 'bezier'
) {
  const geometry = getConnectionGeometry(fromCard, toCard, preferred, routeStyle);

  if (pointInSelectionBox(geometry.startPoint, selection) || pointInSelectionBox(geometry.endPoint, selection)) {
    return true;
  }

  if (routeStyle === 'orthogonal' && 'points' in geometry) {
    for (let index = 1; index < geometry.points.length; index += 1) {
      if (segmentIntersectsSelectionBox(geometry.points[index - 1], geometry.points[index], selection)) {
        return true;
      }
    }
    return false;
  }

  const samples = getBezierSamplePoints(
    geometry.startPoint,
    geometry.endPoint,
    geometry.fromSide,
    geometry.toSide
  );

  for (let index = 1; index < samples.length; index += 1) {
    if (segmentIntersectsSelectionBox(samples[index - 1], samples[index], selection)) {
      return true;
    }
  }

  return false;
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
