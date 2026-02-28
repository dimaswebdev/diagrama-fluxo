export interface EvidenceCardData {
  id: string;
  sequence: number;
  position: { x: number; y: number };
  width: number;
  height: number;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  label: string;
  date: string;
  source: string;
  accent: string;
}

export interface ConnectionData {
  id: string;
  from: string; // card id
  to: string; // card id
}

export type InteractionMode = 'select' | 'connect';

export type NodeShape = "rectangle" | "circle";

export type EdgeType =
  | "straight"
  | "orthogonal"
  | "bezier"
  | "manhattan"
  | "rounded-orthogonal";
