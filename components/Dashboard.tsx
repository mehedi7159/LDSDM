import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import React, { useState, useEffect, useMemo, memo, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
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
import { MadrasaReports } from './MadrasaReports';
import { SectionCard } from './ui/SectionCard';
import { ProgressBar } from './ui/ProgressBar';
import { calculateClassDuesSummary, getDueReminderMessage, type StudentDueProfile } from '../services/studentDuesService';
import { getAdmissionApplications } from '../services/admissionApplicationsService';
import { Phone, MessageCircle, LayoutDashboard, UserPlus } from 'lucide-react';

// The AI Master advisor is embedded in the Action & Advice view — lazy,
// exactly as in App.tsx, so the Overview view never pays its bundle cost.
const MasterPrincipalAiAdvisor = lazyWithRetry(() => import('./ai/MasterPrincipalAiAdvisor').then(m => ({ default: m.MasterPrincipalAiAdvisor })));

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
// 3. QUICK LAUNCHPAD — removed in Phase 3 Batch 1: the same nine actions now
// live in the brand hero footer of DashboardDailyOverview (PageHeader tiles),
// so the dashboard opens with one unified Tutor-pattern header instead of
// two stacked shortcut blocks. Navigation targets were identical.
// =========================================================================

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
    <SectionCard
      title={language === 'bn' ? 'টার্ম ও পরীক্ষার মূল্যায়ন পাইপলাইন' : 'Marks Evaluation & Result Pipeline'}
      icon={ListChecks}
      iconTone="amber"
      bodyClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      action={
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'সেশন অগ্রগতি:' : 'Session Progress:'}
          </span>
          <span className="rounded-full px-2.5 py-0.5 font-bold text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {toBanglaDigits(progressPercent, language)}%
          </span>
        </div>
      }
    >
        {matrix.map((matrixExam) => (
          <div
            key={matrixExam.examId}
            className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {language === 'bn' ? matrixExam.examNameBn || matrixExam.examName : matrixExam.examName}
                </h3>
                <span className="text-[11px] text-slate-400 block">
                  {matrixExam.category} • {toBanglaDigits(selectedAcademicYear, language)}
                </span>
              </div>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                matrixExam.isFinalized
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : matrixExam.progress >= 100
                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
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
                <span className="text-slate-500 dark:text-slate-400">{language === 'bn' ? 'অগ্রগতি' : 'Progress'}</span>
                <span className="text-slate-700 dark:text-slate-200 font-bold">{toBanglaDigits(matrixExam.progress, language)}%</span>
              </div>
              <ProgressBar
                value={matrixExam.progress}
                tone={matrixExam.progress >= 100 ? 'emerald' : matrixExam.progress >= 60 ? 'indigo' : 'amber'}
              />
            </div>

            {/* Classes breakdown list */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
              {matrixExam.classes.slice(0, 4).map((clsItem, cIdx) => (
                <div key={cIdx} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[120px]">
                    {clsItem.className}
                  </span>
                  <div>
                    {clsItem.isCompleted ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check size={11} /> {language === 'bn' ? 'সম্পন্ন' : 'Done'}
                      </span>
                    ) : clsItem.expectedMarks === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
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
                className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold text-center transition cursor-pointer"
              >
                {language === 'bn' ? 'রেজাল্ট' : 'Results'}
              </button>
            </div>
          </div>
        ))}
    </SectionCard>
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
    <SectionCard
      title={language === 'bn' ? 'শ্রেণিভিত্তিক শিক্ষার্থী ও পারফরম্যান্স খতিয়ান' : 'Class Enrolment & Performance Grid'}
      icon={GraduationCap}
      iconTone="purple"
      bodyClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
      action={
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
          {toBanglaDigits(classCards.length, language)} {language === 'bn' ? 'শ্রেণি' : 'Classes'}
        </span>
      }
    >
        {classCards.map(clsCard => (
          <div
            key={clsCard.id}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {clsCard.name}
              </h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                {toBanglaDigits(clsCard.studentCount, language)} {language === 'bn' ? 'জন' : 'students'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-medium">{language === 'bn' ? 'পাস' : 'Pass'}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">{toBanglaDigits(clsCard.passRate, language)}%</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px] font-medium">{language === 'bn' ? 'গড় GPA' : 'Avg GPA'}</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 text-xs">{toBanglaDigits(clsCard.averageGpa.toFixed(2), language)}</span>
              </div>
            </div>
          </div>
        ))}
    </SectionCard>
  );
});
ClassGrid.displayName = 'ClassGrid';

// =========================================================================
// 5B. URGENT NOTICES CARD (Overview view)
// The old notice marquee banner that sat above the hero was deleted at the
// owner's direction. Urgent/cancellation notices now live here — a compact
// card inside the Overview view, rendered only when such notices exist.
// =========================================================================
interface UrgentNoticeItem {
  id: string;
  title: string;
  category?: string;
  priority?: string;
  date?: string;
  createdAt?: string;
}

const UrgentNoticesCard = memo<{ notices: UrgentNoticeItem[]; language: string; onOpenNoticeBoard: () => void }>(({
  notices,
  language,
  onOpenNoticeBoard
}) => {
  if (notices.length === 0) return null;
  const isBn = language === 'bn';
  return (
    <SectionCard
      title={isBn ? 'জরুরি নোটিশ' : 'Urgent Notices'}
      icon={AlertTriangle}
      iconTone="rose"
      bodyClassName="space-y-2"
      action={
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          {toBanglaDigits(notices.length, language)} {isBn ? 'টি' : ''}
        </span>
      }
    >
      {notices.map(n => (
        <button
          key={n.id}
          onClick={onOpenNoticeBoard}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-left cursor-pointer"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span className="min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">{n.title}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {n.category} • {(n.date || n.createdAt || '').slice(0, 10)}
              </span>
            </span>
          </span>
          <ChevronRight size={14} className="text-rose-400 shrink-0" />
        </button>
      ))}
    </SectionCard>
  );
});
UrgentNoticesCard.displayName = 'UrgentNoticesCard';

// =========================================================================
// 5C. ACTION ROW (Action & Advice view) — one pending-task row
// =========================================================================
interface ActionRowProps {
  icon: React.ElementType;
  iconCls: string;
  title: string;
  detail?: string;
  count: number;
  language: string;
  onClick: () => void;
}

const ActionRow = memo<ActionRowProps>(({ icon: Icon, iconCls, title, detail, count, language, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all text-left cursor-pointer"
  >
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
      <Icon size={18} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="font-bold text-sm text-slate-900 dark:text-white block truncate">{title}</span>
      {detail && <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">{detail}</span>}
    </span>
    <span className="rounded-full px-2.5 py-1 text-xs font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
      {toBanglaDigits(count, language)}
    </span>
    <ChevronRight size={16} className="text-slate-400 shrink-0" />
  </button>
));
ActionRow.displayName = 'ActionRow';

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
    feeStructures = [],
    notices = [],
    staffLeaves = [],
    dailyStudentAttendance = [],
    teachers = [],
    currentUser,
    isOwnerAdmin,
    isSuperAdmin,
    currentMember,
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
  // Top-level dashboard split (owner directive): 'overview' = whole-madrasa
  // monitoring + reports; 'action' = AI Master advisor + live to-do list.
  const [activeView, setActiveView] = useState<'overview' | 'action'>('overview');
  const [activeSectionTab, setActiveSectionTab] = useState<'overview' | 'student' | 'subjects' | 'merit'>('overview');
  const [meritSearchQuery, setMeritSearchQuery] = useState<string>('');
  const [dashboardMode, setDashboardMode] = useState<string>(() => {
    return localStorage.getItem('ai_dashboard_mode') || 'standard';
  });

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

  // =========================================================================
  // ACTION & ADVICE DATA — every count below comes from a live record set;
  // nothing is estimated or invented.
  // =========================================================================

  // Urgent notices for the Overview card — the same predicate the deleted
  // above-hero banner used (urgent priority/category + cancellations).
  const urgentNotices = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (notices || [])
      .filter(n => {
        if (!n || n.isActive === false) return false;
        if (n.showAlertBanner === false) return false;
        if (n.expiresAt && String(n.expiresAt).slice(0, 10) < todayStr) return false;
        return n.priority === 'urgent' || n.category === 'urgent' || n.category === 'cancellation';
      })
      .sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')))
      .slice(0, 3);
  }, [notices]);

  const actionData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Classes whose daily attendance has not been recorded today
    //    (context dailyStudentAttendance mirrors the daily attendance service).
    const recordedClasses = new Set(
      (dailyStudentAttendance || []).filter(r => r && r.date === todayStr).map(r => r.classLevel)
    );
    const attendancePendingClasses = (classes || []).filter(c => {
      if (!c || c.status === 'INACTIVE') return false;
      const hasActiveStudents = (students || []).some(s => s && s.classLevel === c.name && s.status === 'Active' && !s.isFormer);
      return hasActiveStudents && !recordedClasses.has(c.name);
    });

    // 2 + 6. Marks entry pending, and results complete but not yet finalized
    //    (both read off the evaluation matrix computed above).
    const marksPendingExams = (examEvaluationMatrix || []).filter(m => !m.isFinalized && m.pendingMarks > 0);
    const totalPendingMarks = marksPendingExams.reduce((sum, m) => sum + (m.pendingMarks || 0), 0);
    const readyToFinalizeExams = (examEvaluationMatrix || []).filter(m => !m.isFinalized && m.expectedMarks > 0 && m.progress >= 100);

    // 3. Fee dues follow-up — the same calculator Finance and the staff
    //    mobile app use (studentDuesService).
    const activeStudents = (students || []).filter(s => s && s.status === 'Active' && !s.isFormer);
    const duesSummary = calculateClassDuesSummary(activeStudents, feeStructures, transactions);
    const dueProfiles = (duesSummary.profiles || [])
      .filter(p => p.dueThisMonth > 0)
      .sort((a, b) => b.dueThisMonth - a.dueThisMonth);

    // 4. Admission applications awaiting a decision (canonical store).
    let pendingAdmissions: ReturnType<typeof getAdmissionApplications> = [];
    try {
      pendingAdmissions = getAdmissionApplications().filter(a => a.status === 'pending' || a.status === 'interview_called');
    } catch {
      pendingAdmissions = [];
    }

    // 5. Staff leave applications awaiting approval.
    const pendingLeaves = (staffLeaves || []).filter(l => l && l.status === 'PENDING');

    // Badge on the Action & Advice button: total pending items across all
    // categories (classes + exams + due students + applications + leaves
    // + results awaiting finalize).
    const badgeCount =
      attendancePendingClasses.length +
      marksPendingExams.length +
      dueProfiles.length +
      pendingAdmissions.length +
      pendingLeaves.length +
      readyToFinalizeExams.length;

    return {
      attendancePendingClasses,
      marksPendingExams,
      totalPendingMarks,
      readyToFinalizeExams,
      duesSummary,
      dueProfiles,
      topDueProfiles: dueProfiles.slice(0, 5),
      pendingAdmissions,
      pendingLeaves,
      badgeCount
    };
    // activeView is a deliberate dep: admission applications live outside
    // React state (canonical local store), so re-read them on view switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, students, dailyStudentAttendance, examEvaluationMatrix, feeStructures, transactions, staffLeaves, activeView]);

  // WhatsApp fee-reminder link — the same pattern as StaffMobileApp.
  const duesWhatsappLink = (profile: StudentDueProfile) => {
    const phone = String(profile.student.guardianPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;
    const intl = phone.startsWith('880') ? phone : '880' + phone.replace(/^0/, '');
    const text = getDueReminderMessage(
      profile.student.nameBn || profile.student.name,
      profile.classLevel,
      profile.dueThisMonth,
      schoolProfile?.nameBn || schoolProfile?.name || ''
    );
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  // Same visibility rule the removed AI promo card used.
  const canSeeAdvisor = isOwnerAdmin || isSuperAdmin || currentUser?.role === 'principal' || currentMember?.roleId === 'role_principal' || currentUser?.email === SUPER_ADMIN_EMAIL;

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

      {/* HERO — brand PageHeader (school name, date/session, quick-action
          tiles). Nothing renders above the hero anymore: the notice marquee
          banner that used to sit here was deleted at the owner's direction;
          urgent notices now appear as a compact card inside Overview. */}
      <DashboardDailyOverview
        section="hero"
        onNavigate={setActiveTab}
        selectedAcademicYear={selectedAcademicYear}
        onSelectAcademicYear={setSelectedAcademicYear}
        academicYears={academicYears}
        selectedExamId={selectedExamId}
        onSelectExamId={setSelectedExamId}
        yearExams={yearExams}
        onOpenRecoveryModal={() => setIsRecoveryModalOpen(true)}
      />

      {/* VIEW SWITCHER — the two dashboard halves (owner directive):
          Overview for whole-madrasa monitoring, Action & Advice for the
          AI Master + live to-do list. Directly below the hero. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex items-center gap-3.5 p-4 sm:p-5 rounded-3xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
            activeView === 'overview'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${activeView === 'overview' ? 'bg-white/15 text-white' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300'}`}>
            <LayoutDashboard size={20} />
          </span>
          <span className="font-black text-base sm:text-lg">{language === 'bn' ? 'ওভারভিউ' : 'Overview'}</span>
        </button>

        <button
          onClick={() => setActiveView('action')}
          className={`flex items-center gap-3.5 p-4 sm:p-5 rounded-3xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
            activeView === 'action'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${activeView === 'action' ? 'bg-white/15 text-white' : 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300'}`}>
            <Sparkles size={20} />
          </span>
          <span className="font-black text-base sm:text-lg flex-1">{language === 'bn' ? 'কাজ ও পরামর্শ' : 'Action & Advice'}</span>
          {actionData.badgeCount > 0 && (
            <span className="rounded-full px-3 py-1 text-xs font-black bg-rose-500 text-white shadow shrink-0">
              {toBanglaDigits(actionData.badgeCount, language)}
            </span>
          )}
        </button>
      </div>

      {activeView === 'overview' && (<>

      {/* Urgent notices — compact card inside Overview (the alert content of
          the deleted above-hero banner lives here now; self-hides when none) */}
      <UrgentNoticesCard
        notices={urgentNotices}
        language={language}
        onOpenNoticeBoard={() => setActiveTab('notice_board')}
      />

      <MadrasaReports />

      {/* REPORTS ACCESS — daily / weekly / monthly reporting lives in the
          existing report modules; these are direct doors to them from the
          Overview (no report engines rebuilt here). */}
      <SectionCard
        title={language === 'bn' ? 'প্রতিবেদন' : 'Reports'}
        icon={FileSpreadsheet}
        iconTone="indigo"
        bodyClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
      >
        {[
          { tab: 'admin_reports', bn: 'প্রাতিষ্ঠানিক রিপোর্ট', en: 'Institutional Reports', icon: Building2 },
          { tab: 'finance_reports', bn: 'আর্থিক রিপোর্ট', en: 'Finance Reports', icon: Wallet },
          { tab: 'attendance_reports', bn: 'হাজিরা রিপোর্ট', en: 'Attendance Reports', icon: UserCheck },
          { tab: 'student_reports', bn: 'শিক্ষার্থী রিপোর্ট', en: 'Student Reports', icon: Users },
          { tab: 'academic_reports', bn: 'একাডেমিক রিপোর্ট', en: 'Academic Reports', icon: BookOpen }
        ].map(r => {
          const RIcon = r.icon;
          return (
            <button
              key={r.tab}
              onClick={() => setActiveTab(r.tab)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-all text-left cursor-pointer"
            >
              <RIcon size={16} className="text-indigo-600 dark:text-indigo-300 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{language === 'bn' ? r.bn : r.en}</span>
            </button>
          );
        })}
      </SectionCard>

        <div className="space-y-6">
          {/* Class Grid */}
          <ClassGrid classCards={classCards} language={language} />

          {/* Dual Visual Analytics Cards: Grade Tiers & Pass/Fail Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Grade Tier Chart Card */}
            <SectionCard
              title={language === 'bn' ? 'গ্রেডভিত্তিক ফলাফল বিন্যাস' : 'Grade Distribution'}
              icon={BarChart3}
              iconTone="indigo"
            >
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
            </SectionCard>

            {/* Pass vs Fail Ratio Card */}
            <SectionCard
              title={language === 'bn' ? 'পাস বনাম ফেল অনুপাত' : 'Pass vs Fail Ratio'}
              icon={PieIcon}
              iconTone="emerald"
              className="flex flex-col justify-between"
              bodyClassName="space-y-4 flex flex-col justify-between flex-1"
              action={
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {toBanglaDigits(academicHealth.passRate, language)}% {language === 'bn' ? 'পাস' : 'Pass'}
                </span>
              }
            >

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

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">{language === 'bn' ? 'পাসকৃত' : 'Passed'}</span>
                  <span className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                    {toBanglaDigits(statusData.find(d => d.name === 'Passed' || d.name === 'পাস')?.value || 0, language)} {language === 'bn' ? 'জন' : ''}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                  <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 block">{language === 'bn' ? 'ফেল' : 'Failed'}</span>
                  <span className="text-base font-bold text-rose-950 dark:text-rose-100">
                    {toBanglaDigits(statusData.find(d => d.name === 'Failed' || d.name === 'ফেল')?.value || 0, language)} {language === 'bn' ? 'জন' : ''}
                  </span>
                </div>
              </div>
            </SectionCard>

          </div>

          {/* Top 5 Honor Roll & At-Risk Quick Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top 5 Merit Performers */}
            <SectionCard
              title={language === 'bn' ? 'শীর্ষ মেধা তালিকা (টপ ৫)' : 'Top 5 Honor Roll'}
              icon={Award}
              iconTone="amber"
              bodyClassName="space-y-2"
              action={
                <button
                  onClick={() => setActiveSectionTab('merit')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'bn' ? 'সম্পূর্ণ তালিকা' : 'View All'}</span>
                  <ChevronRight size={13} />
                </button>
              }
            >
                {topStudents.slice(0, 5).map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-all text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        idx === 0 ? 'bg-amber-400 text-amber-950' :
                        idx === 1 ? 'bg-slate-300 text-slate-900' :
                        idx === 2 ? 'bg-amber-600/30 text-amber-900 dark:text-amber-200' :
                        'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}>
                        {toBanglaDigits(idx + 1, language)}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {language === 'bn' ? st.nameBn || st.name : st.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {st.classLevel} • {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(st.roll || '-', language)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-indigo-700 dark:text-indigo-300 block">
                        GPA {toBanglaDigits(st.gpa.toFixed(2), language)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {toBanglaDigits(st.totalMarks, language)} {language === 'bn' ? 'নম্বর' : 'marks'}
                      </span>
                    </div>
                  </div>
                ))}
            </SectionCard>

            {/* At-Risk Students Panel */}
            <SectionCard
              title={language === 'bn' ? 'বিশেষ যত্ন প্রয়োজন (ঝুঁকিপূর্ণ)' : 'At-Risk Students'}
              subtitle={language === 'bn' ? 'এক বা একাধিক বিষয়ে অকৃতকার্য শিক্ষার্থী' : 'Students failing in 1 or more subjects'}
              icon={AlertTriangle}
              iconTone="rose"
              bodyClassName="space-y-2"
              action={
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {toBanglaDigits(atRiskStudents.length, language)} {language === 'bn' ? 'জন' : 'Students'}
                </span>
              }
            >
                {atRiskStudents.slice(0, 5).map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 transition-all text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">
                        {language === 'bn' ? st.nameBn || st.name : st.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {st.classLevel} • {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(st.roll || '-', language)}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="rounded-full px-2.5 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold text-xs">
                        {toBanglaDigits(st.failCount, language)} {language === 'bn' ? 'বিষয়ে ফেল' : 'fails'}
                      </span>
                    </div>
                  </div>
                ))}

                {atRiskStudents.length === 0 && (
                  <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} />
                    <span>{language === 'bn' ? 'আলহামদুলিল্লাহ! কোনো শিক্ষার্থী ঝুঁকিপূর্ণ তালিকায় নেই।' : 'No at-risk students recorded.'}</span>
                  </div>
                )}
            </SectionCard>

          </div>

        </div>
      </>)}

      {activeView === 'action' && (<>

        {/* AI MASTER — the advisor leads this view, embedded in place
            (same visibility rule the old promo card used). */}
        {canSeeAdvisor && (
          <Suspense fallback={
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 animate-pulse">
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-72 max-w-full bg-slate-100 dark:bg-slate-800/70 rounded-lg mt-3" />
            </div>
          }>
            <MasterPrincipalAiAdvisor onNavigateTab={(tab) => setActiveTab(tab)} />
          </Suspense>
        )}

        {/* TO-DO — pending work from live records only; a category with
            nothing pending simply does not appear. */}
        <SectionCard
          title={language === 'bn' ? 'আজকের করণীয়' : "Today's To-Do"}
          icon={ListChecks}
          iconTone="amber"
          bodyClassName="space-y-2.5"
          action={actionData.badgeCount > 0 ? (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {toBanglaDigits(actionData.badgeCount, language)} {language === 'bn' ? 'টি বাকি' : 'pending'}
            </span>
          ) : undefined}
        >
          {actionData.attendancePendingClasses.length > 0 && (
            <ActionRow
              icon={UserCheck}
              iconCls="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300"
              title={language === 'bn' ? 'আজকের হাজিরা নেওয়া হয়নি' : "Today's attendance not taken"}
              detail={
                actionData.attendancePendingClasses.slice(0, 4).map(c => language === 'bn' ? (c.nameBn || c.name) : c.name).join(', ') +
                (actionData.attendancePendingClasses.length > 4 ? ` +${toBanglaDigits(actionData.attendancePendingClasses.length - 4, language)}` : '')
              }
              count={actionData.attendancePendingClasses.length}
              language={language}
              onClick={() => setActiveTab('attendance')}
            />
          )}

          {actionData.marksPendingExams.length > 0 && (
            <ActionRow
              icon={PenTool}
              iconCls="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300"
              title={language === 'bn' ? 'নম্বর এন্ট্রি বাকি' : 'Marks entry pending'}
              detail={language === 'bn'
                ? `মোট ${toBanglaDigits(actionData.totalPendingMarks, language)}টি নম্বর বাকি`
                : `${actionData.totalPendingMarks} entries pending in total`}
              count={actionData.marksPendingExams.length}
              language={language}
              onClick={() => {
                const first = actionData.marksPendingExams[0];
                if (first) setSelectedExamId(first.examId);
                setActiveTab('marks');
              }}
            />
          )}

          {actionData.dueProfiles.length > 0 && (
            <ActionRow
              icon={Wallet}
              iconCls="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300"
              title={language === 'bn' ? 'বকেয়া ফি অনুসরণ' : 'Fee dues follow-up'}
              detail={language === 'bn'
                ? `মোট বকেয়া ৳${toBanglaDigits(actionData.duesSummary.totalDue.toLocaleString(), language)}`
                : `Total due ৳${actionData.duesSummary.totalDue.toLocaleString()}`}
              count={actionData.dueProfiles.length}
              language={language}
              onClick={() => setActiveTab('finance')}
            />
          )}

          {actionData.pendingAdmissions.length > 0 && (
            <ActionRow
              icon={UserPlus}
              iconCls="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300"
              title={language === 'bn' ? 'ভর্তির আবেদন অপেক্ষমাণ' : 'Admission applications pending'}
              count={actionData.pendingAdmissions.length}
              language={language}
              onClick={() => setActiveTab('admission_applications')}
            />
          )}

          {actionData.pendingLeaves.length > 0 && (
            <ActionRow
              icon={Calendar}
              iconCls="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300"
              title={language === 'bn' ? 'ছুটির আবেদন অপেক্ষমাণ' : 'Leave applications pending'}
              detail={
                actionData.pendingLeaves.slice(0, 2).map(l => l.teacherName).join(', ') +
                (actionData.pendingLeaves.length > 2 ? '…' : '')
              }
              count={actionData.pendingLeaves.length}
              language={language}
              onClick={() => setActiveTab('staff_leaves')}
            />
          )}

          {actionData.readyToFinalizeExams.length > 0 && (
            <ActionRow
              icon={CheckCheck}
              iconCls="bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-300"
              title={language === 'bn' ? 'ফলাফল চূড়ান্ত করার অপেক্ষায়' : 'Results ready to finalize'}
              detail={actionData.readyToFinalizeExams.map(m => language === 'bn' ? (m.examNameBn || m.examName) : m.examName).join(', ')}
              count={actionData.readyToFinalizeExams.length}
              language={language}
              onClick={() => {
                const first = actionData.readyToFinalizeExams[0];
                if (first) setSelectedExamId(first.examId);
                setActiveTab('results');
              }}
            />
          )}

          {actionData.badgeCount === 0 && (
            <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 size={18} />
              <span>{language === 'bn' ? 'সব কাজ সম্পন্ন — আজ আর কিছু বাকি নেই।' : 'All clear — nothing pending today.'}</span>
            </div>
          )}
        </SectionCard>

        {/* TOP DUES — the five largest follow-ups, with call / WhatsApp
            (same reminder pattern as the staff mobile app). */}
        {actionData.topDueProfiles.length > 0 && (
          <SectionCard
            title={language === 'bn' ? 'সর্বোচ্চ বকেয়া (শীর্ষ ৫)' : 'Top Fee Dues (Top 5)'}
            icon={Wallet}
            iconTone="rose"
            bodyClassName="space-y-2"
            action={
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                ৳{toBanglaDigits(actionData.duesSummary.totalDue.toLocaleString(), language)}
              </span>
            }
          >
            {actionData.topDueProfiles.map(p => {
              const waLink = duesWhatsappLink(p);
              const rawPhone = String(p.student.guardianPhone || '').replace(/[^0-9]/g, '');
              return (
                <div
                  key={p.student.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white block truncate">
                      {language === 'bn' ? p.student.nameBn || p.student.name : p.student.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {p.classLevel} • {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(p.student.roll || '-', language)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-black text-rose-600 dark:text-rose-300">
                      ৳{toBanglaDigits(p.dueThisMonth.toLocaleString(), language)}
                    </span>
                    {rawPhone && (
                      <a
                        href={`tel:${rawPhone}`}
                        className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center"
                        aria-label="Call guardian"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center"
                        aria-label="WhatsApp reminder"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </SectionCard>
        )}

      </>)}

    </div>
  );
};
