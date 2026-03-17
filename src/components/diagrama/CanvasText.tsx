'use client';

import React from 'react';

import type { DiagramText } from '@/types/diagrama';
import type { ResizeDirection } from './Card';

interface CanvasTextProps {
  item: DiagramText;
  isSelected: boolean;
  isEditing: boolean;
  draftValue: string;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: (event: React.MouseEvent) => void;
  onDragStart: (event: React.MouseEvent) => void;
  onResizeStart: (direction: ResizeDirection, event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const handles: Array<{ key: ResizeDirection; style: React.CSSProperties; cursor: string }> = [
  { key: 'top-left', style: { left: -5, top: -5 }, cursor: 'nwse-resize' },
  { key: 'top-right', style: { right: -5, top: -5 }, cursor: 'nesw-resize' },
  { key: 'bottom-right', style: { right: -5, bottom: -5 }, cursor: 'nwse-resize' },
  { key: 'bottom-left', style: { left: -5, bottom: -5 }, cursor: 'nesw-resize' },
];

export default function CanvasText({
  item,
  isSelected,
  isEditing,
  draftValue,
  onClick,
  onDoubleClick,
  onDragStart,
  onResizeStart,
  onDraftChange,
  onCommit,
  onCancel,
}: CanvasTextProps) {
  return (
    <div
      data-diagram-text
      data-text-id={item.id}
      className="absolute rounded-2xl transition-all duration-150 select-none"
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        border: isSelected ? `1px dashed ${item.accent}` : '1px dashed transparent',
        background: item.background ?? 'rgba(255,255,255,0.18)',
        boxShadow: isEditing
          ? '0 14px 32px rgba(15,23,42,0.10)'
          : isSelected
          ? '0 10px 24px rgba(15,23,42,0.06)'
          : 'none',
        cursor: 'move',
      }}
      onMouseDown={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isSelected &&
        handles.map((handle) => (
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

      {isEditing ? (
        <textarea
          autoFocus
          value={draftValue}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onCommit();
            }
          }}
          className="h-full w-full resize-none rounded-2xl border p-2.5 outline-none"
          style={{
            borderColor: item.accent,
            background: 'rgba(255,255,255,0.72)',
            color: item.textStyle.color ?? '#111827',
            fontSize: item.textStyle.fontSize,
            fontWeight: item.textStyle.fontWeight ?? 600,
            lineHeight: item.textStyle.lineHeight ?? 1.35,
            textAlign: item.textStyle.textAlign ?? 'left',
          }}
        />
      ) : (
        <div
          className="flex h-full w-full items-start rounded-2xl p-2.5 whitespace-pre-wrap"
          style={{
            color: item.textStyle.color ?? '#111827',
            fontSize: item.textStyle.fontSize,
            fontWeight: item.textStyle.fontWeight ?? 600,
            lineHeight: item.textStyle.lineHeight ?? 1.35,
            textAlign: item.textStyle.textAlign ?? 'left',
            justifyContent: item.textStyle.textAlign === 'center' ? 'center' : 'flex-start',
          }}
        >
          {item.text}
        </div>
      )}
    </div>
  );
}
