import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Award, 
  Bot, 
  Briefcase, 
  CalendarDays, 
  Megaphone, 
  Globe, 
  Settings, 
  ShieldCheck, 
  Palette, 
  Languages,
  ChevronRight,
  LogOut,
  Sliders,
  FileSpreadsheet,
  QrCode,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme, ACCENT_THEMES } from '../../context/ThemeContext';

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  activeTab: string;
}

export const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  activeTab
}) => {
  const { language, setLanguage, logoutAdmin, currentUser, isOwnerAdmin, isSuperAdmin } = useApp();
  const { accentTheme, setAccentTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const isBn = language === 'bn';

  const modules = [
    {
      id: 'results',
      title: isBn ? 'ফলাফল ও মার্কশিট' : 'Results & Marksheets',
      subtitle: isBn ? 'মেধা তালিকা, গ্রেডিং ও নম্বরপত্র' : 'Tabulation & Report Cards',
      icon: Award,
      badge: 'Protected'
    },
    {
      id: 'ai_principal_advisor',
      title: isBn ? 'মাস্টার এআই প্রিন্সিপাল' : 'Master AI Principal',
      subtitle: isBn ? 'অটোনোমাস প্রাতিষ্ঠানিক সহকারী' : 'AI Cockpit & Voice Studio',
      icon: Bot,
      badge: 'AI'
    },
    {
      id: 'staff',
      title: isBn ? 'শিক্ষক ও স্টাফ ডিরেক্টরি' : 'Staff & HR Directory',
      subtitle: isBn ? 'আসাতেযা তালিকা ও ছুটি' : 'Faculty, Leave & Duties',
      icon: Briefcase
    },
    {
      id: 'routine',
      title: isBn ? 'ক্লাস রুটিন ও সময়সূচি' : 'Timetable & Routine',
      subtitle: isBn ? 'সাপ্তাহিক পিরিয়ড বণ্টন' : 'Class Schedules',
      icon: CalendarDays
    },
    {
      id: 'notices',
      title: isBn ? 'নোটিশ বোর্ড ও পরিপত্র' : 'Notice Board',
      subtitle: isBn ? 'বিজ্ঞপ্তি ও জরুরি বার্তা' : 'Official Bulletins',
      icon: Megaphone
    },
    {
      id: 'portals_hub',
      title: isBn ? 'পোর্টাল ও সেবা হাব' : 'Portals & Services',
      subtitle: isBn ? 'অভিভাবক কর্নার ও ছাত্রাবাস' : 'Guardian Portal & Mess',
      icon: Globe
    },
    {
      id: 'backup_recovery',
      title: isBn ? 'ডাটা সুরক্ষা ও ব্যাকআপ হাব' : 'Data Backup & Safety',
      subtitle: isBn ? 'ক্লাউড ও লোকাল ব্যাকআপ' : 'Export & Recovery',
      icon: ShieldCheck
    },
    {
      id: 'recycle_bin',
      title: isBn ? 'রিসাইকেল বিন' : 'Recycle Bin',
      subtitle: isBn ? 'মুছে ফেলা তথ্য ফিরিয়ে আনুন' : 'Restore deleted items',
      icon: Trash2
    },
    {
      id: 'settings',
      title: isBn ? 'প্রাতিষ্ঠানিক সেটিংস' : 'System Settings',
      subtitle: isBn ? 'মাদ্রাসার প্রোফাইল ও কনফিগ' : 'Institution Profile',
      icon: Settings
    }
  ];

  const filteredModules = modules.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q);
  });

  const handleSelect = (id: string) => {
    onNavigateTab(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-up Sheet */}
      <div className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200/80 dark:border-slate-800 flex flex-col z-10 animate-in slide-in-from-bottom duration-300 overflow-hidden">
        {/* Grab Handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              {isBn ? 'সকল মেনু ও মডিউল' : 'All Modules & Services'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              LDSDM
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Close sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'মডিউল খুঁজুন...' : 'Search modules...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white border-0 focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
            />
          </div>
        </div>

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {filteredModules.map(mod => {
              const Icon = mod.icon;
              const isActive = activeTab === mod.id;

              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelect(mod.id)}
                  className={`w-full min-h-[52px] p-3 rounded-2xl border transition-all text-left flex items-center justify-between group cursor-pointer active:scale-[0.99] ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {mod.title}
                        </span>
                        {mod.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            {mod.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mod.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                </button>
              );
            })}
          </div>

          {/* Quick Settings Bar inside Sheet */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
              {isBn ? 'থিম ও পছন্দসমূহ' : 'Preferences & Accent'}
            </span>

            {/* Accent Theme Switcher Chips */}
            <div className="flex items-center gap-2 px-1 overflow-x-auto py-1">
              {ACCENT_THEMES.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setAccentTheme(theme.id)}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    accentTheme === theme.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <span>{isBn ? theme.nameBn.split(' ')[0] : theme.nameEn.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Language toggle */}
            <div>
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Languages size={15} className="text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'en' ? 'বাংলা সংস্করণ' : 'English Version'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Exit */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-500 truncate max-w-[180px]">
            {currentUser?.name || 'User'}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              logoutAdmin();
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <LogOut size={14} />
            <span>{isBn ? 'লগআউট' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
