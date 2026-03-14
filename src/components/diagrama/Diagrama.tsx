'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PrintDialog, { PrintOptions } from './PrintDialog';
import Card, { type ResizeDirection } from './Card';
import ConnectionLine from './ConnectionLine';
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
  ConnectionRouteStyle,
  DiagramState,
  Point,
  SelectionBox as SelectionBoxType,
  ConnectionType,
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

const Diagrama: React.FC = () => {
  // PersistÃªncia
  const [cards, setCards] = useLocalStorage<CardType[]>('diagram-cards', []);
  const [connections, setConnections] = useLocalStorage<Connection[]>('diagram-connections', []);
  const [fileName, setFileName] = useLocalStorage<string>('diagram-filename', 'Diagrama sem título');

  // SeleÃ§Ã£o
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());

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
  const [isResizingCard, setIsResizingCard] = useState(false);
  const [resizeSession, setResizeSession] = useState<{
    id: string;
    direction: ResizeDirection;
    startMouse: Point;
    startCard: { x: number; y: number; width: number; height: number };
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
  const { canUndo, canRedo, pushState, undo, redo } = useHistory({ cards, connections });

  // Map para performance (evita find O(nÂ²) em conexÃµes)
  const cardMap = useMemo(() => {
    const m = new Map<string, CardType>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  // Helper: salva snapshot atual no histÃ³rico
  const saveToHistory = useCallback((state: DiagramState = { cards, connections }) => {
    pushState(state);
  }, [cards, connections, pushState]);

  const applyDiagramState = useCallback((state: DiagramState) => {
    setCards(state.cards);
    setConnections(state.connections);
  }, [setCards, setConnections]);

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
    if (items.length === 0) return;

    if (items.length === 1) {
      centerCardInViewport(items[0], 1);
      return;
    }

    const transform = getFitViewportTransform(items, getViewportSize(), {
      margin: VIEWPORT_MARGIN,
      minScale: ZOOM_MIN,
      maxScale: 1,
    });
    if (!transform) return;

    applyViewportTransform(transform.scale, transform.offset);
  }, [applyViewportTransform, centerCardInViewport, getViewportSize]);

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
      sequence,
      title: title ?? preset.title,
      content: content ?? preset.content,
      summary: '',
      tags: [],
      label: label ?? preset.label,
      date: new Date().toLocaleDateString('pt-BR'),
      source: '',
      accent: accent ?? preset.accent,
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

  const openInlineEditor = useCallback((card: CardType) => {
    setSelectedCards(new Set([card.id]));
    setSelectedConnections(new Set());
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

  const applyInlineEditor = useCallback(() => {
    if (!editingInlineCardId || !inlineDraft) return;

    const nextCards = cards.map((card) =>
      card.id === editingInlineCardId
        ? {
            ...card,
            title: inlineDraft.title.trim() || card.title,
            date: inlineDraft.date.trim() || card.date,
            content: inlineDraft.content.trim() || card.content,
            label: inlineDraft.label.trim() || card.label,
          }
        : card
    );

    setCards(nextCards);
    saveToHistory({ cards: nextCards, connections });
    cancelInlineEditor();
  }, [cancelInlineEditor, cards, connections, editingInlineCardId, inlineDraft, saveToHistory, setCards]);

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

    if (selectedCards.size === 1) {
      const id = Array.from(selectedCards)[0];
      const card = cardMap.get(id);
      if (card) {
        setEditingCard(card);
      }
      return;
    }

    if (selectedCards.size === 0 && selectedConnections.size === 1) {
      setEditingConnectionId(Array.from(selectedConnections)[0]);
    }
  }, [cancelInlineEditor, cardMap, selectedCards, selectedConnections]);

  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (!previousState) return;

    applyDiagramState(previousState);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
  }, [applyDiagramState, undo]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (!nextState) return;

    applyDiagramState(nextState);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
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

      pushState({ cards: [initialCard], connections: [] });
      setCards([initialCard]);
      setConnections([]);
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

      const nextState = { cards: [...cards, newCard], connections };
      setCards(nextState.cards);
      saveToHistory(nextState);
    },
    [cards, connections, getNextSequenceNumber, saveToHistory, setCards]
  );

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
        color,
        fromSide,
        toSide,
      };

      const nextState = { cards, connections: [...connections, newConnection] };
      setConnections(nextState.connections);
      saveToHistory(nextState);
    },
    [cardMap, cards, connectionRouteStyle, connections, saveToHistory, setConnections]
  );

  const handleConnectionStart = useCallback((cardId: string, side: ConnectionSide, point: Point) => {
    setIsConnecting(true);
    setConnectionStart({ cardId, point, side });
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedCards.size === 0 && selectedConnections.size === 0) return;
    const nextState = {
      cards: cards.filter((card) => !selectedCards.has(card.id)),
      connections: connections.filter(
        (conn) =>
          !selectedConnections.has(conn.id) &&
          !selectedCards.has(conn.fromCard) &&
          !selectedCards.has(conn.toCard)
      ),
    };

    setCards(nextState.cards);
    setConnections(nextState.connections);
    saveToHistory(nextState);
    cancelInlineEditor();

    setSelectedCards(new Set());
    setSelectedConnections(new Set());
  }, [cancelInlineEditor, cards, connections, saveToHistory, selectedCards, selectedConnections, setCards, setConnections]);

  const updateConnection = useCallback((connectionId: string, updates: Partial<Connection>) => {
    const nextConnections = connections.map((connection) =>
      connection.id === connectionId ? { ...connection, ...updates } : connection
    );
    setConnections(nextConnections);
    saveToHistory({ cards, connections: nextConnections });
  }, [cards, connections, saveToHistory, setConnections]);

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
    saveToHistory({ cards, connections: nextConnections });
  }, [cardMap, cards, connections, saveToHistory, setConnections]);

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

    const nextState = { cards: [initialCard], connections: [] };

    pushState(nextState);
    setCards(nextState.cards);
    setConnections(nextState.connections);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setFileName('Diagrama sem título');
    setShowNewFileDialog(false);
    hasInitializedViewportRef.current = true;
  }, [applyViewportTransform, cancelInlineEditor, createCenteredCard, pushState, setCards, setConnections, setFileName]);

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
      if (target.closest('[data-inline-card-editor]')) return;

      cancelInlineEditor();

      if (!e.ctrlKey && !e.metaKey) {
        setSelectedCards(new Set());
        setSelectedConnections(new Set());
      }

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      setIsDragging(true);
      setDragStart(world);
      setDragEnd(world);
    },
    [cancelInlineEditor, isCanvasMoveActive, screenToWorld]
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

      if (isResizingCard) {
        resizeCard(world.x, world.y);
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
      isResizingCard,
      isConnecting,
      isMiddleZooming,
      isPanning,
      scheduleDraggedCards,
      panStart.x,
      panStart.y,
      resizeCard,
      screenToWorld,
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

      if (isResizingCard) {
        setIsResizingCard(false);
        setResizeSession(null);
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

        for (const card of cards) {
          if (isCardInSelection(card, selectionBox)) newlySelectedCards.add(card.id);
        }

        for (const connection of connections) {
          if (isConnectionInSelection(connection, selectionBox)) {
            newlySelectedConnections.add(connection.id);
          }
        }

        if (!e.shiftKey) {
          setSelectedCards(newlySelectedCards);
          setSelectedConnections(newlySelectedConnections);
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
      findCardAtPosition,
      getSelectionBox,
      isCardInSelection,
      isConnectionInSelection,
      isConnecting,
      isDragging,
      isDraggingCard,
      isResizingCard,
      isMiddleZooming,
      isPanning,
      flushDraggedCards,
      saveToHistory,
      screenToWorld,
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
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        connectionRouteStyle={connectionRouteStyle}
        onConnectionRouteStyleChange={setConnectionRouteStyle}
        cardColor={
          selectedCards.size === 1
            ? cardMap.get(Array.from(selectedCards)[0])?.accent || '#2563EB'
            : selectedCards.size === 0 && selectedConnections.size === 1
            ? connections.find((connection) => connection.id === Array.from(selectedConnections)[0])?.color || '#2563EB'
            : '#2563EB'
        }
        onCardColorChange={(color) => {
          if (selectedCards.size === 1) {
            const id = Array.from(selectedCards)[0];
            const nextCards = cards.map((card) => (card.id === id ? { ...card, accent: color } : card));
            setCards(nextCards);
            saveToHistory({ cards: nextCards, connections });
            return;
          }

          if (selectedConnections.size > 0) {
            const nextConnections = connections.map((connection) =>
              selectedConnections.has(connection.id) ? { ...connection, color } : connection
            );
            setConnections(nextConnections);
            saveToHistory({ cards, connections: nextConnections });
          }
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
          canEdit={selectedCards.size === 1 || (selectedCards.size === 0 && selectedConnections.size === 1)}
          onEdit={openSelectedCardEditor}
          canDelete={selectedCards.size > 0 || selectedConnections.size > 0}
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
          {/* SVG GLOBAL DE CONEXÃ•ES */}
          <svg
            className="absolute inset-0"
            style={{
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 5,
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
                    }
                  }}
                  onDoubleClick={(ev?: React.MouseEvent) => {
                    ev?.stopPropagation();
                    setSelectedConnections(new Set([conn.id]));
                    setSelectedCards(new Set());
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

          {/* Cards */}
          <div style={{ position: 'relative', zIndex: 20 }}>
            {cards.map((card) => (
              <Card
                key={card.id}
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
            ))}
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
            saveToHistory({ cards: nextCards, connections });
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

