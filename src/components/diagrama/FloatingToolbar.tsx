'use client'

import React from 'react';
import { CardType, ConnectionType } from '@/types/diagrama';

interface FloatingToolbarProps {
  onAddCard: (type?: CardType) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  onNewFile: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  connectionType: ConnectionType;
  onConnectionTypeChange: (type: ConnectionType) => void;
  connectionColor: string;
  onConnectionColorChange: (color: string) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (snap: boolean) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onAddCard,
  onDelete,
  onUndo,
  onRedo,
  onPrint,
  onNewFile,
  canUndo,
  canRedo,
  hasSelection,
  connectionType,
  onConnectionTypeChange,
  connectionColor,
  onConnectionColorChange,
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange,
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) => {
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#000000'
  ];

  const cardTypes: { type: CardType; label: string; color: string }[] = [
    { type: 'default', label: '📄 Normal', color: 'bg-white' },
    { type: 'input', label: '📥 Entrada', color: 'bg-blue-50' },
    { type: 'process', label: '⚙️ Processo', color: 'bg-orange-50' },
    { type: 'output', label: '📤 Saída', color: 'bg-purple-50' },
    { type: 'decision', label: '❓ Decisão', color: 'bg-yellow-50' },
  ];

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-2 backdrop-blur-sm bg-opacity-95">
        {/* Arquivo */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
          <button onClick={onNewFile} className="p-2 hover:bg-gray-100 rounded-lg" title="Novo (Ctrl+N)">📄</button>
          <button onClick={onPrint} className="p-2 hover:bg-gray-100 rounded-lg" title="PDF (Ctrl+P)">🖨️</button>
        </div>

        {/* Editar */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
          <button onClick={onUndo} disabled={!canUndo} className={`p-2 rounded-lg ${canUndo ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}`} title="Desfazer (Ctrl+Z)">↩️</button>
          <button onClick={onRedo} disabled={!canRedo} className={`p-2 rounded-lg ${canRedo ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}`} title="Refazer (Ctrl+Y)">↪️</button>
          <button onClick={onDelete} disabled={!hasSelection} className={`p-2 rounded-lg ${hasSelection ? 'hover:bg-gray-100 text-red-600' : 'opacity-50 cursor-not-allowed'}`} title="Excluir (Delete)">🗑️</button>
        </div>

        {/* Cards */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
          {cardTypes.map(({ type, label, color }) => (
            <button 
              key={type} 
              onClick={() => onAddCard(type)} 
              className={`p-2 hover:bg-gray-100 rounded-lg ${color}`} 
              title={label}
            >
              {label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Conexões */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
          <button 
            onClick={() => onConnectionTypeChange('normal')} 
            className={`p-2 rounded-lg ${connectionType === 'normal' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Linha normal"
          >
            ─
          </button>
          <button 
            onClick={() => onConnectionTypeChange('dashed')} 
            className={`p-2 rounded-lg ${connectionType === 'dashed' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Linha tracejada"
          >
            ┈
          </button>
          <button 
            onClick={() => onConnectionTypeChange('dotted')} 
            className={`p-2 rounded-lg ${connectionType === 'dotted' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Linha pontilhada"
          >
            ┄
          </button>
          
          <div className="flex items-center gap-1 ml-1">
            {colors.map(color => (
              <button 
                key={color} 
                onClick={() => onConnectionColorChange(color)} 
                className={`w-6 h-6 rounded-full border-2 transition-all ${connectionColor === color ? 'border-gray-600 scale-110' : 'border-transparent hover:scale-110'}`} 
                style={{ backgroundColor: color }} 
                title={`Cor: ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
          <button 
            onClick={() => onShowGridChange(!showGrid)} 
            className={`p-2 rounded-lg ${showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Mostrar grid"
          >
            🏁
          </button>
          <button 
            onClick={() => onSnapToGridChange(!snapToGrid)} 
            className={`p-2 rounded-lg ${snapToGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Snap to grid"
          >
            🔲
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={onZoomOut} className="p-2 hover:bg-gray-100 rounded-lg" title="Zoom out">−</button>
          <span className="px-2 text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button onClick={onZoomIn} className="p-2 hover:bg-gray-100 rounded-lg" title="Zoom in">+</button>
          <button onClick={onZoomReset} className="p-2 hover:bg-gray-100 rounded-lg text-xs" title="Reset zoom">100%</button>
        </div>
      </div>
    </div>
  );
};

export default FloatingToolbar;