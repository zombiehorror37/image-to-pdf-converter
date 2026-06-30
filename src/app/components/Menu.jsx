'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Reusable dropdown menu shared across the toolbars: a trigger button + a panel
// of action items. Generalizes the one-off dropdowns that used to live in
// SortMenu and the PDF "Tools" menu so theming/behavior stay consistent.
//
// items: array of { icon?, label, onClick, disabled?, divider?, danger? }
//   - `divider: true` renders a separator instead of a button.
// Closes on outside-click and Escape.
export default function Menu({
  isDark,
  label,
  icon: TriggerIcon,
  items,
  disabled = false,
  align = 'right',
  title,
  buttonClassName,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const defaultTrigger =
    `px-4 py-2.5 rounded-xl font-medium flex items-center gap-1.5 text-sm transition-all disabled:opacity-50 ${
      open
        ? isDark ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-700'
        : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    }`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={title || label}
        aria-label={title || label}
        aria-expanded={open}
        aria-haspopup="true"
        className={buttonClassName || defaultTrigger}
      >
        {TriggerIcon && <TriggerIcon className="w-4 h-4" />}
        {label && <span className="hidden sm:inline">{label}</span>}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-56 rounded-xl shadow-lg border z-30 py-1 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return (
                <div key={`divider-${i}`} className={`my-1 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={`${item.label}-${i}`}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  item.danger
                    ? 'text-red-500 ' + (isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50')
                    : isDark ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
