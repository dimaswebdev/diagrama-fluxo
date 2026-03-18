import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { getConnectionGeometry } from '@/components/diagrama/connectionRouting';
import {
  getCenteredViewportTransform,
  getFitViewportTransform,
} from '@/components/diagrama/viewport';
import {
  A4_HEIGHT,
  A4_WIDTH,
  type Card,
  type Connection,
  type DiagramText,
  type GroupBox,
  type Point,
} from '@/types/diagrama';

type ViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseDiagramViewportParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  cards: Card[];
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  connections: Connection[];
  cardMap: Map<string, Card>;
  zoomMin: number;
  viewportMargin: number;
  proxyTextStyle: Card['textStyle'];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function useDiagramViewport({
  containerRef,
  cards,
  texts,
  groupBoxes,
  connections,
  cardMap,
  zoomMin,
  viewportMargin,
  proxyTextStyle,
}: UseDiagramViewportParams) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const getViewportCenterWorld = useCallback(
    (nextScale = scaleRef.current, nextOffset = offsetRef.current) => {
      const width = containerRef.current?.clientWidth || window.innerWidth || A4_WIDTH;
      const height = containerRef.current?.clientHeight || window.innerHeight || A4_HEIGHT;

      return {
        x: (-nextOffset.x / nextScale) + width / (2 * nextScale),
        y: (-nextOffset.y / nextScale) + height / (2 * nextScale),
      };
    },
    [containerRef]
  );

  const getViewportSize = useCallback(() => {
    return {
      width: containerRef.current?.clientWidth || window.innerWidth || A4_WIDTH,
      height: containerRef.current?.clientHeight || window.innerHeight || A4_HEIGHT,
    };
  }, [containerRef]);

  const getPrimarySceneBounds = useCallback((): ViewBounds | null => {
    const elementBounds = [
      ...cards.map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
      ...texts.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
      ...groupBoxes.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ];

    if (!elementBounds.length) {
      return null;
    }

    const minX = Math.min(...elementBounds.map((item) => item.x));
    const minY = Math.min(...elementBounds.map((item) => item.y));
    const maxX = Math.max(...elementBounds.map((item) => item.x + item.width));
    const maxY = Math.max(...elementBounds.map((item) => item.y + item.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [cards, groupBoxes, texts]);

  const getAllElementBounds = useCallback((): ViewBounds | null => {
    const baseBounds = getPrimarySceneBounds();
    if (!baseBounds) {
      return null;
    }

    const connectionPadding = 32;
    const connectionBounds: ViewBounds[] = [];

    for (const connection of connections) {
      const fromCard = cardMap.get(connection.fromCard);
      const toCard = cardMap.get(connection.toCard);
      if (!fromCard || !toCard) continue;

      const geometry = getConnectionGeometry(
        fromCard,
        toCard,
        {
          fromSide: connection.fromSide,
          toSide: connection.toSide,
        },
        connection.routeStyle ?? 'bezier'
      );

      const points =
        connection.routeStyle === 'orthogonal' && 'points' in geometry
          ? geometry.points
          : 'controlPoint1' in geometry && 'controlPoint2' in geometry
            ? [
                geometry.startPoint,
                geometry.controlPoint1,
                geometry.controlPoint2,
                geometry.endPoint,
              ]
            : [geometry.startPoint, geometry.endPoint];

      points.push(geometry.labelPoint);

      const minX = Math.min(...points.map((point) => point.x)) - connectionPadding;
      const minY = Math.min(...points.map((point) => point.y)) - connectionPadding;
      const maxX = Math.max(...points.map((point) => point.x)) + connectionPadding;
      const maxY = Math.max(...points.map((point) => point.y)) + connectionPadding;

      connectionBounds.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }

    if (!connectionBounds.length) {
      return baseBounds;
    }

    const connectionMinX = Math.min(...connectionBounds.map((item) => item.x));
    const connectionMinY = Math.min(...connectionBounds.map((item) => item.y));
    const connectionMaxX = Math.max(...connectionBounds.map((item) => item.x + item.width));
    const connectionMaxY = Math.max(...connectionBounds.map((item) => item.y + item.height));

    const hasStructuralGroups = groupBoxes.length > 0;
    const overflowRatio = hasStructuralGroups ? 0.18 : 0.28;
    const overflowCap = hasStructuralGroups ? 160 : 220;
    const maxOverflowX = Math.min(baseBounds.width * overflowRatio, overflowCap);
    const maxOverflowY = Math.min(baseBounds.height * overflowRatio, overflowCap);

    const minX = Math.min(baseBounds.x, Math.max(connectionMinX, baseBounds.x - maxOverflowX));
    const minY = Math.min(baseBounds.y, Math.max(connectionMinY, baseBounds.y - maxOverflowY));
    const maxX = Math.max(
      baseBounds.x + baseBounds.width,
      Math.min(connectionMaxX, baseBounds.x + baseBounds.width + maxOverflowX)
    );
    const maxY = Math.max(
      baseBounds.y + baseBounds.height,
      Math.min(connectionMaxY, baseBounds.y + baseBounds.height + maxOverflowY)
    );

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [cardMap, connections, getPrimarySceneBounds, groupBoxes]);

  const applyViewportTransform = useCallback((nextScale: number, nextOffset: Point) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }, []);

  const centerCardInViewport = useCallback((card: Card, targetScale = 1) => {
    const transform = getCenteredViewportTransform(card, getViewportSize(), targetScale);
    applyViewportTransform(transform.scale, transform.offset);
  }, [applyViewportTransform, getViewportSize]);

  const fitSceneToViewport = useCallback(() => {
    const primaryBounds = getPrimarySceneBounds();
    const allBounds = getAllElementBounds();
    const totalElementCount = cards.length + texts.length + groupBoxes.length;
    if (!primaryBounds || !allBounds || totalElementCount === 0) return;

    const viewport = getViewportSize();

    if (totalElementCount === 1) {
      if (cards.length === 1) {
        centerCardInViewport(cards[0], 1);
        return;
      }

      const singleBounds =
        texts.length === 1
          ? texts[0]
          : groupBoxes.length === 1
            ? groupBoxes[0]
            : null;

      if (singleBounds) {
        const centerX = singleBounds.x + singleBounds.width / 2;
        const centerY = singleBounds.y + singleBounds.height / 2;
        applyViewportTransform(1, {
          x: viewport.width / 2 - centerX,
          y: viewport.height / 2 - centerY,
        });
        return;
      }
    }

    const primaryFitProxyCard: Card[] = [{
      id: '__fit-primary__',
      x: primaryBounds.x,
      y: primaryBounds.y,
      width: primaryBounds.width,
      height: primaryBounds.height,
      sequence: 0,
      title: '',
      content: '',
      label: '',
      date: '',
      source: '',
      accent: '#000000',
      textStyle: proxyTextStyle,
      type: 'default',
    }];

    const sceneFitProxyCard: Card[] = [{
      id: '__fit__',
      x: allBounds.x,
      y: allBounds.y,
      width: allBounds.width,
      height: allBounds.height,
      sequence: 0,
      title: '',
      content: '',
      label: '',
      date: '',
      source: '',
      accent: '#000000',
      textStyle: proxyTextStyle,
      type: 'default',
    }];

    const viewportMinSide = Math.min(viewport.width, viewport.height);
    const baseMargin = groupBoxes.length > 0 ? viewportMinSide * 0.08 : viewportMargin;
    const adaptiveMargin = Math.round(
      clamp(baseMargin, groupBoxes.length > 0 ? 56 : 80, groupBoxes.length > 0 ? 104 : 140)
    );

    const primaryTransform = getFitViewportTransform(primaryFitProxyCard, viewport, {
      margin: adaptiveMargin,
      minScale: zoomMin,
      maxScale: 1,
    });
    const fullSceneTransform = getFitViewportTransform(sceneFitProxyCard, viewport, {
      margin: adaptiveMargin,
      minScale: zoomMin,
      maxScale: 1,
    });

    const transform = !primaryTransform
      ? fullSceneTransform
      : !fullSceneTransform
        ? primaryTransform
        : {
            scale: Math.min(
              primaryTransform.scale,
              Math.max(fullSceneTransform.scale, primaryTransform.scale * 0.88)
            ),
            offset:
              fullSceneTransform.scale < primaryTransform.scale * 0.88
                ? fullSceneTransform.offset
                : primaryTransform.offset,
          };

    if (!transform) return;

    applyViewportTransform(transform.scale, transform.offset);
  }, [
    applyViewportTransform,
    cards,
    centerCardInViewport,
    getAllElementBounds,
    getPrimarySceneBounds,
    getViewportSize,
    groupBoxes,
    proxyTextStyle,
    texts,
    viewportMargin,
    zoomMin,
  ]);

  const handleZoomReset = useCallback(() => {
    const viewport = getViewportSize();
    const center = getViewportCenterWorld(scaleRef.current, offsetRef.current);
    applyViewportTransform(1, {
      x: viewport.width / 2 - center.x,
      y: viewport.height / 2 - center.y,
    });
  }, [applyViewportTransform, getViewportCenterWorld, getViewportSize]);

  return {
    scale,
    setScale,
    scaleRef,
    offset,
    setOffset,
    offsetRef,
    getViewportCenterWorld,
    getViewportSize,
    getPrimarySceneBounds,
    getAllElementBounds,
    applyViewportTransform,
    centerCardInViewport,
    fitSceneToViewport,
    handleZoomReset,
  };
}
