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
  ExternalLink,
  Copy
} from 'lucide-react';
import firebaseConfig from '../firebase-applet-config.json';
import { ConfirmDialog } from './ui/ConfirmDialog';

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
    loginAdmin,
    logoutAdmin,
    setAdminPinCode,
    forcePushToCloud,
    forcePullFromCloud
  } = useApp();
  
  const [googleConnected, setGoogleConnected] = useState<boolean>(() => {
    const saved = localStorage.getItem('madrasha_gdrive_connected');
    return saved !== null ? saved === 'true' : true;
  });

  const [connectedGmail, setConnectedGmail] = useState<string>(() => {
    return localStorage.getItem('madrasha_connected_gmail') || 'mehedihasansagor26@gmail.com';
  });

  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showPinChangeModal, setShowPinChangeModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Confirmation dialogs state
  const [confirmPullOpen, setConfirmPullOpen] = useState(false);
  const [confirmPinChangeOpen, setConfirmPinChangeOpen] = useState(false);

  const [inputEmail, setInputEmail] = useState<string>(connectedGmail || 'mehedihasansagor26@gmail.com');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [isSyncingAction, setIsSyncingAction] = useState<boolean>(false);
  const [copiedVercelSnippet, setCopiedVercelSnippet] = useState<boolean>(false);

  const handleManualPush = async () => {
    setIsSyncingAction(true);
    try {
      await forcePushToCloud();
      setSyncNotification(language === 'bn' 
        ? 'সফলভাবে ক্লাউডে সমস্ত ডেটা পাঠানো হয়েছে!' 
        : 'Successfully pushed all records to Cloud Database!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (err) {
      alert(language === 'bn' ? 'ক্লাউড সিঙ্ক ব্যর্থ হয়েছে।' : 'Cloud sync failed.');
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
        ? 'সফলভাবে ক্লাউড থেকে ডেটা রিস্টোর সম্পন্ন হয়েছে!' 
        : 'Successfully restored all records from Cloud Database!');
      setTimeout(() => setSyncNotification(null), 3500);
    } catch (err) {
      alert(language === 'bn' ? 'ক্লাউড রিস্টোর ব্যর্থ হয়েছে।' : 'Cloud restore failed.');
    } finally {
      setIsSyncingAction(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(adminPinInput)) {
      setShowAdminModal(false);
      setAdminPinInput('');
      setPinError(null);
    } else {
      setPinError(language === 'bn' ? 'ভুল এডমিন পিন কোড! আপনার সেট করা সঠিক পিন দিন।' : 'Invalid PIN Code! Please enter your valid Admin PIN.');
    }
  };

  const validateAndPromptPinChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (newPinInput.length < 4) {
      setPinError(language === 'bn' ? 'পিন কমপক্ষে ৪ সংখ্যার হতে হবে।' : 'PIN must be at least 4 digits.');
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      setPinError(language === 'bn' ? 'দুইটি পিন কোড মিলছে না! পুনরায় চেক করুন।' : 'PINs do not match! Please confirm.');
      return;
    }

    setConfirmPinChangeOpen(true);
  };

  const executePinChange = async () => {
    setConfirmPinChangeOpen(false);
    await setAdminPinCode(newPinInput);
    setShowPinChangeModal(false);
    setNewPinInput('');
    setConfirmNewPinInput('');
    setPinError(null);
    setSyncNotification(language === 'bn' 
      ? 'এডমিন পিন সফলভাবে পরিবর্তন ও ক্লাউডে সিঙ্ক হয়েছে!' 
      : 'Admin PIN successfully updated and synced with Cloud!');
    setTimeout(() => setSyncNotification(null), 4000);
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
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{syncNotification}</span>
        </div>
      )}

      {/* Main Cloud Infrastructure Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 tracking-tight">
                  {language === 'bn' ? 'ক্লাউড ডেটাবেজ ও লাইভ সিঙ্ক' : 'Cloud Database & Live Sync'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Globe size={10} />
                  Vercel Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'bn' 
                  ? 'Firebase Firestore ক্লাউডের সাথে স্বয়ংক্রিয় রিয়েল-টাইম সিঙ্ক সক্রিয়' 
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
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Metadata info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'সংযুক্ত জিমেইল' : 'Connected Gmail'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700 truncate">
                <Mail size={13} className="text-blue-500 shrink-0" />
                <span className="truncate">{connectedGmail}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'সর্বশেষ সিঙ্ক' : 'Last Synced'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700">
                <RefreshCw size={13} className="text-emerald-500 shrink-0" />
                <span>{cloudLastSynced}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'মোট সংরক্ষিত ডেটা' : 'Total Cloud Records'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700">
                <HardDrive size={13} className="text-purple-500 shrink-0" />
                <span>{students.length} {language === 'bn' ? 'শিক্ষার্থী' : 'Students'}, {marks.length} {language === 'bn' ? 'নম্বর' : 'Marks'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                {language === 'bn' ? 'ডেটাবেজ প্রজেক্ট' : 'Firestore DB'}
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-700 truncate">
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">{firebaseConfig.projectId}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleManualPush}
                disabled={isSyncingAction}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncingAction ? 'animate-spin' : ''} />
                <span>{language === 'bn' ? 'এখনই ক্লাউডে পুশ করুন (Push)' : 'Sync Now (Force Push)'}</span>
              </button>

              <button
                onClick={() => setConfirmPullOpen(true)}
                disabled={isSyncingAction}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FolderSync size={14} className="text-blue-600" />
                <span>{language === 'bn' ? 'ক্লাউড থেকে রিস্টোর (Pull)' : 'Restore From Cloud (Pull)'}</span>
              </button>
            </div>

            <button
              onClick={() => setShowLoginModal(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium underline cursor-pointer"
            >
              {language === 'bn' ? 'জিমেইল পরিবর্তন করুন' : 'Change Gmail Account'}
            </button>
          </div>
        </div>
      </div>

      {/* Security & Access Protection Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
              <>
                <button
                  onClick={() => {
                    setNewPinInput('');
                    setConfirmNewPinInput('');
                    setPinError(null);
                    setShowPinChangeModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound size={13} />
                  <span>{language === 'bn' ? 'পিন পরিবর্তন' : 'Change PIN'}</span>
                </button>
                <button
                  onClick={logoutAdmin}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-medium text-rose-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock size={13} />
                  <span>{language === 'bn' ? 'লক করুন' : 'Lock Admin'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAdminPinInput('');
                  setPinError(null);
                  setShowAdminModal(true);
                }}
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
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 space-y-4 shadow-sm">
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

      {/* Admin Unlock Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {language === 'bn' ? 'এডমিন পিন প্রবেশ করান' : 'Enter Admin PIN'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'আপনার সেট করা এডমিন পিন কোড দিন' : 'Enter your configured Admin PIN'}
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="******"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  autoFocus
                />
                {pinError && <p className="text-xs text-rose-500 mt-1.5 font-medium">{pinError}</p>}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-medium hover:bg-slate-100 cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'আনলক করুন' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change PIN Modal with Confirmation */}
      {showPinChangeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {language === 'bn' ? 'নতুন এডমিন পিন সেট করুন' : 'Set New Admin PIN'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'কমপক্ষে ৪-৬ সংখ্যার সিকিউর পিন দিন' : '4-6 digit secure PIN'}
                </p>
              </div>
            </div>

            <form onSubmit={validateAndPromptPinChange} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'নতুন পিন কোড' : 'New PIN'}
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="******"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'bn' ? 'নতুন পিন নিশ্চিত করুন' : 'Confirm New PIN'}
                </label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="******"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                />
              </div>

              {pinError && <p className="text-xs text-rose-600 font-medium">{pinError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinChangeModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  {language === 'bn' ? 'পরিবর্তন নিশ্চিত করুন' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Confirmation Dialog: Change PIN */}
      <ConfirmDialog
        isOpen={confirmPinChangeOpen}
        onClose={() => setConfirmPinChangeOpen(false)}
        onConfirm={executePinChange}
        title={language === 'bn' ? 'এডমিন পিন পরিবর্তন নিশ্চিতকরণ' : 'Confirm Admin PIN Change'}
        message={language === 'bn'
          ? 'আপনি কি নিশ্চিত যে নতুন এডমিন পিন সেট করতে চান? নতুন পিন কোডটি সতর্কতার সাথে মনে রাখুন।'
          : 'Are you sure you want to update your Admin PIN? Make sure to remember your new PIN.'}
        highlightText={language === 'bn' ? `নতুন পিন: ${'*'.repeat(newPinInput.length)}` : `New PIN: ${'*'.repeat(newPinInput.length)}`}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, পিন সেভ করুন' : 'Yes, Save PIN'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="primary"
      />

      {/* Gmail Account Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              {language === 'bn' ? 'জিমেইল অ্যাকাউন্ট আপডেট' : 'Update Gmail Account'}
            </h3>
            <div className="space-y-4">
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-medium hover:bg-slate-100"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectedGmail(inputEmail);
                    localStorage.setItem('madrasha_connected_gmail', inputEmail);
                    setShowLoginModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  {language === 'bn' ? 'সেভ করুন' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
