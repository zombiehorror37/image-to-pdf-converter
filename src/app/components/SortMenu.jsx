'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';

// One-shot sort dropdown shared by all tabs. `options` is [{ id, label }];
// picking one fires onSort(id) once and closes. Sorting is a normal reorder,
// so it stays fully compatible with manual drag-reorder (and undo/redo where
// the host tracks history).
export default function SortMenu({ isDark, options, onSort, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Sort"
        aria-label="Sort"
        aria-expanded={open}
        aria-haspopup="true"
        className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-1.5 text-sm transition-all disabled:opacity-50 ${
          open
            ? isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
            : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        }`}
      >
        <ArrowDownUp className="w-4 h-4" />
        <span className="hidden sm:inline">Sort</span>
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 w-52 rounded-xl shadow-lg border z-20 py-1 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setOpen(false); onSort(opt.id); }}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
