'use client';

import React from 'react';

import type { GroupBox as GroupBoxType } from '@/types/diagrama';
import type { ResizeDirection } from './Card';

interface GroupBoxProps {
  item: GroupBoxType;
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

export default function GroupBox({
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
}: GroupBoxProps) {
  const title = item.title.trim();
  const showTitle = item.showTitle ?? true;

  return (
    <div
      data-group-box
      data-group-id={item.id}
      className="absolute rounded-[28px] transition-all duration-150 select-none"
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        background: item.background,
        border: `1.5px solid ${item.accent}`,
        boxShadow: isSelected ? '0 12px 28px rgba(15,23,42,0.05)' : 'none',
        cursor: 'move',
      }}
      onMouseDown={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/45" />
      {isSelected && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-dashed border-slate-300/90 bg-white/[0.02]" />
          {handles.map((handle) => (
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
      <div className="absolute inset-x-4 top-4">
        {isEditing ? (
          <input
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
              if (event.key === 'Enter') {
                event.preventDefault();
                onCommit();
              }
            }}
            className="w-full rounded-xl border border-white/60 bg-white/20 px-3 py-2 outline-none"
            style={{
              color: item.titleStyle.color ?? '#0f172a',
              fontSize: item.titleStyle.fontSize,
              fontWeight: item.titleStyle.fontWeight ?? 700,
              textAlign: item.titleStyle.textAlign ?? 'center',
            }}
          />
        ) : showTitle ? (
          <div
            className="px-3 py-2 uppercase tracking-[0.04em]"
            style={{
              color: item.titleStyle.color ?? '#0f172a',
              fontSize: item.titleStyle.fontSize,
              fontWeight: item.titleStyle.fontWeight ?? 700,
              textAlign: item.titleStyle.textAlign ?? 'center',
              lineHeight: item.titleStyle.lineHeight ?? 1.15,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
        ) : null}
      </div>
    </div>
  );
}
