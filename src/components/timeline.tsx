'use client';

import React, { useState, useReducer, useCallback, useRef } from 'react';
import type { EvidenceCardData, ConnectionData, InteractionMode } from '@/lib/types';
import { FloatingHeader } from './floating-header';
import { FloatingToolbar } from './floating-toolbar';
import { TimelineCanvas } from './timeline-canvas';
import { EditCardDialog } from './edit-card-dialog';
import { useToast } from '@/hooks/use-toast';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';

const initialCards: EvidenceCardData[] = [
  {
    id: 'card-1',
    sequence: 1,
    position: { x: 100, y: 150 },
    width: 300,
    height: 200,
    title: 'Evidência A',
    content: 'Conteúdo inicial da evidência A. Descreve o primeiro evento chave na linha do tempo.',
  },
  {
    id: 'card-2',
    sequence: 2,
    position: { x: 500, y: 250 },
    width: 300,
    height: 200,
    title: 'Evidência B',
    content: 'Conteúdo inicial da evidência B. Conecta-se à Evidência A e detalha o desenvolvimento subsequente.',
  },
];

const initialConnections: ConnectionData[] = [
  { id: 'conn-1', from: 'card-1', to: 'card-2' },
];

type TimelineState = {
  cards: EvidenceCardData[];
  connections: ConnectionData[];
  selectedCardIds: Set<string>;
  mode: InteractionMode;
  editingCard: EvidenceCardData | null;
};

type TimelineAction =
  | { type: 'ADD_CARD' }
  | { type: 'DELETE_SELECTED_CARDS' }
  | { type: 'UPDATE_CARD'; payload: Partial<EvidenceCardData> & { id: string } }
  | { type: 'MOVE_CARDS'; payload: { cardId: string; delta: { x: number; y: number } } }
  | { type: 'SET_MODE'; payload: InteractionMode }
  | { type: 'SET_SELECTED_CARDS'; payload: Set<string> }
  | { type: 'START_EDITING'; payload: string }
  | { type: 'STOP_EDITING' }
  | { type: 'START_CONNECTION'; payload: string }
  | { type: 'END_CONNECTION'; payload: string };

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'ADD_CARD': {
      const newSequence = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.sequence)) + 1 : 1;
      const newCard: EvidenceCardData = {
        id: `card-${Date.now()}`,
        sequence: newSequence,
        position: { x: 200, y: 200 },
        width: 300,
        height: 200,
        title: `Evidência ${newSequence}`,
        content: '',
      };
      return { ...state, cards: [...state.cards, newCard] };
    }
    case 'DELETE_SELECTED_CARDS': {
        if (state.selectedCardIds.size === 0) return state;
        const remainingCards = state.cards.filter(card => !state.selectedCardIds.has(card.id));
        const remainingConnections = state.connections.filter(conn => !state.selectedCardIds.has(conn.from) && !state.selectedCardIds.has(conn.to));
        
        const sortedRemainingCards = [...remainingCards].sort((a, b) => a.sequence - b.sequence);
        const reindexedCards = sortedRemainingCards.map((card, index) => ({
            ...card,
            sequence: index + 1,
        }));

        return { ...state, cards: reindexedCards, connections: remainingConnections, selectedCardIds: new Set() };
    }
    case 'UPDATE_CARD':
      return {
        ...state,
        cards: state.cards.map(card =>
          card.id === action.payload.id ? { ...card, ...action.payload } : card
        ),
        editingCard: state.editingCard && state.editingCard.id === action.payload.id
          ? { ...state.editingCard, ...action.payload }
          : state.editingCard
      };
    case 'MOVE_CARDS': {
        const { cardId, delta } = action.payload;
        const isSelected = state.selectedCardIds.has(cardId);
        
        return {
            ...state,
            cards: state.cards.map(card => {
                if ((isSelected && state.selectedCardIds.has(card.id)) || (!isSelected && card.id === cardId)) {
                    return { ...card, position: { x: card.position.x + delta.x, y: card.position.y + delta.y } };
                }
                return card;
            }),
        };
    }
    case 'SET_MODE':
      return { ...state, mode: action.payload, selectedCardIds: new Set() };
    case 'SET_SELECTED_CARDS':
      return { ...state, selectedCardIds: action.payload };
    case 'START_EDITING':
        const cardToEdit = state.cards.find(c => c.id === action.payload);
        return { ...state, editingCard: cardToEdit || null };
    case 'STOP_EDITING':
        return {...state, editingCard: null};
    case 'START_CONNECTION':
        return { ...state, selectedCardIds: new Set([action.payload]) };
    case 'END_CONNECTION': {
        const fromId = Array.from(state.selectedCardIds)[0];
        if (!fromId || fromId === action.payload) return { ...state, selectedCardIds: new Set() };
        const newConnection: ConnectionData = { id: `conn-${Date.now()}`, from: fromId, to: action.payload };
        return { ...state, connections: [...state.connections, newConnection], selectedCardIds: new Set(), mode: 'select' };
    }
    default:
      return state;
  }
}

export function Timeline() {
  const [state, dispatch] = useReducer(timelineReducer, {
    cards: initialCards,
    connections: initialConnections,
    selectedCardIds: new Set(),
    mode: 'select',
    editingCard: null,
  });

  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleExportToPDF = useCallback(async () => {
    if (!canvasRef.current) {
        toast({ title: 'Erro', description: 'Não foi possível encontrar a área do canvas.', variant: 'destructive' });
        return;
    }

    const contentElement = canvasRef.current.querySelector('[data-canvas-content="true"]');
    if (!contentElement) {
        toast({ title: 'Erro', description: 'Não foi possível encontrar o conteúdo do canvas.', variant: 'destructive' });
        return;
    }

    try {
        const dataUrl = await htmlToImage.toPng(contentElement as HTMLElement, { quality: 1.0, pixelRatio: 2 });
        
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = img.width;
            const imgHeight = img.height;

            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const newImgWidth = imgWidth * ratio;
            const newImgHeight = imgHeight * ratio;

            const x = (pdfWidth - newImgWidth) / 2;
            const y = (pdfHeight - newImgHeight) / 2;

            pdf.addImage(dataUrl, 'PNG', x, y, newImgWidth, newImgHeight);
            pdf.save('cronograma-evidencia.pdf');
            toast({ title: 'Sucesso', description: 'O seu PDF foi exportado com sucesso.' });
        }
    } catch (error) {
        console.error('oops, something went wrong!', error);
        toast({ title: 'Erro de Exportação', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    }
  }, [toast]);

  return (
    <div className="relative w-full h-full bg-transparent">
      <FloatingHeader />
      <FloatingToolbar 
        mode={state.mode}
        onSetMode={(mode) => dispatch({ type: 'SET_MODE', payload: mode })}
        onAddCard={() => dispatch({ type: 'ADD_CARD' })}
        onDeleteCard={() => dispatch({ type: 'DELETE_SELECTED_CARDS'})}
        onExport={handleExportToPDF}
      />
      <TimelineCanvas
        ref={canvasRef}
        cards={state.cards}
        connections={state.connections}
        mode={state.mode}
        selectedCardIds={state.selectedCardIds}
        dispatch={dispatch}
      />
      {state.editingCard && (
        <EditCardDialog
          card={state.editingCard}
          onSave={(updatedCard) => dispatch({ type: 'UPDATE_CARD', payload: updatedCard })}
          onClose={() => dispatch({ type: 'STOP_EDITING' })}
        />
      )}
    </div>
  );
}
