import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  BookOpen, 
  Award, 
  TrendingUp, 
  Filter, 
  Search, 
  HelpCircle, 
  Layers, 
  BarChart3, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  AlertCircle
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
  Cell 
} from 'recharts';
import { Subject, Student, MarkRecord, Exam, SchoolClass } from '../types';
import { calculateGrade } from '../services/utils';
import { Language } from '../services/translations';

interface SubjectPerformanceAnalyticsProps {
  subjects?: Subject[];
  students?: Student[];
  marks?: MarkRecord[];
  exams?: Exam[];
  classes?: SchoolClass[];
  selectedExamId?: string;
  selectedClass?: string;
  language?: Language;
  t?: (key: any) => string;
  toBanglaDigits?: (num: number | string) => string;
  getClassNameDisplay?: (classLevel: string) => string;
}

export interface SubjectStat {
  canonicalKey: string;
  name: string;
  nameBn?: string;
  code?: string;
  classes: string[];
  totalAppeared: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
  failRate: number;
  avgScorePercent: number;
  highestScorePercent: number;
  aPlusCount: number;
  aPlusRate: number;
  aGradeCount: number; // A+ and A
  status: 'EXCELLENT' | 'MODERATE' | 'NEEDS_ATTENTION';
  performanceScore: number;
  classBreakdown: Array<{
    classLevel: string;
    totalAppeared: number;
    totalPassed: number;
    totalFailed: number;
    passRate: number;
    failRate: number;
    avgScorePercent: number;
  }>;
}

export const SubjectPerformanceAnalytics: React.FC<SubjectPerformanceAnalyticsProps> = ({
  subjects: propSubjects,
  students: propStudents,
  marks: propMarks,
  exams: propExams,
  classes: propClasses,
  selectedExamId: propSelectedExamId,
  selectedClass: propSelectedClass,
  language: propLanguage,
  t: propT,
  toBanglaDigits: propToBanglaDigits,
  getClassNameDisplay: propGetClassNameDisplay
}) => {
  const context = useApp();

  const subjects = propSubjects ?? context.subjects ?? [];
  const students = propStudents ?? context.students ?? [];
  const marks = propMarks ?? context.marks ?? [];
  const exams = propExams ?? context.exams ?? [];
  const classes = propClasses ?? context.classes ?? [];
  const language = propLanguage ?? context.language ?? 'bn';
  const t = propT ?? context.t;

  const toBanglaDigits = propToBanglaDigits ?? ((num: number | string) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      '.': '.'
    };
    return str.split('').map(char => banglaNums[char] || char).join('');
  });

  const getClassNameDisplay = propGetClassNameDisplay ?? ((classLevel: string) => {
    if (language === 'bn') {
      const key = `cls_${classLevel.replace(/\s+/g, '')}`;
      return t ? (t(key as any) || classLevel) : classLevel;
    }
    return classLevel;
  });

  const selectedExamId = propSelectedExamId ?? (exams.length > 0 ? exams[0].id : 'ALL');
  const selectedClass = propSelectedClass ?? 'All';
  // Local Controls
  const [examScope, setExamScope] = useState<string>('current'); // 'current' or 'all'
  const [viewMode, setViewMode] = useState<'aggregated' | 'byClass'>('aggregated');
  const [filterCategory, setFilterCategory] = useState<'all' | 'strong' | 'weak'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSubjectKey, setExpandedSubjectKey] = useState<string | null>(null);

  // Active exam ID to filter on if scope is 'current'
  const effectiveExamId = examScope === 'current' ? selectedExamId : 'ALL';

  // Compute Subject Analytics
  const {
    aggregatedSubjects,
    topPerformingSubjects,
    weakestSubjects,
    overallPassRate,
    overallAvgScore,
    totalEvaluationsCount
  } = useMemo(() => {
    // 1. Filter marks based on selected scope
    const runningStudents = (students || []).filter(s => s && !s.isFormer && s.status !== 'Former');
    const studentMap = new Map<string, Student>(runningStudents.map(s => [s.id, s]));

    // Subject map for fast lookup
    const subjectMap = new Map<string, Subject>((subjects || []).map(s => [s.id, s]));

    interface MarkDetail {
      studentId: string;
      subjectId: string;
      classLevel: string;
      obtained: number;
      fullMarks: number;
      percentage: number;
      isFail: boolean;
      isAPlus: boolean;
      isAGrade: boolean;
    }

    const markDetails: MarkDetail[] = [];

    (marks || []).forEach(m => {
      if (!m) return;
      // Exam filter
      if (effectiveExamId !== 'ALL' && m.examId !== effectiveExamId) return;

      const student = studentMap.get(m.studentId);
      if (!student) return;

      // Class filter
      if (selectedClass !== 'All' && student.classLevel !== selectedClass) return;

      const sub = subjectMap.get(m.subjectId);
      if (!sub) return;

      const fullMarks = sub.fullMarks > 0 ? sub.fullMarks : 100;
      const obtained = m.obtained || 0;
      const percentage = (obtained / fullMarks) * 100;

      // Check Fail Criteria
      let isFail = false;
      if (m.isAbsent) {
        isFail = true;
      } else if (obtained < sub.passMarks) {
        isFail = true;
      } else if (sub.hasCQ && (m.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0)) {
        isFail = true;
      } else if (sub.hasMCQ && (m.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0)) {
        isFail = true;
      }

      const gradeObj = calculateGrade(obtained, fullMarks);
      const isAPlus = !isFail && gradeObj.grade === 'A+';
      const isAGrade = !isFail && (gradeObj.grade === 'A+' || gradeObj.grade === 'A');

      markDetails.push({
        studentId: student.id,
        subjectId: sub.id,
        classLevel: student.classLevel,
        obtained,
        fullMarks,
        percentage,
        isFail,
        isAPlus,
        isAGrade
      });
    });

    // 2. Group by canonical subject name (or individual subject if viewMode === 'byClass')
    const groups: Record<string, {
      canonicalKey: string;
      name: string;
      nameBn?: string;
      code?: string;
      classesSet: Set<string>;
      evaluations: MarkDetail[];
    }> = {};

    subjects.forEach(sub => {
      // If class filter is active
      if (selectedClass !== 'All' && sub.classLevel !== selectedClass) return;

      let key: string;
      if (viewMode === 'byClass') {
        key = `${sub.classLevel}_${sub.name}`;
      } else {
        // Canonical grouping across classes
        // Normalize Bengali or English subject title
        const rawName = (sub.nameBn || sub.name || '').trim();
        // Remove trailing class indicators if any
        key = rawName.toLowerCase();
      }

      if (!groups[key]) {
        groups[key] = {
          canonicalKey: key,
          name: sub.name,
          nameBn: sub.nameBn,
          code: sub.code,
          classesSet: new Set(),
          evaluations: []
        };
      }
      groups[key].classesSet.add(sub.classLevel);
      if (!groups[key].nameBn && sub.nameBn) groups[key].nameBn = sub.nameBn;
      if (!groups[key].code && sub.code) groups[key].code = sub.code;
    });

    // Populate evaluations into groups
    markDetails.forEach(md => {
      const sub = subjectMap.get(md.subjectId);
      if (!sub) return;

      let key: string;
      if (viewMode === 'byClass') {
        key = `${sub.classLevel}_${sub.name}`;
      } else {
        const rawName = (sub.nameBn || sub.name || '').trim();
        key = rawName.toLowerCase();
      }

      if (groups[key]) {
        groups[key].evaluations.push(md);
        groups[key].classesSet.add(md.classLevel);
      }
    });

    // 3. Calculate statistics for each group
    const statsList: SubjectStat[] = [];
    let globalPassed = 0;
    let globalTotalScore = 0;
    let globalCount = 0;

    Object.values(groups).forEach(grp => {
      const evals = grp.evaluations || [];
      const totalAppeared = evals.length;

      // Skip subjects with zero student marks recorded yet
      if (totalAppeared === 0) return;

      const totalFailed = (evals || []).filter(e => e.isFail).length;
      const totalPassed = totalAppeared - totalFailed;
      const passRate = (totalPassed / totalAppeared) * 100;
      const failRate = (totalFailed / totalAppeared) * 100;

      const sumPercent = (evals || []).reduce((sum, e) => sum + e.percentage, 0);
      const avgScorePercent = sumPercent / totalAppeared;
      const highestScorePercent = Math.max(...evals.map(e => e.percentage), 0);

      const aPlusCount = (evals || []).filter(e => e.isAPlus).length;
      const aPlusRate = (aPlusCount / totalAppeared) * 100;

      const aGradeCount = (evals || []).filter(e => e.isAGrade).length;

      // Composite Performance Score: High passRate + high average score + high A+ rate
      // Range ~0 to 100
      const performanceScore = (passRate * 0.45) + (avgScorePercent * 0.40) + (aPlusRate * 0.15);

      // Status classification
      let status: 'EXCELLENT' | 'MODERATE' | 'NEEDS_ATTENTION' = 'MODERATE';
      if (failRate >= 20 || avgScorePercent < 50) {
        status = 'NEEDS_ATTENTION';
      } else if (passRate >= 85 && avgScorePercent >= 65) {
        status = 'EXCELLENT';
      }

      // Class by class breakdown
      const classMap: Record<string, { total: number; passed: number; failed: number; sumPercent: number }> = {};
      evals.forEach(e => {
        if (!classMap[e.classLevel]) {
          classMap[e.classLevel] = { total: 0, passed: 0, failed: 0, sumPercent: 0 };
        }
        classMap[e.classLevel].total++;
        if (e.isFail) {
          classMap[e.classLevel].failed++;
        } else {
          classMap[e.classLevel].passed++;
        }
        classMap[e.classLevel].sumPercent += e.percentage;
      });

      const classBreakdown = Object.entries(classMap).map(([cLevel, cData]) => ({
        classLevel: cLevel,
        totalAppeared: cData.total,
        totalPassed: cData.passed,
        totalFailed: cData.failed,
        passRate: Number(((cData.passed / cData.total) * 100).toFixed(1)),
        failRate: Number(((cData.failed / cData.total) * 100).toFixed(1)),
        avgScorePercent: Number((cData.sumPercent / cData.total).toFixed(1))
      }));

      // Sort class breakdown by classes order
      const classOrderMap = new Map<string, number>(classes.map(c => [c.name, c.order]));
      classBreakdown.sort((a, b) => (classOrderMap.get(a.classLevel) ?? 99) - (classOrderMap.get(b.classLevel) ?? 99));

      statsList.push({
        canonicalKey: grp.canonicalKey,
        name: grp.name,
        nameBn: grp.nameBn,
        code: grp.code,
        classes: Array.from(grp.classesSet),
        totalAppeared,
        totalPassed,
        totalFailed,
        passRate: Number(passRate.toFixed(1)),
        failRate: Number(failRate.toFixed(1)),
        avgScorePercent: Number(avgScorePercent.toFixed(1)),
        highestScorePercent: Number(highestScorePercent.toFixed(1)),
        aPlusCount,
        aPlusRate: Number(aPlusRate.toFixed(1)),
        aGradeCount,
        status,
        performanceScore: Number(performanceScore.toFixed(1)),
        classBreakdown
      });

      globalPassed += totalPassed;
      globalTotalScore += sumPercent;
      globalCount += totalAppeared;
    });

    // 4. Identify Top Repeated High Performers and Repeated Low Performers
    // Sort for top performers: High score & High Pass Rate
    const sortedByHigh = [...statsList].sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return b.passRate - a.passRate;
    });

    // Sort for weakest performers: High Fail Rate first, then lowest average score
    const sortedByWeak = [...statsList].sort((a, b) => {
      if (b.failRate !== a.failRate) {
        return b.failRate - a.failRate;
      }
      return a.avgScorePercent - b.avgScorePercent;
    });

    const topPerforming = (sortedByHigh || []).filter(s => s && s.status === 'EXCELLENT').slice(0, 4);
    // If not enough strictly excellent, fallback to top 3 overall
    const topPerformingFinal = topPerforming.length > 0 ? topPerforming : (sortedByHigh || []).slice(0, 3);

    // Weakest: must have some failures or lowest average score
    const weakest = (sortedByWeak || []).filter(s => s && (s.failRate > 0 || s.avgScorePercent < 55)).slice(0, 4);
    const weakestFinal = weakest.length > 0 ? weakest : (sortedByWeak || []).slice(0, 3);

    const overallPass = globalCount > 0 ? (globalPassed / globalCount) * 100 : 0;
    const overallAvg = globalCount > 0 ? globalTotalScore / globalCount : 0;

    return {
      aggregatedSubjects: statsList,
      topPerformingSubjects: topPerformingFinal,
      weakestSubjects: weakestFinal,
      overallPassRate: Number(overallPass.toFixed(1)),
      overallAvgScore: Number(overallAvg.toFixed(1)),
      totalEvaluationsCount: globalCount
    };
  }, [subjects, students, marks, classes, effectiveExamId, selectedClass, viewMode]);

  // Filtered list for the table and chart
  const displayedSubjects = useMemo(() => {
    return (aggregatedSubjects || []).filter(sub => {
      if (!sub) return false;
      // Category filter
      if (filterCategory === 'strong' && sub.status !== 'EXCELLENT') return false;
      if (filterCategory === 'weak' && sub.status !== 'NEEDS_ATTENTION') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = sub.name ? sub.name.toLowerCase().includes(q) : false;
        const matchesNameBn = sub.nameBn?.toLowerCase().includes(q) || false;
        const matchesCode = sub.code?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesNameBn && !matchesCode) return false;
      }

      return true;
    }).sort((a, b) => {
      if (filterCategory === 'weak') {
        return b.failRate - a.failRate;
      }
      return b.performanceScore - a.performanceScore;
    });
  }, [aggregatedSubjects, filterCategory, searchQuery]);

  // Chart Data: Compare Average Score (%) vs Fail Rate (%)
  const chartData = useMemo(() => {
    return displayedSubjects.slice(0, 10).map(sub => {
      const displayName = language === 'bn' ? (sub.nameBn || sub.name) : sub.name;
      // Truncate long names for chart readability
      const shortName = displayName.length > 14 ? `${displayName.substring(0, 12)}...` : displayName;
      return {
        name: shortName,
        fullName: displayName,
        avgScore: sub.avgScorePercent,
        failRate: sub.failRate,
        passRate: sub.passRate,
        total: sub.totalAppeared,
        totalPassed: sub.totalPassed,
        totalFailed: sub.totalFailed,
        classes: sub.classes,
        status: sub.status
      };
    });
  }, [displayedSubjects, language]);

  if (totalEvaluationsCount === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-100/90 shadow-sm text-center py-12 space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <BarChart3 size={24} />
        </div>
        <h4 className="text-base font-bold text-slate-800">
          {language === 'bn' 
            ? 'বিষয়ভিত্তিক ধারাবাহিক বিশ্লেষণের তথ্য উপলব্ধ নয়' 
            : 'Subject Analytics Data Not Available'}
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          {language === 'bn'
            ? 'নির্বাচিত শ্রেণী বা পরীক্ষার জন্য এখনো পর্যাপ্ত নম্বর এন্ট্রি করা হয়নি। নম্বর এন্ট্রি সম্পন্ন হলে এখানে শিক্ষার্থীদের ধারাবাহিক সাফল্য ও দুর্বলতার বিষয়ভিত্তিক প্রেজেন্টেশন চার্ট প্রদর্শিত হবে।'
            : 'No evaluation marks recorded yet for the selected scope. Once marks are entered, comparative subject strength and weakness analytics will automatically appear here.'}
        </p>
      </div>
    );
  }

  const toggleExpand = (key: string) => {
    setExpandedSubjectKey(expandedSubjectKey === key ? null : key);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100/90 shadow-sm space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 size={22} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">
              {language === 'bn' 
                ? 'বিষয়ভিত্তিক ধারাবাহিক পারফরম্যান্স বিশ্লেষণ' 
                : 'Subject-wise Performance & Longitudinal Matrix'}
            </h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {language === 'bn'
              ? 'সকল শ্রেণীতে শিক্ষার্থীরা যেসব বিষয়ে বারবার চমৎকার ফলাফল করেছে এবং যেসব বিষয়ে ধারাবাহিক দুর্বলতা রয়েছে'
              : 'Identification of subjects where students consistently excel vs where recurring weaknesses occur across classes'}
          </p>
        </div>

        {/* View Mode & Scope Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Exam Scope Toggle */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setExamScope('current')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                examScope === 'current' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'bn' ? 'নির্বাচিত পরীক্ষা' : 'Selected Exam'}
            </button>
            <button
              onClick={() => setExamScope('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                examScope === 'all' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'bn' ? 'সকল পরীক্ষা (সামগ্রিক)' : 'All Exams Combined'}
            </button>
          </div>

          {/* Aggregated vs Individual View Mode */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setViewMode('aggregated')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'aggregated' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
              title={language === 'bn' ? 'বিভিন্ন শ্রেণীর একই বিষয় একসাথে মিলিয়ে বিশ্লেষণ' : 'Group same subjects across classes'}
            >
              {language === 'bn' ? 'সমষ্টিগত বিশ্লেষণ' : 'Combined Analysis'}
            </button>
            <button
              onClick={() => setViewMode('byClass')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'byClass' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'bn' ? 'শ্রেণীভিত্তিক পৃথক' : 'Class-by-Class'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            {language === 'bn' ? 'বিশ্লেষিত বিষয়' : 'Subjects Analyzed'}
          </span>
          <span className="text-xl font-black font-mono text-slate-800 mt-0.5 block">
            {toBanglaDigits((aggregatedSubjects || []).length)}
          </span>
        </div>
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 size={13} />
            {language === 'bn' ? 'ধারাবাহিক শীর্ষ বিষয়' : 'Consistently Strong'}
          </span>
          <span className="text-xl font-black font-mono text-emerald-800 mt-0.5 block">
            {toBanglaDigits((aggregatedSubjects || []).filter(s => s && s.status === 'EXCELLENT').length)}
          </span>
        </div>
        <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl">
          <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle size={13} />
            {language === 'bn' ? 'অধিক দুর্বলতাযুক্ত বিষয়' : 'Needs Attention'}
          </span>
          <span className="text-xl font-black font-mono text-rose-800 mt-0.5 block">
            {toBanglaDigits((aggregatedSubjects || []).filter(s => s && s.status === 'NEEDS_ATTENTION').length)}
          </span>
        </div>
        <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">
            {language === 'bn' ? 'সামগ্রিক পাসের হার' : 'Overall Pass Rate'}
          </span>
          <span className="text-xl font-black font-mono text-indigo-800 mt-0.5 block">
            {toBanglaDigits(overallPassRate)}%
          </span>
        </div>
      </div>

      {/* Dual Spotlight Cards: Strong vs Weak Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Spotlight 1: Repeated High Performers */}
        <div className="bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 border-2 border-emerald-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Award size={20} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-emerald-950">
                  {language === 'bn' ? 'ধারাবাহিক শীর্ষ সাফল্য অর্জনকারী বিষয়সমূহ' : 'Consistently Top-Performing Subjects'}
                </h4>
                <p className="text-xs text-emerald-700 font-medium">
                  {language === 'bn' 
                    ? 'শিক্ষার্থীরা যেসব বিষয়ে বারবার সর্বোচ্চ নম্বর ও সর্বোচ্চ পাসের হার অর্জন করেছে' 
                    : 'Subjects where students repeatedly score high with top pass rates'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
              {language === 'bn' ? 'সেরা ফলাফল' : 'Top Tier'}
            </span>
          </div>

          <div className="space-y-3">
            {topPerformingSubjects.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">
                {language === 'bn' ? 'কোনো বিষয় এই ক্যাটাগরিতে পাওয়া যায়নি' : 'No subjects matched criteria'}
              </p>
            ) : (
              topPerformingSubjects.map((sub, idx) => (
                <div 
                  key={sub.canonicalKey}
                  className="bg-white p-3.5 rounded-xl border border-emerald-100/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black font-mono">
                        {toBanglaDigits(idx + 1)}
                      </span>
                      <span className="font-extrabold text-slate-800 text-sm">
                        {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                      </span>
                      {sub.code && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          {sub.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 pl-7">
                      <span>{language === 'bn' ? 'শ্রেণীসমূহ:' : 'Classes:'}</span>
                      <span className="font-semibold text-slate-700">
                        {sub.classes.map(c => getClassNameDisplay(c)).join(', ')}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>{language === 'bn' ? 'মোট পরীক্ষার্থী:' : 'Evaluated:'}</span>
                      <strong className="font-mono text-slate-800">{toBanglaDigits(sub.totalAppeared)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        {language === 'bn' ? 'গড় নম্বর' : 'Avg Score'}
                      </span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {toBanglaDigits(sub.avgScorePercent)}%
                      </span>
                    </div>
                    <div className="h-7 w-px bg-slate-100 mx-1" />
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        {language === 'bn' ? 'পাসের হার' : 'Pass Rate'}
                      </span>
                      <span className="text-sm font-black text-slate-800 font-mono">
                        {toBanglaDigits(sub.passRate)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Spotlight 2: Repeated Low Performers */}
        <div className="bg-gradient-to-br from-rose-50/40 via-white to-rose-50/20 border-2 border-rose-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-rose-950">
                  {language === 'bn' ? 'পুনরাবৃত্ত দুর্বলতা ও বিশেষ যত্ন প্রয়োজন' : 'Recurring Weakness & At-Risk Subjects'}
                </h4>
                <p className="text-xs text-rose-700 font-medium">
                  {language === 'bn' 
                    ? 'শিক্ষার্থীরা যেসব বিষয়ে বিভিন্ন শ্রেণীতে বারবার অকৃতকার্য হয়েছে বা কম নম্বর পেয়েছে' 
                    : 'Subjects with recurring failures or low scores across classes'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black">
              {language === 'bn' ? 'নজর প্রয়োজন' : 'Needs Focus'}
            </span>
          </div>

          <div className="space-y-3">
            {weakestSubjects.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">
                {language === 'bn' ? 'কোনো বিষয়ে অস্বাভাবিক দুর্বলতা পরিলক্ষিত হয়নি' : 'No critical weaknesses recorded'}
              </p>
            ) : (
              weakestSubjects.map((sub, idx) => (
                <div 
                  key={sub.canonicalKey}
                  className="bg-white p-3.5 rounded-xl border border-rose-100/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black font-mono">
                        {toBanglaDigits(idx + 1)}
                      </span>
                      <span className="font-extrabold text-slate-800 text-sm">
                        {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                      </span>
                      {sub.code && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          {sub.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 pl-7">
                      <span>{language === 'bn' ? 'শ্রেণীসমূহ:' : 'Classes:'}</span>
                      <span className="font-semibold text-slate-700">
                        {sub.classes.map(c => getClassNameDisplay(c)).join(', ')}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>{language === 'bn' ? 'অকৃতকার্য শিক্ষার্থী:' : 'Failed:'}</span>
                      <strong className="font-mono text-rose-600 font-bold">{toBanglaDigits(sub.totalFailed)} {language === 'bn' ? 'জন' : ''}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        {language === 'bn' ? 'ফেল হার' : 'Fail Rate'}
                      </span>
                      <span className="text-sm font-black text-rose-600 font-mono">
                        {toBanglaDigits(sub.failRate)}%
                      </span>
                    </div>
                    <div className="h-7 w-px bg-slate-100 mx-1" />
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        {language === 'bn' ? 'গড় নম্বর' : 'Avg Score'}
                      </span>
                      <span className="text-sm font-black text-slate-800 font-mono">
                        {toBanglaDigits(sub.avgScorePercent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Visual Comparison Chart: Average Score vs Fail Rate */}
      <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp size={18} className="text-indigo-600" />
              {language === 'bn' 
                ? 'বিষয়ভিত্তিক তুলনামূলক ফলাফল: গড় নম্বর বনাম ফেলের হার' 
                : 'Comparative Subject Analytics: Average Score vs. Failure Rate'}
            </h4>
            <p className="text-xs text-slate-500">
              {language === 'bn' 
                ? 'উচ্চ গড় নম্বর সম্পন্ন সফল বিষয় এবং উচ্চ ফেলের হার বিশিষ্ট দুর্বল বিষয়সমূহের চাক্ষুষ চিত্র' 
                : 'Side-by-side visualization of student mastery vs. struggle rates across subjects'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-3 w-3 rounded-xs bg-indigo-600 inline-block" />
              {language === 'bn' ? 'গড় নম্বর (%)' : 'Average Score (%)'}
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="h-3 w-3 rounded-xs bg-rose-500 inline-block" />
              {language === 'bn' ? 'ফেলের হার (%)' : 'Fail Rate (%)'}
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                interval={0}
                angle={-15}
                textAnchor="end"
                stroke="#64748b" 
              />
              <YAxis 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 100]} 
                unit="%"
                stroke="#64748b" 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  const isExcellent = data.status === 'EXCELLENT';
                  const isWeak = data.status === 'NEEDS_ATTENTION';
                  return (
                    <div className="bg-white/95 backdrop-blur-xs p-3.5 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-2 min-w-[220px]">
                      <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate">{data.fullName}</span>
                        {isExcellent && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded shrink-0">
                            {language === 'bn' ? 'ধারাবাহিক সাফল্য' : 'Strong'}
                          </span>
                        )}
                        {isWeak && (
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded shrink-0">
                            {language === 'bn' ? 'বিশেষ যত্ন প্রয়োজন' : 'Needs Care'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4 text-indigo-700 font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block" />
                            {language === 'bn' ? 'গড় অর্জিত নম্বর:' : 'Avg Score:'}
                          </span>
                          <span className="font-mono font-black text-sm">{toBanglaDigits(data.avgScore)}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-700 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                            {language === 'bn' ? 'উত্তীর্ণ শিক্ষার্থী:' : 'Passed Students:'}
                          </span>
                          <span className="font-mono">{toBanglaDigits(data.totalPassed)} {language === 'bn' ? 'জন' : ''} ({toBanglaDigits(data.passRate)}%)</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-rose-600 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                            {language === 'bn' ? 'অকৃতকার্য শিক্ষার্থী:' : 'Failed Students:'}
                          </span>
                          <span className="font-mono">{toBanglaDigits(data.totalFailed)} {language === 'bn' ? 'জন' : ''} ({toBanglaDigits(data.failRate)}%)</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                          <span>{language === 'bn' ? 'মোট মূল্যায়িত শিক্ষার্থী:' : 'Total Evaluated:'}</span>
                          <span className="font-mono font-bold text-slate-700">{toBanglaDigits(data.total)} {language === 'bn' ? 'জন' : ''}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar 
                dataKey="avgScore" 
                name={language === 'bn' ? 'গড় নম্বর' : 'Avg Score'} 
                fill="#6366f1" 
                radius={[5, 5, 0, 0]} 
                barSize={16} 
              />
              <Bar 
                dataKey="failRate" 
                name={language === 'bn' ? 'ফেল হার' : 'Fail Rate'} 
                fill="#f43f5e" 
                radius={[5, 5, 0, 0]} 
                barSize={16} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comprehensive Deep-Dive Subject Table */}
      <div className="space-y-4">
        
        {/* Table Filters & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCategory === 'all' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'bn' ? 'সকল বিষয়' : 'All Subjects'} ({toBanglaDigits(aggregatedSubjects.length)})
            </button>
            <button
              onClick={() => setFilterCategory('strong')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCategory === 'strong' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              {language === 'bn' ? 'ধারাবাহিক শীর্ষ' : 'Top Performers'}
            </button>
            <button
              onClick={() => setFilterCategory('weak')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCategory === 'weak' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              {language === 'bn' ? 'অধিক দুর্বল' : 'Needs Attention'}
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={language === 'bn' ? 'বিষয় অনুসন্ধান...' : 'Search subject...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto border border-slate-200/70 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70">
                <th className="py-3 px-4">{language === 'bn' ? 'বিষয়' : 'Subject'}</th>
                <th className="py-3 px-3">{language === 'bn' ? 'শ্রেণীসমূহ' : 'Classes'}</th>
                <th className="py-3 px-3 text-center">{language === 'bn' ? 'মূল্যায়িত' : 'Appeared'}</th>
                <th className="py-3 px-3 text-right">{language === 'bn' ? 'গড় নম্বর' : 'Avg Score'}</th>
                <th className="py-3 px-3 text-right">{language === 'bn' ? 'পাসের হার' : 'Pass Rate'}</th>
                <th className="py-3 px-3 text-right">{language === 'bn' ? 'ফেলের হার' : 'Fail Rate'}</th>
                <th className="py-3 px-3 text-center">{language === 'bn' ? 'এ+ হার' : 'A+ Rate'}</th>
                <th className="py-3 px-3 text-center">{language === 'bn' ? 'মূল্যায়ন স্থিতি' : 'Status'}</th>
                <th className="py-3 px-3 text-center">{language === 'bn' ? 'বিস্তারিত' : 'Breakdown'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {displayedSubjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {language === 'bn' ? 'কোনো বিষয় খুঁজে পাওয়া যায়নি' : 'No subjects found matching filter'}
                  </td>
                </tr>
              ) : (
                displayedSubjects.map(sub => {
                  const isExpanded = expandedSubjectKey === sub.canonicalKey;
                  return (
                    <React.Fragment key={sub.canonicalKey}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</span>
                            {sub.code && (
                              <span className="text-[10px] text-slate-400 font-mono font-normal">
                                ({sub.code})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate">
                          {sub.classes.map(c => getClassNameDisplay(c)).join(', ')}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {toBanglaDigits(sub.totalAppeared)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {toBanglaDigits(sub.avgScorePercent)}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          {toBanglaDigits(sub.passRate)}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                          {sub.failRate > 0 ? `${toBanglaDigits(sub.failRate)}%` : '০%'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-indigo-700">
                          {toBanglaDigits(sub.aPlusRate)}% ({toBanglaDigits(sub.aPlusCount)})
                        </td>
                        <td className="py-3 px-3 text-center">
                          {sub.status === 'EXCELLENT' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={10} />
                              {language === 'bn' ? 'শীর্ষ সাফল্য' : 'Strong'}
                            </span>
                          ) : sub.status === 'NEEDS_ATTENTION' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={10} />
                              {language === 'bn' ? 'অধিক দুর্বল' : 'Weak'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {language === 'bn' ? 'সন্তোষজনক' : 'Moderate'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {sub.classBreakdown.length > 1 ? (
                            <button
                              onClick={() => toggleExpand(sub.canonicalKey)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              title={language === 'bn' ? 'শ্রেণীভিত্তিক বিস্তারিত দেখুন' : 'View class breakdown'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Class-by-Class Breakdown Sub-Row */}
                      {isExpanded && sub.classBreakdown.length > 1 && (
                        <tr className="bg-slate-50/90 border-y border-slate-200/60">
                          <td colSpan={9} className="p-3 pl-8">
                            <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs space-y-2">
                              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Layers size={14} className="text-indigo-600" />
                                {language === 'bn' 
                                  ? `${sub.nameBn || sub.name} এর শ্রেণীভিত্তিক ফলাফল পর্যালোচনা:` 
                                  : `Class-by-Class Breakdown for ${sub.name}:`}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                                {sub.classBreakdown.map(c => (
                                  <div 
                                    key={c.classLevel}
                                    className={`p-2.5 rounded-lg border ${
                                      c.failRate >= 25 
                                        ? 'bg-rose-50/40 border-rose-200' 
                                        : c.passRate >= 90 
                                          ? 'bg-emerald-50/40 border-emerald-200' 
                                          : 'bg-slate-50 border-slate-200/70'
                                    }`}
                                  >
                                    <div className="font-extrabold text-slate-800 flex justify-between">
                                      <span>{getClassNameDisplay(c.classLevel)}</span>
                                      <span className="text-[10px] text-slate-500">
                                        {toBanglaDigits(c.totalAppeared)} {language === 'bn' ? 'জন' : ''}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500">{language === 'bn' ? 'গড়:' : 'Avg:'} <strong className="text-slate-800 font-mono">{toBanglaDigits(c.avgScorePercent)}%</strong></span>
                                      <span className={c.failRate > 0 ? 'text-rose-600 font-bold font-mono' : 'text-emerald-700 font-mono'}>
                                        {c.failRate > 0 ? `${language === 'bn' ? 'ফেল' : 'Fail'}: ${toBanglaDigits(c.failRate)}%` : (language === 'bn' ? '১০০% পাস' : '100% Pass')}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actionable Pedagogical Recommendations */}
      <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-start gap-3">
        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
          <Sparkles size={18} />
        </div>
        <div className="space-y-1 text-xs">
          <h5 className="font-bold text-indigo-950">
            {language === 'bn' ? 'শিক্ষক ও প্রশাসনের জন্য পরামর্শমূলক দিকনির্দেশনা' : 'Actionable Academic Recommendations'}
          </h5>
          <p className="text-indigo-800 leading-relaxed">
            {language === 'bn' ? (
              <>
                {weakestSubjects.length > 0 ? (
                  <>
                    <strong className="text-rose-800">{weakestSubjects.map(s => s.nameBn || s.name).join(', ')}</strong> বিষয়গুলোতে একাধিক শ্রেণীতে ধারাবাহিক দুর্বলতা পরিলক্ষিত হয়েছে। সংশ্লিষ্ট বিষয়ভিত্তিক শিক্ষকদের সাথে পর্যালোচনা সভা, দুর্বল শিক্ষার্থীদের জন্য বিশেষ রিভিশন ক্লাস ও মডেল টেস্ট নেওয়ার সুপারিশ করা হচ্ছে।
                  </>
                ) : (
                  'মাদ্রাসার সকল বিষয়ে শিক্ষার্থীদের গড় পারফরম্যান্স সন্তোষজনক স্তরে রয়েছে।'
                )}
                {topPerformingSubjects.length > 0 && (
                  <span className="block mt-1 text-emerald-800">
                    <strong className="text-emerald-950">{topPerformingSubjects.map(s => s.nameBn || s.name).join(', ')}</strong> বিষয়ে শিক্ষার্থীদের মৌলিক ভিত্তি অত্যন্ত শক্তিশালী; এই সাফল্য অব্যাহত রাখতে নিয়মিত উৎসাহ প্রদান করুন।
                  </span>
                )}
              </>
            ) : (
              <>
                {weakestSubjects.length > 0 ? (
                  <>
                    Recurring weaknesses observed in <strong>{weakestSubjects.map(s => s.name).join(', ')}</strong> across classes. Consider targeted remedial sessions and diagnostic worksheets for lagging topics.
                  </>
                ) : (
                  'Student performance is well-balanced across all subjects.'
                )}
              </>
            )}
          </p>
        </div>
      </div>

    </div>
  );
};
