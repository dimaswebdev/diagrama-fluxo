'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Link2 } from 'lucide-react';

import type {
  Connection,
  ConnectionRouteStyle,
  ConnectionStrokeWidth,
  ConnectionType,
  ConnectionVariant,
} from '@/types/diagrama';

type Props = {
  connection: Connection;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Connection>) => void;
  onInvert: () => void;
};

const lineTypes: { value: ConnectionType; label: string }[] = [
  { value: 'normal', label: 'Sólida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
];

const routeStyles: { value: ConnectionRouteStyle; label: string }[] = [
  { value: 'bezier', label: 'Bezier' },
  { value: 'orthogonal', label: 'Ortogonal' },
];

const connectionVariants: { value: ConnectionVariant; label: string }[] = [
  { value: 'default', label: 'Padrão' },
  { value: 'emphasis', label: 'Destaque' },
];

const strokeWidths: { value: ConnectionStrokeWidth; label: string }[] = [
  { value: 'thin', label: 'Fina' },
  { value: 'medium', label: 'Média' },
  { value: 'thick', label: 'Grossa' },
];

export default function ConnectionEditDialog({
  connection,
  open,
  onClose,
  onSave,
  onInvert,
}: Props) {
  const [label, setLabel] = useState(connection.label ?? '');
  const [color, setColor] = useState(connection.color ?? '#2563eb');
  const [type, setType] = useState<ConnectionType>(connection.type ?? 'normal');
  const [routeStyle, setRouteStyle] = useState<ConnectionRouteStyle>(connection.routeStyle ?? 'bezier');
  const [variant, setVariant] = useState<ConnectionVariant>(connection.variant ?? 'default');
  const [strokeWidth, setStrokeWidth] = useState<ConnectionStrokeWidth>(connection.strokeWidth ?? 'medium');

  useEffect(() => {
    setLabel(connection.label ?? '');
    setColor(connection.color ?? '#2563eb');
    setType(connection.type ?? 'normal');
    setRouteStyle(connection.routeStyle ?? 'bezier');
    setVariant(connection.variant ?? 'default');
    setStrokeWidth(connection.strokeWidth ?? 'medium');
  }, [connection]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />

      <div className="ui-soft-panel relative w-[min(540px,94vw)] rounded-[28px] border border-white/70 bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/90 bg-cyan-50 text-cyan-700">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/55">
                Conexão
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-800">Editar conexão</h2>
            </div>
          </div>

          <button
            className="ui-hover-surface h-10 w-10 rounded-xl text-slate-500"
            onClick={onClose}
            title="Fechar"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Rótulo</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              placeholder="Descreva esta conexão"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tipo da linha</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ConnectionType)}
                className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              >
                {lineTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Variante</span>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as ConnectionVariant)}
                className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              >
                {connectionVariants.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Espessura</span>
              <select
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(e.target.value as ConnectionStrokeWidth)}
                className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              >
                {strokeWidths.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Estilo da rota</span>
              <select
                value={routeStyle}
                onChange={(e) => setRouteStyle(e.target.value as ConnectionRouteStyle)}
                className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              >
                {routeStyles.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Cor</span>
              <div className="flex items-center gap-3 rounded-xl border border-cyan-100 bg-white px-3 py-2">
                <span className="h-6 w-6 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
            </label>

            <button
              onClick={onInvert}
              className="ui-hover-surface mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-700"
            >
              <ArrowLeftRight className="h-4.5 w-4.5" />
              Inverter
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="ui-active-surface h-11 rounded-xl border border-cyan-200 px-4 text-sm font-medium text-cyan-900"
            onClick={() => onSave({ label, color, type, routeStyle, variant, strokeWidth })}
          >
            Salvar conexão
          </button>
        </div>
      </div>
    </div>
  );
}
