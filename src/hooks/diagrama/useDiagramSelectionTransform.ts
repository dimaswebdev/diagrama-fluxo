import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResizeDirection } from '@/components/diagrama/Card';
import type { Card, DiagramText, GroupBox, Point } from '@/types/diagrama';

type ResizeSession = {
  id: string;
  direction: ResizeDirection;
  startMouse: Point;
  startItem: { x: number; y: number; width: number; height: number };
};

type ExpandedSelection = {
  cardIds: Set<string>;
  textIds: Set<string>;
  groupBoxIds: Set<string>;
};

type UseDiagramSelectionTransformParams = {
  cardMap: Map<string, Card>;
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  gridSize: number;
  cardMinWidth: number;
  cardMinHeight: number;
  textMinWidth: number;
  textMinHeight: number;
  groupMinWidth: number;
  groupMinHeight: number;
  snapToGrid: boolean;
  getExpandedSelectionIds: (seed: {
    cards?: Iterable<string>;
    texts?: Iterable<string>;
    groupBoxes?: Iterable<string>;
  }) => ExpandedSelection;
  screenToWorld: (clientX: number, clientY: number) => Point | null;
  selectedCards: Set<string>;
  selectedTexts: Set<string>;
  selectedGroupBoxes: Set<string>;
  setSelectedCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedConnections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedTexts: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedGroupBoxes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDragStart: React.Dispatch<React.SetStateAction<Point>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setTexts: React.Dispatch<React.SetStateAction<DiagramText[]>>;
  setGroupBoxes: React.Dispatch<React.SetStateAction<GroupBox[]>>;
};

export function useDiagramSelectionTransform({
  cardMap,
  texts,
  groupBoxes,
  gridSize,
  cardMinWidth,
  cardMinHeight,
  textMinWidth,
  textMinHeight,
  groupMinWidth,
  groupMinHeight,
  snapToGrid,
  getExpandedSelectionIds,
  screenToWorld,
  selectedCards,
  selectedTexts,
  selectedGroupBoxes,
  setSelectedCards,
  setSelectedConnections,
  setSelectedTexts,
  setSelectedGroupBoxes,
  setDragStart,
  setCards,
  setTexts,
  setGroupBoxes,
}: UseDiagramSelectionTransformParams) {
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [draggedCards, setDraggedCards] = useState<Map<string, { startX: number; startY: number }>>(new Map());
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [draggedTexts, setDraggedTexts] = useState<Map<string, { startX: number; startY: number }>>(new Map());
  const [isDraggingGroupBox, setIsDraggingGroupBox] = useState(false);
  const [draggedGroupBoxes, setDraggedGroupBoxes] = useState<Map<string, { startX: number; startY: number }>>(new Map());

  const [isResizingCard, setIsResizingCard] = useState(false);
  const [resizeSession, setResizeSession] = useState<{
    id: string;
    direction: ResizeDirection;
    startMouse: Point;
    startCard: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [isResizingText, setIsResizingText] = useState(false);
  const [textResizeSession, setTextResizeSession] = useState<ResizeSession | null>(null);
  const [isResizingGroupBox, setIsResizingGroupBox] = useState(false);
  const [groupResizeSession, setGroupResizeSession] = useState<ResizeSession | null>(null);

  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const draggedCardsRef = useRef(draggedCards);
  const draggedTextsRef = useRef(draggedTexts);
  const draggedGroupBoxesRef = useRef(draggedGroupBoxes);
  const snapToGridRef = useRef(snapToGrid);
  const pendingDragWorldRef = useRef<Point | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const didDragCardsRef = useRef(false);

  useEffect(() => {
    draggedCardsRef.current = draggedCards;
  }, [draggedCards]);

  useEffect(() => {
    draggedTextsRef.current = draggedTexts;
  }, [draggedTexts]);

  useEffect(() => {
    draggedGroupBoxesRef.current = draggedGroupBoxes;
  }, [draggedGroupBoxes]);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    },
    []
  );

  const beginExpandedSelectionDrag = useCallback(
    (
      seed:
        | { cards: Set<string>; texts: Set<string>; groupBoxes: Set<string> }
        | { cards?: Set<string>; texts?: Set<string>; groupBoxes?: Set<string> },
      world: Point
    ) => {
      const expanded = getExpandedSelectionIds({
        cards: seed.cards ?? new Set<string>(),
        texts: seed.texts ?? new Set<string>(),
        groupBoxes: seed.groupBoxes ?? new Set<string>(),
      });

      setSelectedCards(expanded.cardIds);
      setSelectedTexts(expanded.textIds);
      setSelectedGroupBoxes(expanded.groupBoxIds);
      setSelectedConnections(new Set());

      setDragStart(world);
      dragStartRef.current = world;
      didDragCardsRef.current = false;

      const nextDraggedCards = new Map<string, { startX: number; startY: number }>();
      expanded.cardIds.forEach((cardId) => {
        const card = cardMap.get(cardId);
        if (!card) return;
        nextDraggedCards.set(cardId, { startX: card.x, startY: card.y });
      });
      setDraggedCards(nextDraggedCards);

      const nextDraggedTexts = new Map<string, { startX: number; startY: number }>();
      expanded.textIds.forEach((textId) => {
        const item = texts.find((text) => text.id === textId);
        if (!item) return;
        nextDraggedTexts.set(textId, { startX: item.x, startY: item.y });
      });
      setDraggedTexts(nextDraggedTexts);

      const nextDraggedGroupBoxes = new Map<string, { startX: number; startY: number }>();
      expanded.groupBoxIds.forEach((groupBoxId) => {
        const item = groupBoxes.find((groupBox) => groupBox.id === groupBoxId);
        if (!item) return;
        nextDraggedGroupBoxes.set(groupBoxId, { startX: item.x, startY: item.y });
      });
      setDraggedGroupBoxes(nextDraggedGroupBoxes);

      if (expanded.cardIds.size > 0) setIsDraggingCard(true);
      if (expanded.textIds.size > 0) setIsDraggingText(true);
      if (expanded.groupBoxIds.size > 0) setIsDraggingGroupBox(true);
    },
    [
      cardMap,
      getExpandedSelectionIds,
      groupBoxes,
      setDragStart,
      setSelectedCards,
      setSelectedConnections,
      setSelectedGroupBoxes,
      setSelectedTexts,
      texts,
    ]
  );

  const moveDraggedCards = useCallback(
    (worldX: number, worldY: number): void => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      if (deltaX !== 0 || deltaY !== 0) {
        didDragCardsRef.current = true;
      }

      setCards((prev) => {
        let hasChanges = false;
        const nextCards = prev.map((card) => {
          const dragged = draggedCardsRef.current.get(card.id);
          if (!dragged) return card;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGridRef.current) {
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }

          if (card.x === newX && card.y === newY) {
            return card;
          }

          hasChanges = true;
          return { ...card, x: newX, y: newY };
        });

        return hasChanges ? nextCards : prev;
      });
    },
    [gridSize, setCards]
  );

  const flushDraggedCards = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }

    if (!pendingDragWorldRef.current) return;
    const pending = pendingDragWorldRef.current;
    pendingDragWorldRef.current = null;
    moveDraggedCards(pending.x, pending.y);
  }, [moveDraggedCards]);

  const scheduleDraggedCards = useCallback(
    (worldX: number, worldY: number) => {
      pendingDragWorldRef.current = { x: worldX, y: worldY };

      if (dragFrameRef.current !== null) return;

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        if (!pendingDragWorldRef.current) return;
        const pending = pendingDragWorldRef.current;
        pendingDragWorldRef.current = null;
        moveDraggedCards(pending.x, pending.y);
      });
    },
    [moveDraggedCards]
  );

  const resizeCard = useCallback(
    (worldX: number, worldY: number): void => {
      if (!resizeSession) return;

      const deltaX = worldX - resizeSession.startMouse.x;
      const deltaY = worldY - resizeSession.startMouse.y;
      const { startCard, direction } = resizeSession;

      let nextX = startCard.x;
      let nextY = startCard.y;
      let nextWidth = startCard.width;
      let nextHeight = startCard.height;

      if (direction.includes('right')) nextWidth = Math.max(cardMinWidth, startCard.width + deltaX);
      if (direction.includes('left')) {
        nextWidth = Math.max(cardMinWidth, startCard.width - deltaX);
        nextX = startCard.x + (startCard.width - nextWidth);
      }
      if (direction.includes('bottom')) nextHeight = Math.max(cardMinHeight, startCard.height + deltaY);
      if (direction.includes('top')) {
        nextHeight = Math.max(cardMinHeight, startCard.height - deltaY);
        nextY = startCard.y + (startCard.height - nextHeight);
      }

      if (snapToGrid) {
        nextX = Math.round(nextX / gridSize) * gridSize;
        nextY = Math.round(nextY / gridSize) * gridSize;
        nextWidth = Math.max(cardMinWidth, Math.round(nextWidth / gridSize) * gridSize);
        nextHeight = Math.max(cardMinHeight, Math.round(nextHeight / gridSize) * gridSize);
      }

      setCards((prev) =>
        prev.map((card) =>
          card.id === resizeSession.id
            ? { ...card, x: nextX, y: nextY, width: nextWidth, height: nextHeight }
            : card
        )
      );
    },
    [cardMinHeight, cardMinWidth, gridSize, resizeSession, setCards, snapToGrid]
  );

  const moveDraggedTexts = useCallback(
    (worldX: number, worldY: number) => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      if (deltaX !== 0 || deltaY !== 0) {
        didDragCardsRef.current = true;
      }

      setTexts((prev) =>
        prev.map((item) => {
          const dragged = draggedTextsRef.current.get(item.id);
          if (!dragged) return item;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGridRef.current) {
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }

          return item.x === newX && item.y === newY ? item : { ...item, x: newX, y: newY };
        })
      );
    },
    [gridSize, setTexts]
  );

  const moveDraggedGroupBoxes = useCallback(
    (worldX: number, worldY: number) => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      if (deltaX !== 0 || deltaY !== 0) {
        didDragCardsRef.current = true;
      }

      setGroupBoxes((prev) =>
        prev.map((item) => {
          const dragged = draggedGroupBoxesRef.current.get(item.id);
          if (!dragged) return item;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGridRef.current) {
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }

          return item.x === newX && item.y === newY ? item : { ...item, x: newX, y: newY };
        })
      );
    },
    [gridSize, setGroupBoxes]
  );

  const resizeBox = useCallback(
    (
      session: ResizeSession | null,
      minWidth: number,
      minHeight: number,
      apply: (nextX: number, nextY: number, nextWidth: number, nextHeight: number, id: string) => void,
      worldX: number,
      worldY: number
    ) => {
      if (!session) return;

      const deltaX = worldX - session.startMouse.x;
      const deltaY = worldY - session.startMouse.y;
      const { startItem, direction } = session;

      let nextX = startItem.x;
      let nextY = startItem.y;
      let nextWidth = startItem.width;
      let nextHeight = startItem.height;

      if (direction.includes('right')) nextWidth = Math.max(minWidth, startItem.width + deltaX);
      if (direction.includes('left')) {
        nextWidth = Math.max(minWidth, startItem.width - deltaX);
        nextX = startItem.x + (startItem.width - nextWidth);
      }
      if (direction.includes('bottom')) nextHeight = Math.max(minHeight, startItem.height + deltaY);
      if (direction.includes('top')) {
        nextHeight = Math.max(minHeight, startItem.height - deltaY);
        nextY = startItem.y + (startItem.height - nextHeight);
      }

      if (snapToGrid) {
        nextX = Math.round(nextX / gridSize) * gridSize;
        nextY = Math.round(nextY / gridSize) * gridSize;
        nextWidth = Math.max(minWidth, Math.round(nextWidth / gridSize) * gridSize);
        nextHeight = Math.max(minHeight, Math.round(nextHeight / gridSize) * gridSize);
      }

      apply(nextX, nextY, nextWidth, nextHeight, session.id);
    },
    [gridSize, snapToGrid]
  );

  const handleCardDragStart = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) return;

      beginExpandedSelectionDrag(
        selectedCards.has(id) && (selectedCards.size > 0 || selectedTexts.size > 0 || selectedGroupBoxes.size > 0)
          ? { cards: selectedCards, texts: selectedTexts, groupBoxes: selectedGroupBoxes }
          : { cards: new Set([id]) },
        world
      );
    },
    [beginExpandedSelectionDrag, screenToWorld, selectedCards, selectedGroupBoxes, selectedTexts]
  );

  const handleCardResizeStart = useCallback(
    (id: string, direction: ResizeDirection, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();

      const world = screenToWorld(event.clientX, event.clientY);
      const card = cardMap.get(id);
      if (!world || !card) return;

      setSelectedCards(new Set([id]));
      setSelectedConnections(new Set());
      setSelectedTexts(new Set());
      setSelectedGroupBoxes(new Set());
      setIsResizingCard(true);
      setResizeSession({
        id,
        direction,
        startMouse: world,
        startCard: {
          x: card.x,
          y: card.y,
          width: card.width,
          height: card.height,
        },
      });
    },
    [
      cardMap,
      screenToWorld,
      setSelectedCards,
      setSelectedConnections,
      setSelectedGroupBoxes,
      setSelectedTexts,
    ]
  );

  const handleTextDragStart = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) return;

      beginExpandedSelectionDrag(
        selectedTexts.has(id) && (selectedCards.size > 0 || selectedTexts.size > 0 || selectedGroupBoxes.size > 0)
          ? { cards: selectedCards, texts: selectedTexts, groupBoxes: selectedGroupBoxes }
          : { texts: new Set([id]) },
        world
      );
    },
    [beginExpandedSelectionDrag, screenToWorld, selectedCards, selectedGroupBoxes, selectedTexts]
  );

  const handleTextResizeStart = useCallback(
    (id: string, direction: ResizeDirection, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const world = screenToWorld(event.clientX, event.clientY);
      const item = texts.find((text) => text.id === id);
      if (!world || !item) return;

      setSelectedTexts(new Set([id]));
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setSelectedGroupBoxes(new Set());
      setIsResizingText(true);
      setTextResizeSession({
        id,
        direction,
        startMouse: world,
        startItem: { x: item.x, y: item.y, width: item.width, height: item.height },
      });
    },
    [
      screenToWorld,
      setSelectedCards,
      setSelectedConnections,
      setSelectedGroupBoxes,
      setSelectedTexts,
      texts,
    ]
  );

  const handleGroupBoxDragStart = useCallback(
    (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) return;

      beginExpandedSelectionDrag(
        selectedGroupBoxes.has(id) && (selectedCards.size > 0 || selectedTexts.size > 0 || selectedGroupBoxes.size > 0)
          ? { cards: selectedCards, texts: selectedTexts, groupBoxes: selectedGroupBoxes }
          : { groupBoxes: new Set([id]) },
        world
      );
    },
    [beginExpandedSelectionDrag, screenToWorld, selectedCards, selectedGroupBoxes, selectedTexts]
  );

  const handleGroupBoxResizeStart = useCallback(
    (id: string, direction: ResizeDirection, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const world = screenToWorld(event.clientX, event.clientY);
      const item = groupBoxes.find((groupBox) => groupBox.id === id);
      if (!world || !item) return;

      setSelectedGroupBoxes(new Set([id]));
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setSelectedTexts(new Set());
      setIsResizingGroupBox(true);
      setGroupResizeSession({
        id,
        direction,
        startMouse: world,
        startItem: { x: item.x, y: item.y, width: item.width, height: item.height },
      });
    },
    [
      groupBoxes,
      screenToWorld,
      setSelectedCards,
      setSelectedConnections,
      setSelectedGroupBoxes,
      setSelectedTexts,
    ]
  );

  const resetDragState = useCallback(() => {
    setIsDraggingCard(false);
    setIsDraggingText(false);
    setIsDraggingGroupBox(false);
    setDraggedCards(new Map());
    setDraggedTexts(new Map());
    setDraggedGroupBoxes(new Map());
    didDragCardsRef.current = false;
  }, []);

  return {
    isDraggingCard,
    isDraggingText,
    isDraggingGroupBox,
    isResizingCard,
    isResizingText,
    isResizingGroupBox,
    resizeSession,
    textResizeSession,
    groupResizeSession,
    didDragCardsRef,
    beginExpandedSelectionDrag,
    moveDraggedCards,
    flushDraggedCards,
    scheduleDraggedCards,
    resizeCard,
    moveDraggedTexts,
    moveDraggedGroupBoxes,
    resizeBox,
    handleCardDragStart,
    handleCardResizeStart,
    handleTextDragStart,
    handleTextResizeStart,
    handleGroupBoxDragStart,
    handleGroupBoxResizeStart,
    setIsResizingCard,
    setResizeSession,
    setIsResizingText,
    setTextResizeSession,
    setIsResizingGroupBox,
    setGroupResizeSession,
    resetDragState,
  };
}
