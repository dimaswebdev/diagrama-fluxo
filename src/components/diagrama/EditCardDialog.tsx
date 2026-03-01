'use client';

import React, { useState, useEffect } from 'react';
import { Card as CardType } from '@/types/diagrama';

interface EditCardDialogProps {
  card: CardType;
  onSave: (updated: Partial<CardType> & { id: string }) => void;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  padding: 24,
  width: 600,
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
};

export const EditCardDialog: React.FC<EditCardDialogProps> = ({
  card,
  onSave,
  onClose
}) => {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [label, setLabel] = useState(card.label);
  const [date, setDate] = useState(card.date);
  const [source, setSource] = useState(card.source);
  const [summary, setSummary] = useState(card.summary || '');
  const [tags, setTags] = useState(card.tags?.join(', ') || '');
  const [accent, setAccent] = useState(card.accent);

  useEffect(() => {
    setTitle(card.title);
    setContent(card.content);
    setLabel(card.label);
    setDate(card.date);
    setSource(card.source);
    setSummary(card.summary || '');
    setTags(card.tags?.join(', ') || '');
    setAccent(card.accent);
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
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      accent
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Editar Card
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conteúdo"
            rows={4}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Data"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Fonte"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Resumo"
            rows={2}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (separadas por vírgula)"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <input
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            placeholder="Cor (accent)"
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #ccc',
                background: 'white'
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: accent,
                color: 'white',
                border: 'none'
              }}
            >
              Salvar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};