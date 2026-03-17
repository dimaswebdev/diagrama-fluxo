'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BringToFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Layers3,
  Palette,
  Pipette,
  Route,
  SendToBack,
  SlidersHorizontal,
  Type,
  X,
} from 'lucide-react';

import type {
  Card,
  Connection,
  ConnectionStrokeWidth,
  ConnectionRouteStyle,
  ConnectionType,
  ConnectionVariant,
  DiagramText,
  GroupBox,
  TextStyle,
} from '@/types/diagrama';

type Selection =
  | { kind: 'card'; item: Card }
  | { kind: 'text'; item: DiagramText }
  | { kind: 'group'; item: GroupBox }
  | { kind: 'connection'; item: Connection };

interface PropertiesPanelProps {
  selection: Selection | null;
  onClose: () => void;
  onAccentChange: (value: string) => void;
  onTextColorChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
  onFontWeightChange: (value: 400 | 500 | 600 | 700) => void;
  onTextAlignChange: (value: 'left' | 'center' | 'right') => void;
  onTextRotationChange: (value: -90 | 0 | 90) => void;
  onBackgroundOpacityChange: (value: number) => void;
  onGroupTitleVisibilityChange: (value: boolean) => void;
  onConnectionLabelChange: (value: string) => void;
  onConnectionTypeChange: (value: ConnectionType) => void;
  onConnectionRouteStyleChange: (value: ConnectionRouteStyle) => void;
  onConnectionVariantChange: (value: ConnectionVariant) => void;
  onConnectionStrokeWidthChange: (value: ConnectionStrokeWidth) => void;
  onLayerChange: (direction: 'front' | 'forward' | 'backward' | 'back') => void;
}

type SectionId = 'colors' | 'typography' | 'appearance' | 'layers' | 'label' | 'line';

const STORAGE_KEY = 'diagram-properties-panel-position';
const PANEL_DOCK_PADDING = 16;
const PANEL_TOP_SAFE_AREA = 96;
const EXPANDED_PANEL_WIDTH = 224;
const COLLAPSED_PANEL_WIDTH = 68;
const DEFAULT_PANEL_HEIGHT = 460;

const accentSwatches = ['#2563EB', '#19B7C6', '#0B8CA6', '#34D399', '#F4B53A', '#F07B1A', '#FF6B6B', '#111827'];
const textSwatches = ['#111827', '#334155', '#475569', '#0B8CA6', '#2563EB', '#F07B1A', '#DC2626', '#FFFFFF'];

const sectionLabel: Record<SectionId, string> = {
  colors: 'Cores',
  typography: 'Tipografia',
  appearance: 'Aparência',
  layers: 'Camadas',
  label: 'Rótulo',
  line: 'Linha',
};

const sectionIcon: Record<SectionId, React.ElementType> = {
  colors: Palette,
  typography: Type,
  appearance: SlidersHorizontal,
  layers: Layers3,
  label: Type,
  line: Route,
};

const getStyle = (selection: Selection | null): TextStyle | null => {
  if (!selection) return null;
  if (selection.kind === 'group') return selection.item.titleStyle;
  if (selection.kind === 'connection') return null;
  return selection.item.textStyle ?? null;
};

const getBackgroundOpacityPercent = (background?: string) => {
  if (!background) return 0;
  const rgbaMatch = background.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
  if (rgbaMatch) return Math.round(Number(rgbaMatch[1]) * 100);
  const hexMatch = background.match(/#(?:[0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hexMatch) return Math.round((parseInt(hexMatch[1], 16) / 255) * 100);
  return 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#000000';
  return trimmed.startsWith('#') ? trimmed.slice(0, 7) : `#${trimmed}`.slice(0, 7);
};

const getDefaultPanelPosition = (width: number, height = DEFAULT_PANEL_HEIGHT) => ({
  x: Math.max(PANEL_DOCK_PADDING, window.innerWidth - width - PANEL_DOCK_PADDING),
  y: Math.max(PANEL_TOP_SAFE_AREA, Math.round((window.innerHeight - height) / 2)),
});

const getRightSideMinX = (width: number) => {
  const maxX = Math.max(PANEL_DOCK_PADDING, window.innerWidth - width - PANEL_DOCK_PADDING);
  const preferredMinX = Math.floor(window.innerWidth / 2);
  return Math.min(maxX, Math.max(PANEL_DOCK_PADDING, preferredMinX));
};

const getClampedPanelPosition = (x: number, y: number, width: number, height: number) => {
  const minX = getRightSideMinX(width);
  const maxX = Math.max(PANEL_DOCK_PADDING, window.innerWidth - width - PANEL_DOCK_PADDING);
  const maxY = Math.max(PANEL_TOP_SAFE_AREA, window.innerHeight - height - PANEL_DOCK_PADDING);
  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, PANEL_TOP_SAFE_AREA, maxY),
  };
};

function SwatchButton({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={color}
      onClick={onClick}
      className={`relative h-7 w-7 rounded-full border transition ${
        active
          ? 'scale-105 border-slate-300 shadow-[0_0_0_1px_rgba(226,232,240,0.95),0_6px_14px_rgba(15,23,42,0.08)]'
          : 'border-white/90 hover:scale-105 hover:border-slate-200'
      }`}
      style={{ backgroundColor: color }}
    >
      {active && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className={`h-3.5 w-3.5 ${color.toLowerCase() === '#ffffff' ? 'text-slate-700' : 'text-white'}`} />
        </span>
      )}
    </button>
  );
}

function EyeDropperButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const canUseEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const pickColor = async () => {
    if (!canUseEyeDropper) return;
    const EyeDropperCtor = (
      window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }
    ).EyeDropper;
    if (!EyeDropperCtor) return;
    try {
      const eyeDropper = new EyeDropperCtor();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch {
      // ignore cancelled pick
    }
  };

  return (
    <button
      type="button"
      onClick={pickColor}
      disabled={!canUseEyeDropper}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-45"
      title={canUseEyeDropper ? `Capturar cor (${value})` : 'Conta-gotas indisponível'}
    >
      <Pipette className="h-4 w-4" />
    </button>
  );
}

function ColorField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeHex(value);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="rounded-2xl border border-slate-200/80 bg-white/72 p-3">
        <div className="mb-2.5 flex min-w-0 items-center gap-2">
          <div
            className="h-10 w-10 rounded-2xl border border-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
            style={{ backgroundColor: normalizedValue }}
          />
          <label className="flex h-10 min-w-0 w-[104px] items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span className="mr-2">HEX</span>
            <input
              value={normalizedValue}
              onChange={(event) => onChange(normalizeHex(event.target.value))}
              className="w-full bg-transparent text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"
            />
          </label>
          <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300">
            <input
              type="color"
              value={normalizedValue}
              onChange={(event) => onChange(event.target.value)}
              className="sr-only"
            />
            <div className="h-4 w-4 rounded-md border border-slate-200" style={{ backgroundColor: normalizedValue }} />
          </label>
          <EyeDropperButton value={normalizedValue} onChange={onChange} />
        </div>
        <div className="grid grid-cols-8 gap-2">
          {swatches.map((swatch) => (
            <SwatchButton
              key={swatch}
              color={swatch}
              active={normalizedValue.toLowerCase() === swatch.toLowerCase()}
              onClick={() => onChange(swatch)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlignButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
        active
          ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
      title={label}
    >
      {children}
    </button>
  );
}

export default function PropertiesPanel({
  selection,
  onClose,
  onAccentChange,
  onTextColorChange,
  onFontSizeChange,
  onFontWeightChange,
  onTextAlignChange,
  onTextRotationChange,
  onBackgroundOpacityChange,
  onGroupTitleVisibilityChange,
  onConnectionLabelChange,
  onConnectionTypeChange,
  onConnectionRouteStyleChange,
  onConnectionVariantChange,
  onConnectionStrokeWidthChange,
  onLayerChange,
}: PropertiesPanelProps) {
  const style = useMemo(() => getStyle(selection), [selection]);
  const selectionIdentity = selection ? `${selection.kind}:${selection.item.id}` : null;
  const [position, setPosition] = useState({ x: 16, y: 112 });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [pinnedSection, setPinnedSection] = useState<SectionId | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 720 });
  const panelRef = useRef<HTMLDivElement>(null);
  const moduleButtonRefs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({});
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setPosition(getDefaultPanelPosition(COLLAPSED_PANEL_WIDTH));
        return;
      }
      const parsed = JSON.parse(raw) as { x?: number; y?: number; collapsed?: boolean };
      const collapsed = parsed.collapsed ?? true;
      const width = collapsed ? COLLAPSED_PANEL_WIDTH : EXPANDED_PANEL_WIDTH;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setPosition(getClampedPanelPosition(parsed.x, parsed.y, width, DEFAULT_PANEL_HEIGHT));
      } else {
        setPosition(getDefaultPanelPosition(width));
      }
      if (typeof parsed.collapsed === 'boolean') {
        setIsCollapsed(parsed.collapsed);
      }
    } catch {
      // ignore persistence failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...position, collapsed: isCollapsed }));
    } catch {
      // ignore persistence failures
    }
  }, [isCollapsed, position]);

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;

      const deltaX = event.clientX - dragStateRef.current.startX;
      const deltaY = event.clientY - dragStateRef.current.startY;
      const panelWidth = panelRef.current?.offsetWidth ?? (isCollapsed ? COLLAPSED_PANEL_WIDTH : EXPANDED_PANEL_WIDTH);
      const panelHeight = panelRef.current?.offsetHeight ?? DEFAULT_PANEL_HEIGHT;
      const minX = getRightSideMinX(panelWidth);
      const maxX = Math.max(PANEL_DOCK_PADDING, window.innerWidth - panelWidth - PANEL_DOCK_PADDING);
      const maxY = Math.max(PANEL_TOP_SAFE_AREA, window.innerHeight - panelHeight - PANEL_DOCK_PADDING);

      setPosition({
        x: clamp(dragStateRef.current.originX + deltaX, minX, maxX),
        y: clamp(dragStateRef.current.originY + deltaY, PANEL_TOP_SAFE_AREA, maxY),
      });
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = '';
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isCollapsed]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, label')) return;
    event.preventDefault();
    document.body.style.userSelect = 'none';
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  };

  useEffect(() => {
    if (!selectionIdentity) return;
    setIsCollapsed(false);
    setPosition(getDefaultPanelPosition(EXPANDED_PANEL_WIDTH));
    setPinnedSection(null);
    setActiveSection(null);
  }, [selectionIdentity]);

  const title = selection
    ? selection.kind === 'card'
      ? 'Card'
      : selection.kind === 'text'
      ? 'Texto'
      : selection.kind === 'group'
      ? 'Agrupamento'
      : 'Conexão'
    : '';

  const accent = selection
    ? selection.kind === 'connection'
      ? selection.item.color ?? '#2563EB'
      : selection.item.accent
    : '#2563EB';

  const backgroundOpacity = selection
    ? selection.kind === 'text'
      ? getBackgroundOpacityPercent(selection.item.background)
      : selection.kind === 'group'
      ? getBackgroundOpacityPercent(selection.item.background)
      : 0
    : 0;
  const showGroupTitle = selection?.kind === 'group' ? selection.item.showTitle ?? true : true;

  const hasTypography = selection ? selection.kind !== 'connection' : false;
  const canAdjustBackground = selection ? selection.kind === 'text' || selection.kind === 'group' : false;
  const canAdjustLayer = selection ? selection.kind !== 'connection' : false;
  const currentAlign = style?.textAlign ?? 'left';
  const currentFontSize = style?.fontSize ?? 14;
  const currentRotation = selection?.kind === 'text' ? selection.item.rotation ?? 0 : 0;
  const panelWidth = isCollapsed ? COLLAPSED_PANEL_WIDTH : EXPANDED_PANEL_WIDTH;
  const isRightSide = position.x + panelWidth / 2 > viewportSize.width / 2;
  const flyoutSide = isRightSide ? 'left' : 'right';
  const availableSections = useMemo<SectionId[]>(
    () =>
      selection
        ? selection.kind === 'connection'
          ? ['label', 'colors', 'line']
          : ['colors', 'typography', ...(canAdjustBackground ? (['appearance'] as SectionId[]) : []), 'layers']
        : [],
    [canAdjustBackground, selection]
  );

  useEffect(() => {
    if (activeSection && !availableSections.includes(activeSection)) {
      setActiveSection(null);
      setPinnedSection(null);
    }
  }, [activeSection, availableSections]);

  if (!selection) return null;

  const getButtonOffsetTop = (element: HTMLElement | null) => {
    const containerRect = panelRef.current?.getBoundingClientRect();
    const buttonRect = element?.getBoundingClientRect();
    if (!containerRect || !buttonRect) return 0;
    return buttonRect.top - containerRect.top;
  };

  const getPanelTopStyle = (offsetTop: number, panelHeight: number) => {
    const top = Math.min(
      Math.max(0, offsetTop),
      Math.max(0, viewportSize.height - position.y - panelHeight - 24)
    );
    return `${top}px`;
  };

  const flyoutTop = activeSection
    ? getPanelTopStyle(getButtonOffsetTop(moduleButtonRefs.current[activeSection] ?? null), 320)
    : '0px';

  const sectionButtonClass = (active: boolean) =>
    `flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
      active ? 'ui-active-surface' : 'ui-hover-surface'
    } ${isCollapsed ? 'justify-center px-0 w-11 h-11' : ''}`;

  const renderSection = () => {
    if (!activeSection) return null;

    if (activeSection === 'label' && selection.kind === 'connection') {
      return (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Rótulo</span>
          <input
            value={selection.item.label ?? ''}
            onChange={(event) => onConnectionLabelChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
      );
    }

    if (activeSection === 'colors') {
      return selection.kind === 'connection' ? (
        <ColorField label="Cor" value={accent} swatches={accentSwatches} onChange={onAccentChange} />
      ) : (
        <div className="grid gap-3">
          <ColorField label="Cor principal" value={accent} swatches={accentSwatches} onChange={onAccentChange} />
          <ColorField
            label="Cor do texto"
            value={style?.color ?? '#111827'}
            swatches={textSwatches}
            onChange={onTextColorChange}
          />
        </div>
      );
    }

    if (activeSection === 'line' && selection.kind === 'connection') {
      return (
        <div className="grid gap-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Variante</span>
            <select
              value={selection.item.variant ?? 'default'}
              onChange={(event) => onConnectionVariantChange(event.target.value as ConnectionVariant)}
              className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="default">Padrão</option>
              <option value="emphasis">Destaque</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Espessura</span>
            <select
              value={selection.item.strokeWidth ?? 'medium'}
              onChange={(event) => onConnectionStrokeWidthChange(event.target.value as ConnectionStrokeWidth)}
              className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="thin">Fina</option>
              <option value="medium">Média</option>
              <option value="thick">Grossa</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Linha</span>
            <select
              value={selection.item.type ?? 'normal'}
              onChange={(event) => onConnectionTypeChange(event.target.value as ConnectionType)}
              className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="normal">Sólida</option>
              <option value="dashed">Tracejada</option>
              <option value="dotted">Pontilhada</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Rota</span>
            <select
              value={selection.item.routeStyle ?? 'bezier'}
              onChange={(event) => onConnectionRouteStyleChange(event.target.value as ConnectionRouteStyle)}
              className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="bezier">Bezier</option>
              <option value="orthogonal">Ortogonal</option>
            </select>
          </label>
        </div>
      );
    }

    if (activeSection === 'typography' && hasTypography) {
      return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/72 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tipografia</div>
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tamanho</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onFontSizeChange(clamp(currentFontSize - 1, 10, 72))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={10}
                  max={72}
                  value={currentFontSize}
                  onChange={(event) => onFontSizeChange(clamp(Number(event.target.value) || 10, 10, 72))}
                  className="h-10 w-[72px] rounded-xl border border-cyan-100 bg-white px-3 text-center text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
                <button
                  type="button"
                  onClick={() => onFontSizeChange(clamp(currentFontSize + 1, 10, 72))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Peso</span>
              <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                {[
                  { value: 400 as const, label: 'R' },
                  { value: 600 as const, label: 'M' },
                  { value: 700 as const, label: 'B' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFontWeightChange(option.value)}
                    className={`h-8 w-8 rounded-lg text-sm font-semibold transition ${
                      (style?.fontWeight ?? 700) === option.value
                        ? 'bg-cyan-50 text-cyan-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                    title={option.value === 400 ? 'Regular' : option.value === 600 ? 'Medium' : 'Bold'}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <span className="text-sm font-medium text-slate-700">Alinhamento</span>
            <div className="grid grid-cols-3 gap-2">
              <AlignButton active={currentAlign === 'left'} label="Esquerda" onClick={() => onTextAlignChange('left')}>
                <AlignLeft className="h-4 w-4" />
              </AlignButton>
              <AlignButton active={currentAlign === 'center'} label="Centro" onClick={() => onTextAlignChange('center')}>
                <AlignCenter className="h-4 w-4" />
              </AlignButton>
              <AlignButton active={currentAlign === 'right'} label="Direita" onClick={() => onTextAlignChange('right')}>
                <AlignRight className="h-4 w-4" />
              </AlignButton>
            </div>
          </div>

          {selection.kind === 'text' && (
            <div className="mt-3 space-y-1">
              <span className="text-sm font-medium text-slate-700">Rotação</span>
              <div className="grid grid-cols-3 gap-2">
                <AlignButton active={currentRotation === 0} label="0 graus" onClick={() => onTextRotationChange(0)}>
                  <span className="text-xs font-semibold">0°</span>
                </AlignButton>
                <AlignButton active={currentRotation === 90} label="90 graus" onClick={() => onTextRotationChange(90)}>
                  <span className="text-xs font-semibold">90°</span>
                </AlignButton>
                <AlignButton active={currentRotation === -90} label="-90 graus" onClick={() => onTextRotationChange(-90)}>
                  <span className="text-xs font-semibold">-90°</span>
                </AlignButton>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === 'appearance' && canAdjustBackground) {
      return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/72 p-4">
          {selection.kind === 'group' && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <div>
                <div className="text-sm font-medium text-slate-700">Título nativo</div>
                <div className="text-xs text-slate-500">Mostra ou oculta o título do agrupamento.</div>
              </div>
              <button
                type="button"
                onClick={() => onGroupTitleVisibilityChange(!showGroupTitle)}
                className={`relative h-7 w-12 rounded-full transition ${
                  showGroupTitle ? 'bg-cyan-500/85' : 'bg-slate-300'
                }`}
                title={showGroupTitle ? 'Ocultar título' : 'Mostrar título'}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                    showGroupTitle ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          )}
          <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Opacidade do fundo</span>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={backgroundOpacity}
              onChange={(event) => onBackgroundOpacityChange(clamp(Number(event.target.value) || 0, 0, 100))}
              className="h-8 w-[58px] rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-600 outline-none"
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={backgroundOpacity}
            onChange={(event) => onBackgroundOpacityChange(Number(event.target.value))}
            className="h-2 w-full accent-cyan-500"
          />
        </div>
      );
    }

    if (activeSection === 'layers' && canAdjustLayer) {
      return (
        <div className="rounded-[24px] border border-slate-200/80 bg-white/72 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Layers3 className="h-4 w-4 text-slate-400" />
            Ordem visual
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onLayerChange('front')}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              <BringToFront className="h-4 w-4" />
              Frente
            </button>
            <button
              type="button"
              onClick={() => onLayerChange('forward')}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              <ChevronUp className="h-4 w-4" />
              +1
            </button>
            <button
              type="button"
              onClick={() => onLayerChange('backward')}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              <ChevronDown className="h-4 w-4" />
              -1
            </button>
            <button
              type="button"
              onClick={() => onLayerChange('back')}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              <SendToBack className="h-4 w-4" />
              Fundo
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pointer-events-auto fixed z-40" style={{ left: position.x, top: position.y }}>
      <div
        ref={panelRef}
        onPointerDown={startDrag}
        onMouseLeave={() => {
          if (!pinnedSection) {
            setActiveSection(null);
          }
        }}
        className="relative flex items-start gap-3 rounded-[26px] border border-white/75 bg-white/60 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur select-none"
      >
        <div className="flex flex-col gap-2">
          <div className={`ui-soft-panel flex items-center gap-3 rounded-2xl px-3 py-2 ${isCollapsed ? 'justify-center px-0 w-11 h-11' : ''}`}>
            <Layers3 className="h-4.5 w-4.5 text-slate-600" />
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700/55">Propriedades</div>
                <div className="truncate text-sm font-medium text-slate-700">{title}</div>
              </div>
            )}
          </div>

          {availableSections.map((section) => {
            const Icon = sectionIcon[section];
            const active = activeSection === section;
            return (
              <button
                key={section}
                ref={(element) => {
                  moduleButtonRefs.current[section] = element;
                }}
                onClick={() => {
                  setPinnedSection((current) => {
                    const nextPinned = current === section ? null : section;
                    setActiveSection(nextPinned);
                    return nextPinned;
                  });
                }}
                onMouseEnter={() => {
                  if (window.innerWidth >= 1024 && !pinnedSection) {
                    setActiveSection(section);
                  }
                }}
                className={sectionButtonClass(active)}
                title={sectionLabel[section]}
              >
                <Icon className="h-4.5 w-4.5" />
                {!isCollapsed && <span className="text-sm font-medium">{sectionLabel[section]}</span>}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setIsCollapsed((value) => !value);
              setActiveSection(null);
              setPinnedSection(null);
            }}
            className={`ui-hover-surface flex items-center gap-3 rounded-2xl px-3 py-2 ${
              isCollapsed ? 'justify-center px-0 w-11 h-11' : ''
            }`}
            title={isCollapsed ? 'Expandir painel' : 'Recolher painel'}
          >
            {isCollapsed ? (
              isRightSide ? <ChevronLeft className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />
            ) : (
              isRightSide ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />
            )}
            {!isCollapsed && <span className="text-sm font-medium">Recolher</span>}
          </button>

          <button
            type="button"
            className={`ui-hover-surface flex items-center gap-3 rounded-2xl px-3 py-2 ${
              isCollapsed ? 'justify-center px-0 w-11 h-11' : ''
            }`}
            onClick={onClose}
            title="Fechar painel"
          >
            <X className="h-4.5 w-4.5" />
            {!isCollapsed && <span className="text-sm font-medium">Fechar</span>}
          </button>
        </div>

        {activeSection && (
          <div
            className={`absolute z-10 min-w-[312px] max-w-[360px] rounded-[22px] border border-slate-200/80 bg-white/94 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.07)] ${
              flyoutSide === 'left' ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'
            }`}
            style={{ top: flyoutTop }}
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {sectionLabel[activeSection]}
            </div>
            <div className="hide-scrollbar max-h-[calc(100vh-180px)] overflow-y-auto overflow-x-hidden">
              {renderSection()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
