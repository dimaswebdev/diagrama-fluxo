export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  type?: 'default' | 'input' | 'output' | 'process' | 'decision';
  color?: string;
}

export interface Connection {
  id: string;
  fromCard: string;
  toCard: string;
  type?: 'normal' | 'dashed' | 'dotted';
  color?: string;
  label?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface DiagramState {
  cards: Card[];
  connections: Connection[];
}

export const GRID_SIZE = 20;
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
