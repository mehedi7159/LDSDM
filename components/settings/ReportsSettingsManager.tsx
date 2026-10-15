import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Settings, 
  Megaphone, 
  BarChart3, 
  Database, 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Building2, 
  Printer, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Clock, 
  Users, 
  BookOpen, 
  Award, 
  Wallet, 
  HardDrive, 
  Server, 
  Eye, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
  Layers, 
  Lock, 
  ExternalLink, 
  ChevronRight, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Check, 
  X, 
  Sliders, 
  HelpCircle 
} from 'lucide-react';
import { formatNumber, formatSafeDateTime } from '../../services/utils';
import { NoticeBoard } from '../NoticeBoard';
import { ExecutiveInstitutionalDashboard } from '../ExecutiveInstitutionalDashboard';
import { AdminReportView } from '../AdminReportView';
import { DataSecurityBackupCenter } from '../DataSecurityBackupCenter';
import { SuperAdminAuditPage } from '../SuperAdminAuditPage';
import { CloudSyncWidget } from '../CloudSyncWidget';
import { Button } from '../ui/Button';
import { SchoolProfile } from '../../types';

export type ReportsSettingsSubTab = 
  | 'notices' 
  | 'admin_reports' 
  | 'profile' 
  | 'branding' 
  | 'backup' 
  | 'audit' 
  | 'diagnostics';

interface ReportsSettingsManagerProps {
  initialSubTab?: ReportsSettingsSubTab;
  onNavigateTab?: (tab: string) => void;
}

export const ReportsSettingsManager: React.FC<ReportsSettingsManagerProps> = ({
  initialSubTab = 'notices',
  onNavigateTab
}) => {
  const {
    schoolProfile,
    updateSchoolProfile,
    notices = [],
    students = [],
    teachers = [],
    classes = [],
    subjects = [],
    exams = [],
    marks = [],
    transactions = [],
    trashBin = [],
    isAdmin,
    isSuperAdmin,
    isOwnerAdmin,
    authUser,
    language,
    t,
    hasPermission
  } = useApp();

  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<ReportsSettingsSubTab>(initialSubTab);

  // Sync internal state when external initialSubTab changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Profile Form state
  const [profileData, setProfileData] = useState<SchoolProfile>(schoolProfile);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  useEffect(() => {
    setProfileData(schoolProfile);
  }, [schoolProfile]);

  // Report sub-view toggle
  const [reportSubView, setReportSubView] = useState<'executive' | 'governance'>('executive');

  // Diagnostics storage calculation
  const [storageStats, setStorageStats] = useState<{
    usedBytes: number;
    usedFormatted: string;
    keyCounts: number;
    quotaPercent: number;
  }>({
    usedBytes: 0,
    usedFormatted: '0 KB',
    keyCounts: 0,
    quotaPercent: 0
  });

  const calculateStorage = () => {
    try {
      let totalBytes = 0;
      let count = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2; // UTF-16
          count++;
        }
      }
      const kb = totalBytes / 1024;
      const mb = kb / 1024;
      const formatted = mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
      const quotaPercent = Math.min(100, Math.round((totalBytes / (5 * 1024 * 1024)) * 100));
      setStorageStats({
        usedBytes: totalBytes,
        usedFormatted: formatted,
        keyCounts: count,
        quotaPercent
      });
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    calculateStorage();
  }, [activeTab]);

  // Profile completeness score
  const profileCompleteness = useMemo(() => {
    let score = 0;
    const totalFields = 8;
    if (schoolProfile.name?.trim()) score++;
    if (schoolProfile.nameBn?.trim()) score++;
    if (schoolProfile.address?.trim() || schoolProfile.addressBn?.trim()) score++;
    if (schoolProfile.phone?.trim()) score++;
    if (schoolProfile.email?.trim()) score++;
    if (schoolProfile.established?.trim()) score++;
    if (schoolProfile.logoUrl?.trim()) score++;
    if (schoolProfile.signatureUrl?.trim()) score++;
    return Math.round((score / totalFields) * 100);
  }, [schoolProfile]);

  // Active notices statistics
  const noticeStats = useMemo(() => {
    const total = notices.length;
    const pinned = notices.filter(n => n.isPinned).length;
    const urgent = notices.filter(n => n.priority === 'urgent').length;
    return { total, pinned, urgent };
  }, [notices]);

  // Handle Profile input changes
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setProfileData(prev => ({ ...prev, [name]: checked }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle Logo / Signature / Watermark upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(isBn ? 'ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট (2MB) হতে পারবে।' : 'File size cannot exceed 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (field: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => {
    setProfileData(prev => ({ ...prev, [field]: '' }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolProfile(profileData);
    setProfileSaveSuccess(true);
    setTimeout(() => setProfileSaveSuccess(false), 3000);
  };

  // Quick 1-click full JSON backup download
  const handleQuickBackup = () => {
    try {
      const payload = {
        meta: {
          institution: schoolProfile.name,
          institutionBn: schoolProfile.nameBn,
          exportedAt: new Date().toISOString(),
          version: '2.5'
        },
        schoolProfile,
        students,
        teachers,
        classes,
        subjects,
        exams,
        marks,
        transactions,
        notices
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madrasah_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(isBn ? 'ব্যাকআপ ডাউনলোড করতে ব্যর্থ হয়েছে।' : 'Failed to export backup file.');
    }
  };

  const handlePrintInstitutionalReport = () => {
    window.print();
  };

  // Navigation sub-tabs list
  const subTabs = [
    {
      id: 'notices' as ReportsSettingsSubTab,
      labelBn: 'নোটিশ ও বার্তা',
      labelEn: 'Notices & Alerts',
      icon: Megaphone,
      badge: noticeStats.urgent > 0 ? `${noticeStats.urgent} Urgent` : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'admin_reports' as ReportsSettingsSubTab,
      labelBn: 'সার্বিক প্রশাসনিক রিপোর্ট',
      labelEn: 'Institutional Reports',
      icon: BarChart3,
      badge: 'Executive',
      badgeColor: 'bg-indigo-600 text-white'
    },
    {
      id: 'profile' as ReportsSettingsSubTab,
      labelBn: 'মাদ্রাসা প্রোফাইল',
      labelEn: 'Madrasah Profile',
      icon: Building2,
      badge: `${profileCompleteness}%`,
      badgeColor: profileCompleteness === 100 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
    },
    {
      id: 'branding' as ReportsSettingsSubTab,
      labelBn: 'ব্র্যান্ডিং ও প্রিন্ট',
      labelEn: 'Branding & Seal',
      icon: Sliders
    },
    {
      id: 'backup' as ReportsSettingsSubTab,
      labelBn: 'ডাটা সুরক্ষা ও ব্যাকআপ',
      labelEn: 'Data Vault & Backup',
      icon: Database,
      badge: 'Safe',
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'audit' as ReportsSettingsSubTab,
      labelBn: 'সিকিউরিটি অডিট',
      labelEn: 'Security Audit',
      icon: ShieldCheck,
      badge: 'Super',
      badgeColor: 'bg-purple-600 text-white'
    },
    {
      id: 'diagnostics' as ReportsSettingsSubTab,
      labelBn: 'সিস্টেম ডায়াগনস্টিকস',
      labelEn: 'Diagnostics',
      icon: Activity
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      
      {/* ========================================================================= */}
      {/* TOP HERO BANNER & INSTITUTIONAL CONTROL BAR                               */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-indigo-900/60 relative overflow-hidden print:hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Settings size={14} className="text-indigo-400" />
              <span>{isBn ? 'ধাপ ৮ • সার্বিক রিপোর্ট, নোটিশ ও সেটিংস হাব' : 'Step 8 • Institutional Reports, Notices & Settings Hub'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{schoolProfile.nameBn || schoolProfile.name || (isBn ? 'মাদ্রাসা ব্যবস্থাপনা সিস্টেম' : 'Madrasah Management')}</span>
              {schoolProfile.logoUrl && (
                <img 
                  src={schoolProfile.logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 rounded-full object-cover border border-white/30 shadow-xs"
                />
              )}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isBn 
                ? 'বিজ্ঞপ্তি প্রকাশ, প্রাতিষ্ঠানিক প্রশাসনিক রিপোর্ট, প্রোফাইল তথ্য, সিল-স্বাক্ষর ব্র্যান্ডিং, ডাটাবেজ ব্যাকআপ ও সিকিউরিটি অডিট ট্রেইল পরিচালনা করুন।'
                : 'Manage official notices, consolidated institutional reports, madrasah profile, official stamps, cloud backup vault, and security audit trails.'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleQuickBackup}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-900/30 cursor-pointer active:scale-95"
            >
              <Download size={14} />
              <span>{isBn ? 'দ্রুত ব্যাকআপ (JSON)' : 'Quick Backup'}</span>
            </button>

            <button
              onClick={() => setActiveTab('notices')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all border border-white/15 cursor-pointer active:scale-95"
            >
              <Megaphone size={14} className="text-amber-400" />
              <span>{isBn ? 'নতুন নোটিশ' : 'Post Notice'}</span>
            </button>

            <button
              onClick={handlePrintInstitutionalReport}
              className="px-3.5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Printer size={14} />
              <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* Live KPI & Institutional Health Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/10 relative z-10">
          
          {/* KPI 1: Notices */}
          <div 
            onClick={() => setActiveTab('notices')}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{isBn ? 'প্রকাশিত নোটিশ' : 'Notices'}</span>
              <Megaphone size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-black text-white mt-1">
              {formatNumber(noticeStats.total, language)}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({formatNumber(noticeStats.pinned, language)} {isBn ? 'পিন্ড' : 'pinned'})
              </span>
            </div>
          </div>

          {/* KPI 2: Profile Readiness */}
          <div 
            onClick={() => setActiveTab('profile')}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{isBn ? 'প্রোফাইল পূর্ণতা' : 'Profile'}</span>
              <Building2 size={14} className="text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
              <span>{formatNumber(profileCompleteness, language)}%</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                {profileCompleteness >= 80 ? (isBn ? 'পরিপূর্ণ' : 'Ready') : (isBn ? 'অসম্পূর্ণ' : 'Pending')}
              </span>
            </div>
          </div>

          {/* KPI 3: Backup Vault Storage */}
          <div 
            onClick={() => setActiveTab('backup')}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{isBn ? 'ডাটা ব্যাকআপ' : 'Vault'}</span>
              <Database size={14} className="text-blue-400" />
            </div>
            <div className="text-xl font-black text-white mt-1 flex items-center gap-1.5">
              <span>{storageStats.usedFormatted}</span>
              <span className="text-[10px] text-blue-300 font-bold">
                ({storageStats.quotaPercent}% {isBn ? 'কোটা' : 'quota'})
              </span>
            </div>
          </div>

          {/* KPI 4: Security Tier */}
          <div 
            onClick={() => setActiveTab('audit')}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{isBn ? 'সিকিউরিটি' : 'Security'}</span>
              <ShieldCheck size={14} className="text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-300 mt-1 flex items-center gap-1">
              <span>{isSuperAdmin ? 'Tier-1 Root' : isAdmin ? 'Admin' : 'Restricted'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 font-bold">
                RBAC
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* UNIFIED SUB-TABS NAVIGATION BAR                                           */}
      {/* ========================================================================= */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs print:hidden overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : (tab.badgeColor || 'bg-slate-100 text-slate-700')
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: NOTICE BOARD & BROADCAST ALERTS                                */}
      {/* ========================================================================= */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          <NoticeBoard onBack={() => setActiveTab('admin_reports')} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CONSOLIDATED INSTITUTIONAL REPORTS                            */}
      {/* ========================================================================= */}
      {activeTab === 'admin_reports' && (
        <div className="space-y-6">
          {/* Sub-view toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {isBn ? 'ভিউ নির্বাচন:' : 'View Mode:'}
              </span>
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                <button
                  onClick={() => setReportSubView('executive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportSubView === 'executive'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? '📊 সার্বিক এক্সিকিউটিভ ড্যাশবোর্ড' : '📊 Executive Dashboard'}
                </button>
                <button
                  onClick={() => setReportSubView('governance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportSubView === 'governance'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? '🛡️ সিস্টেম গভর্নেন্স ও অডিট' : '🛡️ Governance & System'}
                </button>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
            >
              <Printer size={14} />
              <span>{isBn ? 'রিপোর্ট প্রিন্ট করুন' : 'Print Report'}</span>
            </button>
          </div>

          {reportSubView === 'executive' ? (
            <ExecutiveInstitutionalDashboard 
              onNavigate={(tab) => {
                if (tab === 'students') onNavigateTab ? onNavigateTab('students') : setActiveTab('profile');
                else if (tab === 'teachers') onNavigateTab ? onNavigateTab('user_roles') : setActiveTab('profile');
                else if (tab === 'marks' || tab === 'results') onNavigateTab ? onNavigateTab('results') : setActiveTab('admin_reports');
                else if (tab === 'finance') onNavigateTab ? onNavigateTab('finance') : setActiveTab('admin_reports');
                else if (tab === 'notices') setActiveTab('notices');
              }} 
            />
          ) : (
            <AdminReportView />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: MADRASAH PROFILE SETTINGS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* Header & Success state */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Building2 size={22} className="text-indigo-600" />
                <span>{isBn ? 'মাদ্রাসা প্রোফাইল ও প্রাতিষ্ঠানিক তথ্য' : 'Madrasah Profile & Institutional Details'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isBn 
                  ? 'মাদ্রাসার নাম, ঠিকানা, যোগাযোগ নম্বর, শিক্ষাবর্ষ এবং মুহতামিমের তথ্য আপডেট করুন।'
                  : 'Update institution name in Bengali and English, EIIN, contact info, and principal credentials.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {profileSaveSuccess && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 animate-in fade-in">
                  <CheckCircle2 size={15} />
                  <span>{isBn ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!'}</span>
                </div>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition-all"
              >
                <Check size={16} />
                <span>{isBn ? 'প্রোফাইল সেভ করুন' : 'Save Profile'}</span>
              </button>
            </div>
          </div>

          {/* Form Fields Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {isBn ? 'মৌলিক পরিচিতি (General Identity)' : 'Basic Institutional Identity'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মাদ্রাসার নাম (বাংলায়) *' : 'Madrasah Name (Bangla) *'}
                </label>
                <input
                  type="text"
                  name="nameBn"
                  required
                  value={profileData.nameBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: জামিয়া ইসলামিয়া দারুল উলুম মাদ্রাসা"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla font-semibold bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মাদ্রাসার নাম (ইংরেজিতে) *' : 'Madrasah Name (English) *'}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={profileData.name || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Jamia Islamia Darul Uloom Madrasah"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'ঠিকানা (বাংলায়)' : 'Address (Bangla)'}
                </label>
                <input
                  type="text"
                  name="addressBn"
                  value={profileData.addressBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: ডাকঘর- মদিনাতুল উলুম, থানা ও জেলা- ঢাকা"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'ঠিকানা (ইংরেজিতে)' : 'Address (English)'}
                </label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Madinatul Uloom, Dhaka, Bangladesh"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'অফিসিয়াল ফোন নম্বর' : 'Official Phone / Mobile'}
                </label>
                <input
                  type="text"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleProfileChange}
                  placeholder="01700-000000"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'প্রাতিষ্ঠানিক ইমেইল' : 'Institutional Email'}
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email || ''}
                  onChange={handleProfileChange}
                  placeholder="info@madrasah.edu.bd"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'প্রতিষ্ঠার সন (Established Year)' : 'Established Year'}
                </label>
                <input
                  type="text"
                  name="established"
                  value={profileData.established || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: ১৯৪৮ খ্রি."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'চলতি শিক্ষাবর্ষ (Academic Session)' : 'Academic Session'}
                </label>
                <input
                  type="text"
                  name="academicYear"
                  value={profileData.academicYear || ''}
                  onChange={handleProfileChange}
                  placeholder="2026"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মুহতামিম / প্রধান শিক্ষকের নাম (বাংলা)' : 'Muhtamim / Principal Name (Bangla)'}
                </label>
                <input
                  type="text"
                  name="headMasterNameBn"
                  value={profileData.headMasterNameBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: হযরত মাওলানা আবুল হাসান"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla font-semibold bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মুহতামিম / প্রধান শিক্ষকের নাম (English)' : 'Muhtamim / Principal Name (English)'}
                </label>
                <input
                  type="text"
                  name="headMasterName"
                  value={profileData.headMasterName || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Maulana Abul Hasan"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 focus:bg-white"
                />
              </div>

            </div>

            {/* Official Letterhead Live Preview */}
            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {isBn ? 'অফিসিয়াল প্যাড / হেডার লাইভ প্রিভিউ' : 'Official Letterhead Live Preview'}
              </h4>
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1.5 relative overflow-hidden">
                {profileData.logoUrl && (
                  <img 
                    src={profileData.logoUrl} 
                    alt="Logo preview" 
                    className="w-16 h-16 mx-auto object-contain mb-2" 
                  />
                )}
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-bangla">
                  {profileData.nameBn || profileData.name || 'মাদ্রাসার নাম'}
                </h3>
                {profileData.name && (
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    {profileData.name}
                  </p>
                )}
                <p className="text-xs text-slate-500 font-bangla">
                  {profileData.addressBn || profileData.address || 'মাদ্রাসার ঠিকানা'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600 font-medium pt-1">
                  {profileData.phone && <span>📞 {profileData.phone}</span>}
                  {profileData.email && <span>✉️ {profileData.email}</span>}
                  {profileData.established && <span>🏛️ {isBn ? 'স্থাপিত:' : 'Est:'} {profileData.established}</span>}
                </div>
              </div>
            </div>

          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: BRANDING, SEAL & PRINT CUSTOMIZATION                           */}
      {/* ========================================================================= */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Sliders size={22} className="text-indigo-600" />
                <span>{isBn ? 'ব্র্যান্ডিং, অফিসিয়াল সিল ও প্রিন্ট কনফিগারেশন' : 'Official Branding, Stamps & Print Customization'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? 'মাদ্রাসার লোগো, ওয়াটারমার্ক, মুহতামিমের ডিজিটাল স্বাক্ষর এবং ফলাফল কার্ডের থিম কাস্টমাইজ করুন।'
                  : 'Customize logo, watermarks, principal digital signatures, and certificate templates.'}
              </p>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer transition-all active:scale-95"
            >
              <Check size={16} />
              <span>{isBn ? 'পরিবর্তন সেভ করুন' : 'Save Changes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Logo Upload Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'মাদ্রাসার প্রাতিষ্ঠানিক লোগো' : 'Madrasah Official Logo'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center p-2 bg-slate-50 relative group">
                {profileData.logoUrl ? (
                  <img src={profileData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <ImageIcon size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'লোগো নেই' : 'No Logo'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <span>{isBn ? 'আপলোড করুন' : 'Upload'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, 'logoUrl')} 
                    className="hidden" 
                  />
                </label>
                {profileData.logoUrl && (
                  <button
                    type="button"
                    onClick={() => removeImage('logoUrl')}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isBn ? 'পিএনজি অথবা জেপিজি (স্বচ্ছ ব্যাকগ্রাউন্ড সুবিধাজনক)' : 'PNG or JPG with transparent bg'}
              </p>
            </div>

            {/* Signature Upload Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'মুহতামিমের অফিসিয়াল স্বাক্ষর' : 'Principal / Muhtamim Signature'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center p-2 bg-slate-50 relative">
                {profileData.signatureUrl ? (
                  <img src={profileData.signatureUrl} alt="Signature" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <Edit2 size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'স্বাক্ষর নেই' : 'No Signature'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <span>{isBn ? 'আপলোড করুন' : 'Upload'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, 'signatureUrl')} 
                    className="hidden" 
                  />
                </label>
                {profileData.signatureUrl && (
                  <button
                    type="button"
                    onClick={() => removeImage('signatureUrl')}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isBn ? 'মার্কশিট ও প্রশংসাপত্রে স্বয়ংক্রিয় বসবে' : 'Auto-placed on marksheet & certificates'}
              </p>
            </div>

            {/* Watermark Upload Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'ডকুমেন্ট ওয়াটারমার্ক সিল' : 'Document Watermark'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center p-2 bg-slate-50 relative">
                {profileData.watermarkUrl ? (
                  <img src={profileData.watermarkUrl} alt="Watermark" className="w-full h-full object-contain opacity-50" />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <Sparkles size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'ওয়াটারমার্ক নেই' : 'No Watermark'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <span>{isBn ? 'আপলোড করুন' : 'Upload'}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, 'watermarkUrl')} 
                    className="hidden" 
                  />
                </label>
                {profileData.watermarkUrl && (
                  <button
                    type="button"
                    onClick={() => removeImage('watermarkUrl')}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isBn ? 'মার্কশিটের মাঝখানে ব্যাকগ্রাউন্ডে প্রদর্শিত হবে' : 'Displayed in center of printed cards'}
              </p>
            </div>

          </div>

          {/* Template & Print Toggles */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
              {isBn ? 'প্রিন্ট ও ফলাফল কার্ড ডিসপ্লে সেটিংস' : 'Print & Result Card Display Preferences'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {isBn ? 'ডিফল্ট ফলাফল কার্ড টেমপ্লেট' : 'Default Result Card Template'}
                </label>
                <select
                  name="resultCardTemplate"
                  value={profileData.resultCardTemplate || 'Premium_Dakhil'}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                >
                  <option value="Premium_Dakhil">📜 প্রিমিয়াম দাখিল / আলিয়া ফর্ম্যাট (Premium Dakhil)</option>
                  <option value="Premium_Colored">🎨 আকর্ষণীয় কালারফুল থিম (Premium Colored)</option>
                  <option value="Premium_Royal">👑 রয়্যাল ক্রিস্টাল থিম (Royal Crest)</option>
                  <option value="Classic">📄 ক্লাসিক স্ট্যান্ডার্ড ফর্ম্যাট (Classic Standard)</option>
                  <option value="BW_Term">🖨️ ইকোনমি ব্ল্যাক অ্যান্ড হোয়াইট (B&W Economy)</option>
                  <option value="Monthly">📅 মাসিক মূল্যায়ন প্রগ্রেস কার্ড (Monthly Progress)</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showLogoOnCard"
                    checked={profileData.showLogoOnCard !== false}
                    onChange={handleProfileChange}
                    className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {isBn ? 'প্রিন্ট ও মার্কশিটে মাদ্রাসার লোগো প্রদর্শন করুন' : 'Show Logo on result cards and printouts'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showHeadmasterSignature"
                    checked={profileData.showHeadmasterSignature !== false}
                    onChange={handleProfileChange}
                    className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {isBn ? 'মুহতামিমের স্বাক্ষর মার্কশিটে স্বয়ংক্রিয় প্রিন্ট করুন' : 'Show Principal Signature on result cards'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showWatermark"
                    checked={Boolean(profileData.showWatermark)}
                    onChange={handleProfileChange}
                    className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {isBn ? 'মার্কশিটের ব্যাকগ্রাউন্ডে ওয়াটারমার্ক প্রদর্শন করুন' : 'Enable background watermark on marksheet'}
                  </span>
                </label>
              </div>

            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: DATA SECURITY & BACKUP CENTER                                 */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <DataSecurityBackupCenter isModal={false} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 6: SECURITY AUDIT TRAIL                                          */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <SuperAdminAuditPage />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 7: SYSTEM DIAGNOSTICS & DATA INTEGRITY                          */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Activity size={22} className="text-indigo-600" />
                <span>{isBn ? 'সিস্টেম ডাটাবেজ স্থিতি ও ডায়াগনস্টিকস' : 'System Database Status & Diagnostics'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isBn 
                  ? 'ডাটাবেজের রেকর্ড সংখ্যা, মেমরি কোটা এবং ক্লাউড সিঙ্ক্রোনাইজেশনের রিয়েল-টাইম তথ্য।'
                  : 'Real-time record census across all 9 core collections and memory storage analysis.'}
              </p>
            </div>

            <button
              onClick={() => {
                calculateStorage();
                alert(isBn ? 'ডায়াগনস্টিক তথ্য রিফ্রেশ করা হয়েছে।' : 'Diagnostics refreshed.');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
            >
              <RefreshCw size={14} />
              <span>{isBn ? 'রিফ্রেশ করুন' : 'Refresh Diagnostics'}</span>
            </button>
          </div>

          {/* Record Count Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শিক্ষার্থী' : 'Students'}</span>
                <Users size={16} className="text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(students.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শিক্ষক ও স্টাফ' : 'Teachers'}</span>
                <Users size={16} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(teachers.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শ্রেণি / জামাত' : 'Classes'}</span>
                <Layers size={16} className="text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(classes.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পাঠ্য বিষয়' : 'Subjects'}</span>
                <BookOpen size={16} className="text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(subjects.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পরীক্ষা ও টার্ম' : 'Exams'}</span>
                <Award size={16} className="text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(exams.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পরীক্ষার নম্বর রেকর্ড' : 'Marks Records'}</span>
                <Edit2 size={16} className="text-rose-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(marks.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'আর্থিক লেনদেন' : 'Transactions'}</span>
                <Wallet size={16} className="text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(transactions.length, language)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'ট্র্যাশ বিন' : 'Trash Bin'}</span>
                <Trash2 size={16} className="text-slate-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatNumber(trashBin.length, language)}
              </div>
            </div>

          </div>

          {/* Storage & Cloud Sync Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <HardDrive size={18} className="text-indigo-600" />
              <span>{isBn ? 'ব্রাউজার লোকাল স্টোরেজ কোটা ও মেমরি' : 'Browser Storage Quota & Health'}</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{isBn ? 'ব্যবহৃত মেমরি:' : 'Used Storage:'} {storageStats.usedFormatted}</span>
                <span>{storageStats.quotaPercent}% {isBn ? 'ব্যবহৃত (সর্বোচ্চ ৫ মেগাবাইট)' : 'of ~5MB quota'}</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    storageStats.quotaPercent > 80 
                      ? 'bg-rose-500' 
                      : storageStats.quotaPercent > 50 
                      ? 'bg-amber-500' 
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, storageStats.quotaPercent)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Server size={22} className="text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isBn ? 'ক্লাউড ফায়ারস্টোর রিয়েল-টাইম সিঙ্ক' : 'Cloud Firestore Realtime Sync'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isBn 
                      ? 'ইন্টারনেট সংযোগ থাকলে স্বয়ংক্রিয়ভাবে ক্লাউড ডাটাবেজে সিঙ্ক হয়।'
                      : 'Realtime bi-directional persistence active.'}
                  </p>
                </div>
              </div>

              <CloudSyncWidget />
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
