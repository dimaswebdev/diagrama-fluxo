'use client';

import React from 'react';
import {
  Copy,
  Clipboard,
  ChevronDown,
  FilePlus2,
  Printer,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';

interface DiagramHeaderProps {
  fileName: string;
  onFileNameChange: (value: string) => void;
  showSaveMenu: boolean;
  saveMenuRef: React.RefObject<HTMLDivElement | null>;
  onToggleSaveMenu: () => void;
  onNewFile: () => void;
  onSavePng: () => void;
  onSaveSvg: () => void;
  onSavePdf: () => void;
  onPrint: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canEdit: boolean;
  onEdit: () => void;
  canDuplicate: boolean;
  onDuplicate: () => void;
  canGroup: boolean;
  onGroup: () => void;
  canUngroup: boolean;
  onUngroup: () => void;
  canDelete: boolean;
  onDelete: () => void;
  cardsCount: number;
  connectionsCount: number;
}

export default function DiagramHeader({
  fileName,
  onFileNameChange,
  showSaveMenu,
  saveMenuRef,
  onToggleSaveMenu,
  onNewFile,
  onSavePng,
  onSaveSvg,
  onSavePdf,
  onPrint,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canEdit,
  onEdit,
  canDuplicate,
  onDuplicate,
  canGroup,
  onGroup,
  canUngroup,
  onUngroup,
  canDelete,
  onDelete,
  cardsCount,
  connectionsCount,
}: DiagramHeaderProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col gap-3 px-5 pt-4 xl:flex-row xl:items-start xl:justify-between">
      <div
        className="pointer-events-auto flex items-center gap-3 self-start rounded-[12px] px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
        style={{
          backgroundColor: 'rgba(37, 99, 235, 0.10)',
          color: 'rgba(11, 140, 166, 1)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#2563EB] shadow-[0_4px_12px_rgba(14,165,233,0.10)]">
          <Clipboard className="h-10 w-10" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-800">
            Diagrama de Fluxo
          </div>
          <input
            type="text"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            className="mt-1 w-full min-w-[220px] max-w-[460px] rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-semibold text-[#2563EB] outline-none transition hover:border-cyan-100 hover:bg-white/70 focus:border-cyan-200 focus:bg-white/80"
          />
        </div>
      </div>

      <div
        className="pointer-events-auto flex flex-wrap items-center justify-end gap-3 self-end xl:self-start"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ui-soft-panel flex items-center gap-2 rounded-2xl px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Arquivo
          </span>
          <button
            onClick={onNewFile}
            className="ui-hover-surface flex h-10 w-10 items-center justify-center rounded-xl"
            title="Novo arquivo"
          >
            <FilePlus2 className="h-4.5 w-4.5" />
          </button>
          <div className="relative" ref={saveMenuRef}>
            <button
              onClick={onToggleSaveMenu}
              className="ui-hover-surface flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium"
              title="Salvar"
            >
              <Save className="h-4.5 w-4.5" />
              <span>Salvar</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {showSaveMenu && (
              <div className="absolute right-0 top-12 min-w-[180px] rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
                <button
                  onClick={onSavePng}
                  className="ui-hover-surface block w-full rounded-xl px-3 py-2 text-left text-sm"
                >
                  Salvar como PNG
                </button>
                <button
                  onClick={onSaveSvg}
                  className="ui-hover-surface block w-full rounded-xl px-3 py-2 text-left text-sm"
                >
                  Salvar como SVG
                </button>
                <button
                  onClick={onSavePdf}
                  className="ui-hover-surface block w-full rounded-xl px-3 py-2 text-left text-sm"
                >
                  Salvar como PDF
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onPrint}
            className="ui-hover-surface flex h-10 w-10 items-center justify-center rounded-xl"
            title="Imprimir"
          >
            <Printer className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="ui-soft-panel flex items-center gap-2 rounded-2xl px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Edição
          </span>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canUndo ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Desfazer"
          >
            <Undo2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canRedo ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Refazer"
          >
            <Redo2 className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onEdit}
            disabled={!canEdit}
            className={`flex rounded-xl px-3 py-2 text-sm font-medium transition ${
              canEdit ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Editar selecionado"
          >
            Editar
          </button>
          <button
            onClick={onDuplicate}
            disabled={!canDuplicate}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canDuplicate ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Duplicar selecionado"
          >
            <Copy className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onGroup}
            disabled={!canGroup}
            className={`flex rounded-xl px-3 py-2 text-sm font-medium transition ${
              canGroup ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Agrupar selecionados"
          >
            Agrupar
          </button>
          <button
            onClick={onUngroup}
            disabled={!canUngroup}
            className={`flex rounded-xl px-3 py-2 text-sm font-medium transition ${
              canUngroup ? 'ui-active-surface' : 'ui-disabled-surface'
            }`}
            title="Desagrupar selecionados"
          >
            Desagrupar
          </button>
          <button
            onClick={onDelete}
            disabled={!canDelete}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canDelete ? 'ui-destructive-surface' : 'ui-disabled-surface'
            }`}
            title="Excluir selecionado"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div
            className="rounded-xl px-3 py-1.5 font-medium"
            style={{
              backgroundColor: 'rgba(11, 140, 166, 0.10)',
              border: '1px solid rgba(11, 140, 166, 1)',
              color: 'rgba(11, 140, 166, 1)',
            }}
          >
            {cardsCount} cards
          </div>
          <div
            className="rounded-xl px-3 py-1.5 font-medium"
            style={{
              backgroundColor: 'rgba(244, 181, 58, 0.10)',
              border: '1px solid rgba(244, 181, 58, 1)',
              color: 'rgba(180, 118, 8, 1)',
            }}
          >
            {connectionsCount} conexões
          </div>
        </div>
      </div>
    </div>
  );
}
