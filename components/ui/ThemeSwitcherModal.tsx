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

  const selectedTheme = ACCENT_THEMES.find(t => t.id === accentTheme) || ACCENT_THEMES[0];

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

        {/* Accent color dots — tap a dot to apply instantly */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {isBn ? `অ্যাকসেন্ট কালার (${ACCENT_THEMES.length}টি থিম):` : 'Accent color:'}
          </label>

          <div className="grid grid-cols-5 gap-x-2 gap-y-4">
            {ACCENT_THEMES.map(theme => {
              const isSelected = accentTheme === theme.id;
              const title = isBn ? theme.nameBn : theme.nameEn;

              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectAccent(theme.id, title)}
                  aria-label={title}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <span
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: theme.primary,
                      boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 5px ${theme.ring}` : undefined
                    }}
                  >
                    {isSelected && <Check size={18} className="text-white stroke-[3]" />}
                  </span>
                  <span
                    className={`text-[10px] leading-tight text-center font-medium ${
                      isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {title}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {isBn ? 'বর্তমান: ' : 'Current: '}
            <span className="font-bold" style={{ color: 'var(--color-brand)' }}>
              {isBn ? selectedTheme.nameBn : selectedTheme.nameEn}
            </span>
          </p>
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
