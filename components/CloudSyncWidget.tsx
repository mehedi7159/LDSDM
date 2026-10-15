import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Cloud, 
  RefreshCw, 
  FolderSync, 
  CheckCircle2, 
  Download, 
  Mail, 
  AlertCircle, 
  HardDrive, 
  ShieldCheck, 
  Check, 
  Lock, 
  Unlock, 
  KeyRound, 
  Globe, 
  Database, 
  Copy,
  History,
  LifeBuoy,
  Camera,
  Trash2,
  Sparkles,
  ArrowDownToLine,
  ShieldAlert
} from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AdminAuthModal } from './AdminAuthModal';
import { 
  fetchFirestoreCloudSnapshots, 
  saveCloudSnapshotToFirestore, 
  resurrectDataIfEmpty 
} from '../services/multiStorePersistence';
import { db } from '../services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { formatSafeDate, formatSafeTime } from '../services/utils';

export const CloudSyncWidget: React.FC = () => {
  const { 
    schoolProfile, 
    students, 
    subjects, 
    exams, 
    marks, 
    remarks, 
    classes, 
    language,
    cloudStatus,
    cloudLastSynced,
    isAdmin,
    adminEmail,
    authUser,
    loginWithGoogle,
    logoutAdmin,
    forcePushToCloud,
    forcePullFromCloud
  } = useApp();
  
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState<boolean>(false);
  const [snapshotNote, setSnapshotNote] = useState<string>('');
  const [cloudSnapshots, setCloudSnapshots] = useState<any[]>([]);

  // Confirmation dialogs state
  const [confirmPullOpen, setConfirmPullOpen] = useState(false);
  const [selectedRestoreSnapshotId, setSelectedRestoreSnapshotId] = useState<string | null>(null);
  const [selectedDeleteSnapshotId, setSelectedDeleteSnapshotId] = useState<string | null>(null);

  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [isSyncingAction, setIsSyncingAction] = useState<boolean>(false);
  const [copiedVercelSnippet, setCopiedVercelSnippet] = useState<boolean>(false);
  const [isRescuing, setIsRescuing] = useState<boolean>(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState<boolean>(false);

  // Load snapshots from Firestore on mount & when auth changes
  const refreshSnapshotsList = async () => {
    try {
      const snaps = await fetchFirestoreCloudSnapshots();
      setCloudSnapshots(snaps);
    } catch (e) {
      console.warn('Failed to fetch cloud snapshots:', e);
    }
  };

  React.useEffect(() => {
    if (authUser) {
      refreshSnapshotsList();
    }
  }, [authUser]);

  const handleManualPush = async () => {
    setIsSyncingAction(true);
    try {
      await forcePushToCloud();
      setSyncNotification(language === 'bn' 
        ? 'সফলভাবে ক্লাউডে সমস্ত ডাটা সংরক্ষিত ও ব্যাকআপ তৈরি হয়েছে!' 
        : 'Successfully pushed all records and saved cloud snapshot!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (err: any) {
      setSyncNotification(language === 'bn' ? ('ক্লাউড সিঙ্ক সমস্যা: ' + (err?.message || 'কানেকশন চেক করুন')) : 'Cloud sync failed.');
      setTimeout(() => setSyncNotification(null), 4000);
    } finally {
      setIsSyncingAction(false);
    }
  };

  const executePullFromCloud = async () => {
    setConfirmPullOpen(false);
    setIsSyncingAction(true);
    try {
      await forcePullFromCloud();
      setSyncNotification(language === 'bn' 
        ? 'সফলভাবে ক্লাউড থেকে ডাটা রিস্টোর সম্পন্ন হয়েছে!' 
        : 'Successfully restored all records from Cloud Database!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (err: any) {
      setSyncNotification(language === 'bn' ? ('ক্লাউড রিস্টোর ব্যর্থ হয়েছে: ' + (err?.message || 'কানেকশন চেক করুন')) : 'Cloud restore failed.');
      setTimeout(() => setSyncNotification(null), 4000);
    } finally {
      setIsSyncingAction(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingAction(true);
    try {
      const note = snapshotNote.trim() || (language === 'bn' ? 'ম্যানুয়াল ব্যাকআপ' : 'Manual Backup');
      await saveCloudSnapshotToFirestore(undefined, note, note, adminEmail);
      await refreshSnapshotsList();
      setShowSnapshotModal(false);
      setSnapshotNote('');
      setSyncNotification(language === 'bn' 
        ? 'নতুন ক্লাউড স্ন্যাপশট ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে!' 
        : 'New cloud snapshot backup successfully created!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (e) {
      alert(language === 'bn' ? 'ব্যাকআপ তৈরি করা সম্ভব হয়নি।' : 'Failed to create snapshot.');
    } finally {
      setIsSyncingAction(false);
    }
  };

  const executeRestoreSnapshot = async () => {
    if (!selectedRestoreSnapshotId) return;
    setIsSyncingAction(true);
    setSelectedRestoreSnapshotId(null);
    try {
      await forcePullFromCloud();
      setSyncNotification(language === 'bn' 
        ? 'ক্লাউড থেকে সফলভাবে ডাটা ফিরিয়ে আনা হয়েছে!' 
        : 'Successfully restored from cloud snapshot!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (e) {
      alert(language === 'bn' ? 'রিস্টোর ত্রুটি ঘটেছে।' : 'Restore error.');
    } finally {
      setIsSyncingAction(false);
    }
  };

  const executeDeleteSnapshot = async () => {
    if (!selectedDeleteSnapshotId) return;
    const id = selectedDeleteSnapshotId;
    setSelectedDeleteSnapshotId(null);
    try {
      await deleteDoc(doc(db, 'cloud_snapshots', id));
      await refreshSnapshotsList();
      setSyncNotification(language === 'bn' ? 'স্ন্যাপশট ডিলিট হয়েছে।' : 'Snapshot deleted.');
      setTimeout(() => setSyncNotification(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmergencyRescue = async () => {
    setIsRescuing(true);
    try {
      const res = await resurrectDataIfEmpty();
      setSyncNotification(language === 'bn' ? res.messageBn : res.messageEn);
      setTimeout(() => setSyncNotification(null), 5000);
    } catch (e: any) {
      alert(e.message || 'Rescue failed');
    } finally {
      setIsRescuing(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoggingIn(true);
    try {
      const ok = await loginWithGoogle();
      if (ok) {
        setSyncNotification(language === 'bn' 
          ? 'গুগল দিয়ে সফলভাবে লগইন হয়েছে এবং ক্লাউড ডাটা লোড হয়েছে!' 
          : 'Signed in with Google! Cloud data synchronized.');
        setTimeout(() => setSyncNotification(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const copyVercelConfig = () => {
    const configString = JSON.stringify(firebaseConfig, null, 2);
    navigator.clipboard.writeText(configString);
    setCopiedVercelSnippet(true);
    setTimeout(() => setCopiedVercelSnippet(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Real-time sync notification toast */}
      {syncNotification && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2.5 shadow-sm animate-in fade-in duration-150">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span className="leading-relaxed">{syncNotification}</span>
        </div>
      )}

      {/* Gmail Account & Automatic Cloud Guarantee Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-blue-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database size={160} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold">
              <Sparkles size={13} className="text-blue-300" />
              <span>{language === 'bn' ? 'জিরো ডাটা লস গ্যারান্টি (Firebase Cloud Firestore)' : 'Zero Data Loss Guarantee'}</span>
            </div>

            <h3 className="text-xl font-bold tracking-tight">
              {language === 'bn' 
                ? 'Gmail ও Google ক্লাউডে স্বয়ংক্রিয় ব্যাকআপ' 
                : 'Permanent Cloud Persistence with Gmail'}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আপনার মাদ্রাসার সমস্ত তথ্য (ছাত্র-ছাত্রী, বিষয়, নম্বর, হিসাব) স্বয়ংক্রিয়ভাবে Google Firebase ক্লাউডে সুরক্ষিত থাকে। ব্রাউজার ক্যাশ ক্লিয়ার হলে বা নতুন যেকোনো ডিভাইস থেকে আপনার Gmail দিয়ে লগইন করলেই সবকিছু সাথে সাথে চলে আসবে।'
                : 'All your madrasah records (students, exams, marks, finance) are permanently saved to Firebase Cloud. Signing in with your Gmail restores everything instantly on any device.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-mono backdrop-blur-xs border border-white/15">
                <Mail size={14} className="text-emerald-400" />
                <span className="text-slate-100 font-semibold">{adminEmail || authUser?.email || 'mehedihasansagor26@gmail.com'}</span>
              </div>

              {authUser ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  {language === 'bn' ? 'Google অথেনটিকেটেড' : 'Google Authenticated'}
                </span>
              ) : (
                <button
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoggingIn}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isGoogleLoggingIn ? (language === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...') : (language === 'bn' ? 'Gmail দিয়ে রি-লগইন' : 'Sign in with Google')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => setShowSnapshotModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              <Camera size={15} />
              <span>{language === 'bn' ? 'নতুন ক্লাউড স্ন্যাপশট ব্যাকআপ' : 'Save Cloud Snapshot'}</span>
            </button>

            <button
              onClick={handleEmergencyRescue}
              disabled={isRescuing}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <LifeBuoy size={15} className={isRescuing ? 'animate-spin' : 'text-amber-400'} />
              <span>{isRescuing ? (language === 'bn' ? 'উদ্ধার করা হচ্ছে...' : 'Rescuing...') : (language === 'bn' ? 'জরুরি ডাটা উদ্ধার (Rescue)' : 'Emergency Data Rescue')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Cloud Infrastructure Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 tracking-tight">
                  {language === 'bn' ? 'ক্লাউড ডেটাবেজ ও লাইভ সিঙ্ক অবস্থা' : 'Cloud Database & Live Sync Status'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Globe size={10} />
                  Firebase Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'bn' 
                  ? 'প্রতিটি নম্বর ও শিক্ষার্থীর পরিবর্তন সাথে সাথে ক্লাউডে স্বয়ংক্রিয়ভাবে সেভ হয়।' 
                  : 'Real-time synchronization enabled via Firebase Cloud Firestore'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {cloudStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {language === 'bn' ? 'ক্লাউড কানেক্টেড' : 'Cloud Connected'}
              </span>
            )}
            {cloudStatus === 'syncing' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                <RefreshCw size={12} className="animate-spin text-blue-600" />
                {language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}
              </span>
            )}
            {cloudStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={12} className="text-amber-600" />
                {language === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}
              </span>
            )}
            {cloudStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle size={12} className="text-rose-600" />
                {language === 'bn' ? 'অনুমতি/অথেনটিকেশন ত্রুটি' : 'Auth/Permission Error'}
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Metadata info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'সংযুক্ত এডমিন জিমেইল' : 'Admin Gmail'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700 truncate">
                <Mail size={13} className="text-blue-500 shrink-0" />
                <span className="truncate">{adminEmail || 'mehedihasansagor26@gmail.com'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'সর্বশেষ ক্লাউড সিঙ্ক' : 'Last Synced'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700">
                <RefreshCw size={13} className="text-emerald-500 shrink-0" />
                <span>{cloudLastSynced}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'বর্তমান সক্রিয় রেকর্ড' : 'Current Active Records'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700">
                <HardDrive size={13} className="text-purple-500 shrink-0" />
                <span>{students.length} {language === 'bn' ? 'ছাত্র' : 'Students'}, {marks.length} {language === 'bn' ? 'নম্বর' : 'Marks'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'ক্লাউড স্ন্যাপশট ব্যাকআপ' : 'Cloud Snapshots'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700 truncate">
                <History size={13} className="text-emerald-600 shrink-0" />
                <span>{cloudSnapshots.length} {language === 'bn' ? 'টি ব্যাকআপ ভার্সন' : 'Snapshots'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleManualPush}
                disabled={isSyncingAction}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={isSyncingAction ? 'animate-spin' : ''} />
                <span>{language === 'bn' ? 'এখনই ক্লাউডে সেভ করুন (Push & Backup)' : 'Force Push & Backup'}</span>
              </button>

              <button
                onClick={() => setConfirmPullOpen(true)}
                disabled={isSyncingAction}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FolderSync size={14} className="text-blue-600" />
                <span>{language === 'bn' ? 'ক্লাউড থেকে রিস্টোর (Pull Latest)' : 'Pull From Cloud'}</span>
              </button>
            </div>

            <button
              onClick={() => refreshSnapshotsList()}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>{language === 'bn' ? 'হিস্টোরি রিফ্রেশ' : 'Refresh History'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Snapshot Backup History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <History size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {language === 'bn' ? 'ক্লাউড স্ন্যাপশট ও টাইম-মেশিন রিস্টোর' : 'Cloud Snapshots & Time-Machine History'}
              </h4>
              <p className="text-xs text-slate-500">
                {language === 'bn' 
                  ? 'পূর্বে তৈরি করা যেকোনো ব্যাকআপের অবস্থায় ১-ক্লিকে মাদ্রাসার ডাটা ফিরিয়ে আনুন।' 
                  : 'Restore your entire institution database to any previous point in time.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSnapshotModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200/60"
          >
            <Camera size={13} />
            <span>{language === 'bn' ? '+ ব্যাকআপ তৈরি' : '+ Create Backup'}</span>
          </button>
        </div>

        {cloudSnapshots.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            <p className="font-semibold">{language === 'bn' ? 'এখনো কোনো ক্লাউড স্ন্যাপশট ব্যাকআপ তৈরি করা হয়নি।' : 'No cloud snapshots saved yet.'}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'bn' ? 'উপরের "নতুন ক্লাউড স্ন্যাপশট ব্যাকআপ" বাটনে ক্লিক করে একটি ব্যাকআপ পয়েন্ট সেভ করে রাখুন।' : 'Click "+ Create Backup" above to create your first safe restore point.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200/70 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3.5">{language === 'bn' ? 'তারিখ ও সময়' : 'Timestamp'}</th>
                  <th className="p-3.5">{language === 'bn' ? 'বর্ণনা / নোট' : 'Note'}</th>
                  <th className="p-3.5 text-center">{language === 'bn' ? 'রেকর্ড সংখ্যা' : 'Counts'}</th>
                  <th className="p-3.5 text-right">{language === 'bn' ? 'একশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cloudSnapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-medium text-slate-800">
                      <div>{formatSafeDate(snap.createdAt, language === 'bn' ? 'bn-BD' : 'en-US')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{formatSafeTime(snap.createdAt, language === 'bn' ? 'bn-BD' : 'en-US')}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-700">
                      {snap.note}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-mono">
                        {snap.counts?.students || 0} {language === 'bn' ? 'ছাত্র' : 'students'} | {snap.counts?.marks || 0} {language === 'bn' ? 'নম্বর' : 'marks'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRestoreSnapshotId(snap.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ArrowDownToLine size={12} />
                          <span>{language === 'bn' ? 'রিস্টোর' : 'Restore'}</span>
                        </button>
                        <button
                          onClick={() => setSelectedDeleteSnapshotId(snap.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Snapshot"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security & Access Protection Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isAdmin ? <Unlock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {language === 'bn' ? 'ডেটা নিরাপত্তা ও এডমিন লক' : 'Data Security & Admin Lock'}
              </h4>
              <p className="text-xs text-slate-500">
                {isAdmin 
                  ? (language === 'bn' ? 'এডমিন মোড সক্রিয়: সম্পূর্ণ এডিট ও ডিলিট পারমিশন আছে।' : 'Admin mode active: Full edit & management privileges.')
                  : (language === 'bn' ? 'ভিউয়ার মোড: শুধু রেজাল্ট ও মার্কশিট দেখা যাবে, কেউ পরিবর্তন করতে পারবে না।' : 'Viewer mode: Protected read-only state. Data cannot be altered.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                onClick={logoutAdmin}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock size={13} />
                <span>{language === 'bn' ? 'লক করুন' : 'Lock Admin'}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminAuthModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Unlock size={14} />
                <span>{language === 'bn' ? 'এডমিন আনলক করুন' : 'Unlock Admin Mode'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vercel & GitHub Deployment Sync Helper Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="text-blue-400" size={20} />
            <h4 className="text-sm font-bold tracking-tight">
              {language === 'bn' ? 'Vercel এ একই ডেটা পাওয়ার নির্দেশিকা' : 'How Vercel Uses This Exact Same Live Data'}
            </h4>
          </div>
          <button
            onClick={copyVercelConfig}
            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedVercelSnippet ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedVercelSnippet ? (language === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (language === 'bn' ? 'কনফিগ কপি করুন' : 'Copy Config')}</span>
          </button>
        </div>

        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <p>
            {language === 'bn' 
              ? '✅ আপনার অ্যাপের ক্লাউড কনফিগারেশন ইতিমধ্যেই কোডের সাথে যুক্ত করা হয়েছে। আপনি GitHub এ কোড পুশ করলেই Vercel স্বয়ংক্রিয়ভাবে এই একই Firebase Firestore ডেটাবেজের সাথে যুক্ত হয়ে যাবে!'
              : '✅ Your Firebase Cloud configuration is directly bundled with the app code. Once you push your latest commit to GitHub, Vercel will instantly connect to this exact Firestore cloud database.'}
          </p>
          <div className="bg-slate-950/60 p-3 rounded-xl font-mono text-[11px] text-blue-300 border border-slate-700/60">
            git add . && git commit -m "Add Firebase Real-time Cloud Database" && git push
          </div>
        </div>
      </div>

      {/* Save Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {language === 'bn' ? 'ক্লাউড স্ন্যাপশট ব্যাকআপ' : 'Save Cloud Snapshot'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'বর্তমান অবস্থার একটি স্থায়ী ক্লাউড ব্যাকআপ রাখুন' : 'Save an immutable cloud checkpoint'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {language === 'bn' ? 'ব্যাকআপের নাম / বিবরণ' : 'Backup Description / Note'}
                </label>
                <input
                  type="text"
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  placeholder={language === 'bn' ? 'যেমন: বার্ষিক পরীক্ষার নম্বর এন্ট্রি সম্পন্ন' : 'e.g. Pre-Exam Backup'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div>• {students.length} {language === 'bn' ? 'জন শিক্ষার্থীর প্রোফাইল' : 'Students'}</div>
                <div>• {marks.length} {language === 'bn' ? 'টি বিষয়ের পরীক্ষার নম্বর' : 'Mark Records'}</div>
                <div>• {exams.length} {language === 'bn' ? 'টি পরীক্ষা ও সেটিংস' : 'Exams & Settings'}</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSnapshotModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSyncingAction}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSyncingAction ? (language === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : (language === 'bn' ? 'সেভ করুন' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Auth Modal */}
      <AdminAuthModal 
        isOpen={showAdminAuthModal} 
        onClose={() => setShowAdminAuthModal(false)} 
        onSuccess={() => {
          setShowAdminAuthModal(false);
          setSyncNotification(language === 'bn' ? 'এডমিন ভেরিফিকেশন সফল হয়েছে!' : 'Admin access verified!');
          setTimeout(() => setSyncNotification(null), 3500);
        }} 
      />

      {/* Confirmation Dialog: Pull Data */}
      <ConfirmDialog
        isOpen={confirmPullOpen}
        onClose={() => setConfirmPullOpen(false)}
        onConfirm={executePullFromCloud}
        title={language === 'bn' ? 'ক্লাউড থেকে ডেটা রিস্টোর করবেন?' : 'Restore From Cloud?'}
        message={language === 'bn' 
          ? 'ক্লাউড ফায়ারবেস ডেটাবেজ থেকে সর্বশেষ ডেটা নামিয়ে আনা হবে। এটি আপনার বর্তমান লোকাল পরিবর্তন প্রতিস্থাপন করতে পারে।' 
          : 'This will pull all records from Firebase Firestore and overwrite local state.'}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, রিস্টোর করুন' : 'Yes, Pull Data'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="warning"
      />

      {/* Confirmation Dialog: Restore from Snapshot */}
      <ConfirmDialog
        isOpen={!!selectedRestoreSnapshotId}
        onClose={() => setSelectedRestoreSnapshotId(null)}
        onConfirm={executeRestoreSnapshot}
        title={language === 'bn' ? 'এই ক্লাউড স্ন্যাপশট রিস্টোর করবেন?' : 'Restore This Snapshot?'}
        message={language === 'bn' 
          ? 'এই স্ন্যাপশট ব্যাকআপে থাকা সকল শিক্ষার্থী, বিষয় ও পরীক্ষার নম্বর রিস্টোর হবে এবং ক্লাউডে আপডেট হবে।' 
          : 'This will revert the institution state to this exact snapshot checkpoint.'}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, স্ন্যাপশট রিস্টোর করুন' : 'Yes, Restore'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="primary"
      />

      {/* Confirmation Dialog: Delete Snapshot */}
      <ConfirmDialog
        isOpen={!!selectedDeleteSnapshotId}
        onClose={() => setSelectedDeleteSnapshotId(null)}
        onConfirm={executeDeleteSnapshot}
        title={language === 'bn' ? 'স্ন্যাপশট ডিলিট করবেন?' : 'Delete Snapshot?'}
        message={language === 'bn' ? 'এই ব্যাকআপ ফাইলটি ক্লাউড থেকে মুছে ফেলা হবে।' : 'This snapshot backup will be permanently deleted.'}
        confirmLabel={language === 'bn' ? 'ডিলিট করুন' : 'Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />
    </div>
  );
};
