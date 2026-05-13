'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, ChevronsUp, ChevronsDown, ArrowUpDown } from 'lucide-react';
import PositionDialog from './PositionDialog';

export default function CardMenu({ isDark, index, total, onReorder }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [showPosition, setShowPosition] = useState(false);
  // Avoid calling document during SSR
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const openMenu = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Close if the page scrolls (menu would float away from its button)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  const item = (Icon, label, handler, disabled = false) => (
    <button
      key={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); setOpen(false); if (!disabled) handler(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-40 ${
        isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  const dropdown = open ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
      className={`w-44 rounded-xl shadow-lg border py-1 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {item(ChevronsUp,   'Move to top',       () => onReorder(index, 0),         index === 0)}
      {item(ChevronsDown, 'Move to bottom',    () => onReorder(index, total - 1), index === total - 1)}
      {item(ArrowUpDown,  'Move to position…', () => setShowPosition(true))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openMenu}
        className={`p-2 rounded-lg transition-all ${
          isDark
            ? 'bg-black/60 backdrop-blur-sm hover:bg-black/80'
            : 'bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm'
        }`}
        aria-label="More options"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Portal keeps the dropdown outside any opacity/overflow ancestor */}
      {mounted && createPortal(dropdown, document.body)}

      {showPosition && (
        <PositionDialog
          isDark={isDark}
          currentIndex={index}
          total={total}
          onClose={() => setShowPosition(false)}
          onMove={(toIndex) => { setShowPosition(false); onReorder(index, toIndex); }}
        />
      )}
    </>
  );
}
