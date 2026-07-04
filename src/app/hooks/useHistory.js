import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

// Bounded undo/redo wrapper around any value. Snapshots are stored by
// reference, so for arrays of large objects (e.g. images with data URLs)
// the underlying data is not duplicated — only the array slots are.
export function useHistory(initial) {
  const [state, setStateInternal] = useState({
    history: [initial],
    index: 0,
  });

  const value = state.history[state.index];

  const setValue = useCallback((next) => {
    setStateInternal((prev) => {
      const current = prev.history[prev.index];
      const newValue = typeof next === 'function' ? next(current) : next;
      if (newValue === current) return prev;
      const trimmed = prev.history.slice(0, prev.index + 1);
      trimmed.push(newValue);
      const capped = trimmed.length > MAX_HISTORY ? trimmed.slice(trimmed.length - MAX_HISTORY) : trimmed;
      return { history: capped, index: capped.length - 1 };
    });
  }, []);

  const replace = useCallback((newInitial) => {
    setStateInternal({ history: [newInitial], index: 0 });
  }, []);

  // Update the current snapshot in place without adding a history entry.
  // Use for non-user-visible state changes (e.g. lazy thumbnail rendering).
  const replaceCurrent = useCallback((next) => {
    setStateInternal((prev) => {
      const current = prev.history[prev.index];
      const newValue = typeof next === 'function' ? next(current) : next;
      if (newValue === current) return prev;
      const newHistory = [...prev.history];
      newHistory[prev.index] = newValue;
      return { history: newHistory, index: prev.index };
    });
  }, []);

  const undo = useCallback(() => {
    setStateInternal((prev) => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev));
  }, []);

  const redo = useCallback(() => {
    setStateInternal((prev) =>
      prev.index < prev.history.length - 1 ? { ...prev, index: prev.index + 1 } : prev,
    );
  }, []);

  return {
    value,
    setValue,
    replace,
    replaceCurrent,
    undo,
    redo,
    canUndo: state.index > 0,
    canRedo: state.index < state.history.length - 1,
    // All live snapshots — lets callers know what undo/redo can still reach
    // (e.g. to release resources referenced by no snapshot at all).
    snapshots: state.history,
  };
}
