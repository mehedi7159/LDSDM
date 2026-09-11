import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  PenTool, 
  FileSpreadsheet, 
  Settings, 
  Menu, 
  X,
  Languages,
  Cloud,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  LogOut,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AdminAuthModal } from './AdminAuthModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { 
    schoolProfile, 
    language, 
    setLanguage, 
    t, 
    cloudStatus, 
    cloudLastSynced, 
    isAdmin, 
    adminEmail,
    mode,
    setMode,
    logoutAdmin 
  } = useApp();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, adminOnly: false },
    { id: 'results', label: t('results'), icon: FileSpreadsheet, adminOnly: false },
    { id: 'students', label: t('students'), icon: Users, adminOnly: true },
    { id: 'subjects', label: t('subjects'), icon: BookOpen, adminOnly: true },
    { id: 'marks', label: t('marks'), icon: PenTool, adminOnly: true },
    { id: 'attendance', label: t('attendance'), icon: Users, adminOnly: true },
    { id: 'settings', label: t('settings'), icon: Settings, adminOnly: true },
  ];

  const handleTabClick = (itemId: string, isRestricted: boolean) => {
    setActiveTab(itemId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 print:hidden flex flex-col justify-between`}
      >
        <div>
          {/* Brand header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
                M
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-sm tracking-tight block truncate text-slate-100">{t('madrasha')}</span>
                <span className="text-[10px] text-slate-400 block font-mono">Cloud Sync Edition</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Pill in Sidebar */}
          <div className="px-4 pt-4 pb-2">
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              isAdmin 
                ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' 
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                {isAdmin ? <ShieldCheck size={16} className="text-emerald-400" /> : <Eye size={16} className="text-amber-400" />}
                <div>
                  <span className="text-[11px] font-bold block text-slate-200">
                    {isAdmin ? (language === 'bn' ? 'এডমিন মোড' : 'Admin Mode') : (language === 'bn' ? 'ভিউয়ার মোড' : 'Viewer Mode')}
                  </span>
                  <span className="text-[9px] text-slate-400 block">
                    {isAdmin ? (language === 'bn' ? 'সম্পূর্ণ অ্যাক্সেস' : 'Full Access') : (language === 'bn' ? 'শুধু ফলাফল দেখুন' : 'Read-only')}
                  </span>
                </div>
              </div>

              {!isAdmin && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold shadow-xs transition-colors"
                >
                  {language === 'bn' ? 'লগইন' : 'Login'}
                </button>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {menuItems.map((item) => {
              const isLocked = item.adminOnly && !isAdmin;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id, isLocked)}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>

                  {isLocked && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center gap-1 border border-slate-700">
                      <Lock size={10} />
                      {language === 'bn' ? 'লক' : 'Lock'}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400 font-mono">Firebase Firestore</span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </div>
          </div>
          <p className="text-[10px] text-slate-500 truncate font-mono">
            {isAdmin ? adminEmail : 'mehedihasansagor26@gmail.com'}
          </p>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200/90 z-40 print:hidden shadow-xs">
          <div className="flex items-center justify-between px-5 py-3">
            {/* Left Title & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-slate-100 text-slate-700 rounded-xl"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-base font-bold text-slate-800 hidden sm:block tracking-tight">
                  {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
                </h1>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {schoolProfile.address}
                </p>
              </div>
            </div>

            {/* Right Tools & Mode Switcher */}
            <div className="flex items-center gap-3">
              {/* Live Cloud Status */}
              <div 
                onClick={() => setActiveTab('settings')}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-100 transition-colors"
                title="Firebase Firestore Cloud Live Status"
              >
                <Cloud size={14} className="text-blue-600" />
                {cloudStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>{language === 'bn' ? 'ক্লাউড সিঙ্কড' : 'Live Synced'}</span>
                  </span>
                )}
                {cloudStatus === 'syncing' && (
                  <span className="flex items-center gap-1.5 text-blue-600 animate-pulse font-medium text-[11px]">
                    <RefreshCw size={13} className="animate-spin text-blue-500" />
                    <span>{language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}</span>
                  </span>
                )}
                {cloudStatus === 'offline' && (
                  <span className="flex items-center gap-1.5 text-amber-600 font-medium text-[11px]">
                    <AlertCircle size={13} className="text-amber-500" />
                    <span>{language === 'bn' ? 'অফলাইন' : 'Offline'}</span>
                  </span>
                )}
              </div>

              {/* Language switcher */}
              <button 
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Languages size={14} />
                <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
              </button>

              {/* Admin / Viewer Switcher Button */}
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span className="font-bold">{language === 'bn' ? 'এডমিন সক্রিয়' : 'Admin'}</span>
                    <span className="text-[10px] text-emerald-600 font-mono">({adminEmail.split('@')[0]})</span>
                  </div>

                  <button 
                    onClick={() => logoutAdmin()}
                    title={language === 'bn' ? 'এডমিন থেকে বের হন (ভিউয়ার মোড)' : 'Switch to Viewer Mode'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">{language === 'bn' ? 'লগআউট' : 'Logout'}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Lock size={13} />
                  <span>{language === 'bn' ? 'এডমিন লগইন' : 'Admin Login'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 bg-slate-50/60">
          {children}
        </main>
      </div>

      {/* Reusable Admin Authentication Modal */}
      <AdminAuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
};
