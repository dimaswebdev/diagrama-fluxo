export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sequence: number;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  label: string;
  date: string;
  source: string;
  accent: string;
  textStyle?: TextStyle;

  type?: CardType;
}

export interface TextStyle {
  fontSize: number;
  fontWeight?: 400 | 500 | 600 | 700;
  textAlign?: 'left' | 'center';
  lineHeight?: number;
  color?: string;
}

export interface DiagramText {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  accent: string;
  background?: string;
  textStyle: TextStyle;
}

export interface GroupBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  accent: string;
  background: string;
  titleStyle: TextStyle;
}

export interface Connection {
  id: string;
  fromCard: string;
  toCard: string;
  type?: 'normal' | 'dashed' | 'dotted';
  routeStyle?: ConnectionRouteStyle;
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
  texts: DiagramText[];
  groupBoxes: GroupBox[];
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConnectionType = 'normal' | 'dashed' | 'dotted';
export type ConnectionRouteStyle = 'bezier' | 'orthogonal';
export type CardType = 'default' | 'input' | 'output' | 'process' | 'decision';

export const GRID_SIZE = 20;
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
