'use client'

import { useState, useCallback } from 'react';
import { DiagramState } from '@/types/diagrama';

export function useHistory(initialState: DiagramState) {

  const [history, setHistory] = useState<DiagramState[]>([
    structuredClone(initialState)
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const pushState = useCallback((newState: DiagramState) => {
    setHistory(prevHistory => {
      const truncated = prevHistory.slice(0, currentIndex + 1);

      return [
        ...truncated,
        structuredClone(newState)
      ];
    });

    setCurrentIndex(prev => prev + 1);

  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex === 0) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    return structuredClone(history[newIndex]);

  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return null;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);

    return structuredClone(history[newIndex]);

  }, [currentIndex, history]);

  return {
    current: history[currentIndex],
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    pushState,
    undo,
    redo
  };
}