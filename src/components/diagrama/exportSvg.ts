import type {
  Card as CardType,
  Connection,
  ConnectionStrokeWidth,
  ConnectionVariant,
  DiagramText,
  GroupBox,
} from '@/types/diagrama';
import { getConnectionGeometry } from './connectionRouting';
import {
  buildBezierEmphasisArrowHead,
  buildBezierEmphasisStrokeShape,
  buildEmphasisArrowHead,
  buildOrthogonalEmphasisStrokeShape,
} from './connectionEmphasisShape';

type Side = 'left' | 'right' | 'top' | 'bottom';

export type ExportSvgOptions = {
  includeGrid: boolean;
  includeShadows: boolean;
  gridSize: number;
  background: string;
};

export type Bounds = { x: number; y: number; width: number; height: number };

const SYSTEM_FONT_STACK = "Inter, 'Segoe UI', Arial, sans-serif";
const DEFAULT_GROUP_LAYER = -100;
const DEFAULT_CONNECTION_LAYER = -50;
const DEFAULT_CARD_LAYER = 0;
const DEFAULT_TEXT_LAYER = 100;

function getConnectionStrokeWidth(strokeWidth?: ConnectionStrokeWidth, variant: ConnectionVariant = 'default') {
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

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

function sidePoint(card: CardType, side: Side) {
  switch (side) {
    case 'left':
      return { x: card.x, y: card.y + card.height / 2 };
    case 'right':
      return { x: card.x + card.width, y: card.y + card.height / 2 };
    case 'top':
      return { x: card.x + card.width / 2, y: card.y };
    case 'bottom':
      return { x: card.x + card.width / 2, y: card.y + card.height };
  }
}

/**
 * Agora retorna também cp1 (último ponto de controle),
 * pois ele define a tangente final da curva.
 */
function getCubicBezierPoint(
  p0: { x: number; y: number },
  cp0: { x: number; y: number },
  cp1: { x: number; y: number },
  p1: { x: number; y: number },
  t: number
) {
  const inverse = 1 - t;
  const inverseSquared = inverse * inverse;
  const inverseCubed = inverseSquared * inverse;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return {
    x:
      inverseCubed * p0.x +
      3 * inverseSquared * t * cp0.x +
      3 * inverse * tSquared * cp1.x +
      tCubed * p1.x,
    y:
      inverseCubed * p0.y +
      3 * inverseSquared * t * cp0.y +
      3 * inverse * tSquared * cp1.y +
      tCubed * p1.y,
  };
}

function getCubicBezierMidpointByLength(
  p0: { x: number; y: number },
  cp0: { x: number; y: number },
  cp1: { x: number; y: number },
  p1: { x: number; y: number }
) {
  const steps = 40;
  const sampledPoints = Array.from({ length: steps + 1 }, (_, index) =>
    getCubicBezierPoint(p0, cp0, cp1, p1, index / steps)
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
}

function bezierPath(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  fromSide: Side,
  toSide: Side
) {
  const k = 90;

  const c0d =
    fromSide === 'left'
      ? { x: -k, y: 0 }
      : fromSide === 'right'
      ? { x: k, y: 0 }
      : fromSide === 'top'
      ? { x: 0, y: -k }
      : { x: 0, y: k };

  const c1d =
    toSide === 'left'
      ? { x: -k, y: 0 }
      : toSide === 'right'
      ? { x: k, y: 0 }
      : toSide === 'top'
      ? { x: 0, y: -k }
      : { x: 0, y: k };

  const cp0 = { x: p0.x + c0d.x, y: p0.y + c0d.y };
  const cp1 = { x: p1.x + c1d.x, y: p1.y + c1d.y };

  return {
    d: `M ${p0.x} ${p0.y} C ${cp0.x} ${cp0.y} ${cp1.x} ${cp1.y} ${p1.x} ${p1.y}`,
    cp1,
    labelPoint: getCubicBezierMidpointByLength(p0, cp0, cp1, p1),
  };
}

function orthogonalPath(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  fromSide: Side,
  toSide: Side
) {
  const vector =
    fromSide === 'left'
      ? { x: -1, y: 0 }
      : fromSide === 'right'
      ? { x: 1, y: 0 }
      : fromSide === 'top'
      ? { x: 0, y: -1 }
      : { x: 0, y: 1 };

  const toVector =
    toSide === 'left'
      ? { x: -1, y: 0 }
      : toSide === 'right'
      ? { x: 1, y: 0 }
      : toSide === 'top'
      ? { x: 0, y: -1 }
      : { x: 0, y: 1 };

  const lead = Math.max(26, Math.min(52, Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)) * 0.18));
  const startLead = { x: p0.x + vector.x * lead, y: p0.y + vector.y * lead };
  const endLead = { x: p1.x + toVector.x * lead, y: p1.y + toVector.y * lead };
  const points = [p0, startLead];

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
      points.push({ x: middleX, y: startLead.y }, { x: middleX, y: endLead.y });
    } else {
      const outerX =
        fromSide === 'right'
          ? Math.max(startLead.x, endLead.x) + lead
          : Math.min(startLead.x, endLead.x) - lead;
      points.push({ x: outerX, y: startLead.y }, { x: outerX, y: endLead.y });
    }
  } else if (sameVerticalAxis) {
    const canUseCenterLane =
      (fromSide === 'bottom' && startLead.y <= endLead.y) ||
      (fromSide === 'top' && startLead.y >= endLead.y);

    if (canUseCenterLane) {
      const middleY = (startLead.y + endLead.y) / 2;
      points.push({ x: startLead.x, y: middleY }, { x: endLead.x, y: middleY });
    } else {
      const outerY =
        fromSide === 'bottom'
          ? Math.max(startLead.y, endLead.y) + lead
          : Math.min(startLead.y, endLead.y) - lead;
      points.push({ x: startLead.x, y: outerY }, { x: endLead.x, y: outerY });
    }
  } else if (fromSide === 'left' || fromSide === 'right') {
    points.push({ x: endLead.x, y: startLead.y });
  } else {
    points.push({ x: startLead.x, y: endLead.y });
  }

  points.push(endLead, p1);

  const radius = Math.max(8, Math.min(18, Math.abs(p1.x - p0.x) / 4 || 18, Math.abs(p1.y - p0.y) / 4 || 18));
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const inDx = current.x - prev.x;
    const inDy = current.y - prev.y;
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
    d += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  d += ` L ${p1.x} ${p1.y}`;
  return {
    d,
    prevPoint: points[points.length - 2],
    labelPoint: getLongestSegmentMidpoint(points),
  };
}

function getLongestSegmentMidpoint(points: Array<{ x: number; y: number }>) {
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
}

function arrowHead(
  end: { x: number; y: number },
  prev: { x: number; y: number },
  size = 10
) {
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const ang = Math.atan2(dy, dx);

  const a1 = ang + Math.PI * 0.85;
  const a2 = ang - Math.PI * 0.85;

  const p1 = { x: end.x + Math.cos(a1) * size, y: end.y + Math.sin(a1) * size };
  const p2 = { x: end.x + Math.cos(a2) * size, y: end.y + Math.sin(a2) * size };

  return `${end.x},${end.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

function arrowPolygon(
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

function wrapText(text: string, maxChars: number) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (t.length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function getLabelWidth(label: string) {
  return Math.max(68, label.length * 7.2 + 26);
}

function wrapTextToBox(text: string, maxChars: number, maxLines: number) {
  if (maxLines <= 0) return [];
  return wrapText(text, maxChars).slice(0, maxLines);
}

function buildGroupTitleMarkup(groupBox: GroupBox) {
  if (groupBox.showTitle === false) {
    return '';
  }
  const title = (groupBox.title || '').trim();
  if (!title) {
    return '';
  }

  const align = groupBox.titleStyle.textAlign ?? 'center';
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const titleX =
    align === 'left'
      ? groupBox.x + 28
      : align === 'right'
      ? groupBox.x + groupBox.width - 28
      : groupBox.x + groupBox.width / 2;
  const maxChars = clamp(Math.floor((groupBox.width - 56) / 11), 14, 36);
  const lines = wrapText(title, maxChars).slice(0, 3);
  const fontSize = groupBox.titleStyle.fontSize;
  const lineHeight = fontSize * (groupBox.titleStyle.lineHeight ?? 1.15);
  const blockHeight = lines.length * lineHeight;
  const startY = groupBox.y + 24 + fontSize + Math.max(0, (34 - blockHeight) / 2);

  return lines
    .map(
      (line, index) => `<text x="${titleX}" y="${startY + index * lineHeight}"
              text-anchor="${anchor}"
              font-family="${SYSTEM_FONT_STACK}"
              font-size="${fontSize}"
              font-weight="${groupBox.titleStyle.fontWeight ?? 700}"
              fill="${groupBox.titleStyle.color ?? '#111827'}">${esc(line)}</text>`
    )
    .join('');
}

export function buildExportSvg(params: {
  cards: CardType[];
  connections: Connection[];
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  bounds: Bounds;
  viewBox: Bounds;
  opts: ExportSvgOptions;
}) {
  const { cards, connections, texts, groupBoxes, viewBox, opts } = params;

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

  // GRID ESTÁVEL
  const grid = opts.includeGrid
    ? (() => {
        const gs = Math.max(8, opts.gridSize);
        const startX = Math.floor(viewBox.x / gs) * gs;
        const startY = Math.floor(viewBox.y / gs) * gs;

        const lines: string[] = [];

        for (let x = startX; x <= viewBox.x + viewBox.width; x += gs) {
          lines.push(
            `<line x1="${x}" y1="${viewBox.y}" x2="${x}" y2="${
              viewBox.y + viewBox.height
            }" stroke="#e5e7eb" stroke-width="1" stroke-opacity="0.6"/>`
          );
        }

        for (let y = startY; y <= viewBox.y + viewBox.height; y += gs) {
          lines.push(
            `<line x1="${viewBox.x}" y1="${y}" x2="${
              viewBox.x + viewBox.width
            }" y2="${y}" stroke="#e5e7eb" stroke-width="1" stroke-opacity="0.6"/>`
          );
        }

        return `<g>${lines.join('')}</g>`;
      })()
    : '';

  const groupSvgMap = new Map(
    groupBoxes.map((groupBox) => {
      return [
        groupBox.id,
        `
          <g>
            <rect x="${groupBox.x}" y="${groupBox.y}" width="${groupBox.width}" height="${groupBox.height}"
              rx="28" ry="28"
              fill="${groupBox.background}"
              stroke="${groupBox.accent}"
              stroke-width="1.5"
            />
            ${buildGroupTitleMarkup(groupBox)}
          </g>
        `,
      ];
    })
  );

  // CARDS
  const cardSvgMap = new Map(
    cards.map((c) => {
      const r = 18;
      const stroke = c.accent || '#2563eb';
      const fillOpacity = 0.13;

      const date = esc(c.date || '');
      const content = (c.content || '').trim();

      const tx = c.x + 18;
      const ty = c.y + 30;
      const contentAlign = c.textStyle?.textAlign ?? 'left';
      const titleFontSize = c.textStyle?.fontSize ?? 14;
      const titleLineHeight = titleFontSize * 1.08;
      const titleLines = wrapText(
        c.title || '',
        clamp(Math.floor((c.width - 64) / (titleFontSize * 0.62)), 10, 30)
      ).slice(0, 2);
      const titleBlockHeight = titleLines.length * titleLineHeight;
      const titleAnchor = 'start';
      const titleX = tx + 26;
      const dateY = c.y + c.height - 36;
      const dateBadgeHeight = 22;
      const dateBadgeWidth = Math.max(86, (c.date?.length ?? 0) * 6.1 + 18);
      const dateBadgeX = c.x + c.width / 2 - dateBadgeWidth / 2;
      const dateTextY = dateY + 14.5;
      const contentX =
        contentAlign === 'center'
          ? c.x + c.width / 2
          : contentAlign === 'right'
          ? c.x + c.width - 18
          : tx + 26;
      const contentAnchor =
        contentAlign === 'center' ? 'middle' : contentAlign === 'right' ? 'end' : 'start';
      const contentLineHeight = Math.max(13, (Math.max(11, (c.textStyle?.fontSize ?? 14) * 0.82)) * 1.18);
      const contentTop = ty + Math.max(18, titleBlockHeight + 12);
      const contentBottomPadding = dateBadgeHeight + 38;
      const availableContentHeight = Math.max(0, c.height - (contentTop - c.y) - contentBottomPadding);
      const maxContentLines = Math.max(1, Math.floor(availableContentHeight / contentLineHeight));
      const contentLines = wrapTextToBox(
        content,
        clamp(Math.floor((c.width - 44) / (Math.max(11, (c.textStyle?.fontSize ?? 14) * 0.82) * 0.6)), 14, 44),
        maxContentLines
      );

      return [
        c.id,
        `
          <g>
            <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"
              rx="${r}" ry="${r}"
              fill="${stroke}"
              fill-opacity="${fillOpacity}"
              stroke="${stroke}"
              stroke-width="2"
            />

            <circle cx="${c.x + 26}" cy="${c.y + 26}" r="12"
              fill="${stroke}"
            />

            <text x="${c.x + 26}" y="${c.y + 30}" text-anchor="middle"
              font-family="${SYSTEM_FONT_STACK}"
              font-size="12"
              fill="#ffffff">
              ${esc(String(c.sequence ?? ''))}
            </text>

            ${titleLines
              .map(
                (line, index) => `<text x="${titleX}" y="${ty + index * titleLineHeight}"
              text-anchor="${titleAnchor}"
              font-family="${SYSTEM_FONT_STACK}"
              font-size="${titleFontSize}"
              font-weight="${c.textStyle?.fontWeight ?? 700}"
              fill="${c.textStyle?.color ?? '#111827'}">
              ${esc(line)}
            </text>`
              )
              .join('')}

            <rect
              x="${dateBadgeX}"
              y="${dateY - 2}"
              width="${dateBadgeWidth}"
              height="${dateBadgeHeight}"
              rx="11"
              fill="${stroke}"
              fill-opacity="0.09"
              stroke="${stroke}"
              stroke-width="1"
            />
            <text x="${dateBadgeX + dateBadgeWidth / 2}" y="${dateTextY}"
              text-anchor="middle"
              font-family="${SYSTEM_FONT_STACK}"
              font-size="12"
              font-weight="600"
              fill="#111827">
              ${date}
            </text>

            ${
              c.label
                ? `<text x="${c.x + 18}" y="${c.y + c.height - 10}"
                  text-anchor="start"
                  font-family="${SYSTEM_FONT_STACK}"
                  font-size="10.5"
                  font-weight="500"
                  fill="#64748b">
                  ${esc(c.label)}
                </text>`
                : ''
            }
            ${
              c.source
                ? `<text x="${c.x + c.width - 18}" y="${c.y + c.height - 10}"
                  text-anchor="end"
                  font-family="${SYSTEM_FONT_STACK}"
                  font-size="10.5"
                  font-weight="500"
                  fill="#64748b">
                  ${esc(c.source)}
                </text>`
                : ''
            }

            ${
              contentLines.length
                ? contentLines
                    .map(
                      (ln, i) =>
                      `<text x="${contentX}" y="${
                          contentTop + i * contentLineHeight
                        }"
                          text-anchor="${contentAnchor}"
                          font-family="${SYSTEM_FONT_STACK}"
                          font-size="${Math.max(11, (c.textStyle?.fontSize ?? 14) * 0.82)}"
                          fill="${c.textStyle?.color ?? '#374151'}">
                          ${esc(ln)}
                        </text>`
                    )
                    .join('')
                : ''
            }
          </g>
        `,
      ];
    })
  );

  const textSvgMap = new Map(
    texts.map((item) => {
      const lines = (item.text || '').split('\n').filter(Boolean);
      const startY = item.y + item.textStyle.fontSize;
      const textAlign = item.textStyle.textAlign ?? 'left';
      const anchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
      const textX =
        textAlign === 'center'
          ? item.x + item.width / 2
          : textAlign === 'right'
          ? item.x + item.width - 12
          : item.x + 12;
      const rotation = item.rotation ?? 0;
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      return [
        item.id,
        `
          <g transform="rotate(${rotation} ${centerX} ${centerY})">
            ${item.background ? `<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="18" fill="${item.background}" />` : ''}
            ${lines
              .map(
                (line, index) => `<text
                  x="${textX}"
                  y="${startY + index * item.textStyle.fontSize * (item.textStyle.lineHeight ?? 1.15)}"
                  text-anchor="${anchor}"
                  font-family="${SYSTEM_FONT_STACK}"
                  font-size="${item.textStyle.fontSize}"
                  font-weight="${item.textStyle.fontWeight ?? 700}"
                  fill="${item.textStyle.color ?? '#111827'}">${esc(line)}</text>`
              )
              .join('')}
          </g>
        `,
      ];
    })
  );

  // CONEXÕES COM DIREÇÃO CORRETA
  const connSvgMap = new Map(
    connections.map((conn) => {
      const from = cards.find((x) => x.id === conn.fromCard);
      const to = cards.find((x) => x.id === conn.toCard);
      if (!from || !to) return [conn.id, ''];

      const geometry = getConnectionGeometry(
        from,
        to,
        {
          fromSide: conn.fromSide,
          toSide: conn.toSide,
        },
        conn.routeStyle ?? 'bezier'
      );

      const stroke = conn.color || '#2563eb';
      const variant = conn.variant ?? 'default';
      const strokeWidth = getConnectionStrokeWidth(conn.strokeWidth, variant);
      const dash =
        conn.type === 'dashed'
          ? '6 4'
          : conn.type === 'dotted'
          ? '2 5'
          : '';

      const poly =
        variant === 'emphasis'
          ? (
              conn.routeStyle === 'bezier'
                ? buildBezierEmphasisArrowHead(geometry.endPoint, geometry.arrowReferencePoint, strokeWidth)
                : buildEmphasisArrowHead(geometry.endPoint, geometry.arrowReferencePoint, strokeWidth)
            ).points
          : arrowHead(geometry.endPoint, geometry.arrowReferencePoint, 10);
      const emphasisStrokeShape =
        variant === 'emphasis' &&
        conn.routeStyle === 'orthogonal' &&
        'points' in geometry
          ? buildOrthogonalEmphasisStrokeShape(geometry.points, strokeWidth)
          : variant === 'emphasis' &&
            conn.routeStyle === 'bezier' &&
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
      const label = (conn.label || '').trim();
      const labelWidth = getLabelWidth(label);
      const labelCenterX = geometry.labelPoint.x;
      const labelCenterY = geometry.labelPoint.y;
      const labelX = labelCenterX - labelWidth / 2;
      const labelY = labelCenterY - 12;
      const connectionLayer = DEFAULT_CONNECTION_LAYER;

      return [
        conn.id,
        `
        <g data-layer="${connectionLayer}">
          ${
            emphasisStrokeShape
              ? `<path d="${emphasisStrokeShape.bodyPath}"
                   fill="none"
                   stroke="${stroke}"
                   stroke-width="${strokeWidth}"
                   stroke-linecap="round"
                   stroke-linejoin="round" />
                 <polygon points="${emphasisStrokeShape.arrowPolygon}" fill="${stroke}" />`
              : `<path d="${geometry.path}"
            fill="none"
            stroke="${stroke}"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
            stroke-linejoin="round"
            ${dash ? `stroke-dasharray="${dash}"` : ''} />
          <polygon points="${poly}" fill="${stroke}" />`
          }
          ${
            label
              ? `<g>
                  <rect
                    x="${labelX}"
                    y="${labelY}"
                    width="${labelWidth}"
                    height="26"
                    rx="12"
                    fill="rgba(255,255,255,0.88)"
                    stroke="${stroke}"
                    stroke-opacity="0.45"
                    stroke-width="1.2"
                  />
                  <text
                    x="${labelCenterX}"
                    y="${labelCenterY + 3.5}"
                    text-anchor="middle"
                    font-family="${SYSTEM_FONT_STACK}"
                    font-size="11"
                    font-weight="700"
                    fill="${stroke}">
                    ${esc(label)}
                  </text>
                </g>`
              : ''
          }
        </g>
      `,
      ];
    })
  );

  const layeredElements = [
    ...groupBoxes.map((item) => ({
      layer: item.layer ?? DEFAULT_GROUP_LAYER,
      id: `group-${item.id}`,
      markup: groupSvgMap.get(item.id) ?? '',
    })),
    ...connections.map((item) => ({
      layer: DEFAULT_CONNECTION_LAYER,
      id: `connection-${item.id}`,
      markup: connSvgMap.get(item.id) ?? '',
    })),
    ...cards.map((item) => ({
      layer: item.layer ?? DEFAULT_CARD_LAYER,
      id: `card-${item.id}`,
      markup: cardSvgMap.get(item.id) ?? '',
    })),
    ...texts.map((item) => ({
      layer: item.layer ?? DEFAULT_TEXT_LAYER,
      id: `text-${item.id}`,
      markup: textSvgMap.get(item.id) ?? '',
    })),
  ]
    .filter((item): item is { layer: number; id: string; markup: string } => typeof item.markup === 'string')
    .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id))
    .map((item) => item.markup)
    .join('');

  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${viewBox.width}"
       height="${viewBox.height}"
       viewBox="${vb}">
    <rect x="${viewBox.x}" y="${viewBox.y}"
          width="${viewBox.width}"
          height="${viewBox.height}"
          fill="${opts.background}" />
    ${grid}
    <g>
      ${layeredElements}
    </g>
  </svg>
  `;
}
