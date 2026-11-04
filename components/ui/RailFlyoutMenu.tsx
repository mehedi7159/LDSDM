import React, { useEffect, useRef, useState } from 'react';

export interface RailFlyoutItem {
  key: string;
  icon: any;
  label: string;
  active: boolean;
  onSelect: () => void;
}

interface RailFlyoutMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: RailFlyoutItem[];
  onClose: () => void;
  onPanelMouseEnter: () => void;
  onPanelMouseLeave: () => void;
}

/**
 * Floating rail submenu (flyout) — the smart-submenu mechanism for the
 * desktop rail. The panel is position:fixed beside the anchor row, so it
 * never pushes other rail items, never squeezes the content area, and
 * never requires expanding the rail. It is anchored from the row's live
 * bounding rect and clamped into the viewport. The parent owns open state
 * and the hover-dwell / chevron-toggle triggers; this component owns only
 * the panel itself: placement, outside-click close, and Esc close.
 * Touch-first-class: the parent's chevron toggles it, item taps navigate
 * and close, taps elsewhere close it (outside mousedown).
 */
export const RailFlyoutMenu: React.FC<RailFlyoutMenuProps> = ({
  open,
  anchorEl,
  items,
  onClose,
  onPanelMouseEnter,
  onPanelMouseLeave,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Place beside the anchor row, clamped into the viewport. The height is
  // measured after mount (second pass) so a low row never clips off-screen.
  useEffect(() => {
    if (!open || !anchorEl) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = anchorEl.getBoundingClientRect();
      const h = panelRef.current?.offsetHeight ?? 160;
      const left = Math.max(8, Math.min(r.right + 8, window.innerWidth - 224));
      const top = Math.max(8, Math.min(r.top, window.innerHeight - h - 8));
      setPos({ top, left });
    };
    place();
    const t = window.setTimeout(place, 0);
    window.addEventListener('resize', place);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorEl]);

  // Close on outside tap/click (anything outside the panel AND the anchor
  // row) and on Esc. The parent also closes on navigation.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !anchorEl || !pos) return null;

  return (
    <div
      ref={panelRef}
      role="menu"
      onMouseEnter={onPanelMouseEnter}
      onMouseLeave={onPanelMouseLeave}
      className="fixed z-50 w-52 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      style={{ top: pos.top, left: pos.left }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-left cursor-pointer transition-all ${
              item.active
                ? 'text-white font-bold shadow-sm'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            style={item.active ? { backgroundColor: 'var(--color-brand, #4f46e5)' } : undefined}
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.active ? 'bg-white/20 text-white' : ''}`}
              style={item.active ? undefined : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand, #4f46e5)' }}
            >
              <Icon size={15} />
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
