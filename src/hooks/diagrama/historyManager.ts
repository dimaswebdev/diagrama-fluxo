import type { DiagramState } from '@/types/diagrama';

const cloneState = (state: DiagramState): DiagramState => structuredClone(state);

export type HistoryManager = {
  getCurrent: () => DiagramState;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushState: (state: DiagramState) => void;
  undo: () => DiagramState | null;
  redo: () => DiagramState | null;
};

export function createHistoryManager(initialState: DiagramState): HistoryManager {
  let history = [cloneState(initialState)];
  let currentIndex = 0;

  return {
    getCurrent: () => cloneState(history[currentIndex]),
    canUndo: () => currentIndex > 0,
    canRedo: () => currentIndex < history.length - 1,
    pushState: (state: DiagramState) => {
      const nextHistory = history.slice(0, currentIndex + 1);
      nextHistory.push(cloneState(state));
      history = nextHistory;
      currentIndex = history.length - 1;
    },
    undo: () => {
      if (currentIndex === 0) return null;
      currentIndex -= 1;
      return cloneState(history[currentIndex]);
    },
    redo: () => {
      if (currentIndex >= history.length - 1) return null;
      currentIndex += 1;
      return cloneState(history[currentIndex]);
    },
  };
}
