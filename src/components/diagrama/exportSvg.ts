import type { Card as CardType, Connection } from '@/types/diagrama';

type Side = 'left' | 'right' | 'top' | 'bottom';

export type ExportSvgOptions = {
  includeGrid: boolean;
  includeShadows: boolean;
  gridSize: number;
  background: string; // ex: '#ffffff'
};

export type Bounds = { x: number; y: number; width: number; height: number };

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

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

function bezierPath(p0: { x: number; y: number }, p1: { x: number; y: number }, fromSide: Side, toSide: Side) {
  const k = 90; // “força” da curva
  const c0 = { x: p0.x, y: p0.y };
  const c1 = { x: p1.x, y: p1.y };

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

  const cp0 = { x: c0.x + c0d.x, y: c0.y + c0d.y };
  const cp1 = { x: c1.x + c1d.x, y: c1.y + c1d.y };

  return `M ${c0.x} ${c0.y} C ${cp0.x} ${cp0.y} ${cp1.x} ${cp1.y} ${c1.x} ${c1.y}`;
}

function arrowHead(end: { x: number; y: number }, prev: { x: number; y: number }, size = 10) {
  const dx = end.x - prev.x;
  const dy = end.y - prev.y;
  const ang = Math.atan2(dy, dx);

  const a1 = ang + Math.PI * 0.85;
  const a2 = ang - Math.PI * 0.85;

  const p1 = { x: end.x + Math.cos(a1) * size, y: end.y + Math.sin(a1) * size };
  const p2 = { x: end.x + Math.cos(a2) * size, y: end.y + Math.sin(a2) * size };

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

export function buildExportSvg(params: {
  cards: CardType[];
  connections: Connection[];
  bounds: Bounds;
  viewBox: Bounds; // área da página atual
  opts: ExportSvgOptions;
}) {
  const { cards, connections, bounds, viewBox, opts } = params;

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

  // grid (desenho leve)
  const grid = opts.includeGrid
    ? (() => {
        const gs = Math.max(8, opts.gridSize);
        const startX = Math.floor(viewBox.x / gs) * gs;
        const startY = Math.floor(viewBox.y / gs) * gs;

        const lines: string[] = [];
        for (let x = startX; x <= viewBox.x + viewBox.width; x += gs) {
          lines.push(`<line x1="${x}" y1="${viewBox.y}" x2="${x}" y2="${viewBox.y + viewBox.height}" stroke="#e5e7eb" stroke-width="1"/>`);
        }
        for (let y = startY; y <= viewBox.y + viewBox.height; y += gs) {
          lines.push(`<line x1="${viewBox.x}" y1="${y}" x2="${viewBox.x + viewBox.width}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`);
        }
        return `<g opacity="0.85">${lines.join('')}</g>`;
      })()
    : '';

  const defs = `
    <defs>
      ${
        opts.includeShadows
          ? `
      <filter id="ds" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.12"/>
      </filter>
      `
          : ''
      }
      <clipPath id="clipPage">
        <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" />
      </clipPath>
    </defs>
  `;

  const cardSvg = cards
    .map((c) => {
      const r = 18;
      const stroke = c.accent || '#2563eb';
      const fill = `${stroke}22`; // leve transparência
      const shadow = opts.includeShadows ? `filter="url(#ds)"` : '';

      const title = esc(c.title || '');
      const date = esc(c.date || '');
      const content = (c.content || '').trim();

      // heurística simples de quebra
      const contentLines = wrapText(content, clamp(Math.floor((c.width - 28) / 6.2), 18, 44)).slice(0, 10);

      const tx = c.x + 18;
      const ty = c.y + 30;

      return `
        <g class="card">
          <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"
            rx="${r}" ry="${r}"
            fill="${fill}" stroke="${stroke}" stroke-width="2" ${shadow}/>
          <!-- bolinha sequência -->
          <circle cx="${c.x + 26}" cy="${c.y + 26}" r="12" fill="${stroke}"/>
          <text x="${c.x + 26}" y="${c.y + 30}" text-anchor="middle"
            font-family="Inter, Arial, sans-serif" font-size="12" fill="#ffffff">${esc(String(c.sequence ?? ''))}</text>

          <text x="${tx + 26}" y="${ty}" font-family="Inter, Arial, sans-serif"
            font-size="14" font-weight="700" fill="#111827">${title}</text>

          <text x="${tx + 26}" y="${ty + 16}" font-family="Inter, Arial, sans-serif"
            font-size="10.5" fill="#6b7280">${date}</text>

          ${
            contentLines.length
              ? contentLines
                  .map(
                    (ln, i) =>
                      `<text x="${tx + 26}" y="${ty + 48 + i * 14}" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#374151">${esc(ln)}</text>`
                  )
                  .join('')
              : ''
          }

          ${
            c.label
              ? `<text x="${c.x + 18}" y="${c.y + c.height - 14}" font-family="Inter, Arial, sans-serif" font-size="10.5" fill="#6b7280">${esc(c.label)}</text>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  // conexões (path + arrow polygon) — 100% vetorial, sem marker
  const connSvg = connections
    .map((conn) => {
      const from = cards.find((x) => x.id === conn.fromCard);
      const to = cards.find((x) => x.id === conn.toCard);
      if (!from || !to) return '';

      const fromSide = (conn.fromSide as Side) || 'right';
      const toSide = (conn.toSide as Side) || 'left';

      const p0 = sidePoint(from, fromSide);
      const p1 = sidePoint(to, toSide);

      const d = bezierPath(p0, p1, fromSide, toSide);

      // “ponto anterior” aproximado para direção da seta
      const prev = {
        x: p1.x + (toSide === 'left' ? 16 : toSide === 'right' ? -16 : 0),
        y: p1.y + (toSide === 'top' ? 16 : toSide === 'bottom' ? -16 : 0),
      };

      const stroke = conn.color || '#2563eb';
      const dash =
        conn.type === 'dashed' ? '6 4' : conn.type === 'dotted' ? '2 5' : '';

      const poly = arrowHead(p1, prev, 10);

      return `
        <g class="conn">
          <path d="${d}" fill="none" stroke="${stroke}" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            ${dash ? `stroke-dasharray="${dash}"` : ''} />
          <polygon points="${poly}" fill="${stroke}" />
        </g>
      `;
    })
    .join('');

  // SVG “página”
  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${viewBox.width}" height="${viewBox.height}"
       viewBox="${vb}">
    ${defs}
    <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="${opts.background}" />
    ${grid}
    <g clip-path="url(#clipPage)">
      ${connSvg}
      ${cardSvg}
    </g>
  </svg>
  `;
}