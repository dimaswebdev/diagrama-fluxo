'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PrintDialog, { PrintOptions } from './PrintDialog';
import Card, { type ResizeDirection } from './Card';
import CanvasText from './CanvasText';
import ConnectionLine from './ConnectionLine';
import GroupBox from './GroupBox';
import PropertiesPanel from './PropertiesPanel';
import {
  doesConnectionIntersectSelectionBox,
  getClosestSideForPoint,
  getPreviewConnectionGeometry,
  resolveConnectionSides,
  type ConnectionSide,
} from './connectionRouting';
import SelectionBox from './SelectionBox';
import FloatingToolbar from './FloatingToolbar';
import DiagramHeader from './DiagramHeader';
import { EditCardDialog } from './EditCardDialog';
import ConnectionEditDialog from './ConnectionEditDialog';
import { getCardPreset } from './cardPresets';
import {
  getCenteredViewportTransform,
  getFitViewportTransform,
} from './viewport';

import { useLocalStorage } from '@/hooks/diagrama/useLocalStorage';
import { useDiagramExport } from '@/hooks/diagrama/useDiagramExport';
import { useHistory } from '@/hooks/diagrama/useHistory';
import {
} from 'lucide-react';

import {
  Card as CardType,
  Connection,
  ConnectionStrokeWidth,
  ConnectionRouteStyle,
  DiagramState,
  DiagramText,
  GroupBox as GroupBoxType,
  Point,
  SelectionBox as SelectionBoxType,
  ConnectionType,
  ConnectionVariant,
  CardType as CardTypeEnum,
  GRID_SIZE,
  A4_WIDTH,
  A4_HEIGHT,
} from '@/types/diagrama';

type ConnectionStart = { cardId: string; point: Point; side: ConnectionSide } | null;
type InlineCardDraft = {
  title: string;
  date: string;
  content: string;
  label: string;
};
type EditingTextDraft = string;
type EditingGroupDraft = string;

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

const estimateTextHeight = (
  text: string,
  width: number,
  fontSize: number,
  lineHeight = 1.15
) => {
  const safeWidth = Math.max(TEXT_MIN_WIDTH, width);
  const charsPerLine = Math.max(10, Math.floor((safeWidth - 24) / (fontSize * 0.58)));
  const paragraphs = (text || '').split('\n');
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const safeParagraph = paragraph.trim().length > 0 ? paragraph : ' ';
    lineCount += Math.max(1, Math.ceil(safeParagraph.length / charsPerLine));
  }

  return Math.max(TEXT_MIN_HEIGHT, Math.ceil(lineCount * fontSize * lineHeight + 24));
};

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
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<ConnectionStart>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Point | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>('normal');
  const [connectionRouteStyle, setConnectionRouteStyle] = useState<ConnectionRouteStyle>('bezier');
  const [connectionColor, setConnectionColor] = useState<string>('#2563eb');

  // Mundo virtual (zoom/pan)
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // Drag de cards
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
  const [textResizeSession, setTextResizeSession] = useState<{
    id: string;
    direction: ResizeDirection;
    startMouse: Point;
    startItem: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [isResizingGroupBox, setIsResizingGroupBox] = useState(false);
  const [groupResizeSession, setGroupResizeSession] = useState<{
    id: string;
    direction: ResizeDirection;
    startMouse: Point;
    startItem: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // UI
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isMiddleZooming, setIsMiddleZooming] = useState(false);
  const [isCanvasMoveActive, setIsCanvasMoveActive] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editingInlineCardId, setEditingInlineCardId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<InlineCardDraft | null>(null);
  const [inlineEditorHeight, setInlineEditorHeight] = useState(318);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextDraft, setEditingTextDraft] = useState<EditingTextDraft>('');
  const [editingGroupBoxId, setEditingGroupBoxId] = useState<string | null>(null);
  const [editingGroupDraft, setEditingGroupDraft] = useState<EditingGroupDraft>('');

  //Estado de impressÃ£o
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  const [printOptions, setPrintOptions] = useState<PrintOptions>({
    selectionOnly: false,
    mode: 'fit',
    pagesX: 1,
    pagesY: 1,
    margin: 60,
    exportZoom: 1,
    includeGrid: true,
    includeShadows: true,
    orientation: 'auto', 
  });

  const { isPrinting, printPreview, saveAsSvg, saveAsPng, saveAsPdf, generatePdf, printDocument } = useDiagramExport({
    cards,
    connections,
    texts,
    groupBoxes,
    fileName,
    printOptions,
    selectedCardIds: selectedCards,
  });



  // Refs DOM
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const didDragCardsRef = useRef(false);
  const suppressCardClickRef = useRef(false);
  const hasInitializedViewportRef = useRef(false);
  const spacePanPressedRef = useRef(false);
  const dragStartRef = useRef(dragStart);
  const draggedCardsRef = useRef(draggedCards);
  const draggedTextsRef = useRef(draggedTexts);
  const draggedGroupBoxesRef = useRef(draggedGroupBoxes);
  const snapToGridRef = useRef(snapToGrid);
  const pendingDragWorldRef = useRef<Point | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  // Refs (para listener wheel nÃ£o depender de deps e nÃ£o recriar)
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  useEffect(() => {
    dragStartRef.current = dragStart;
  }, [dragStart]);
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

  useEffect(() => {
    if (!showSaveMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setShowSaveMenu(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showSaveMenu]);

  // History
  const { canUndo, canRedo, pushState, undo, redo } = useHistory({ cards, connections, texts, groupBoxes });

  // Map para performance (evita find O(nÂ²) em conexÃµes)
  const cardMap = useMemo(() => {
    const m = new Map<string, CardType>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

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

  const getViewportCenterWorld = useCallback(
    (nextScale = scaleRef.current, nextOffset = offsetRef.current) => {
      const width = containerRef.current?.clientWidth || window.innerWidth || A4_WIDTH;
      const height = containerRef.current?.clientHeight || window.innerHeight || A4_HEIGHT;

      return {
        x: (-nextOffset.x / nextScale) + width / (2 * nextScale),
        y: (-nextOffset.y / nextScale) + height / (2 * nextScale),
      };
    },
    []
  );

  const getViewportSize = useCallback(() => {
    return {
      width: containerRef.current?.clientWidth || window.innerWidth || A4_WIDTH,
      height: containerRef.current?.clientHeight || window.innerHeight || A4_HEIGHT,
    };
  }, []);

  const getAllElementBounds = useCallback(() => {
    const bounds = [
      ...cards.map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
      ...texts.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
      ...groupBoxes.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ];

    if (!bounds.length) return null;

    const minX = Math.min(...bounds.map((item) => item.x));
    const minY = Math.min(...bounds.map((item) => item.y));
    const maxX = Math.max(...bounds.map((item) => item.x + item.width));
    const maxY = Math.max(...bounds.map((item) => item.y + item.height));

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [cards, groupBoxes, texts]);

  const applyViewportTransform = useCallback((nextScale: number, nextOffset: Point) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }, []);

  const centerCardInViewport = useCallback((card: CardType, targetScale = 1) => {
    const transform = getCenteredViewportTransform(card, getViewportSize(), targetScale);
    applyViewportTransform(transform.scale, transform.offset);
  }, [applyViewportTransform, getViewportSize]);

  const fitCardsToViewport = useCallback((items: CardType[]) => {
    const allBounds = getAllElementBounds();
    if (!allBounds && items.length === 0) return;

    if (items.length === 1 && texts.length === 0 && groupBoxes.length === 0) {
      centerCardInViewport(items[0], 1);
      return;
    }

    const cardsForFit = allBounds
      ? [{
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
          textStyle: DEFAULT_CARD_TEXT_STYLE,
          type: 'default' as const,
        }]
      : items;

    const transform = getFitViewportTransform(cardsForFit, getViewportSize(), {
      margin: VIEWPORT_MARGIN,
      minScale: ZOOM_MIN,
      maxScale: 1,
    });
    if (!transform) return;

    applyViewportTransform(transform.scale, transform.offset);
  }, [applyViewportTransform, centerCardInViewport, getAllElementBounds, getViewportSize, groupBoxes.length, texts.length]);

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
  }, [createCardAtPosition, getViewportCenterWorld]);

  const editingConnection = useMemo(
    () => connections.find((connection) => connection.id === editingConnectionId) ?? null,
    [connections, editingConnectionId]
  );

  const editingInlineCard = useMemo(
    () => cards.find((card) => card.id === editingInlineCardId) ?? null,
    [cards, editingInlineCardId]
  );

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

  const propertiesSelection = useMemo(() => {
    if (selectedCards.size === 1) {
      const item = cards.find((card) => card.id === Array.from(selectedCards)[0]);
      return item ? { kind: 'card' as const, item } : null;
    }

    if (selectedTexts.size === 1) {
      const item = texts.find((text) => text.id === Array.from(selectedTexts)[0]);
      return item ? { kind: 'text' as const, item } : null;
    }

    if (selectedGroupBoxes.size === 1) {
      const item = groupBoxes.find((groupBox) => groupBox.id === Array.from(selectedGroupBoxes)[0]);
      return item ? { kind: 'group' as const, item } : null;
    }

    if (selectedConnections.size === 1) {
      const item = connections.find((connection) => connection.id === Array.from(selectedConnections)[0]);
      return item ? { kind: 'connection' as const, item } : null;
    }

    return null;
  }, [cards, connections, groupBoxes, selectedCards, selectedConnections, selectedGroupBoxes, selectedTexts, texts]);

  const applyLayerChangeFromPanel = useCallback(
    (direction: 'front' | 'forward' | 'backward' | 'back') => {
      if (!propertiesSelection || propertiesSelection.kind === 'connection') return;
      const allLayers = [
        DEFAULT_CONNECTION_LAYER,
        ...cards.map((card) => getCardLayer(card)),
        ...texts.map((item) => getTextLayer(item)),
        ...groupBoxes.map((item) => getGroupLayer(item)),
      ];
      const maxLayer = allLayers.length > 0 ? Math.max(...allLayers) : DEFAULT_CARD_LAYER;
      const minLayer = allLayers.length > 0 ? Math.min(...allLayers) : DEFAULT_GROUP_LAYER;

      const getNextLayer = (current: number) => {
        if (direction === 'front') return maxLayer + LAYER_STEP;
        if (direction === 'back') return minLayer - LAYER_STEP;
        return current + (direction === 'forward' ? LAYER_STEP : -LAYER_STEP);
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
    [cards, getDiagramState, groupBoxes, propertiesSelection, saveToHistory, setCards, setGroupBoxes, setTexts, texts]
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

  const openInlineEditor = useCallback((card: CardType) => {
    setSelectedCards(new Set([card.id]));
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
    setEditingInlineCardId(card.id);
    setInlineDraft({
      title: card.title,
      date: card.date,
      content: card.content,
      label: card.label,
    });
  }, []);

  const cancelInlineEditor = useCallback(() => {
    setEditingInlineCardId(null);
    setInlineDraft(null);
  }, []);

  const openTextEditor = useCallback((item: DiagramText) => {
    setSelectedTexts(new Set([item.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedGroupBoxes(new Set());
    setEditingTextId(item.id);
    setEditingTextDraft(item.text);
  }, []);

  const cancelTextEditor = useCallback(() => {
    setEditingTextId(null);
    setEditingTextDraft('');
  }, []);

  const applyTextEditor = useCallback(() => {
    if (!editingTextId) return;
    const nextTexts = texts.map((item) =>
      item.id === editingTextId
        ? {
            ...item,
            text: editingTextDraft.trim() || item.text,
            height: estimateTextHeight(
              editingTextDraft.trim() || item.text,
              item.width,
              item.textStyle.fontSize,
              item.textStyle.lineHeight ?? 1.15
            ),
          }
        : item
    );
    setTexts(nextTexts);
    saveToHistory(getDiagramState({ texts: nextTexts }));
    cancelTextEditor();
  }, [cancelTextEditor, editingTextDraft, editingTextId, getDiagramState, saveToHistory, setTexts, texts]);

  const openGroupEditor = useCallback((item: GroupBoxType) => {
    setSelectedGroupBoxes(new Set([item.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setEditingGroupBoxId(item.id);
    setEditingGroupDraft(item.title);
  }, []);

  const cancelGroupEditor = useCallback(() => {
    setEditingGroupBoxId(null);
    setEditingGroupDraft('');
  }, []);

  const applyGroupEditor = useCallback(() => {
    if (!editingGroupBoxId) return;
    const nextGroupBoxes = groupBoxes.map((item) =>
      item.id === editingGroupBoxId ? { ...item, title: editingGroupDraft.trim() || item.title } : item
    );
    setGroupBoxes(nextGroupBoxes);
    saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    cancelGroupEditor();
  }, [cancelGroupEditor, editingGroupBoxId, editingGroupDraft, getDiagramState, groupBoxes, saveToHistory, setGroupBoxes]);

  const commitActiveLooseEditors = useCallback(() => {
    if (editingTextId) {
      const nextTexts = texts.map((item) =>
        item.id === editingTextId
          ? {
              ...item,
              text: editingTextDraft.trim() || item.text,
              height: estimateTextHeight(
                editingTextDraft.trim() || item.text,
                item.width,
                item.textStyle.fontSize,
                item.textStyle.lineHeight ?? 1.15
              ),
            }
          : item
      );
      setTexts(nextTexts);
      saveToHistory(getDiagramState({ texts: nextTexts }));
      setEditingTextId(null);
      setEditingTextDraft('');
    }

    if (editingGroupBoxId) {
      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === editingGroupBoxId ? { ...item, title: editingGroupDraft.trim() || item.title } : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
      setEditingGroupBoxId(null);
      setEditingGroupDraft('');
    }
  }, [
    editingGroupBoxId,
    editingGroupDraft,
    editingTextDraft,
    editingTextId,
    getDiagramState,
    groupBoxes,
    saveToHistory,
    setGroupBoxes,
    setTexts,
    texts,
  ]);

  const applyInlineEditor = useCallback(() => {
    if (!editingInlineCardId || !inlineDraft) return;

    const nextCards = cards.map((card) =>
      card.id === editingInlineCardId
        ? {
            ...card,
            title: inlineDraft.title.trim() || card.title,
            date: inlineDraft.date.trim() || card.date,
            content: inlineDraft.content.trim() || card.content,
            label: inlineDraft.label.trim(),
          }
        : card
    );

    setCards(nextCards);
    saveToHistory(getDiagramState({ cards: nextCards }));
    cancelInlineEditor();
  }, [cancelInlineEditor, cards, editingInlineCardId, getDiagramState, inlineDraft, saveToHistory, setCards]);

  useEffect(() => {
    if (!editingInlineCard) {
      if (editingInlineCardId) {
        setEditingInlineCardId(null);
        setInlineDraft(null);
      }
      return;
    }

    setInlineDraft((current) => {
      if (!current) {
        return {
          title: editingInlineCard.title,
          date: editingInlineCard.date,
          content: editingInlineCard.content,
          label: editingInlineCard.label,
        };
      }
      return current;
    });
  }, [editingInlineCard, editingInlineCardId]);

  useEffect(() => {
    if (!editingInlineCard || !inlineEditorRef.current) return;

    const measure = () => {
      const nextHeight = inlineEditorRef.current?.offsetHeight;
      if (nextHeight && nextHeight !== inlineEditorHeight) {
        setInlineEditorHeight(nextHeight);
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(inlineEditorRef.current);
      return () => observer.disconnect();
    }
  }, [editingInlineCard, inlineDraft, inlineEditorHeight]);

  const openSelectedCardEditor = useCallback(() => {
    cancelInlineEditor();
    cancelTextEditor();
    cancelGroupEditor();

    if (selectedCards.size === 1) {
      const id = Array.from(selectedCards)[0];
      const card = cardMap.get(id);
      if (card) {
        setEditingCard(card);
      }
      return;
    }

    if (selectedTexts.size === 1) {
      const id = Array.from(selectedTexts)[0];
      const item = texts.find((text) => text.id === id);
      if (item) openTextEditor(item);
      return;
    }

    if (selectedGroupBoxes.size === 1) {
      const id = Array.from(selectedGroupBoxes)[0];
      const item = groupBoxes.find((groupBox) => groupBox.id === id);
      if (item) openGroupEditor(item);
      return;
    }

    if (selectedCards.size === 0 && selectedConnections.size === 1) {
      setEditingConnectionId(Array.from(selectedConnections)[0]);
    }
  }, [cancelGroupEditor, cancelInlineEditor, cancelTextEditor, cardMap, groupBoxes, openGroupEditor, openTextEditor, selectedCards, selectedConnections, selectedGroupBoxes, selectedTexts, texts]);

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

    if (cards.length === 0) {
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

    fitCardsToViewport(cards);
    hasInitializedViewportRef.current = true;
  }, [
    applyViewportTransform,
    cards,
    createCenteredCard,
    fitCardsToViewport,
    pushState,
    setCards,
    setConnections,
    setGroupBoxes,
    setTexts,
  ]);

  // Util: conversÃ£o screen -> world
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = diagramRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const worldX = (clientX - rect.left - offsetRef.current.x) / scaleRef.current;
      const worldY = (clientY - rect.top - offsetRef.current.y) / scaleRef.current;
      return { x: worldX, y: worldY };
    },
    []
  );

  // Util: achar card sob o mouse (world coords)
  const findCardAtPosition = useCallback(
    (x: number, y: number): CardType | null => {
      // percorre na ordem natural; se vocÃª quiser priorizar â€œtopmostâ€, teria que manter zIndex/layer
      for (const card of cards) {
        if (x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height) {
          return card;
        }
      }
      return null;
    },
    [cards]
  );

  const getSelectionBox = useCallback((): SelectionBoxType => {
    return {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    };
  }, [dragStart, dragEnd]);

  const isCardInSelection = useCallback((card: CardType, selection: SelectionBoxType): boolean => {
    return (
      card.x < selection.x + selection.width &&
      card.x + card.width > selection.x &&
      card.y < selection.y + selection.height &&
      card.y + card.height > selection.y
    );
  }, []);

  const isBoxInSelection = useCallback(
    (
      item: {
        x: number;
        y: number;
        width: number;
        height: number;
      },
      selection: SelectionBoxType
    ) =>
      item.x < selection.x + selection.width &&
      item.x + item.width > selection.x &&
      item.y < selection.y + selection.height &&
      item.y + item.height > selection.y,
    []
  );

  const isConnectionInSelection = useCallback(
    (connection: Connection, selection: SelectionBoxType): boolean => {
      const fromCard = cardMap.get(connection.fromCard);
      const toCard = cardMap.get(connection.toCard);
      if (!fromCard || !toCard) return false;

      return doesConnectionIntersectSelectionBox(
        fromCard,
        toCard,
        selection,
        {
          fromSide: connection.fromSide,
          toSide: connection.toSide,
        },
        connection.routeStyle ?? 'bezier'
      );
    },
    [cardMap]
  );

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
      const cW = containerRef.current?.clientWidth || 0;
      const cH = containerRef.current?.clientHeight || 0;

      // centro da viewport em coords mundo
      const viewportCenter = {
        x: (-offsetRef.current.x / scaleRef.current) + cW / (2 * scaleRef.current),
        y: (-offsetRef.current.y / scaleRef.current) + cH / (2 * scaleRef.current),
      };

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
    [cards, getDiagramState, getNextSequenceNumber, saveToHistory, setCards]
  );

  const addText = useCallback(() => {
    const cW = containerRef.current?.clientWidth || 0;
    const cH = containerRef.current?.clientHeight || 0;
    const viewportCenter = {
      x: (-offsetRef.current.x / scaleRef.current) + cW / (2 * scaleRef.current),
      y: (-offsetRef.current.y / scaleRef.current) + cH / (2 * scaleRef.current),
    };

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
  }, [getDiagramState, saveToHistory, setTexts, texts]);

  const addGroupBox = useCallback(() => {
    const cW = containerRef.current?.clientWidth || 0;
    const cH = containerRef.current?.clientHeight || 0;
    const viewportCenter = {
      x: (-offsetRef.current.x / scaleRef.current) + cW / (2 * scaleRef.current),
      y: (-offsetRef.current.y / scaleRef.current) + cH / (2 * scaleRef.current),
    };

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
  }, [getDiagramState, groupBoxes, saveToHistory, setGroupBoxes]);

  // ConexÃµes
  const cancelConnection = useCallback(() => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnectionEnd(null);
  }, []);

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

  const handleConnectionStart = useCallback((cardId: string, side: ConnectionSide, point: Point) => {
    setIsConnecting(true);
    setConnectionStart({ cardId, point, side });
  }, []);

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
          x: card.x + DUPLICATE_OFFSET,
          y: card.y + DUPLICATE_OFFSET,
          sequence: card.sequence,
        };
      });

    const duplicatedTexts = selectedTextItems.map((item) => ({
      ...item,
      id: createUniqueId(),
      x: item.x + DUPLICATE_OFFSET,
      y: item.y + DUPLICATE_OFFSET,
    }));

    const duplicatedGroupBoxes = selectedGroupItems.map((item) => ({
      ...item,
      id: createUniqueId(),
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
    fitCardsToViewport(cards);
  }, [cards, fitCardsToViewport]);
  // Atalhos teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.getAttribute?.('contenteditable') === 'true');

      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        spacePanPressedRef.current = true;
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedCards(new Set(cards.map((c) => c.id)));
        setSelectedConnections(new Set());
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowPrintDialog(true);
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFitView();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        return;
      }

      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spacePanPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    cards,
    cancelConnection,
    deleteSelected,
    duplicateSelection,
    handleFitView,
    handleNewFile,
    isConnecting,
    handleRedo,
    handleUndo,
  ]);

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
  }, []);

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
    [cancelInlineEditor, commitActiveLooseEditors, isCanvasMoveActive, screenToWorld]
  );

  const moveDraggedCards = useCallback(
    (worldX: number, worldY: number): void => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      if (deltaX !== 0 || deltaY !== 0) {
        didDragCardsRef.current = true;
      }

      setCards((prev) =>
        {
          let hasChanges = false;
          const nextCards = prev.map((card) => {
            const dragged = draggedCardsRef.current.get(card.id);
            if (!dragged) return card;

            let newX = dragged.startX + deltaX;
            let newY = dragged.startY + deltaY;

            if (snapToGridRef.current) {
              newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
              newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            if (card.x === newX && card.y === newY) {
              return card;
            }

            hasChanges = true;
            return { ...card, x: newX, y: newY };
          });

          return hasChanges ? nextCards : prev;
        }
      );
    },
    [setCards]
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

      if (direction.includes('right')) {
        nextWidth = Math.max(CARD_MIN_WIDTH, startCard.width + deltaX);
      }

      if (direction.includes('left')) {
        nextWidth = Math.max(CARD_MIN_WIDTH, startCard.width - deltaX);
        nextX = startCard.x + (startCard.width - nextWidth);
      }

      if (direction.includes('bottom')) {
        nextHeight = Math.max(CARD_MIN_HEIGHT, startCard.height + deltaY);
      }

      if (direction.includes('top')) {
        nextHeight = Math.max(CARD_MIN_HEIGHT, startCard.height - deltaY);
        nextY = startCard.y + (startCard.height - nextHeight);
      }

      if (snapToGrid) {
        nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
        nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
        nextWidth = Math.max(CARD_MIN_WIDTH, Math.round(nextWidth / GRID_SIZE) * GRID_SIZE);
        nextHeight = Math.max(CARD_MIN_HEIGHT, Math.round(nextHeight / GRID_SIZE) * GRID_SIZE);
      }

      setCards((prev) =>
        prev.map((card) =>
          card.id === resizeSession.id
            ? { ...card, x: nextX, y: nextY, width: nextWidth, height: nextHeight }
            : card
        )
      );
    },
    [resizeSession, setCards, snapToGrid]
  );

  const moveDraggedTexts = useCallback(
    (worldX: number, worldY: number) => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      setTexts((prev) =>
        prev.map((item) => {
          const dragged = draggedTextsRef.current.get(item.id);
          if (!dragged) return item;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGridRef.current) {
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
          }

          return item.x === newX && item.y === newY ? item : { ...item, x: newX, y: newY };
        })
      );
    },
    [setTexts]
  );

  const moveDraggedGroupBoxes = useCallback(
    (worldX: number, worldY: number) => {
      const deltaX = worldX - dragStartRef.current.x;
      const deltaY = worldY - dragStartRef.current.y;

      setGroupBoxes((prev) =>
        prev.map((item) => {
          const dragged = draggedGroupBoxesRef.current.get(item.id);
          if (!dragged) return item;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGridRef.current) {
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
          }

          return item.x === newX && item.y === newY ? item : { ...item, x: newX, y: newY };
        })
      );
    },
    [setGroupBoxes]
  );

  const resizeBox = useCallback(
    (
      session:
        | { id: string; direction: ResizeDirection; startMouse: Point; startItem: { x: number; y: number; width: number; height: number } }
        | null,
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
        nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
        nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
        nextWidth = Math.max(minWidth, Math.round(nextWidth / GRID_SIZE) * GRID_SIZE);
        nextHeight = Math.max(minHeight, Math.round(nextHeight / GRID_SIZE) * GRID_SIZE);
      }

      apply(nextX, nextY, nextWidth, nextHeight, session.id);
    },
    [snapToGrid]
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

      if (isDraggingCard) {
        scheduleDraggedCards(world.x, world.y);
        return;
      }

      if (isDraggingText) {
        moveDraggedTexts(world.x, world.y);
        return;
      }

      if (isDraggingGroupBox) {
        moveDraggedGroupBoxes(world.x, world.y);
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
      scheduleDraggedCards,
      panStart.x,
      panStart.y,
      resizeBox,
      resizeCard,
      screenToWorld,
      setGroupBoxes,
      setTexts,
      textResizeSession,
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

      if (isDraggingCard) {
        flushDraggedCards();
        setIsDraggingCard(false);
        setDraggedCards(new Map());
        if (didDragCardsRef.current) {
          suppressCardClickRef.current = true;
          saveToHistory();
        }
        didDragCardsRef.current = false;
        return;
      }

      if (isDraggingText) {
        setIsDraggingText(false);
        setDraggedTexts(new Map());
        saveToHistory();
        return;
      }

      if (isDraggingGroupBox) {
        setIsDraggingGroupBox(false);
        setDraggedGroupBoxes(new Map());
        saveToHistory();
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
      flushDraggedCards,
      saveToHistory,
      screenToWorld,
      texts,
    ]
  );

  const handleCardDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      const activeIds =
        selectedCards.has(id) && selectedCards.size > 0
          ? Array.from(selectedCards)
          : [id];

      if (!selectedCards.has(id)) {
        setSelectedCards(new Set([id]));
      }
      setSelectedConnections(new Set());
      setSelectedTexts(new Set());
      setSelectedGroupBoxes(new Set());

      setIsDraggingCard(true);
      setDragStart(world);
      didDragCardsRef.current = false;

      const nextDraggedCards = new Map<string, { startX: number; startY: number }>();
      for (const activeId of activeIds) {
        const card = cardMap.get(activeId);
        if (!card) continue;
        nextDraggedCards.set(activeId, { startX: card.x, startY: card.y });
      }
      setDraggedCards(nextDraggedCards);
    },
    [cardMap, screenToWorld, selectedCards]
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
    [cardMap, screenToWorld]
  );

  const handleTextDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      const activeIds = selectedTexts.has(id) && selectedTexts.size > 0 ? Array.from(selectedTexts) : [id];
      if (!selectedTexts.has(id)) {
        setSelectedTexts(new Set([id]));
      }
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setSelectedGroupBoxes(new Set());
      setIsDraggingText(true);
      setDragStart(world);

      const nextDraggedTexts = new Map<string, { startX: number; startY: number }>();
      for (const activeId of activeIds) {
        const item = texts.find((text) => text.id === activeId);
        if (!item) continue;
        nextDraggedTexts.set(activeId, { startX: item.x, startY: item.y });
      }
      setDraggedTexts(nextDraggedTexts);
    },
    [screenToWorld, selectedTexts, texts]
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
    [screenToWorld, texts]
  );

  const handleGroupBoxDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      const activeIds =
        selectedGroupBoxes.has(id) && selectedGroupBoxes.size > 0 ? Array.from(selectedGroupBoxes) : [id];
      if (!selectedGroupBoxes.has(id)) {
        setSelectedGroupBoxes(new Set([id]));
      }
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setSelectedTexts(new Set());
      setIsDraggingGroupBox(true);
      setDragStart(world);

      const nextDraggedGroups = new Map<string, { startX: number; startY: number }>();
      for (const activeId of activeIds) {
        const item = groupBoxes.find((groupBox) => groupBox.id === activeId);
        if (!item) continue;
        nextDraggedGroups.set(activeId, { startX: item.x, startY: item.y });
      }
      setDraggedGroupBoxes(nextDraggedGroups);
    },
    [groupBoxes, screenToWorld, selectedGroupBoxes]
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
    [groupBoxes, screenToWorld]
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
        onZoomReset={() => {
          applyViewportTransform(1, { x: 0, y: 0 });
        }}
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
          setIsDraggingCard(false);
          setDraggedCards(new Map());
          if (didDragCardsRef.current) {
            saveToHistory();
          }
          didDragCardsRef.current = false;
        }
        cancelConnection();
      }}
      >
      <DiagramHeader
        fileName={fileName}
        onFileNameChange={setFileName}
          showSaveMenu={showSaveMenu}
          saveMenuRef={saveMenuRef}
          onToggleSaveMenu={() => setShowSaveMenu((value) => !value)}
          onNewFile={handleNewFile}
          onSavePng={async () => {
            await saveAsPng();
            setShowSaveMenu(false);
          }}
          onSaveSvg={async () => {
            await saveAsSvg();
            setShowSaveMenu(false);
          }}
          onSavePdf={async () => {
            await saveAsPdf();
            setShowSaveMenu(false);
          }}
          onPrint={() => setShowPrintDialog(true)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
        canEdit={
          selectedCards.size === 1 ||
          selectedTexts.size === 1 ||
          selectedGroupBoxes.size === 1 ||
          (selectedCards.size === 0 && selectedConnections.size === 1)
        }
        onEdit={openSelectedCardEditor}
        canDuplicate={
          selectedCards.size > 0 ||
          selectedTexts.size > 0 ||
          selectedGroupBoxes.size > 0
        }
        onDuplicate={duplicateSelection}
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
                    setEditingConnectionId(conn.id);
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

      {/* Dialog de ediÃ§Ã£o */}
      {editingCard && (
        <EditCardDialog
          card={editingCard}
          onSave={(updated: Partial<CardType> & { id: string }) => {
            const nextCards = cards.map((card) =>
              card.id === updated.id ? { ...card, ...updated } : card
            );
            setCards(nextCards);
            saveToHistory(getDiagramState({ cards: nextCards }));
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}

      {editingConnection && (
        <ConnectionEditDialog
          open={Boolean(editingConnection)}
          connection={editingConnection}
          onClose={() => setEditingConnectionId(null)}
          onSave={(updates) => {
            updateConnection(editingConnection.id, updates);
            setEditingConnectionId(null);
          }}
          onInvert={() => invertConnection(editingConnection.id)}
        />
      )}

      <PrintDialog
        open={showPrintDialog}
        options={printOptions}
        preview={printPreview}
        onChange={setPrintOptions}
        onClose={() => setShowPrintDialog(false)}
        onConfirmPdf={async () => {
          await generatePdf(printOptions);
          setShowPrintDialog(false);
        }}
        onPrint={async () => {
          await printDocument(printOptions);
        }}
        canSelection={selectedCards.size > 0}
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

