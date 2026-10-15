import React, { useState, useEffect, useMemo, memo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp, 
  TrendingDown,
  Award, 
  AlertCircle, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  PieChart as PieIcon, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Search, 
  Layers, 
  Clock, 
  ChevronRight, 
  HelpCircle, 
  FileText, 
  AlertTriangle, 
  X, 
  ExternalLink, 
  ShieldAlert, 
  ListChecks, 
  Activity, 
  Check, 
  ChevronDown, 
  UserCheck,
  PenTool,
  FileSpreadsheet,
  Wallet,
  Settings as SettingsIcon,
  CreditCard,
  CheckCheck,
  Clock4,
  RefreshCw,
  Building2,
  ShieldCheck,
  Megaphone
} from 'lucide-react';
import { NoticeBoardAlertBanner } from './NoticeBoard';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { calculateTotalGPA } from '../services/utils';
import { SubjectPerformanceAnalytics } from './SubjectPerformanceAnalytics';
import { StudentPerformanceCard } from './StudentPerformanceCard';
import { DashboardDailyOverview } from './DashboardDailyOverview';

// =========================================================================
// TYPES FOR MEMOIZED SUB-COMPONENTS
// =========================================================================
interface StudentMetrics {
  total: number;
  active: number;
  inactive: number;
  male: number;
  female: number;
}

interface ExamMetrics {
  total: number;
  active: number;
  scheduled: number;
  finalized: number;
}

interface EvaluationMetrics {
  totalExpected: number;
  totalEntered: number;
  totalPending: number;
  progressPercent: number;
}

interface AcademicHealthMetrics {
  passRate: number;
  overallAverageGpa: number;
  aPlusCount: number;
}

interface FinanceMetrics {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

interface StructureMetrics {
  classesCount: number;
  subjectsCount: number;
  teachersCount: number;
}

interface ExamMatrixItem {
  examId: string;
  examName: string;
  examNameBn?: string;
  category: string;
  status: string;
  isFinalized: boolean;
  expectedMarks: number;
  enteredMarks: number;
  pendingMarks: number;
  progress: number;
  classes: Array<{
    className: string;
    studentCount: number;
    subjectCount: number;
    expectedMarks: number;
    enteredMarks: number;
    pendingMarks: number;
    progress: number;
    isCompleted: boolean;
  }>;
}

interface ClassSummaryCardItem {
  id: string;
  name: string;
  nameBn?: string;
  studentCount: number;
  evaluatedCount: number;
  passRate: number;
  averageGpa: number;
}

// Convert English digits to Bengali numerals helper
const toBanglaDigits = (num: number | string | undefined | null, language: string) => {
  if (num === undefined || num === null || num === '') return '';
  const str = String(num);
  if (language !== 'bn') return str;
  const banglaNums: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
    '.': '.'
  };
  return str.split('').map(char => banglaNums[char] || char).join('');
};

// =========================================================================
// 1. MEMOIZED DASHBOARD HEADER
// =========================================================================
interface DashboardHeaderProps {
  selectedAcademicYear: string;
  onSelectAcademicYear: (year: string) => void;
  academicYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  schoolProfileYear?: string;
  selectedExamId: string;
  onSelectExamId: (examId: string) => void;
  yearExams: Array<{ id: string; name: string; nameBn?: string }>;
  onOpenRecoveryModal: () => void;
  language: string;
  t: (key: any) => string;
}

const DashboardHeader = memo<DashboardHeaderProps>(({
  selectedAcademicYear,
  onSelectAcademicYear,
  academicYears,
  schoolProfileYear,
  selectedExamId,
  onSelectExamId,
  yearExams,
  onOpenRecoveryModal,
  language,
  t
}) => {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-600" />
              <span>{language === 'bn' ? 'ড্যাশবোর্ড ও ওভারভিউ' : 'Dashboard Overview'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{language === 'bn' ? `সেশন: ${toBanglaDigits(selectedAcademicYear, language)}` : `Session: ${selectedAcademicYear}`}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                {language === 'bn' ? 'প্রশাসনিক ড্যাশবোর্ড ও সার্বিক পরিসংখ্যান' : 'Administrative Dashboard'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'bn' 
                  ? 'এক নজরে মোট শিক্ষার্থী, চলমান পরীক্ষা, খাতা মূল্যায়ন ও প্রাতিষ্ঠানিক খতিয়ান।'
                  : 'Consolidated overview for student enrolment, active exams, pending grading, and institutional records.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls Toolbar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Academic Year Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs hover:bg-slate-100/80 transition-colors flex-1 sm:flex-initial">
            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-600 shrink-0">
              {language === 'bn' ? 'সেশন:' : 'Year:'}
            </span>
            <select
              id="dashboard-year-selector"
              value={selectedAcademicYear}
              onChange={(e) => onSelectAcademicYear(e.target.value)}
              aria-label="Academic Year"
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer pr-1 text-xs w-full sm:w-auto"
            >
              <option value="ALL">{language === 'bn' ? 'সকল সেশন' : 'All Years'}</option>
              {academicYears.length > 0 ? (
                academicYears.map(y => (
                  <option key={y.id} value={y.name}>
                    {toBanglaDigits(y.name, language)} {y.isCurrent ? (language === 'bn' ? '(চলমান)' : '(Current)') : ''}
                  </option>
                ))
              ) : (
                <option value={schoolProfileYear || '2026'}>{toBanglaDigits(schoolProfileYear || '2026', language)}</option>
              )}
            </select>
          </div>

          {/* Exam Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs hover:bg-slate-100/80 transition-colors flex-1 sm:flex-initial">
            <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-600 shrink-0">
              {language === 'bn' ? 'পরীক্ষা:' : 'Exam:'}
            </span>
            <select
              id="dashboard-exam-selector"
              value={selectedExamId}
              onChange={(e) => onSelectExamId(e.target.value)}
              aria-label={t('exam')}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer pr-1 max-w-[130px] sm:max-w-[150px] truncate text-xs w-full sm:w-auto"
            >
              <option value="All">{language === 'bn' ? 'সকল পরীক্ষা' : 'All Exams'}</option>
              {yearExams.map(e => (
                <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>
              ))}
            </select>
          </div>

          {/* Emergency Backup Button */}
          <button
            id="dashboard-recovery-btn"
            type="button"
            onClick={onOpenRecoveryModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="ক্লাউড ব্যাকআপ ও লোকাল ডাটা রিকভারি"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{language === 'bn' ? 'ব্যাকআপ' : 'Backup'}</span>
          </button>
        </div>
      </div>
    </div>
  );
});
DashboardHeader.displayName = 'DashboardHeader';

// =========================================================================
// 2. MEMOIZED KPI GRID (6 CONSOLIDATED TILES)
// =========================================================================
interface KpiGridProps {
  studentMetrics: StudentMetrics;
  examMetrics: ExamMetrics;
  evaluationMetrics: EvaluationMetrics;
  academicHealth: AcademicHealthMetrics;
  financeMetrics: FinanceMetrics;
  structureMetrics: StructureMetrics;
  selectedAcademicYear: string;
  onNavigate: (tab: string) => void;
  language: string;
}

const KpiGrid = memo<KpiGridProps>(({
  studentMetrics,
  examMetrics,
  evaluationMetrics,
  academicHealth,
  financeMetrics,
  structureMetrics,
  selectedAcademicYear,
  onNavigate,
  language
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      
      {/* KPI 1: Enrolled Students */}
      <div 
        onClick={() => onNavigate('students')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
              {toBanglaDigits(selectedAcademicYear, language)}
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'মোট শিক্ষার্থী' : 'Enrolled Students'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-slate-800 mt-1">
            {toBanglaDigits(studentMetrics.total, language)}
          </div>

          <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex flex-col xs:flex-row xs:items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 gap-1">
            <span>{language === 'bn' ? 'সক্রিয়:' : 'Act:'} <strong className="text-emerald-600">{toBanglaDigits(studentMetrics.active, language)}</strong></span>
            <span className="truncate">{language === 'bn' ? 'ছাত্র:' : 'M:'} <strong>{toBanglaDigits(studentMetrics.male, language)}</strong> | {language === 'bn' ? 'ছাত্রী:' : 'F:'} <strong>{toBanglaDigits(studentMetrics.female, language)}</strong></span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-blue-600 group-hover:text-blue-700">
          <span>{language === 'bn' ? 'শিক্ষার্থী তালিকা' : 'View Directory'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 2: Active Exams & Terms */}
      <div 
        onClick={() => onNavigate('exam_settings')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Layers size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700">
              {examMetrics.active > 0 ? (language === 'bn' ? `${toBanglaDigits(examMetrics.active, language)} চলমান` : `${examMetrics.active} Active`) : (language === 'bn' ? 'টার্ম' : 'Terms')}
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'টার্ম ও পরীক্ষা' : 'Active Exams & Terms'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-slate-800 mt-1">
            {toBanglaDigits(examMetrics.total, language)}
          </div>

          <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex flex-col xs:flex-row xs:items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 gap-1">
            <span>{language === 'bn' ? 'সম্পন্ন:' : 'Done:'} <strong className="text-emerald-600">{toBanglaDigits(examMetrics.finalized, language)}</strong></span>
            <span>{language === 'bn' ? 'আসন্ন:' : 'Upc:'} <strong className="text-blue-600">{toBanglaDigits(examMetrics.scheduled, language)}</strong></span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
          <span>{language === 'bn' ? 'পরীক্ষা ব্যবস্থাপনা' : 'Manage Exams'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 3: Pending Results & Marks Pipeline */}
      <div 
        onClick={() => onNavigate('marks')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
              evaluationMetrics.totalPending > 0 
                ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' 
                : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
            }`}>
              <Clock4 size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold ${
              evaluationMetrics.totalPending > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {evaluationMetrics.totalPending > 0 ? (language === 'bn' ? `${toBanglaDigits(evaluationMetrics.totalPending, language)} বাকি` : `${evaluationMetrics.totalPending} Left`) : (language === 'bn' ? '১০০% সম্পন্ন' : '100% Done')}
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'বাকি মূল্যায়ন ও নম্বর' : 'Evaluation Pipeline'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-slate-800 mt-1 flex items-baseline gap-1.5">
            <span>{toBanglaDigits(evaluationMetrics.totalPending, language)}</span>
            <span className="text-xs font-normal text-slate-400">/ {toBanglaDigits(evaluationMetrics.totalExpected, language)}</span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                evaluationMetrics.progressPercent >= 90 ? 'bg-emerald-500' :
                evaluationMetrics.progressPercent >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, evaluationMetrics.progressPercent))}%` }}
            />
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-amber-600 group-hover:text-amber-700">
          <span>{language === 'bn' ? 'নম্বর এন্ট্রি করুন' : 'Enter Marks'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 4: Academic Pass Rate */}
      <div 
        onClick={() => onNavigate('results')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Award size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700">
              {toBanglaDigits(academicHealth.passRate, language)}%
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'পাসের হার ও ফলাফল' : 'Academic Health'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-emerald-600 mt-1">
            {toBanglaDigits(academicHealth.passRate, language)}%
          </div>

          <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex flex-col xs:flex-row xs:items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 gap-1">
            <span>{language === 'bn' ? 'গড় GPA:' : 'Avg:'} <strong className="text-slate-800">{toBanglaDigits(academicHealth.overallAverageGpa.toFixed(2), language)}</strong></span>
            <span>{language === 'bn' ? 'A+ অর্জন:' : 'A+:'} <strong className="text-indigo-600">{toBanglaDigits(academicHealth.aPlusCount, language)}</strong></span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
          <span>{language === 'bn' ? 'মার্কশিট জেনারেটর' : 'View Results'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 5: Finance & Fee Snapshot */}
      <div 
        onClick={() => onNavigate('finance')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <Wallet size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold bg-teal-50 text-teal-700">
              {language === 'bn' ? 'আদায়' : 'Revenue'}
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'ফি আদায় ও তহবিল' : 'Financial Revenue'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-slate-800 mt-1 truncate">
            ৳{toBanglaDigits(financeMetrics.totalIncome.toLocaleString(), language)}
          </div>

          <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex flex-col xs:flex-row xs:items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 gap-1">
            <span className="truncate">{language === 'bn' ? 'ব্যয়:' : 'Exp:'} <strong>৳{toBanglaDigits(financeMetrics.totalExpense.toLocaleString(), language)}</strong></span>
            <span className="text-teal-700 font-bold truncate">৳{toBanglaDigits(financeMetrics.netBalance.toLocaleString(), language)}</span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-teal-600 group-hover:text-teal-700">
          <span>{language === 'bn' ? 'হিসাব খতিয়ান' : 'Finance Ledger'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 6: Classes & Faculty Structure */}
      <div 
        onClick={() => onNavigate('subjects')}
        className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer flex flex-col justify-between group"
      >
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <BookOpen size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700">
              {toBanglaDigits(structureMetrics.classesCount, language)} {language === 'bn' ? 'শ্রেণি' : 'Classes'}
            </span>
          </div>

          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block truncate">
            {language === 'bn' ? 'শ্রেণি ও বিষয় কাঠামো' : 'Classes & Subjects'}
          </span>

          <div className="text-xl sm:text-3xl font-bold text-slate-800 mt-1">
            {toBanglaDigits(structureMetrics.classesCount, language)}
          </div>

          <div className="text-[10px] sm:text-xs text-slate-500 mt-2 flex flex-col xs:flex-row xs:items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 gap-1">
            <span>{language === 'bn' ? 'বিষয়:' : 'Sub:'} <strong className="text-purple-600">{toBanglaDigits(structureMetrics.subjectsCount, language)}</strong></span>
            <span>{language === 'bn' ? 'শিক্ষক:' : 'Fac:'} <strong className="text-slate-700">{toBanglaDigits(structureMetrics.teachersCount, language)}</strong></span>
          </div>
        </div>

        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-purple-600 group-hover:text-purple-700">
          <span>{language === 'bn' ? 'বিষয় বণ্টন' : 'Curriculum'}</span>
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

    </div>
  );
});
KpiGrid.displayName = 'KpiGrid';

// =========================================================================
// 3. MEMOIZED QUICK LAUNCHPAD COMPONENT
// =========================================================================
interface QuickLaunchpadProps {
  onNavigate: (tab: string) => void;
  language: string;
}

const QuickLaunchpad = memo<QuickLaunchpadProps>(({ onNavigate, language }) => {
  const actions = [
    { id: 'students', labelBn: 'শিক্ষার্থী ভর্তি', labelEn: 'Student Roster', icon: Users, bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
    { id: 'promotion', labelBn: 'শ্রেণি প্রমোশন', labelEn: 'Class Advance', icon: GraduationCap, bg: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
    { id: 'marks', labelBn: 'নম্বর এন্ট্রি', labelEn: 'Marks Entry', icon: PenTool, bg: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
    { id: 'results', labelBn: 'ফলাফল কার্ড', labelEn: 'Report Cards', icon: FileSpreadsheet, bg: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
    { id: 'attendance', labelBn: 'দৈনিক হাজিরা', labelEn: 'Attendance', icon: UserCheck, bg: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
    { id: 'notice_board', labelBn: 'নোটিশ বোর্ড', labelEn: 'Notice Board', icon: Megaphone, bg: 'bg-rose-50 text-rose-600 hover:bg-rose-100' },
    { id: 'finance', labelBn: 'ফি আদায়', labelEn: 'Fee Collection', icon: Wallet, bg: 'bg-teal-50 text-teal-600 hover:bg-teal-100' },
    { id: 'subjects', labelBn: 'বিষয় বণ্টন', labelEn: 'Subject Setup', icon: BookOpen, bg: 'bg-sky-50 text-sky-600 hover:bg-sky-100' },
    { id: 'settings', labelBn: 'সিস্টেম সেটিংস', labelEn: 'Settings', icon: SettingsIcon, bg: 'bg-slate-100 text-slate-700 hover:bg-slate-200' }
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">
            {language === 'bn' ? 'দ্রুত কাজের শর্টকাট' : 'Quick Launchpad'}
          </h2>
        </div>
        <span className="text-xs text-slate-400 hidden sm:inline">
          {language === 'bn' ? 'সরাসরি যেকোনো মডিউলে প্রবেশ করুন' : 'Instant Module Routing'}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => onNavigate(act.id)}
              className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 text-slate-700 border border-slate-200/70 hover:border-indigo-200 transition-all cursor-pointer group text-center active:scale-95"
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${act.bg} flex items-center justify-center mb-1.5 sm:mb-2 transition-transform group-hover:scale-105 shrink-0`}>
                <Icon size={17} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-800 block truncate max-w-full">
                {language === 'bn' ? act.labelBn : act.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
QuickLaunchpad.displayName = 'QuickLaunchpad';

// =========================================================================
// 4. MEMOIZED EVALUATION PIPELINE COMPONENT
// =========================================================================
interface EvaluationPipelineProps {
  matrix: ExamMatrixItem[];
  progressPercent: number;
  selectedAcademicYear: string;
  onSelectExamAndNavigate: (examId: string, tab: string) => void;
  language: string;
}

const EvaluationPipeline = memo<EvaluationPipelineProps>(({
  matrix,
  progressPercent,
  selectedAcademicYear,
  onSelectExamAndNavigate,
  language
}) => {
  if (matrix.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <ListChecks size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {language === 'bn' ? 'টার্ম ও পরীক্ষার মূল্যায়ন পাইপলাইন' : 'Marks Evaluation & Result Pipeline'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'কোন শ্রেণির পরীক্ষার কত শতাংশ খাতা মূল্যায়ন ও নম্বর এন্ট্রি সম্পন্ন হয়েছে' : 'Real-time grading completion matrix per class and exam'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-500">
            {language === 'bn' ? 'সেশন অগ্রগতি:' : 'Session Progress:'}
          </span>
          <span className="rounded-full px-2.5 py-0.5 font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
            {toBanglaDigits(progressPercent, language)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matrix.map((matrixExam) => (
          <div 
            key={matrixExam.examId}
            className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-slate-300 transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 truncate">
                  {language === 'bn' ? matrixExam.examNameBn || matrixExam.examName : matrixExam.examName}
                </h3>
                <span className="text-[11px] text-slate-400 block">
                  {matrixExam.category} • {toBanglaDigits(selectedAcademicYear, language)}
                </span>
              </div>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                matrixExam.isFinalized 
                  ? 'bg-emerald-100 text-emerald-800'
                  : matrixExam.progress >= 100
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {matrixExam.isFinalized 
                  ? (language === 'bn' ? 'ফাইনাল' : 'Final')
                  : matrixExam.progress >= 100
                  ? (language === 'bn' ? 'সম্পন্ন' : 'Ready')
                  : (language === 'bn' ? `${toBanglaDigits(matrixExam.pendingMarks, language)} বাকি` : `${matrixExam.pendingMarks} Left`)}
              </span>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                <span className="text-slate-500">{language === 'bn' ? 'অগ্রগতি' : 'Progress'}</span>
                <span className="text-slate-700 font-bold">{toBanglaDigits(matrixExam.progress, language)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    matrixExam.progress >= 100 ? 'bg-emerald-500' :
                    matrixExam.progress >= 60 ? 'bg-indigo-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, matrixExam.progress))}%` }}
                />
              </div>
            </div>

            {/* Classes breakdown list */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
              {matrixExam.classes.slice(0, 4).map((clsItem, cIdx) => (
                <div key={cIdx} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700 font-medium truncate max-w-[120px]">
                    {clsItem.className}
                  </span>
                  <div>
                    {clsItem.isCompleted ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check size={11} /> {language === 'bn' ? 'সম্পন্ন' : 'Done'}
                      </span>
                    ) : clsItem.expectedMarks === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        {toBanglaDigits(clsItem.pendingMarks, language)} {language === 'bn' ? 'বাকি' : 'left'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => onSelectExamAndNavigate(matrixExam.examId, 'marks')}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold text-center transition cursor-pointer"
              >
                {language === 'bn' ? 'নম্বর এন্ট্রি' : 'Enter Marks'}
              </button>
              <button
                onClick={() => onSelectExamAndNavigate(matrixExam.examId, 'results')}
                className="py-1.5 px-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold text-center transition cursor-pointer"
              >
                {language === 'bn' ? 'রেজাল্ট' : 'Results'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
EvaluationPipeline.displayName = 'EvaluationPipeline';

// =========================================================================
// 5. MEMOIZED CLASS SUMMARY GRID COMPONENT
// =========================================================================
interface ClassGridProps {
  classCards: ClassSummaryCardItem[];
  language: string;
}

const ClassGrid = memo<ClassGridProps>(({ classCards, language }) => {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
            <GraduationCap size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {language === 'bn' ? 'শ্রেণিভিত্তিক শিক্ষার্থী ও পারফরম্যান্স খতিয়ান' : 'Class Enrolment & Performance Grid'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'প্রতিটি ক্লাসের বর্তমান ছাত্র-ছাত্রী সংখ্যা, পাসের হার ও গড় জিপিএ' : 'Live student count, pass percentage, and average GPA per class'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
          {toBanglaDigits(classCards.length, language)} {language === 'bn' ? 'শ্রেণি' : 'Classes'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {classCards.map(clsCard => (
          <div 
            key={clsCard.id}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                {clsCard.name}
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                {toBanglaDigits(clsCard.studentCount, language)} {language === 'bn' ? 'জন' : 'students'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">{language === 'bn' ? 'পাস' : 'Pass'}</span>
                <span className="font-bold text-emerald-700 text-xs">{toBanglaDigits(clsCard.passRate, language)}%</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] font-medium">{language === 'bn' ? 'গড় GPA' : 'Avg GPA'}</span>
                <span className="font-bold text-indigo-700 text-xs">{toBanglaDigits(clsCard.averageGpa.toFixed(2), language)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
ClassGrid.displayName = 'ClassGrid';

// =========================================================================
// 6. MAIN DASHBOARD ORCHESTRATOR COMPONENT
// =========================================================================
export const Dashboard = () => {
  const { 
    students = [], 
    subjects = [], 
    marks = [], 
    exams = [], 
    classes = [], 
    academicYears = [],
    schoolProfile,
    transactions = [],
    teachers = [],
    t, 
    language = 'bn', 
    setIsRecoveryModalOpen,
    setActiveTab
  } = useApp();

  // Academic Year State
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => {
    const currentYearObj = (academicYears || []).find(y => y.isCurrent || y.status === 'ACTIVE');
    return currentYearObj?.name || schoolProfile?.academicYear || new Date().getFullYear().toString();
  });

  const [selectedExamId, setSelectedExamId] = useState<string>('All');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [activeSectionTab, setActiveSectionTab] = useState<'overview' | 'student' | 'subjects' | 'merit'>('overview');
  const [meritSearchQuery, setMeritSearchQuery] = useState<string>('');

  // Default exam selector sync
  useEffect(() => {
    if (exams.length > 0 && (!selectedExamId || selectedExamId === 'All')) {
      const yearExams = (exams || []).filter(e => 
        selectedAcademicYear === 'ALL' || 
        !e.academicYear || 
        e.academicYear === selectedAcademicYear
      );
      if (yearExams.length > 0) {
        setSelectedExamId(yearExams[0].id);
      } else {
        setSelectedExamId(exams[0]?.id || 'All');
      }
    }
  }, [exams, selectedAcademicYear]);

  // =========================================================================
  // GRANULAR, TARGETED MEMOIZED METRICS COMPUTATIONS
  // =========================================================================

  // 1. Student Metrics (Only re-computes when students or academic year change!)
  const studentMetrics = useMemo<StudentMetrics>(() => {
    const yearStudents = (students || []).filter(s => {
      if (!s) return false;
      if (selectedAcademicYear === 'ALL') return true;
      if (!s.academicYear) return true;
      return s.academicYear === selectedAcademicYear;
    });

    const active = yearStudents.filter(s => s.status === 'Active' && !s.isFormer).length;
    const inactive = yearStudents.filter(s => s.status !== 'Active' || s.isFormer).length;

    const male = yearStudents.filter(s => 
      (s.gender || '').toLowerCase() === 'male' || 
      (s.gender || '').toLowerCase() === 'ছেলে' || 
      (s.gender || '').toLowerCase() === 'm'
    ).length;

    const female = yearStudents.filter(s => 
      (s.gender || '').toLowerCase() === 'female' || 
      (s.gender || '').toLowerCase() === 'মেয়ে' || 
      (s.gender || '').toLowerCase() === 'f'
    ).length;

    return { total: yearStudents.length, active, inactive, male, female };
  }, [students, selectedAcademicYear]);

  // 2. Exam Metrics (Only re-computes when exams or academic year change!)
  const { yearExams, examMetrics } = useMemo(() => {
    const filtered = (exams || []).filter(e => {
      if (!e) return false;
      if (selectedAcademicYear === 'ALL') return true;
      if (!e.academicYear) return true;
      return e.academicYear === selectedAcademicYear;
    });

    const active = filtered.filter(e => 
      e.status === 'IN_PROGRESS' || 
      e.status === 'MARKS_ENTRY' || 
      (!e.isFinalized && e.status !== 'ARCHIVED' && e.status !== 'FINALIZED')
    ).length;

    const scheduled = filtered.filter(e => 
      e.status === 'SCHEDULED' || (!e.status && !e.isFinalized)
    ).length;

    const finalized = filtered.filter(e => 
      e.isFinalized || e.status === 'FINALIZED' || e.status === 'COMPLETED'
    ).length;

    return {
      yearExams: filtered,
      examMetrics: { total: filtered.length, active, scheduled, finalized }
    };
  }, [exams, selectedAcademicYear]);

  // 3. Evaluation Pipeline Matrix (Computes only when marks, exams, classes, or students change)
  const { evaluationMetrics, examEvaluationMatrix } = useMemo(() => {
    const activeStudents = (students || []).filter(s => 
      s &&
      s.status === 'Active' && 
      !s.isFormer && 
      (selectedAcademicYear === 'ALL' || !s.academicYear || s.academicYear === selectedAcademicYear)
    );

    let expMarksTotal = 0;
    let entMarksTotal = 0;

    const matrix = (yearExams || []).map(exam => {
      const relevantClassNames = (exam.classIds && exam.classIds.length > 0)
        ? (classes || []).filter(c => c && (exam.classIds!.includes(c.id) || exam.classIds!.includes(c.name))).map(c => c.name)
        : (classes || []).map(c => c.name);

      const classBreakdown = relevantClassNames.map(clsName => {
        const clsStudents = activeStudents.filter(s => s && s.classLevel === clsName);
        const clsSubjects = (subjects || []).filter(s => {
          if (!s || s.classLevel !== clsName) return false;
          if (s.examIds && s.examIds.length > 0 && !s.examIds.includes(exam.id)) return false;
          return true;
        });

        const expectedForClass = clsStudents.length * clsSubjects.length;
        const studentIds = new Set(clsStudents.map(s => s.id));
        const subjectIds = new Set(clsSubjects.map(s => s.id));

        const enteredForClass = (marks || []).filter(m => 
          m &&
          m.examId === exam.id && 
          studentIds.has(m.studentId) && 
          subjectIds.has(m.subjectId) &&
          (m.obtained !== undefined || m.isAbsent)
        ).length;

        const pendingForClass = Math.max(0, expectedForClass - enteredForClass);
        const progressPct = expectedForClass > 0 ? Math.round((enteredForClass / expectedForClass) * 100) : 100;

        expMarksTotal += expectedForClass;
        entMarksTotal += enteredForClass;

        return {
          className: clsName,
          studentCount: clsStudents.length,
          subjectCount: clsSubjects.length,
          expectedMarks: expectedForClass,
          enteredMarks: enteredForClass,
          pendingMarks: pendingForClass,
          progress: progressPct,
          isCompleted: expectedForClass > 0 && enteredForClass >= expectedForClass
        };
      });

      const examExpected = classBreakdown.reduce((sum, c) => sum + c.expectedMarks, 0);
      const examEntered = classBreakdown.reduce((sum, c) => sum + c.enteredMarks, 0);
      const examPending = Math.max(0, examExpected - examEntered);
      const examProgress = examExpected > 0 ? Math.round((examEntered / examExpected) * 100) : 100;

      return {
        examId: exam.id,
        examName: exam.name,
        examNameBn: exam.nameBn,
        category: exam.category || 'Term',
        status: exam.status || (exam.isFinalized ? 'FINALIZED' : 'SCHEDULED'),
        isFinalized: !!exam.isFinalized,
        expectedMarks: examExpected,
        enteredMarks: examEntered,
        pendingMarks: examPending,
        progress: examProgress,
        classes: classBreakdown
      };
    });

    const pendingTotal = Math.max(0, expMarksTotal - entMarksTotal);
    const progressPercent = expMarksTotal > 0 ? Math.round((entMarksTotal / expMarksTotal) * 100) : (entMarksTotal > 0 ? 100 : 0);

    return {
      evaluationMetrics: {
        totalExpected: expMarksTotal,
        totalEntered: entMarksTotal,
        totalPending: pendingTotal,
        progressPercent
      },
      examEvaluationMatrix: matrix
    };
  }, [yearExams, classes, subjects, marks, students, selectedAcademicYear]);

  // 4. Finance Metrics (Only re-computes when transactions or academic year change!)
  const financeMetrics = useMemo<FinanceMetrics>(() => {
    const yearTransactions = (transactions || []).filter(tx => {
      if (selectedAcademicYear === 'ALL') return true;
      if (tx.academicYear) return tx.academicYear === selectedAcademicYear;
      if (tx.date) return tx.date.startsWith(selectedAcademicYear);
      return true;
    });

    const inc = yearTransactions
      .filter(tx => tx.type === 'INCOME' || tx.type === 'INFLOW' || tx.category === 'FEE' || !tx.type)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const exp = yearTransactions
      .filter(tx => tx.type === 'EXPENSE' || tx.type === 'OUTFLOW')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    return { totalIncome: inc, totalExpense: exp, netBalance: inc - exp };
  }, [transactions, selectedAcademicYear]);

  // 5. Structure Metrics
  const structureMetrics = useMemo<StructureMetrics>(() => {
    return {
      classesCount: classes.length,
      subjectsCount: subjects.length,
      teachersCount: teachers.length || 0
    };
  }, [classes, subjects, teachers]);

  // 6. Academic Performance & Results Analysis
  const {
    academicHealth,
    classCards,
    topStudents,
    atRiskStudents,
    gradeTiers,
    statusData
  } = useMemo(() => {
    const activeStudents = (students || []).filter(s => 
      s &&
      s.status === 'Active' && 
      !s.isFormer && 
      (selectedAcademicYear === 'ALL' || !s.academicYear || s.academicYear === selectedAcademicYear)
    );

    const effectiveTargetStudents = selectedClass === 'All'
      ? activeStudents
      : activeStudents.filter(s => s && s.classLevel === selectedClass);

    const effectiveExamId = selectedExamId === 'All' 
      ? (yearExams[0]?.id || '') 
      : selectedExamId;

    let passed = 0;
    let failed = 0;
    const gradeCounts: Record<string, number> = { 'A+': 0, 'A': 0, 'A-': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    const performers: Array<any> = [];

    if (effectiveExamId) {
      effectiveTargetStudents.forEach(student => {
        if (!student) return;
        const hasMarks = selectedExamId === 'All'
          ? (marks || []).some(m => m && m.studentId === student.id)
          : (marks || []).some(m => m && m.studentId === student.id && m.examId === effectiveExamId);

        if (!hasMarks) return;

        const classSubjectsInThisClass = (subjects || []).filter(s => s && s.classLevel === student.classLevel);
        const subjectsAssignedToThisExam = selectedExamId === 'All'
          ? classSubjectsInThisClass
          : classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(effectiveExamId));
        
        const anySubjectAssigned = subjectsAssignedToThisExam.length > 0;
        const validSubjects = classSubjectsInThisClass.filter(s => {
          const matchesGroup = !s.group || s.group === 'All' || s.group === student.group;
          if (!matchesGroup) return false;
          if (anySubjectAssigned) return s.examIds && s.examIds.includes(effectiveExamId);
          return true;
        });

        if (validSubjects.length === 0) return;

        const stats = calculateTotalGPA(validSubjects, marks, student.id, effectiveExamId, student.group, exams);
        
        if (stats.isFail) {
          failed++;
        } else {
          passed++;
        }

        if (gradeCounts[stats.grade] !== undefined) {
          gradeCounts[stats.grade]++;
        }

        performers.push({
          id: student.id,
          name: student.name,
          nameBn: student.nameBn,
          roll: student.roll,
          studentId: student.studentId || '',
          gpa: stats.gpa,
          grade: stats.grade,
          isFail: stats.isFail,
          group: student.group,
          classLevel: student.classLevel,
          totalMarks: stats.totalMarks,
          failCount: stats.failCount
        });
      });
    }

    const totalEvaluated = passed + failed;
    const passRate = totalEvaluated > 0 ? Number(((passed / totalEvaluated) * 100).toFixed(1)) : 0;
    const overallAverageGpa = totalEvaluated > 0 
      ? Number((performers.reduce((sum, s) => sum + s.gpa, 0) / totalEvaluated).toFixed(2)) 
      : 0;
    const aPlusCount = gradeCounts['A+'] || 0;

    // Build Class Summary Cards
    const cards = (classes || []).map(cls => {
      const clsStudents = activeStudents.filter(s => s && s.classLevel === cls.name);
      const clsPerf = performers.filter(s => s && s.classLevel === cls.name);
      const clsEvaluated = clsPerf.length;
      const clsPassed = clsPerf.filter(s => !s.isFail).length;
      const clsPassRate = clsEvaluated > 0 ? Math.round((clsPassed / clsEvaluated) * 100) : 0;
      const clsAvgGpa = clsEvaluated > 0 
        ? Number((clsPerf.reduce((sum, s) => sum + s.gpa, 0) / clsEvaluated).toFixed(2)) 
        : 0;

      return {
        id: cls.id,
        name: cls.name,
        nameBn: cls.nameBn,
        studentCount: clsStudents.length,
        evaluatedCount: clsEvaluated,
        passRate: clsPassRate,
        averageGpa: clsAvgGpa
      };
    });

    // Sorted top performers
    const sortedPerformers = [...performers].sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
    });

    // At-Risk students
    const atRisk = sortedPerformers
      .filter(s => s && (s.isFail || s.failCount > 0))
      .map(s => {
        const studentMarks = (marks || []).filter(m => 
          m &&
          m.studentId === s.id && 
          (selectedExamId === 'All' || m.examId === effectiveExamId)
        );
        const failedSubjectDetails: Array<{ name: string; marks: number; fullMarks: number }> = [];
        studentMarks.forEach(m => {
          const subj = (subjects || []).find(sub => sub && sub.id === m.subjectId);
          if (subj) {
            const passMark = subj.passMarks ?? 33;
            if ((m.obtained ?? 0) < passMark || m.isAbsent) {
              failedSubjectDetails.push({
                name: language === 'bn' ? (subj.nameBn || subj.name) : subj.name,
                marks: m.isAbsent ? 0 : (m.obtained ?? 0),
                fullMarks: subj.fullMarks || 100
              });
            }
          }
        });
        return { ...s, failedSubjectNames: failedSubjectDetails };
      });

    const tiers = [
      { name: 'A+ (৫.০০)', count: gradeCounts['A+'] || 0, fill: '#10b981' },
      { name: 'A (৪.০০)', count: gradeCounts['A'] || 0, fill: '#3b82f6' },
      { name: 'A- (৩.৫০)', count: gradeCounts['A-'] || 0, fill: '#6366f1' },
      { name: 'B (৩.০০)', count: gradeCounts['B'] || 0, fill: '#eab308' },
      { name: 'C (২.০০)', count: gradeCounts['C'] || 0, fill: '#f97316' },
      { name: 'D (১.০০)', count: gradeCounts['D'] || 0, fill: '#fb7185' },
      { name: 'F (ফেল)', count: gradeCounts['F'] || 0, fill: '#ef4444' }
    ];

    const statusChart = [
      { name: language === 'bn' ? 'পাস' : 'Passed', value: passed, fill: '#10b981' },
      { name: language === 'bn' ? 'ফেল' : 'Failed', value: failed, fill: '#ef4444' }
    ];

    return {
      academicHealth: { passRate, overallAverageGpa, aPlusCount },
      classCards: cards,
      topStudents: sortedPerformers,
      atRiskStudents: atRisk,
      gradeTiers: tiers,
      statusData: statusChart
    };
  }, [students, marks, subjects, classes, exams, yearExams, selectedAcademicYear, selectedExamId, selectedClass, language]);

  // Filtered top performers for search query
  const filteredTopStudents = useMemo(() => {
    if (!meritSearchQuery.trim()) return (topStudents || []).slice(0, 10);
    const q = meritSearchQuery.toLowerCase().trim();
    return (topStudents || []).filter(s => 
      s && (
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.nameBn && s.nameBn.includes(q)) || 
        (s.studentId && String(s.studentId).toLowerCase().includes(q)) ||
        (s.roll != null && String(s.roll).toLowerCase().includes(q))
      )
    ).slice(0, 15);
  }, [topStudents, meritSearchQuery]);

  return (
    <div id="madrasha-executive-dashboard" className="space-y-6 pb-12">
      
      {/* 0. Top Live Notice Board Marquee & Emergency Notification Alert */}
      <NoticeBoardAlertBanner onOpenNoticeBoard={() => setActiveTab('notice_board')} />

      {/* ধাপ ১ বাস্তবায়ন: প্রতিদিনের সামগ্রিক অবস্থা এক নজরে (Overview, আজকের উপস্থিতি, আজকের আয়–ব্যয়, শিক্ষার্থী ও জনবল, বকেয়া ফি, আসন্ন পরীক্ষা ও নোটিশ, সাম্প্রতিক কার্যক্রম) */}
      <DashboardDailyOverview 
        onNavigate={setActiveTab}
        selectedAcademicYear={selectedAcademicYear}
        onSelectAcademicYear={setSelectedAcademicYear}
        academicYears={academicYears}
        selectedExamId={selectedExamId}
        onSelectExamId={setSelectedExamId}
        yearExams={yearExams}
        onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)}
      />

      {/* 3. Memoized Quick Launchpad */}
      <QuickLaunchpad 
        onNavigate={setActiveTab}
        language={language}
      />

      {/* 4. Memoized Evaluation Pipeline */}
      <EvaluationPipeline 
        matrix={examEvaluationMatrix}
        progressPercent={evaluationMetrics.progressPercent}
        selectedAcademicYear={selectedAcademicYear}
        onSelectExamAndNavigate={(examId, tab) => {
          setSelectedExamId(examId);
          setActiveTab(tab);
        }}
        language={language}
      />

      {/* 5. Navigation Switcher */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveSectionTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSectionTab === 'overview' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'সার্বিক ওভারভিউ' : 'Overview'}
          </button>
          <button
            onClick={() => setActiveSectionTab('student')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSectionTab === 'student' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'শিক্ষার্থীর ট্র্যাকিং' : 'Student Trajectory'}
          </button>
          <button
            onClick={() => setActiveSectionTab('subjects')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSectionTab === 'subjects' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'বিষয়ভিত্তিক বিশ্লেষণ' : 'Subject Analytics'}
          </button>
          <button
            onClick={() => setActiveSectionTab('merit')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSectionTab === 'merit' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'মেধা তালিকা' : 'Merit List'}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{language === 'bn' ? 'নির্বাচিত সেশন:' : 'Session:'}</span>
          <span className="text-slate-800 font-bold">{toBanglaDigits(selectedAcademicYear, language)}</span>
        </div>
      </div>

      {/* 6. TAB CONTENT SECTIONS */}
      {activeSectionTab === 'overview' && (
        <div className="space-y-6">
          {/* Class Grid */}
          <ClassGrid classCards={classCards} language={language} />

          {/* Dual Visual Analytics Cards: Grade Tiers & Pass/Fail Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Grade Tier Chart Card */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {language === 'bn' ? 'গ্রেডভিত্তিক ফলাফল বিন্যাস' : 'Grade Distribution'}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {language === 'bn' ? 'A+ থেকে F পর্যন্ত গ্রেড পরিসংখ্যান' : 'Student counts across grade tiers'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeTiers} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip 
                      formatter={(val: any) => [`${toBanglaDigits(val, language)} জন`, 'শিক্ষার্থী']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {gradeTiers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pass vs Fail Ratio Card */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <PieIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {language === 'bn' ? 'পাস বনাম ফেল অনুপাত' : 'Pass vs Fail Ratio'}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {language === 'bn' ? 'সার্বিক প্রাতিষ্ঠানিক পাসের অনুপাত' : 'Overall institutional pass rate'}
                    </span>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {toBanglaDigits(academicHealth.passRate, language)}% {language === 'bn' ? 'পাস' : 'Pass'}
                </span>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [`${toBanglaDigits(val, language)} জন`, '']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[11px] font-semibold text-emerald-700 block">{language === 'bn' ? 'পাসকৃত' : 'Passed'}</span>
                  <span className="text-base font-bold text-emerald-950">
                    {toBanglaDigits(statusData.find(d => d.name === 'Passed' || d.name === 'পাস')?.value || 0, language)} {language === 'bn' ? 'জন' : ''}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                  <span className="text-[11px] font-semibold text-rose-700 block">{language === 'bn' ? 'ফেল' : 'Failed'}</span>
                  <span className="text-base font-bold text-rose-950">
                    {toBanglaDigits(statusData.find(d => d.name === 'Failed' || d.name === 'ফেল')?.value || 0, language)} {language === 'bn' ? 'জন' : ''}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Top 5 Honor Roll & At-Risk Quick Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top 5 Merit Performers */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                    <Award size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {language === 'bn' ? 'শীর্ষ মেধা তালিকা (টপ ৫)' : 'Top 5 Honor Roll'}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {language === 'bn' ? 'সর্বোচ্চ জিপিএ ও মোট নম্বরের ভিত্তিতে' : 'Highest GPA and marks achievers'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSectionTab('merit')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'bn' ? 'সম্পূর্ণ তালিকা' : 'View All'}</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="space-y-2">
                {topStudents.slice(0, 5).map((st, idx) => (
                  <div 
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/70 transition-all text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        idx === 0 ? 'bg-amber-400 text-amber-950' :
                        idx === 1 ? 'bg-slate-300 text-slate-900' :
                        idx === 2 ? 'bg-amber-600/30 text-amber-900' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {toBanglaDigits(idx + 1, language)}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 block truncate">
                          {language === 'bn' ? st.nameBn || st.name : st.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {st.classLevel} • {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(st.roll || '-', language)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-indigo-700 block">
                        GPA {toBanglaDigits(st.gpa.toFixed(2), language)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {toBanglaDigits(st.totalMarks, language)} {language === 'bn' ? 'নম্বর' : 'marks'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* At-Risk Students Panel */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {language === 'bn' ? 'বিশেষ যত্ন প্রয়োজন (ঝুঁকিপূর্ণ)' : 'At-Risk Students'}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {language === 'bn' ? 'এক বা একাধিক বিষয়ে অকৃতকার্য শিক্ষার্থী' : 'Students failing in 1 or more subjects'}
                    </span>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  {toBanglaDigits(atRiskStudents.length, language)} {language === 'bn' ? 'জন' : 'Students'}
                </span>
              </div>

              <div className="space-y-2">
                {atRiskStudents.slice(0, 5).map((st) => (
                  <div 
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 border border-rose-200/60 hover:bg-rose-50/70 transition-all text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-900 block truncate">
                        {language === 'bn' ? st.nameBn || st.name : st.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {st.classLevel} • {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(st.roll || '-', language)}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="rounded-full px-2.5 py-0.5 bg-rose-100 text-rose-800 font-bold text-xs">
                        {toBanglaDigits(st.failCount, language)} {language === 'bn' ? 'বিষয়ে ফেল' : 'fails'}
                      </span>
                    </div>
                  </div>
                ))}

                {atRiskStudents.length === 0 && (
                  <div className="text-center py-8 text-emerald-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} />
                    <span>{language === 'bn' ? 'আলহামদুলিল্লাহ! কোনো শিক্ষার্থী ঝুঁকিপূর্ণ তালিকায় নেই।' : 'No at-risk students recorded.'}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB B: STUDENT TRAJECTORY */}
      {activeSectionTab === 'student' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <StudentPerformanceCard 
            initialStudentId={topStudents[0]?.id}
            studentId={topStudents[0]?.id}
            initialClass={selectedClass !== 'All' ? selectedClass : undefined}
          />
        </div>
      )}

      {/* TAB C: SUBJECT ANALYTICS */}
      {activeSectionTab === 'subjects' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <SubjectPerformanceAnalytics 
            subjects={subjects}
            students={students}
            marks={marks}
            exams={exams}
            classes={classes}
            selectedExamId={selectedExamId}
            selectedClass={selectedClass}
            language={language}
            t={t}
            toBanglaDigits={(num) => toBanglaDigits(num, language)}
            getClassNameDisplay={(classLevel) => {
              if (language === 'bn') {
                const key = `cls_${classLevel.replace(/\s+/g, '')}`;
                return t ? (t(key as any) || classLevel) : classLevel;
              }
              return classLevel;
            }}
          />
        </div>
      )}

      {/* TAB D: MERIT LIST */}
      {activeSectionTab === 'merit' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {language === 'bn' ? 'প্রাতিষ্ঠানিক পূর্ণাঙ্গ মেধা তালিকা' : 'Institutional Merit Standings'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'জিপিএ, মোট নম্বর ও রোল অনুযায়ী মেধা ক্রম' : 'Official merit ranking by GPA, Total Marks, and Roll'}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                value={meritSearchQuery}
                onChange={(e) => setMeritSearchQuery(e.target.value)}
                placeholder={language === 'bn' ? 'নাম বা আইডি দিয়ে খুঁজুন...' : 'Search student...'}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200">
                  <th className="p-3 text-center w-12">{language === 'bn' ? 'র‌্যাংক' : 'Rank'}</th>
                  <th className="p-3">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'শ্রেণি' : 'Class'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'প্রাপ্ত নম্বর' : 'Total'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'জিপিএ' : 'GPA'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                  <th className="p-3 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTopStudents.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center font-bold">
                      <span className={`inline-block w-6 h-6 rounded-md leading-6 text-center ${
                        idx === 0 ? 'bg-amber-400 text-amber-950 font-bold' :
                        idx === 1 ? 'bg-slate-300 text-slate-900 font-bold' :
                        idx === 2 ? 'bg-amber-600/30 text-amber-900 font-bold' :
                        'text-slate-600'
                      }`}>
                        {toBanglaDigits(idx + 1, language)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">
                        {language === 'bn' ? st.nameBn || st.name : st.name}
                      </span>
                      <span className="text-[11px] text-slate-400">{st.studentId}</span>
                    </td>
                    <td className="p-3 text-center font-semibold">{st.classLevel}</td>
                    <td className="p-3 text-center">{toBanglaDigits(st.roll || '-', language)}</td>
                    <td className="p-3 text-center font-bold">{toBanglaDigits(st.totalMarks, language)}</td>
                    <td className="p-3 text-center font-bold text-indigo-700">
                      {toBanglaDigits(st.gpa.toFixed(2), language)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        st.grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                        st.grade === 'A' ? 'bg-blue-100 text-blue-800' :
                        st.grade === 'F' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {st.grade}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {st.isFail ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {language === 'bn' ? 'ফেল' : 'Fail'}
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {language === 'bn' ? 'উত্তীর্ণ' : 'Passed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
