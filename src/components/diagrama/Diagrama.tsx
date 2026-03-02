
'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  DiagramState,
  SelectionBox as SelectionBoxType,
  ConnectionType,
  CardType as CardTypeEnum,
  GRID_SIZE, 
  A4_WIDTH, 
  A4_HEIGHT 
} from '@/types/diagrama';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Diagrama: React.FC = () => {
  // Estados principais
  const [cards, setCards] = useLocalStorage<CardType[]>('diagram-cards', []);
  const [connections, setConnections] = useLocalStorage<Connection[]>('diagram-connections', []);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useLocalStorage<string>('diagram-filename', 'Diagrama sem título');
  
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState<Point>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionStart, setConnectionStart] = useState<{ cardId: string; point: Point } | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Point | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>('normal');
  const [connectionColor, setConnectionColor] = useState<string>('#2563eb');
  
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const [draggedCards, setDraggedCards] = useState<Map<string, { startX: number; startY: number }>>(new Map());
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  
  const {
    current,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo
  } = useHistory({ cards, connections });

  useEffect(() => {
    if (cards.length === 0) {
      const centerX = (A4_WIDTH / 2) - 160;
      const centerY = (A4_HEIGHT / 2) - 110;
  
      const initialCard: CardType = {
        id: Date.now().toString(),
        x: centerX,
        y: centerY,
        width: 320,
        height: 220,
      
        sequence: 1, // 🔥 ADICIONE
      
        title: "Evento 1",
        content: "Descreva o conteúdo aqui.",
        summary: "",
        tags: [],
        label: "INÍCIO",
        date: new Date().toLocaleDateString("pt-BR"),
        source: "",
        accent: "#19B7C6",
      
        type: "default"
      };
  
      pushState({ cards: [initialCard], connections: [] });
      setCards([initialCard]);
      setConnections([]);
    }
  }, []);

  const saveToHistory = useCallback((): void => {
    pushState({ cards, connections });
  }, [cards, connections, pushState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        const allCardIds = new Set(cards.map((card: CardType) => card.id));
        setSelectedCards(allCardIds);
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        const previousState = undo();
        if (previousState) {
          setCards(previousState.cards);
          setConnections(previousState.connections);
          setSelectedCards(new Set());
          setSelectedConnections(new Set());
        }
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        const nextState = redo();
        if (nextState) {
          setCards(nextState.cards);
          setConnections(nextState.connections);
          setSelectedCards(new Set());
          setSelectedConnections(new Set());
        }
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }

      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, selectedCards, isConnecting, undo, redo]);

  const handleNewFile = (): void => {
    if (window.confirm('Criar novo arquivo? Todas as alterações não salvas serão perdidas.')) {
      const centerX = (A4_WIDTH / 2) - 75;
      const centerY = (A4_HEIGHT / 2) - 40;
      
      const initialCard: CardType = {
        id: Date.now().toString(),
        x: centerX,
        y: centerY,
        width: 320,
        height: 220,
      
        sequence: 1,
      
        title: "Evento 1",
        content: "Descreva o conteúdo aqui.",
        summary: "",
        tags: [],
        label: "INÍCIO",
        date: new Date().toLocaleDateString("pt-BR"),
        source: "",
        accent: "#19B7C6",
      
        type: "default"
      };
      
      pushState({ cards: [initialCard], connections: [] });
      setCards([initialCard]);
      setConnections([]);
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setFileName('Diagrama sem título');
    }
  };

  const handlePrint = async (): Promise<void> => {
    if (!diagramRef.current) return;
    try {
      const canvas = await html2canvas(diagramRef.current, { scale: 2 });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [A4_WIDTH, A4_HEIGHT] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH, A4_HEIGHT);
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    }
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.1), 3);
        
        const rect = diagramRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          setOffset((prev: Point) => ({
            x: mouseX - (mouseX - prev.x) * (newScale / scale),
            y: mouseY - (mouseY - prev.y) * (newScale / scale)
          }));
        }
        
        setScale(newScale);
      }
    };

    const diagram = diagramRef.current;
    if (diagram) {
      diagram.addEventListener('wheel', handleWheel, { passive: false });
      return () => diagram.removeEventListener('wheel', handleWheel);
    }
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {

    // 🖱️ PAN (botão do meio ou ALT + clique)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
  
    const target = e.target as HTMLElement;
  
    // 🔹 Se clicou em card → não interfere
    if (target.closest('.card')) return;
  
    // 🔹 Se clicou em ponto de conexão → não interfere
    if (target.closest('.connection-point')) return;
  
    // 🔹 Se clicou em linha → não inicia selection box
    if (target.closest('.connection-line')) return;
  
    // 🔥 Clique vazio no canvas
    // Se NÃO estiver segurando CTRL → limpa seleção
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
    }
  
    // 🔹 Inicia seleção por arrasto (selection box)
    setIsDragging(true);
  
    const rect = diagramRef.current?.getBoundingClientRect();
    if (!rect) return;
  
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
  
    setDragStart({ x, y });
    setDragEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = diagramRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX = (e.clientX - rect.left - offset.x) / scale;
    const worldY = (e.clientY - rect.top - offset.y) / scale;

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (isDraggingCard) {
      moveDraggedCards(worldX, worldY);
      return;
    }

    if (isConnecting) {
      setTempConnectionEnd({ x: worldX, y: worldY });
      return;
    }

    if (isDragging) {
      setDragEnd({ x: worldX, y: worldY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = diagramRef.current?.getBoundingClientRect();
    if (!rect) return;

    const worldX = (e.clientX - rect.left - offset.x) / scale;
    const worldY = (e.clientY - rect.top - offset.y) / scale;

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

    if (isConnecting && connectionStart) {
      const targetCard = findCardAtPosition(worldX, worldY);
      if (targetCard && targetCard.id !== connectionStart.cardId) {
        createConnection(
          connectionStart.cardId, 
          targetCard.id, 
          connectionType, 
          connectionColor
        );
      }
      cancelConnection();
      return;
    }

    if (isDragging) {
      const selectionBox = getSelectionBox();
      const newSelected = new Set<string>();
      
      cards.forEach((card: CardType) => {
        if (isCardInSelection(card, selectionBox)) {
          newSelected.add(card.id);
        }
      });

      if (!e.shiftKey) {
        setSelectedCards(newSelected);
      } else {
        setSelectedCards((prev: Set<string>) => {
          const updated = new Set(prev);
          newSelected.forEach(id => updated.add(id));
          return updated;
        });
      }
      
      setIsDragging(false);
    }
  };

  const handleCardDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
  
    const rect = diagramRef.current?.getBoundingClientRect();
    if (!rect) return;
  
    const worldX = (e.clientX - rect.left - offset.x) / scale;
    const worldY = (e.clientY - rect.top - offset.y) / scale;
  
    setSelectedCards(new Set([id]));
    setIsDraggingCard(true);
    setDragStart({ x: worldX, y: worldY });
  
    const card = cards.find(c => c.id === id);
    if (!card) return;
  
    setDraggedCards(new Map([
      [id, { startX: card.x, startY: card.y }]
    ]));
  };

  const moveDraggedCards = (worldX: number, worldY: number): void => {
    if (!dragStart) return;

    const deltaX = worldX - dragStart.x;
    const deltaY = worldY - dragStart.y;

    setCards((prev: CardType[]) => prev.map((card: CardType) => {
      const draggedCard = draggedCards.get(card.id);
      if (draggedCard) {
        let newX = draggedCard.startX + deltaX;
        let newY = draggedCard.startY + deltaY;

        if (snapToGrid) {
          newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
          newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        }

        return { ...card, x: newX, y: newY };
      }
      return card;
    }));
  };

  const handleConnectionStart = (cardId: string, point: Point): void => {
    setIsConnecting(true);
    setConnectionStart({ cardId, point });
  };

  function calculateConnectionSides(from: CardType, to: CardType) {
    const fromCenter = {
      x: from.x + from.width / 2,
      y: from.y + from.height / 2
    };
  
    const toCenter = {
      x: to.x + to.width / 2,
      y: to.y + to.height / 2
    };
  
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
  
    if (Math.abs(dx) > Math.abs(dy)) {
      return {
        fromSide: dx > 0 ? 'right' as const : 'left' as const,
        toSide: dx > 0 ? 'left' as const : 'right' as const
      };
    } else {
      return {
        fromSide: dy > 0 ? 'bottom' as const : 'top' as const,
        toSide: dy > 0 ? 'top' as const : 'bottom' as const
      };
    }
  }

  const createConnection = (
    fromId: string,
    toId: string,
    type: ConnectionType = 'normal',
    color: string = '#2563eb'
  ): void => {
  
    const fromCard = cards.find(c => c.id === fromId);
    const toCard = cards.find(c => c.id === toId);
  
    if (!fromCard || !toCard) return;
  
    const { fromSide, toSide } = calculateConnectionSides(fromCard, toCard);
  
    const newConnection: Connection = {
      id: `${fromId}-${toId}-${Date.now()}`,
      fromCard: fromId,
      toCard: toId,
      type,
      color,
      fromSide,
      toSide
    };
  
    setConnections(prev => [...prev, newConnection]);
    saveToHistory();
  };
  

  const cancelConnection = (): void => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnectionEnd(null);
  };

  const deleteSelected = (): void => {
    if (selectedCards.size === 0 && selectedConnections.size === 0) return;
  
    saveToHistory();
  
    setCards(prev =>
      prev.filter(card => !selectedCards.has(card.id))
    );
  
    setConnections(prev =>
      prev.filter(conn =>
        !selectedConnections.has(conn.id) &&
        !selectedCards.has(conn.fromCard) &&
        !selectedCards.has(conn.toCard)
      )
    );
  
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
  };

  const findCardAtPosition = (x: number, y: number): CardType | null => {
    return cards.find((card: CardType) => 
      x >= card.x && x <= card.x + card.width &&
      y >= card.y && y <= card.y + card.height
    ) || null;
  };

  const getSelectionBox = (): SelectionBoxType => {
    return {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y)
    };
  };

  const isCardInSelection = (card: CardType, selection: SelectionBoxType): boolean => {
    return (
      card.x < selection.x + selection.width &&
      card.x + card.width > selection.x &&
      card.y < selection.y + selection.height &&
      card.y + card.height > selection.y
    );
  };

  const getNextSequenceNumber = (): number => {
    const usedNumbers = cards
      .map(card => card.sequence)
      .sort((a, b) => a - b);
  
    for (let i = 1; i <= usedNumbers.length; i++) {
      if (usedNumbers[i - 1] !== i) {
        return i;
      }
    }
  
    return usedNumbers.length + 1;
  };

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
    '#111827'
  ];
  
  const getRandomColor = () =>
    CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];

  const addCard = (type: CardTypeEnum = 'default'): void => {
    saveToHistory();
  
    const viewportCenter = {
      x: (-offset.x / scale) + (containerRef.current?.clientWidth || 0) / (2 * scale),
      y: (-offset.y / scale) + (containerRef.current?.clientHeight || 0) / (2 * scale)
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

      content: "Descreva o conteúdo aqui.",
      summary: "",
      tags: [],
      label: "NOVO",
      date: new Date().toLocaleDateString("pt-BR"),
      source: "",
      accent: getRandomColor(),
  
      type
    };
  
    setCards((prev) => [...prev, newCard]);
  };

  const updateCard = (id: string, updates: Partial<CardType>): void => {
    setCards(prev =>
      prev.map(card =>
        card.id === id ? { ...card, ...updates } : card
      )
    );
  };

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
            const card = cards.find(c => c.id === id);
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
            ? cards.find(c => c.id === Array.from(selectedCards)[0])?.accent || '#000'
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
        onZoomIn={() => setScale((s: number) => Math.min(s + 0.1, 3))}
        onZoomOut={() => setScale((s: number) => Math.max(s - 0.1, 0.1))}
        onZoomReset={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
      />

      {/* Área do diagrama */}
      <div
        ref={diagramRef}
        data-diagram-canvas
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning ? 'cursor-grabbing' : isConnecting ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{
          backgroundColor: '#f9fafb',
          backgroundImage: showGrid ? `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          ` : 'none',
          backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
          backgroundPosition: `${offset.x % (GRID_SIZE * scale)}px ${offset.y % (GRID_SIZE * scale)}px`
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsPanning(false);
          cancelConnection();
        }}
      >
        {/* Área de trabalho (sem o fundo branco fixo) */}
        <div
          className="absolute"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            minWidth: 4000,
            minHeight: 4000,
            backgroundColor: 'transparent',
            position: 'relative'
          }}
        >
          {/* SVG GLOBAL DE CONEXÕES */}
          <svg
            className="absolute inset-0"
            style={{
              width: '100%',
              height: '100%',
              zIndex: 5,
              pointerEvents: 'auto',
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
            {connections.map((conn: Connection) => {
              const fromCard = cards.find((c: CardType) => c.id === conn.fromCard);
              const toCard = cards.find((c: CardType) => c.id === conn.toCard);

              if (!fromCard || !toCard) return null;

              return (
                <ConnectionLine
                  key={conn.id}
                  fromCard={fromCard}
                  toCard={toCard}
                  connection={conn}
                  isSelected={selectedConnections.has(conn.id)}
                  onClick={(e?: React.MouseEvent) => {
                    e?.stopPropagation();

                    if (e?.ctrlKey || e?.metaKey) {
                      setSelectedConnections(prev => {
                        const updated = new Set(prev);

                        if (updated.has(conn.id)) {
                          updated.delete(conn.id);
                        } else {
                          updated.add(conn.id);
                        }

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
                  connectionType === 'dashed'
                    ? '6,4'
                    : connectionType === 'dotted'
                    ? '2,4'
                    : undefined
                }
                markerEnd="url(#arrow)"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>

          {/* Cards - COM Z-INDEX MAIOR AINDA */}
          <div style={{ position: 'relative', zIndex: 20 }}>
            {cards.map((card: CardType) => (
              <Card
                key={card.id}
                card={card}
                scale={scale}
                offset={offset}
                isSelected={selectedCards.has(card.id)}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (e.ctrlKey) {
                    setSelectedCards((prev: Set<string>) => {
                      const updated = new Set(prev);
                      if (updated.has(card.id)) {
                        updated.delete(card.id);
                      } else {
                        updated.add(card.id);
                      }
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
                    createConnection(
                      connectionStart.cardId, 
                      targetCardId,
                      connectionType,
                      connectionColor
                    );
                  }
                  cancelConnection();
                }}
              />
            ))}
          </div>

          {/* Caixa de seleção - COM Z-INDEX MAIOR */}
          {isDragging && (
            <div style={{ position: 'relative', zIndex: 30 }}>
              <SelectionBox
                start={dragStart}
                end={dragEnd}
              />
            </div>
          )}
        </div>
      </div>

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