// components/Diagrama.tsx
'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Card from './Card';
import ConnectionLine from './ConnectionLine';
import SelectionBox from './SelectionBox';
import FloatingToolbar from './FloatingToolbar';
import { useLocalStorage } from '@/hooks/diagrama/useLocalStorage';
import { useHistory } from '@/hooks/diagrama/useHistory';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type?: 'default' | 'input' | 'output' | 'process' | 'decision';
  color?: string;
}

interface Connection {
  id: string;
  fromCard: string;
  toCard: string;
  type?: 'normal' | 'dashed' | 'dotted';
  color?: string;
  label?: string;
}

interface Point {
  x: number;
  y: number;
}

// Constantes para o grid e A4
const GRID_SIZE = 20;
const A4_WIDTH = 595; // pixels em 72 DPI
const A4_HEIGHT = 842;

const Diagrama: React.FC = () => {
  // Estados principais
  const [cards, setCards] = useLocalStorage<Card[]>('diagram-cards', []);
  const [connections, setConnections] = useLocalStorage<Connection[]>('diagram-connections', []);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useLocalStorage('diagram-filename', 'Diagrama sem título');
  
  // Estados de interação
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Estados de conexão
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ cardId: string; point: Point; type?: string; color?: string } | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Point | null>(null);
  const [connectionType, setConnectionType] = useState<'normal' | 'dashed' | 'dotted'>('normal');
  const [connectionColor, setConnectionColor] = useState('#2563eb');
  
  // Estados de visualização
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [draggedCards, setDraggedCards] = useState<Map<string, { startX: number; startY: number }>>(new Map());
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  
  const diagramRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Histórico para undo/redo
  const { history, canUndo, canRedo, pushState, undo, redo } = useHistory({ cards, connections });

  // Inicializar com um card central se estiver vazio
  useEffect(() => {
    if (cards.length === 0) {
      const centerX = (A4_WIDTH / 2) - 75; // 75 é metade da largura do card
      const centerY = (A4_HEIGHT / 2) - 40; // 40 é metade da altura
      
      const initialCard: Card = {
        id: Date.now().toString(),
        x: centerX,
        y: centerY,
        width: 150,
        height: 80,
        content: 'Card Inicial',
        type: 'default'
      };
      
      pushState({ cards: [initialCard], connections: [] });
      setCards([initialCard]);
      setConnections([]);
    }
  }, []);

  // Salvar estado no histórico antes de mudanças importantes
  const saveToHistory = useCallback(() => {
    pushState({ cards, connections });
  }, [cards, connections, pushState]);

  // Atalhos de teclado com undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+A: Selecionar todos
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        const allCardIds = new Set(cards.map(card => card.id));
        setSelectedCards(allCardIds);
      }

      // Ctrl+Z: Undo
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

      // Ctrl+Y ou Ctrl+Shift+Z: Redo
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

      // Ctrl+N: Novo arquivo
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }

      // Ctrl+S: Salvar
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        // Já está salvando automaticamente com localStorage
      }

      // Ctrl+P: Imprimir/PDF
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }

      // Delete: Excluir selecionados
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }

      // Esc: Cancelar conexão
      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, connections, selectedCards, isConnecting, undo, redo]);

  // Novo arquivo
  const handleNewFile = () => {
    if (window.confirm('Criar novo arquivo? Todas as alterações não salvas serão perdidas.')) {
      const centerX = (A4_WIDTH / 2) - 75;
      const centerY = (A4_HEIGHT / 2) - 40;
      
      const initialCard: Card = {
        id: Date.now().toString(),
        x: centerX,
        y: centerY,
        width: 150,
        height: 80,
        content: 'Card Inicial',
        type: 'default'
      };
      
      pushState({ cards: [initialCard], connections: [] });
      setCards([initialCard]);
      setConnections([]);
      setSelectedCards(new Set());
      setSelectedConnections(new Set());
      setFileName('Diagrama sem título');
    }
  };

  // Imprimir/Salvar como PDF
  const handlePrint = async () => {
    if (!diagramRef.current) return;

    try {
      // Capturar o diagrama como canvas
      const canvas = await html2canvas(diagramRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        allowTaint: false,
        useCORS: true
      });

      // Criar PDF em A4
      const pdf = new jsPDF({
        orientation: A4_WIDTH > A4_HEIGHT ? 'landscape' : 'portrait',
        unit: 'px',
        format: [A4_WIDTH, A4_HEIGHT]
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calcular dimensões para caber no A4
      const imgWidth = A4_WIDTH;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  // Zoom com wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(scale * delta, 0.1), 3);
        
        const rect = diagramRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          setOffset(prev => ({
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

  const handleMouseDown = (e: React.MouseEvent) => {
    // Pan com botão do meio ou Alt + clique
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if ((e.target as HTMLElement).closest('.card')) {
      return;
    }

    if ((e.target as HTMLElement).closest('.connection-line')) {
      return;
    }

    setIsDragging(true);
    const rect = diagramRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;
      setDragStart({ x, y });
      setDragEnd({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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

  const handleMouseUp = (e: React.MouseEvent) => {
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
      saveToHistory(); // Salvar após mover cards
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
      
      cards.forEach(card => {
        if (isCardInSelection(card, selectionBox)) {
          newSelected.add(card.id);
        }
      });

      if (!e.shiftKey) {
        setSelectedCards(newSelected);
      } else {
        setSelectedCards(prev => {
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
    
    if (!selectedCards.has(id) && !e.shiftKey && !e.ctrlKey) {
      setSelectedCards(new Set([id]));
    }

    setIsDraggingCard(true);
    
    const rect = diagramRef.current?.getBoundingClientRect();
    if (rect) {
      const worldX = (e.clientX - rect.left - offset.x) / scale;
      const worldY = (e.clientY - rect.top - offset.y) / scale;
      setDragStart({ x: worldX, y: worldY });
    }
    
    const newDraggedCards = new Map();
    selectedCards.forEach(cardId => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        newDraggedCards.set(cardId, { startX: card.x, startY: card.y });
      }
    });
    
    setDraggedCards(newDraggedCards);
  };

  const moveDraggedCards = (worldX: number, worldY: number) => {
    if (!dragStart) return;

    const deltaX = worldX - dragStart.x;
    const deltaY = worldY - dragStart.y;

    setCards(prev => prev.map(card => {
      const draggedCard = draggedCards.get(card.id);
      if (draggedCard) {
        let newX = draggedCard.startX + deltaX;
        let newY = draggedCard.startY + deltaY;

        // Snap to grid
        if (snapToGrid) {
          newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
          newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        }

        return { ...card, x: newX, y: newY };
      }
      return card;
    }));
  };

  const handleConnectionStart = (cardId: string, point: Point) => {
    setIsConnecting(true);
    setConnectionStart({ 
      cardId, 
      point,
      type: connectionType,
      color: connectionColor 
    });
  };

  const createConnection = (
    fromCard: string, 
    toCard: string, 
    type: 'normal' | 'dashed' | 'dotted' = 'normal',
    color: string = '#2563eb'
  ) => {
    const newConnection: Connection = {
      id: `${fromCard}-${toCard}-${Date.now()}`,
      fromCard,
      toCard,
      type,
      color
    };
    setConnections(prev => [...prev, newConnection]);
    saveToHistory(); // Salvar após criar conexão
  };

  const updateConnection = (id: string, updates: Partial<Connection>) => {
    setConnections(prev => prev.map(conn => 
      conn.id === id ? { ...conn, ...updates } : conn
    ));
    saveToHistory();
  };

  const deleteConnection = (id: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== id));
    setSelectedConnections(prev => {
      const updated = new Set(prev);
      updated.delete(id);
      return updated;
    });
    saveToHistory();
  };

  const cancelConnection = () => {
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnectionEnd(null);
  };

  const deleteSelected = () => {
    // Salvar antes de excluir
    saveToHistory();
    
    setCards(prev => prev.filter(card => !selectedCards.has(card.id)));
    setConnections(prev => prev.filter(conn => 
      !selectedCards.has(conn.fromCard) && 
      !selectedCards.has(conn.toCard) &&
      !selectedConnections.has(conn.id)
    ));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
  };

  const findCardAtPosition = (x: number, y: number): Card | null => {
    return cards.find(card => 
      x >= card.x && x <= card.x + card.width &&
      y >= card.y && y <= card.y + card.height
    ) || null;
  };

  const getSelectionBox = () => {
    return {
      x: Math.min(dragStart.x, dragEnd.x),
      y: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y)
    };
  };

  const isCardInSelection = (card: Card, selection: any) => {
    return (
      card.x < selection.x + selection.width &&
      card.x + card.width > selection.x &&
      card.y < selection.y + selection.height &&
      card.y + card.height > selection.y
    );
  };

  const addCard = (type: Card['type'] = 'default') => {
    saveToHistory();
    
    // Posicionar novo card próximo ao centro da visualização atual
    const viewportCenter = {
      x: (-offset.x / scale) + (containerRef.current?.clientWidth || 0) / (2 * scale),
      y: (-offset.y / scale) + (containerRef.current?.clientHeight || 0) / (2 * scale)
    };

    const newCard: Card = {
      id: Date.now().toString(),
      x: viewportCenter.x - 75,
      y: viewportCenter.y - 40,
      width: 150,
      height: 80,
      content: 'Novo Card',
      type
    };
    setCards(prev => [...prev, newCard]);
  };

  const updateCard = (id: string, updates: Partial<Card>) => {
    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, ...updates } : card
    ));
    saveToHistory();
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
            onChange={(e) => setFileName(e.target.value)}
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
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={selectedCards.size > 0 || selectedConnections.size > 0}
        connectionType={connectionType}
        onConnectionTypeChange={setConnectionType}
        connectionColor={connectionColor}
        onConnectionColorChange={setConnectionColor}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        scale={scale}
        onZoomIn={() => setScale(s => Math.min(s + 0.1, 3))}
        onZoomOut={() => setScale(s => Math.max(s - 0.1, 0.1))}
        onZoomReset={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
      />

      {/* Área do diagrama */}
      <div
        ref={diagramRef}
        className={`flex-1 relative overflow-hidden ${
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
        <div
          className="absolute"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: A4_WIDTH,
            height: A4_HEIGHT,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
            backgroundColor: 'white'
          }}
        >
          {/* SVG para conexões */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: A4_WIDTH, height: A4_HEIGHT }}
          >
            {connections.map(conn => {
              const fromCard = cards.find(c => c.id === conn.fromCard);
              const toCard = cards.find(c => c.id === conn.toCard);
              
              if (fromCard && toCard) {
                return (
                  <ConnectionLine
                    key={conn.id}
                    fromCard={fromCard}
                    toCard={toCard}
                    connection={conn}
                    isSelected={selectedConnections.has(conn.id)}
                    onClick={() => {
                      // Selecionar conexão com clique
                      setSelectedConnections(new Set([conn.id]));
                    }}
                  />
                );
              }
              return null;
            })}

            {isConnecting && connectionStart && tempConnectionEnd && (
              <line
                x1={connectionStart.point.x - offset.x / scale}
                y1={connectionStart.point.y - offset.y / scale}
                x2={tempConnectionEnd.x}
                y2={tempConnectionEnd.y}
                stroke={connectionColor}
                strokeWidth="2"
                strokeDasharray={connectionType === 'dashed' ? '5,5' : connectionType === 'dotted' ? '2,2' : 'none'}
              />
            )}
          </svg>

          {/* Cards */}
          {cards.map(card => (
            <Card
              key={card.id}
              card={card}
              isSelected={selectedCards.has(card.id)}
              onClick={(e) => {
                e.stopPropagation();
                if (e.ctrlKey) {
                  setSelectedCards(prev => {
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
              onDragStart={(e) => handleCardDragStart(card.id, e)}
              onUpdate={(updates) => updateCard(card.id, updates)}
              onConnectionStart={(point) => handleConnectionStart(card.id, point)}
              onConnectionEnd={(targetCardId) => {
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

          {/* Caixa de seleção */}
          {isDragging && (
            <SelectionBox
              start={dragStart}
              end={dragEnd}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Diagrama;