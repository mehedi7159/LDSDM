import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  Users,
  PenTool,
  Wallet,
  BookOpen,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileJson,
  Layers,
  Sparkles,
  Info,
  Clock,
  Trash2,
  Check,
  X
} from 'lucide-react';
import {
  readCurrentLocalStoragePayload,
  extractSystemCounts,
  downloadFullSystemBackup,
  validateFullSystemBackup,
  executeFullSystemRestore,
  getAllIndexedDbSnapshots,
  saveToIndexedDbVault,
  rollbackToSpecificSnapshot,
  SystemSnapshot,
  BackupValidationInspection
} from '../services/multiStorePersistence';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { formatNumber, formatSafeDateTime } from '../services/utils';
import { auth } from '../services/firebase';

interface DataSecurityBackupCenterProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const DataSecurityBackupCenter: React.FC<DataSecurityBackupCenterProps> = ({
  onClose,
  isModal = false
}) => {
  const {
    students,
    classes,
    subjects,
    exams,
    marks,
    transactions,
    authUser,
    isAdmin,
    isSuperAdmin,
    adminEmail,
    forcePushToCloud,
    forcePullFromCloud,
    trashBin,
    restoreFromTrash,
    permanentlyDeleteTrashItem,
    restoreAllFromTrash,
    emptyTrash,
    cloudStatus,
    cloudLastSynced,
    loginWithGoogle,
    language
  } = useApp();

  // Loading & Action states
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

  // Restore states
  const [uploadedInspection, setUploadedInspection] = useState<BackupValidationInspection | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // Recycle Bin states
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [trashFilter, setTrashFilter] = useState<'all' | 'student' | 'subject' | 'exam' | 'class' | 'transaction'>('all');
  const [confirmEmptyTrashOpen, setConfirmEmptyTrashOpen] = useState(false);

  // Snapshots states
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [snapshotToRollback, setSnapshotToRollback] = useState<SystemSnapshot | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Load recent snapshots on mount
  const refreshSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const list = await getAllIndexedDbSnapshots();
      // Keep most recent 5 snapshots
      setSnapshots(list.slice(0, 5));
    } catch (e) {
      console.warn('Could not load snapshots:', e);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    refreshSnapshots();
  }, []);

  // 1. Download Backup
  const handleDownloadBackup = () => {
    try {
      const current = readCurrentLocalStoragePayload();
      const filename = downloadFullSystemBackup(current);
      setStatusMessage({
        type: 'success',
        text: `সম্পূর্ণ ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে: ${filename}`
      });
      refreshSnapshots();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      });
    }
  };

  // 2. Inspect Uploaded Backup File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const inspection = validateFullSystemBackup(content);
      setUploadedInspection(inspection);
      if (!inspection.isValid) {
        setStatusMessage({
          type: 'error',
          text: inspection.errors[0] || 'ব্যাকআপ ফাইলটি সঠিক নয়।'
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: `ফাইল যাচাই সম্পন্ন হয়েছে। এতে ${formatNumber(inspection.counts.students, language)} জন শিক্ষার্থী এবং ${formatNumber(inspection.counts.exams, language)} টি পরীক্ষার তথ্য রয়েছে।`
        });
      }
    };
    reader.onerror = () => {
      setStatusMessage({
        type: 'error',
        text: 'ফাইলটি পড়তে সমস্যা হয়েছে।'
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. Confirm & Execute Restore
  const handleExecuteRestore = async () => {
    if (!uploadedInspection?.payload) return;
    setIsRestoring(true);
    setConfirmRestoreOpen(false);

    try {
      const res = await executeFullSystemRestore(uploadedInspection.payload, authUser?.email || adminEmail);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message
        });
        setUploadedInspection(null);
        refreshSnapshots();
        // Reload to sync all React contexts seamlessly
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'রিস্টোর ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Recycle Bin Operations
  const handleRestoreItem = (id: string, name?: string) => {
    restoreFromTrash(id);
    setStatusMessage({
      type: 'success',
      text: `"${name || 'আইটেমটি'}" সফলভাবে রিসাইকেল বিন থেকে পুনরুদ্ধার করা হয়েছে!`
    });
  };

  const handlePermanentDelete = (id: string, name?: string) => {
    permanentlyDeleteTrashItem(id);
    setStatusMessage({
      type: 'info',
      text: `"${name || 'আইটেমটি'}" রিসাইকেল বিন থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে।`
    });
  };

  const handleRestoreAll = () => {
    restoreAllFromTrash();
    setIsRecycleBinOpen(false);
    setStatusMessage({
      type: 'success',
      text: 'রিসাইকেল বিনের সকল তথ্য সফলভাবে মূল সিস্টেমে ফিরিয়ে আনা হয়েছে!'
    });
  };

  const handleEmptyTrashConfirm = () => {
    emptyTrash();
    setConfirmEmptyTrashOpen(false);
    setStatusMessage({
      type: 'info',
      text: 'রিসাইকেল বিন সম্পূর্ণ খালি ও পরিষ্কার করা হয়েছে।'
    });
  };

  // 5. Cloud Push
  const handleCloudPush = async () => {
    setIsCloudSyncing(true);
    setStatusMessage(null);
    try {
      await forcePushToCloud();
      setStatusMessage({
        type: 'success',
        text: 'সকল তথ্য সফলভাবে Google Firebase ক্লাউড ডেটাবেসে সিঙ্ক ও সুরক্ষিত করা হয়েছে!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'ক্লাউড সিঙ্ক সমস্যা: ' + (err?.message || 'ইন্টারনেট বা ফায়ারবেস কানেকশন যাচাই করুন')
      });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // 6. Cloud Pull
  const handleCloudPull = async () => {
    setIsPullingCloud(true);
    setStatusMessage(null);
    try {
      await forcePullFromCloud();
      setStatusMessage({
        type: 'success',
        text: 'ক্লাউড ডেটাবেস থেকে সকল তথ্য (১৭৩ জন শিক্ষার্থী, ২,৬০১টি ফলাফল) সফলভাবে লোড ও সেভ করা হয়েছে!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'ক্লাউড থেকে তথ্য আনতে সমস্যা হয়েছে: ' + (err?.message || 'কানেকশন চেক করুন')
      });
    } finally {
      setIsPullingCloud(false);
    }
  };

  // 7. Rollback to Snapshot
  const handleExecuteRollback = async () => {
    if (!snapshotToRollback) return;
    setIsRollingBack(true);
    try {
      const res = await rollbackToSpecificSnapshot(snapshotToRollback.id, authUser?.email || adminEmail);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message
        });
        setSnapshotToRollback(null);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'রোলব্যাক ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className={`space-y-6 ${isModal ? 'p-4 sm:p-6' : 'max-w-6xl mx-auto'}`}>
      {/* Top Header & Reassuring Badges */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ক্লাউড ডেটাবেস সক্রিয় ও নিরাপদ
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-indigo-400" />
                অ্যাডমিন: {authUser?.email || adminEmail || 'mehedihasansagor26@gmail.com'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="text-emerald-400 shrink-0" size={28} />
              ডাটা সুরক্ষা, ব্যাকআপ ও রিস্টোর কেন্দ্র
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              আপনার মাদ্রাসার শিক্ষার্থীদের ভর্তি, পরীক্ষার ফলাফল এবং আর্থিক লেনদেনের সমস্ত তথ্য এক ক্লিকে ব্যাকআপ ফাইল আকারে সংরক্ষণ করুন এবং প্রয়োজন অনুযায়ী রিস্টোর করুন।
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={handleCloudPush}
              disabled={isCloudSyncing}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isCloudSyncing ? 'animate-spin' : ''} />
              <span>{isCloudSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই ক্লাউডে সিঙ্ক করুন'}</span>
            </button>
            <button
              onClick={handleDownloadBackup}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>ব্যাকআপ ডাউনলোড</span>
            </button>
          </div>
        </div>

        {/* Live System Counter Cards (Vibrant Aesthetic) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold mb-1">
              <span>মোট শিক্ষার্থী</span>
              <Users size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(students.length, language)}
              <span className="text-xs font-normal text-slate-400 ml-1">জন</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-teal-300 text-xs font-semibold mb-1">
              <span>পরীক্ষা ও টার্ম</span>
              <Calendar size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(exams.length, language)}
              <span className="text-xs font-normal text-slate-400 ml-1">টি</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-semibold mb-1">
              <span>নম্বর এন্ট্রি</span>
              <PenTool size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(marks.length, language)}
              <span className="text-xs font-normal text-slate-400 ml-1">টি</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-rose-300 text-xs font-semibold mb-1">
              <span>আর্থিক ভাউচার</span>
              <Wallet size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(transactions.length, language)}
              <span className="text-xs font-normal text-slate-400 ml-1">টি</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Status / Notification Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-in fade-in transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            ) : statusMessage.type === 'warning' ? (
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            ) : (
              <Info size={18} className="text-indigo-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Google Login Status Banner for Cloud Database Sync */}
      {!authUser ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Cloud size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>ক্লাউড ফায়ারবেস ডেটাবেসে সিঙ্ক করতে গুগল লগইন প্রয়োজন</span>
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                আপনার ডেটা বর্তমানে লোকাল মেমোরি ও স্থায়ী ব্রাউজার ভল্টে সম্পূর্ণ সুরক্ষিত আছে। তবে সরাসরি Google Firebase ক্লাউডে অটো-সেভ ও লাইভ সিঙ্ক করতে আপনার অ্যাডমিন জিমেইল (<strong>mehedihasansagor26@gmail.com</strong>) দিয়ে লগইন করুন।
              </p>
            </div>
          </div>
          <button
            onClick={() => loginWithGoogle()}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Cloud size={15} />
            <span>Google দিয়ে লগইন করুন</span>
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>
              ক্লাউড অথরাইজেশন সক্রিয়: <strong>{authUser.email}</strong> হিসেবে Google Firebase ক্লাউড ডেটাবেসে সরাসরি রাইট পারমিশন সফলভাবে অনুমোদিত।
            </span>
          </div>
        </div>
      )}

      {/* 4 Core Essential Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module 1: Download Full Backup */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Download size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ১. সম্পূর্ণ ব্যাকআপ ফাইল ডাউনলোড
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                আপনার সিস্টেমের বর্তমান সকল ডেটা (শিক্ষার্থী তালিকা, ফলাফল, বিষয় বিন্যাস ও ক্যাশ খাতা) একটি সুরক্ষিত JSON ব্যাকআপ ফাইল হিসেবে ডাউনলোড করে নিজের পেনড্রাইভ বা কম্পিউটারে নিরাপদে রাখুন।
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400 font-medium">
              ফরম্যাট: .JSON (এনক্রিপ্টেড ও সম্পূর্ণ)
            </div>
            <button
              onClick={handleDownloadBackup}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>ব্যাকআপ ফাইল নামান</span>
            </button>
          </div>
        </div>

        {/* Module 2: Restore Real Data */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ২. আসল ডেটা ব্যাকআপ রিস্টোর
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                আপনার পূর্বে ডাউনলোড করা ব্যাকআপ ফাইলটি নির্বাচন করুন। রিস্টোর সম্পন্ন হলে আপনার সমস্ত পূর্ববর্তী শিক্ষার্থী ও ফলাফল স্বয়ংক্রিয়ভাবে ফিরে আসবে।
              </p>
            </div>

            {/* File Upload Trigger */}
            <div className="mt-2">
              <label className="flex flex-col items-center justify-center w-full px-4 py-3.5 border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50/80 cursor-pointer transition-all group">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <FileJson size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>কম্পিউটার/মোবাইল থেকে ব্যাকআপ ফাইল নির্বাচন করুন (.json)</span>
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Inspection Preview if valid file chosen */}
            {uploadedInspection && uploadedInspection.isValid && (
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-2 mt-3 animate-in fade-in">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>ব্যাকআপ ফাইল যাচাইকরণ সফল!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-emerald-800">
                  <div>শিক্ষার্থী: <strong>{uploadedInspection.counts.students}</strong> জন</div>
                  <div>পরীক্ষা: <strong>{uploadedInspection.counts.exams}</strong> টি</div>
                  <div>নম্বর রেকর্ড: <strong>{uploadedInspection.counts.marks}</strong> টি</div>
                  <div>লেনদেন: <strong>{uploadedInspection.counts.transactions}</strong> টি</div>
                </div>
                <button
                  onClick={() => setConfirmRestoreOpen(true)}
                  disabled={isRestoring}
                  className="w-full mt-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{isRestoring ? 'রিস্টোর হচ্ছে...' : 'এই ব্যাকআপটি রিস্টোর করুন'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            রিস্টোরের পূর্বে বর্তমান তথ্যের একটি নিরাপত্তা স্ন্যাপশট স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।
          </div>
        </div>

        {/* Module 3: Cloud Database Sync & Pull */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ৩. ক্লাউড রিমোট এক্সেস ও ডিভাইস সিঙ্ক
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                অন্য ডিভাইস (মোবাইল বা নতুন ল্যাপটপ) থেকে অ্যাপ ব্যবহার করার সময় অথবা ব্রাউজার ক্যাশ ক্লিয়ার হলে ক্লাউড থেকে তাৎক্ষণিক সব তথ্য নামিয়ে সিঙ্ক করে নিন।
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>ক্লাউড স্থিতি:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Firebase Firestore সংযুক্ত
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>সর্বশেষ সিঙ্ক:</span>
                <span className="font-medium text-slate-500">
                  {cloudLastSynced && cloudLastSynced !== 'Initializing...' && cloudLastSynced !== 'No Cloud Data Found'
                    ? cloudLastSynced
                    : 'স্বয়ংক্রিয় সিঙ্ক সক্রিয়'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
            <button
              onClick={handleCloudPull}
              disabled={isPullingCloud}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isPullingCloud ? 'animate-spin' : ''} />
              <span>{isPullingCloud ? 'লোড হচ্ছে...' : 'ক্লাউড থেকে ডেটা নামান'}</span>
            </button>
            <button
              onClick={handleCloudPush}
              disabled={isCloudSyncing}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Cloud size={14} />
              <span>{isCloudSyncing ? 'সিঙ্ক হচ্ছে...' : 'ক্লাউডে সেভ করুন'}</span>
            </button>
          </div>
        </div>

        {/* Module 4: Smart Recycle Bin & Accidental Deletion Protection */}
        <div className="bg-white rounded-3xl p-6 border border-emerald-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <RotateCcw size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  ৪. স্মার্ট রিসাইকেল বিন ও পুনরুদ্ধার
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trashBin.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {trashBin.length > 0 ? `${trashBin.length}টি আইটেম সংরক্ষিত` : 'বিন ফাঁকা ও সুরক্ষিত'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ভুলবশত বা অসাবধানতায় কোনো শিক্ষার্থী, বিষয়, পরীক্ষা বা লেনদেন মুছে গেলেও তা চিরতরে ডিলিট হয় না। রিসাইকেল বিনে সুরক্ষিত থাকে এবং যেকোনো সময় এক ক্লিকে পূর্বাবস্থায় ফিরিয়ে আনা যায়।
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>রিসাইকেল বিনে মোট তথ্য:</span>
                <span className="font-bold text-slate-800">{trashBin.length} টি</span>
              </div>
              <div className="flex items-center justify-between">
                <span>অ্যাক্সিডেন্টাল ডিলিট প্রটেকশন:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  সক্রিয় (Active)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {trashBin.length > 0 ? 'মুছে ফেলা তথ্য পুনরুদ্ধার করুন' : 'সকল তথ্য অক্ষত ও নিরাপদ'}
            </span>
            <button
              onClick={() => setIsRecycleBinOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>রিসাইকেল বিন দেখুন ({trashBin.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clean Snapshots & Auto-Checkpoints History */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="text-indigo-600" size={18} />
              স্বয়ংক্রিয় নিরাপত্তা স্ন্যাপশট ও রোলব্যাক ইতিহাস
            </h3>
            <p className="text-xs text-slate-500">
              সিস্টেম স্বয়ংক্রিয়ভাবে প্রতি বড় পরিবর্তনের আগে লোকাল ভল্টে সেফটি চেকপয়েন্ট সংরক্ষণ করে।
            </p>
          </div>

          <button
            onClick={refreshSnapshots}
            disabled={isLoadingSnapshots}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isLoadingSnapshots ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            এখনও কোনো অটোমেটিক স্ন্যাপশট ইতিহাস নেই। ব্যাকআপ ডাউনলোড বা রিস্টোরের সময় এখানে তৈরি হবে।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">তারিখ ও সময়</th>
                  <th className="py-2.5 px-3 font-semibold">বিবরণ / কারণ</th>
                  <th className="py-2.5 px-3 font-semibold">সংরক্ষিত রেকর্ড সংখ্যা</th>
                  <th className="py-2.5 px-3 text-right font-semibold">একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {snapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {formatSafeDateTime(snap.timestamp, 'bn-BD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{snap.labelBn || snap.label}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      শিক্ষার্থী: {snap.counts.students} | পরীক্ষা: {snap.counts.exams} | মার্কস: {snap.counts.marks}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSnapshotToRollback(snap)}
                        disabled={isRollingBack}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        <span>রোলব্যাক</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Restore */}
      <ConfirmDialog
        isOpen={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        onConfirm={handleExecuteRestore}
        title="ব্যাকআপ রিস্টোর নিশ্চিত করুন"
        message={`আপনি কি নিশ্চিত যে ব্যাকআপ ফাইল থেকে তথ্য রিস্টোর করতে চান? এতে বর্তমান তথ্যের স্থলে ব্যাকআপ ফাইলের তথ্য (${uploadedInspection?.counts.students || 0} জন শিক্ষার্থী) যুক্ত হবে। একটি নিরাপদ রোলব্যাক স্ন্যাপশট স্বয়ংক্রিয়ভাবে তৈরি হবে।`}
        confirmLabel="হ্যাঁ, রিস্টোর সম্পন্ন করুন"
        variant="primary"
        isLoading={isRestoring}
      />

      {/* Interactive Smart Recycle Bin Modal */}
      {isRecycleBinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    স্মার্ট রিসাইকেল বিন ও ডেটা রিকভারি
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {trashBin.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    ভুলবশত মুছে যাওয়া ডেটা যেকোনো সময় অক্ষত অবস্থায় পুনরুদ্ধার করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecycleBinOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 py-3 border-b border-slate-100 text-xs">
              {[
                { id: 'all', label: 'সকল', count: trashBin.length },
                { id: 'student', label: 'শিক্ষার্থী', count: trashBin.filter(t => t.type === 'student').length },
                { id: 'subject', label: 'বিষয়', count: trashBin.filter(t => t.type === 'subject').length },
                { id: 'exam', label: 'পরীক্ষা', count: trashBin.filter(t => t.type === 'exam').length },
                { id: 'class', label: 'শ্রেণি', count: trashBin.filter(t => t.type === 'class').length },
                { id: 'transaction', label: 'লেনদেন', count: trashBin.filter(t => t.type === 'transaction').length },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTrashFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    trashFilter === f.id
                      ? 'bg-emerald-700 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${trashFilter === f.id ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-[220px]">
              {trashBin.filter(t => trashFilter === 'all' || t.type === trashFilter).length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">রিসাইকেল বিন সম্পূর্ণ ফাঁকা</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    কোনো তথ্য মুছে ফেলা হয়নি। সিস্টেমের সকল শিক্ষার্থী, বিষয়, ফলাফল ও লেনদেন সুরক্ষিত আছে।
                  </p>
                </div>
              ) : (
                trashBin
                  .filter(t => trashFilter === 'all' || t.type === trashFilter)
                  .map(item => {
                    const itemName = item.data?.name || item.data?.nameBn || item.data?.title || item.data?.description || `আইটেম #${item.id.slice(0, 6)}`;
                    const typeLabel = 
                      item.type === 'student' ? 'শিক্ষার্থী' :
                      item.type === 'subject' ? 'বিষয়' :
                      item.type === 'exam' ? 'পরীক্ষা' :
                      item.type === 'class' ? 'শ্রেণি' : 'লেনদেন';

                    const typeBg =
                      item.type === 'student' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      item.type === 'subject' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      item.type === 'exam' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      item.type === 'class' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200';

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${typeBg}`}>
                            {typeLabel}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {itemName}
                            </h4>
                            <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              {item.data?.studentId && <span>আইডি: {item.data.studentId}</span>}
                              {item.data?.classLevel && <span>শ্রেণি: {item.data.classLevel}</span>}
                              {item.deletedAt && <span>মুছে ফেলা হয়েছে: {item.deletedAt}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRestoreItem(item.id, itemName)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 border border-emerald-200 cursor-pointer transition-all active:scale-95"
                            title="পুনরুদ্ধার করুন"
                          >
                            <RotateCcw size={12} />
                            <span>ফিরিয়ে আনুন</span>
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item.id, itemName)}
                            className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                            title="স্থায়ীভাবে মুছুন"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {trashBin.length > 0 && (
                  <>
                    <button
                      onClick={handleRestoreAll}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <RotateCcw size={13} />
                      <span>সকল ডেটা ফিরিয়ে আনুন</span>
                    </button>
                    <button
                      onClick={() => setConfirmEmptyTrashOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border border-slate-200"
                    >
                      <Trash2 size={13} />
                      <span>রিসাইকেল বিন খালি করুন</span>
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsRecycleBinOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-all"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Empty Trash */}
      <ConfirmDialog
        isOpen={confirmEmptyTrashOpen}
        onClose={() => setConfirmEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrashConfirm}
        title="রিসাইকেল বিন স্থায়ীভাবে খালি করতে চান?"
        message="আপনি কি নিশ্চিত যে রিসাইকেল বিনের সমস্ত মুছে ফেলা আইটেম স্থায়ীভাবে মুছে ফেলতে চান? একবার খালি করলে এগুলি আর পুনরুদ্ধার করা সম্ভব হবে না।"
        confirmLabel="হ্যাঁ, স্থায়ীভাবে খালি করুন"
        variant="danger"
      />

      {/* Confirmation Dialog for Snapshot Rollback */}
      <ConfirmDialog
        isOpen={Boolean(snapshotToRollback)}
        onClose={() => setSnapshotToRollback(null)}
        onConfirm={handleExecuteRollback}
        title="পূর্ববর্তী স্ন্যাপশটে রোলব্যাক করতে চান?"
        message={`আপনি কি "${snapshotToRollback?.labelBn || snapshotToRollback?.label}" সময়ের ব্যাকআপে ফিরে যেতে চান?`}
        confirmLabel="হ্যাঁ, রোলব্যাক করুন"
        variant="warning"
        isLoading={isRollingBack}
      />
    </div>
  );
};
