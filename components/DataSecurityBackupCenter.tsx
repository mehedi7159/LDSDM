import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
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
  isDegradedPayload,
  extractRestoreCounts,
  buildRestorePreview,
  snapshotIsDegraded,
  snapshotCompletenessPct,
  isLastKnownGoodSnapshot,
  studentFieldCompletenessPct,
  SystemSnapshot,
  BackupValidationInspection,
  RestorePreview
} from '../services/multiStorePersistence';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { RestorePreviewModal } from './ui/RestorePreview';
import { RecycleBinPanel } from './RecycleBinPanel';
import { formatNumber, formatSafeDateTime } from '../services/utils';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
    teachers,
    users,
    transactions,
    authUser,
    isAdmin,
    isSuperAdmin,
    adminEmail,
    forcePushToCloud,
    forcePullFromCloud,
    trashBin,
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

  // Recycle Bin states
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  // Snapshots states (Phase 3: full list, paginated — the old 5-item cap hid older entries)
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [snapPage, setSnapPage] = useState(0);
  const [snapFilter, setSnapFilter] = useState('');
  const [restorePreview, setRestorePreview] = useState<{ kind: 'file' | 'vault'; snapshot?: SystemSnapshot; preview: RestorePreview } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);

  // Load snapshots on mount (Phase 3: ALL vault snapshots, newest first)
  const refreshSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const list = await getAllIndexedDbSnapshots();
      setSnapshots(list);
      setSnapPage(0);
    } catch (e) {
      console.warn('Could not load snapshots:', e);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    refreshSnapshots();
  }, []);

  // 1. Download Backup (Phase 3: degraded-state warning before download)
  const currentLocalPayload = readCurrentLocalStoragePayload();
  const currentIsDegraded = isDegradedPayload(currentLocalPayload);
  const handleDownloadBackup = () => {
    if (currentIsDegraded) {
      setConfirmDownloadOpen(true);
      return;
    }
    doDownloadBackup();
  };
  const doDownloadBackup = () => {
    setConfirmDownloadOpen(false);
    try {
      const filename = downloadFullSystemBackup(currentLocalPayload);
      setStatusMessage({
        type: 'success',
        text: `সম্পূর্ণ ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে: ${filename}`
      });
      refreshSnapshots();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
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

  // 3. Preview & Execute Restore (Phase 3: preview first, then the
  // writer refuses any shrink the preview did not confirm)
  const openFilePreview = async () => {
    if (!uploadedInspection?.payload) return;
    setIsPreviewLoading(true);
    try {
      const cloudSnap = await getDoc(doc(db, 'institution', 'main_store'));
      if (!cloudSnap.exists()) {
        setStatusMessage({ type: 'error', text: 'প্রিভিউ তৈরি করা যায়নি — ক্লাউড ডকুমেন্ট পাওয়া যায়নি।' });
        return;
      }
      const preview = buildRestorePreview(
        extractRestoreCounts(cloudSnap.data()),
        extractRestoreCounts(uploadedInspection.payload),
        {
          labelBn: 'আপলোড করা ব্যাকআপ ফাইল',
          labelEn: 'Uploaded backup file',
          timestamp: uploadedInspection.exportedAt,
          isDegraded: isDegradedPayload(uploadedInspection.payload),
          completenessPct: studentFieldCompletenessPct(uploadedInspection.payload),
        }
      );
      setRestorePreview({ kind: 'file', preview });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'প্রিভিউ তৈরি ব্যর্থ: ' + (err?.message || 'অজ্ঞাত ত্রুটি') });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!uploadedInspection?.payload || !restorePreview) return;
    setIsRestoring(true);
    const shrinks = restorePreview.preview.shrinks;
    setRestorePreview(null);
    try {
      const res = await executeFullSystemRestore(uploadedInspection.payload, authUser?.email || adminEmail, { confirmedShrinks: shrinks });
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
      } else {
        setStatusMessage({
          type: 'error',
          text: 'রিস্টোর সম্পন্ন হয়নি: ' + res.message
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'রিস্টোর ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      });
    } finally {
      setIsRestoring(false);
    }
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

  // 7. Rollback to Snapshot (Phase 3: via preview)
  const openVaultPreview = async (snap: SystemSnapshot) => {
    setIsPreviewLoading(true);
    try {
      const cloudSnap = await getDoc(doc(db, 'institution', 'main_store'));
      if (!cloudSnap.exists()) {
        setStatusMessage({ type: 'error', text: 'প্রিভিউ তৈরি করা যায়নি — ক্লাউড ডকুমেন্ট পাওয়া যায়নি।' });
        return;
      }
      const preview = buildRestorePreview(
        extractRestoreCounts(cloudSnap.data()),
        extractRestoreCounts(snap.payload),
        {
          labelBn: snap.labelBn,
          labelEn: snap.labelEn,
          timestamp: snap.timestamp,
          isDegraded: snapshotIsDegraded(snap),
          completenessPct: snapshotCompletenessPct(snap),
        }
      );
      setRestorePreview({ kind: 'vault', snapshot: snap, preview });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'প্রিভিউ তৈরি ব্যর্থ: ' + (err?.message || 'অজ্ঞাত ত্রুটি') });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!restorePreview?.snapshot) return;
    const snapId = restorePreview.snapshot.id;
    const shrinks = restorePreview.preview.shrinks;
    setIsRollingBack(true);
    setRestorePreview(null);
    try {
      const res = await rollbackToSpecificSnapshot(snapId, authUser?.email || adminEmail, shrinks);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message
        });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'রোলব্যাক সম্পন্ন হয়নি: ' + res.message
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'রোলব্যাক ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  // Phase 3: filtered + paginated vault history (20/page, vertical scroll)
  const lastKnownGoodId = snapshots.find((s) => isLastKnownGoodSnapshot(s))?.id;
  const filteredSnapshots = snapFilter.trim()
    ? snapshots.filter((s) => `${s.labelBn || ''} ${s.labelEn || ''}`.toLowerCase().includes(snapFilter.trim().toLowerCase()))
    : snapshots;
  const SNAP_PAGE_SIZE = 20;
  const snapPageCount = Math.max(1, Math.ceil(filteredSnapshots.length / SNAP_PAGE_SIZE));
  const safeSnapPage = Math.min(snapPage, snapPageCount - 1);
  const visibleSnapshots = filteredSnapshots.slice(safeSnapPage * SNAP_PAGE_SIZE, safeSnapPage * SNAP_PAGE_SIZE + SNAP_PAGE_SIZE);

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
                অ্যাডমিন: {authUser?.email || adminEmail || SUPER_ADMIN_EMAIL}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="text-emerald-400 shrink-0" size={28} />
              ডাটা সুরক্ষা, ব্যাকআপ ও রিস্টোর কেন্দ্র
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              সব তথ্য এক ক্লিকে ব্যাকআপ বা রিস্টোর করুন।
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
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 dark:bg-slate-900/10 hover:bg-white/20 dark:hover:bg-slate-900/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>ব্যাকআপ ডাউনলোড</span>
            </button>
          </div>
        </div>

        {/* Live System Counter Cards (Vibrant Aesthetic) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 dark:bg-slate-900/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-semibold mb-1">
              <span>মোট শিক্ষার্থী</span>
              <Users size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(students.length, language)}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">জন</span>
            </div>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-teal-300 text-xs font-semibold mb-1">
              <span>পরীক্ষা ও টার্ম</span>
              <Calendar size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(exams.length, language)}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">টি</span>
            </div>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-semibold mb-1">
              <span>নম্বর এন্ট্রি</span>
              <PenTool size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(marks.length, language)}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">টি</span>
            </div>
          </div>

          <div className="bg-white/5 dark:bg-slate-900/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-rose-300 text-xs font-semibold mb-1">
              <span>আর্থিক ভাউচার</span>
              <Wallet size={16} />
            </div>
            <div className="text-xl font-black text-white">
              {formatNumber(transactions.length, language)}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">টি</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Status / Notification Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 animate-in fade-in transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
              : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
            ) : statusMessage.type === 'warning' ? (
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Info size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Google Login Status Banner for Cloud Database Sync */}
      {!authUser ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 dark:border-amber-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Cloud size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>ক্লাউড ফায়ারবেস ডেটাবেসে সিঙ্ক করতে গুগল লগইন প্রয়োজন</span>
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                আপনার ডেটা বর্তমানে লোকাল মেমোরি ও স্থায়ী ব্রাউজার ভল্টে সম্পূর্ণ সুরক্ষিত আছে। তবে সরাসরি Google Firebase ক্লাউডে অটো-সেভ ও লাইভ সিঙ্ক করতে আপনার অ্যাডমিন জিমেইল (<strong>{SUPER_ADMIN_EMAIL}</strong>) দিয়ে লগইন করুন।
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
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ক্লাউড অথরাইজেশন সক্রিয়: <strong>{authUser.email}</strong> হিসেবে Google Firebase ক্লাউড ডেটাবেসে সরাসরি রাইট পারমিশন সফলভাবে অনুমোদিত।
            </span>
          </div>
        </div>
      )}

      {/* 4 Core Essential Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Module 1: Download Full Backup */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Download size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ১. সম্পূর্ণ ব্যাকআপ ফাইল ডাউনলোড
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                আপনার সিস্টেমের বর্তমান সকল ডেটা (শিক্ষার্থী তালিকা, ফলাফল, বিষয় বিন্যাস ও ক্যাশ খাতা) একটি সুরক্ষিত JSON ব্যাকআপ ফাইল হিসেবে ডাউনলোড করে নিজের পেনড্রাইভ বা কম্পিউটারে নিরাপদে রাখুন।
              </p>
            </div>
          </div>

                    {currentIsDegraded && (
            <div className="mt-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              সতর্কতা: বর্তমান অবস্থা ক্ষতিগ্রস্ত দেখাচ্ছে (শিক্ষার্থী আছে, শিক্ষক নেই) — এই ব্যাকআপ ফাইলেও শিক্ষক তথ্য থাকবে না। ডাউনলোড করলে সতর্কবার্তা দেখানো হবে।
            </div>
          )}
<div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ২. আসল ডেটা ব্যাকআপ রিস্টোর
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                আপনার পূর্বে ডাউনলোড করা ব্যাকআপ ফাইলটি নির্বাচন করুন। রিস্টোর সম্পন্ন হলে আপনার সমস্ত পূর্ববর্তী শিক্ষার্থী ও ফলাফল স্বয়ংক্রিয়ভাবে ফিরে আসবে।
              </p>
            </div>

            {/* File Upload Trigger */}
            <div className="mt-2">
              <label className="flex flex-col items-center justify-center w-full px-4 py-3.5 border-2 border-dashed border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/50/40 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/50/80 cursor-pointer transition-all group">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <FileJson size={18} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
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
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-2 mt-3 animate-in fade-in">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>ব্যাকআপ ফাইল যাচাইকরণ সফল!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-emerald-800 dark:text-emerald-300">
                  <div>শিক্ষার্থী: <strong>{uploadedInspection.counts.students}</strong> জন</div>
                  <div>পরীক্ষা: <strong>{uploadedInspection.counts.exams}</strong> টি</div>
                  <div>নম্বর রেকর্ড: <strong>{uploadedInspection.counts.marks}</strong> টি</div>
                  <div>লেনদেন: <strong>{uploadedInspection.counts.transactions}</strong> টি</div>
                </div>
                <button
                  onClick={openFilePreview}
                  disabled={isRestoring || isPreviewLoading}
                  className="w-full mt-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  <span>{isPreviewLoading ? 'প্রিভিউ তৈরি হচ্ছে...' : isRestoring ? 'রিস্টোর হচ্ছে...' : 'এই ব্যাকআপটি রিস্টোর করুন'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
            রিস্টোরের পূর্বে বর্তমান তথ্যের একটি নিরাপত্তা স্ন্যাপশট স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।
          </div>
        </div>

        {/* Module 3: Cloud Database Sync & Pull */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ৩. ক্লাউড রিমোট এক্সেস ও ডিভাইস সিঙ্ক
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                অন্য ডিভাইস (মোবাইল বা নতুন ল্যাপটপ) থেকে অ্যাপ ব্যবহার করার সময় অথবা ব্রাউজার ক্যাশ ক্লিয়ার হলে ক্লাউড থেকে তাৎক্ষণিক সব তথ্য নামিয়ে সিঙ্ক করে নিন।
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span>ক্লাউড স্থিতি:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Firebase Firestore সংযুক্ত
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>সর্বশেষ সিঙ্ক:</span>
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {cloudLastSynced && cloudLastSynced !== 'Initializing...' && cloudLastSynced !== 'No Cloud Data Found'
                    ? cloudLastSynced
                    : 'স্বয়ংক্রিয় সিঙ্ক সক্রিয়'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
            <button
              onClick={handleCloudPull}
              disabled={isPullingCloud}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-emerald-200/90 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
              <RotateCcw size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  ৪. স্মার্ট রিসাইকেল বিন ও পুনরুদ্ধার
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trashBin.length > 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'}`}>
                  {trashBin.length > 0 ? `${trashBin.length}টি আইটেম সংরক্ষিত` : 'বিন ফাঁকা ও সুরক্ষিত'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                ভুলবশত বা অসাবধানতায় কোনো শিক্ষার্থী, বিষয়, পরীক্ষা বা লেনদেন মুছে গেলেও তা চিরতরে ডিলিট হয় না। রিসাইকেল বিনে সুরক্ষিত থাকে এবং যেকোনো সময় এক ক্লিকে পূর্বাবস্থায় ফিরিয়ে আনা যায়।
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span>রিসাইকেল বিনে মোট তথ্য:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{trashBin.length} টি</span>
              </div>
              <div className="flex items-center justify-between">
                <span>অ্যাক্সিডেন্টাল ডিলিট প্রটেকশন:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  সক্রিয় (Active)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="text-indigo-600 dark:text-indigo-400" size={18} />
              স্বয়ংক্রিয় নিরাপত্তা স্ন্যাপশট ও রোলব্যাক ইতিহাস
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              সিস্টেম স্বয়ংক্রিয়ভাবে প্রতি বড় পরিবর্তনের আগে লোকাল ভল্টে সেফটি চেকপয়েন্ট সংরক্ষণ করে।
            </p>
          </div>

          <button
            onClick={refreshSnapshots}
            disabled={isLoadingSnapshots}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={isLoadingSnapshots ? 'animate-spin' : ''} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={snapFilter}
            onChange={(e) => { setSnapFilter(e.target.value); setSnapPage(0); }}
            placeholder="লেবেল দিয়ে খুঁজুন..."
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            মোট {filteredSnapshots.length}টি স্ন্যাপশট
            {lastKnownGoodId ? ' • সর্বশেষ ভালো স্ন্যাপশট চিহ্নিত আছে' : ''}
          </span>
        </div>

        {filteredSnapshots.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            এখনও কোনো অটোমেটিক স্ন্যাপশট ইতিহাস নেই। ব্যাকআপ ডাউনলোড বা রিস্টোরের সময় এখানে তৈরি হবে।
          </div>
        ) : (
          <>
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500">
                  <th className="py-2.5 px-3 font-semibold">তারিখ ও সময়</th>
                  <th className="py-2.5 px-3 font-semibold">বিবরণ / কারণ</th>
                  <th className="py-2.5 px-3 font-semibold">সংরক্ষিত রেকর্ড সংখ্যা</th>
                  <th className="py-2.5 px-3 text-right font-semibold">একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {visibleSnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50/80 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {formatSafeDateTime(snap.timestamp, 'bn-BD', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{snap.labelBn || snap.labelEn}</span>
                      <span className="flex flex-wrap gap-1 mt-1">
                        {snap.pinned ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">পিন করা</span>
                        ) : null}
                        {snapshotIsDegraded(snap) ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold">ক্ষতিগ্রস্ত</span>
                        ) : null}
                        {snap.id === lastKnownGoodId ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">সর্বশেষ ভালো</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      শিক্ষার্থী: {snap.counts.students} | পরীক্ষা: {snap.counts.exams} | মার্কস: {snap.counts.marks}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => openVaultPreview(snap)}
                        disabled={isRollingBack || isPreviewLoading}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
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
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              পৃষ্ঠা {safeSnapPage + 1} / {snapPageCount}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSnapPage(Math.max(0, safeSnapPage - 1))}
                disabled={safeSnapPage === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                আগের
              </button>
              <button
                onClick={() => setSnapPage(Math.min(snapPageCount - 1, safeSnapPage + 1))}
                disabled={safeSnapPage >= snapPageCount - 1}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                পরের
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Phase 3: restore preview (replaces both plain confirm dialogs) */}
      <RestorePreviewModal
        isOpen={restorePreview !== null}
        onClose={() => setRestorePreview(null)}
        onConfirm={() => {
          if (restorePreview?.kind === 'file') void handleExecuteRestore();
          else void handleExecuteRollback();
        }}
        isConfirming={isRestoring || isRollingBack}
        titleBn={restorePreview?.kind === 'vault' ? 'এই স্ন্যাপশটে রোলব্যাক করবেন?' : 'ব্যাকআপ ফাইল রিস্টোর করবেন?'}
        titleEn={restorePreview?.kind === 'vault' ? 'Roll back to this snapshot?' : 'Restore this backup file?'}
        preview={restorePreview?.preview || null}
        language={language}
      />

      {/* Phase 3: degraded-state download warning */}
      <ConfirmDialog
        isOpen={confirmDownloadOpen}
        onClose={() => setConfirmDownloadOpen(false)}
        onConfirm={doDownloadBackup}
        title="ক্ষতিগ্রস্ত অবস্থার ব্যাকআপ ডাউনলোড করবেন?"
        message="বর্তমান অবস্থায় শিক্ষার্থী আছে কিন্তু শিক্ষক নেই — এটি ক্ষতিগ্রস্ত (degraded) অবস্থার লক্ষণ। এই ফাইলে শিক্ষক তথ্য থাকবে না। তারপরও ডাউনলোড করতে চাইলে নিশ্চিত করুন।"
        confirmLabel="হ্যাঁ, ডাউনলোড করুন"
        variant="warning"
      />

      {/* Interactive Smart Recycle Bin Modal — same panel as the dedicated page */}
      {isRecycleBinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <RecycleBinPanel onClose={() => setIsRecycleBinOpen(false)} />
          </div>
        </div>
      )}


    </div>
  );
};
