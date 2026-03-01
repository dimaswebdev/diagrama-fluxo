'use client'

import { useState, useCallback } from 'react';
import { DiagramState } from '@/types/diagrama';

export function useHistory(initialState: DiagramState) {
  const [history, setHistory] = useState<DiagramState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const pushState = useCallback((newState: DiagramState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, newState];
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  return {
    history: history[currentIndex],
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    pushState,
    undo,
    redo
  };
}
