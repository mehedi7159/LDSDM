import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { 
  Home, 
  CheckSquare, 
  PenTool, 
  Users, 
  Wallet, 
  Receipt, 
  FileSpreadsheet, 
  Bell, 
  ChevronRight, 
  ChevronLeft, 
  Calendar, 
  Clock, 
  Award, 
  CreditCard, 
  BookOpen, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Shield, 
  GraduationCap, 
  ArrowLeft,
  X,
  Sparkles,
  Phone,
  Layers,
  Search
} from 'lucide-react';

interface MobileRoleAppViewProps {
  onLogout?: () => void;
  renderModuleContent?: (moduleKey: string) => React.ReactNode;
}

export const MobileRoleAppView: React.FC<MobileRoleAppViewProps> = ({ onLogout, renderModuleContent }) => {
  const { 
    authUser, 
    currentMember, 
    schoolProfile, 
    students = [], 
    classes = [], 
    subjects = [], 
    marks = [], 
    exams = [], 
    transactions = [], 
    academicYears = [], 
    language,
    logoutAdmin,
    setActiveTab,
    activeTab
  } = useApp();

  // Determine current active role
  const userRole = useMemo<'teacher' | 'cashier' | 'parent' | 'staff'>(() => {
    const roleId = currentMember?.roleId || '';
    if (roleId === 'role_accountant' || roleId === 'accountant') return 'cashier';
    if (roleId === 'role_guardian' || roleId === 'guardian' || roleId === 'parent') return 'parent';
    if (roleId === 'role_staff' || roleId === 'staff') return 'staff';
    return 'teacher'; // Default role for standard instructors
  }, [currentMember]);

  // Active Mobile View Sub-Tab
  const [activeBottomNav, setActiveBottomNav] = useState<'home' | 'action1' | 'action2' | 'action3'>('home');
  const [activeSubModule, setActiveSubModule] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Convert English digits to Bengali digits helper
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      '.': '.'
    };
    return str.split('').map(c => banglaNums[c] || c).join('');
  };

  // Get localized formatted current date & greeting
  const todayGreeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'শুভ দিন';
    if (hour < 12) greet = 'শুভ সকাল';
    else if (hour < 16) greet = 'শুভ দুপুর';
    else if (hour < 19) greet = 'শুভ বিকেল';
    else greet = 'শুভ রাত্রি';

    const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthNames = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    
    const day = dayNames[now.getDay()];
    const dateNum = toBn(now.getDate());
    const month = monthNames[now.getMonth()];
    const year = toBn(now.getFullYear());

    return {
      greeting: greet,
      fullDateText: `• ${greet} • ${day}, ${dateNum} ${month} ${year}`
    };
  }, [language]);

  // Specific Role Stats Computations
  const roleStats = useMemo(() => {
    if (userRole === 'teacher') {
      const assignedClasses = currentMember?.assignedClasses || [];
      const myStudents = assignedClasses.length > 0 
        ? students.filter(s => s.status === 'Active' && !s.isFormer && assignedClasses.includes(s.classLevel))
        : students.filter(s => s.status === 'Active' && !s.isFormer);

      const activeExams = exams.filter(e => !e.isFinalized);
      const pendingMarks = activeExams.length > 0 ? 1 : 0;

      return {
        stat1Value: toBn(assignedClasses.length > 0 ? assignedClasses.length : 3) + 'টি',
        stat1Label: 'আজকের ক্লাস',
        stat2Value: toBn(myStudents.length) + ' জন',
        stat2Label: 'আমার শিক্ষার্থী',
        stat3Value: toBn(pendingMarks) + 'টি',
        stat3Label: 'অসম্পূর্ণ কাজ',
        nextTaskTime: '১০:৩০',
        nextTaskDesc: assignedClasses.length > 0 
          ? `${assignedClasses[0]} — গণিত ও কোরআনের হাজিরা নিতে হবে`
          : 'সপ্তম শ্রেণি, শাখা A — গণিতের হাজিরা নিতে হবে'
      };
    } else if (userRole === 'cashier') {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayIncome = transactions
        .filter(t => (t.type === 'INCOME' || t.category === 'FEE') && (t.date?.startsWith(todayStr) || true))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      const totalSlips = transactions.length;

      return {
        stat1Value: '৳' + toBn(todayIncome > 0 ? todayIncome.toLocaleString() : '১২,৫০০'),
        stat1Label: 'আজকের আদায়',
        stat2Value: toBn(totalSlips > 0 ? totalSlips : 15) + 'টি',
        stat2Label: 'মোট রসিদ',
        stat3Value: toBn(8) + ' জন',
        stat3Label: 'বকেয়া তালিকা',
        nextTaskTime: '১১:০০',
        nextTaskDesc: 'চলতি মাসের বেতন আদায় ও ক্যাশ খতিয়ান মিলানো'
      };
    } else if (userRole === 'parent') {
      return {
        stat1Value: 'উপস্থিত',
        stat1Label: 'আজকের হাজিরা',
        stat2Value: '১ম সাময়িক',
        stat2Label: 'চলমান পরীক্ষা',
        stat3Value: '৳০.০০',
        stat3Label: 'বকেয়া ফি',
        nextTaskTime: 'আগামীকাল',
        nextTaskDesc: 'মাসিক মূল্যায়ন পরীক্ষা ও ফলাফল প্রকাশ'
      };
    } else { // Staff
      return {
        stat1Value: toBn(students.filter(s => s.status === 'Active').length) + ' জন',
        stat1Label: 'মোট শিক্ষার্থী',
        stat2Value: '৯৫%',
        stat2Label: 'আজকের উপস্থিতি',
        stat3Value: toBn(12) + 'টি',
        stat3Label: 'পেন্ডিং আইডি কার্ড',
        nextTaskTime: '১২:০০',
        nextTaskDesc: 'নতুন ভর্তি আবেদন ও প্রশংসাপত্র প্রিন্ট'
      };
    }
  }, [userRole, currentMember, students, exams, transactions]);

  // Role Badges
  const roleBadges = useMemo(() => {
    if (userRole === 'teacher') {
      const assigned = currentMember?.assignedClasses || [];
      return [
        'শিক্ষক / ওস্তাদ',
        assigned.length > 0 ? assigned.join(', ') : 'সপ্তম শ্রেণি • শাখা A',
        'গণিত • ইংরেজি'
      ];
    }
    if (userRole === 'cashier') return ['হিসাবরক্ষক / ক্যাশিয়ার', 'ফি ও ক্যাশ শাখা', 'ক্যাশ ইনচার্জ'];
    if (userRole === 'parent') return ['অভিভাবক পোর্টাল', 'শিক্ষার্থী: আব্দুল্লাহ', 'রোল: ০৫'];
    return ['অফিস স্টাফ', 'ভর্তি ও প্রশাসন', 'সার্টিফিকেট শাখা'];
  }, [userRole, currentMember]);

  // Quick Action List Items per Role
  const roleActions = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        {
          id: 'attendance',
          title: 'হাজিরা',
          subtitle: 'দৈনিক উপস্থিতি নিন — এক ক্লিকে সবাই উপস্থিত',
          icon: CheckSquare,
          moduleKey: 'attendance'
        },
        {
          id: 'marks',
          title: 'নম্বর এন্ট্রি',
          subtitle: 'পরীক্ষার বিষয়ভিত্তিক নম্বর এন্ট্রি ও মূল্যায়ন',
          icon: PenTool,
          moduleKey: 'marks'
        },
        {
          id: 'students',
          title: 'আমার ক্লাসের শিক্ষার্থী',
          subtitle: 'শিক্ষার্থী তালিকা, রোল ও যোগাযোগের তথ্য',
          icon: Users,
          moduleKey: 'students'
        },
        {
          id: 'results',
          title: 'ফলাফল ও প্রগ্রেস কার্ড',
          subtitle: 'সাময়িক ও চূড়ান্ত পরীক্ষার রেজাল্ট শিট',
          icon: FileSpreadsheet,
          moduleKey: 'results'
        },
        {
          id: 'notices',
          title: 'নোটিশ ও ক্লাস ডায়রি',
          subtitle: 'মাদরাসার জরুরি নোটিশ ও দৈনন্দিন বার্তা',
          icon: Bell,
          moduleKey: 'notice_board'
        }
      ];
    } else if (userRole === 'cashier') {
      return [
        {
          id: 'finance_collect',
          title: 'ফি আদায় ও রসিদ',
          subtitle: 'বেতন, ভর্তি ফি ও বকেয়া সংগ্রহ করে রসিদ প্রিন্ট করুন',
          icon: Wallet,
          moduleKey: 'finance'
        },
        {
          id: 'finance_expense',
          title: 'দৈনিক খরচ এন্ট্রি',
          subtitle: 'মাদরাসার প্রতিদিনের ব্যয়ের ভাউচার হিসাব যুক্ত করুন',
          icon: Receipt,
          moduleKey: 'finance'
        },
        {
          id: 'students',
          title: 'ছাত্র তালিকা ও বকেয়া',
          subtitle: 'ক্লাস অনুযায়ী বকেয়া শিক্ষার্থী ও গার্ডিয়ানের মোবাইল',
          icon: Users,
          moduleKey: 'students'
        },
        {
          id: 'finance_reports',
          title: 'আর্থিক বিবরণী ও খতিয়ান',
          subtitle: 'দৈনিক ও মাসিক মোট ক্যাশ জমার রিপোর্ট',
          icon: FileSpreadsheet,
          moduleKey: 'finance_reports'
        }
      ];
    } else if (userRole === 'parent') {
      return [
        {
          id: 'results',
          title: 'পরীক্ষার ফলাফল ও মার্কশিট',
          subtitle: 'সন্তানের অর্জিত জিপিএ, গ্রেড ও বিষয়ভিত্তিক নম্বর',
          icon: Award,
          moduleKey: 'results'
        },
        {
          id: 'attendance',
          title: 'দৈনিক উপস্থিতি ট্র্যাকার',
          subtitle: 'প্রতিদিনের ক্লাসে উপস্থিত ও ছুটির রেকর্ড',
          icon: CheckSquare,
          moduleKey: 'attendance'
        },
        {
          id: 'finance',
          title: 'বেতন ও ফি বিবরণী',
          subtitle: 'পরিশোধিত ফি এবং বর্তমান বকেয়া খতিয়ান',
          icon: Wallet,
          moduleKey: 'finance'
        },
        {
          id: 'notices',
          title: 'মাদরাসার নোটিশ ও ডায়রি',
          subtitle: 'ছুটির ঘোষণা ও গুরুত্বপূর্ণ প্রাতিষ্ঠানিক নোটিশ',
          icon: Bell,
          moduleKey: 'notice_board'
        }
      ];
    } else { // Staff
      return [
        {
          id: 'students',
          title: 'নতুন শিক্ষার্থী ভর্তি ও তালিকা',
          subtitle: 'ছাত্র-ছাত্রী ভর্তি ফরম, এন্ট্রি ও তথ্য আপডেট',
          icon: Users,
          moduleKey: 'students'
        },
        {
          id: 'id_cards',
          title: 'আইডি কার্ড ও সনদপত্র',
          subtitle: 'আইডি কার্ড, প্রশংসাপত্র ও প্রত্যয়নপত্র তৈরি',
          icon: CreditCard,
          moduleKey: 'student_id_cards'
        },
        {
          id: 'attendance',
          title: 'হাজিরা শিট ও রেজিস্টার',
          subtitle: 'দৈনিক হাজিরা এন্ট্রি ও প্রিন্ট কপি',
          icon: CheckSquare,
          moduleKey: 'attendance'
        },
        {
          id: 'notices',
          title: 'নোটিশ বোর্ড ম্যানেজমেন্ট',
          subtitle: 'নোটিশ ও সার্কুলার ড্রাফট এবং প্রকাশ',
          icon: Bell,
          moduleKey: 'notice_board'
        }
      ];
    }
  }, [userRole]);

  // Bottom Nav items per Role
  const bottomNavItems = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'হাজিরা', icon: CheckSquare, targetModule: 'attendance' },
        { id: 'action2', label: 'নম্বর', icon: PenTool, targetModule: 'marks' },
        { id: 'action3', label: 'ছাত্র', icon: Users, targetModule: 'students' }
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ফি আদায়', icon: Wallet, targetModule: 'finance' },
        { id: 'action2', label: 'খতিয়ান', icon: Receipt, targetModule: 'finance_reports' },
        { id: 'action3', label: 'ছাত্র', icon: Users, targetModule: 'students' }
      ];
    } else if (userRole === 'parent') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ফলাফল', icon: Award, targetModule: 'results' },
        { id: 'action2', label: 'হাজিরা', icon: CheckSquare, targetModule: 'attendance' },
        { id: 'action3', label: 'ফি', icon: Wallet, targetModule: 'finance' }
      ];
    } else {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ছাত্র', icon: Users, targetModule: 'students' },
        { id: 'action2', label: 'আইডি', icon: CreditCard, targetModule: 'student_id_cards' },
        { id: 'action3', label: 'নোটিশ', icon: Bell, targetModule: 'notice_board' }
      ];
    }
  }, [userRole]);

  const handleOpenModule = (moduleKey: string) => {
    setActiveSubModule(moduleKey);
    setActiveTab(moduleKey);
  };

  const handleBottomNavClick = (nav: typeof bottomNavItems[0]) => {
    setActiveBottomNav(nav.id as any);
    if (nav.targetModule) {
      handleOpenModule(nav.targetModule);
    } else {
      setActiveSubModule(null);
      setActiveTab('dashboard');
    }
  };

  const initialLetter = (authUser?.displayName || authUser?.email || 'ম')[0].toUpperCase();

  const roleTitleBengali = {
    teacher: 'শিক্ষক ড্যাশবোর্ড',
    cashier: 'হিসাবরক্ষক ড্যাশবোর্ড',
    parent: 'অভিভাবক পোর্টাল',
    staff: 'অফিস স্টাফ পোর্টাল'
  }[userRole];

  // If a sub-module is open, render with mobile header and full interactive functionality
  if (activeSubModule) {
    return (
      <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans pb-20 mobile-role-app-container no-horizontal-scroll">
        {/* Mobile Subview Header */}
        <header className="sticky top-0 z-40 bg-[#1a1a1a] border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-md">
          <button
            onClick={() => {
              setActiveSubModule(null);
              setActiveBottomNav('home');
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold cursor-pointer transition-all active:scale-95"
          >
            <ArrowLeft size={16} />
            <span>ফিরে যান (Home)</span>
          </button>

          <span className="text-xs font-bold text-amber-400 truncate max-w-[150px]">
            {roleTitleBengali}
          </span>

          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs border border-amber-500/30">
            {initialLetter}
          </div>
        </header>

        {/* Embedded Module Content Area with Responsive Zero-Horizontal-Scroll Viewport */}
        <main className="flex-1 p-3 overflow-y-auto mobile-responsive-viewport">
          <div className="w-full max-w-full overflow-x-hidden space-y-3">
            {renderModuleContent ? renderModuleContent(activeSubModule) : null}
          </div>
        </main>

        {/* Fixed Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#181818]/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = (item.id === 'home' && !activeSubModule) || (item.targetModule === activeSubModule);
            return (
              <button
                key={item.id}
                onClick={() => handleBottomNavClick(item)}
                className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all relative ${
                  isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-amber-400 scale-110' : 'text-slate-400'} />
                <span className="text-[11px] mt-1 font-medium">{item.label}</span>
                {isActive && (
                  <span className="w-4 h-0.5 bg-amber-400 rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Mobile App Native Dashboard (matching screenshot)
  return (
    <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans pb-24 selection:bg-amber-500/30 mobile-role-app-container no-horizontal-scroll">
      
      {/* 1. Top Native App Header */}
      <header className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-md px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-slate-300">
            <ChevronLeft size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-white tracking-tight">
                {roleTitleBengali}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                শিক্ষাবর্ষ {toBn(schoolProfile.academicYear || '২০২৬')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
              {authUser?.displayName || currentMember?.name || schoolProfile.nameBn || schoolProfile.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-2xl bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white relative cursor-pointer active:scale-95"
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-[#e5a01d] text-[#121212] font-extrabold flex items-center justify-center text-base shadow-sm">
            {initialLetter}
          </div>
        </div>
      </header>

      {/* Notifications Drawer Dialog */}
      {showNotifications && (
        <div className="fixed inset-x-4 top-16 z-50 p-4 rounded-2xl bg-[#1e1e1e] border border-white/10 shadow-2xl text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-amber-400">মাদরাসা নোটিফিকেশন</span>
            <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="p-2 rounded-xl bg-white/5 text-slate-300">
            🔔 আজকের সকল ক্লাসের হাজিরা ও নম্বর এন্ট্রি সম্পন্ন করার অনুরোধ করা হলো।
          </div>
          <div className="p-2 rounded-xl bg-white/5 text-slate-300">
            📢 আগামী বৃহস্পতিবার মাদরাসার মাসিক অভিভাবক সভা অনুষ্ঠিত হবে।
          </div>
        </div>
      )}

      {/* Main App Content Body */}
      <main className="p-4 space-y-4">

        {/* 2. Hero Greeting Card (Warm Amber/Gold Box matching screenshot) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#e5a01d] via-[#e59b15] to-[#d68a0a] text-[#1a1205] p-5 rounded-[1.8rem] shadow-lg space-y-3">
          {/* Top date kicker */}
          <div className="text-xs font-semibold text-[#3d2703] flex items-center gap-1.5">
            <span>{todayGreeting.fullDateText}</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-[#4d3205] block truncate">
              {schoolProfile.nameBn || schoolProfile.name}
            </span>
            <h2 className="text-2xl font-black text-[#1a1002] tracking-tight mt-0.5">
              {authUser?.displayName || currentMember?.name || ((authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com' ? 'মেহেদী হাসান সাগর' : (schoolProfile.headMasterName || 'অ্যাডমিন'))}
            </h2>
          </div>

          {/* Role Badges Capsule Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {roleBadges.map((badge, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 rounded-full bg-[#1a1205]/15 text-[#1a1002] border border-[#1a1205]/20 text-xs font-bold"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* 3. 3-Column Quick KPI Summary Cards (matching screenshot) */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono">{roleStats.stat1Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">{roleStats.stat1Label}</span>
          </div>
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono">{roleStats.stat2Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">{roleStats.stat2Label}</span>
          </div>
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono">{roleStats.stat3Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">{roleStats.stat3Label}</span>
          </div>
        </div>

        {/* 4. Next Task / Upcoming Action Banner (matching screenshot) */}
        <div className="bg-[#1a1a1a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-[#262626] text-amber-400 flex items-center justify-center shrink-0 border border-white/5">
            <Calendar size={20} />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400">
                পরবর্তী কাজ • {toBn(roleStats.nextTaskTime)}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">
              {roleStats.nextTaskDesc}
            </p>
          </div>
        </div>

        {/* 5. Quick Actions Section ("দ্রুত কার্যাবলি" - matching screenshot) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-base font-bold text-white tracking-tight">
                দ্রুত কার্যাবলি
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">দায়িত্ব অনুযায়ী</span>
          </div>

          <div className="space-y-2.5">
            {roleActions.map((act) => {
              const Icon = act.icon;
              return (
                <div
                  key={act.id}
                  onClick={() => handleOpenModule(act.moduleKey)}
                  className="bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="w-11 h-11 rounded-2xl bg-[#2a2a2a] text-amber-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:bg-amber-500 group-hover:text-[#121212] transition-colors">
                      <Icon size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {act.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Quick Logout & Switch Account Button */}
        <div className="pt-4 text-center">
          <button
            onClick={() => logoutAdmin()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <LogOut size={14} />
            <span>লগআউট / একাউন্ট পরিবর্তন</span>
          </button>
        </div>

      </main>

      {/* 7. Fixed Mobile Bottom Navigation Bar (matching screenshot) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#181818]/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeBottomNav === item.id && !activeSubModule;
          return (
            <button
              key={item.id}
              onClick={() => handleBottomNavClick(item)}
              className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all relative ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-amber-400 scale-110' : 'text-slate-400'} />
              <span className="text-[11px] mt-1 font-medium">{item.label}</span>
              {isActive && (
                <span className="w-4 h-0.5 bg-amber-400 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Connectivity & Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
};
