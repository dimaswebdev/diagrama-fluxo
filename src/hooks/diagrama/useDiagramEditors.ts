import { useCallback, useEffect, useState } from 'react';

import { estimateTextHeight } from '@/components/diagrama/textSizing';
import type {
  Card as CardType,
  DiagramState,
  DiagramText,
  GroupBox as GroupBoxType,
} from '@/types/diagrama';

type InlineCardDraft = {
  title: string;
  date: string;
  content: string;
  label: string;
};

type UseDiagramEditorsParams = {
  cards: CardType[];
  texts: DiagramText[];
  groupBoxes: GroupBoxType[];
  selectedCards: Set<string>;
  selectedTexts: Set<string>;
  selectedGroupBoxes: Set<string>;
  cardMap: Map<string, CardType>;
  getDiagramState: (overrides?: Partial<DiagramState>) => DiagramState;
  saveToHistory: (state?: DiagramState) => void;
  setCards: React.Dispatch<React.SetStateAction<CardType[]>>;
  setTexts: React.Dispatch<React.SetStateAction<DiagramText[]>>;
  setGroupBoxes: React.Dispatch<React.SetStateAction<GroupBoxType[]>>;
  setSelectedCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedConnections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedTexts: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedGroupBoxes: React.Dispatch<React.SetStateAction<Set<string>>>;
  inlineEditorRef: React.RefObject<HTMLDivElement | null>;
};

export function useDiagramEditors({
  cards,
  texts,
  groupBoxes,
  selectedCards,
  selectedTexts,
  selectedGroupBoxes,
  cardMap,
  getDiagramState,
  saveToHistory,
  setCards,
  setTexts,
  setGroupBoxes,
  setSelectedCards,
  setSelectedConnections,
  setSelectedTexts,
  setSelectedGroupBoxes,
  inlineEditorRef,
}: UseDiagramEditorsParams) {
  const [editingInlineCardId, setEditingInlineCardId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<InlineCardDraft | null>(null);
  const [inlineEditorHeight, setInlineEditorHeight] = useState(318);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextDraft, setEditingTextDraft] = useState('');
  const [editingGroupBoxId, setEditingGroupBoxId] = useState<string | null>(null);
  const [editingGroupDraft, setEditingGroupDraft] = useState('');

  const editingInlineCard = cards.find((card) => card.id === editingInlineCardId) ?? null;

  const openInlineEditor = useCallback((card: CardType) => {
    setSelectedCards(new Set([card.id]));
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setSelectedGroupBoxes(new Set());
    setEditingInlineCardId(card.id);
    setInlineDraft({
      title: card.title,
      date: card.date,
      content: card.content,
      label: card.label,
    });
  }, [setSelectedCards, setSelectedConnections, setSelectedGroupBoxes, setSelectedTexts]);

  const cancelInlineEditor = useCallback(() => {
    setEditingInlineCardId(null);
    setInlineDraft(null);
  }, []);

  const openTextEditor = useCallback((item: DiagramText) => {
    setSelectedTexts(new Set([item.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedGroupBoxes(new Set());
    setEditingTextId(item.id);
    setEditingTextDraft(item.text);
  }, [setSelectedCards, setSelectedConnections, setSelectedGroupBoxes, setSelectedTexts]);

  const cancelTextEditor = useCallback(() => {
    setEditingTextId(null);
    setEditingTextDraft('');
  }, []);

  const applyTextEditor = useCallback(() => {
    if (!editingTextId) return;
    const nextTexts = texts.map((item) =>
      item.id === editingTextId
        ? {
            ...item,
            text: editingTextDraft.trim() || item.text,
            height: estimateTextHeight(
              editingTextDraft.trim() || item.text,
              item.width,
              item.textStyle.fontSize,
              item.textStyle.lineHeight ?? 1.15
            ),
          }
        : item
    );
    setTexts(nextTexts);
    saveToHistory(getDiagramState({ texts: nextTexts }));
    cancelTextEditor();
  }, [cancelTextEditor, editingTextDraft, editingTextId, getDiagramState, saveToHistory, setTexts, texts]);

  const openGroupEditor = useCallback((item: GroupBoxType) => {
    setSelectedGroupBoxes(new Set([item.id]));
    setSelectedCards(new Set());
    setSelectedConnections(new Set());
    setSelectedTexts(new Set());
    setEditingGroupBoxId(item.id);
    setEditingGroupDraft(item.title);
  }, [setSelectedCards, setSelectedConnections, setSelectedGroupBoxes, setSelectedTexts]);

  const cancelGroupEditor = useCallback(() => {
    setEditingGroupBoxId(null);
    setEditingGroupDraft('');
  }, []);

  const applyGroupEditor = useCallback(() => {
    if (!editingGroupBoxId) return;
    const nextGroupBoxes = groupBoxes.map((item) =>
      item.id === editingGroupBoxId ? { ...item, title: editingGroupDraft.trim() || item.title } : item
    );
    setGroupBoxes(nextGroupBoxes);
    saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
    cancelGroupEditor();
  }, [cancelGroupEditor, editingGroupBoxId, editingGroupDraft, getDiagramState, groupBoxes, saveToHistory, setGroupBoxes]);

  const commitActiveLooseEditors = useCallback(() => {
    if (editingTextId) {
      const nextTexts = texts.map((item) =>
        item.id === editingTextId
          ? {
              ...item,
              text: editingTextDraft.trim() || item.text,
              height: estimateTextHeight(
                editingTextDraft.trim() || item.text,
                item.width,
                item.textStyle.fontSize,
                item.textStyle.lineHeight ?? 1.15
              ),
            }
          : item
      );
      setTexts(nextTexts);
      saveToHistory(getDiagramState({ texts: nextTexts }));
      setEditingTextId(null);
      setEditingTextDraft('');
    }

    if (editingGroupBoxId) {
      const nextGroupBoxes = groupBoxes.map((item) =>
        item.id === editingGroupBoxId ? { ...item, title: editingGroupDraft.trim() || item.title } : item
      );
      setGroupBoxes(nextGroupBoxes);
      saveToHistory(getDiagramState({ groupBoxes: nextGroupBoxes }));
      setEditingGroupBoxId(null);
      setEditingGroupDraft('');
    }
  }, [
    editingGroupBoxId,
    editingGroupDraft,
    editingTextDraft,
    editingTextId,
    getDiagramState,
    groupBoxes,
    saveToHistory,
    setGroupBoxes,
    setTexts,
    texts,
  ]);

  const applyInlineEditor = useCallback(() => {
    if (!editingInlineCardId || !inlineDraft) return;

    const nextCards = cards.map((card) =>
      card.id === editingInlineCardId
        ? {
            ...card,
            title: inlineDraft.title.trim() || card.title,
            date: inlineDraft.date.trim() || card.date,
            content: inlineDraft.content.trim() || card.content,
            label: inlineDraft.label.trim(),
          }
        : card
    );

    setCards(nextCards);
    saveToHistory(getDiagramState({ cards: nextCards }));
    cancelInlineEditor();
  }, [cancelInlineEditor, cards, editingInlineCardId, getDiagramState, inlineDraft, saveToHistory, setCards]);

  useEffect(() => {
    if (!editingInlineCard) {
      if (editingInlineCardId) {
        setEditingInlineCardId(null);
        setInlineDraft(null);
      }
      return;
    }

    setInlineDraft((current) => {
      if (!current) {
        return {
          title: editingInlineCard.title,
          date: editingInlineCard.date,
          content: editingInlineCard.content,
          label: editingInlineCard.label,
        };
      }
      return current;
    });
  }, [editingInlineCard, editingInlineCardId]);

  useEffect(() => {
    if (!editingInlineCard || !inlineEditorRef.current) return;

    const measure = () => {
      const nextHeight = inlineEditorRef.current?.offsetHeight;
      if (nextHeight && nextHeight !== inlineEditorHeight) {
        setInlineEditorHeight(nextHeight);
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(inlineEditorRef.current);
      return () => observer.disconnect();
    }
  }, [editingInlineCard, inlineDraft, inlineEditorHeight, inlineEditorRef]);

  const openSelectedCardEditor = useCallback(() => {
    cancelInlineEditor();
    cancelTextEditor();
    cancelGroupEditor();

    if (selectedCards.size === 1) {
      const id = Array.from(selectedCards)[0];
      const card = cardMap.get(id);
      if (card) {
        openInlineEditor(card);
      }
      return;
    }

    if (selectedTexts.size === 1) {
      const id = Array.from(selectedTexts)[0];
      const item = texts.find((text) => text.id === id);
      if (item) openTextEditor(item);
      return;
    }

    if (selectedGroupBoxes.size === 1) {
      const id = Array.from(selectedGroupBoxes)[0];
      const item = groupBoxes.find((groupBox) => groupBox.id === id);
      if (item) openGroupEditor(item);
    }
  }, [
    cancelGroupEditor,
    cancelInlineEditor,
    cancelTextEditor,
    cardMap,
    groupBoxes,
    openGroupEditor,
    openInlineEditor,
    openTextEditor,
    selectedCards,
    selectedGroupBoxes,
    selectedTexts,
    texts,
  ]);

  return {
    editingInlineCard,
    editingInlineCardId,
    inlineDraft,
    setInlineDraft,
    inlineEditorHeight,
    editingTextId,
    editingTextDraft,
    setEditingTextDraft,
    editingGroupBoxId,
    editingGroupDraft,
    setEditingGroupDraft,
    openInlineEditor,
    cancelInlineEditor,
    openTextEditor,
    cancelTextEditor,
    applyTextEditor,
    openGroupEditor,
    cancelGroupEditor,
    applyGroupEditor,
    commitActiveLooseEditors,
    applyInlineEditor,
    openSelectedCardEditor,
  };
}
