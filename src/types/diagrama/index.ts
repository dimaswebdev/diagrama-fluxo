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
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toSide: 'top' | 'right' | 'bottom' | 'left';
}

export interface Point {
  x: number;
  y: number;
}

export interface DiagramState {
  cards: Card[];
  connections: Connection[];
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConnectionType = 'normal' | 'dashed' | 'dotted';
export type CardType = 'default' | 'input' | 'output' | 'process' | 'decision';

export const GRID_SIZE = 20;
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
