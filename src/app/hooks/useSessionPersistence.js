import { useEffect, useRef, useState } from 'react';
import { saveSession, loadSession, clearSession } from '../lib/storageDb';

// Auto-save `payloadFn()` to IDB under `key` whenever any value in `deps`
// changes, debounced by `debounceMs`. Loads any restorable session on mount
// and surfaces it via `restorable`. The caller decides what to do with it.
//
// Call `skipNextSave()` immediately before a state change that you don't
// want to trigger a save (e.g. when restoring).
export function useSessionPersistence({
  key,
  deps,
  payloadFn,
  isEmpty,
  debounceMs = 600,
}) {
  const [restorable, setRestorable] = useState(null);
  const timerRef = useRef(null);
  const skipRef = useRef(false);
  const payloadRef = useRef(payloadFn);
  const isEmptyRef = useRef(isEmpty);

  // Keep latest closures without retriggering the save effect.
  payloadRef.current = payloadFn;
  isEmptyRef.current = isEmpty;

  // Load on mount.
  useEffect(() => {
    let cancelled = false;
    loadSession(key).then((session) => {
      if (!cancelled && session) setRestorable(session);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Debounced save on dep change.
  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isEmptyRef.current()) {
      clearSession(key);
      return;
    }
    timerRef.current = setTimeout(() => {
      saveSession(key, payloadRef.current());
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs, ...deps]);

  const skipNextSave = () => {
    skipRef.current = true;
  };

  const discard = () => {
    clearSession(key);
    setRestorable(null);
  };

  const consumeRestorable = () => {
    setRestorable(null);
  };

  return { restorable, skipNextSave, discard, consumeRestorable };
}
