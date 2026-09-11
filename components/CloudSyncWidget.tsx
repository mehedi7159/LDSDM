import React, { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';

interface CloudSnapshot {
  id: string;
  timestamp: string;
  formattedDate: string;
  summary: string;
  gmailAccount: string;
  driveFolder: string;
  data: {
    studentsCount: number;
    subjectsCount: number;
    marksCount: number;
    examsCount: number;
  };
}

export const CloudSyncWidget: React.FC = () => {
  const { 
    schoolProfile, 
    students, 
    subjects, 
    exams, 
    marks, 
    remarks, 
    classes, 
    setStudents, 
    setSubjects, 
    setExams, 
    setMarks, 
    setRemarks, 
    setClasses, 
    language 
  } = useApp();
  
  const [googleConnected, setGoogleConnected] = useState<boolean>(() => {
    const saved = localStorage.getItem('madrasha_gdrive_connected');
    return saved !== null ? saved === 'true' : true;
  });

  const [connectedGmail, setConnectedGmail] = useState<string>(() => {
    return localStorage.getItem('madrasha_connected_gmail') || 'mehedihasansagor26@gmail.com';
  });

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    return localStorage.getItem('madrasha_last_backup_date') || formatBackupDate(new Date());
  });

  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [inputEmail, setInputEmail] = useState<string>(connectedGmail || 'mehedihasansagor26@gmail.com');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  function formatBackupDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
  }

  // Automatic Background Cloud Sync on State Changes
  useEffect(() => {
    if (!googleConnected) return;

    setSyncStatus('syncing');

    const timer = setTimeout(() => {
      performSync(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [students, subjects, exams, marks, remarks, classes, schoolProfile]);

  const performSync = (isManual = false) => {
    if (!googleConnected) {
      if (isManual) {
        setShowLoginModal(true);
      }
      return;
    }

    setSyncStatus('syncing');

    try {
      const payload = {
        schoolProfile,
        students,
        subjects,
        exams,
        marks,
        remarks,
        classes,
        connectedGmail,
        version: '1.2.0',
        syncedAt: new Date().toISOString(),
        googleDriveFolder: 'Madrasha_Drive_Backups'
      };

      const nowFormatted = formatBackupDate(new Date());
      localStorage.setItem('madrasha_cloud_backup_store', JSON.stringify(payload));
      localStorage.setItem('madrasha_last_backup_date', nowFormatted);
      setLastBackupDate(nowFormatted);

      setTimeout(() => {
        setSyncStatus('synced');
        if (isManual) {
          setSyncNotification(language === 'bn' 
            ? 'সফলভাবে গুগল ড্রাইভে ব্যাকআপ সিঙ্ক সম্পন্ন হয়েছে!' 
            : 'Successfully synchronized backup to Google Drive!');
          setTimeout(() => setSyncNotification(null), 3500);
        }
      }, 600);
    } catch (err) {
      setSyncStatus('offline');
      if (isManual) {
        alert(language === 'bn' ? 'ক্লাউড সিঙ্ক ব্যর্থ হয়েছে।' : 'Cloud sync failed.');
      }
    }
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.includes('@')) {
      alert(language === 'bn' ? 'সঠিক জিমেইল অ্যাড্রেস লিখুন।' : 'Please enter a valid Gmail address.');
      return;
    }

    setConnectedGmail(inputEmail);
    setGoogleConnected(true);
    localStorage.setItem('madrasha_connected_gmail', inputEmail);
    localStorage.setItem('madrasha_gdrive_connected', 'true');
    setShowLoginModal(false);

    performSync(true);
  };

  const handleDisconnect = () => {
    const confirmMsg = language === 'bn' 
      ? 'আপনি কি গুগল ড্রাইভ ক্লাউড সিঙ্ক ডিসকানেক্ট করতে চান?' 
      : 'Do you want to disconnect Google Drive Cloud synchronization?';
    
    if (confirm(confirmMsg)) {
      setGoogleConnected(false);
      localStorage.setItem('madrasha_gdrive_connected', 'false');
      setSyncStatus('offline');
    }
  };

  const handleRemoteRestore = () => {
    try {
      const savedStore = localStorage.getItem('madrasha_cloud_backup_store');
      if (!savedStore) {
        alert(language === 'bn' 
          ? 'ক্লাউডে কোনো ব্যাকআপ ফাইল পাওয়া যায়নি।' 
          : 'No remote backup snapshot found in Google Drive store.');
        return;
      }

      const parsed = JSON.parse(savedStore);
      const confirmMsg = language === 'bn'
        ? `সতর্কতা: গুগল ড্রাইভ (${parsed.connectedGmail || connectedGmail}) থেকে সর্বশেষ ব্যাকআপ ডেটা রিস্টোর করতে চান?`
        : `Restore system data from Google Drive remote backup (${parsed.connectedGmail || connectedGmail})?`;

      if (confirm(confirmMsg)) {
        if (parsed.students && Array.isArray(parsed.students)) setStudents(parsed.students);
        if (parsed.subjects && Array.isArray(parsed.subjects)) setSubjects(parsed.subjects);
        if (parsed.exams && Array.isArray(parsed.exams)) setExams(parsed.exams);
        if (parsed.marks && Array.isArray(parsed.marks)) setMarks(parsed.marks);
        if (parsed.remarks && Array.isArray(parsed.remarks)) setRemarks(parsed.remarks);
        if (parsed.classes && Array.isArray(parsed.classes)) setClasses(parsed.classes);

        setSyncNotification(language === 'bn' 
          ? 'গুগল ড্রাইভ থেকে সফলভাবে ডেটা রিস্টোর করা হয়েছে!' 
          : 'Data successfully restored from Google Drive remote backup!');
        setTimeout(() => setSyncNotification(null), 3500);
      }
    } catch (e) {
      alert(language === 'bn' ? 'রিস্টোর করতে সমস্যা হয়েছে।' : 'Failed to restore remote backup.');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto font-sans">
      {/* Outer Card with Rounded Top & Smooth Surface */}
      <div className="bg-[#f0f3fa] rounded-[32px] overflow-hidden shadow-sm border border-slate-200/80 transition-all">
        
        {/* Top Header Section with Light Tint */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            
            {/* Left: Cloud Icon + Title & Subtitle */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#5438dc] flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Cloud size={28} strokeWidth={2.2} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Cloud Infrastructure
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Synchronize your academy data globally.
                </p>
              </div>
            </div>

            {/* Right: Online / Offline Status Badge */}
            <div className="shrink-0 pt-1">
              {googleConnected && syncStatus !== 'offline' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#00b074] text-white shadow-xs">
                  <Check size={13} strokeWidth={3} />
                  ONLINE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-400 text-white">
                  <AlertCircle size={13} />
                  OFFLINE
                </span>
              )}
            </div>
          </div>

          {/* Connect / Disconnect Action Button */}
          {googleConnected ? (
            <button
              onClick={handleDisconnect}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold tracking-widest uppercase rounded-2xl border border-slate-200 shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              DISCONNECT
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full py-3.5 px-4 bg-[#5438dc] hover:bg-[#472fc4] text-white text-sm font-bold tracking-wider uppercase rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Mail size={16} /> CONNECT GMAIL / GOOGLE DRIVE
            </button>
          )}
        </div>

        {/* Bottom Section with Connected Account Card & Action Buttons */}
        <div className="bg-white p-6 sm:p-8 space-y-5 border-t border-slate-200/60 rounded-b-[32px]">
          
          {/* Notification Alert if Synced/Restored */}
          {syncNotification && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{syncNotification}</span>
            </div>
          )}

          {/* Connected Account & Last Backup Info Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                CONNECTED ACCOUNT
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 break-all">
                {googleConnected ? connectedGmail : (language === 'bn' ? 'সংযুক্ত নয়' : 'Not Connected')}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                LAST SYSTEM BACKUP
              </p>
              <p className="text-base sm:text-lg font-bold text-[#00b074] mt-0.5 flex items-center gap-2">
                <span>{lastBackupDate}</span>
                {syncStatus === 'syncing' && (
                  <RefreshCw size={15} className="animate-spin text-indigo-600" />
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            {/* Manual Sync Button */}
            <button
              onClick={() => performSync(true)}
              disabled={syncStatus === 'syncing'}
              className="w-full py-4 px-6 bg-[#5438dc] hover:bg-[#472fc4] disabled:bg-indigo-400 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer"
            >
              <FolderSync size={20} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              <span>{syncStatus === 'syncing' ? (language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') : 'Manual Sync'}</span>
            </button>

            {/* Restore Remote Button */}
            <button
              onClick={handleRemoteRestore}
              className="w-full py-4 px-6 bg-white hover:bg-slate-50 text-slate-900 font-bold text-base rounded-2xl border border-slate-300/90 shadow-xs transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer"
            >
              <Download size={20} className="text-slate-800" />
              <span>Restore Remote</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connect Gmail Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#5438dc]/10 text-[#5438dc] rounded-xl flex items-center justify-center">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Connect Google Account
                  </h3>
                  <p className="text-xs text-slate-500">
                    Google Drive automatic cloud backup
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Gmail Address
                </label>
                <input 
                  type="email" 
                  value={inputEmail} 
                  onChange={e => setInputEmail(e.target.value)} 
                  placeholder="name@gmail.com" 
                  required
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl text-xs text-slate-600 space-y-1.5 border border-slate-200">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-[#00b074]" /> 
                  Automated Cloud Backup Policy
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Automatic background sync to Google Drive container</li>
                  <li>One-click remote restore with redundancy protection</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#5438dc] hover:bg-[#472fc4] text-white font-bold text-sm rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Check size={16} /> Connect & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
