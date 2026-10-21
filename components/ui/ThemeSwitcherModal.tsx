import React from 'react';
import { Palette, Check, Sun, Moon, X, Sparkles } from 'lucide-react';
import { useTheme, ACCENT_THEMES, AccentThemeId } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

interface ThemeSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSwitcherModal: React.FC<ThemeSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { accentTheme, setAccentTheme, darkMode, toggleDarkMode, showSuccess } = useTheme();
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
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
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

        {/* 5 Switchable Accent Themes */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {isBn ? 'অ্যাকসেন্ট কালার প্যালেট (৫টি থিম):' : 'Select Primary Accent Theme:'}
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

        {/* Dark Mode Toggle Card */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              {darkMode ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-500" />}
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                  {darkMode ? (isBn ? 'ডার্ক মোড সক্রিয়' : 'Dark Mode Enabled') : (isBn ? 'লাইট মোড সক্রিয়' : 'Light Mode Enabled')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isBn ? 'সফট শ্যাডো ও হাই কনট্রাস্ট' : 'Soft layered shadows & high contrast'}
                </span>
              </div>
            </div>

            <button
              onClick={toggleDarkMode}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                darkMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 shadow-xs'
              }`}
            >
              {darkMode ? (isBn ? 'সুইচ লাইট' : 'To Light') : (isBn ? 'সুইচ ডার্ক' : 'To Dark')}
            </button>
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
