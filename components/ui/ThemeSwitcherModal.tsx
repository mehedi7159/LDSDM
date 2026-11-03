import React from 'react';
import { Palette, Check, X } from 'lucide-react';
import { useTheme, ACCENT_THEMES, AccentThemeId } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

interface ThemeSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSwitcherModal: React.FC<ThemeSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { accentTheme, setAccentTheme, showSuccess } = useTheme();
  const { language } = useApp();

  if (!isOpen) return null;

  const isBn = language === 'bn';

  const handleSelectAccent = (id: AccentThemeId, name: string) => {
    setAccentTheme(id);
    showSuccess(
      isBn ? `সফলভাবে "${name}" অ্যাকসেন্ট থিম সক্রিয় করা হয়েছে!` : `Switched to ${name} accent theme!`,
      isBn ? 'থিম আপডেট' : 'Theme Updated'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', borderColor: 'var(--color-brand-ring)' }}
            >
              <Palette size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {isBn ? 'ডিজাইন ও কালার থিম কাস্টমাইজার' : 'Design & Accent Themes'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn ? 'আধুনিক SaaS স্টাইল (Schola / Linear / Stripe)' : 'Inspired by modern SaaS dashboards'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Switchable Accent Themes */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {isBn ? `অ্যাকসেন্ট কালার প্যালেট (${ACCENT_THEMES.length}টি থিম):` : 'Select Primary Accent Theme:'}
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {ACCENT_THEMES.map(theme => {
              const isSelected = accentTheme === theme.id;
              const title = isBn ? theme.nameBn : theme.nameEn;

              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectAccent(theme.id, title)}
                  className={`min-h-[48px] p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-400 dark:border-slate-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full shadow-inner border border-white/40 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {isSelected && <Check size={12} className="text-white stroke-[3]" />}
                    </span>

                    <div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                        {title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {theme.primary}
                      </span>
                    </div>
                  </div>

                  <span
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                    style={{
                      backgroundColor: theme.light,
                      color: theme.primary
                    }}
                  >
                    {isBn ? 'সক্রিয় করুন' : 'Preview'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs sm:text-sm transition cursor-pointer"
        >
          {isBn ? 'ঠিক আছে' : 'Done'}
        </button>
      </div>
    </div>
  );
};
