'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Grid3X3,
  HelpCircle,
  LogIn,
  LogOut,
  Magnet,
  Minus,
  Palette,
  Plus,
  Route,
  Settings2,
  SlidersHorizontal,
  Square,
  Spline,
  UnfoldVertical,
} from 'lucide-react';

import { CardType, ConnectionRouteStyle, ConnectionType } from '@/types/diagrama';

interface FloatingToolbarProps {
  onAddCard: (type?: CardType) => void;
  connectionType: ConnectionType;
  onConnectionTypeChange: (type: ConnectionType) => void;
  connectionRouteStyle: ConnectionRouteStyle;
  onConnectionRouteStyleChange: (style: ConnectionRouteStyle) => void;
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

type ModuleId = 'cards' | 'colors' | 'connections' | 'view' | 'zoom';

const STORAGE_KEY = 'diagram-toolbar-preferences';

const moduleLabel: Record<ModuleId, string> = {
  cards: 'Ferramentas',
  colors: 'Cores',
  connections: 'Conexões',
  view: 'Visual',
  zoom: 'Zoom',
};

const moduleIcons: Record<ModuleId, React.ElementType> = {
  cards: Square,
  colors: Palette,
  connections: UnfoldVertical,
  view: Grid3X3,
  zoom: Plus,
};

const cardTypes: { type: CardType; label: string; Icon: React.ElementType }[] = [
  { type: 'default', label: 'Normal', Icon: Square },
  { type: 'input', label: 'Entrada', Icon: LogIn },
  { type: 'process', label: 'Processo', Icon: Settings2 },
  { type: 'output', label: 'Saída', Icon: LogOut },
  { type: 'decision', label: 'Decisão', Icon: HelpCircle },
];

const cardColors = [
  '#2563EB',
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
  '#111827',
];

const connectionTypes: { type: ConnectionType; label: string }[] = [
  { type: 'normal', label: 'Sólida' },
  { type: 'dashed', label: 'Tracejada' },
  { type: 'dotted', label: 'Pontilhada' },
];

const connectionRouteStyles: { type: ConnectionRouteStyle; label: string; Icon: React.ElementType; hint: string }[] = [
  { type: 'bezier', label: 'Bezier', Icon: Spline, hint: 'curva' },
  { type: 'orthogonal', label: 'Ortogonal', Icon: Route, hint: '90' },
];

const defaultModules: ModuleId[] = ['cards', 'colors', 'connections', 'view', 'zoom'];

export default function FloatingToolbar({
  onAddCard,
  connectionType,
  onConnectionTypeChange,
  connectionRouteStyle,
  onConnectionRouteStyleChange,
  cardColor,
  onCardColorChange,
  showGrid,
  onShowGridChange,
  snapToGrid,
  onSnapToGridChange,
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 24, y: 152 });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showModulesMenu, setShowModulesMenu] = useState(false);
  const [visibleModules, setVisibleModules] = useState<ModuleId[]>(defaultModules);
  const [activePanel, setActivePanel] = useState<ModuleId | null>(null);
  const [pinnedPanel, setPinnedPanel] = useState<ModuleId | null>(null);
  const [isModulesMenuPinned, setIsModulesMenuPinned] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 720 });
  const menuRef = useRef<HTMLDivElement>(null);
  const toolbarColumnRef = useRef<HTMLDivElement>(null);
  const modulesButtonRef = useRef<HTMLButtonElement>(null);
  const moduleButtonRefs = useRef<Partial<Record<ModuleId, HTMLButtonElement | null>>>({});
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        x?: number;
        y?: number;
        collapsed?: boolean;
        modules?: ModuleId[];
      };
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setPosition({ x: parsed.x, y: parsed.y });
      }
      if (typeof parsed.collapsed === 'boolean') {
        setIsCollapsed(parsed.collapsed);
      }
      if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
        setVisibleModules(parsed.modules);
      }
    } catch {
      // ignore persisted toolbar state failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          x: position.x,
          y: position.y,
          collapsed: isCollapsed,
          modules: visibleModules,
        })
      );
    } catch {
      // ignore persisted toolbar state failures
    }
  }, [isCollapsed, position.x, position.y, visibleModules]);

  useEffect(() => {
    if (!showModulesMenu && !activePanel) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowModulesMenu(false);
        setActivePanel(null);
        setPinnedPanel(null);
        setIsModulesMenuPinned(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [activePanel, showModulesMenu]);

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

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        didDragRef.current = true;
      }

      const nextX = dragStateRef.current.originX + deltaX;
      const nextY = dragStateRef.current.originY + deltaY;
      const maxX = Math.max(12, window.innerWidth - 320);
      const maxY = Math.max(96, window.innerHeight - 320);

      setPosition({
        x: Math.min(Math.max(12, nextX), maxX),
        y: Math.min(Math.max(96, nextY), maxY),
      });
    };

    const handlePointerUp = () => {
      if (didDragRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      dragStateRef.current = null;
      didDragRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const modulesToRender = useMemo(
    () => defaultModules.filter((moduleId) => visibleModules.includes(moduleId)),
    [visibleModules]
  );
  const panelSide = position.x > viewportSize.width - 330 ? 'left' : 'right';
  const getButtonOffsetTop = (element: HTMLElement | null) => {
    const containerRect = menuRef.current?.getBoundingClientRect();
    const buttonRect = element?.getBoundingClientRect();
    if (!containerRect || !buttonRect) return 0;
    return buttonRect.top - containerRect.top;
  };
  const getPanelTopClass = (offsetTop: number, panelHeight: number) => {
    const top = Math.min(
      Math.max(0, offsetTop),
      Math.max(0, viewportSize.height - position.y - panelHeight - 24)
    );
    return `${top}px`;
  };
  const activePanelTop = activePanel
    ? getPanelTopClass(getButtonOffsetTop(moduleButtonRefs.current[activePanel] ?? null), 280)
    : '0px';
  const modulesMenuTop = getPanelTopClass(getButtonOffsetTop(modulesButtonRef.current), 240);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    didDragRef.current = false;
  };

  const runAction = (action: () => void) => {
    return () => {
      if (suppressClickRef.current) return;
      action();
    };
  };

  const toggleModuleVisibility = (moduleId: ModuleId) => {
    setVisibleModules((prev) => {
      if (prev.includes(moduleId)) {
        if (prev.length === 1) return prev;
        if (activePanel === moduleId) {
          setActivePanel(null);
          setPinnedPanel(null);
        }
        return prev.filter((item) => item !== moduleId);
      }
      return [...prev, moduleId];
    });
  };

  const renderPanel = () => {
    if (!activePanel) return null;

    if (activePanel === 'cards') {
      return (
        <div className="grid gap-2">
          {cardTypes.map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={runAction(() => onAddCard(type))}
              className="ui-hover-surface flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4.5 w-4.5" />
                <span>{label}</span>
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                +
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (activePanel === 'colors') {
      return (
        <div className="grid grid-cols-4 gap-2.5">
          {cardColors.map((color) => (
            <button
              key={color}
              onClick={runAction(() => onCardColorChange(color))}
              className={`h-8 w-8 rounded-full border-2 transition ${
                cardColor === color ? 'scale-110 border-slate-800' : 'border-white hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      );
    }

    if (activePanel === 'connections') {
      return (
        <div className="grid gap-3">
          <div className="grid gap-2">
            {connectionRouteStyles.map(({ type, label, Icon, hint }) => (
              <button
                key={type}
                onClick={runAction(() => onConnectionRouteStyleChange(type))}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  connectionRouteStyle === type
                    ? 'ui-active-surface'
                    : 'ui-hover-surface border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4.5 w-4.5" />
                    <span>{label}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {hint}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {connectionTypes.map((item) => (
            <button
              key={item.type}
              onClick={runAction(() => onConnectionTypeChange(item.type))}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                connectionType === item.type
                  ? 'ui-active-surface'
                  : 'ui-hover-surface border-transparent'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.type === 'normal' ? (
                  <Spline className="h-4.5 w-4.5" />
                ) : item.type === 'dashed' ? (
                  <UnfoldVertical className="h-4.5 w-4.5" />
                ) : (
                  <CircleDot className="h-4.5 w-4.5" />
                )}
                <span>{item.label}</span>
              </span>
              <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {item.type === 'normal' ? 'S' : item.type === 'dashed' ? 'T' : 'P'}
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (activePanel === 'view') {
      return (
        <div className="grid gap-2">
          <button
            onClick={runAction(() => onShowGridChange(!showGrid))}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
              showGrid ? 'ui-active-surface' : 'ui-hover-surface border-transparent'
            }`}
          >
            <span className="flex items-center gap-3">
              <Grid3X3 className="h-4.5 w-4.5" />
              <span>Mostrar grade</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-400">G</span>
          </button>
          <button
            onClick={runAction(() => onSnapToGridChange(!snapToGrid))}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
              snapToGrid ? 'ui-active-surface' : 'ui-hover-surface border-transparent'
            }`}
          >
            <span className="flex items-center gap-3">
              <Magnet className="h-4.5 w-4.5" />
              <span>Snap no grid</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-400">M</span>
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        <button
          onClick={runAction(onZoomIn)}
          className="ui-hover-surface flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm"
        >
          <span className="flex items-center gap-3">
            <Plus className="h-4.5 w-4.5" />
            <span>Aumentar zoom</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">+</span>
        </button>
        <button
          onClick={runAction(onZoomOut)}
          className="ui-hover-surface flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm"
        >
          <span className="flex items-center gap-3">
            <Minus className="h-4.5 w-4.5" />
            <span>Diminuir zoom</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-400">-</span>
        </button>
        <button
          onClick={runAction(onZoomReset)}
          className="ui-hover-surface flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm"
        >
          <span>Resetar</span>
          <span className="font-semibold">{Math.round(scale * 100)}%</span>
        </button>
      </div>
    );
  };

  return (
    <div className="pointer-events-auto fixed z-50" style={{ left: position.x, top: position.y }}>
      <div
        ref={menuRef}
        onPointerDown={startDrag}
        onMouseLeave={() => {
          if (!pinnedPanel) {
            setActivePanel(null);
          }
          if (!isModulesMenuPinned) {
            setShowModulesMenu(false);
          }
        }}
        className="relative flex items-start gap-3 rounded-[26px] border border-white/75 bg-white/40 p-3 shadow "
      >
        <div ref={toolbarColumnRef} className="flex flex-col gap-2">
          {modulesToRender.map((moduleId) => {
            const Icon = moduleIcons[moduleId];
            const active = activePanel === moduleId;
            return (
              <button
                key={moduleId}
                ref={(element) => {
                  moduleButtonRefs.current[moduleId] = element;
                }}
                onClick={runAction(() => {
                  setShowModulesMenu(false);
                  setIsModulesMenuPinned(false);
                  setPinnedPanel((current) => {
                    const nextPinned = current === moduleId ? null : moduleId;
                    setActivePanel(nextPinned);
                    return nextPinned;
                  });
                })}
                onMouseEnter={() => {
                  if (window.innerWidth >= 1024 && !pinnedPanel && !isModulesMenuPinned) {
                    setShowModulesMenu(false);
                    setActivePanel(moduleId);
                  }
                }}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                  active
                    ? 'ui-active-surface'
                    : 'ui-hover-surface'
                } ${isCollapsed ? 'justify-center px-0 w-11 h-11' : ''}`}
                title={moduleLabel[moduleId]}
              >
                <Icon className="h-4.5 w-4.5" />
                {!isCollapsed && <span className="text-sm font-medium">{moduleLabel[moduleId]}</span>}
              </button>
            );
          })}

          <button
            ref={modulesButtonRef}
            onClick={runAction(() => {
              setPinnedPanel(null);
              setActivePanel(null);
              setIsModulesMenuPinned((current) => {
                const nextPinned = !current;
                setShowModulesMenu(nextPinned);
                return nextPinned;
              });
            })}
            onMouseEnter={() => {
              if (window.innerWidth >= 1024 && !pinnedPanel && !isModulesMenuPinned) {
                setActivePanel(null);
                setShowModulesMenu(true);
              }
            }}
            className={`ui-hover-surface flex items-center gap-3 rounded-2xl px-3 py-2 ${
              isCollapsed ? 'justify-center px-0 w-11 h-11' : ''
            }`}
            title="Configurar módulos"
          >
            <SlidersHorizontal className="h-4.5 w-4.5" />
            {!isCollapsed && <span className="text-sm font-medium">Módulos</span>}
          </button>

          <button
            onClick={runAction(() => setIsCollapsed((value) => !value))}
            className={`ui-hover-surface flex items-center gap-3 rounded-2xl px-3 py-2 ${
              isCollapsed ? 'justify-center px-0 w-11 h-11' : ''
            }`}
            title={isCollapsed ? 'Expandir toolbar' : 'Recolher toolbar'}
          >
            {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
            {!isCollapsed && <span className="text-sm font-medium">Recolher</span>}
          </button>
        </div>

        {activePanel && (
          <div
            className={`absolute z-10 min-w-[240px] rounded-[22px] border border-slate-200/80 bg-white/40 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.07)] ${
              panelSide === 'right' ? 'left-[calc(100%+12px)]' : 'right-[calc(100%+12px)]'
            }`}
            style={{ top: activePanelTop }}
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {moduleLabel[activePanel]}
            </div>
            {renderPanel()}
          </div>
        )}

        {showModulesMenu && (
          <div
            className={`absolute z-10 min-w-[220px] rounded-[22px] border border-slate-200/80 bg-white/94 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.07)] ${
              panelSide === 'right' ? 'left-[calc(100%+12px)]' : 'right-[calc(100%+12px)]'
            }`}
            style={{ top: modulesMenuTop }}
          >
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Módulos
            </div>
            {defaultModules.map((moduleId) => (
              <button
                key={moduleId}
                onClick={runAction(() => toggleModuleVisibility(moduleId))}
                className="ui-hover-surface flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm"
              >
                <span>{moduleLabel[moduleId]}</span>
                <span className="text-xs text-slate-400">
                  {visibleModules.includes(moduleId) ? 'ativo' : 'oculto'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
