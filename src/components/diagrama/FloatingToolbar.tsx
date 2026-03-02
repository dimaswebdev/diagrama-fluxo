'use client';

import React from 'react';
import {
  FilePlus2,
  Printer,
  Undo2,
  Redo2,
  Trash2,
  Square,
  LogIn,
  Settings2,
  LogOut,
  HelpCircle,
  Minus,
  Plus,
  Grid3X3,
  Magnet,
  PencilRuler,
} from 'lucide-react';

import { CardType, ConnectionType } from '@/types/diagrama';

interface FloatingToolbarProps {
  onAddCard: (type?: CardType) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  onNewFile: () => void;
  onEdit: () => void;

  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;

  connectionType: ConnectionType;
  onConnectionTypeChange: (type: ConnectionType) => void;

  cardColor: string;
  onCardColorChange: (color: string) => void;

  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;

  snapToGrid: boolean;
  onSnapToGridChange: (snap: boolean) => void;

  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const iconBtnBase =
  'inline-flex items-center justify-center h-9 w-9 rounded-lg transition-all border border-transparent';

const iconBtnEnabled =
  'hover:bg-gray-100 active:bg-gray-200 text-gray-700';

const iconBtnDisabled =
  'opacity-40 cursor-not-allowed text-gray-400';

const iconBtnActive =
  'bg-indigo-100 text-indigo-700 border-indigo-200';

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

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onAddCard,
  onDelete,
  onUndo,
  onRedo,
  onPrint,
  onNewFile,
  onEdit,
  canUndo,
  canRedo,
  hasSelection,
  connectionType,
  onConnectionTypeChange,
  cardColor,
  onCardColorChange,
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange,
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) => {

  const cardTypes: { type: CardType; label: string; Icon: React.ElementType }[] = [
    { type: 'default', label: 'Normal', Icon: Square },
    { type: 'input', label: 'Entrada', Icon: LogIn },
    { type: 'process', label: 'Processo', Icon: Settings2 },
    { type: 'output', label: 'Saída', Icon: LogOut },
    { type: 'decision', label: 'Decisão', Icon: HelpCircle },
  ];

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow border border-gray-200 px-3 py-2 flex items-center gap-3">

        {/* ARQUIVO */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          <button
            onClick={onNewFile}
            className={`${iconBtnBase} ${iconBtnEnabled}`}
            title="Novo"
          >
            <FilePlus2 className="w-5 h-5" />
          </button>

          <button
            onClick={onPrint}
            className={`${iconBtnBase} ${iconBtnEnabled}`}
            title="Exportar PDF"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>

        {/* EDIÇÃO */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`${iconBtnBase} ${canUndo ? iconBtnEnabled : iconBtnDisabled}`}
            title="Desfazer"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`${iconBtnBase} ${canRedo ? iconBtnEnabled : iconBtnDisabled}`}
            title="Refazer"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          <button
            onClick={onEdit}
            disabled={!hasSelection}
            className={`${iconBtnBase} ${
              hasSelection ? 'hover:bg-indigo-50 text-indigo-600' : iconBtnDisabled
            }`}
            title="Editar Card"
          >
            <PencilRuler className="w-5 h-5" />
          </button>

          <button
            onClick={onDelete}
            disabled={!hasSelection}
            className={`${iconBtnBase} ${
              hasSelection ? 'hover:bg-red-50 text-red-600' : iconBtnDisabled
            }`}
            title="Excluir"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* TIPOS DE CARD */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          {cardTypes.map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={() => onAddCard(type)}
              className={`${iconBtnBase} ${iconBtnEnabled}`}
              title={`Adicionar card: ${label}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* COR DO CARD */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          {CARD_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onCardColorChange(color)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                cardColor === color
                  ? 'border-gray-800 scale-110'
                  : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
              title={`Cor: ${color}`}
            />
          ))}
        </div>

        {/* GRID */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          <button
            onClick={() => onShowGridChange(!showGrid)}
            className={`${iconBtnBase} ${showGrid ? iconBtnActive : iconBtnEnabled}`}
            title="Mostrar grid"
          >
            <Grid3X3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => onSnapToGridChange(!snapToGrid)}
            className={`${iconBtnBase} ${snapToGrid ? iconBtnActive : iconBtnEnabled}`}
            title="Snap to grid"
          >
            <Magnet className="w-5 h-5" />
          </button>
        </div>

        {/* ZOOM */}
        <div className="flex items-center gap-1">
          <button
            onClick={onZoomOut}
            className={`${iconBtnBase} ${iconBtnEnabled}`}
            title="Zoom out"
          >
            <Minus className="w-5 h-5" />
          </button>

          <button
            onClick={onZoomReset}
            className="h-9 px-2 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={onZoomIn}
            className={`${iconBtnBase} ${iconBtnEnabled}`}
            title="Zoom in"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default FloatingToolbar;