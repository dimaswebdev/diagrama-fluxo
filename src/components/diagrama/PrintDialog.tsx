'use client';

import React from 'react';
import { Check, FileText, Maximize2, Printer, Scissors, Sparkles } from 'lucide-react';

import type { ExportPreview } from '@/hooks/diagrama/useDiagramExport';

export type PrintMode = 'fit' | 'crop' | 'scale';

export type PrintOptions = {
  selectionOnly: boolean;
  mode: PrintMode;
  pagesX: number;
  pagesY: number;
  margin: number;
  exportZoom: number;
  includeGrid: boolean;
  includeShadows: boolean;
  orientation: 'auto' | 'portrait' | 'landscape';
};

type Props = {
  open: boolean;
  options: PrintOptions;
  preview: ExportPreview;
  onChange: (next: PrintOptions) => void;
  onClose: () => void;
  onConfirmPdf: () => void;
  onPrint: () => void;
  canSelection: boolean;
  isPrinting?: boolean;
};

const inputBase =
  'h-10 w-full rounded-xl border border-cyan-100 bg-white/90 px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100';

const optionBase = 'rounded-2xl border px-4 py-3 text-left transition';
const orientationButton = 'rounded-xl border px-3 py-2 text-sm font-medium transition';
const renderPreviewMarkup = (svg: string) => ({ __html: svg });

export default function PrintDialog({
  open,
  options,
  preview,
  onChange,
  onClose,
  onConfirmPdf,
  onPrint,
  canSelection,
  isPrinting,
}: Props) {
  if (!open) return null;

  const set = (patch: Partial<PrintOptions>) => onChange({ ...options, ...patch });
  const previewFrameClass =
    preview.orientation === 'landscape'
      ? 'aspect-[297/210] w-full max-w-[340px]'
      : 'aspect-[210/297] w-full max-w-[260px]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={() => (isPrinting ? null : onClose())}
      />

      <div className="ui-soft-panel relative grid max-h-[92vh] w-[min(1120px,96vw)] grid-cols-1 overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(15,23,42,0.08)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="overflow-y-auto border-b border-cyan-100/80 px-6 py-5 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-700/55">
                Saída
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-800">
                Impressão e exportação ajustadas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Revise a página antes de gerar PDF ou enviar para impressão.
              </p>
            </div>

            <button
              className="ui-hover-surface h-10 w-10 rounded-xl text-slate-500"
              onClick={() => (isPrinting ? null : onClose())}
              title="Fechar"
            >
              ×
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <button
                className={`${optionBase} ${options.mode === 'fit' ? 'border-cyan-200 bg-cyan-50/90 text-cyan-900' : 'border-slate-200/80 bg-white/75 text-slate-600 hover:border-cyan-100 hover:bg-cyan-50/55'}`}
                onClick={() => set({ mode: 'fit' })}
                disabled={isPrinting}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">Ajuste automático</span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  Centraliza o diagrama e encaixa em uma folha.
                </div>
              </button>

              <button
                className={`${optionBase} ${options.mode === 'crop' ? 'border-cyan-200 bg-cyan-50/90 text-cyan-900' : 'border-slate-200/80 bg-white/75 text-slate-600 hover:border-cyan-100 hover:bg-cyan-50/55'}`}
                onClick={() => set({ mode: 'crop' })}
                disabled={isPrinting}
              >
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4" />
                  <span className="text-sm font-semibold">Recortar páginas</span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  Divide em várias folhas mantendo a escala escolhida.
                </div>
              </button>

              <button
                className={`${optionBase} ${options.mode === 'scale' ? 'border-cyan-200 bg-cyan-50/90 text-cyan-900' : 'border-slate-200/80 bg-white/75 text-slate-600 hover:border-cyan-100 hover:bg-cyan-50/55'}`}
                onClick={() => set({ mode: 'scale' })}
                disabled={isPrinting}
              >
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Definir grade</span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  Distribui o conteúdo em X por Y folhas.
                </div>
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">Orientação da folha</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`${orientationButton} ${options.orientation === 'auto' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50/60'}`}
                    onClick={() => set({ orientation: 'auto' })}
                    disabled={isPrinting}
                  >
                    Automática
                  </button>
                  <button
                    className={`${orientationButton} ${options.orientation === 'portrait' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50/60'}`}
                    onClick={() => set({ orientation: 'portrait' })}
                    disabled={isPrinting}
                  >
                    Retrato
                  </button>
                  <button
                    className={`${orientationButton} ${options.orientation === 'landscape' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50/60'}`}
                    onClick={() => set({ orientation: 'landscape' })}
                    disabled={isPrinting}
                  >
                    Paisagem
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">Área exportada</div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={options.selectionOnly}
                    onChange={(e) => set({ selectionOnly: e.target.checked })}
                    disabled={!canSelection || isPrinting}
                  />
                  Apenas seleção
                </label>
                {!canSelection && (
                  <div className="mt-2 text-xs text-slate-400">
                    Selecione ao menos um card para usar esta opção.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">Acabamento da página</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm text-slate-600">Margem interna</span>
                    <input
                      className={inputBase}
                      type="number"
                      min={0}
                      max={400}
                      value={options.margin}
                      onChange={(e) => set({ margin: Math.max(0, Number(e.target.value || 0)) })}
                      disabled={isPrinting}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600">Zoom do recorte</span>
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
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-700">Grade de páginas</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm text-slate-600">Folhas na horizontal</span>
                    <input
                      className={inputBase}
                      type="number"
                      min={1}
                      max={20}
                      value={options.pagesX}
                      onChange={(e) => set({ pagesX: Math.max(1, Number(e.target.value || 1)) })}
                      disabled={options.mode !== 'scale' || isPrinting}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm text-slate-600">Folhas na vertical</span>
                    <input
                      className={inputBase}
                      type="number"
                      min={1}
                      max={20}
                      value={options.pagesY}
                      onChange={(e) => set({ pagesY: Math.max(1, Number(e.target.value || 1)) })}
                      disabled={options.mode !== 'scale' || isPrinting}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700">Elementos visuais</div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={options.includeGrid}
                    onChange={(e) => set({ includeGrid: e.target.checked })}
                    disabled={isPrinting}
                  />
                  Grelha
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
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
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={onClose}
              disabled={isPrinting}
            >
              Cancelar
            </button>
            <button
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-cyan-50"
              onClick={onPrint}
              disabled={isPrinting || !preview.hasContent}
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </span>
            </button>
            <button
              className="ui-active-surface h-11 rounded-xl border border-cyan-200 px-4 text-sm font-medium text-cyan-900"
              onClick={onConfirmPdf}
              disabled={isPrinting || !preview.hasContent}
            >
              {isPrinting ? 'Gerando...' : 'Gerar PDF ajustado'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto bg-[linear-gradient(180deg,rgba(236,254,255,0.55),rgba(255,255,255,0.82))] px-6 py-5">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-700" />
            <div className="text-sm font-semibold text-slate-700">Pré-visualização da página</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/55">
                Página
              </div>
              <div className="mt-2 text-base font-semibold text-slate-800">{preview.pageLabel}</div>
              <div className="mt-1 text-sm text-slate-500">
                {preview.pageWidth} x {preview.pageHeight}px
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/55">
                Ajuste
              </div>
              <div className="mt-2 text-base font-semibold text-slate-800">{preview.scalePercent}%</div>
              <div className="mt-1 text-sm text-slate-500">
                {preview.estimatedPages} {preview.estimatedPages === 1 ? 'folha' : 'folhas'}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/80 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/55">
                  Conteúdo
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Área considerada: {preview.contentWidth} x {preview.contentHeight}px
                </div>
              </div>
              <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                {options.mode === 'fit' ? 'Centralizado' : options.mode === 'crop' ? 'Paginado' : 'Escalado'}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <button
              className="rounded-2xl border border-cyan-100 bg-white/75 px-4 py-3 text-left transition hover:bg-cyan-50/70"
              onClick={() => set({ mode: 'fit', orientation: 'auto', margin: 60 })}
              disabled={isPrinting}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700/55">Preset</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">A4 equilibrado</div>
              <div className="mt-1 text-xs text-slate-500">Padrao para imprimir sem cortes.</div>
            </button>
            <button
              className="rounded-2xl border border-cyan-100 bg-white/75 px-4 py-3 text-left transition hover:bg-cyan-50/70"
              onClick={() => set({ mode: 'fit', orientation: 'landscape', margin: 40 })}
              disabled={isPrinting}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700/55">Preset</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">Apresentacao larga</div>
              <div className="mt-1 text-xs text-slate-500">Melhor para fluxos horizontais.</div>
            </button>
            <button
              className="rounded-2xl border border-cyan-100 bg-white/75 px-4 py-3 text-left transition hover:bg-cyan-50/70"
              onClick={() => set({ mode: 'scale', pagesX: 2, pagesY: 1, orientation: 'landscape' })}
              disabled={isPrinting}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700/55">Preset</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">Painel em 2 folhas</div>
              <div className="mt-1 text-xs text-slate-500">Amplia sem perder leitura.</div>
            </button>
          </div>

          <div className="mt-4 rounded-[26px] border border-white/80 bg-white/72 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            {preview.previewSvg ? (
              <div className="relative overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(224,247,250,0.45),rgba(255,255,255,0.92))] px-4 py-5">
                <div className="flex min-h-[340px] items-center justify-center">
                  <div className={`flex items-center justify-center ${previewFrameClass}`}>
                    <div className="w-full rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[12px] border border-slate-100 bg-white">
                        <div
                          className="flex h-full w-full items-center justify-center [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-full"
                          dangerouslySetInnerHTML={renderPreviewMarkup(preview.previewSvg)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-white/70 px-6 text-center text-sm text-slate-400">
                Crie ou selecione cards para gerar a prévia de impressão.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-600">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-cyan-700" />
              <div>
                A prévia agora usa enquadramento real de folha, e a impressão segue o mesmo ajuste do PDF.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
