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

export function buildOrthogonalEmphasisStrokeShape(points: Point[], thickness: number) {
  if (points.length < 2) {
    return null;
  }

  const endPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];
  const vector = normalizeVector(previousPoint, endPoint);
  const arrowLength = Math.min(
    Math.max(24, thickness * 2.05),
    Math.max(12, vector.length * 0.82)
  );
  const arrowHalfWidth = Math.max(thickness * 1.02, thickness / 2 + 8);
  const arrow = buildArrowPolygon(endPoint, previousPoint, arrowLength, arrowHalfWidth);
  const bodyPoints = [...points.slice(0, -1), arrow.baseCenter];

  return {
    bodyPath: getRoundedOrthogonalPath(bodyPoints),
    arrowPolygon: arrow.points,
  };
}
