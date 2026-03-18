import { useEffect } from 'react';

type UseDiagramKeyboardShortcutsParams = {
  cards: { id: string }[];
  connections: { id: string }[];
  texts: { id: string }[];
  groupBoxes: { id: string }[];
  isConnecting: boolean;
  setSelectedCards: (value: Set<string>) => void;
  setSelectedConnections: (value: Set<string>) => void;
  setSelectedTexts: (value: Set<string>) => void;
  setSelectedGroupBoxes: (value: Set<string>) => void;
  cancelConnection: () => void;
  deleteSelected: () => void;
  duplicateSelection: () => void;
  groupSelectedElements: () => void;
  ungroupSelectedElements: () => void;
  handleFitView: () => void;
  handleNewFile: () => void;
  handleRedo: () => void;
  handleUndo: () => void;
  openPrintDialog: () => void;
  spacePanPressedRef: React.MutableRefObject<boolean>;
};

export function useDiagramKeyboardShortcuts({
  cards,
  connections,
  texts,
  groupBoxes,
  isConnecting,
  setSelectedCards,
  setSelectedConnections,
  setSelectedTexts,
  setSelectedGroupBoxes,
  cancelConnection,
  deleteSelected,
  duplicateSelection,
  groupSelectedElements,
  ungroupSelectedElements,
  handleFitView,
  handleNewFile,
  handleRedo,
  handleUndo,
  openPrintDialog,
  spacePanPressedRef,
}: UseDiagramKeyboardShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.getAttribute?.('contenteditable') === 'true');

      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        spacePanPressedRef.current = true;
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedCards(new Set(cards.map((c) => c.id)));
        setSelectedConnections(new Set(connections.map((c) => c.id)));
        setSelectedTexts(new Set(texts.map((t) => t.id)));
        setSelectedGroupBoxes(new Set(groupBoxes.map((g) => g.id)));
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelectedElements();
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        ungroupSelectedElements();
        return;
      }

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        openPrintDialog();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFitView();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        return;
      }

      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spacePanPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    cards,
    connections,
    texts,
    groupBoxes,
    cancelConnection,
    deleteSelected,
    duplicateSelection,
    groupSelectedElements,
    handleFitView,
    handleNewFile,
    handleRedo,
    handleUndo,
    isConnecting,
    openPrintDialog,
    setSelectedCards,
    setSelectedConnections,
    setSelectedTexts,
    setSelectedGroupBoxes,
    spacePanPressedRef,
    ungroupSelectedElements,
  ]);
}
