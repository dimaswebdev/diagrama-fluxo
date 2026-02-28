'use client';

import React, { useState, useReducer, useCallback, useRef, useEffect } from 'react';
import type { EvidenceCardData, ConnectionData, InteractionMode } from '@/lib/types';
import { FloatingHeader } from './floating-header';
import { FloatingToolbar } from './floating-toolbar';
import { TimelineCanvas } from './timeline-canvas';
import { EditCardDialog } from './edit-card-dialog';
import { useToast } from '@/hooks/use-toast';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { uid } from 'uid';

const COLOR_PALETTE = [
  "#9ED6F0", "#19B7C6", "#0B8CA6", "#0C3E52", "#F4B53A", "#F39A1F",
  "#F07B1A", "#FF6B6B", "#7C5CFF", "#2DD4BF", "#F59E0B", "#60A5FA",
  "#34D399", "#A78BFA", "#111827",
];

const DEFAULT_STEPS = [
  { id: 1, date: "15/08/2025", label: "NEGOCIAÇÃO", title: "Início da negociação", body: "Contato do Sr. Glaucio Dimas Silva (DIMAS) com Fellipe Correia de Paula (Hardware Advisor) para alinhar a configuração da workstation.", source: "ANEXO 04 [14]", accent: "#9ED6F0" },
  { id: 2, date: "22/08/2025", label: "PROPOSTA", title: "Emissão da Proposta nº 50901", body: "Razor Technologies do Brasil LTDA emite proposta para Workstation Talent XP16GR6, valor R$ 12.480,21.", source: "ANEXO 04_A [13]", accent: "#19B7C6" },
  { id: 3, date: "22/08/2025", label: "ACEITE", title: "Fechamento do pedido", body: "E-mail “Estou de acordo!” formaliza aceite: pagamento à vista de R$ 12.480,21 e prazo de envio 30–45 dias (máx. 06/10/2025).", source: "ANEXO 04 [14] / ANEXO 13 [2]", accent: "#0B8CA6" },
  { id: 4, date: "25/08/2025", label: "PAGAMENTO", title: "Pagamento integral", body: "Pagamento à vista via boleto no valor de R$ 12.480,21 (beneficiário final: Razor Technologies do Brasil LTDA).", source: "ANEXO 05 [9] / Dossiê [3]", accent: "#10b981" },
  { id: 5, date: "26/08/2025", label: "CONFIRMAÇÃO", title: "Confirmação do Pedido nº 34061", body: "Setor de Sucesso do Cliente confirma recebimento e informa previsão de envio para 25/09/2025.", source: "ANEXO 04 [14]", accent: "#F4B53A" },
  { id: 6, date: "04/09/2025", label: "NF-E", title: "Emissão NF-e nº 530", body: "NF-e classificada como “Simples Faturamento”.", source: "ANEXO 06 [7] / Dossiê [3]", accent: "#F39A1F" },
  { id: 7, date: "18/09/2025", label: "ATRASO 1", title: "1º atraso / alegação: escassez", body: "Razor comunica impossibilidade de cumprir prazo (25/09/2025) por escassez de processadores/GPUs e remarca envio para 28/10/2025.", source: "ANEXO 04 [14] / Dossiê [3]", accent: "#F07B1A" },
  { id: 8, date: "21/10/2025", label: "ATRASO 2", title: "2º atraso / alegação: imprevistos", body: "Novo comunicado: “imprevistos fora de controle”; remarca envio para 28/11/2025.", source: "Dossiê [3] / ANEXO 13 [2]", accent: "#ef4444" },
  { id: 9, date: "22/10/2025", label: "NOTIFICAÇÃO", title: "Recusa de prorrogação", body: "Consumidor rejeita prorrogação e exige entrega em 48h ou restituição do valor pago.", source: "ANEXO 13 [2] / Dossiê [3]", accent: "#7C5CFF" },
  { id: 10, date: "21/11/2025", label: "ATRASO 3", title: "Componentes parciais", body: "Empresa informa recebimento parcial de componentes e fixa nova data de envio: 30/12/2025.", source: "Dossiê [3]", accent: "#2DD4BF" },
  { id: 11, date: "23/12/2025", label: "ATRASO 4", title: "Alegação: extravio (fornecedor)", body: "Razor alega extravio pelo fornecedor e promete “última” data de envio: 27/01/2026.", source: "Dossiê [3] / ANEXO 13 [2]", accent: "#F59E0B" },
  { id: 12, date: "01/2026", label: "ENCERRAMENTO", title: "Encerramento das atividades", body: "Comunicado no site oficial informa encerramento das atividades e admite falhas no atendimento (após 27/01/2026).", source: "ANEXO 07 [10] / Dossiê [3]", accent: "#111827" },
  { id: 13, date: "28/01/2026", label: "DOSSIÊ", title: "Elaboração do dossiê jurídico", body: "Formalização do dossiê: não entrega do produto e encerramento das atividades sem ressarcimento.", source: "Dossiê [3]", accent: "#60A5FA" },
  { id: 14, date: "06/02/2026", label: "B.O. (MS)", title: "Registro de ocorrência nº 16/2026", body: "Boletim de Ocorrência na Polícia Civil do MS por Estelionato (Art. 171 do CP).", source: "ANEXO 11 [4]", accent: "#ef4444" },
  { id: 15, date: "09/02/2026", label: "B.O. (RS)", title: "Registro de ocorrência (RS) online", body: "Boletim de Ocorrência na Delegacia Online do RS, também por Estelionato.", source: "ANEXO 12 [5]", accent: "#ef4444" },
];


const positions: Record<number, { x: number; y: number }> = {};
const cols = 5;
const gapX = 340;
const gapY = 300;
DEFAULT_STEPS.forEach((s, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  positions[s.id] = { x: 40 + col * gapX, y: 40 + row * gapY + (col % 2 ? 60 : 0) };
});

const initialCards: EvidenceCardData[] = DEFAULT_STEPS.map((step, index) => ({
    id: `card-${step.id}`,
    sequence: index + 1,
    position: positions[step.id],
    width: 300,
    height: 240,
    title: step.title,
    content: step.body,
    label: step.label,
    date: step.date,
    source: step.source,
    accent: step.accent,
}));

const initialConnections: ConnectionData[] = [];
for (let i = 0; i < DEFAULT_STEPS.length - 1; i++) {
  initialConnections.push({
    id: `conn-${i}`,
    from: `card-${DEFAULT_STEPS[i].id}`,
    to: `card-${DEFAULT_STEPS[i+1].id}`,
  });
}

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
  | { type: 'END_CONNECTION'; payload: string }
  | { type: 'DELETE_CONNECTION'; payload: string };

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'ADD_CARD': {
      const newSequence = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.sequence)) + 1 : 1;
      const accent = COLOR_PALETTE[newSequence % COLOR_PALETTE.length];
      const newCard: EvidenceCardData = {
        id: `card-${uid()}`,
        sequence: newSequence,
        position: { x: 200, y: 200 },
        width: 300,
        height: 240,
        title: `Evidência ${newSequence}`,
        content: 'Edite este conteúdo.',
        label: 'NOVO',
        date: new Date().toLocaleDateString('pt-BR'),
        source: '',
        accent: accent,
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

        const isEditingCardDeleted = state.editingCard && state.selectedCardIds.has(state.editingCard.id);

        return { ...state, cards: reindexedCards, connections: remainingConnections, selectedCardIds: new Set(), editingCard: isEditingCardDeleted ? null : state.editingCard };
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

        // Prevent duplicate connections
        const connectionExists = state.connections.some(
            (conn) =>
                (conn.from === fromId && conn.to === action.payload) ||
                (conn.from === action.payload && conn.to === fromId)
        );
        if (connectionExists) {
            return { ...state, selectedCardIds: new Set(), mode: 'select' };
        }

        const newConnection: ConnectionData = { id: `conn-${uid()}`, from: fromId, to: action.payload };
        return { ...state, connections: [...state.connections, newConnection], selectedCardIds: new Set(), mode: 'select' };
    }
    case 'DELETE_CONNECTION':
        return {
            ...state,
            connections: state.connections.filter(conn => conn.id !== action.payload),
        };
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
        const dataUrl = await htmlToImage.toPng(contentElement as HTMLElement, { 
            quality: 1.0, 
            pixelRatio: 2,
            backgroundColor: 'hsl(var(--background))',
        });
        
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
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (state.editingCard || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'v':
                dispatch({ type: 'SET_MODE', payload: 'select' });
                break;
            case 'c':
                dispatch({ type: 'SET_MODE', payload: 'connect' });
                break;
            case 'n':
                dispatch({ type: 'ADD_CARD' });
                break;
            case 't':
                if (state.selectedCardIds.size === 1) {
                    const cardId = Array.from(state.selectedCardIds)[0];
                    dispatch({ type: 'START_EDITING', payload: cardId });
                }
                break;
            case 'p':
                e.preventDefault();
                handleExportToPDF();
                break;
            case 'delete':
            case 'backspace':
                if (state.selectedCardIds.size > 0) {
                    dispatch({ type: 'DELETE_SELECTED_CARDS' });
                }
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}, [state.selectedCardIds, state.editingCard, handleExportToPDF]);

  return (
    <div className="relative w-full h-full bg-transparent">
      <FloatingHeader />
      <FloatingToolbar 
        mode={state.mode}
        selectedCardIds={state.selectedCardIds}
        onSetMode={(mode) => dispatch({ type: 'SET_MODE', payload: mode })}
        onAddCard={() => dispatch({ type: 'ADD_CARD' })}
        onDeleteCard={() => dispatch({ type: 'DELETE_SELECTED_CARDS'})}
        onEditCard={() => {
          if (state.selectedCardIds.size === 1) {
            const cardId = Array.from(state.selectedCardIds)[0];
            dispatch({ type: 'START_EDITING', payload: cardId });
          }
        }}
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
