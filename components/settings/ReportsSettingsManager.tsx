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
  HardDrive, 
  Server, 
  Eye, 
  Edit2, 
  Trash2, 
  Image as ImageIcon, 
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
  HelpCircle,
  Type
} from 'lucide-react';
import { formatNumber, formatSafeDateTime } from '../../services/utils';
import { NoticeBoard } from '../NoticeBoard';
import { ExecutiveInstitutionalDashboard } from '../ExecutiveInstitutionalDashboard';
import { AdminReportView } from '../AdminReportView';
import { DataSecurityBackupCenter } from '../DataSecurityBackupCenter';
import { SuperAdminAuditPage } from '../SuperAdminAuditPage';
import { CloudSyncWidget } from '../CloudSyncWidget';
import { Button } from '../ui/Button';
import { ServerDataGate } from '../ui/ServerDataGate';
import { useTheme } from '../../context/ThemeContext';
import { SchoolProfile } from '../../types';
import { RETRY_LABEL, SCHOOL_PROFILE_CLOUD_FAILURE_MESSAGE } from '../../services/cloudConfirm';

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
    confirmSchoolProfileCloudSync,
    isRecordUnconfirmed,
    notices = [],
    students = [],
    teachers = [],
    classes = [],
    subjects = [],
    exams = [],
    marks = [],
    transactions = [],
    trashBin = [],
    users = [],
    isAdmin,
    isSuperAdmin,
    isOwnerAdmin,
    authUser,
    language,
    t,
    hasPermission,
    cloudHydrated
  } = useApp();

  const { showToast } = useTheme();
  const isBn = language === 'bn';
  // One entry per tile in the Diagnostics Record Count Matrix below —
  // the header counts the tiles rendered, so a new collection cannot
  // leave the header text stale again.
  const diagnosticTileCollections = [
    students, teachers, classes, subjects, exams, marks, transactions, trashBin, notices, users,
  ];
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
  // 7 Nov 2026 Job 6 (settings profile instant save): the save used to
  // call sync updateSchoolProfile and show instant 'সফলভাবে সংরক্ষিত!'
  // while the cloud write rode the silent background diff sync — a slow
  // connection failed with no UI at all. Now the local apply happens at
  // once, the confirm runs in the BACKGROUND, the green badge appears
  // ONLY when the confirm lands, and a failure shows an amber banner
  // with the real reason + Retry. The queued scalar payload also lights
  // the banner after a reload (isRecordUnconfirmed '__scalar__').
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [isRetryingProfile, setIsRetryingProfile] = useState(false);
  const profileUnconfirmed = isRecordUnconfirmed('schoolProfile', '__scalar__');

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
        showToast({
          type: 'error',
          title: isBn ? 'ফাইল খুব বড়' : 'File Too Large',
          message: isBn ? 'ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট (2MB) হতে পারবে।' : 'File size cannot exceed 2MB.'
        });
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

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message — a generic message
  // after a long silent wait is what made the Save button look dead.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || SCHOOL_PROFILE_CLOUD_FAILURE_MESSAGE));

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    // Validation: the two name fields are required (the form also marks
    // them required); an email, when given, must look like an email.
    if (!profileData.name?.trim() || !profileData.nameBn?.trim()) {
      showToast({
        type: 'error',
        title: isBn ? 'নাম দরকার' : 'Name Required',
        message: isBn ? 'মাদ্রাসার নাম (বাংলা ও English) দুটোই দিতে হবে।' : 'Both the Bangla and English madrasah names are required.'
      });
      return;
    }
    if (profileData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email.trim())) {
      showToast({
        type: 'error',
        title: isBn ? 'ইমেইল ঠিক নয়' : 'Invalid Email',
        message: isBn ? 'সঠিক ইমেইল ঠিকানা দিন, অথবা খালি রাখুন।' : 'Enter a valid email address, or leave it blank.'
      });
      return;
    }
    setProfileSaveError(null);
    setProfileSaveSuccess(false);
    // Instant (Job 0 template): the local mutation applies at once and
    // the confirm runs in the BACKGROUND — the Save button never blocks
    // on the full-doc round-trip. Closing/saving means 'saved on this
    // device, syncing'; the green badge appears only when the confirm
    // lands, and a failure shows the amber banner + Retry below.
    updateSchoolProfile(profileData);
    setProfileSyncing(true);
    showToast({
      type: 'info',
      title: isBn ? 'সংরক্ষিত হয়েছে' : 'Saved',
      message: isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'
    });
    void confirmSchoolProfileCloudSync(profileData).then((result) => {
      setProfileSyncing(false);
      if (result.success) {
        setProfileSaveSuccess(true);
        setTimeout(() => setProfileSaveSuccess(false), 3000);
      } else {
        setProfileSaveError(confirmErrorMessage(result));
      }
    });
  };

  // Retry re-confirms the SAME saved profile (no re-save needed).
  const retryProfileSave = async () => {
    if (isRetryingProfile) return;
    setIsRetryingProfile(true);
    setProfileSaveError(null);
    const result = await confirmSchoolProfileCloudSync(profileData);
    setIsRetryingProfile(false);
    if (result.success) {
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } else {
      setProfileSaveError(confirmErrorMessage(result));
    }
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
      showToast({
        type: 'error',
        title: isBn ? 'ব্যাকআপ ব্যর্থ' : 'Backup Failed',
        message: isBn ? 'ব্যাকআপ ডাউনলোড করতে ব্যর্থ হয়েছে।' : 'Failed to export backup file.'
      });
    }
  };

  const handlePrintInstitutionalReport = () => {
    window.print();
  };

  // Navigation sub-tabs list
  const subTabs = [
    {
      id: 'notices' as ReportsSettingsSubTab,
      labelBn: 'নোটিশ',
      labelEn: 'Notices',
      icon: Megaphone,
      badge: cloudHydrated && noticeStats.urgent > 0 ? `${noticeStats.urgent} Urgent` : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'admin_reports' as ReportsSettingsSubTab,
      labelBn: 'রিপোর্ট',
      labelEn: 'Reports',
      icon: BarChart3
    },
    {
      id: 'profile' as ReportsSettingsSubTab,
      labelBn: 'প্রোফাইল',
      labelEn: 'Profile',
      icon: Building2,
      badge: cloudHydrated ? `${profileCompleteness}%` : undefined,
      badgeColor: profileCompleteness === 100 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
    },
    {
      id: 'branding' as ReportsSettingsSubTab,
      labelBn: 'ব্র্যান্ডিং',
      labelEn: 'Branding',
      icon: Sliders
    },
    {
      id: 'backup' as ReportsSettingsSubTab,
      labelBn: 'ব্যাকআপ',
      labelEn: 'Backup',
      icon: Database
    },
    {
      id: 'audit' as ReportsSettingsSubTab,
      labelBn: 'অডিট',
      labelEn: 'Audit',
      icon: ShieldCheck
    },
    {
      id: 'diagnostics' as ReportsSettingsSubTab,
      labelBn: 'ডায়াগনস্টিকস',
      labelEn: 'Diagnostics',
      icon: Activity
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      
      {/* ========================================================================= */}
      {/* TOP HERO BANNER & INSTITUTIONAL CONTROL BAR                               */}
      {/* ========================================================================= */}
 <div className="bg-slate-900 rounded-3xl p-6 sm:p-7 text-white border border-indigo-900/60 relative overflow-hidden print:hidden">

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{schoolProfile.nameBn || schoolProfile.name || (isBn ? 'মাদ্রাসা ব্যবস্থাপনা সিস্টেম' : 'Madrasah Management')}</span>
              {schoolProfile.logoUrl && (
                <img 
                  src={schoolProfile.logoUrl} 
                  alt="Logo" 
 className="w-8 h-8 rounded-full object-cover border border-white/30"
                />
              )}
            </h1>

          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleQuickBackup}
 className="px-4 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
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
 className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
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
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {formatNumber(noticeStats.total, language)}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1.5">
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
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
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
            </div>
            <div className="text-2xl font-black text-white mt-1 flex items-center gap-1.5">
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
            </div>
            <div className="text-2xl font-black text-purple-300 mt-1 flex items-center gap-1">
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
 <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
 ? 'bg-indigo-600 text-white font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : (tab.badgeColor || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200')
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
        <ServerDataGate dataNameBn="নোটিশ তথ্য" dataNameEn="Notice data">
        <div className="space-y-6">
          <NoticeBoard onBack={() => setActiveTab('admin_reports')} />
        </div>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CONSOLIDATED INSTITUTIONAL REPORTS                            */}
      {/* ========================================================================= */}
      {activeTab === 'admin_reports' && (
        <ServerDataGate dataNameBn="রিপোর্ট তথ্য" dataNameEn="Report data">
        <div className="space-y-6">
          {/* Sub-view toggle */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isBn ? 'ভিউ নির্বাচন:' : 'View Mode:'}
              </span>
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1">
                <button
                  onClick={() => setReportSubView('executive')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportSubView === 'executive'
 ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {isBn ? '📊 সার্বিক এক্সিকিউটিভ ড্যাশবোর্ড' : '📊 Executive Dashboard'}
                </button>
                <button
                  onClick={() => setReportSubView('governance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportSubView === 'governance'
 ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
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
                // 'web_results' is the internal results tab (ExamResultsManager) —
                // 'public_web_results' is the public portal manager, not this.
                else if (tab === 'academic_reports') onNavigateTab ? onNavigateTab('academic_reports') : setActiveTab('admin_reports');
                else if (tab === 'attendance') onNavigateTab ? onNavigateTab('attendance') : setActiveTab('admin_reports');
                else if (tab === 'web_results') onNavigateTab ? onNavigateTab('web_results') : setActiveTab('admin_reports');
                else showToast({ type: 'error', message: isBn ? 'এই মডিউল খোলা যায়নি' : 'This module could not be opened' });
              }} 
            />
          ) : (
            <AdminReportView />
          )}
        </div>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: MADRASAH PROFILE SETTINGS                                      */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <ServerDataGate dataNameBn="মাদ্রাসা প্রোফাইল" dataNameEn="Madrasah profile">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          {/* Header & Success state */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={22} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'মাদ্রাসা প্রোফাইল ও প্রাতিষ্ঠানিক তথ্য' : 'Madrasah Profile & Institutional Details'}</span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {profileSyncing && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-800 animate-in fade-in">
                  <Clock size={15} />
                  <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
                </div>
              )}
              {profileSaveSuccess && (
                <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                  <CheckCircle2 size={15} />
                  <span>{isBn ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!'}</span>
                </div>
              )}
              <button
                type="submit"
 className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Check size={16} />
                <span>{isBn ? 'প্রোফাইল সেভ করুন' : 'Save Profile'}</span>
              </button>
            </div>
          </div>

          {/* 7 Nov 2026 Job 6: cloud confirm failed — amber banner with the
              real reason + Retry. Also lights when a queued profile payload
              survives a reload (the save already landed on this device). */}
          {(profileSaveError || profileUnconfirmed) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-2xl border border-amber-200 dark:border-amber-800 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <p className="flex-1">{profileSaveError || SCHOOL_PROFILE_CLOUD_FAILURE_MESSAGE}</p>
              <button type="button" onClick={retryProfileSave} disabled={isRetryingProfile} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
            </div>
          )}

          {/* Form Fields Card */}
 <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                {isBn ? 'মৌলিক পরিচিতি (General Identity)' : 'Basic Institutional Identity'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মাদ্রাসার নাম (বাংলায়) *' : 'Madrasah Name (Bangla) *'}
                </label>
                <input
                  type="text"
                  name="nameBn"
                  required
                  value={profileData.nameBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: জামিয়া ইসলামিয়া দারুল উলুম মাদ্রাসা"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla font-semibold bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'মাদ্রাসার নাম (ইংরেজিতে) *' : 'Madrasah Name (English) *'}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={profileData.name || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Jamia Islamia Darul Uloom Madrasah"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'ঠিকানা (বাংলায়)' : 'Address (Bangla)'}
                </label>
                <input
                  type="text"
                  name="addressBn"
                  value={profileData.addressBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: ডাকঘর- মদিনাতুল উলুম, থানা ও জেলা- ঢাকা"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'ঠিকানা (ইংরেজিতে)' : 'Address (English)'}
                </label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Madinatul Uloom, Dhaka, Bangladesh"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'অফিসিয়াল ফোন নম্বর' : 'Official Phone / Mobile'}
                </label>
                <input
                  type="text"
                  name="phone"
                  value={profileData.phone || ''}
                  onChange={handleProfileChange}
                  placeholder="01700-000000"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'প্রাতিষ্ঠানিক ইমেইল' : 'Institutional Email'}
                </label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email || ''}
                  onChange={handleProfileChange}
                  placeholder="info@madrasah.edu.bd"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'প্রতিষ্ঠার সন (Established Year)' : 'Established Year'}
                </label>
                <input
                  type="text"
                  name="established"
                  value={profileData.established || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: ১৯৪৮ খ্রি."
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'চলতি শিক্ষাবর্ষ (Academic Session)' : 'Academic Session'}
                </label>
                <input
                  type="text"
                  name="academicYear"
                  value={profileData.academicYear || ''}
                  onChange={handleProfileChange}
                  placeholder="2026"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'অধ্যক্ষ / সুপারিনটেনডেন্ট / প্রধান শিক্ষকের নাম (বাংলা)' : 'Principal / Superintendent Name (Bangla)'}
                </label>
                <input
                  type="text"
                  name="headMasterNameBn"
                  value={profileData.headMasterNameBn || ''}
                  onChange={handleProfileChange}
                  placeholder="যেমন: ড. মুহাম্মদ মাহমুদুল হাসান"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla font-semibold bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  {isBn ? 'অধ্যক্ষ / সুপারিনটেনডেন্ট / প্রধান শিক্ষকের নাম (English)' : 'Principal / Superintendent Name (English)'}
                </label>
                <input
                  type="text"
                  name="headMasterName"
                  value={profileData.headMasterName || ''}
                  onChange={handleProfileChange}
                  placeholder="e.g. Maulana Abul Hasan"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800/60 focus:bg-white"
                />
              </div>

            </div>

            {/* Official Letterhead Live Preview */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {isBn ? 'অফিসিয়াল প্যাড / হেডার লাইভ প্রিভিউ' : 'Official Letterhead Live Preview'}
              </h4>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1.5 relative overflow-hidden">
                {profileData.logoUrl && (
                  <img 
                    src={profileData.logoUrl} 
                    alt="Logo preview" 
                    className="w-16 h-16 mx-auto object-contain mb-2" 
                  />
                )}
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-bangla">
                  {profileData.nameBn || profileData.name || 'মাদ্রাসার নাম'}
                </h3>
                {profileData.name && (
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    {profileData.name}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bangla">
                  {profileData.addressBn || profileData.address || 'মাদ্রাসার ঠিকানা'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 font-medium pt-1">
                  {profileData.phone && <span>📞 {profileData.phone}</span>}
                  {profileData.email && <span>✉️ {profileData.email}</span>}
                  {profileData.established && <span>🏛️ {isBn ? 'স্থাপিত:' : 'Est:'} {profileData.established}</span>}
                </div>
              </div>
            </div>

          </div>

          {/* Font Settings (Phase 3) — UI font + print fonts, live previews.
              Saved with the profile via the same Save button above; values
              sync through main_store like every other profile field. */}
 <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Type size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'ফন্ট সেটিংস (Font)' : 'Font Settings'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 normal-case tracking-normal">
                {isBn
                  ? 'স্ক্রিনের ফন্ট এবং ছাপানো রেজাল্ট কার্ড/মার্কশিটের ফন্ট বেছে নিন। প্রতিটি ফন্টের লাইভ প্রিভিউতে বাংলা লেখা ও সব সংখ্যা দেখে নিন — বিশেষ করে ১ ও ২ স্পষ্ট পড়া যাচ্ছে কিনা।'
                  : 'Choose the on-screen font and the printed result-card/marksheet fonts. Each preview shows a Bangla sentence and every digit — check that ১ and ২ read clearly.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {([
                {
                  field: 'uiFont' as const,
                  fallback: 'Anek Bangla',
                  label: isBn ? 'স্ক্রিনের UI ফন্ট' : 'On-screen UI Font',
                  hint: isBn ? 'ড্যাশবোর্ড, মেনু, মোবাইল অ্যাপ — পুরো সিস্টেমের স্ক্রিনে' : 'Dashboard, menus and the mobile app — the whole on-screen system'
                },
                {
                  field: 'banglaFont' as const,
                  fallback: 'Anek Bangla',
                  label: isBn ? 'ছাপার বাংলা ফন্ট' : 'Print Bangla Font',
                  hint: isBn ? 'রেজাল্ট কার্ড ও মার্কশিটের বাংলা লেখায়' : 'Bangla text on printed result cards & marksheets'
                },
                {
                  field: 'banglaNumberFont' as const,
                  fallback: 'Anek Bangla',
                  label: isBn ? 'ছাপার সংখ্যার ফন্ট' : 'Print Number Font',
                  hint: isBn ? 'রেজাল্ট কার্ড ও মার্কশিটের নম্বর/সংখ্যায়' : 'Digits & marks on printed result cards & marksheets'
                }
              ]).map(({ field, fallback, label, hint }) => {
                const rawVal = profileData[field];
                const selected = (!rawVal || rawVal === 'Hind Siliguri' || rawVal.includes('Noto')) ? fallback : rawVal;
                return (
                  <div key={field} className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                        {label}
                      </label>
                      <select
                        name={field}
                        value={selected}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        {['Anek Bangla', 'Baloo Da 2', 'Tiro Bangla'].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>
                    </div>

                    {/* Live preview in the selected font */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <p
                        className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed"
                        style={{ fontFamily: `'${selected}', 'Anek Bangla', sans-serif` }}
                      >
                        আমার সোনার বাংলা, আমি তোমায় ভালোবাসি।
                      </p>
                      <p
                        className="text-slate-800 dark:text-slate-100"
                        style={{ fontFamily: `'${selected}', 'Anek Bangla', sans-serif` }}
                      >
                        <span className="text-[26px] leading-none font-bold align-middle">১ ২</span>
                        <span className="text-base font-semibold ml-3">০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯</span>
                      </p>
                      <p
                        className="text-xs text-slate-500 dark:text-slate-400"
                        style={{ fontFamily: `'${selected}', 'Anek Bangla', sans-serif` }}
                      >
                        মোট নম্বর ১২৫ • রোল ২১ • জিপিএ ৫.০০
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {isBn
                ? 'নোট: উপরের "প্রোফাইল সেভ করুন" বোতামে সেভ করলেই ফন্টগুলো সব ডিভাইসে কার্যকর হবে। চারটি ফন্টই আগে থেকে লোড করা থাকে, তাই বদলাতে দেরি হয় না।'
                : 'Note: press the "Save Profile" button above to apply — the fonts then take effect on every device. All four fonts are preloaded, so switching is instant.'}
            </p>
          </div>
        </form>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: BRANDING, SEAL & PRINT CUSTOMIZATION                           */}
      {/* ========================================================================= */}
      {activeTab === 'branding' && (
        <ServerDataGate dataNameBn="ব্র্যান্ডিং তথ্য" dataNameEn="Branding data">
        <form onSubmit={handleSaveProfile} className="space-y-6">
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={22} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'ব্র্যান্ডিং, অফিসিয়াল সিল ও প্রিন্ট কনফিগারেশন' : 'Official Branding, Stamps & Print Customization'}</span>
              </h2>
            </div>

            <button
              type="submit"
 className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Check size={16} />
              <span>{isBn ? 'পরিবর্তন সেভ করুন' : 'Save Changes'}</span>
            </button>
          </div>

          {/* 7 Nov 2026 Job 6: same save status as the profile tab — the
              branding form shares handleSaveProfile. */}
          {profileSyncing && (
            <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-2xl border border-sky-200 dark:border-sky-800 animate-in fade-in">
              <Clock size={16} className="shrink-0" />
              <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
            </div>
          )}
          {profileSaveSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-2xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{isBn ? 'সফলভাবে সংরক্ষিত!' : 'Saved successfully!'}</span>
            </div>
          )}
          {(profileSaveError || profileUnconfirmed) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-2xl border border-amber-200 dark:border-amber-800 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <p className="flex-1">{profileSaveError || SCHOOL_PROFILE_CLOUD_FAILURE_MESSAGE}</p>
              <button type="button" onClick={retryProfileSave} disabled={isRetryingProfile} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Logo Upload Box */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {isBn ? 'মাদ্রাসার প্রাতিষ্ঠানিক লোগো' : 'Madrasah Official Logo'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-800/60 relative group">
                {profileData.logoUrl ? (
                  <img src={profileData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                    <ImageIcon size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'লোগো নেই' : 'No Logo'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-xl cursor-pointer transition-all">
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
                    className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isBn ? 'পিএনজি অথবা জেপিজি (স্বচ্ছ ব্যাকগ্রাউন্ড সুবিধাজনক)' : 'PNG or JPG with transparent bg'}
              </p>
            </div>

            {/* Signature Upload Box */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {isBn ? 'অধ্যক্ষ / সুপারিনটেনডেন্টের অফিসিয়াল স্বাক্ষর' : 'Principal / Superintendent Signature'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-800/60 relative">
                {profileData.signatureUrl ? (
                  <img src={profileData.signatureUrl} alt="Signature" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                    <Edit2 size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'স্বাক্ষর নেই' : 'No Signature'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-xl cursor-pointer transition-all">
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
                    className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isBn ? 'মার্কশিট ও প্রশংসাপত্রে স্বয়ংক্রিয় বসবে' : 'Auto-placed on marksheet & certificates'}
              </p>
            </div>

            {/* Watermark Upload Box */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 space-y-4 text-center">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {isBn ? 'ডকুমেন্ট ওয়াটারমার্ক সিল' : 'Document Watermark'}
              </h3>
              
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-800/60 relative">
                {profileData.watermarkUrl ? (
                  <img src={profileData.watermarkUrl} alt="Watermark" className="w-full h-full object-contain opacity-50" />
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                    <Sparkles size={32} />
                    <span className="text-[10px] mt-1 font-bold">{isBn ? 'ওয়াটারমার্ক নেই' : 'No Watermark'}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <label className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-xl cursor-pointer transition-all">
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
                    className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                    title={isBn ? 'মুছে ফেলুন' : 'Remove'}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isBn ? 'মার্কশিটের মাঝখানে ব্যাকগ্রাউন্ডে প্রদর্শিত হবে' : 'Displayed in center of printed cards'}
              </p>
            </div>

          </div>

          {/* Template & Print Toggles */}
 <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
              {isBn ? 'প্রিন্ট ও ফলাফল কার্ড ডিসপ্লে সেটিংস' : 'Print & Result Card Display Preferences'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                  {isBn ? 'ডিফল্ট ফলাফল কার্ড টেমপ্লেট' : 'Default Result Card Template'}
                </label>
                <select
                  name="resultCardTemplate"
                  value={profileData.resultCardTemplate || 'Premium_Dakhil'}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-800 dark:text-slate-100"
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
                    className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded-sm border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'প্রিন্ট ও মার্কশিটে মাদ্রাসার লোগো প্রদর্শন করুন' : 'Show Logo on result cards and printouts'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showHeadmasterSignature"
                    checked={profileData.showHeadmasterSignature !== false}
                    onChange={handleProfileChange}
                    className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded-sm border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'অধ্যক্ষের স্বাক্ষর মার্কশিটে স্বয়ংক্রিয় প্রিন্ট করুন' : 'Show Principal Signature on result cards'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showWatermark"
                    checked={Boolean(profileData.showWatermark)}
                    onChange={handleProfileChange}
                    className="w-4 h-4 text-indigo-600 dark:text-indigo-400 rounded-sm border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isBn ? 'মার্কশিটের ব্যাকগ্রাউন্ডে ওয়াটারমার্ক প্রদর্শন করুন' : 'Enable background watermark on marksheet'}
                  </span>
                </label>
              </div>

            </div>
          </div>
        </form>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: DATA SECURITY & BACKUP CENTER                                 */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <ServerDataGate dataNameBn="ব্যাকআপ তথ্য" dataNameEn="Backup data">
        <div className="space-y-6">
          <DataSecurityBackupCenter isModal={false} />
        </div>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 6: SECURITY AUDIT TRAIL                                          */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <ServerDataGate dataNameBn="অডিট তথ্য" dataNameEn="Audit data">
        <div className="space-y-6">
          <SuperAdminAuditPage />
        </div>
        </ServerDataGate>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 7: SYSTEM DIAGNOSTICS & DATA INTEGRITY                          */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <ServerDataGate dataNameBn="ডায়াগনস্টিকস তথ্য" dataNameEn="Diagnostics data">
        <div className="space-y-6">
          
 <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Activity size={22} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'সিস্টেম ডাটাবেজ স্থিতি ও ডায়াগনস্টিকস' : 'System Database Status & Diagnostics'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isBn 
                  ? `${formatNumber(diagnosticTileCollections.length, language)}টি মূল কালেকশনের রেকর্ড সংখ্যা।`
                  : `Record counts across all ${diagnosticTileCollections.length} core collections.`}
              </p>
            </div>

            <button
              onClick={() => {
                calculateStorage();
                showToast({
                  type: 'success',
                  message: isBn ? 'ডায়াগনস্টিক তথ্য রিফ্রেশ করা হয়েছে।' : 'Diagnostics refreshed.'
                });
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
            >
              <RefreshCw size={14} />
              <span>{isBn ? 'রিফ্রেশ করুন' : 'Refresh Diagnostics'}</span>
            </button>
          </div>

          {/* Record Count Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শিক্ষার্থী' : 'Students'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(students.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শিক্ষক ও স্টাফ' : 'Teachers'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(teachers.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'শ্রেণি / জামাত' : 'Classes'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(classes.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পাঠ্য বিষয়' : 'Subjects'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(subjects.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পরীক্ষা ও টার্ম' : 'Exams'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(exams.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'পরীক্ষার নম্বর রেকর্ড' : 'Marks Records'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(marks.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'আর্থিক লেনদেন' : 'Transactions'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(transactions.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'ট্র্যাশ বিন' : 'Trash Bin'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(trashBin.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'নোটিশ' : 'Notices'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(notices.length, language)}
              </div>
            </div>

 <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase">{isBn ? 'লগইন অ্যাকাউন্ট' : 'Users'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {formatNumber(users.length, language)}
              </div>
            </div>

          </div>

          {/* Storage & Cloud Sync Card */}
 <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <HardDrive size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>{isBn ? 'ব্রাউজার লোকাল স্টোরেজ কোটা ও মেমরি' : 'Browser Storage Quota & Health'}</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span>{isBn ? 'ব্যবহৃত মেমরি:' : 'Used Storage:'} {storageStats.usedFormatted}</span>
                <span>{storageStats.quotaPercent}% {isBn ? 'ব্যবহৃত (সর্বোচ্চ ৫ মেগাবাইট)' : 'of ~5MB quota'}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
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

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Server size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {isBn ? 'ক্লাউড ফায়ারস্টোর রিয়েল-টাইম সিঙ্ক' : 'Cloud Firestore Realtime Sync'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
        </ServerDataGate>
      )}

    </div>
  );
};
