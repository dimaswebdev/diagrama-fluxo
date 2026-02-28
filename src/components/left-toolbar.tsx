'use client';

import { NodeShape, EdgeType } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Square,
  Circle,
  Minus,
  CornerDownRight,
  GitBranch,
  Route,
  Workflow
} from 'lucide-react';

interface LeftToolbarProps {
  nodeShape: NodeShape;
  setNodeShape: (shape: NodeShape) => void;
  edgeType: EdgeType;
  setEdgeType: (type: EdgeType) => void;
}

export function LeftToolbar({
  nodeShape,
  setNodeShape,
  edgeType,
  setEdgeType,
}: LeftToolbarProps) {

  const buttonBase =
    "w-11 h-11 flex items-center justify-center rounded-xl transition-all border";

  const active =
    "bg-primary text-white border-primary shadow-md";

  const inactive =
    "bg-white/40 backdrop-blur-lg border-white/20 hover:bg-white/60";

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 p-4 rounded-3xl bg-white/30 backdrop-blur-xl shadow-2xl border border-white/20">
      
      {/* SHAPE */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Shape</span>

        <button
          onClick={() => setNodeShape("rectangle")}
          className={cn(buttonBase, nodeShape === "rectangle" ? active : inactive)}
        >
          <Square size={18} />
        </button>

        <button
          onClick={() => setNodeShape("circle")}
          className={cn(buttonBase, nodeShape === "circle" ? active : inactive)}
        >
          <Circle size={18} />
        </button>
      </div>

      <div className="h-px bg-white/30 my-2" />

      {/* EDGES */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Edges</span>

        <button
          onClick={() => setEdgeType("straight")}
          className={cn(buttonBase, edgeType === "straight" ? active : inactive)}
        >
          <Minus size={18} />
        </button>

        <button
          onClick={() => setEdgeType("orthogonal")}
          className={cn(buttonBase, edgeType === "orthogonal" ? active : inactive)}
        >
          <CornerDownRight size={18} />
        </button>

        <button
          onClick={() => setEdgeType("bezier")}
          className={cn(buttonBase, edgeType === "bezier" ? active : inactive)}
        >
          <GitBranch size={18} />
        </button>

        <button
          onClick={() => setEdgeType("manhattan")}
          className={cn(buttonBase, edgeType === "manhattan" ? active : inactive)}
        >
          <Route size={18} />
        </button>

        <button
          onClick={() => setEdgeType("rounded-orthogonal")}
          className={cn(buttonBase, edgeType === "rounded-orthogonal" ? active : inactive)}
        >
          <Workflow size={18} />
        </button>
      </div>
    </div>
  );
}