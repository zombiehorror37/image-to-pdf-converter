import { useState, useCallback, useRef } from 'react';

let counter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++counter;
      const item = {
        id,
        type: toast.type || 'info',
        title: toast.title,
        message: toast.message,
        action: toast.action,
        duration: toast.duration ?? (toast.type === 'error' ? 7000 : 4000),
      };
      setToasts((prev) => [...prev, item]);
      if (item.duration > 0) {
        const t = setTimeout(() => dismiss(id), item.duration);
        timers.current.set(id, t);
      }
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}
