import type { Point } from '@/types/diagrama';

function normalizeVector(start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    dx,
    dy,
    length,
    unitX: dx / length,
    unitY: dy / length,
  };
}

function getRoundedOrthogonalPath(points: Point[]) {
  if (points.length < 2) {
    return '';
  }

  const lastPoint = points[points.length - 1];
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
    const radiusBase = Math.min(
      18,
      Math.abs(lastPoint.x - points[0].x) / 4 || 18,
      Math.abs(lastPoint.y - points[0].y) / 4 || 18
    );
    const radius = Math.max(8, radiusBase);
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

  path += ` L ${lastPoint.x} ${lastPoint.y}`;
  return path;
}

function buildArrowPolygon(
  endPoint: Point,
  previousPoint: Point,
  length: number,
  halfWidth: number
) {
  const vector = normalizeVector(previousPoint, endPoint);
  const baseCenter = {
    x: endPoint.x - vector.unitX * length,
    y: endPoint.y - vector.unitY * length,
  };
  const normalX = -vector.unitY;
  const normalY = vector.unitX;
  const leftPoint = {
    x: baseCenter.x + normalX * halfWidth,
    y: baseCenter.y + normalY * halfWidth,
  };
  const rightPoint = {
    x: baseCenter.x - normalX * halfWidth,
    y: baseCenter.y - normalY * halfWidth,
  };

  return {
    points: `${endPoint.x},${endPoint.y} ${leftPoint.x},${leftPoint.y} ${rightPoint.x},${rightPoint.y}`,
    baseCenter,
  };
}

function getCubicBezierPoint(
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  t: number
) {
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
}

function splitCubicBezier(
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  t: number
) {
  const lerp = (a: Point, b: Point) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const p01 = lerp(start, controlPoint1);
  const p12 = lerp(controlPoint1, controlPoint2);
  const p23 = lerp(controlPoint2, end);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, p23);
  const point = lerp(p012, p123);

  return {
    point,
    leftControlPoint1: p01,
    leftControlPoint2: p012,
  };
}

function getCurveLengthSamples(
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  steps = 48
) {
  const points = Array.from({ length: steps + 1 }, (_, index) =>
    getCubicBezierPoint(start, controlPoint1, controlPoint2, end, index / steps)
  );
  const lengths = [0];
  let totalLength = 0;

  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y
    );
    lengths.push(totalLength);
  }

  return { points, lengths, totalLength, steps };
}

function getParameterAtLength(
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  targetLength: number
) {
  const samples = getCurveLengthSamples(start, controlPoint1, controlPoint2, end);

  if (targetLength <= 0) {
    return 0;
  }

  if (targetLength >= samples.totalLength) {
    return 1;
  }

  for (let index = 1; index < samples.lengths.length; index += 1) {
    if (samples.lengths[index] >= targetLength) {
      const previousLength = samples.lengths[index - 1];
      const segmentLength = samples.lengths[index] - previousLength || 1;
      const localRatio = (targetLength - previousLength) / segmentLength;
      return (index - 1 + localRatio) / samples.steps;
    }
  }

  return 1;
}

export function buildEmphasisArrowHead(endPoint: Point, previousPoint: Point, thickness: number) {
  const vector = normalizeVector(previousPoint, endPoint);
  const arrowLength = Math.min(
    Math.max(24, thickness * 2.05),
    Math.max(12, vector.length * 0.82)
  );
  const arrowHalfWidth = Math.max(thickness * 1.02, thickness / 2 + 8);

  return buildArrowPolygon(endPoint, previousPoint, arrowLength, arrowHalfWidth);
}

export function buildBezierEmphasisArrowHead(endPoint: Point, previousPoint: Point, thickness: number) {
  const vector = normalizeVector(previousPoint, endPoint);
  const inset = Math.max(2.5, thickness * 0.24);
  const visibleTip = {
    x: endPoint.x - vector.unitX * inset,
    y: endPoint.y - vector.unitY * inset,
  };
  const arrowLength = Math.min(
    Math.max(20, thickness * 1.7),
    Math.max(10, vector.length * 0.72)
  );
  const arrowHalfWidth = Math.max(thickness * 0.78, thickness / 2 + 5);
  const arrow = buildArrowPolygon(visibleTip, previousPoint, arrowLength, arrowHalfWidth);

  return {
    ...arrow,
    visibleTip,
  };
}

export function buildBezierEmphasisStrokeShape(
  start: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  end: Point,
  thickness: number
) {
  const samples = getCurveLengthSamples(start, controlPoint1, controlPoint2, end);
  const inset = Math.max(2.5, thickness * 0.24);
  const arrowLength = Math.min(
    Math.max(20, thickness * 1.7),
    Math.max(10, Math.max(1, samples.totalLength - inset) * 0.72)
  );
  const arrowHalfWidth = Math.max(thickness * 0.9, thickness / 2 + 6);
  const overlap = Math.max(3, thickness * 0.3);
  const baseLength = Math.max(0, samples.totalLength - inset - arrowLength + overlap);
  const tipLength = Math.max(0, samples.totalLength - inset);
  const baseT = Math.min(
    0.985,
    getParameterAtLength(start, controlPoint1, controlPoint2, end, baseLength)
  );
  const tipT = Math.min(
    0.995,
    getParameterAtLength(start, controlPoint1, controlPoint2, end, tipLength)
  );
  const split = splitCubicBezier(start, controlPoint1, controlPoint2, end, baseT);
  const tipPoint = getCubicBezierPoint(start, controlPoint1, controlPoint2, end, tipT);
  const tangentReference = {
    x: tipPoint.x - split.point.x,
    y: tipPoint.y - split.point.y,
  };
  const referencePoint =
    Math.hypot(tangentReference.x, tangentReference.y) > 0.001
      ? split.point
      : controlPoint2;
  const arrow = buildArrowPolygon(tipPoint, referencePoint, arrowLength, arrowHalfWidth);

  return {
    bodyPath: `M ${start.x} ${start.y} C ${split.leftControlPoint1.x} ${split.leftControlPoint1.y}, ${split.leftControlPoint2.x} ${split.leftControlPoint2.y}, ${split.point.x} ${split.point.y}`,
    arrowPolygon: arrow.points,
  };
}

export function buildOrthogonalEmphasisStrokeShape(points: Point[], thickness: number) {
  if (points.length < 2) {
    return null;
  }

  const endPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const arrow = buildEmphasisArrowHead(endPoint, previousPoint, thickness);
  const bodyPoints = [...points.slice(0, -1), arrow.baseCenter];

  return {
    bodyPath: getRoundedOrthogonalPath(bodyPoints),
    arrowPolygon: arrow.points,
  };
}
