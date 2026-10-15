import React, { useState, useEffect } from 'react';
import {
  readLocalRecoverySnapshot,
  validateRecoverySnapshot,
  downloadRecoveryBackupJson,
  checkCloudMainStoreStatus,
  restoreValidatedSnapshotToFirestore,
  verifyPostRestoreCounts,
  LocalRecoverySnapshot,
  RecoveryValidationResult,
  CloudStatusCheck,
  RestoreVerificationResult
} from '../services/localDataRecovery';
import { useApp } from '../context/AppContext';

interface LocalDataRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalDataRecoveryModal: React.FC<LocalDataRecoveryModalProps> = ({ isOpen, onClose }) => {
  const { authUser, isAdmin, adminEmail } = useApp();

  const [snapshot, setSnapshot] = useState<LocalRecoverySnapshot | null>(null);
  const [validation, setValidation] = useState<RecoveryValidationResult | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatusCheck | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [backupFilename, setBackupFilename] = useState<string | null>(null);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<RestoreVerificationResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadState();
    }
  }, [isOpen]);

  const loadState = async () => {
    setErrorText(null);
    setRestoreSuccessMessage(null);
    setVerificationResult(null);
    setUserConfirmed(false);

    // 1. Read local snapshot
    const snap = readLocalRecoverySnapshot();
    setSnapshot(snap);

    // 2. Validate
    const val = validateRecoverySnapshot(snap);
    setValidation(val);

    // 3. Check Cloud Status
    setIsCheckingCloud(true);
    try {
      const cloud = await checkCloudMainStoreStatus();
      setCloudStatus(cloud);
    } catch (err: any) {
      console.warn('Cloud check error:', err);
    } finally {
      setIsCheckingCloud(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!snapshot) return;
    try {
      const fname = downloadRecoveryBackupJson(snapshot);
      setBackupFilename(fname);
      setHasDownloadedBackup(true);
    } catch (err: any) {
      setErrorText('JSON ব্যাকআপ ডাউনলোড করতে ব্যর্থ হয়েছে: ' + (err?.message || err));
    }
  };

  const handleExecuteRestore = async () => {
    if (!snapshot || !validation) return;
    if (!validation.canRestore) {
      setErrorText('লোকাল ডাটা শূন্য বা ভ্যালিডেশন ফেইল করায় ক্লাউডে পাঠানো সম্ভব নয়।');
      return;
    }
    if (!userConfirmed) {
      setErrorText('দয়া করে সম্মতি বক্সে টিক চিহ্ন দিন।');
      return;
    }

    setIsRestoring(true);
    setErrorText(null);

    try {
      // Step A: Restore to Firestore
      const email = authUser?.email || adminEmail || 'admin';
      const res = await restoreValidatedSnapshotToFirestore(snapshot, email);

      // Step B: Post-restore count verification
      const verify = await verifyPostRestoreCounts(snapshot);
      setVerificationResult(verify);

      if (verify.isVerified) {
        setRestoreSuccessMessage('✓ সমস্ত লোকাল ডাটা সফলভাবে ক্লাউড ফায়ারস্টোরে (institution/main_store) রিস্টোর এবং যাচাই সম্পন্ন হয়েছে!');
      } else {
        setErrorText('রিস্টোর সম্পন্ন হয়েছে তবে কিছু কাউন্টে অমিল দেখা গেছে: ' + verify.mismatches.join(', '));
      }
    } catch (err: any) {
      setErrorText('রিস্টোর ব্যর্থ হয়েছে: ' + (err?.message || err));
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  const isCurrentBrowserEmpty = validation?.isEmpty ?? true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Emergency Local Data Recovery & Cloud Sync
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                লোকাল ব্রাউজারের ডাটা নিরাপদে উদ্ধার ও ফায়ারস্টোরে সংরক্ষণ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Notice Banner */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
          <strong className="text-slate-800 dark:text-slate-100">নির্দেশিকা:</strong> আপনার পূর্বের এন্ট্রি করা ডাটা যে ব্রাউজারে রয়েছে, সেই ব্রাউজার থেকে এই রিকভারি টুলটি চালালে লোকাল ডাটা ব্যাকআপ নিয়ে ফায়ারস্টোরে স্থায়ীভাবে সেভ হবে। নতুন ব্রাউজারে ফাঁকা থাকলে ক্লাউড রাইট স্বয়ংক্রিয়ভাবে ব্লক থাকবে।
        </div>

        {/* Step 1: Local Census */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-bold">1</span>
            বর্তমান ব্রাউজারের লোকাল ডাটা কাউন্ট (LocalStorage Census)
          </h3>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-3">
            {[
              { label: 'শিক্ষার্থী (Students)', count: snapshot?.counts.students ?? 0 },
              { label: 'শ্রেণি (Classes)', count: snapshot?.counts.classes ?? 0 },
              { label: 'বিষয় (Subjects)', count: snapshot?.counts.subjects ?? 0 },
              { label: 'পরীক্ষা (Exams)', count: snapshot?.counts.exams ?? 0 },
              { label: 'নম্বর (Marks)', count: snapshot?.counts.marks ?? 0 },
              { label: 'মন্তব্য (Remarks)', count: snapshot?.counts.remarks ?? 0 },
              { label: 'ভাউচার (Transactions)', count: snapshot?.counts.transactions ?? 0 },
              { label: 'ফি স্ট্রাকচার (Fee Structures)', count: snapshot?.counts.feeStructures ?? 0 },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-center transition ${
                  item.count > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <div className="text-xl font-black">{item.count}</div>
                <div className="text-[11px] font-medium truncate mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {isCurrentBrowserEmpty && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <strong>বর্তমান ব্রাউজারে ০টি রেকর্ড রয়েছে:</strong> আপনি বর্তমানে একটি নতুন বা ফাঁকা ব্রাউজারে আছেন। পূর্বের ডাটা উদ্ধার করতে দয়া করে যে ব্রাউজারে পূর্বে ডাটা এন্ট্রি করেছিলেন সেই ব্রাউজারে অ্যাপটি ওপেন করে এই মডালটি চালু করুন।
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Cloud Firestore Status */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-bold">2</span>
            ক্লাউড ফায়ারস্টোর স্ট্যাটাস (Cloud Main Store)
          </h3>

          <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Target Path:</span>{' '}
              <code className="px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded font-mono text-blue-600 dark:text-blue-400">
                /institution/main_store
              </code>
            </div>
            <div>
              {isCheckingCloud ? (
                <span className="text-slate-400">যাচাই করা হচ্ছে...</span>
              ) : cloudStatus?.exists && !cloudStatus.isEmpty ? (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded-full font-bold">
                  ⚠️ ক্লাউডে পূর্বের ডাটা রয়েছে (Overwrite Alert)
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full font-bold">
                  ✓ ক্লাউড খালি রয়েছে (Ready for Initial Restore)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Backup & Validation */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-bold">3</span>
            লোকাল ব্যাকআপ ও ভ্যালিডেশন (Pre-Restore Verification)
          </h3>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              onClick={handleDownloadBackup}
              disabled={isCurrentBrowserEmpty}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isCurrentBrowserEmpty
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              }`}
            >
              📥 Download Local JSON Backup
            </button>

            {hasDownloadedBackup && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                ✓ ব্যাকআপ ডাউনলোড সম্পন্ন ({backupFilename})
              </span>
            )}
          </div>
        </div>

        {/* Step 4: Confirmation & Restore Execution */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-bold">4</span>
            ক্লাউডে রিস্টোর অনুমোদন (Safe Firestore Push)
          </h3>

          <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={userConfirmed}
              onChange={(e) => setUserConfirmed(e.target.checked)}
              disabled={isCurrentBrowserEmpty || !validation?.canRestore}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              আমি যাচাই করেছি যে উপরে প্রদর্শিত লোকাল রেকর্ডগুলো সঠিক এবং এগুলোকে ক্লাউড ডাটাবেজ (<code>/institution/main_store</code>)-এ সংরক্ষণ করার অনুমোদন দিচ্ছি।
            </span>
          </label>

          {errorText && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium">
              ✕ {errorText}
            </div>
          )}

          {restoreSuccessMessage && (
            <div className="mt-3 p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl font-semibold">
              {restoreSuccessMessage}
            </div>
          )}

          {verificationResult && (
            <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {verificationResult.isVerified ? '✓ Read-back Verification: PASSED' : '✕ Read-back Verification: MISMATCH'}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Students in Cloud: {verificationResult.cloudCounts.students} | Marks: {verificationResult.cloudCounts.marks} | Classes: {verificationResult.cloudCounts.classes}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              বন্ধ করুন (Close)
            </button>
            <button
              onClick={handleExecuteRestore}
              disabled={isCurrentBrowserEmpty || !userConfirmed || isRestoring || !validation?.canRestore}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isCurrentBrowserEmpty || !userConfirmed || isRestoring || !validation?.canRestore
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
              }`}
            >
              {isRestoring ? 'রিস্টোর হচ্ছে...' : '🚀 Restore Validated Local Data to Cloud'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
