import React, { useState, useEffect } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { schoolProfile, language, setLanguage, t, students, marks } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Real-time cloud sync status indicator state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSyncedText, setLastSyncedText] = useState<string>('Just now');

  // Monitor students or marks changes to trigger syncing animation briefly
  useEffect(() => {
    const isConnected = localStorage.getItem('madrasha_gdrive_connected') === 'true';
    if (!isConnected) {
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    const timer = setTimeout(() => {
      setSyncStatus('synced');
      setLastSyncedText(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearTimeout(timer);
  }, [students, marks]);

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'students', label: t('students'), icon: Users },
    { id: 'subjects', label: t('subjects'), icon: BookOpen },
    { id: 'marks', label: t('marks'), icon: PenTool },
    { id: 'attendance', label: t('attendance'), icon: Users },
    { id: 'results', label: t('results'), icon: FileSpreadsheet },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 print:hidden`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white shadow-md">
              M
            </div>
            <span className="font-bold text-lg tracking-tight">{t('madrasha')}</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden p-1 hover:bg-slate-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500">
                v1.1.0 AI Enabled
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Cloud Live
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 z-40 print:hidden">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
                <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
                >
                <Menu size={20} />
                </button>
                <h1 className="text-xl font-bold text-gray-800 hidden md:block">
                    {schoolProfile.name}
                </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Real-time Cloud Sync Status Indicator */}
              <div 
                onClick={() => setActiveTab('settings')}
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium cursor-pointer hover:bg-gray-100 transition-colors shadow-2xs"
                title="Google Drive Cloud Sync Status"
              >
                <Cloud size={14} className="text-blue-600" />
                {syncStatus === 'synced' && (
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>{language === 'bn' ? 'সিঙ্কড (Synced)' : 'Synced'}</span>
                    <span className="text-[10px] text-gray-400">({lastSyncedText})</span>
                  </span>
                )}
                {syncStatus === 'syncing' && (
                  <span className="flex items-center gap-1.5 text-blue-600 animate-pulse">
                    <RefreshCw size={13} className="animate-spin text-blue-500" />
                    <span>{language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}</span>
                  </span>
                )}
                {syncStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertCircle size={13} className="text-amber-500" />
                    <span>{language === 'bn' ? 'সিঙ্ক ত্রুটি' : 'Sync Error'}</span>
                  </span>
                )}
              </div>

              <button 
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                <Languages size={16} />
                {language === 'en' ? 'বাংলা' : 'English'}
              </button>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{t('administrator')}</p>
                <p className="text-xs text-gray-500">{t('systemAdmin')}</p>
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
};
