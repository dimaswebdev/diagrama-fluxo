'use client';

import React, { useMemo } from 'react';
import { ArrowRightLeft, GitBranch, LogIn, LogOut, Square } from 'lucide-react';

import { Card as CardType, Point } from '@/types/diagrama';
import type { ConnectionSide } from './connectionRouting';
import { isFlowShape } from './cardPresets';

interface CardProps {
  card: CardType;
  scale: number;
  offset: { x: number; y: number };
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (
    direction: ResizeDirection,
    event: React.MouseEvent<HTMLElement, MouseEvent>
  ) => void;
  onConnectionStart: (side: ConnectionSide, point: Point) => void;
}

export type ResizeDirection =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

const selectionHandles: Array<{
  key: ResizeDirection;
  style: React.CSSProperties;
  cursor: string;
}> = [
  { key: 'top-left', style: { left: -5, top: -5 }, cursor: 'nwse-resize' },
  { key: 'top-right', style: { right: -5, top: -5 }, cursor: 'nesw-resize' },
  { key: 'bottom-right', style: { right: -5, bottom: -5 }, cursor: 'nwse-resize' },
  { key: 'bottom-left', style: { left: -5, bottom: -5 }, cursor: 'nesw-resize' },
] as const;

const typeIconMap = {
  default: Square,
  input: LogIn,
  process: ArrowRightLeft,
  output: LogOut,
  decision: GitBranch,
} as const;

const typeLabelMap = {
  default: 'Normal',
  input: 'Entrada',
  process: 'Processo',
  output: 'Saída',
  decision: 'Decisão',
} as const;

function Card({
  card,
  scale,
  offset,
  isSelected,
  onClick,
  onDoubleClick,
  onDragStart,
  onResizeStart,
  onConnectionStart,
}: CardProps) {
  const isSemanticShape = isFlowShape(card.type);
  const TypeIcon = typeIconMap[card.type ?? 'default'];
  const typeLabel = typeLabelMap[card.type ?? 'default'];
  const compactLines = useMemo(
    () =>
      card.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, card.height < 170 ? 2 : 3),
    [card.content, card.height]
  );
  const isCompactCard = card.width < 250 || card.height < 170;
  const titleFontSize = card.textStyle?.fontSize ?? (isCompactCard ? 16 : 18);
  const contentFontSize = Math.max(12, Math.round((card.textStyle?.fontSize ?? 14) * 0.9));
  const cardTextAlign = card.textStyle?.textAlign ?? 'left';
  const cardTextColor = card.textStyle?.color ?? '#111827';
  const semanticTitleClass = isCompactCard ? 'text-base' : 'text-lg';
  const semanticBodyClass = isCompactCard ? 'text-[13px] leading-5' : 'text-sm leading-6';
  const basePaddingClass = isCompactCard ? 'p-3' : 'p-4';
  const defaultContentClass = isCompactCard ? 'text-[13px] leading-5' : 'text-sm';

  return (
    <div
      className="card absolute rounded-2xl transition-all duration-200 select-none"
      data-card-id={card.id}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        backgroundColor: `${card.accent}20`,
        border: `2px solid ${card.accent}`,
        boxShadow: isSelected
          ? '0 0 0 1px rgba(226,232,240,0.96), 0 0 0 5px rgba(148,163,184,0.12), 0 14px 30px rgba(15,23,42,0.10)'
          : '0 8px 20px rgba(15,23,42,0.06)',
        cursor: 'move',
      }}
      onMouseDown={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isSelected && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-slate-300/90 bg-white/[0.02]" />
          {selectionHandles.map((handle) => (
            <button
              key={handle.key}
              type="button"
              className="absolute h-3.5 w-3.5 rounded-[4px] border border-white bg-[#4FA9F6] shadow-[0_2px_8px_rgba(37,99,235,0.18)]"
              style={{ ...handle.style, cursor: handle.cursor }}
              onMouseDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onResizeStart(handle.key, event);
              }}
            />
          ))}
        </>
      )}

      {isSemanticShape ? (
        <div className={`flex h-full flex-col items-center justify-center px-5 py-6 text-center ${isCompactCard ? 'px-4 py-4' : ''}`}>
          <div className="mb-3 flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <TypeIcon className="h-3.5 w-3.5" />
            <span>{typeLabel}</span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {card.date}
            </div>
            <div className={`${semanticTitleClass} font-semibold leading-tight text-slate-800`}>
              {card.title}
            </div>
            <div className={`space-y-1 text-slate-700 ${semanticBodyClass}`}>
              {compactLines.length > 0 ? compactLines.map((line) => <div key={line}>{line}</div>) : <div>{card.content}</div>}
            </div>
          </div>

          {(card.label || card.source) && (
            <div className="mt-4 rounded-full border border-white/80 bg-white/72 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {[card.label, card.source].filter(Boolean).join(' • ')}
            </div>
          )}
        </div>
      ) : (
        <div className={`flex h-full flex-col ${basePaddingClass}`}>
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: card.accent }}
            >
              {card.sequence}
            </div>

            <div
              style={{
                flex: 1,
                textAlign: cardTextAlign,
              }}
            >
              <div className="font-semibold leading-tight" style={{ fontSize: titleFontSize, color: cardTextColor, textAlign: cardTextAlign }}>{card.title}</div>
              <div className="text-xs text-gray-500">{card.date}</div>
            </div>
          </div>

          <div
            className={`flex-1 overflow-hidden ${defaultContentClass}`}
            style={{
              color: cardTextColor,
              fontSize: contentFontSize,
              lineHeight: card.textStyle?.lineHeight ?? 1.45,
              textAlign: cardTextAlign,
            }}
          >
            {card.content}
          </div>

          {card.tags && card.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-cyan-100 bg-[rgba(236,248,250,0.92)] px-2 py-0.5 text-[11px] text-cyan-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {(card.label || card.source) && (
            <div
              className="mt-3 flex text-xs text-gray-500"
              style={{
                justifyContent:
                  cardTextAlign === 'center'
                    ? 'center'
                    : cardTextAlign === 'right'
                    ? 'flex-end'
                    : 'space-between',
                gap: cardTextAlign === 'left' ? 12 : 8,
              }}
            >
              <span>{card.label}</span>
              <span>{card.source}</span>
            </div>
          )}
        </div>
      )}

      {(['top', 'right', 'bottom', 'left'] as ConnectionSide[]).map((side) => {
        const baseStyle =
          'connection-point absolute h-3 w-3 rounded-full bg-white border-2 cursor-crosshair shadow-[0_2px_8px_rgba(15,23,42,0.08)]';
        const styleMap: Record<string, React.CSSProperties> = {
          top: {
            top: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            borderColor: card.accent,
          },
          right: {
            right: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            borderColor: card.accent,
          },
          bottom: {
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            borderColor: card.accent,
          },
          left: {
            left: -6,
            top: '50%',
            transform: 'translateY(-50%)',
            borderColor: card.accent,
          },
        };

          return (
            <div
              key={side}
              className={baseStyle}
            data-connection-side={side}
            data-card-id={card.id}
              style={styleMap[side]}
              onMouseDown={(event) => {
                event.stopPropagation();
                event.preventDefault();

                const rect = event.currentTarget.getBoundingClientRect();
                const canvasRect = (
                event.currentTarget.closest('[data-diagram-canvas]') as HTMLElement
              )?.getBoundingClientRect();

              if (!canvasRect) return;

              const mouseX = rect.left + rect.width / 2 - canvasRect.left;
              const mouseY = rect.top + rect.height / 2 - canvasRect.top;

              const worldX = (mouseX - offset.x) / scale;
              const worldY = (mouseY - offset.y) / scale;

              onConnectionStart(side, { x: worldX, y: worldY });
            }}
          />
        );
      })}
    </div>
  );
}

export default React.memo(Card, (prev, next) => {
  return (
    prev.card === next.card &&
    prev.scale === next.scale &&
    prev.offset.x === next.offset.x &&
    prev.offset.y === next.offset.y &&
    prev.isSelected === next.isSelected
  );
});
