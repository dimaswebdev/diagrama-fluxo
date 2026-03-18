import { useCallback, useMemo } from 'react';

import type { Card, Connection, DiagramState, DiagramText, GroupBox } from '@/types/diagrama';

type MultiSelectionKind = { kind: 'multi'; item: { id: string; count: number } };
type CardSelectionKind = { kind: 'card'; item: Card };
type TextSelectionKind = { kind: 'text'; item: DiagramText };
type GroupSelectionKind = { kind: 'group'; item: GroupBox };
type ConnectionKind = { kind: 'connection'; item: Connection };

type ArrangementSelection = MultiSelectionKind | CardSelectionKind | TextSelectionKind | GroupSelectionKind | ConnectionKind | null;

type ExpandedSelection = {
  cardIds: Set<string>;
  textIds: Set<string>;
  groupBoxIds: Set<string>;
};

type UseDiagramArrangementParams = {
  cards: Card[];
  texts: DiagramText[];
  groupBoxes: GroupBox[];
  connections: Connection[];
  selectedCards: Set<string>;
  selectedTexts: Set<string>;
  selectedGroupBoxes: Set<string>;
  selectedConnections: Set<string>;
  snapToGrid: boolean;
  gridSize: number;
  defaultConnectionLayer: number;
  defaultCardLayer: number;
  defaultGroupLayer: number;
  layerStep: number;
  getCardLayer: (card: Card) => number;
  getTextLayer: (item: DiagramText) => number;
  getGroupLayer: (item: GroupBox) => number;
  createUniqueId: () => string;
  getDiagramState: (overrides?: Partial<DiagramState>) => DiagramState;
  saveToHistory: (state?: DiagramState) => void;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  setTexts: React.Dispatch<React.SetStateAction<DiagramText[]>>;
  setGroupBoxes: React.Dispatch<React.SetStateAction<GroupBox[]>>;
};

export function useDiagramArrangement({
  cards,
  texts,
  groupBoxes,
  connections,
  selectedCards,
  selectedTexts,
  selectedGroupBoxes,
  selectedConnections,
  snapToGrid,
  gridSize,
  defaultConnectionLayer,
  defaultCardLayer,
  defaultGroupLayer,
  layerStep,
  getCardLayer,
  getTextLayer,
  getGroupLayer,
  createUniqueId,
  getDiagramState,
  saveToHistory,
  setCards,
  setTexts,
  setGroupBoxes,
}: UseDiagramArrangementParams) {
  const getExpandedSelectionIds = useCallback(
    (seed: {
      cards?: Iterable<string>;
      texts?: Iterable<string>;
      groupBoxes?: Iterable<string>;
    }): ExpandedSelection => {
      const cardIds = new Set(seed.cards ?? []);
      const textIds = new Set(seed.texts ?? []);
      const groupBoxIds = new Set(seed.groupBoxes ?? []);
      const groupIds = new Set<string>();

      for (const card of cards) {
        if (cardIds.has(card.id) && card.groupId) groupIds.add(card.groupId);
      }
      for (const item of texts) {
        if (textIds.has(item.id) && item.groupId) groupIds.add(item.groupId);
      }
      for (const item of groupBoxes) {
        if (groupBoxIds.has(item.id) && item.groupId) groupIds.add(item.groupId);
      }

      if (groupIds.size > 0) {
        for (const card of cards) {
          if (card.groupId && groupIds.has(card.groupId)) cardIds.add(card.id);
        }
        for (const item of texts) {
          if (item.groupId && groupIds.has(item.groupId)) textIds.add(item.id);
        }
        for (const item of groupBoxes) {
          if (item.groupId && groupIds.has(item.groupId)) groupBoxIds.add(item.id);
        }
      }

      return { cardIds, textIds, groupBoxIds };
    },
    [cards, groupBoxes, texts]
  );

  const propertiesSelection: ArrangementSelection = useMemo(() => {
    const multiSelectableCount = selectedCards.size + selectedTexts.size + selectedGroupBoxes.size;

    if (multiSelectableCount >= 2) {
      return { kind: 'multi', item: { id: 'multi-selection', count: multiSelectableCount } };
    }

    if (selectedCards.size === 1) {
      const item = cards.find((card) => card.id === Array.from(selectedCards)[0]);
      return item ? { kind: 'card', item } : null;
    }

    if (selectedTexts.size === 1) {
      const item = texts.find((text) => text.id === Array.from(selectedTexts)[0]);
      return item ? { kind: 'text', item } : null;
    }

    if (selectedGroupBoxes.size === 1) {
      const item = groupBoxes.find((groupBox) => groupBox.id === Array.from(selectedGroupBoxes)[0]);
      return item ? { kind: 'group', item } : null;
    }

    if (selectedConnections.size === 1) {
      const item = connections.find((connection) => connection.id === Array.from(selectedConnections)[0]);
      return item ? { kind: 'connection', item } : null;
    }

    return null;
  }, [cards, connections, groupBoxes, selectedCards, selectedConnections, selectedGroupBoxes, selectedTexts, texts]);

  const applyLayerChangeFromPanel = useCallback(
    (direction: 'front' | 'forward' | 'backward' | 'back') => {
      if (!propertiesSelection || propertiesSelection.kind === 'connection') return;

      const allLayers = [
        defaultConnectionLayer,
        ...cards.map((card) => getCardLayer(card)),
        ...texts.map((item) => getTextLayer(item)),
        ...groupBoxes.map((item) => getGroupLayer(item)),
      ];
      const maxLayer = allLayers.length > 0 ? Math.max(...allLayers) : defaultCardLayer;
      const minLayer = allLayers.length > 0 ? Math.min(...allLayers) : defaultGroupLayer;

      const getNextLayer = (current: number) => {
        if (direction === 'front') return maxLayer + layerStep;
        if (direction === 'back') return minLayer - layerStep;
        return current + (direction === 'forward' ? layerStep : -layerStep);
      };

      if (propertiesSelection.kind === 'card') {
        const nextCards = cards.map((card) =>
          card.id === propertiesSelection.item.id
            ? { ...card, layer: getNextLayer(getCardLayer(card)) }
            : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (propertiesSelection.kind === 'text') {
        const nextTexts = texts.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, layer: getNextLayer(getTextLayer(item)) }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === propertiesSelection.item.id
          ? { ...item, layer: getNextLayer(getGroupLayer(item)) }
          : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    },
    [
      cards,
      defaultCardLayer,
      defaultConnectionLayer,
      defaultGroupLayer,
      getCardLayer,
      getDiagramState,
      getGroupLayer,
      getTextLayer,
      groupBoxes,
      layerStep,
      propertiesSelection,
      saveToHistory,
      setCards,
      setGroupBoxes,
      setTexts,
      texts,
    ]
  );

  const groupSelectedElements = useCallback(() => {
    const selectedCount = selectedCards.size + selectedTexts.size + selectedGroupBoxes.size;
    if (selectedCount < 2) return;

    const groupId = createUniqueId();
    const nextCards = cards.map((card) =>
      selectedCards.has(card.id) ? { ...card, groupId } : card
    );
    const nextTexts = texts.map((item) =>
      selectedTexts.has(item.id) ? { ...item, groupId } : item
    );
    const nextGroupBoxes = groupBoxes.map((item) =>
      selectedGroupBoxes.has(item.id) ? { ...item, groupId } : item
    );

    setCards(nextCards);
    setTexts(nextTexts);
    setGroupBoxes(nextGroupBoxes);
    saveToHistory(getDiagramState({ cards: nextCards, texts: nextTexts, groupBoxes: nextGroupBoxes }));
  }, [
    cards,
    createUniqueId,
    getDiagramState,
    groupBoxes,
    saveToHistory,
    selectedCards,
    selectedGroupBoxes,
    selectedTexts,
    setCards,
    setGroupBoxes,
    setTexts,
    texts,
  ]);

  const ungroupSelectedElements = useCallback(() => {
    const expanded = getExpandedSelectionIds({
      cards: selectedCards,
      texts: selectedTexts,
      groupBoxes: selectedGroupBoxes,
    });

    if (
      expanded.cardIds.size === 0 &&
      expanded.textIds.size === 0 &&
      expanded.groupBoxIds.size === 0
    ) {
      return;
    }

    const nextCards = cards.map((card) =>
      expanded.cardIds.has(card.id) ? { ...card, groupId: undefined } : card
    );
    const nextTexts = texts.map((item) =>
      expanded.textIds.has(item.id) ? { ...item, groupId: undefined } : item
    );
    const nextGroupBoxes = groupBoxes.map((item) =>
      expanded.groupBoxIds.has(item.id) ? { ...item, groupId: undefined } : item
    );

    setCards(nextCards);
    setTexts(nextTexts);
    setGroupBoxes(nextGroupBoxes);
    saveToHistory(getDiagramState({ cards: nextCards, texts: nextTexts, groupBoxes: nextGroupBoxes }));
  }, [
    cards,
    getDiagramState,
    getExpandedSelectionIds,
    groupBoxes,
    saveToHistory,
    selectedCards,
    selectedGroupBoxes,
    selectedTexts,
    setCards,
    setGroupBoxes,
    setTexts,
    texts,
  ]);

  const alignSelectedElements = useCallback(
    (direction: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => {
      const expanded = getExpandedSelectionIds({
        cards: selectedCards,
        texts: selectedTexts,
        groupBoxes: selectedGroupBoxes,
      });

      const selectedCardItems = cards.filter((card) => expanded.cardIds.has(card.id));
      const selectedTextItems = texts.filter((item) => expanded.textIds.has(item.id));
      const selectedGroupItems = groupBoxes.filter((item) => expanded.groupBoxIds.has(item.id));

      const boxes = [
        ...selectedCardItems.map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
        ...selectedTextItems.map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
        ...selectedGroupItems.map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
      ];

      if (boxes.length < 2) return;

      const left = Math.min(...boxes.map((item) => item.x));
      const top = Math.min(...boxes.map((item) => item.y));
      const right = Math.max(...boxes.map((item) => item.x + item.width));
      const bottom = Math.max(...boxes.map((item) => item.y + item.height));
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;

      const alignX = (x: number, width: number) => {
        if (direction === 'left') return left;
        if (direction === 'center-x') return centerX - width / 2;
        if (direction === 'right') return right - width;
        return x;
      };

      const alignY = (y: number, height: number) => {
        if (direction === 'top') return top;
        if (direction === 'center-y') return centerY - height / 2;
        if (direction === 'bottom') return bottom - height;
        return y;
      };

      const snapValue = (value: number) =>
        snapToGrid ? Math.round(value / gridSize) * gridSize : value;

      const nextCards = cards.map((card) => {
        if (!expanded.cardIds.has(card.id)) return card;
        const newX = snapValue(alignX(card.x, card.width));
        const newY = snapValue(alignY(card.y, card.height));
        return newX === card.x && newY === card.y ? card : { ...card, x: newX, y: newY };
      });

      const nextTexts = texts.map((item) => {
        if (!expanded.textIds.has(item.id)) return item;
        const newX = snapValue(alignX(item.x, item.width));
        const newY = snapValue(alignY(item.y, item.height));
        return newX === item.x && newY === item.y ? item : { ...item, x: newX, y: newY };
      });

      const nextGroupBoxes = groupBoxes.map((item) => {
        if (!expanded.groupBoxIds.has(item.id)) return item;
        const newX = snapValue(alignX(item.x, item.width));
        const newY = snapValue(alignY(item.y, item.height));
        return newX === item.x && newY === item.y ? item : { ...item, x: newX, y: newY };
      });

      const nextState = getDiagramState({
        cards: nextCards,
        texts: nextTexts,
        groupBoxes: nextGroupBoxes,
      });

      setCards(nextState.cards);
      setTexts(nextState.texts);
      setGroupBoxes(nextState.groupBoxes);
      saveToHistory(nextState);
    },
    [
      cards,
      getDiagramState,
      getExpandedSelectionIds,
      gridSize,
      groupBoxes,
      saveToHistory,
      selectedCards,
      selectedGroupBoxes,
      selectedTexts,
      setCards,
      setGroupBoxes,
      setTexts,
      snapToGrid,
      texts,
    ]
  );

  const distributeSelectedElements = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      const expanded = getExpandedSelectionIds({
        cards: selectedCards,
        texts: selectedTexts,
        groupBoxes: selectedGroupBoxes,
      });

      const boxes = [
        ...cards.filter((card) => expanded.cardIds.has(card.id)).map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
        ...texts.filter((item) => expanded.textIds.has(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
        ...groupBoxes.filter((item) => expanded.groupBoxIds.has(item.id)).map((item) => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
      ];

      if (boxes.length < 3) return;

      const isHorizontal = direction === 'horizontal';
      const ordered = boxes.slice().sort((a, b) => (isHorizontal ? a.x - b.x : a.y - b.y));
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const startEdge = isHorizontal ? first.x : first.y;
      const endEdge = isHorizontal ? last.x + last.width : last.y + last.height;
      const totalSize = ordered.reduce((sum, item) => sum + (isHorizontal ? item.width : item.height), 0);
      const gap = (endEdge - startEdge - totalSize) / (ordered.length - 1);

      let cursor = startEdge;
      const positionMap = new Map<string, { x?: number; y?: number }>();
      ordered.forEach((item) => {
        positionMap.set(item.id, isHorizontal ? { x: cursor } : { y: cursor });
        cursor += (isHorizontal ? item.width : item.height) + gap;
      });

      const snapValue = (value: number) =>
        snapToGrid ? Math.round(value / gridSize) * gridSize : value;

      const nextCards = cards.map((card) => {
        const pos = positionMap.get(card.id);
        if (!pos) return card;
        const newX = pos.x !== undefined ? snapValue(pos.x) : card.x;
        const newY = pos.y !== undefined ? snapValue(pos.y) : card.y;
        return newX === card.x && newY === card.y ? card : { ...card, x: newX, y: newY };
      });

      const nextTexts = texts.map((item) => {
        const pos = positionMap.get(item.id);
        if (!pos) return item;
        const newX = pos.x !== undefined ? snapValue(pos.x) : item.x;
        const newY = pos.y !== undefined ? snapValue(pos.y) : item.y;
        return newX === item.x && newY === item.y ? item : { ...item, x: newX, y: newY };
      });

      const nextGroupBoxes = groupBoxes.map((item) => {
        const pos = positionMap.get(item.id);
        if (!pos) return item;
        const newX = pos.x !== undefined ? snapValue(pos.x) : item.x;
        const newY = pos.y !== undefined ? snapValue(pos.y) : item.y;
        return newX === item.x && newY === item.y ? item : { ...item, x: newX, y: newY };
      });

      const nextState = getDiagramState({
        cards: nextCards,
        texts: nextTexts,
        groupBoxes: nextGroupBoxes,
      });

      setCards(nextState.cards);
      setTexts(nextState.texts);
      setGroupBoxes(nextState.groupBoxes);
      saveToHistory(nextState);
    },
    [
      cards,
      getDiagramState,
      getExpandedSelectionIds,
      gridSize,
      groupBoxes,
      saveToHistory,
      selectedCards,
      selectedGroupBoxes,
      selectedTexts,
      setCards,
      setGroupBoxes,
      setTexts,
      snapToGrid,
      texts,
    ]
  );

  return {
    getExpandedSelectionIds,
    propertiesSelection,
    applyLayerChangeFromPanel,
    groupSelectedElements,
    ungroupSelectedElements,
    alignSelectedElements,
    distributeSelectedElements,
  };
}
