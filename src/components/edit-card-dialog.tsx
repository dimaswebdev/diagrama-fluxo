'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { EvidenceCardData } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Wand2, Loader2 } from 'lucide-react';
import { generateSummary, generateTags } from '@/lib/actions';

interface EditCardDialogProps {
  card: EvidenceCardData;
  onSave: (updatedCard: Partial<EvidenceCardData> & { id: string }) => void;
  onClose: () => void;
}

export function EditCardDialog({ card, onSave, onClose }: EditCardDialogProps) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [summary, setSummary] = useState(card.summary || '');
  const [tags, setTags] = useState(card.tags?.join(', ') || '');

  const [isSummaryPending, startSummaryTransition] = useTransition();
  const [isTagsPending, startTagsTransition] = useTransition();

  useEffect(() => {
    setTitle(card.title);
    setContent(card.content);
    setSummary(card.summary || '');
    setTags(card.tags?.join(', ') || '');
  }, [card]);

  const handleSave = () => {
    onSave({
      id: card.id,
      title,
      content,
      summary,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    onClose();
  };
  
  const handleGenerateSummary = () => {
    startSummaryTransition(async () => {
        const generated = await generateSummary({ evidenceContent: content });
        setSummary(generated);
    });
  }

  const handleGenerateTags = () => {
    startTagsTransition(async () => {
        const generated = await generateTags({ content });
        setTags(generated.join(', '));
    });
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px] bg-card/80 backdrop-blur-xl border-white/20">
        <DialogHeader>
          <DialogTitle>Editar Evidência #{card.sequence}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
            </Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              Conteúdo
            </Label>
            <Textarea id="content" value={content} onChange={e => setContent(e.target.value)} className="col-span-3 min-h-[120px]" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="summary" className="text-right pt-2">
              Resumo (IA)
            </Label>
            <div className="col-span-3">
              <Textarea id="summary" value={summary} onChange={e => setSummary(e.target.value)} className="min-h-[80px]" />
              <Button size="sm" variant="outline" className="mt-2" onClick={handleGenerateSummary} disabled={isSummaryPending}>
                {isSummaryPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Gerar Resumo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">
              Tags (IA)
            </Label>
            <div className="col-span-3">
              <Input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="crime, documento, data" />
              <Button size="sm" variant="outline" className="mt-2" onClick={handleGenerateTags} disabled={isTagsPending}>
                {isTagsPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Sugerir Tags
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
