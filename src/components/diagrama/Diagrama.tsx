'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PrintDialog from './PrintDialog';
import Card from './Card';
import CanvasText from './CanvasText';
import ConnectionLine from './ConnectionLine';
import GroupBox from './GroupBox';
import PropertiesPanel from './PropertiesPanel';
import {
  getConnectionGeometry,
  getClosestSideForPoint,
  getPreviewConnectionGeometry,
  resolveConnectionSides,
  type ConnectionSide,
} from './connectionRouting';
import SelectionBox from './SelectionBox';
import FloatingToolbar from './FloatingToolbar';
import DiagramHeader from './DiagramHeader';
import { getCardPreset } from './cardPresets';
import { estimateTextHeight } from './textSizing';

import { useLocalStorage } from '@/hooks/diagrama/useLocalStorage';
import { useHistory } from '@/hooks/diagrama/useHistory';
import { useDiagramViewport } from '@/hooks/diagrama/useDiagramViewport';
import { useDiagramSelectionTransform } from '@/hooks/diagrama/useDiagramSelectionTransform';
import { useDiagramArrangement } from '@/hooks/diagrama/useDiagramArrangement';
import { useDiagramKeyboardShortcuts } from '@/hooks/diagrama/useDiagramKeyboardShortcuts';
import { useDiagramEditors } from '@/hooks/diagrama/useDiagramEditors';
import { useDiagramOutput } from '@/hooks/diagrama/useDiagramOutput';
import { useDiagramCanvasSelection } from '@/hooks/diagrama/useDiagramCanvasSelection';

import {
  Card as CardType,
  Connection,
  ConnectionStrokeWidth,
  ConnectionRouteStyle,
  DiagramState,
  DiagramText,
  GroupBox as GroupBoxType,
  Point,
  ConnectionType,
  ConnectionVariant,
  CardType as CardTypeEnum,
  GRID_SIZE,
} from '@/types/diagrama';

const CARD_COLORS = [
  '#2563EB',
  '#9ED6F0',
  '#19B7C6',
  '#0B8CA6',
  '#0C3E52',
  '#F4B53A',
  '#F39A1F',
  '#F07B1A',
  '#FF6B6B',
  '#7C5CFF',
  '#2DD4BF',
  '#F59E0B',
  '#60A5FA',
  '#34D399',
  '#A78BFA',
  '#111827',
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const getRandomColor = () => CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
const CARD_WIDTH = 320;
const CARD_HEIGHT = 220;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = Number.POSITIVE_INFINITY;
const VIEWPORT_MARGIN = 120;
const CARD_MIN_WIDTH = 180;
const CARD_MIN_HEIGHT = 120;
const GROUP_MIN_WIDTH = 260;
const GROUP_MIN_HEIGHT = 180;
const TEXT_MIN_WIDTH = 120;
const TEXT_MIN_HEIGHT = 48;
const DEFAULT_CARD_TEXT_STYLE = {
  fontSize: 14,
  fontWeight: 700 as const,
  textAlign: 'left' as const,
  lineHeight: 1.45,
  color: '#111827',
};
const DEFAULT_TEXT_STYLE = {
  fontSize: 30,
  fontWeight: 700 as const,
  textAlign: 'center' as const,
  lineHeight: 1.15,
  color: '#111827',
};
const DEFAULT_GROUP_TITLE_STYLE = {
  fontSize: 18,
  fontWeight: 700 as const,
  textAlign: 'center' as const,
  lineHeight: 1.1,
  color: '#111827',
};
const DEFAULT_GROUP_LAYER = -100;
const DEFAULT_CONNECTION_LAYER = -50;
const DEFAULT_CARD_LAYER = 0;
const DEFAULT_TEXT_LAYER = 100;
const LAYER_STEP = 10;
const DUPLICATE_OFFSET = 40;

const getCardLayer = (card: CardType) => card.layer ?? DEFAULT_CARD_LAYER;
const getTextLayer = (item: DiagramText) => item.layer ?? DEFAULT_TEXT_LAYER;
const getGroupLayer = (item: GroupBoxType) => item.layer ?? DEFAULT_GROUP_LAYER;
const createUniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return `rgba(148,163,184,${alpha})`;
  }

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const Diagrama: React.FC = () => {
  // PersistÃªncia
  const [cards, setCards] = useLocalStorage<CardType[]>('diagram-cards', []);
  const [connections, setConnections] = useLocalStorage<Connection[]>('diagram-connections', []);
  const [texts, setTexts] = useLocalStorage<DiagramText[]>('diagram-texts', []);
  const [groupBoxes, setGroupBoxes] = useLocalStorage<GroupBoxType[]>('diagram-group-boxes', []);
  const [fileName, setFileName] = useLocalStorage<string>('diagram-filename', 'Diagrama sem título');

  // SeleÃ§Ã£o
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [selectedTexts, setSelectedTexts] = useState<Set<string>>(new Set());
  const [selectedGroupBoxes, setSelectedGroupBoxes] = useState<Set<string>>(new Set());

  // InteraÃ§Ãµes (drag / pan / connect)
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [connectionType, setConnectionType] = useState<ConnectionType>('normal');
  const [connectionRouteStyle, setConnectionRouteStyle] = useState<ConnectionRouteStyle>('bezier');
  const [connectionColor, setConnectionColor] = useState<string>('#2563eb');

  // UI
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isMiddleZooming, setIsMiddleZooming] = useState(false);
  const [isCanvasMoveActive, setIsCanvasMoveActive] = useState(false);

  const [showNewFileDialog, setShowNewFileDialog] = useState(false);



  // Refs DOM
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const suppressCardClickRef = useRef(false);
  const hasInitializedViewportRef = useRef(false);
  const spacePanPressedRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const snapToGridRef = useRef(snapToGrid);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

  // History
  const { canUndo, canRedo, pushState, undo, redo } = useHistory({ cards, connections, texts, groupBoxes });

  // Map para performance (evita find O(nÂ²) em conexÃµes)
  const cardMap = useMemo(() => {
    const m = new Map<string, CardType>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  const {
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    dragEnd,
    setDragEnd,
    isConnecting,
    connectionStart,
    tempConnectionEnd,
    setTempConnectionEnd,
    findCardAtPosition,
    getSelectionBox,
    isCardInSelection,
    isBoxInSelection,
    isConnectionInSelection,
    cancelConnection,
    handleConnectionStart,
  } = useDiagramCanvasSelection({
    cards,
    texts,
    groupBoxes,
    connections,
    cardMap,
  });

  useEffect(() => {
    dragStartRef.current = dragStart;
  }, [dragStart]);

  const {
    scale,
    setScale,
    scaleRef,
    offset,
    setOffset,
    offsetRef,
    getViewportCenterWorld,
    applyViewportTransform,
    fitSceneToViewport,
    handleZoomReset,
  } = useDiagramViewport({
    containerRef,
    cards,
    texts,
    groupBoxes,
    connections,
    cardMap,
    zoomMin: ZOOM_MIN,
    viewportMargin: VIEWPORT_MARGIN,
    proxyTextStyle: DEFAULT_CARD_TEXT_STYLE,
  });

  // Helper: salva snapshot atual no histÃ³rico
  const getDiagramState = useCallback(
    (overrides: Partial<DiagramState> = {}): DiagramState => ({
      cards,
      connections,
      texts,
      groupBoxes,
      ...overrides,
    }),
    [cards, connections, texts, groupBoxes]
  );

  const saveToHistory = useCallback((state: DiagramState = getDiagramState()) => {
    pushState(state);
  }, [getDiagramState, pushState]);

  const applyDiagramState = useCallback((state: DiagramState) => {
    setCards(state.cards);
    setConnections(state.connections);
    setTexts(state.texts ?? []);
    setGroupBoxes(state.groupBoxes ?? []);
  }, [setCards, setConnections, setTexts, setGroupBoxes]);

  const createCardAtPosition = useCallback((
    x: number,
    y: number,
    {
      sequence,
      title,
      label,
      accent,
      type = 'default',
      content,
    }: {
      sequence: number;
      title?: string;
      label?: string;
      accent?: string;
      type?: CardTypeEnum;
      content?: string;
    }
  ): CardType => {
    const preset = getCardPreset(type, sequence);

    return {
      id: Date.now().toString(),
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      layer: DEFAULT_CARD_LAYER,
      sequence,
      title: title ?? preset.title,
      content: content ?? preset.content,
      summary: '',
      tags: [],
      label: label ?? preset.label,
      date: new Date().toLocaleDateString('pt-BR'),
      source: '',
      accent: accent ?? preset.accent,
      textStyle: DEFAULT_CARD_TEXT_STYLE,
      type,
    };
  }, []);

  const createCenteredCard = useCallback((
    {
      sequence,
      title,
      label,
      accent,
      scale = scaleRef.current,
      offset = offsetRef.current,
      type = 'default',
    }: {
      sequence: number;
      title: string;
      label: string;
      accent: string;
      scale?: number;
      offset?: Point;
      type?: CardTypeEnum;
    }
  ) => {
    const center = getViewportCenterWorld(scale, offset);

    return createCardAtPosition(center.x - CARD_WIDTH / 2, center.y - CARD_HEIGHT / 2, {
      sequence,
      title,
      label,
      accent,
      type,
    });
  }, [createCardAtPosition, getViewportCenterWorld, offsetRef, scaleRef]);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = diagramRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const worldX = (clientX - rect.left - offsetRef.current.x) / scaleRef.current;
      const worldY = (clientY - rect.top - offsetRef.current.y) / scaleRef.current;
      return { x: worldX, y: worldY };
    },
    [offsetRef, scaleRef]
  );

  const {
    getExpandedSelectionIds,
    propertiesSelection,
    applyLayerChangeFromPanel,
    groupSelectedElements,
    ungroupSelectedElements,
    alignSelectedElements,
    distributeSelectedElements,
  } = useDiagramArrangement({
    cards,
    texts,
    groupBoxes,
    connections,
    selectedCards,
    selectedTexts,
    selectedGroupBoxes,
    selectedConnections,
    snapToGrid,
    gridSize: GRID_SIZE,
    defaultConnectionLayer: DEFAULT_CONNECTION_LAYER,
    defaultCardLayer: DEFAULT_CARD_LAYER,
    defaultGroupLayer: DEFAULT_GROUP_LAYER,
    layerStep: LAYER_STEP,
    getCardLayer,
    getTextLayer,
    getGroupLayer,
    createUniqueId,
    getDiagramState,
    saveToHistory,
    setCards,
    setTexts,
    setGroupBoxes,
  });

  const {
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
  } = useDiagramSelectionTransform({
    cardMap,
    texts,
    groupBoxes,
    gridSize: GRID_SIZE,
    cardMinWidth: CARD_MIN_WIDTH,
    cardMinHeight: CARD_MIN_HEIGHT,
    textMinWidth: TEXT_MIN_WIDTH,
    textMinHeight: TEXT_MIN_HEIGHT,
    groupMinWidth: GROUP_MIN_WIDTH,
    groupMinHeight: GROUP_MIN_HEIGHT,
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
  });

  const {
    editingInlineCard,
    editingInlineCardId,
    inlineDraft,
    setInlineDraft,
    inlineEditorHeight,
    editingTextId,
    editingTextDraft,
    setEditingTextDraft,
    editingGroupBoxId,
    editingGroupDraft,
    setEditingGroupDraft,
    openInlineEditor,
    cancelInlineEditor,
    openTextEditor,
    cancelTextEditor,
    applyTextEditor,
    openGroupEditor,
    cancelGroupEditor,
    applyGroupEditor,
    commitActiveLooseEditors,
    applyInlineEditor,
    openSelectedCardEditor,
  } = useDiagramEditors({
    cards,
    texts,
    groupBoxes,
    selectedCards,
    selectedTexts,
    selectedGroupBoxes,
    cardMap,
    getDiagramState,
    saveToHistory,
    setCards,
    setTexts,
    setGroupBoxes,
    setSelectedCards,
    setSelectedConnections,
    setSelectedTexts,
    setSelectedGroupBoxes,
    inlineEditorRef,
  });

  const {
    showPrintDialog,
    showSaveMenu,
    printOptions,
    setPrintOptions,
    saveMenuRef,
    isPrinting,
    printPreview,
    openPrintDialog,
    closePrintDialog,
    toggleSaveMenu,
    handleSavePng,
    handleSaveSvg,
    handleSavePdf,
    handleConfirmPdf,
    handlePrint,
  } = useDiagramOutput({
    cards,
    connections,
    texts,
    groupBoxes,
    fileName,
    selectedCardIds: selectedCards,
    selectedConnectionIds: selectedConnections,
    selectedTextIds: selectedTexts,
    selectedGroupBoxIds: selectedGroupBoxes,
  });

  const applyTypographySize = useCallback(
    (fontSize: number) => {
      if (selectedCards.size > 0) {
        const nextCards = cards.map((card) =>
          selectedCards.has(card.id)
            ? {
                ...card,
                textStyle: {
                  ...DEFAULT_CARD_TEXT_STYLE,
                  ...card.textStyle,
                  fontSize,
                },
              }
            : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (selectedTexts.size > 0) {
        const nextTexts = texts.map((item) =>
          selectedTexts.has(item.id)
            ? {
                ...item,
                textStyle: {
                  ...item.textStyle,
                  fontSize,
                },
                height: estimateTextHeight(
                  item.text,
                  item.width,
                  fontSize,
                  item.textStyle.lineHeight ?? 1.15
                ),
              }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      if (selectedGroupBoxes.size > 0) {
        const nextGroupBoxes = groupBoxes.map((item) =>
          selectedGroupBoxes.has(item.id)
            ? {
                ...item,
                titleStyle: {
                  ...item.titleStyle,
                  fontSize,
                },
              }
            : item
        );
        setGroupBoxes(nextGroupBoxes);
        saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
      }
    },
    [cards, getDiagramState, groupBoxes, saveToHistory, selectedCards, selectedGroupBoxes, selectedTexts, setCards, setGroupBoxes, setTexts, texts]
  );

  const applyTypographyAlign = useCallback(
    (textAlign: 'left' | 'center' | 'right') => {
      if (selectedCards.size > 0) {
        const nextCards = cards.map((card) =>
          selectedCards.has(card.id)
            ? {
                ...card,
                textStyle: {
                  ...DEFAULT_CARD_TEXT_STYLE,
                  ...card.textStyle,
                  textAlign,
                },
              }
            : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (selectedTexts.size > 0) {
        const nextTexts = texts.map((item) =>
          selectedTexts.has(item.id)
            ? {
                ...item,
                textStyle: {
                  ...item.textStyle,
                  textAlign,
                },
              }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      if (selectedGroupBoxes.size > 0) {
        const nextGroupBoxes = groupBoxes.map((item) =>
          selectedGroupBoxes.has(item.id)
            ? {
                ...item,
                titleStyle: {
                  ...item.titleStyle,
                  textAlign,
                },
              }
            : item
        );
        setGroupBoxes(nextGroupBoxes);
        saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
      }
    },
    [cards, getDiagramState, groupBoxes, saveToHistory, selectedCards, selectedGroupBoxes, selectedTexts, setCards, setGroupBoxes, setTexts, texts]
  );

  const canvasElements = useMemo(() => {
    return [
      ...groupBoxes.map((item) => ({
        kind: 'group' as const,
        id: item.id,
        layer: getGroupLayer(item),
        item,
      })),
      ...cards.map((item) => ({
        kind: 'card' as const,
        id: item.id,
        layer: getCardLayer(item),
        item,
      })),
      ...texts.map((item) => ({
        kind: 'text' as const,
        id: item.id,
        layer: getTextLayer(item),
        item,
      })),
    ].sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id));
  }, [cards, groupBoxes, texts]);

  const backgroundCanvasElements = useMemo(
    () =>
      canvasElements.filter(
        (element) => element.kind === 'group' && element.layer < DEFAULT_CONNECTION_LAYER
      ),
    [canvasElements]
  );

  const foregroundCanvasElements = useMemo(
    () =>
      canvasElements.filter(
        (element) => element.kind !== 'group' || element.layer >= DEFAULT_CONNECTION_LAYER
      ),
    [canvasElements]
  );

  const applyAccentFromPanel = useCallback(
    (value: string) => {
      if (!propertiesSelection) return;

      if (propertiesSelection.kind === 'card') {
        const nextCards = cards.map((card) =>
          card.id === propertiesSelection.item.id ? { ...card, accent: value } : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (propertiesSelection.kind === 'text') {
        const nextTexts = texts.map((item) =>
          item.id === propertiesSelection.item.id ? { ...item, accent: value } : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      if (propertiesSelection.kind === 'group') {
        const nextGroupBoxes = groupBoxes.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, accent: value, background: hexToRgba(value, 0.12) }
            : item
        );
        setGroupBoxes(nextGroupBoxes);
        saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
        return;
      }

      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, color: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [cards, connections, getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setCards, setConnections, setGroupBoxes, setTexts, texts]
  );

  const applyTextColorFromPanel = useCallback(
    (value: string) => {
      if (!propertiesSelection || propertiesSelection.kind === 'connection') return;

      if (propertiesSelection.kind === 'card') {
        const nextCards = cards.map((card) =>
          card.id === propertiesSelection.item.id
            ? { ...card, textStyle: { ...DEFAULT_CARD_TEXT_STYLE, ...card.textStyle, color: value } }
            : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (propertiesSelection.kind === 'text') {
        const nextTexts = texts.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, textStyle: { ...item.textStyle, color: value } }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === propertiesSelection.item.id
          ? { ...item, titleStyle: { ...item.titleStyle, color: value } }
          : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    },
    [cards, getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setCards, setGroupBoxes, setTexts, texts]
  );

  const applyTextRotationFromPanel = useCallback(
    (rotation: -90 | 0 | 90) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'text') return;

      const nextTexts = texts.map((item) =>
        item.id === propertiesSelection.item.id ? { ...item, rotation } : item
      );
      setTexts(nextTexts);
      saveToHistory(getDiagramState({ texts: nextTexts }));
    },
    [getDiagramState, propertiesSelection, saveToHistory, setTexts, texts]
  );

  const applyFontWeightFromPanel = useCallback(
    (value: 400 | 500 | 600 | 700) => {
      if (!propertiesSelection || propertiesSelection.kind === 'connection') return;

      if (propertiesSelection.kind === 'card') {
        const nextCards = cards.map((card) =>
          card.id === propertiesSelection.item.id
            ? { ...card, textStyle: { ...DEFAULT_CARD_TEXT_STYLE, ...card.textStyle, fontWeight: value } }
            : card
        );
        setCards(nextCards);
        saveToHistory(getDiagramState({ cards: nextCards }));
        return;
      }

      if (propertiesSelection.kind === 'text') {
        const nextTexts = texts.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, textStyle: { ...item.textStyle, fontWeight: value } }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === propertiesSelection.item.id
          ? { ...item, titleStyle: { ...item.titleStyle, fontWeight: value } }
          : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    },
    [cards, getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setCards, setGroupBoxes, setTexts, texts]
  );

  const applyBackgroundOpacityFromPanel = useCallback(
    (percent: number) => {
      if (!propertiesSelection) return;
      const alpha = Math.max(0, Math.min(100, percent)) / 100;

      if (propertiesSelection.kind === 'text') {
        const nextTexts = texts.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, background: alpha === 0 ? 'transparent' : hexToRgba(item.accent, alpha) }
            : item
        );
        setTexts(nextTexts);
        saveToHistory(getDiagramState({ texts: nextTexts }));
        return;
      }

      if (propertiesSelection.kind === 'group') {
        const nextGroupBoxes = groupBoxes.map((item) =>
          item.id === propertiesSelection.item.id
            ? { ...item, background: hexToRgba(item.accent, alpha) }
            : item
        );
        setGroupBoxes(nextGroupBoxes);
        saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
      }
    },
    [getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setGroupBoxes, setTexts, texts]
  );

  const applyGroupTitleVisibilityFromPanel = useCallback(
    (showTitle: boolean) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'group') return;

      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === propertiesSelection.item.id ? { ...item, showTitle } : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    },
    [getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setGroupBoxes]
  );

  const applyConnectionLabelFromPanel = useCallback(
    (value: string) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'connection') return;
      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, label: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [connections, getDiagramState, propertiesSelection, saveToHistory, setConnections]
  );

  const applyConnectionTypeFromPanel = useCallback(
    (value: ConnectionType) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'connection') return;
      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, type: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [connections, getDiagramState, propertiesSelection, saveToHistory, setConnections]
  );

  const applyConnectionRouteFromPanel = useCallback(
    (value: ConnectionRouteStyle) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'connection') return;
      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, routeStyle: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [connections, getDiagramState, propertiesSelection, saveToHistory, setConnections]
  );

  const applyConnectionVariantFromPanel = useCallback(
    (value: ConnectionVariant) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'connection') return;
      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, variant: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [connections, getDiagramState, propertiesSelection, saveToHistory, setConnections]
  );

  const applyConnectionStrokeWidthFromPanel = useCallback(
    (value: ConnectionStrokeWidth) => {
      if (!propertiesSelection || propertiesSelection.kind !== 'connection') return;
      const nextConnections = connections.map((connection) =>
        connection.id === propertiesSelection.item.id ? { ...connection, strokeWidth: value } : connection
      );
      setConnections(nextConnections);
      saveToHistory(getDiagramState({ connections: nextConnections }));
    },
    [connections, getDiagramState, propertiesSelection, saveToHistory, setConnections]
  );

  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (!previousState) return;

    applyDiagramState(previousState);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
  }, [applyDiagramState, undo]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (!nextState) return;

    applyDiagramState(nextState);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
  }, [applyDiagramState, redo]);

  // Inicial: centraliza viewport ou cria card inicial
  useEffect(() => {
    if (hasInitializedViewportRef.current || !containerRef.current) return;

    if (cards.length === 0 && texts.length === 0 && groupBoxes.length === 0) {
      const baseScale = 1;
      const baseOffset = { x: 0, y: 0 };
      applyViewportTransform(baseScale, baseOffset);

      const initialCard = createCenteredCard({
        sequence: 1,
        title: 'Evento 1',
        label: 'INÍCIO',
        accent: '#19B7C6',
        scale: baseScale,
        offset: baseOffset,
      });

      pushState({ cards: [initialCard], connections: [], texts: [], groupBoxes: [] });
      setCards([initialCard]);
      setConnections([]);
      setTexts([]);
      setGroupBoxes([]);
      hasInitializedViewportRef.current = true;
      return;
    }

    fitSceneToViewport();
    hasInitializedViewportRef.current = true;
  }, [
    applyViewportTransform,
    cards,
    createCenteredCard,
    fitSceneToViewport,
    groupBoxes.length,
    pushState,
    setCards,
    setConnections,
    setGroupBoxes,
    setTexts,
    texts.length,
  ]);

  // SequÃªncia
  const getNextSequenceNumber = useCallback((): number => {
    const usedNumbers = cards.map((c) => c.sequence).sort((a, b) => a - b);
    for (let i = 1; i <= usedNumbers.length; i++) {
      if (usedNumbers[i - 1] !== i) return i;
    }
    return usedNumbers.length + 1;
  }, [cards]);

  const addCard = useCallback(
    (type: CardTypeEnum = 'default') => {
      const viewportCenter = getViewportCenterWorld();

      const nextSequence = getNextSequenceNumber();
      const preset = getCardPreset(type, nextSequence);

      const newCard: CardType = {
        id: Date.now().toString(),
        x: viewportCenter.x - 160,
        y: viewportCenter.y - 110,
        width: 320,
        height: 220,

        sequence: nextSequence,
        title: preset.title,

        content: preset.content,
        summary: '',
        tags: [],
        label: preset.label,
        date: new Date().toLocaleDateString('pt-BR'),
        source: '',
        accent: type === 'default' ? getRandomColor() : preset.accent,

        type,
      };

      const nextState = getDiagramState({ cards: [...cards, newCard] });
      setCards(nextState.cards);
      saveToHistory(nextState);
    },
    [cards, getDiagramState, getNextSequenceNumber, getViewportCenterWorld, saveToHistory, setCards]
  );

  const addText = useCallback(() => {
    const viewportCenter = getViewportCenterWorld();

    const newText: DiagramText = {
      id: `text-${Date.now()}`,
      x: viewportCenter.x - 170,
      y: viewportCenter.y - 32,
      width: 340,
      height: 64,
      layer: DEFAULT_TEXT_LAYER,
      text: 'Título ou observação',
      accent: '#111827',
      background: 'transparent',
      rotation: 0,
      textStyle: DEFAULT_TEXT_STYLE,
    };

    const nextTexts = [...texts, newText];
    setTexts(nextTexts);
    setSelectedTexts(new Set([newText.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedGroupBoxes(new Set());
    saveToHistory(getDiagramState({ texts: nextTexts }));
  }, [getDiagramState, getViewportCenterWorld, saveToHistory, setTexts, texts]);

  const addGroupBox = useCallback(() => {
    const viewportCenter = getViewportCenterWorld();

    const accent = '#94A3B8';
    const newGroup: GroupBoxType = {
      id: `group-${Date.now()}`,
      x: viewportCenter.x - 220,
      y: viewportCenter.y - 160,
      width: 440,
      height: 320,
      layer: DEFAULT_GROUP_LAYER,
      title: 'Classe de eventos',
      showTitle: true,
      accent,
      background: 'rgba(148,163,184,0.12)',
      titleStyle: DEFAULT_GROUP_TITLE_STYLE,
    };

    const nextGroupBoxes = [...groupBoxes, newGroup];
    setGroupBoxes(nextGroupBoxes);
    setSelectedGroupBoxes(new Set([newGroup.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
  }, [getDiagramState, getViewportCenterWorld, groupBoxes, saveToHistory, setGroupBoxes]);

  const createConnection = useCallback(
    (
      fromId: string,
      toId: string,
      type: ConnectionType = 'normal',
      color: string = '#2563eb',
      preferredFromSide?: ConnectionSide,
      preferredToSide?: ConnectionSide,
      routeStyle: ConnectionRouteStyle = connectionRouteStyle
    ) => {
      const fromCard = cardMap.get(fromId);
      const toCard = cardMap.get(toId);
      if (!fromCard || !toCard) return;

      const { fromSide, toSide } = resolveConnectionSides(
        fromCard,
        toCard,
        {
          fromSide: preferredFromSide,
          toSide: preferredToSide,
        },
        routeStyle
      );

      const newConnection: Connection = {
        id: `${fromId}-${toId}-${Date.now()}`,
        fromCard: fromId,
        toCard: toId,
        type,
        routeStyle,
        variant: 'default',
        strokeWidth: 'medium',
        color,
        fromSide,
        toSide,
      };

      const nextState = getDiagramState({ connections: [...connections, newConnection] });
      setConnections(nextState.connections);
      saveToHistory(nextState);
    },
    [cardMap, connectionRouteStyle, connections, getDiagramState, saveToHistory, setConnections]
  );

  const deleteSelected = useCallback(() => {
    if (
      selectedCards.size === 0 &&
      selectedConnections.size === 0 &&
      selectedTexts.size === 0 &&
      selectedGroupBoxes.size === 0
    ) {
      return;
    }
    const nextState = getDiagramState({
      cards: cards.filter((card) => !selectedCards.has(card.id)),
      connections: connections.filter(
        (conn) =>
          !selectedConnections.has(conn.id) &&
          !selectedCards.has(conn.fromCard) &&
          !selectedCards.has(conn.toCard)
      ),
      texts: texts.filter((text) => !selectedTexts.has(text.id)),
      groupBoxes: groupBoxes.filter((groupBox) => !selectedGroupBoxes.has(groupBox.id)),
    });

    setCards(nextState.cards);
    setConnections(nextState.connections);
    setTexts(nextState.texts);
    setGroupBoxes(nextState.groupBoxes);
    saveToHistory(nextState);
    cancelInlineEditor();

    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
    cancelTextEditor();
    cancelGroupEditor();
  }, [cancelGroupEditor, cancelInlineEditor, cancelTextEditor, cards, connections, getDiagramState, groupBoxes, saveToHistory, selectedCards, selectedConnections, selectedGroupBoxes, selectedTexts, setCards, setConnections, setGroupBoxes, setTexts, texts]);

  const duplicateSelection = useCallback(() => {
    if (
      selectedCards.size === 0 &&
      selectedTexts.size === 0 &&
      selectedGroupBoxes.size === 0
    ) {
      return;
    }

    cancelInlineEditor();
    cancelTextEditor();
    cancelGroupEditor();

    const selectedCardItems = cards.filter((card) => selectedCards.has(card.id));
    const selectedTextItems = texts.filter((item) => selectedTexts.has(item.id));
    const selectedGroupItems = groupBoxes.filter((item) => selectedGroupBoxes.has(item.id));

    const selectedBounds = [
      ...selectedCardItems.map((item) => ({ x: item.x, y: item.y })),
      ...selectedTextItems.map((item) => ({ x: item.x, y: item.y })),
      ...selectedGroupItems.map((item) => ({ x: item.x, y: item.y })),
    ];

    if (selectedBounds.length === 0) return;

    const cardIdMap = new Map<string, string>();
    const duplicatedCards = selectedCardItems
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((card) => {
        const id = createUniqueId();
        cardIdMap.set(card.id, id);
        return {
          ...card,
          id,
          groupId: card.groupId,
          x: card.x + DUPLICATE_OFFSET,
          y: card.y + DUPLICATE_OFFSET,
          sequence: card.sequence,
        };
      });

    const duplicatedTexts = selectedTextItems.map((item) => ({
      ...item,
      id: createUniqueId(),
      groupId: item.groupId,
      x: item.x + DUPLICATE_OFFSET,
      y: item.y + DUPLICATE_OFFSET,
    }));

    const duplicatedGroupBoxes = selectedGroupItems.map((item) => ({
      ...item,
      id: createUniqueId(),
      groupId: item.groupId,
      x: item.x + DUPLICATE_OFFSET,
      y: item.y + DUPLICATE_OFFSET,
    }));

    const duplicatedConnections = connections
      .filter(
        (connection) =>
          selectedCards.has(connection.fromCard) &&
          selectedCards.has(connection.toCard)
      )
      .map((connection) => ({
        ...connection,
        id: createUniqueId(),
        fromCard: cardIdMap.get(connection.fromCard) ?? connection.fromCard,
        toCard: cardIdMap.get(connection.toCard) ?? connection.toCard,
      }));

    const nextState = getDiagramState({
      cards: [...cards, ...duplicatedCards],
      connections: [...connections, ...duplicatedConnections],
      texts: [...texts, ...duplicatedTexts],
      groupBoxes: [...groupBoxes, ...duplicatedGroupBoxes],
    });

    setCards(nextState.cards);
    setConnections(nextState.connections);
    setTexts(nextState.texts);
    setGroupBoxes(nextState.groupBoxes);
    saveToHistory(nextState);

    setSelectedCards(new Set(duplicatedCards.map((item) => item.id)));
    setSelectedConnections(new Set(duplicatedConnections.map((item) => item.id)));
    setSelectedTexts(new Set(duplicatedTexts.map((item) => item.id)));
    setSelectedGroupBoxes(new Set(duplicatedGroupBoxes.map((item) => item.id)));
  }, [
    cancelGroupEditor,
    cancelInlineEditor,
    cancelTextEditor,
    cards,
    connections,
    getDiagramState,
    groupBoxes,
    saveToHistory,
    selectedCards,
    selectedGroupBoxes,
    selectedTexts,
    setCards,
    setConnections,
    setGroupBoxes,
    setTexts,
    texts,
  ]);

  const updateConnection = useCallback((connectionId: string, updates: Partial<Connection>) => {
    const nextConnections = connections.map((connection) =>
      connection.id === connectionId ? { ...connection, ...updates } : connection
    );
    setConnections(nextConnections);
    saveToHistory(getDiagramState({ connections: nextConnections }));
  }, [connections, getDiagramState, saveToHistory, setConnections]);

  const invertConnection = useCallback((connectionId: string) => {
    const current = connections.find((connection) => connection.id === connectionId);
    if (!current) return;

    const fromCard = cardMap.get(current.toCard);
    const toCard = cardMap.get(current.fromCard);
    if (!fromCard || !toCard) return;

    const swappedSides = resolveConnectionSides(fromCard, toCard, {}, current.routeStyle ?? 'bezier');
    const nextConnections = connections.map((connection) =>
      connection.id === connectionId
        ? {
            ...connection,
            fromCard: current.toCard,
            toCard: current.fromCard,
            fromSide: swappedSides.fromSide,
            toSide: swappedSides.toSide,
          }
        : connection
    );

    setConnections(nextConnections);
    saveToHistory(getDiagramState({ connections: nextConnections }));
  }, [cardMap, connections, getDiagramState, saveToHistory, setConnections]);

  // Novo arquivo
  const confirmNewFile = useCallback(() => {
    cancelInlineEditor();
    const baseScale = 1;
    const baseOffset = { x: 0, y: 0 };
    applyViewportTransform(baseScale, baseOffset);

    const initialCard = createCenteredCard({
      sequence: 1,
      title: 'Evento 1',
      label: 'INÍCIO',
      accent: '#19B7C6',
      scale: baseScale,
      offset: baseOffset,
    });

    const nextState = { cards: [initialCard], connections: [], texts: [], groupBoxes: [] };

    pushState(nextState);
    setCards(nextState.cards);
    setConnections(nextState.connections);
    setTexts(nextState.texts);
    setGroupBoxes(nextState.groupBoxes);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
    setFileName('Diagrama sem título');
    setShowNewFileDialog(false);
    hasInitializedViewportRef.current = true;
  }, [applyViewportTransform, cancelInlineEditor, createCenteredCard, pushState, setCards, setConnections, setFileName, setGroupBoxes, setTexts]);

  const handleNewFile = useCallback(() => {
    setShowNewFileDialog(true);
  }, []);

  const handleFitView = useCallback(() => {
    fitSceneToViewport();
  }, [fitSceneToViewport]);
  useDiagramKeyboardShortcuts({
    cards,
    connections,
    texts,
    groupBoxes,
    cancelConnection,
    deleteSelected,
    duplicateSelection,
    groupSelectedElements,
    handleFitView,
    handleNewFile,
    handleRedo,
    handleUndo,
    isConnecting,
    openPrintDialog,
    setSelectedCards,
    setSelectedConnections,
    setSelectedTexts,
    setSelectedGroupBoxes,
    spacePanPressedRef,
    ungroupSelectedElements,
  });

  // Wheel zoom (um Ãºnico handler nativo) â€” evita recriar listener e bloqueia scroll do browser
  useEffect(() => {
    const el = diagramRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;

      // vamos â€œtravarâ€ o ponto do mouse
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevScale = scaleRef.current;
      const prevOffset = offsetRef.current;

        const newScale = clamp(prevScale + delta, ZOOM_MIN, ZOOM_MAX);

      const worldX = (mouseX - prevOffset.x) / prevScale;
      const worldY = (mouseY - prevOffset.y) / prevScale;

      const newOffsetX = mouseX - worldX * newScale;
      const newOffsetY = mouseY - worldY * newScale;

      // atualiza state
      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, [offsetRef, scaleRef, setOffset, setScale]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      // BotÃ£o do meio -> zoom drag
      if (e.button === 1) {
        e.preventDefault();
        setIsMiddleZooming(true);
        return;
      }

      // ALT/Space/ferramenta ativa + clique esquerdo -> pan
      if (e.button === 0 && (e.altKey || spacePanPressedRef.current || isCanvasMoveActive)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
        return;
      }

      const target = e.target as HTMLElement;

      // se clicou em card/conexÃ£o/ponto, nÃ£o inicia selection box
      if (target.closest('.card')) return;
      if (target.closest('.connection-point')) return;
      if (target.closest('.connection-line')) return;
      if (target.closest('[data-diagram-text]')) return;
      if (target.closest('[data-group-box]')) return;
      if (target.closest('[data-inline-card-editor]')) return;

      cancelInlineEditor();
      commitActiveLooseEditors();

      if (!e.ctrlKey && !e.metaKey) {
        setSelectedCards(new Set());
        setSelectedConnections(new Set());
        setSelectedTexts(new Set());
        setSelectedGroupBoxes(new Set());
      }

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      setIsDragging(true);
      setDragStart(world);
      setDragEnd(world);
    },
    [cancelInlineEditor, commitActiveLooseEditors, isCanvasMoveActive, offsetRef, screenToWorld, setDragEnd, setDragStart, setIsDragging]
  );


  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      if (isMiddleZooming) {
        const zoomIntensity = 0.005;
        const delta = -e.movementY * zoomIntensity;

        // mesmo esquema: mouse fixo
        const el = diagramRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const prevScale = scaleRef.current;
        const prevOffset = offsetRef.current;

        const newScale = clamp(prevScale + delta, ZOOM_MIN, ZOOM_MAX);

        const worldX = (mouseX - prevOffset.x) / prevScale;
        const worldY = (mouseY - prevOffset.y) / prevScale;

        const newOffsetX = mouseX - worldX * newScale;
        const newOffsetY = mouseY - worldY * newScale;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
        return;
      }

      if (isPanning) {
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      if (isDraggingCard || isDraggingText || isDraggingGroupBox) {
        if (isDraggingCard) {
          scheduleDraggedCards(world.x, world.y);
        }
        if (isDraggingText) {
          moveDraggedTexts(world.x, world.y);
        }
        if (isDraggingGroupBox) {
          moveDraggedGroupBoxes(world.x, world.y);
        }
        return;
      }

      if (isResizingCard) {
        resizeCard(world.x, world.y);
        return;
      }

      if (isResizingText) {
        resizeBox(
          textResizeSession,
          TEXT_MIN_WIDTH,
          TEXT_MIN_HEIGHT,
          (nextX, nextY, nextWidth, nextHeight, id) => {
            setTexts((prev) =>
              prev.map((item) => (item.id === id ? { ...item, x: nextX, y: nextY, width: nextWidth, height: nextHeight } : item))
            );
          },
          world.x,
          world.y
        );
        return;
      }

      if (isResizingGroupBox) {
        resizeBox(
          groupResizeSession,
          GROUP_MIN_WIDTH,
          GROUP_MIN_HEIGHT,
          (nextX, nextY, nextWidth, nextHeight, id) => {
            setGroupBoxes((prev) =>
              prev.map((item) => (item.id === id ? { ...item, x: nextX, y: nextY, width: nextWidth, height: nextHeight } : item))
            );
          },
          world.x,
          world.y
        );
        return;
      }

      if (isConnecting) {
        setTempConnectionEnd({ x: world.x, y: world.y });
        return;
      }

      if (isDragging) {
        setDragEnd({ x: world.x, y: world.y });
      }
    },
    [
      isDragging,
      isDraggingCard,
      isDraggingGroupBox,
      isDraggingText,
      isResizingCard,
      isResizingGroupBox,
      isResizingText,
      isConnecting,
      isMiddleZooming,
      isPanning,
      groupResizeSession,
      moveDraggedGroupBoxes,
      moveDraggedTexts,
      offsetRef,
      scaleRef,
      scheduleDraggedCards,
      panStart.x,
      panStart.y,
      resizeBox,
      resizeCard,
      screenToWorld,
      setGroupBoxes,
      setOffset,
      setScale,
      setTexts,
      setDragEnd,
      textResizeSession,
      setTempConnectionEnd,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      const world = screenToWorld(e.clientX, e.clientY);

      if (isMiddleZooming) {
        setIsMiddleZooming(false);
        return;
      }

      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (isDraggingCard || isDraggingText || isDraggingGroupBox) {
        flushDraggedCards();
        if (didDragCardsRef.current) {
          suppressCardClickRef.current = true;
          saveToHistory();
        }
        resetDragState();
        return;
      }

      if (isResizingCard) {
        setIsResizingCard(false);
        setResizeSession(null);
        saveToHistory();
        return;
      }

      if (isResizingText) {
        setIsResizingText(false);
        setTextResizeSession(null);
        saveToHistory();
        return;
      }

      if (isResizingGroupBox) {
        setIsResizingGroupBox(false);
        setGroupResizeSession(null);
        saveToHistory();
        return;
      }

        if (isConnecting && connectionStart && world) {
      const target = e.target as HTMLElement;
      const targetPoint = target.closest<HTMLElement>('[data-connection-side]');
      const targetCardId = targetPoint?.dataset.cardId;
      const targetSide = targetPoint?.dataset.connectionSide as ConnectionSide | undefined;
      const targetCard =
        targetCardId ? cardMap.get(targetCardId) ?? null : findCardAtPosition(world.x, world.y);

      if (targetCard && targetCard.id !== connectionStart.cardId) {
        createConnection(
          connectionStart.cardId,
          targetCard.id,
          connectionType,
          connectionColor,
          connectionStart.side,
          targetSide,
          connectionRouteStyle
        );
      }
          cancelConnection();
          return;
      }

      if (isDragging && world) {
        const selectionBox = getSelectionBox();
        const newlySelectedCards = new Set<string>();
        const newlySelectedConnections = new Set<string>();
        const newlySelectedTexts = new Set<string>();
        const newlySelectedGroupBoxes = new Set<string>();

        for (const card of cards) {
          if (isCardInSelection(card, selectionBox)) newlySelectedCards.add(card.id);
        }

        for (const item of texts) {
          if (isBoxInSelection(item, selectionBox)) newlySelectedTexts.add(item.id);
        }

        for (const item of groupBoxes) {
          if (isBoxInSelection(item, selectionBox)) newlySelectedGroupBoxes.add(item.id);
        }

        for (const connection of connections) {
          if (isConnectionInSelection(connection, selectionBox)) {
            newlySelectedConnections.add(connection.id);
          }
        }

        if (!e.shiftKey) {
          setSelectedCards(newlySelectedCards);
          setSelectedConnections(newlySelectedConnections);
          setSelectedTexts(newlySelectedTexts);
          setSelectedGroupBoxes(newlySelectedGroupBoxes);
        } else {
          setSelectedCards((prev) => {
            const updated = new Set(prev);
            newlySelectedCards.forEach((id) => updated.add(id));
            return updated;
          });
          setSelectedConnections((prev) => {
            const updated = new Set(prev);
            newlySelectedConnections.forEach((id) => updated.add(id));
            return updated;
          });
          setSelectedTexts((prev) => {
            const updated = new Set(prev);
            newlySelectedTexts.forEach((id) => updated.add(id));
            return updated;
          });
          setSelectedGroupBoxes((prev) => {
            const updated = new Set(prev);
            newlySelectedGroupBoxes.forEach((id) => updated.add(id));
            return updated;
          });
        }

        setIsDragging(false);
      }
    },
    [
      cancelConnection,
      cardMap,
      cards,
      connectionColor,
      connectionRouteStyle,
      connectionStart,
      connectionType,
      createConnection,
      connections,
      groupBoxes,
      findCardAtPosition,
      getSelectionBox,
      isBoxInSelection,
      isCardInSelection,
      isConnectionInSelection,
      isConnecting,
      isDragging,
      isDraggingCard,
      isDraggingGroupBox,
      isDraggingText,
      isResizingCard,
      isResizingGroupBox,
      isResizingText,
      isMiddleZooming,
      isPanning,
      didDragCardsRef,
      flushDraggedCards,
      resetDragState,
      saveToHistory,
      screenToWorld,
      setIsDragging,
      setGroupResizeSession,
      setIsResizingCard,
      setIsResizingGroupBox,
      setIsResizingText,
      setResizeSession,
      setTextResizeSession,
      texts,
    ]
  );

  // Grid visual
  const gridStyle = useMemo(() => {
    return {
      backgroundColor: '#f9fafb',
      backgroundImage: showGrid
        ? `
          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
        `
        : 'none',
      backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
      backgroundPosition: '0 0',
    } as React.CSSProperties;
  }, [showGrid]);

  const inlineEditorPosition = useMemo(() => {
    if (!editingInlineCard || !diagramRef.current) return null;

    const panelWidth = 340;
    const gap = 18;
    const bounds = diagramRef.current.getBoundingClientRect();
    const cardLeft = editingInlineCard.x * scale + offset.x;
    const cardTop = editingInlineCard.y * scale + offset.y;
    const cardRight = cardLeft + editingInlineCard.width * scale;
    const cardBottom = cardTop + editingInlineCard.height * scale;

    const fitsRight = cardRight + gap + panelWidth <= bounds.width - 16;
    const fitsLeft = cardLeft - gap - panelWidth >= 16;

    const left = fitsRight
      ? cardRight + gap
      : fitsLeft
      ? cardLeft - panelWidth - gap
      : Math.max(16, Math.min(cardLeft, bounds.width - panelWidth - 16));

    const cardCenterY = cardTop + (cardBottom - cardTop) / 2;
    const top = Math.max(
      16,
      Math.min(cardCenterY - inlineEditorHeight / 2, bounds.height - inlineEditorHeight - 16)
    );
    const anchorY = Math.max(24, Math.min(cardCenterY, bounds.height - 24));

    return {
      left,
      top,
      anchorY,
      align: fitsRight || !fitsLeft ? 'right' : 'left',
    } as const;
  }, [editingInlineCard, inlineEditorHeight, offset.x, offset.y, scale]);

  const handleInlineEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        applyInlineEditor();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelInlineEditor();
      }
    },
    [applyInlineEditor, cancelInlineEditor]
  );

  return (
    <div className="relative flex h-screen flex-col bg-gray-100" ref={containerRef}>
      <FloatingToolbar
        onAddCard={addCard}
        onAddText={addText}
        onAddGroupBox={addGroupBox}
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        connectionRouteStyle={connectionRouteStyle}
        onConnectionRouteStyleChange={setConnectionRouteStyle}
        cardColor={
          selectedCards.size >= 1
            ? cardMap.get(Array.from(selectedCards)[0])?.accent || '#2563EB'
            : selectedCards.size === 0 && selectedConnections.size >= 1
            ? connections.find((connection) => connection.id === Array.from(selectedConnections)[0])?.color || '#2563EB'
            : '#2563EB'
        }
        onCardColorChange={(color) => {
          const hasCardSelection = selectedCards.size > 0;
          const hasTextSelection = selectedTexts.size > 0;
          const hasGroupSelection = selectedGroupBoxes.size > 0;
          const hasConnectionSelection = selectedConnections.size > 0;

          if (!hasCardSelection && !hasTextSelection && !hasGroupSelection && !hasConnectionSelection) {
            return;
          }

          const nextCards = hasCardSelection
            ? cards.map((card) =>
                selectedCards.has(card.id) ? { ...card, accent: color } : card
              )
            : cards;

          const nextTexts = hasTextSelection
            ? texts.map((item) =>
                selectedTexts.has(item.id) ? { ...item, accent: color } : item
              )
            : texts;

          const nextGroupBoxes = hasGroupSelection
            ? groupBoxes.map((item) =>
                selectedGroupBoxes.has(item.id)
                  ? { ...item, accent: color, background: `${color}1F` }
                  : item
              )
            : groupBoxes;

          const nextConnections = hasConnectionSelection
            ? connections.map((connection) =>
                selectedConnections.has(connection.id) ? { ...connection, color } : connection
              )
            : connections;

          setCards(nextCards);
          setTexts(nextTexts);
          setGroupBoxes(nextGroupBoxes);
          setConnections(nextConnections);
          saveToHistory(
            getDiagramState({
              cards: nextCards,
              texts: nextTexts,
              groupBoxes: nextGroupBoxes,
              connections: nextConnections,
            })
          );
        }}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        scale={scale}
        onZoomIn={() => setScale((s) => clamp(s + 0.1, ZOOM_MIN, ZOOM_MAX))}
        onZoomOut={() => setScale((s) => clamp(s - 0.1, ZOOM_MIN, ZOOM_MAX))}
        onZoomReset={handleZoomReset}
        onFitView={handleFitView}
        isCanvasMoveActive={isCanvasMoveActive}
        onToggleCanvasMove={() => setIsCanvasMoveActive((value) => !value)}
      />

      <PropertiesPanel
        selection={propertiesSelection}
        onClose={() => {
          setSelectedCards(new Set());
          setSelectedConnections(new Set());
          setSelectedTexts(new Set());
          setSelectedGroupBoxes(new Set());
        }}
        onAccentChange={applyAccentFromPanel}
        onTextColorChange={applyTextColorFromPanel}
        onFontSizeChange={applyTypographySize}
        onFontWeightChange={applyFontWeightFromPanel}
        onTextAlignChange={applyTypographyAlign}
        onTextRotationChange={applyTextRotationFromPanel}
        onBackgroundOpacityChange={applyBackgroundOpacityFromPanel}
        onGroupTitleVisibilityChange={applyGroupTitleVisibilityFromPanel}
        onConnectionLabelChange={applyConnectionLabelFromPanel}
        onConnectionTypeChange={applyConnectionTypeFromPanel}
        onConnectionRouteStyleChange={applyConnectionRouteFromPanel}
        onConnectionVariantChange={applyConnectionVariantFromPanel}
        onConnectionStrokeWidthChange={applyConnectionStrokeWidthFromPanel}
        onLayerChange={applyLayerChangeFromPanel}
        onAlign={alignSelectedElements}
        onDistribute={distributeSelectedElements}
      />

      {/* Ãrea do diagrama */}
      <div
        ref={diagramRef}
        data-diagram-canvas
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning
            ? 'cursor-grabbing'
            : isCanvasMoveActive
            ? 'cursor-grab'
            : isConnecting
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        style={gridStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsPanning(false);
        if (isResizingCard) {
          setIsResizingCard(false);
          setResizeSession(null);
          saveToHistory();
        }
        if (isDraggingCard) {
          flushDraggedCards();
          if (didDragCardsRef.current) {
            saveToHistory();
          }
          resetDragState();
        }
        cancelConnection();
      }}
      >
      <DiagramHeader
        fileName={fileName}
        onFileNameChange={setFileName}
          showSaveMenu={showSaveMenu}
          saveMenuRef={saveMenuRef}
          onToggleSaveMenu={toggleSaveMenu}
          onNewFile={handleNewFile}
          onSavePng={handleSavePng}
          onSaveSvg={handleSaveSvg}
          onSavePdf={handleSavePdf}
          onPrint={openPrintDialog}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        canEdit={
          selectedCards.size === 1 ||
          selectedTexts.size === 1 ||
          selectedGroupBoxes.size === 1
        }
        onEdit={openSelectedCardEditor}
        canDuplicate={
          selectedCards.size > 0 ||
          selectedTexts.size > 0 ||
          selectedGroupBoxes.size > 0
        }
        onDuplicate={duplicateSelection}
        canGroup={selectedCards.size + selectedTexts.size + selectedGroupBoxes.size >= 2}
        onGroup={groupSelectedElements}
        canUngroup={
          cards.some((card) => selectedCards.has(card.id) && Boolean(card.groupId)) ||
          texts.some((item) => selectedTexts.has(item.id) && Boolean(item.groupId)) ||
          groupBoxes.some((item) => selectedGroupBoxes.has(item.id) && Boolean(item.groupId))
        }
        onUngroup={ungroupSelectedElements}
        canDelete={
          selectedCards.size > 0 ||
          selectedConnections.size > 0 ||
            selectedTexts.size > 0 ||
            selectedGroupBoxes.size > 0
          }
          onDelete={deleteSelected}
          cardsCount={cards.length}
          connectionsCount={connections.length}
        />

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/75 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur">
          Scroll para zoom • Space/Alt + arrastar para mover • Cantos azuis redimensionam
        </div>

        <div
          ref={worldRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            {backgroundCanvasElements.map((element) => {
              if (element.kind !== 'group') return null;
              const item = element.item;
              return (
                <GroupBox
                  key={`group-${item.id}`}
                  item={item}
                  isSelected={selectedGroupBoxes.has(item.id)}
                  isEditing={editingGroupBoxId === item.id}
                  draftValue={editingGroupBoxId === item.id ? editingGroupDraft : item.title}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedGroupBoxes(new Set([item.id]));
                    setSelectedCards(new Set());
                    setSelectedConnections(new Set());
                    setSelectedTexts(new Set());
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    openGroupEditor(item);
                  }}
                  onDragStart={(event) => handleGroupBoxDragStart(item.id, event)}
                  onResizeStart={(direction, event) => handleGroupBoxResizeStart(item.id, direction, event)}
                  onDraftChange={setEditingGroupDraft}
                  onCommit={applyGroupEditor}
                  onCancel={cancelGroupEditor}
                />
              );
            })}
          </div>

          {/* SVG GLOBAL DE CONEXÃ•ES */}
          <svg
            className="absolute inset-0"
            style={{
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <defs>
              <marker
                id="arrow-head"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
              </marker>
              <marker
                id="arrow-head-emphasis"
                viewBox="0 0 14 14"
                refX="12.5"
                refY="7"
                markerWidth="10"
                markerHeight="10"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0 0 L14 7 L0 14 z" fill="context-stroke" />
              </marker>
            </defs>

            {/* ConexÃµes existentes */}
            {connections.map((conn) => {
              const fromCard = cardMap.get(conn.fromCard);
              const toCard = cardMap.get(conn.toCard);
              if (!fromCard || !toCard) return null;

              return (
                <ConnectionLine
                  key={conn.id}
                  fromCard={fromCard}
                  toCard={toCard}
                  connection={conn}
                  isSelected={selectedConnections.has(conn.id)}
                  onClick={(ev?: React.MouseEvent) => {
                    ev?.stopPropagation();

                    if (ev?.ctrlKey || ev?.metaKey) {
                      setSelectedConnections((prev) => {
                        const updated = new Set(prev);
                        updated.has(conn.id) ? updated.delete(conn.id) : updated.add(conn.id);
                        return updated;
                      });
                    } else {
                      setSelectedConnections(new Set([conn.id]));
                      setSelectedCards(new Set());
                      setSelectedTexts(new Set());
                      setSelectedGroupBoxes(new Set());
                    }
                  }}
                  onDoubleClick={(ev?: React.MouseEvent) => {
                    ev?.stopPropagation();
                    setSelectedConnections(new Set([conn.id]));
                    setSelectedCards(new Set());
                    setSelectedTexts(new Set());
                    setSelectedGroupBoxes(new Set());
                  }}
                />
              );
            })}

            {/* Linha temporÃ¡ria ao conectar */}
            {isConnecting && connectionStart && tempConnectionEnd && (() => {
                  const hoveredCard = findCardAtPosition(tempConnectionEnd.x, tempConnectionEnd.y);
                  const previewEnd =
                    hoveredCard && hoveredCard.id !== connectionStart.cardId
                      ? hoveredCard
                      : null;

              const previewGeometry = previewEnd
                ? (() => {
                    const targetSide = getClosestSideForPoint(previewEnd, connectionStart.point);
                    const targetPoint = {
                      x:
                        targetSide === 'left'
                          ? previewEnd.x
                          : targetSide === 'right'
                          ? previewEnd.x + previewEnd.width
                          : previewEnd.x + previewEnd.width / 2,
                      y:
                        targetSide === 'top'
                          ? previewEnd.y
                          : targetSide === 'bottom'
                          ? previewEnd.y + previewEnd.height
                          : previewEnd.y + previewEnd.height / 2,
                    };

                    return getPreviewConnectionGeometry(
                      connectionStart.point,
                      targetPoint,
                      connectionStart.side,
                      connectionRouteStyle
                    );
                  })()
                : getPreviewConnectionGeometry(
                    connectionStart.point,
                    tempConnectionEnd,
                    connectionStart.side,
                    connectionRouteStyle
                  );

              return (
                <path
                  d={previewGeometry.path}
                  fill="none"
                  stroke={connectionColor}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={
                    connectionType === 'dashed' ? '6,4' : connectionType === 'dotted' ? '2,4' : undefined
                  }
                  markerEnd="url(#arrow-head)"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
          </svg>

          <div style={{ position: 'relative', zIndex: 20 }}>
            {foregroundCanvasElements.map((element) => {
              if (element.kind === 'group') {
                const item = element.item;
                return (
                  <GroupBox
                    key={`group-${item.id}`}
                    item={item}
                    isSelected={selectedGroupBoxes.has(item.id)}
                    isEditing={editingGroupBoxId === item.id}
                    draftValue={editingGroupBoxId === item.id ? editingGroupDraft : item.title}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedGroupBoxes(new Set([item.id]));
                      setSelectedCards(new Set());
                      setSelectedConnections(new Set());
                      setSelectedTexts(new Set());
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      openGroupEditor(item);
                    }}
                    onDragStart={(event) => handleGroupBoxDragStart(item.id, event)}
                    onResizeStart={(direction, event) => handleGroupBoxResizeStart(item.id, direction, event)}
                    onDraftChange={setEditingGroupDraft}
                    onCommit={applyGroupEditor}
                    onCancel={cancelGroupEditor}
                  />
                );
              }

              if (element.kind === 'text') {
                const item = element.item;
                return (
                  <CanvasText
                    key={`text-${item.id}`}
                    item={editingTextId === item.id ? { ...item, text: editingTextDraft } : item}
                    isSelected={selectedTexts.has(item.id)}
                    isEditing={editingTextId === item.id}
                    draftValue={editingTextId === item.id ? editingTextDraft : item.text}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedTexts(new Set([item.id]));
                      setSelectedCards(new Set());
                      setSelectedConnections(new Set());
                      setSelectedGroupBoxes(new Set());
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      openTextEditor(item);
                    }}
                    onDragStart={(event) => handleTextDragStart(item.id, event)}
                    onResizeStart={(direction, event) => handleTextResizeStart(item.id, direction, event)}
                    onDraftChange={setEditingTextDraft}
                    onCommit={applyTextEditor}
                    onCancel={cancelTextEditor}
                  />
                );
              }

              const card = element.item;
              return (
                <Card
                  key={`card-${card.id}`}
                  card={card}
                  scale={scale}
                  offset={offset}
                  isSelected={selectedCards.has(card.id)}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();

                    if (suppressCardClickRef.current) {
                      suppressCardClickRef.current = false;
                      return;
                    }

                    if (editingInlineCardId && editingInlineCardId !== card.id) {
                      cancelInlineEditor();
                    }

                    if (e.ctrlKey || e.metaKey) {
                      setSelectedCards((prev) => {
                        const updated = new Set(prev);
                        updated.has(card.id) ? updated.delete(card.id) : updated.add(card.id);
                        return updated;
                      });
                    } else {
                      setSelectedCards(new Set([card.id]));
                      setSelectedConnections(new Set());
                      setSelectedTexts(new Set());
                      setSelectedGroupBoxes(new Set());
                    }
                  }}
                  onDoubleClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    openInlineEditor(card);
                  }}
                  onDragStart={(e: React.MouseEvent) => handleCardDragStart(card.id, e)}
                  onResizeStart={(direction, event) => handleCardResizeStart(card.id, direction, event)}
                  onConnectionStart={(side: ConnectionSide, point: Point) => handleConnectionStart(card.id, side, point)}
                />
              );
            })}
          </div>

          {/* Caixa de seleÃ§Ã£o */}
          {isDragging && (
            <div style={{ position: 'relative', zIndex: 30 }}>
              <SelectionBox start={dragStart} end={dragEnd} />
            </div>
          )}
        </div>

        {editingInlineCard && inlineDraft && inlineEditorPosition && (
          <div
            data-inline-card-editor
            ref={inlineEditorRef}
            className="absolute z-40"
            style={{
              left: inlineEditorPosition.left,
              top: inlineEditorPosition.top,
              width: 340,
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div
              className="relative rounded-[26px] p-4 shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
              style={{
                border: `1px solid ${editingInlineCard.accent}`,
                backgroundColor: `${editingInlineCard.accent}20`,
              }}
            >
              <div
                className="absolute top-1/2 h-[6px] w-5 rounded-full blur-[1px]"
                style={{
                  backgroundColor: `${editingInlineCard.accent}24`,
                  [inlineEditorPosition.align === 'right' ? 'left' : 'right']: -18,
                  transform: `translateY(${inlineEditorPosition.anchorY - inlineEditorPosition.top - 3}px)`,
                }}
              />

              <div
                className="absolute top-1/2 h-px w-4"
                style={{
                  backgroundColor: `${editingInlineCard.accent}99`,
                  [inlineEditorPosition.align === 'right' ? 'left' : 'right']: -16,
                  transform: `translateY(${inlineEditorPosition.anchorY - inlineEditorPosition.top - 1}px)`,
                }}
              />

              <div
                className="absolute h-2.5 w-2.5 rotate-45 rounded-[3px]"
                style={{
                  top: inlineEditorPosition.anchorY - inlineEditorPosition.top - 5,
                  [inlineEditorPosition.align === 'right' ? 'left' : 'right']: -6,
                  border: `1px solid ${editingInlineCard.accent}`,
                  backgroundColor: `${editingInlineCard.accent}20`,
                  boxShadow: `0 0 0 3px ${editingInlineCard.accent}12`,
                }}
              />

              <div className="rounded-[22px] border border-white/70 bg-white/60 p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div
                      className="text-[11px] font-semibold uppercase tracking-[0.26em]"
                      style={{ color: `${editingInlineCard.accent}CC` }}
                    >
                      Edição rápida
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-800">
                      {editingInlineCard.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Ajuste o texto sem alterar o tamanho do card.
                    </div>
                  </div>

                  <button
                    className="h-10 w-10 rounded-xl text-slate-500 transition hover:bg-white/70"
                    onClick={cancelInlineEditor}
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-3 grid-cols-[minmax(0,1fr)_104px]">
                  <input
                    value={inlineDraft.title}
                    onChange={(event) =>
                      setInlineDraft((current) =>
                        current ? { ...current, title: event.target.value } : current
                      )
                    }
                    onKeyDown={handleInlineEditorKeyDown}
                    className="min-w-0 h-11 rounded-2xl border bg-white/68 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:ring-2"
                    style={{ borderColor: `${editingInlineCard.accent}3D` }}
                    placeholder="Título"
                    autoFocus
                  />
                  <input
                    value={inlineDraft.date}
                    onChange={(event) =>
                      setInlineDraft((current) =>
                        current ? { ...current, date: event.target.value } : current
                      )
                    }
                    onKeyDown={handleInlineEditorKeyDown}
                    className="min-w-0 h-11 rounded-2xl border bg-white/68 px-3 text-sm text-slate-600 outline-none transition focus:ring-2"
                    style={{ borderColor: `${editingInlineCard.accent}3D` }}
                    placeholder="Data"
                  />
                </div>

                <textarea
                  value={inlineDraft.content}
                  onChange={(event) =>
                    setInlineDraft((current) =>
                      current ? { ...current, content: event.target.value } : current
                    )
                }
                onKeyDown={handleInlineEditorKeyDown}
                className="mt-3 h-32 w-full resize-none rounded-[22px] border bg-white/60 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:ring-2"
                style={{ borderColor: `${editingInlineCard.accent}3D` }}
                placeholder="Texto interno do card"
              />

                <div className="mt-3 grid gap-3">
                  <input
                    value={inlineDraft.label}
                    onChange={(event) =>
                      setInlineDraft((current) =>
                        current ? { ...current, label: event.target.value } : current
                    )
                  }
                  onKeyDown={handleInlineEditorKeyDown}
                    className="h-11 rounded-2xl border bg-white/68 px-4 text-sm text-slate-600 outline-none transition focus:ring-2"
                    style={{ borderColor: `${editingInlineCard.accent}3D` }}
                    placeholder="Rótulo"
                  />
                  <div className="flex items-center justify-end gap-3">
                    <button
                      className="h-11 rounded-2xl border border-white/80 bg-white/68 px-4 text-sm font-medium text-slate-600 transition hover:bg-white/80"
                      onClick={cancelInlineEditor}
                    >
                      Cancelar
                    </button>
                    <button
                      className="h-11 rounded-2xl border bg-white/72 px-4 text-sm font-medium transition hover:bg-white/88"
                      style={{
                        borderColor: editingInlineCard.accent,
                        color: editingInlineCard.accent,
                      }}
                      onClick={applyInlineEditor}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-500">
                  Dica: use <span className="font-semibold text-slate-600">Ctrl+Enter</span> para aplicar ou <span className="font-semibold text-slate-600">Esc</span> para cancelar.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <PrintDialog
        open={showPrintDialog}
        options={printOptions}
        preview={printPreview}
        onChange={setPrintOptions}
        onClose={closePrintDialog}
        onConfirmPdf={handleConfirmPdf}
        onPrint={handlePrint}
        canSelection={
          selectedCards.size > 0 ||
          selectedTexts.size > 0 ||
          selectedGroupBoxes.size > 0 ||
          selectedConnections.size > 0
        }
        isPrinting={isPrinting}
      />

      {showNewFileDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setShowNewFileDialog(false)}
          />

          <div className="ui-soft-panel relative w-[min(520px,92vw)] rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-700/55">
                  Arquivo
                </div>
                <h2 className="mt-1 text-xl font-semibold text-slate-800">
                  Criar novo arquivo?
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  O diagrama atual será substituído por um novo documento com um card inicial centralizado.
                </p>
              </div>

              <button
                className="ui-hover-surface h-10 w-10 rounded-xl text-slate-500"
                onClick={() => setShowNewFileDialog(false)}
                title="Fechar"
              >
                ×
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <div className="text-sm font-semibold text-slate-700">O que vai acontecer</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                Um novo diagrama será aberto imediatamente. O card inicial será criado no centro da tela e a visualização será reposicionada para começar limpa.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                onClick={() => setShowNewFileDialog(false)}
              >
                Cancelar
              </button>
              <button
                className="ui-active-surface h-11 rounded-xl border border-cyan-200 px-4 text-sm font-medium text-cyan-900"
                onClick={confirmNewFile}
              >
                Criar novo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Diagrama;

