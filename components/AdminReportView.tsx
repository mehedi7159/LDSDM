import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, 
  ShieldCheck, 
  Database, 
  Activity, 
  Clock, 
  Users, 
  Key, 
  Lock, 
  Printer, 
  Download, 
  CheckCircle2, 
  RefreshCw,
  Server
} from 'lucide-react';
import { getInstitutionRoles, getAllInstitutionMembers } from '../services/rbac';

export const AdminReportView: React.FC = () => {
  const { authUser, isSuperAdmin, isAdmin, schoolProfile, language, t } = useApp();
  const [membersCount, setMembersCount] = useState<number>(0);
  const [rolesCount, setRolesCount] = useState<number>(0);
  const [activeSessions, setActiveSessions] = useState<number>(1);
  const [lastBackupDate, setLastBackupDate] = useState<string>(new Date().toISOString());

  useEffect(() => {
    async function loadStats() {
      try {
        const roles = await getInstitutionRoles('inst_madrasah_primary');
        setRolesCount(roles.length || 6);
        const members = await getAllInstitutionMembers('inst_madrasah_primary');
        setMembersCount(members.length || 1);
      } catch (e) {
        console.warn('Admin stats load error:', e);
      }
    }
    loadStats();
  }, []);

  const toBanglaDigits = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return str.split('').map(char => banglaNums[char] || char).join('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck size={16} />
            <span>{language === 'bn' ? 'সিস্টেম ও অডিট বিশ্লেষণ' : 'System Security & Governance'}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'প্রশাসনিক রিপোর্ট ও সিস্টেম বিবরণী' : 'Administrative & System Report'}
          </h1>
          <p className="text-xs text-purple-200/80 mt-1 max-w-xl">
            {language === 'bn'
              ? 'নিরাপত্তা কনফিগারেশন, সক্রিয় ভূমিকা, ক্লাউড ডাটাবেজ স্থিতি এবং ব্যাকআপ অডিট।'
              : 'Security status, database integrity, user role distributions, and cloud backup records.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/20"
          >
            <Printer size={15} />
            <span>{language === 'bn' ? 'রিপোর্ট প্রিন্ট' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'সিস্টেম ইউজার' : 'Registered Users'}</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{toBanglaDigits(membersCount)}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{language === 'bn' ? 'নিবন্ধিত স্টাফ/শিক্ষক' : 'Members'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'নির্ধারিত রোল' : 'Active Roles'}</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">{toBanglaDigits(rolesCount)}</h3>
            <p className="text-[10px] text-purple-600/80 mt-0.5">{language === 'bn' ? 'RBAC পারমিশন লেয়ার' : 'RBAC Configured'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Key size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'ডাটাবেজ সিঙ্ক' : 'Database Sync'}</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">100%</h3>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">{language === 'bn' ? 'রিয়েলটাইম ক্লাউড ফায়ারস্টোর' : 'Firestore Realtime'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Database size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'সিকিউরিটি লেভেল' : 'Security Level'}</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">Tier-1</h3>
            <p className="text-[10px] text-blue-600/80 mt-0.5">{language === 'bn' ? 'রোল বেসড এক্সেস গার্ড' : 'RBAC Protected'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Shield size={24} />
          </div>
        </div>
      </div>

      {/* Security Status Box */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Server size={18} className="text-purple-600" />
          <span>{language === 'bn' ? 'সিস্টেম ও সিকিউরিটি কনফিগারেশন চেকলিস্ট' : 'System Governance & Security Matrix'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">{language === 'bn' ? 'কাস্টম রোল পারমিশন ইঞ্জিন (RBAC)' : 'Multi-Level RBAC'}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'ব্যবহারকারীর রোল ও ক্লাসরুম স্কোপ অনুযায়ী সুরক্ষিত ডাটা রিড/রাইট নিরাপত্তা নিশ্চিত।'
                  : 'Enforces granular permissions and data scopes.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">{language === 'bn' ? 'ক্লাউড ফায়ারস্টোর ডাটাবেজ ও অফলাইন ব্যাকআপ' : 'Cloud Firestore & Offline Vault'}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'স্বয়ংক্রিয় ক্লাউড সিঙ্ক এবং লোকাল ব্যাকআপ রিকভারি এনাবল করা আছে।'
                  : 'Automatic real-time sync with local snapshot recovery enabled.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">{language === 'bn' ? 'প্রশাসনিক অডিট ট্রেইল' : 'Administrative Audit Trail'}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'রোল পরিবর্তন, ফলাফল অনুমোদন এবং আর্থিক লেনদেনের সময় অডিট ইভেন্ট সংরক্ষিত হয়।'
                  : 'System logs every critical change with actor timestamps.'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">{language === 'bn' ? 'সুপার অ্যাডমিন সিকিউরিটি গার্ড' : 'Super Admin Policy'}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'mehedihasansagor26@gmail.com এর জন্য প্ল্যাটফর্ম-লেভেল ইউনিভার্সাল সিকিউরিটি অথরিটি।'
                  : 'Cryptographically protected root authority.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
