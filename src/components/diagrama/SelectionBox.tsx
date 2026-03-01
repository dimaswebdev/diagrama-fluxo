'use client'

import React from 'react';

interface SelectionBoxProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ start, end }) => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width < 5 || height < 5) return null;

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
      style={{
        left,
        top,
        width,
        height
      }}
    />
  );
};

export default SelectionBox;
