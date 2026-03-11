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
    "h-9 w-9 flex items-center justify-center rounded-xl transition-all";

  const active =
    "bg-primary/20 text-primary";

  const inactive =
    "hover:bg-muted/40";

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
      <div className="flex flex-col items-center gap-2 p-1.5 rounded-xl bg-card/45 backdrop-blur-xl border border-white/20 shadow-lg">

        {/* SHAPE */}
        <button
          onClick={() => setNodeShape("rectangle")}
          className={cn(buttonBase, nodeShape === "rectangle" ? active : inactive)}
        >
          <Square className="h-5 w-5" />
        </button>

        <button
          onClick={() => setNodeShape("circle")}
          className={cn(buttonBase, nodeShape === "circle" ? active : inactive)}
        >
          <Circle className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-border my-1" />

        {/* EDGES */}
        <button
          onClick={() => setEdgeType("straight")}
          className={cn(buttonBase, edgeType === "straight" ? active : inactive)}
        >
          <Minus className="h-5 w-5" />
        </button>

        <button
          onClick={() => setEdgeType("orthogonal")}
          className={cn(buttonBase, edgeType === "orthogonal" ? active : inactive)}
        >
          <CornerDownRight className="h-5 w-5" />
        </button>

        <button
          onClick={() => setEdgeType("bezier")}
          className={cn(buttonBase, edgeType === "bezier" ? active : inactive)}
        >
          <GitBranch className="h-5 w-5" />
        </button>

        <button
          onClick={() => setEdgeType("manhattan")}
          className={cn(buttonBase, edgeType === "manhattan" ? active : inactive)}
        >
          <Route className="h-5 w-5" />
        </button>

        <button
          onClick={() => setEdgeType("rounded-orthogonal")}
          className={cn(buttonBase, edgeType === "rounded-orthogonal" ? active : inactive)}
        >
          <Workflow className="h-5 w-5" />
        </button>

      </div>
    </div>
  );
}