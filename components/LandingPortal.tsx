import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, 
  Search, 
  LogIn, 
  ShieldCheck, 
  Users, 
  BookOpen, 
  Wallet, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Smartphone,
  Globe,
  Award,
  PhoneCall,
  Lock,
  ChevronRight
} from 'lucide-react';

interface LandingPortalProps {
  onOpenResultSearch: () => void;
  onOpenLogin: () => void;
}

export const LandingPortal: React.FC<LandingPortalProps> = ({ onOpenResultSearch, onOpenLogin }) => {
  const { schoolProfile, students, classes, exams, currentUser, userRole, logoutUser } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-700/20">
              ম
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h1>
              <p className="text-[11px] font-medium text-slate-500 flex items-center gap-2">
                <span>বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড অনুমোদিত</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>দাখিল ও ইবতেদায়ী শাখা</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hidden sm:inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>{currentUser.nameBn || currentUser.name} ({currentUser.role})</span>
                </span>
                <button
                  onClick={onOpenLogin}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <span>ড্যাশবোর্ড প্রবেশ</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-4 sm:px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-bold shadow-sm cursor-pointer transition-all flex items-center gap-2"
              >
                <LogIn size={15} />
                <span>পোর্টাল লগইন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        
        {/* Main Banner */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/70 text-emerald-900 border border-emerald-300/60 text-xs font-bold shadow-2xs">
            <Sparkles size={14} className="text-emerald-700 animate-pulse" />
            <span>ডিজিটাল মাদ্রাসা ম্যানেজমেন্ট ও ফলাফল পোর্টাল</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            সহজ, আধুনিক ও নির্ভরযোগ্য <br />
            <span className="text-emerald-700">দাখিল মাদ্রাসা অ্যাকাডেমিক সিস্টেম</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            শিক্ষার্থী ও অভিভাবকদের জন্য এক ক্লিকে ফলাফল অনুসন্ধান, এবং মুয়াল্লিম ও স্টাফদের জন্য সম্পূর্ণ ক্লাউডভিত্তিক মোবাইল-ফ্রেন্ডলি ম্যানেজমেন্ট সিস্টেম।
          </p>
        </div>

        {/* 2 Primary Core Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          
          {/* Card 1: Public Result Search */}
          <div 
            onClick={onOpenResultSearch}
            className="group bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-7 sm:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <GraduationCap size={160} />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-inner">
                <Search size={26} className="text-emerald-300" />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">সবার জন্য উন্মুক্ত</span>
                <h3 className="text-2xl font-black tracking-tight text-white mt-0.5">
                  অনলাইন রেজাল্ট ও ট্রান্সক্রিপ্ট
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                কোনো লগইনের প্রয়োজন নেই! শিক্ষার্থীর রোল নম্বর অথবা আইডি দিয়ে যেকোনো পরীক্ষার মার্কশিট, জিপিএ ও গ্রেডশিট দেখুন এবং ডাউনলোড করুন।
              </p>
            </div>

            <div className="pt-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-emerald-950 text-xs font-bold shadow-md group-hover:bg-emerald-50 transition-colors">
                <span>ফলাফল দেখুন এখনই</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card 2: Role Based Portal Login */}
          <div 
            onClick={onOpenLogin}
            className="group bg-white rounded-3xl p-7 sm:p-8 shadow-lg border border-slate-200 hover:border-slate-300 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-13 h-13 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                <Lock size={26} className="text-emerald-400" />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">স্টাফ, শিক্ষক ও অভিভাবক</span>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                  মাদ্রাসা পোর্টাল লগইন
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Gmail অথবা মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন। শিক্ষক, হিসাবরক্ষক, অফিস স্টাফ এবং অভিভাবকদের জন্য পৃথক আধুনিক মোবাইল ভিউ।
              </p>

              {/* Role Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">মুহতামিম / অ্যাডমিন</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">মুয়াল্লিম (শিক্ষক)</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold">হিসাবরক্ষক</span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-[11px] font-bold">অভিভাবক</span>
              </div>
            </div>

            <div className="pt-6">
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-md group-hover:bg-slate-800 transition-colors">
                <span>পোর্টালে প্রবেশ করুন</span>
                <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto pt-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900">দাখিল ও ইবতেদায়ী কারিকুলাম</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              কুরআন, হাদিস, আরবি ১ম ও ২য়, তাজবীদ, ফিকহ সহ CQ, MCQ ও ব্যবহারিক সমন্বিত গ্রেডিং।
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Smartphone size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900">মোবাইল-ফার্স্ট স্মার্ট ভিউ</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              শিক্ষক ও অভিভাবকদের জন্য সম্পূর্ণ স্মার্টফোন উপযোগী ঝকঝকে অ্যাপ ইন্টারফেস।
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900">হিসাব ও বেতন আদায়</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              ছাত্র বেতন রসিদ, উস্তাদদের হাদিয়া, সাধারণ ও যাকাত ফান্ড এবং ভাউচার প্রিন্ট।
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Globe size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-900">লাইভ ক্লাউড সুরক্ষা</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Google Firebase ক্লাউডে সংরক্ষিত—মোবাইল বা পিসি নষ্ট হলেও ডাটা কখনো হারাবে না।
            </p>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <div className="flex items-center justify-center gap-2 font-bold text-slate-800 text-sm">
            <span>{schoolProfile.nameBn || schoolProfile.name}</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            {schoolProfile.address} | যোগাযোগ: {schoolProfile.phone} | ইমেইল: {schoolProfile.email}
          </p>
          <p className="text-slate-400 text-[10px] pt-1">
            © {new Date().getFullYear()} Madrasah Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
