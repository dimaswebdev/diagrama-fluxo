'use client';

import {
  MousePointer2,
  Share2,
  Plus,
  Trash2,
  Type,
  Printer,
} from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import type { InteractionMode } from '@/lib/types';

interface FloatingToolbarProps {
  mode: InteractionMode;
  selectedCardIds: Set<string>;
  onSetMode: (mode: InteractionMode) => void;
  onAddCard: () => void;
  onDeleteCard: () => void;
  onEditCard: () => void;
  onExport: () => void;
}

export function FloatingToolbar({
  mode,
  selectedCardIds,
  onSetMode,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onExport,
}: FloatingToolbarProps) {
  const tools = [
    {
      id: 'select' as InteractionMode,
      icon: MousePointer2,
      label: 'Selecionar (V)',
      onClick: () => onSetMode('select'),
    },
    {
      id: 'connect' as InteractionMode,
      icon: Share2,
      label: 'Conectar (C)',
      onClick: () => onSetMode('connect'),
    },
  ];

  const actions = [
    { id: 'add', icon: Plus, label: 'Novo Elemento (N)', onClick: onAddCard, disabled: false },
    { id: 'delete', icon: Trash2, label: 'Deletar (Delete)', onClick: onDeleteCard, disabled: selectedCardIds.size === 0 },
    { id: 'edit', icon: Type, label: 'Editar Texto (T)', onClick: onEditCard, disabled: selectedCardIds.size !== 1 },
    { id: 'print', icon: Printer, label: 'Imprimir/PDF (P)', onClick: onExport, disabled: false },
  ];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10">
      <TooltipProvider>
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-card/45 backdrop-blur-xl border border-white/20 shadow-lg">
          {tools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={tool.onClick}
                  className={cn(
                    'h-9 w-9',
                    mode === tool.id && 'bg-primary/20 text-primary'
                  )}
                >
                  <tool.icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tool.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          <Separator orientation="vertical" className="h-6" />
          {actions.map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={action.onClick}
                  className="h-9 w-9"
                  disabled={action.disabled}
                >
                  <action.icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{action.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
