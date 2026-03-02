'use client';

import React, { useMemo } from 'react';

export type PrintMode = 'fit' | 'crop' | 'scale';

export type PrintOptions = {
  selectionOnly: boolean;
  mode: PrintMode;
  pagesX: number;
  pagesY: number;
  margin: number;      // px no “mundo”
  exportZoom: number;  // escala do mundo no PDF (apenas em crop)
  includeGrid: boolean;
  includeShadows: boolean;
 orientation: 'auto' | 'portrait' | 'landscape';
};

type Props = {
  open: boolean;
  options: PrintOptions;
  onChange: (next: PrintOptions) => void;
  onClose: () => void;
  onConfirm: () => void;
  canSelection: boolean;
  isPrinting?: boolean;
};

const radioRow = 'flex items-center gap-2 py-1';
const inputBase =
  'h-9 w-20 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const btnBase =
  'h-10 rounded-lg px-4 text-sm font-medium transition border';
const btnPrimary =
  'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
const btnGhost =
  'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';

export default function PrintDialog({
  open,
  options,
  onChange,
  onClose,
  onConfirm,
  canSelection,
  isPrinting,
}: Props) {
  const disabledSelection = !canSelection;

  const title = useMemo(() => {
    return 'Imprimir / Exportar PDF';
  }, []);

  if (!open) return null;

  const set = (patch: Partial<PrintOptions>) => onChange({ ...options, ...patch });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => (isPrinting ? null : onClose())}
      />

      <div className="relative w-[520px] max-w-[92vw] rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="text-base font-semibold text-gray-800">{title}</div>
          <button
            className="h-9 w-9 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={() => (isPrinting ? null : onClose())}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* seleção */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={options.selectionOnly}
              onChange={(e) => set({ selectionOnly: e.target.checked })}
              disabled={disabledSelection || isPrinting}
            />
            Apenas seleção
            {disabledSelection && (
              <span className="text-xs text-gray-400">
                (selecione ao menos 1 card)
              </span>
            )}
          </label>

          <div className="h-px bg-gray-200" />

          {/* modos */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-800">Modo</div>

            <label className={radioRow}>
              <input
                type="radio"
                name="mode"
                checked={options.mode === 'fit'}
                onChange={() => set({ mode: 'fit' })}
                disabled={isPrinting}
              />
              <span className="text-sm text-gray-700">Vista da página (ajustar em 1 folha)</span>
            </label>

            <label className={radioRow}>
              <input
                type="radio"
                name="mode"
                checked={options.mode === 'crop'}
                onChange={() => set({ mode: 'crop' })}
                disabled={isPrinting}
              />
              <span className="text-sm text-gray-700">Recortar (multi-página automático)</span>
            </label>

            <label className={radioRow}>
              <input
                type="radio"
                name="mode"
                checked={options.mode === 'scale'}
                onChange={() => set({ mode: 'scale' })}
                disabled={isPrinting}
              />
              <span className="text-sm text-gray-700">Ajustar para X × Y páginas</span>
            </label>
          </div>

          {/* ajuste X/Y */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">Ajustar para</div>
            <div className="flex items-center gap-2">
              <input
                className={inputBase}
                type="number"
                min={1}
                max={20}
                value={options.pagesX}
                onChange={(e) => set({ pagesX: Math.max(1, Number(e.target.value || 1)) })}
                disabled={options.mode !== 'scale' || isPrinting}
              />
              <span className="text-sm text-gray-600">folha(s) na horizontal</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700">por</div>
            <div className="flex items-center gap-2">
              <input
                className={inputBase}
                type="number"
                min={1}
                max={20}
                value={options.pagesY}
                onChange={(e) => set({ pagesY: Math.max(1, Number(e.target.value || 1)) })}
                disabled={options.mode !== 'scale' || isPrinting}
              />
              <span className="text-sm text-gray-600">folha(s) na vertical</span>
            </div>
          </div>

          {/* margem e zoom */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm text-gray-700">Largura da moldura (px)</div>
              <input
                className={inputBase}
                type="number"
                min={0}
                max={400}
                value={options.margin}
                onChange={(e) => set({ margin: Math.max(0, Number(e.target.value || 0)) })}
                disabled={isPrinting}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-gray-700">Zoom do export</div>
              <input
                className={inputBase}
                type="number"
                step={0.1}
                min={0.2}
                max={5}
                value={options.exportZoom}
                onChange={(e) => set({ exportZoom: Math.max(0.2, Number(e.target.value || 1)) })}
                disabled={options.mode !== 'crop' || isPrinting}
              />
              <div className="text-xs text-gray-400">
                (usado apenas em “Recortar”)
              </div>
            </div>
          </div>

          {/* toggles */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={options.includeGrid}
                onChange={(e) => set({ includeGrid: e.target.checked })}
                disabled={isPrinting}
              />
              Grelha
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={options.includeShadows}
                onChange={(e) => set({ includeShadows: e.target.checked })}
                disabled={isPrinting}
              />
              Sombras
            </label>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button className={`${btnBase} ${btnGhost}`} onClick={onClose} disabled={isPrinting}>
            Cancelar
          </button>
          <button className={`${btnBase} ${btnPrimary}`} onClick={onConfirm} disabled={isPrinting}>
            {isPrinting ? 'Gerando…' : 'Imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}