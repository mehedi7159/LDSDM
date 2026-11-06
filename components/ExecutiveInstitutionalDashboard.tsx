import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, 
  Calendar, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Megaphone, 
  UserPlus, 
  PenTool, 
  Receipt, 
  BookOpen, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  BarChart3, 
  Building2, 
  FileText, 
  Trophy,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Layers
} from 'lucide-react';
import { DashboardNoticeWidget } from './DashboardNoticeWidget';
import { PageHeader } from './ui/PageHeader';
import { calculateTotalGPA, formatNumber } from '../services/utils';

interface ExecutiveDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ExecutiveInstitutionalDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const { 
    students = [], 
    classes = [], 
    subjects = [], 
    exams = [], 
    marks = [], 
    remarks = [], 
    transactions = [], 
    schoolProfile, 
    authUser, 
    isSuperAdmin, 
    isAdmin, 
    language, 
    t 
  } = useApp();

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return exams.length > 0 ? exams[0].id : '';
  });

  React.useEffect(() => {
    if (exams.length > 0 && (!selectedExamId || !exams.some(e => e.id === selectedExamId))) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  // Convert English digits to Bengali digits if language is Bengali
  const toBanglaDigits = (num: number | string | undefined | null) => {
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

  // 1. Student Census & Demographics
  const studentStats = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === 'Active' && !s.isFormer).length;
    const inactive = students.filter(s => s.status === 'Inactive' && !s.isFormer).length;
    const former = students.filter(s => s.isFormer || s.status === 'Former').length;

    // Per class distribution
    const classCountMap: Record<string, number> = {};
    classes.forEach(c => {
      classCountMap[c.name] = 0;
    });

    students.forEach(s => {
      if (s.status === 'Active' && !s.isFormer && s.classLevel) {
        classCountMap[s.classLevel] = (classCountMap[s.classLevel] || 0) + 1;
      }
    });

    const classDistribution = Object.entries(classCountMap).map(([className, count]) => ({
      className,
      count
    }));

    return { total, active, inactive, former, classDistribution };
  }, [students, classes]);

  // 2. Attendance Overview
  const attendanceStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;

    remarks.forEach(r => {
      if (selectedExamId && r.examId === selectedExamId) {
        totalPresent += r.totalPresent || 0;
        totalAbsent += r.totalAbsent || 0;
      } else if (!selectedExamId) {
        totalPresent += r.totalPresent || 0;
        totalAbsent += r.totalAbsent || 0;
      }
    });

    const totalDays = totalPresent + totalAbsent;
    // Real data only: with no exam attendance remarks there is NO rate —
    // a previous version displayed an invented '94.5%' here.
    const attendanceRate = totalDays > 0 ? ((totalPresent / totalDays) * 100).toFixed(1) : null;

    return {
      present: totalPresent,
      absent: totalAbsent,
      rate: attendanceRate
    };
  }, [remarks, selectedExamId]);

  // 3. Academic Health & Pass Rates
  const academicStats = useMemo(() => {
    if (!selectedExam) {
      return { totalAppeared: 0, passed: 0, failed: 0, passRate: '0', avgGpa: '0.00', gpa5Count: 0, topStudents: [] };
    }

    const activeStudents = students.filter(s => s.status === 'Active' && !s.isFormer);
    const results = activeStudents.map(student => {
      const classSubs = subjects.filter(s => s.classLevel === student.classLevel);
      const stats = calculateTotalGPA(classSubs, marks, student.id, selectedExam.id, student.group, exams);
      return {
        student,
        ...stats
      };
    });

    const evaluated = results.filter(r => r.totalMarks > 0);
    const passed = evaluated.filter(r => !r.isFail).length;
    const failed = evaluated.length - passed;
    const passRate = evaluated.length > 0 ? ((passed / evaluated.length) * 100).toFixed(1) : '0';
    const gpa5Count = evaluated.filter(r => !r.isFail && r.gpa >= 5.0).length;

    const totalGpaSum = evaluated.reduce((sum, r) => sum + r.gpa, 0);
    const avgGpa = evaluated.length > 0 ? (totalGpaSum / evaluated.length).toFixed(2) : '0.00';

    // Sort by Merit for Top Achievers
    const sorted = [...evaluated].sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
    });

    return {
      totalAppeared: evaluated.length,
      passed,
      failed,
      passRate,
      avgGpa,
      gpa5Count,
      topStudents: sorted.slice(0, 5)
    };
  }, [students, subjects, marks, selectedExam, exams]);

  // 4. Financial Health (Transactions Snapshot)
  const financeStats = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      if (t.type === 'income') {
        income += Number(t.amount) || 0;
      } else if (t.type === 'expense') {
        expense += Number(t.amount) || 0;
      }
    });

    const balance = income - expense;

    return {
      income,
      expense,
      balance,
      transactionCount: transactions.length
    };
  }, [transactions]);

  // Current formatted date in Bengali / English
  const formattedToday = useMemo(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', options);
  }, [language]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Executive Header — PageHeader brand hero (Phase 3 Batch 1);
          controls below are unchanged, only the outer frame is aligned. */}
      <PageHeader
        tone="brand"
        icon={Building2}
        eyebrow={language === 'bn' ? 'সিস্টেম সক্রিয়' : 'Live'}
        title={schoolProfile?.name || 'মাদ্রাসা ম্যানেজমেন্ট'}
        subtitle={language === 'bn'
          ? `${formattedToday} • শিক্ষাবর্ষ: ${schoolProfile?.academicYear || '২০২৬'}`
          : `${formattedToday} • Academic Session: ${schoolProfile?.academicYear || '2026'}`}
      >
          {/* Exam Switcher on Top */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 flex items-center gap-2">
              <Calendar size={15} className="text-amber-400 shrink-0" />
              <div className="text-left">
                <span className="text-[10px] text-indigo-200 font-bold block uppercase tracking-wider leading-none">
                  {language === 'bn' ? 'সক্রিয় পরীক্ষা' : 'Current Exam'}
                </span>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="bg-transparent text-white font-black text-xs border-none outline-none cursor-pointer pr-4 focus:ring-0"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id} className="bg-slate-900 text-white font-bold">
                      {language === 'bn' ? (e.nameBn || e.name) : e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => onNavigate('academic_reports')}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-indigo-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 size={15} className="text-indigo-600" />
              <span>{language === 'bn' ? 'গ্রাফিক্যাল রিপোর্ট' : 'Deep Analytics'}</span>
            </button>
          </div>
      </PageHeader>

      {/* 2. Bento Grid: 4 Core Institutional KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Student Census */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-4xl font-black text-slate-900 tracking-tight">
                {toBanglaDigits(studentStats.active)}
              </h3>
              <p className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                <span>{language === 'bn' ? `${toBanglaDigits(studentStats.active)} জন নিয়মিত তালিবুল ইলম` : `${studentStats.active} Active Students`}</span>
              </p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>অনিয়মিত: {toBanglaDigits(studentStats.inactive)} • প্রাক্তন: {toBanglaDigits(studentStats.former)}</span>
            <ChevronRight size={13} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </div>
        </div>

        {/* CARD 2: Attendance Pulse */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'bn' ? 'হাজিরার গড় হার' : 'Attendance Rate'}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                <span>{attendanceStats.rate !== null ? `${toBanglaDigits(attendanceStats.rate)}%` : '—'}</span>
              </h3>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>মোট ক্লাস: {toBanglaDigits(classes.length)} টি</span>
            <ChevronRight size={13} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </div>

        {/* CARD 3: Academic Pass Rate & Exam Health */}
        <div 
          onClick={() => onNavigate('web_results')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'bn' ? 'পরীক্ষায় পাসের হার' : 'Exam Pass Rate'}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                <span>{toBanglaDigits(academicStats.passRate)}%</span>
              </h3>
              <p className="text-[11px] text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                <span>{language === 'bn' ? `গড় জিপিএ: ${toBanglaDigits(academicStats.avgGpa)}` : `Avg GPA: ${academicStats.avgGpa}`}</span>
              </p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>A+ (৫.০০): {toBanglaDigits(academicStats.gpa5Count)} জন</span>
            <ChevronRight size={13} className="text-slate-400 group-hover:text-amber-600 transition-colors" />
          </div>
        </div>

        {/* CARD 4: Financial Health */}
        <div 
          onClick={() => onNavigate('finance')}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'bn' ? 'তহবিল ও স্থিতি (Net)' : 'Financial Balance'}
              </span>
            </div>
            <div className="mt-2">
              <h3 className={`text-4xl font-black tracking-tight ${financeStats.balance >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
                ৳ {toBanglaDigits(financeStats.balance.toLocaleString())}
              </h3>
              <p className="text-[11px] text-purple-700 font-bold mt-0.5 flex items-center gap-1">
                <span>{language === 'bn' ? `মোট আদায়: ৳ ${toBanglaDigits(financeStats.income.toLocaleString())}` : `Total Inflow: ৳ ${financeStats.income}`}</span>
              </p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>ব্যয়: ৳ {toBanglaDigits(financeStats.expense.toLocaleString())}</span>
            <ChevronRight size={13} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
          </div>
        </div>
      </div>

      {/* 3. High-Impact Instant Action Launchpad (৬টি দ্রুত কার্যক্রম) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              {language === 'bn' ? 'দ্রুত কার্যক্রম লঞ্চপ্যাড' : 'Instant Operations Launchpad'}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Action 1: Add Student */}
          <button
            onClick={() => onNavigate('students')}
            className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UserPlus size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'নতুন ভর্তি' : 'New Admission'}</span>
            </div>
          </button>

          {/* Action 2: Marks Entry */}
          <button
            onClick={() => onNavigate('marks')}
            className="p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/80 text-blue-900 border border-blue-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <PenTool size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'নম্বর এন্ট্রি' : 'Marks Entry'}</span>
            </div>
          </button>

          {/* Action 3: Attendance */}
          <button
            onClick={() => onNavigate('attendance')}
            className="p-3.5 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-900 border border-indigo-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'দৈনিক হাজিরা' : 'Attendance'}</span>
            </div>
          </button>

          {/* Action 4: Fee Collection */}
          <button
            onClick={() => onNavigate('finance')}
            className="p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-100/80 text-purple-900 border border-purple-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Receipt size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'ফি আদায়' : 'Fee Receipt'}</span>
            </div>
          </button>

          {/* Action 5: Notice & Diary */}
          <button
            onClick={() => onNavigate('notices')}
            className="p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 border border-amber-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Megaphone size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}</span>
            </div>
          </button>

          {/* Action 6: Web Results */}
          <button
            onClick={() => onNavigate('web_results')}
            className="p-3.5 rounded-2xl bg-teal-50/70 hover:bg-teal-100/80 text-teal-900 border border-teal-200/70 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Award size={16} />
            </div>
            <div>
              <span className="text-xs font-black block leading-tight">{language === 'bn' ? 'ফলাফল পোর্টাল' : 'Web Results'}</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Live Notice Board & Daily Activities Widget */}
      <DashboardNoticeWidget onNavigateToNotices={() => onNavigate('notices')} />

      {/* 5. Middle Split: Class Strength vs Top Achievers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Class Census & Student Distribution */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                <span>{language === 'bn' ? 'শ্রেণিভিত্তিক শিক্ষার্থী শক্তি ও বণ্টন' : 'Class Strength Distribution'}</span>
              </h3>
            </div>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'bn' ? 'তালিকা' : 'Directory'}</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {studentStats.classDistribution.map(item => {
              const percentage = studentStats.active > 0 ? ((item.count / studentStats.active) * 100).toFixed(0) : '0';
              return (
                <div key={item.className} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 truncate max-w-[120px]">{item.className}</span>
                    <span className="text-[10px] font-mono text-slate-400">{toBanglaDigits(percentage)}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-black text-indigo-950">{toBanglaDigits(item.count)}</span>
                    <span className="text-[10px] text-slate-400">{language === 'bn' ? 'জন তালিব' : 'students'}</span>
                  </div>
                  {/* Micro Progress Bar */}
                  <div className="w-full bg-slate-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(5, Number(percentage)))}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Top Merit Achievers */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                <span>{language === 'bn' ? 'শীর্ষ মেধা তালিকা' : 'Top Achievers'}</span>
              </h3>
              <p className="text-xs text-slate-400">{selectedExam?.name || 'পরীক্ষা'}</p>
            </div>
            <button
              onClick={() => onNavigate('web_results')}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'bn' ? 'সবাই' : 'All'}</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {academicStats.topStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <BookOpen size={24} className="mx-auto text-slate-300 mb-1" />
              <p>{language === 'bn' ? 'এই পরীক্ষায় এখনো নম্বর এন্ট্রি হয়নি' : 'No scores entered for this exam yet'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {academicStats.topStudents.map((item, idx) => (
                <div 
                  key={item.student.id}
                  className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 bg-amber-100 text-amber-800">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{item.student.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        রোল: {toBanglaDigits(item.student.roll)} • {item.student.classLevel}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-indigo-700 block font-mono text-xs">
                      GPA {toBanglaDigits(item.gpa.toFixed(2))}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      মোট: {toBanglaDigits(item.totalMarks)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
