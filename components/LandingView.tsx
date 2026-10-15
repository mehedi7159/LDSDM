import React from 'react';
import { 
  Award, 
  LogIn, 
  Building2, 
  Search, 
  Shield, 
  CheckCircle2, 
  ChevronRight, 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  ArrowRight,
  Sparkles,
  Users,
  User,
  FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { NoticeBoardAlertBanner } from './NoticeBoard';

interface LandingViewProps {
  onViewResults?: () => void;
  onAdminLogin?: () => void;
  onStudentProfile?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ 
  onViewResults, 
  onAdminLogin,
  onStudentProfile 
}) => {
  const { 
    schoolProfile, 
    language, 
    setLanguage,
    exams = []
  } = useApp();

  // Convert digits to Bengali if Bengali language is active
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const bnDigits: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
    };
    return str.split('').map(c => bnDigits[c] || c).join('');
  };

  const academicYear = schoolProfile.academicYear || '২০২৬';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-indigo-600/15 via-emerald-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* 1. Header / Navbar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-3 sm:px-8 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-base text-white tracking-tight leading-tight truncate">
              {schoolProfile.nameBn || schoolProfile.name}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              {schoolProfile.addressBn || schoolProfile.address || 'স্মার্ট মাদ্রাসা ও শিক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {onStudentProfile && (
            <button
              onClick={onStudentProfile}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 flex items-center gap-1 sm:gap-1.5 transition cursor-pointer"
            >
              <GraduationCap size={14} />
              <span className="hidden sm:inline">{language === 'bn' ? 'শিক্ষার্থী পোর্টাল' : 'Student Portal'}</span>
              <span className="sm:hidden">{language === 'bn' ? 'পোর্টাল' : 'Portal'}</span>
            </button>
          )}

          <PWAInstallButton />

          <button
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            {language === 'bn' ? 'EN' : 'বাং'}
          </button>
        </div>
      </header>

      {/* 1.5 Urgent Announcements & Live Notice Marquee */}
      <div className="relative z-20 max-w-5xl mx-auto w-full px-4 pt-3">
        <NoticeBoardAlertBanner />
      </div>

      {/* 2. Main Hero & Prominent Choices */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 my-auto">
        <div className="w-full max-w-4xl mx-auto space-y-8 sm:space-y-10 animate-in fade-in duration-300">
          
          {/* Hero Intro */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 text-xs font-medium shadow-sm">
              <Sparkles size={13} className="text-amber-400" />
              <span>{language === 'bn' ? 'মাদ্রাসার উন্মুক্ত পাবলিক পোর্টাল' : 'Public Institutional Portal'}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">
                {language === 'bn' ? `শিক্ষাবর্ষ ${toBn(academicYear)}` : `Session ${academicYear}`}
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight text-balance">
              {schoolProfile.nameBn || schoolProfile.name}
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
              {language === 'bn' 
                ? 'শিক্ষার্থী ও অভিভাবকগণের জন্য সরাসরি পরীক্ষার ফলাফল অনুসন্ধান এবং শিক্ষক ও কর্মকর্তা-কর্মচারীদের জন্য প্রাতিষ্ঠানিক অ্যাডমিন লগইন।'
                : 'Direct online exam result lookup for students & guardians, and secure administrative login for faculty and staff.'}
            </p>
          </div>

          {/* THREE PROMINENT ACTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            
            {/* CARD 1: STUDENT PROFILE PORTAL */}
            <div 
              onClick={onStudentProfile}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStudentProfile?.(); }}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-3xl p-6 sm:p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/40 cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md shadow-indigo-950/30">
                    <GraduationCap size={28} />
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-400/90 bg-indigo-950/50 border border-indigo-800/60 px-2.5 py-1 rounded-full">
                    {language === 'bn' ? 'শিক্ষার্থী পোর্টাল' : 'Student Portal'}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
                    <span>{language === 'bn' ? 'শিক্ষার্থী প্রোফাইল' : 'Student Profile'}</span>
                    <ChevronRight size={20} className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'bn'
                      ? 'স্টুডেন্ট আইডি দিয়ে লগইন করে নিজের সম্পূর্ণ হাজিরা খতিয়ান, বিষয়ভিত্তিক নম্বর ও আসন্ন পরীক্ষার রুটিন দেখুন।'
                      : 'Log in with your Student ID to view your attendance history, marks, and upcoming exam schedules.'}
                  </p>
                </div>

                {/* Key Points */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
                    <span>{language === 'bn' ? 'মাসভিত্তিক দিনওয়ারি হাজিরা খতিয়ান' : 'Daily & monthly attendance log'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
                    <span>{language === 'bn' ? 'বিষয়ভিত্তিক নম্বর ও জিপিএ মূল্যায়ন' : 'Subject marks & GPA breakdown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
                    <span>{language === 'bn' ? 'আসন্ন পরীক্ষার রুটিন ও সিডিউল' : 'Upcoming exam routine & countdown'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStudentProfile?.(); }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:shadow-indigo-600/30"
                >
                  <User size={16} />
                  <span>{language === 'bn' ? 'আইডি দিয়ে প্রবেশ করুন' : 'Sign In With Student ID'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* CARD 2: VIEW RESULTS */}
            <div 
              onClick={onViewResults}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onViewResults?.(); }}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-3xl p-6 sm:p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-950/40 cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md shadow-emerald-950/30">
                    <Award size={28} />
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400/90 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1 rounded-full">
                    {language === 'bn' ? 'পাবলিক এক্সেস' : 'Public Access'}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                    <span>{language === 'bn' ? 'ফলাফল দেখুন' : 'View Results'}</span>
                    <ChevronRight size={20} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'bn'
                      ? 'পরীক্ষার রোল নম্বর বা আইডি দিয়ে বিষয়ভিত্তিক নম্বর, জিপিএ এবং পূর্ণাঙ্গ ডিজিটাল মার্কশিট অনুসন্ধান করুন।'
                      : 'Look up student examination results, subject-wise marks, GPA, and generate printable marksheets.'}
                  </p>
                </div>

                {/* Key Points */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>{language === 'bn' ? 'লগইন ছাড়াই সরাসরি ফলাফল অনুসন্ধান' : 'No account login required'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>{language === 'bn' ? 'ডিজিটাল মার্কশিট ও ফলাফল প্রিন্ট' : 'Download and print marksheets'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>{language === 'bn' ? 'কিউআর কোড ভেরিফিকেশন সুবিধা' : 'QR code result verification'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onViewResults?.(); }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:shadow-emerald-600/30"
                >
                  <Search size={16} />
                  <span>{language === 'bn' ? 'ফলাফল অনুসন্ধান' : 'Search Exam Results'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* CARD 3: ADMIN & STAFF LOGIN */}
            <div 
              onClick={onAdminLogin}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAdminLogin?.(); }}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-3xl p-6 sm:p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-950/40 cursor-pointer flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-md shadow-blue-950/30">
                    <LogIn size={28} />
                  </div>
                  <span className="text-[11px] font-semibold text-blue-400/90 bg-blue-950/50 border border-blue-800/60 px-2.5 py-1 rounded-full">
                    {language === 'bn' ? 'অফিসিয়াল' : 'Staff Portal'}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-blue-400 transition-colors flex items-center justify-between">
                    <span>{language === 'bn' ? 'অ্যাডমিন লগইন' : 'Admin Login'}</span>
                    <ChevronRight size={20} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'bn'
                      ? 'মুহতামিম, শিক্ষক, হিসাবরক্ষক ও অফিস স্টাফদের জন্য ক্লাসরুম ম্যানেজমেন্ট ও নিয়ন্ত্রণ ড্যাশবোর্ড।'
                      : 'Authorized portal for Principal, Teachers, Accountant, and Office Staff to manage students and marks.'}
                  </p>
                </div>

                {/* Key Points */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                    <span>{language === 'bn' ? 'রোল-ভিত্তিক সিকিউর লগইন সিস্টেম' : 'Role-based access & permissions'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                    <span>{language === 'bn' ? 'মার্কস এন্ট্রি, হাজিরা ও হিসাব খতিয়ান' : 'Grade entry, attendance & finance'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                    <span>{language === 'bn' ? 'ক্লাউড ও লোকাল ডাটা ব্যাকআপ' : 'Cloud and local backup system'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAdminLogin?.(); }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer group-hover:shadow-blue-600/30"
                >
                  <Shield size={16} />
                  <span>{language === 'bn' ? 'অ্যাডমিন প্রবেশ' : 'Sign In to Portal'}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

          </div>

          {/* Quick Informational Notice */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-indigo-400" />
              <span>
                {language === 'bn' ? 'বর্তমান সক্রিয় সেশন: ' : 'Active Academic Session: '}
                <strong className="text-slate-200">{toBn(academicYear)}</strong>
              </span>
            </div>
            <div>
              {language === 'bn' 
                ? 'যেকোনো সহায়তার জন্য মাদ্রাসার অফিসে যোগাযোগ করুন।' 
                : 'For technical support, contact the administrative office.'}
            </div>
          </div>

        </div>
      </main>

      {/* 3. Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/80 py-3.5 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} {schoolProfile.nameBn || schoolProfile.name}. {language === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
      </footer>

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
};
