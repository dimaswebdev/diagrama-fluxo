'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Card from './Card';
import ConnectionLine from './ConnectionLine';
import SelectionBox from './SelectionBox';
import FloatingToolbar from './FloatingToolbar';
import { EditCardDialog } from './EditCardDialog';

import { useLocalStorage } from '@/hooks/diagrama/useLocalStorage';
import { useHistory } from '@/hooks/diagrama/useHistory';

import {
  Card as CardType,
  Connection,
  Point,
  SelectionBox as SelectionBoxType,
  ConnectionType,
  CardType as CardTypeEnum,
  GRID_SIZE,
  A4_WIDTH,
  A4_HEIGHT,
} from '@/types/diagrama';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ConnectionStart = { cardId: string; point: Point } | null;

const CARD_COLORS = [
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

function calculateConnectionSides(
  from: CardType,
  to: CardType
): {
  fromSide: 'left' | 'right' | 'top' | 'bottom';
  toSide: 'left' | 'right' | 'top' | 'bottom';
} {
  const fromCenter = {
    x: from.x + from.width / 2,
    y: from.y + from.height / 2,
  };

  const toCenter = {
    x: to.x + to.width / 2,
    y: to.y + to.height / 2,
  };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      fromSide: dx > 0 ? 'right' : 'left',
      toSide: dx > 0 ? 'left' : 'right',
    };
  }

  return {
    fromSide: dy > 0 ? 'bottom' : 'top',
    toSide: dy > 0 ? 'top' : 'bottom',
  };
}

const Diagrama: React.FC = () => {
  // Persistência
  const [cards, setCards] = useLocalStorage<CardType[]>('diagram-cards', []);
  const [connections, setConnections] = useLocalStorage<Connection[]>('diagram-connections', []);
  const [fileName, setFileName] = useLocalStorage<string>('diagram-filename', 'Diagrama sem título');

  // Seleção
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());

  // Interações (drag / pan / connect)
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<ConnectionStart>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Point | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>('normal');
  const [connectionColor, setConnectionColor] = useState<string>('#2563eb');

  // Mundo virtual (zoom/pan)
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // Drag de cards
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [draggedCards, setDraggedCards] = useState<Map<string, { startX: number; startY: number }>>(new Map());

  // UI
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isMiddleZooming, setIsMiddleZooming] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);

  // Refs DOM
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Refs (para listener wheel não depender de deps e não recriar)
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // History
  const { canUndo, canRedo, pushState, undo, redo } = useHistory({ cards, connections });

  // Map para performance (evita find O(n²) em conexões)
  const cardMap = useMemo(() => {
    const m = new Map<string, CardType>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  // Helper: salva snapshot atual no histórico
  const saveToHistory = useCallback(() => {
    pushState({ cards, connections });
  }, [cards, connections, pushState]);

  // Inicial: cria card central
  useEffect(() => {
    if (cards.length > 0) return;

    const centerX = A4_WIDTH / 2 - 160;
    const centerY = A4_HEIGHT / 2 - 110;

    const initialCard: CardType = {
      id: Date.now().toString(),
      x: centerX,
      y: centerY,
      width: 320,
      height: 220,

      sequence: 1,

      title: 'Evento 1',
      content: 'Descreva o conteúdo aqui.',
      summary: '',
      tags: [],
      label: 'INÍCIO',
      date: new Date().toLocaleDateString('pt-BR'),
      source: '',
      accent: '#19B7C6',

      type: 'default',
    };

    // snapshot e estado localstorage
    pushState({ cards: [initialCard], connections: [] });
    setCards([initialCard]);
    setConnections([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Util: conversão screen -> world
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
      // percorre na ordem natural; se você quiser priorizar “topmost”, teria que manter zIndex/layer
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

  // Sequência
  const getNextSequenceNumber = useCallback((): number => {
    const usedNumbers = cards.map((c) => c.sequence).sort((a, b) => a - b);
    for (let i = 1; i <= usedNumbers.length; i++) {
      if (usedNumbers[i - 1] !== i) return i;
    }
    return usedNumbers.length + 1;
  }, [cards]);

  // CRUD cards
  const updateCard = useCallback((id: string, updates: Partial<CardType>) => {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...updates } : card)));
  }, [setCards]);

  const addCard = useCallback(
    (type: CardTypeEnum = 'default') => {
      saveToHistory();

      const cW = containerRef.current?.clientWidth || 0;
      const cH = containerRef.current?.clientHeight || 0;

      // centro da viewport em coords mundo
      const viewportCenter = {
        x: (-offsetRef.current.x / scaleRef.current) + cW / (2 * scaleRef.current),
        y: (-offsetRef.current.y / scaleRef.current) + cH / (2 * scaleRef.current),
      };

      const nextSequence = getNextSequenceNumber();

      const newCard: CardType = {
        id: Date.now().toString(),
        x: viewportCenter.x - 160,
        y: viewportCenter.y - 110,
        width: 320,
        height: 220,

        sequence: nextSequence,
        title: `Evento ${nextSequence}`,

        content: 'Descreva o conteúdo aqui.',
        summary: '',
        tags: [],
        label: 'NOVO',
        date: new Date().toLocaleDateString('pt-BR'),
        source: '',
        accent: getRandomColor(),

        type,
      };

      setCards((prev) => [...prev, newCard]);
    },
    [getNextSequenceNumber, saveToHistory, setCards]
  );

  // Conexões
  const cancelConnection = useCallback(() => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnectionEnd(null);
  }, []);

  const createConnection = useCallback(
    (fromId: string, toId: string, type: ConnectionType = 'normal', color: string = '#2563eb') => {
      const fromCard = cardMap.get(fromId);
      const toCard = cardMap.get(toId);
      if (!fromCard || !toCard) return;

      // evita duplicar mesma conexão (mesmo sentido)
      const alreadyExists = connections.some((c) => c.fromCard === fromId && c.toCard === toId);
      if (alreadyExists) return;

      const { fromSide, toSide } = calculateConnectionSides(fromCard, toCard);

      const newConnection: Connection = {
        id: `${fromId}-${toId}-${Date.now()}`,
        fromCard: fromId,
        toCard: toId,
        type,
        color,
        fromSide,
        toSide,
      };

      setConnections((prev) => [...prev, newConnection]);
      saveToHistory();
    },
    [cardMap, connections, saveToHistory, setConnections]
  );

  const handleConnectionStart = useCallback((cardId: string, point: Point) => {
    setIsConnecting(true);
    setConnectionStart({ cardId, point });
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedCards.size === 0 && selectedConnections.size === 0) return;

    saveToHistory();

    setCards((prev) => prev.filter((card) => !selectedCards.has(card.id)));

    setConnections((prev) =>
      prev.filter(
        (conn) =>
          !selectedConnections.has(conn.id) &&
          !selectedCards.has(conn.fromCard) &&
          !selectedCards.has(conn.toCard)
      )
    );

    setSelectedCards(new Set());
    setSelectedConnections(new Set());
  }, [saveToHistory, selectedCards, selectedConnections, setCards, setConnections]);

  // Novo arquivo
  const handleNewFile = useCallback(() => {
    if (!window.confirm('Criar novo arquivo? Todas as alterações não salvas serão perdidas.')) return;

    const centerX = A4_WIDTH / 2 - 75;
    const centerY = A4_HEIGHT / 2 - 40;

    const initialCard: CardType = {
      id: Date.now().toString(),
      x: centerX,
      y: centerY,
      width: 320,
      height: 220,

      sequence: 1,

      title: 'Evento 1',
      content: 'Descreva o conteúdo aqui.',
      summary: '',
      tags: [],
      label: 'INÍCIO',
      date: new Date().toLocaleDateString('pt-BR'),
      source: '',
      accent: '#19B7C6',

      type: 'default',
    };

    pushState({ cards: [initialCard], connections: [] });
    setCards([initialCard]);
    setConnections([]);
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setFileName('Diagrama sem título');
  }, [pushState, setCards, setConnections, setFileName]);

  // Export PDF
  const handlePrint = async (): Promise<void> => {
    if (!worldRef.current) return;
  
    try {
      // Temporariamente remove zoom/pan para exportar em escala 1
      const originalTransform = worldRef.current.style.transform;
      worldRef.current.style.transform = 'translate(0px, 0px) scale(1)';
  
      const canvas = await html2canvas(worldRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: A4_WIDTH,
        height: A4_HEIGHT
      });
  
      worldRef.current.style.transform = originalTransform;
  
      const imgData = canvas.toDataURL('image/png');
  
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [A4_WIDTH, A4_HEIGHT]
      });
  
      pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH, A4_HEIGHT);
  
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }
  };

  // Atalhos teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.getAttribute?.('contenteditable') === 'true');

      if (isTyping) return;

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedCards(new Set(cards.map((c) => c.id)));
        setSelectedConnections(new Set());
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        const previousState = undo();
        if (!previousState) return;

        setCards(previousState.cards);
        setConnections(previousState.connections);
        setSelectedCards(new Set());
        setSelectedConnections(new Set());
        return;
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        const nextState = redo();
        if (!nextState) return;

        setCards(nextState.cards);
        setConnections(nextState.connections);
        setSelectedCards(new Set());
        setSelectedConnections(new Set());
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
        return;
      }

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handlePrint();
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cards,
    cancelConnection,
    deleteSelected,
    handleNewFile,
    handlePrint,
    isConnecting,
    redo,
    setCards,
    setConnections,
    undo,
  ]);

  // Wheel zoom (um único handler nativo) — evita recriar listener e bloqueia scroll do browser
  useEffect(() => {
    const el = diagramRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;

      // vamos “travar” o ponto do mouse
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevScale = scaleRef.current;
      const prevOffset = offsetRef.current;

      const newScale = clamp(prevScale + delta, 0.1, 5);

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
      // Botão do meio -> zoom drag
      if (e.button === 1) {
        e.preventDefault();
        setIsMiddleZooming(true);
        return;
      }

      // ALT + clique esquerdo -> pan
      if (e.button === 0 && e.altKey) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
        return;
      }

      const target = e.target as HTMLElement;

      // se clicou em card/conexão/ponto, não inicia selection box
      if (target.closest('.card')) return;
      if (target.closest('.connection-point')) return;
      if (target.closest('.connection-line')) return;

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
    [screenToWorld]
  );

  const moveDraggedCards = useCallback(
    (worldX: number, worldY: number): void => {
      const deltaX = worldX - dragStart.x;
      const deltaY = worldY - dragStart.y;

      setCards((prev) =>
        prev.map((card) => {
          const dragged = draggedCards.get(card.id);
          if (!dragged) return card;

          let newX = dragged.startX + deltaX;
          let newY = dragged.startY + deltaY;

          if (snapToGrid) {
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
          }

          return { ...card, x: newX, y: newY };
        })
      );
    },
    [dragStart.x, dragStart.y, draggedCards, setCards, snapToGrid]
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

        const newScale = clamp(prevScale + delta, 0.1, 5);

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
        moveDraggedCards(world.x, world.y);
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
      isConnecting,
      isMiddleZooming,
      isPanning,
      moveDraggedCards,
      panStart.x,
      panStart.y,
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
        setIsDraggingCard(false);
        setDraggedCards(new Map());
        saveToHistory();
        return;
      }

      if (isConnecting && connectionStart && world) {
        const targetCard = findCardAtPosition(world.x, world.y);
        if (targetCard && targetCard.id !== connectionStart.cardId) {
          createConnection(connectionStart.cardId, targetCard.id, connectionType, connectionColor);
        }
        cancelConnection();
        return;
      }

      if (isDragging && world) {
        const selectionBox = getSelectionBox();
        const newlySelected = new Set<string>();

        for (const card of cards) {
          if (isCardInSelection(card, selectionBox)) newlySelected.add(card.id);
        }

        if (!e.shiftKey) {
          setSelectedCards(newlySelected);
        } else {
          setSelectedCards((prev) => {
            const updated = new Set(prev);
            newlySelected.forEach((id) => updated.add(id));
            return updated;
          });
        }

        setIsDragging(false);
      }
    },
    [
      cancelConnection,
      cards,
      connectionColor,
      connectionStart,
      connectionType,
      createConnection,
      findCardAtPosition,
      getSelectionBox,
      isCardInSelection,
      isConnecting,
      isDragging,
      isDraggingCard,
      isMiddleZooming,
      isPanning,
      saveToHistory,
      screenToWorld,
    ]
  );

  const handleCardDragStart = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      setSelectedCards(new Set([id]));
      setSelectedConnections(new Set());

      setIsDraggingCard(true);
      setDragStart(world);

      const card = cardMap.get(id);
      if (!card) return;

      setDraggedCards(new Map([[id, { startX: card.x, startY: card.y }]]));
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
      backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
      backgroundPosition: `
        ${offset.x % (GRID_SIZE * scale)}px
        ${offset.y % (GRID_SIZE * scale)}px
      `,
    } as React.CSSProperties;
  }, [offset.x, offset.y, scale, showGrid]);

  return (
    <div className="flex flex-col h-screen bg-gray-100" ref={containerRef}>
      {/* Barra de título */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">📄</span>
          <input
            type="text"
            value={fileName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFileName(e.target.value)}
            className="font-medium text-gray-700 bg-transparent border border-transparent hover:border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{cards.length} cards</span>
          <span>{connections.length} conexões</span>
        </div>
      </div>

      {/* Toolbar Flutuante */}
      <FloatingToolbar
        onAddCard={addCard}
        onDelete={deleteSelected}
        onUndo={undo}
        onRedo={redo}
        onPrint={handlePrint}
        onNewFile={handleNewFile}
        onEdit={() => {
          if (selectedCards.size === 1) {
            const id = Array.from(selectedCards)[0];
            const card = cardMap.get(id);
            if (card) setEditingCard(card);
          }
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={selectedCards.size === 1}
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        cardColor={
          selectedCards.size === 1
            ? cardMap.get(Array.from(selectedCards)[0])?.accent || '#000'
            : '#000'
        }
        onCardColorChange={(color) => {
          if (selectedCards.size === 1) {
            const id = Array.from(selectedCards)[0];
            updateCard(id, { accent: color });
            saveToHistory();
          }
        }}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        scale={scale}
        onZoomIn={() => setScale((s) => clamp(s + 0.1, 0.1, 3))}
        onZoomOut={() => setScale((s) => clamp(s - 0.1, 0.1, 3))}
        onZoomReset={() => {
          setScale(1);
          setOffset({ x: 0, y: 0 });
        }}
      />

      {/* Área do diagrama */}
      <div
        ref={diagramRef}
        data-diagram-canvas
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning ? 'cursor-grabbing' : isConnecting ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={gridStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsPanning(false);
          cancelConnection();
        }}
      >
        {/* Camada transformável (mundo virtual) */}
        <div
          ref={worldRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {/* SVG GLOBAL DE CONEXÕES */}
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

            {/* Conexões existentes */}
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
                />
              );
            })}

            {/* Linha temporária ao conectar */}
            {isConnecting && connectionStart && tempConnectionEnd && (
              <line
                x1={connectionStart.point.x}
                y1={connectionStart.point.y}
                x2={tempConnectionEnd.x}
                y2={tempConnectionEnd.y}
                stroke={connectionColor}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={
                  connectionType === 'dashed' ? '6,4' : connectionType === 'dotted' ? '2,4' : undefined
                }
                markerEnd="url(#arrow-head)"
                style={{ pointerEvents: 'none' }}
              />
            )}
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
                onDragStart={(e: React.MouseEvent) => handleCardDragStart(card.id, e)}
                onUpdate={(updates: Partial<CardType>) => updateCard(card.id, updates)}
                onConnectionStart={(point: Point) => handleConnectionStart(card.id, point)}
                onConnectionEnd={(targetCardId: string) => {
                  if (connectionStart && targetCardId !== connectionStart.cardId) {
                    createConnection(connectionStart.cardId, targetCardId, connectionType, connectionColor);
                  }
                  cancelConnection();
                }}
              />
            ))}
          </div>

          {/* Caixa de seleção */}
          {isDragging && (
            <div style={{ position: 'relative', zIndex: 30 }}>
              <SelectionBox start={dragStart} end={dragEnd} />
            </div>
          )}
        </div>
      </div>

      {/* Dialog de edição */}
      {editingCard && (
        <EditCardDialog
          card={editingCard}
          onSave={(updated: Partial<CardType> & { id: string }) => {
            updateCard(updated.id, updated);
            saveToHistory();
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
};

export default Diagrama;