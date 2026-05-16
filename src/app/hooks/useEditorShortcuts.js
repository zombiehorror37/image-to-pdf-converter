import { useEffect } from 'react';

// Ctrl/Cmd+Z → undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y → redo.
// Skips when the active element is an editable field, and only fires while
// `isActive` is true (so multiple modes don't both react).
export function useEditorShortcuts(undo, redo, isActive) {
  useEffect(() => {
    const onKey = (e) => {
      if (!isActive) return;
      const target = e.target;
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isEditable) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, isActive]);
}
