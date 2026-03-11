'use client'

import { useCallback, useRef, useState } from 'react';
import { DiagramState } from '@/types/diagrama';

const cloneState = (state: DiagramState): DiagramState => structuredClone(state);

export function useHistory(initialState: DiagramState) {
  const historyRef = useRef<DiagramState[]>([cloneState(initialState)]);
  const currentIndexRef = useRef(0);
  const [, setVersion] = useState(0);

  const notify = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const pushState = useCallback((newState: DiagramState) => {
    const nextHistory = historyRef.current.slice(0, currentIndexRef.current + 1);
    nextHistory.push(cloneState(newState));
    historyRef.current = nextHistory;
    currentIndexRef.current = nextHistory.length - 1;
    notify();
  }, [notify]);

  const undo = useCallback(() => {
    if (currentIndexRef.current === 0) return null;

    currentIndexRef.current -= 1;
    notify();
    return cloneState(historyRef.current[currentIndexRef.current]);
  }, [notify]);

  const redo = useCallback(() => {
    if (currentIndexRef.current >= historyRef.current.length - 1) return null;

    currentIndexRef.current += 1;
    notify();
    return cloneState(historyRef.current[currentIndexRef.current]);
  }, [notify]);

  return {
    current: historyRef.current[currentIndexRef.current],
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1,
    pushState,
    undo,
    redo,
  };
}
