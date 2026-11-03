import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  GraduationCap, 
  UserCheck, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  Megaphone, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Sparkles, 
  FileSpreadsheet, 
  CreditCard, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  Building2, 
  History, 
  ShieldCheck,
  Receipt,
  UserPlus,
  PenTool,
  AlertTriangle,
  BookOpen,
  Settings as SettingsIcon
} from 'lucide-react';
import { formatSafeDate, formatSafeTime } from '../services/utils';
import { dailyAttendanceService, summarizeStudentRecords } from '../services/dailyAttendanceService';
import { CountUpNumber } from './ui/StatCard';
import { PageHeader } from './ui/PageHeader';
import { SectionCard } from './ui/SectionCard';
import { ProgressBar } from './ui/ProgressBar';

// Helper to convert English digits to Bengali
const toBanglaDigits = (num: number | string | undefined | null, language: string = 'bn') => {
  if (num === undefined || num === null || num === '') return '০';
  const str = String(num);
  if (language !== 'bn') return str;
  const banglaNums: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
    '.': '.'
  };
  return str.split('').map(char => banglaNums[char] || char).join('');
};

interface DashboardDailyOverviewProps {
  onNavigate: (tab: string) => void;
  selectedAcademicYear: string;
  onSelectAcademicYear?: (year: string) => void;
  academicYears?: Array<{ id: string; name: string; isCurrent: boolean }>;
  selectedExamId?: string;
  onSelectExamId?: (examId: string) => void;
  yearExams?: Array<{ id: string; name: string; nameBn?: string }>;
  onOpenRecoveryModal?: () => void;
  /**
   * 'hero' renders only the brand PageHeader; 'stats' renders only the
   * sections below it; 'all' (default) renders the full legacy composition.
   * The dashboard splits hero/stats so the Overview / Action-&-Advice view
   * switcher can sit directly under the hero.
   */
  section?: 'all' | 'hero' | 'stats';
}

export const DashboardDailyOverview: React.FC<DashboardDailyOverviewProps> = ({
  onNavigate,
  selectedAcademicYear = '2026',
  onSelectAcademicYear,
  academicYears = [],
  selectedExamId,
  onSelectExamId,
  yearExams = [],
  onOpenRecoveryModal,
  section = 'all'
}) => {
  const showHero = section !== 'stats';
  const showStats = section !== 'hero';
  const { 
    schoolProfile, 
    students = [], 
    teachers = [], 
    users = [], 
    classes = [], 
    exams = [], 
    remarks = [], 
    transactions = [], 
    feeStructures = [], 
    notices = [], 
    dailyStudentAttendance = [],
    cloudStatus, 
    language = 'bn' 
  } = useApp();

  const isBn = language === 'bn';

  // Quick-action tiles rendered inside the brand hero — the same targets
  // as the former standalone Quick Launchpad (unified here in Phase 3).
  const heroActions = [
    { id: 'students', labelBn: 'শিক্ষার্থী ভর্তি', labelEn: 'Student Roster', icon: Users },
    { id: 'promotion', labelBn: 'শ্রেণি প্রমোশন', labelEn: 'Class Advance', icon: GraduationCap },
    { id: 'marks', labelBn: 'নম্বর এন্ট্রি', labelEn: 'Marks Entry', icon: PenTool },
    { id: 'results', labelBn: 'ফলাফল কার্ড', labelEn: 'Report Cards', icon: FileSpreadsheet },
    { id: 'attendance', labelBn: 'দৈনিক হাজিরা', labelEn: 'Attendance', icon: UserCheck },
    { id: 'notice_board', labelBn: 'নোটিশ বোর্ড', labelEn: 'Notice Board', icon: Megaphone },
    { id: 'finance', labelBn: 'ফি আদায়', labelEn: 'Fee Collection', icon: Wallet },
    { id: 'subjects', labelBn: 'বিষয় বণ্টন', labelEn: 'Subject Setup', icon: BookOpen },
    { id: 'settings', labelBn: 'সিস্টেম সেটিংস', labelEn: 'Settings', icon: SettingsIcon }
  ];

  // Current Date formatting
  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const currentMonthStr = useMemo(() => {
    return todayDateStr.slice(0, 7); // 'YYYY-MM'
  }, [todayDateStr]);

  // Today display string in Bengali / English
  const formattedToday = useMemo(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString(isBn ? 'bn-BD' : 'en-US', options);
  }, [isBn]);

  // 1. Student Census & Demographics
  const studentMetrics = useMemo(() => {
    const activeStudents = students.filter(s => s && s.status === 'Active' && !s.isFormer);
    const inactiveStudents = students.filter(s => s && (s.status === 'Inactive' || s.isFormer));
    const maleCount = activeStudents.filter(s => s.gender === 'Male' || s.gender === 'male').length;
    const femaleCount = activeStudents.filter(s => s.gender === 'Female' || s.gender === 'female').length;

    return {
      total: students.length,
      active: activeStudents.length,
      inactive: inactiveStudents.length,
      male: maleCount,
      female: femaleCount
    };
  }, [students]);

  // 2. Staff & Faculty Metrics
  const staffMetrics = useMemo(() => {
    const totalTeachers = teachers.length > 0 ? teachers.length : users.filter(u => u.role === 'teacher').length;
    const totalStaff = users.length > 0 ? users.length : totalTeachers;
    const teacherStudentRatio = totalTeachers > 0 
      ? Math.round(studentMetrics.active / totalTeachers) 
      : 0;

    return {
      teachersCount: totalTeachers,
      totalStaff,
      ratio: teacherStudentRatio
    };
  }, [teachers, users, studentMetrics.active]);

  // 3. Today's Attendance Pulse — LIVE REACTIVE DATA from context + service
  const attendanceMetrics = useMemo(() => {
    const utcToday = new Date().toISOString().split('T')[0];
    const liveDaySummary = summarizeStudentRecords(dailyStudentAttendance, todayDateStr);
    const fallbackSummary = liveDaySummary.totalStudents === 0 && utcToday !== todayDateStr
      ? summarizeStudentRecords(dailyStudentAttendance, utcToday)
      : liveDaySummary;

    const summary = fallbackSummary.totalStudents > 0 
      ? fallbackSummary 
      : dailyAttendanceService.getDaySummary(todayDateStr);
    const recorded = summary.totalStudents;

    if (recorded === 0) {
      return { present: null, absent: null, rate: null, recorded: 0, isRecorded: false };
    }

    const presentCount = summary.presentCount + summary.lateCount;
    const absentCount = summary.absentCount + summary.leaveCount;
    const attendanceRate = (presentCount / recorded * 100).toFixed(1);

    return {
      present: presentCount,
      absent: absentCount,
      rate: attendanceRate,
      recorded,
      isRecorded: true
    };
  }, [dailyStudentAttendance, todayDateStr]);

  // 4. Today's Income & Expense (Cash Flow)
  const todayCashFlow = useMemo(() => {
    let todayIncome = 0;
    let todayExpense = 0;
    let todayCount = 0;

    transactions.forEach(t => {
      const txDate = t.date ? String(t.date).slice(0, 10) : '';
      if (txDate === todayDateStr) {
        todayCount++;
        const amt = Number(t.amount) || 0;
        const type = (t.type || '').toUpperCase();
        if (type === 'INCOME') {
          todayIncome += amt;
        } else if (type === 'EXPENSE') {
          todayExpense += amt;
        }
      }
    });

    // If today is early or no transactions recorded today, also show month-to-date context
    let monthIncome = 0;
    let monthExpense = 0;
    transactions.forEach(t => {
      const txDate = t.date ? String(t.date).slice(0, 7) : '';
      if (txDate === currentMonthStr) {
        const amt = Number(t.amount) || 0;
        const type = (t.type || '').toUpperCase();
        if (type === 'INCOME') {
          monthIncome += amt;
        } else if (type === 'EXPENSE') {
          monthExpense += amt;
        }
      }
    });

    return {
      todayIncome,
      todayExpense,
      todayNet: todayIncome - todayExpense,
      todayCount,
      monthIncome,
      monthExpense
    };
  }, [transactions, todayDateStr, currentMonthStr]);

  // 5. Due Fees & Collection Status
  const feeDuesMetrics = useMemo(() => {
    // Compute total expected tuition per month across active students
    let monthlyExpectedTuition = 0;
    const activeStudents = students.filter(s => s && s.status === 'Active' && !s.isFormer);

    activeStudents.forEach(s => {
      if (s.monthlyFee !== undefined && s.monthlyFee !== null) {
        monthlyExpectedTuition += Number(s.monthlyFee) || 0;
      } else {
        const classStructure = feeStructures.find(f => f.classLevel === s.classLevel);
        if (classStructure && classStructure.monthlyTuition) {
          monthlyExpectedTuition += Number(classStructure.monthlyTuition) || 0;
        }
        // No override and no class fee structure: expected is 0 — aligned
        // with services/studentDuesService so every surface shows one figure.
      }
    });

    // Total collected this month from student fees
    let collectedThisMonth = 0;
    transactions.forEach(t => {
      const txMonth = t.date ? String(t.date).slice(0, 7) : '';
      if (txMonth === currentMonthStr && (t.type || '').toUpperCase() === 'INCOME') {
        collectedThisMonth += Number(t.amount) || 0;
      }
    });

    const pendingDues = Math.max(0, monthlyExpectedTuition - collectedThisMonth);
    const collectionPercentage = monthlyExpectedTuition > 0 
      ? Math.min(100, Math.round((collectedThisMonth / monthlyExpectedTuition) * 100)) 
      : 100;

    return {
      expected: monthlyExpectedTuition,
      collected: collectedThisMonth,
      dues: pendingDues,
      rate: collectionPercentage
    };
  }, [students, feeStructures, transactions, currentMonthStr]);

  // 6. Upcoming Exams & Important Notices
  const upcomingExams = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return exams
      .filter(e => {
        if (!e.startDate) return true; // Show scheduled terms
        const examDate = new Date(e.startDate);
        return isNaN(examDate.getTime()) || examDate >= today || e.status === 'SCHEDULED' || e.status === 'ACTIVE';
      })
      .slice(0, 2);
  }, [exams]);

  const activeNotices = useMemo(() => {
    return notices
      // Urgent/cancellation notices are surfaced by the Dashboard's own
      // urgent-notices card in the Overview view — exclude them here so a
      // notice never appears twice on the dashboard.
      .filter(n => n.isActive !== false && !(n.priority === 'urgent' || n.category === 'urgent' || n.category === 'cancellation'))
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      })
      .slice(0, 3);
  }, [notices]);

  // 7. Recent Chronological Activities Feed
  const recentActivities = useMemo(() => {
    interface ActivityItem {
      id: string;
      title: string;
      timeStr: string;
      timestamp: number;
      type: 'finance' | 'notice' | 'admission' | 'exam' | 'system';
      badgeText: string;
      badgeColor: string;
      navTarget: string;
    }

    const list: ActivityItem[] = [];

    // Recent Transactions
    transactions.slice(0, 6).forEach(t => {
      const amt = Number(t.amount) || 0;
      const isInc = (t.type || '').toUpperCase() === 'INCOME';
      const parsed = t.date ? new Date(t.date) : new Date();
      list.push({
        id: `trx-${t.id}`,
        title: isInc 
          ? (isBn ? `ফি আদায়: ৳${toBanglaDigits(amt.toLocaleString(), language)} (${t.payerOrPayee || t.studentName || 'সাধারণ আদায়'})` : `Fee Collection: ৳${amt} (${t.payerOrPayee || 'General'})`)
          : (isBn ? `ব্যয় ভাউচার: ৳${toBanglaDigits(amt.toLocaleString(), language)} (${t.categoryName || t.category || 'সাধারণ ব্যয়'})` : `Expense: ৳${amt} (${t.category || 'General'})`),
        timeStr: formatSafeDate(t.date || t.createdAt, isBn ? 'bn-BD' : 'en-US'),
        timestamp: isNaN(parsed.getTime()) ? 0 : parsed.getTime(),
        type: 'finance',
        badgeText: isInc ? (isBn ? 'আদায়' : 'Income') : (isBn ? 'ব্যয়' : 'Expense'),
        badgeColor: isInc ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200',
        navTarget: 'finance'
      });
    });

    // Recent Notices
    notices.slice(0, 3).forEach(n => {
      const parsed = n.createdAt ? new Date(n.createdAt) : new Date();
      list.push({
        id: `notice-${n.id}`,
        title: isBn ? `নোটিশ: ${n.title}` : `Notice: ${n.title}`,
        timeStr: formatSafeDate(n.createdAt, isBn ? 'bn-BD' : 'en-US'),
        timestamp: isNaN(parsed.getTime()) ? 0 : parsed.getTime(),
        type: 'notice',
        badgeText: isBn ? 'নোটিশ' : 'Notice',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        navTarget: 'notice_board'
      });
    });

    // Recent Students
    students.slice(-4).forEach(s => {
      const parsed = s.admissionDate ? new Date(s.admissionDate) : new Date();
      list.push({
        id: `stu-${s.id}`,
        title: isBn ? `নতুন ভর্তি: ${s.name} (${s.classLevel})` : `New Admission: ${s.name} (${s.classLevel})`,
        timeStr: formatSafeDate(s.admissionDate || new Date(), isBn ? 'bn-BD' : 'en-US'),
        timestamp: isNaN(parsed.getTime()) ? 0 : parsed.getTime(),
        type: 'admission',
        badgeText: isBn ? 'ভর্তি' : 'Admission',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        navTarget: 'students'
      });
    });

    // Sort by newest first
    return list
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }, [transactions, notices, students, isBn, language]);

  return (
    <div className="space-y-6">

      {showHero && (<>
      {/* =========================================================================
          SECTION 1: OVERVIEW / সারসংক্ষেপ (Brand Hero — PageHeader + quick tiles)
          ========================================================================= */}
      <PageHeader
        tone="brand"
        icon={Building2}
        title={schoolProfile.nameBn || schoolProfile.name || (isBn ? 'মাদ্রাসা ম্যানেজমেন্ট সিস্টেম' : 'Madrasah Management')}
        subtitle={`${formattedToday}${schoolProfile.address ? ` • ${schoolProfile.addressBn || schoolProfile.address}` : ''}`}
        footer={
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 pt-5 mt-5 border-t border-white/15">
            {heroActions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={() => onNavigate(act.id)}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer active:scale-95"
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-semibold text-center leading-tight">
                    {isBn ? act.labelBn : act.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        }
      >
        <span className="text-xs font-semibold text-emerald-200 bg-white/10 border border-white/20 px-3 py-2 rounded-xl flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span>{isBn ? 'সিস্টেম সক্রিয়' : 'Live Sync'}</span>
        </span>

        {/* Session selector */}
        {onSelectAcademicYear && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl text-xs border border-white/20">
            <span className="text-[11px] text-white/75 font-bold">{isBn ? 'সেশন:' : 'Session:'}</span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => onSelectAcademicYear(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900 text-white">{isBn ? 'সকল সেশন' : 'All'}</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.name} className="bg-slate-900 text-white">
                  {toBanglaDigits(y.name, language)}
                </option>
              ))}
              {academicYears.length === 0 && (
                <option value={selectedAcademicYear} className="bg-slate-900 text-white">{toBanglaDigits(selectedAcademicYear, language)}</option>
              )}
            </select>
          </div>
        )}

        {/* Exam selector */}
        {onSelectExamId && yearExams.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl text-xs border border-white/20">
            <span className="text-[11px] text-white/75 font-bold">{isBn ? 'পরীক্ষা:' : 'Exam:'}</span>
            <select
              value={selectedExamId || ''}
              onChange={(e) => onSelectExamId(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs max-w-[120px] truncate"
            >
              {yearExams.map(e => (
                <option key={e.id} value={e.id} className="bg-slate-900 text-white">
                  {isBn ? (e.nameBn || e.name) : e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </PageHeader>
      </>)}

      {showStats && (<>
      {/* =========================================================================
          SECTIONS 2, 3, 4, 5: THE 4 CORE METRIC BENTO CARDS
          (আজকের উপস্থিতি | আজকের আয়–ব্যয় | শিক্ষার্থী ও কর্মী | বকেয়া ফি)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 2. আজকের উপস্থিতি (Today's Attendance) */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.02)] hover:shadow-card hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer group flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isBn ? 'আজকের উপস্থিতি' : "Today's Attendance"}
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserCheck size={20} />
              </div>
            </div>

            {attendanceMetrics.isRecorded ? (
              <>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
                    <CountUpNumber target={Math.round(Number(attendanceMetrics.rate) || 0)} suffix="%" />
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle2 size={13} />
                    <span>{isBn ? 'সন্তোষজনক' : 'Good'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isBn
                    ? `রেকর্ডকৃত ${toBanglaDigits(attendanceMetrics.recorded, 'bn')} জনের ভিত্তিতে`
                    : `Based on ${attendanceMetrics.recorded} recorded students`}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isBn ? 'উপস্থিত' : 'Present'}</span>
                    <span className="text-base font-black tabular-nums font-mono">
                      <CountUpNumber target={attendanceMetrics.present ?? 0} /> {isBn ? 'জন' : ''}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/60 text-rose-900 dark:text-rose-200">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
                    <span className="text-base font-black tabular-nums font-mono">
                      <CountUpNumber target={attendanceMetrics.absent ?? 0} /> {isBn ? 'জন' : ''}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                  {isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isBn ? 'আজ এখনো কোনো ক্লাসের হাজিরা রেকর্ড হয়নি' : 'No class attendance recorded yet today'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">{isBn ? 'উপস্থিত' : 'Present'}</span>
                    <span className="text-base font-black">—</span>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/60 text-rose-900 dark:text-rose-200">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
                    <span className="text-base font-black">—</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
            <span>{isBn ? 'হাজিরা শিট খুলুন' : 'Open Register'}</span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. আজকের আয়–ব্যয় (Today's Income & Expense) */}
        <div 
          onClick={() => onNavigate('finance')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.02)] hover:shadow-card hover:-translate-y-0.5 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 cursor-pointer group flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isBn ? 'আজকের আয়–ব্যয় ও ক্যাশ' : "Today's Cash Flow"}
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet size={20} />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-slate-400">৳</span>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
                <CountUpNumber target={todayCashFlow.todayIncome} />
              </h3>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block flex items-center gap-1">
                  <ArrowDownRight size={11} />
                  <span>{isBn ? 'আজকের জমা' : 'Inflow'}</span>
                </span>
                <span className="text-sm font-black truncate block tabular-nums font-mono">
                  ৳<CountUpNumber target={todayCashFlow.todayIncome} />
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/60 text-rose-900 dark:text-rose-200">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block flex items-center gap-1">
                  <ArrowUpRight size={11} />
                  <span>{isBn ? 'আজকের খরচ' : 'Outflow'}</span>
                </span>
                <span className="text-sm font-black truncate block tabular-nums font-mono">
                  ৳<CountUpNumber target={todayCashFlow.todayExpense} />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
            <span className="truncate tabular-nums font-mono">
              {isBn ? `হাতে নগদ: ৳${toBanglaDigits(todayCashFlow.todayNet.toLocaleString(), language)}` : `Net: ৳${todayCashFlow.todayNet}`}
            </span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        </div>

        {/* 4. শিক্ষার্থী ও কর্মচারীর সংখ্যা (Students & Staff Count) */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.02)] hover:shadow-card hover:-translate-y-0.5 hover:border-[var(--color-brand-ring)] transition-all duration-200 cursor-pointer group flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isBn ? 'শিক্ষার্থী ও জনবল' : 'Students & Faculty'}
              </span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                <Users size={20} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums font-mono">
                <CountUpNumber target={studentMetrics.active} />
              </h3>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isBn ? 'জন শিক্ষার্থী' : 'Students'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-2 rounded-xl border text-slate-900 dark:text-slate-100" style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-ring)' }}>
                <span className="text-[10px] font-bold block" style={{ color: 'var(--color-brand)' }}>{isBn ? 'শিক্ষক ও কর্মী' : 'Teachers/Staff'}</span>
                <span className="text-base font-black tabular-nums font-mono">
                  <CountUpNumber target={staffMetrics.teachersCount} /> {isBn ? 'জন' : ''}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{isBn ? 'মোট জামাত/শ্রেণি' : 'Classes'}</span>
                <span className="text-base font-black tabular-nums font-mono">
                  <CountUpNumber target={classes.length} /> {isBn ? 'টি' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[var(--color-brand)] group-hover:text-[var(--color-brand-hover)]">
            <span>{isBn ? `অনুপাত: ১:${toBanglaDigits(staffMetrics.ratio, language)}` : `Ratio: 1:${staffMetrics.ratio}`}</span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 5. বকেয়া বেতন ও ফি (Due Fees & Receivables) */}
        <div 
          onClick={() => onNavigate('finance_reports')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.02)] hover:shadow-card hover:-translate-y-0.5 hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 cursor-pointer group flex flex-col justify-between active:scale-[0.99]"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isBn ? 'বকেয়া বেতন ও ফি' : 'Fee Dues & Collection'}
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard size={20} />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-slate-400">৳</span>
              <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight tabular-nums font-mono">
                <CountUpNumber target={feeDuesMetrics.dues} />
              </h3>
            </div>

            {/* Collection Progress Bar */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500 dark:text-slate-400">{isBn ? 'আদায়ের অগ্রগতি' : 'Collection Rate'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                  <CountUpNumber target={feeDuesMetrics.rate} suffix="%" />
                </span>
              </div>
              <ProgressBar value={feeDuesMetrics.rate} tone="emerald" size="md" />
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium tabular-nums font-mono">
                <span>{isBn ? `আদায়: ৳${toBanglaDigits(feeDuesMetrics.collected.toLocaleString(), language)}` : `Collected: ৳${feeDuesMetrics.collected}`}</span>
                <span>{isBn ? `প্রত্যাশিত: ৳${toBanglaDigits(feeDuesMetrics.expected.toLocaleString(), language)}` : `Target: ৳${feeDuesMetrics.expected}`}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300">
            <span>{isBn ? 'বকেয়া তালিকা দেখুন' : 'View Due List'}</span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTIONS 6 & 7: DUAL SPLIT CARDS
          (আসন্ন পরীক্ষা ও গুরুত্বপূর্ণ নোটিশ | সাম্প্রতিক কার্যক্রম ফিড)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 6. আসন্ন পরীক্ষা ও গুরুত্বপূর্ণ নোটিশ (Upcoming Exams & Important Notices) */}
        <SectionCard
          title={isBn ? 'আসন্ন পরীক্ষা ও গুরুত্বপূর্ণ নোটিশ' : 'Upcoming Exams & Notices'}
          icon={Megaphone}
          iconTone="brand"
          bodyClassName="space-y-4"
          action={
            <button
              onClick={() => onNavigate('notice_board')}
              className="text-xs font-bold text-[var(--color-brand)] hover:text-[var(--color-brand-hover)] flex items-center gap-1 cursor-pointer"
            >
              <span>{isBn ? 'সকল নোটিশ' : 'View All'}</span>
              <ChevronRight size={14} />
            </button>
          }
        >

          {/* Upcoming Exam Mini Cards */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {isBn ? 'আসন্ন পরীক্ষা সূচি' : 'Scheduled Examinations'}
            </span>
            {upcomingExams.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-400 text-center">
                {isBn ? 'বর্তমানে কোনো আসন্ন পরীক্ষা সূচি নির্ধারিত নেই' : 'No upcoming exams scheduled'}
              </div>
            ) : (
              upcomingExams.map(e => (
                <div
                  key={e.id}
                  onClick={() => onNavigate('exam_settings')}
                  className="p-3.5 rounded-xl border transition-colors flex items-center justify-between cursor-pointer group"
                  style={{ backgroundColor: 'var(--color-brand-light)', borderColor: 'var(--color-brand-ring)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      <Award size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block group-hover:text-[var(--color-brand)] transition-colors">
                        {isBn ? (e.nameBn || e.name) : e.name}
                      </span>
                      <span className="text-[10px] font-medium opacity-80" style={{ color: 'var(--color-brand)' }}>
                        {e.category} {e.startDate ? `• ${formatSafeDate(e.startDate, isBn ? 'bn-BD' : 'en-US')}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border shrink-0" style={{ color: 'var(--color-brand)', borderColor: 'var(--color-brand-ring)' }}>
                    {e.status === 'ACTIVE' ? (isBn ? 'চলমান' : 'Active') : (isBn ? 'আসন্ন' : 'Upcoming')}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Important Notices List */}
          <div className="space-y-2.5 pt-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {isBn ? 'জরুরি প্রাতিষ্ঠানিক নোটিশ' : 'High Priority Notices'}
            </span>
            {activeNotices.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-400 text-center">
                {isBn ? 'বর্তমানে কোনো নতুন নোটিশ নেই' : 'No active notices at this time'}
              </div>
            ) : (
              activeNotices.map(n => (
                <div
                  key={n.id}
                  onClick={() => onNavigate('notice_board')}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${n.priority === 'urgent' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`} />
                    <div className="truncate">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatSafeDate(n.createdAt, isBn ? 'bn-BD' : 'en-US')} • {n.category}
                      </span>
                    </div>
                  </div>
                  {n.isPinned && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-md shrink-0 ml-2">
                      {isBn ? 'পিন্ড' : 'Pinned'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* 7. সাম্প্রতিক কার্যক্রম (Recent Activities Chronological Feed) */}
        <SectionCard
          title={isBn ? 'সাম্প্রতিক কার্যক্রম' : 'Recent Institutional Activity'}
          icon={History}
          iconTone="emerald"
          bodyClassName="space-y-3"
          action={
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {isBn ? 'রিয়েলটাইম' : 'Live'}
            </span>
          }
        >
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Clock size={24} className="mx-auto text-slate-300 mb-2" />
                <p>{isBn ? 'এখনো কোনো সাম্প্রতিক কার্যক্রম রেকর্ড হয়নি' : 'No recent activities found'}</p>
              </div>
            ) : (
              recentActivities.map((act, idx) => (
                <div
                  key={act.id || idx}
                  onClick={() => onNavigate(act.navTarget)}
                  className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/90 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
                      {act.type === 'finance' && <Wallet size={15} className="text-emerald-600" />}
                      {act.type === 'notice' && <Megaphone size={15} className="text-amber-600" />}
                      {act.type === 'admission' && <UserPlus size={15} className="text-blue-600" />}
                      {act.type === 'exam' && <Award size={15} className="text-indigo-600" />}
                      {act.type === 'system' && <ShieldCheck size={15} className="text-purple-600" />}
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate group-hover:text-[var(--color-brand)] transition-colors">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {act.timeStr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${act.badgeColor}`}>
                      {act.badgeText}
                    </span>
                    <ChevronRight size={13} className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

      </div>
      </>)}

    </div>
  );
};
