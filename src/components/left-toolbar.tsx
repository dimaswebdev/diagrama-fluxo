'use client';

import { NodeShape, EdgeType } from '@/lib/types';
import { cn } from '@/lib/utils';

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
    "w-10 h-10 flex items-center justify-center border rounded-lg text-xs font-semibold transition-all";

  const active =
    "bg-primary text-white border-primary shadow-md";

  const inactive =
    "bg-white/40 backdrop-blur-lg border-white/20 hover:bg-white/60";

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 p-3 rounded-2xl bg-white/30 backdrop-blur-xl shadow-xl border border-white/20">
      
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-muted-foreground">Shape</span>

        <button
          onClick={() => setNodeShape("rectangle")}
          className={cn(buttonBase, nodeShape === "rectangle" ? active : inactive)}
        >
          ▭
        </button>

        <button
          onClick={() => setNodeShape("circle")}
          className={cn(buttonBase, nodeShape === "circle" ? active : inactive)}
        >
          ○
        </button>
      </div>

      <div className="h-px bg-white/30 my-2" />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-muted-foreground">Edges</span>

        {[
          { id: "straight", label: "—" },
          { id: "orthogonal", label: "└" },
          { id: "bezier", label: "~" },
          { id: "manhattan", label: "┼" },
          { id: "rounded-orthogonal", label: "╭" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setEdgeType(item.id as EdgeType)}
            className={cn(buttonBase, edgeType === item.id ? active : inactive)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
