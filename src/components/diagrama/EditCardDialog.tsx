'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Card as CardType } from '@/types/diagrama';
import { generateSummary, generateTags } from '@/lib/actions';

interface EditCardDialogProps {
  card: CardType;
  onSave: (updated: Partial<CardType> & { id: string }) => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #d6dce5',
  background: 'rgba(255,255,255,0.92)',
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
};

const actionButtonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: 'white',
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 500,
  color: '#0f172a',
};

const inputClassName =
  'w-full focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100';

export const EditCardDialog: React.FC<EditCardDialogProps> = ({
  card,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [label, setLabel] = useState(card.label);
  const [date, setDate] = useState(card.date);
  const [source, setSource] = useState(card.source);
  const [summary, setSummary] = useState(card.summary || '');
  const [tags, setTags] = useState(card.tags?.join(', ') || '');
  const [accent, setAccent] = useState(card.accent);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSummaryPending, startSummaryTransition] = useTransition();
  const [isTagsPending, startTagsTransition] = useTransition();

  useEffect(() => {
    setTitle(card.title);
    setContent(card.content);
    setLabel(card.label);
    setDate(card.date);
    setSource(card.source);
    setSummary(card.summary || '');
    setTags(card.tags?.join(', ') || '');
    setAccent(card.accent);
    setErrorMessage('');
  }, [card]);

  const handleSave = () => {
    onSave({
      id: card.id,
      title,
      content,
      label,
      date,
      source,
      summary,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      accent,
    });
  };

  const handleGenerateSummary = () => {
    if (!content.trim()) {
      setErrorMessage('Preencha o conteudo antes de gerar o resumo.');
      return;
    }

    setErrorMessage('');
    startSummaryTransition(async () => {
      try {
        const generated = await generateSummary({ evidenceContent: content });
        setSummary(generated);
      } catch {
        setErrorMessage('Nao foi possivel gerar o resumo agora.');
      }
    });
  };

  const handleGenerateTags = () => {
    if (!content.trim()) {
      setErrorMessage('Preencha o conteudo antes de sugerir tags.');
      return;
    }

    setErrorMessage('');
    startTagsTransition(async () => {
      try {
        const generated = await generateTags({ content });
        setTags(generated.join(', '));
      } catch {
        setErrorMessage('Nao foi possivel sugerir tags agora.');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/30 px-4 py-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-40px)] w-[min(680px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-white/75 bg-white/96 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Editar card
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Ajuste os dados principais e use a IA para acelerar resumo e tags.
            </p>
          </div>
          <button
            className="ui-hover-surface flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-cyan-700"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            x
          </button>
        </div>

        <div className="hide-scrollbar overflow-y-auto px-5 pb-4 pt-4">
          <div className="grid gap-4">
            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Titulo
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titulo do evento"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Conteudo
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Descreva o conteudo aqui."
                  rows={4}
                  className={inputClassName}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
                />
              </div>
            </section>

            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Label
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="INICIO"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Data
                </label>
                <input
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="10/03/2026"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Fonte
                </label>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Origem ou referencia"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Resumo</h3>
                  <p className="text-xs text-slate-500">Voce pode escrever manualmente ou pedir ajuda da IA.</p>
                </div>
                <button
                  onClick={handleGenerateSummary}
                  disabled={isSummaryPending}
                  style={{
                    ...actionButtonStyle,
                    opacity: isSummaryPending ? 0.7 : 1,
                  }}
                >
                  {isSummaryPending ? 'Gerando...' : 'Gerar com IA'}
                </button>
              </div>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Resumo"
                rows={3}
                className={inputClassName}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
                  <p className="text-xs text-slate-500">Separadas por virgula para busca e organizacao.</p>
                </div>
                <button
                  onClick={handleGenerateTags}
                  disabled={isTagsPending}
                  style={{
                    ...actionButtonStyle,
                    opacity: isTagsPending ? 0.7 : 1,
                  }}
                >
                  {isTagsPending ? 'Sugerindo...' : 'Sugerir com IA'}
                </button>
              </div>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="contrato, pagamento, email"
                className={inputClassName}
                style={inputStyle}
              />
            </section>

            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 md:grid-cols-[1fr_132px]">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Cor do card
                </label>
                <input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  placeholder="#19B7C6"
                  className={inputClassName}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Preview
                </label>
                <div
                  className="h-[43px] rounded-[12px] border border-slate-200"
                  style={{ background: accent }}
                />
              </div>
            </section>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 bg-white/96 px-5 py-3.5">
          <button
            onClick={onClose}
            className="ui-hover-surface rounded-xl px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
            style={{ background: accent }}
          >
            Salvar alteracoes
          </button>
        </div>
      </div>
    </div>
  );
};
