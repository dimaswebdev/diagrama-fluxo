import type { Card, Point } from '@/types/diagrama';

export type ViewportSize = {
  width: number;
  height: number;
};

export type ViewportTransform = {
  scale: number;
  offset: Point;
};

export function getCardsBounds(cards: Card[]) {
  if (cards.length === 0) return null;

  const minX = Math.min(...cards.map((card) => card.x));
  const minY = Math.min(...cards.map((card) => card.y));
  const maxX = Math.max(...cards.map((card) => card.x + card.width));
  const maxY = Math.max(...cards.map((card) => card.y + card.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getCenteredViewportTransform(
  card: Card,
  viewport: ViewportSize,
  scale = 1
): ViewportTransform {
  const cardCenterX = card.x + card.width / 2;
  const cardCenterY = card.y + card.height / 2;

  return {
    scale,
    offset: {
      x: viewport.width / 2 - cardCenterX * scale,
      y: viewport.height / 2 - cardCenterY * scale,
    },
  };
}

export function getFitViewportTransform(
  cards: Card[],
  viewport: ViewportSize,
  {
    margin = 120,
    minScale = 0.1,
    maxScale = 1,
  }: {
    margin?: number;
    minScale?: number;
    maxScale?: number;
  } = {}
): ViewportTransform | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return getCenteredViewportTransform(cards[0], viewport, 1);

  const bounds = getCardsBounds(cards);
  if (!bounds) return null;

  const availableWidth = Math.max(1, viewport.width - margin * 2);
  const availableHeight = Math.max(1, viewport.height - margin * 2);
  const fitScale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  const scale = Math.min(Math.max(fitScale, minScale), maxScale);
  const boundsCenterX = bounds.x + bounds.width / 2;
  const boundsCenterY = bounds.y + bounds.height / 2;

  return {
    scale,
    offset: {
      x: viewport.width / 2 - boundsCenterX * scale,
      y: viewport.height / 2 - boundsCenterY * scale,
    },
  };
}
