'use client'

import { useCallback, useRef, useState } from 'react';
import { DiagramState } from '@/types/diagrama';
import { createHistoryManager } from './historyManager';

export function useHistory(initialState: DiagramState) {
  const managerRef = useRef(createHistoryManager(initialState));
  const [, setVersion] = useState(0);

  const notify = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const pushState = useCallback((newState: DiagramState) => {
    managerRef.current.pushState(newState);
    notify();
  }, [notify]);

  const undo = useCallback(() => {
    const previousState = managerRef.current.undo();
    if (!previousState) return null;
    notify();
    return previousState;
  }, [notify]);

  const redo = useCallback(() => {
    const nextState = managerRef.current.redo();
    if (!nextState) return null;
    notify();
    return nextState;
  }, [notify]);

  return {
    current: managerRef.current.getCurrent(),
    canUndo: managerRef.current.canUndo(),
    canRedo: managerRef.current.canRedo(),
    pushState,
    undo,
    redo,
  };
}
