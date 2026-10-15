import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student, SchoolClass, Exam } from '../types';
import { 
  StudentPromotionItem, 
  PromotionAction, 
  RollAssignmentMode, 
  PromotionRuleMode,
  PromotionSessionConfig,
  PromotionHistoryRecord 
} from '../types/promotion';
import { 
  getNextClass, 
  computeClassExamPerformance, 
  buildInitialPromotionItems, 
  recalculateRollNumbers, 
  executeClassPromotion 
} from '../services/promotionService';
import { formatNumber, formatSafeDate } from '../services/utils';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { PromotionGazetteModal } from './PromotionGazetteModal';
import { 
  GraduationCap, 
  X, 
  ArrowRight, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Search, 
  RefreshCw, 
  Sliders, 
  History, 
  Printer, 
  Check, 
  ChevronRight,
  TrendingUp,
  Sparkles,
  Users,
  ShieldCheck,
  Calendar
} from 'lucide-react';

interface ClassPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClass?: string;
}

export const ClassPromotionModal: React.FC<ClassPromotionModalProps> = ({
  isOpen,
  onClose,
  initialClass
}) => {
  const { 
    students, 
    classes, 
    exams, 
    marks, 
    subjects, 
    academicYears, 
    schoolProfile, 
    language, 
    t,
    authUser,
    authClaims,
    isSuperAdmin,
    bulkPromoteStudents,
    promotionHistory,
    clearPromotionHistory
  } = useApp();

  // Active view tab: 'wizard' | 'history'
  const [activeView, setActiveView] = useState<'wizard' | 'history'>('wizard');

  // Selected gazette record to preview/print
  const [viewingGazette, setViewingGazette] = useState<PromotionHistoryRecord | null>(null);

  // Success summary modal state
  const [completedRecord, setCompletedRecord] = useState<PromotionHistoryRecord | null>(null);

  // Confirmation dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search & Filter inside promotion table
  const [tableSearch, setTableSearch] = useState('');
  const [filterAction, setFilterAction] = useState<'all' | 'promoted' | 'retained' | 'passed' | 'failed'>('all');

  // Form configuration state
  const [sourceClass, setSourceClass] = useState<string>('');
  const [examId, setExamId] = useState<string>('none');
  const [targetClass, setTargetClass] = useState<string>('');
  const [targetAcademicYear, setTargetAcademicYear] = useState<string>('');
  const [ruleMode, setRuleMode] = useState<PromotionRuleMode>('passed_only');
  const [minGpa, setMinGpa] = useState<number>(1.0);
  const [maxFailedSubjects, setMaxFailedSubjects] = useState<number>(0);
  const [rollMode, setRollMode] = useState<RollAssignmentMode>('merit');

  // Working promotion items state
  const [promotionItems, setPromotionItems] = useState<StudentPromotionItem[]>([]);

  // Initialize Source Class & Target Year
  useEffect(() => {
    if (!isOpen) return;

    // Pick initial source class
    const defaultSource = (initialClass && initialClass !== 'All') 
      ? initialClass 
      : (classes[0]?.name || '');
    setSourceClass(defaultSource);

    // Pick target academic year (e.g., current year + 1 or next year in list)
    const currentYearNum = parseInt(schoolProfile.academicYear || String(new Date().getFullYear()), 10);
    const nextYearStr = String(currentYearNum + 1);
    const existingNextYear = academicYears.find(y => y.name === nextYearStr);
    setTargetAcademicYear(existingNextYear ? existingNextYear.name : nextYearStr);

    // Pick latest exam if available
    if (exams && exams.length > 0) {
      const finalOrTermExam = exams.find(e => 
        e.category === 'Final' || 
        e.category === 'Term' || 
        e.name.toLowerCase().includes('annual') || 
        e.name.toLowerCase().includes('final') ||
        (e.nameBn && (e.nameBn.includes('বার্ষিক') || e.nameBn.includes('চূড়ান্ত')))
      );
      setExamId(finalOrTermExam ? finalOrTermExam.id : exams[0].id);
    } else {
      setExamId('none');
    }
  }, [isOpen, initialClass, classes, exams, academicYears, schoolProfile]);

  // When sourceClass changes, auto-detect target class
  useEffect(() => {
    if (!sourceClass) return;

    const { nextClass, isLastClass } = getNextClass(sourceClass, classes);
    if (nextClass) {
      setTargetClass(nextClass.name);
    } else if (isLastClass) {
      setTargetClass('GRADUATE');
    } else {
      setTargetClass(classes[0]?.name || '');
    }
  }, [sourceClass, classes]);

  // Students in source class
  const classStudents = useMemo(() => {
    if (!sourceClass) return [];
    return students.filter(
      s => (s.classLevel === sourceClass || s.classId === sourceClass) && !s.isFormer && s.status !== 'Former'
    );
  }, [students, sourceClass]);

  // Compute performance map whenever sourceClass or examId changes
  const performanceMap = useMemo(() => {
    if (!sourceClass || classStudents.length === 0) return {};
    return computeClassExamPerformance(
      classStudents,
      examId !== 'none' ? examId : undefined,
      marks,
      subjects,
      sourceClass,
      schoolProfile.gradingSystem
    );
  }, [classStudents, examId, marks, subjects, sourceClass, schoolProfile.gradingSystem]);

  // Re-generate promotion items when configuration, students, or performance changes
  useEffect(() => {
    if (!sourceClass || classStudents.length === 0) {
      setPromotionItems([]);
      return;
    }

    const { isLastClass } = getNextClass(sourceClass, classes);
    const config: PromotionSessionConfig = {
      sourceClassLevel: sourceClass,
      targetClassLevel: targetClass === 'GRADUATE' ? (language === 'bn' ? 'সমাপনী সম্পন্ন' : 'Graduated') : targetClass,
      examId: examId !== 'none' ? examId : undefined,
      targetAcademicYearId: targetAcademicYear,
      ruleMode,
      minGpa,
      maxFailedSubjects,
      rollAssignmentMode: rollMode
    };

    const items = buildInitialPromotionItems(
      classStudents,
      config,
      performanceMap,
      targetClass === 'GRADUATE' || isLastClass
    );

    setPromotionItems(items);
  }, [sourceClass, targetClass, targetAcademicYear, examId, ruleMode, minGpa, maxFailedSubjects, classStudents, performanceMap, classes, language]);

  // Handle re-calculating roll numbers when roll mode changes
  const handleRollModeChange = (mode: RollAssignmentMode) => {
    setRollMode(mode);
    setPromotionItems(prev => recalculateRollNumbers(prev, mode));
  };

  // Toggle individual student promotion action
  const setStudentAction = (studentId: string, action: PromotionAction) => {
    setPromotionItems(prev => {
      const updated = prev.map(item => {
        if (item.studentId === studentId) {
          return {
            ...item,
            action,
            selected: action === 'PROMOTE' || action === 'GRADUATE'
          };
        }
        return item;
      });
      return recalculateRollNumbers(updated, rollMode);
    });
  };

  // Inline edit of student's new roll
  const updateStudentNewRoll = (studentId: string, roll: string) => {
    setPromotionItems(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, newRoll: roll.trim() };
      }
      return item;
    }));
  };

  // Batch action: Promote All Passed
  const handlePromoteAllPassed = () => {
    setPromotionItems(prev => {
      const updated = prev.map(item => {
        const isPassed = item.examSummary ? item.examSummary.isPassed : true;
        const targetAction: PromotionAction = targetClass === 'GRADUATE' ? 'GRADUATE' : 'PROMOTE';
        return {
          ...item,
          action: isPassed ? targetAction : 'RETAIN',
          selected: isPassed
        };
      });
      return recalculateRollNumbers(updated, rollMode);
    });
  };

  // Batch action: Select All / Promote All
  const handlePromoteAll = () => {
    setPromotionItems(prev => {
      const targetAction: PromotionAction = targetClass === 'GRADUATE' ? 'GRADUATE' : 'PROMOTE';
      const updated = prev.map(item => ({
        ...item,
        action: targetAction,
        selected: true
      }));
      return recalculateRollNumbers(updated, rollMode);
    });
  };

  // Batch action: Retain All
  const handleRetainAll = () => {
    setPromotionItems(prev => {
      const updated = prev.map(item => ({
        ...item,
        action: 'RETAIN' as PromotionAction,
        selected: false
      }));
      return recalculateRollNumbers(updated, 'keep_existing');
    });
  };

  // Summary statistics
  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let promoteCount = 0;
    let retainCount = 0;
    let graduateCount = 0;
    let skipCount = 0;

    promotionItems.forEach(item => {
      if (item.examSummary?.isPassed) passed++;
      else if (item.examSummary && !item.examSummary.isPassed) failed++;

      if (item.action === 'PROMOTE') promoteCount++;
      else if (item.action === 'RETAIN') retainCount++;
      else if (item.action === 'GRADUATE') graduateCount++;
      else if (item.action === 'SKIP') skipCount++;
    });

    return {
      total: promotionItems.length,
      passed,
      failed,
      promoteCount,
      retainCount,
      graduateCount,
      skipCount
    };
  }, [promotionItems]);

  // Filtered list of students for display
  const displayItems = useMemo(() => {
    return promotionItems.filter(item => {
      // Action/Status filter
      if (filterAction === 'promoted' && item.action !== 'PROMOTE') return false;
      if (filterAction === 'retained' && item.action !== 'RETAIN') return false;
      if (filterAction === 'passed' && !item.examSummary?.isPassed) return false;
      if (filterAction === 'failed' && item.examSummary?.isPassed) return false;

      // Search term
      if (!tableSearch.trim()) return true;
      const term = tableSearch.toLowerCase().trim();
      const s = item.student;
      return (
        s.name.toLowerCase().includes(term) ||
        (s.nameBn && s.nameBn.includes(term)) ||
        (s.studentId && s.studentId.toLowerCase().includes(term)) ||
        (item.currentRoll && item.currentRoll.includes(term)) ||
        (item.newRoll && item.newRoll.includes(term))
      );
    });
  }, [promotionItems, filterAction, tableSearch]);

  // Handle final execution of promotion
  const handleExecutePromotion = async () => {
    setIsProcessing(true);
    try {
      const selectedExam = exams.find(e => e.id === examId);
      const targetClassDisplayName = targetClass === 'GRADUATE' 
        ? (language === 'bn' ? 'সমাপনী সম্পন্ন' : 'Graduated')
        : targetClass;

      const actor = {
        uid: authUser?.uid || 'admin_user',
        email: authUser?.email || '',
        name: authUser?.displayName || (isSuperAdmin ? 'Super Admin' : 'Administrator')
      };

      const { updatedStudents, historyRecord } = executeClassPromotion(
        students,
        promotionItems,
        {
          sourceClass,
          targetClass: targetClassDisplayName,
          examId: examId !== 'none' ? examId : undefined,
          examName: selectedExam ? selectedExam.name : undefined,
          academicYear: schoolProfile.academicYear || String(new Date().getFullYear()),
          targetAcademicYear: targetAcademicYear || String(new Date().getFullYear() + 1),
          actor
        }
      );

      await bulkPromoteStudents(updatedStudents, historyRecord);

      setIsConfirmOpen(false);
      setCompletedRecord(historyRecord);
    } catch (err) {
      console.error('Failed to execute promotion:', err);
      alert('Failed to execute promotion. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shadow-inner">
                <GraduationCap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">
                    {language === 'bn' ? 'শ্রেণি উত্তরণ ও মেধানুযায়ী রোল বরাদ্দ' : 'Class Promotion & Merit-Based Progression'}
                  </h3>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {language === 'bn' ? 'বাল্ক প্রমোশন' : 'Bulk Advancement'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {language === 'bn'
                    ? 'পরীক্ষার ফলাফল বা নিয়মের ভিত্তিতে শিক্ষার্থীদের পরবর্তী শ্রেণিতে উত্তীর্ণ করুন'
                    : 'Promote students to the next academic level at the end of an exam session'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Switcher: Wizard vs History */}
              <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveView('wizard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeView === 'wizard'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>{language === 'bn' ? 'উত্তরণ প্রক্রিয়া' : 'Promotion Wizard'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeView === 'history'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <History size={14} />
                  <span>{language === 'bn' ? 'ইতিহাস' : 'History'}</span>
                  {promotionHistory.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-emerald-500 text-white text-[10px] rounded-full font-bold">
                      {promotionHistory.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* VIEW: Promotion Wizard */}
          {activeView === 'wizard' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
              {/* Configuration Panel */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-indigo-600" />
                    <h4 className="font-bold text-slate-800 text-sm">
                      {language === 'bn' ? 'শ্রেণি ও পরীক্ষা সেশন নির্ধারণ' : 'Session & Academic Target Selection'}
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500">
                    {language === 'bn' ? 'চলতি শিক্ষাবর্ষ' : 'Current Session'}: <strong className="text-slate-700">{schoolProfile.academicYear}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {/* Source Class */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {language === 'bn' ? '১. বর্তমান শ্রেণি (উৎস)' : '1. Source (Current) Class'}
                    </label>
                    <select
                      value={sourceClass}
                      onChange={(e) => setSourceClass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    >
                      {classes.map(c => {
                        const count = students.filter(s => (s.classLevel === c.name || s.classId === c.name) && !s.isFormer && s.status !== 'Former').length;
                        return (
                          <option key={c.id} value={c.name}>
                            {c.nameBn || c.name} ({formatNumber(count, language)} {language === 'bn' ? 'জন' : 'students'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Exam Session */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {language === 'bn' ? '২. পরীক্ষা সেশন' : '2. Exam Session'}
                    </label>
                    <select
                      value={examId}
                      onChange={(e) => setExamId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    >
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.nameBn || e.name} ({e.category || 'Term'})
                        </option>
                      ))}
                      <option value="none">
                        {language === 'bn' ? '— পরীক্ষা ছাড়া সাধারণ উত্তরণ —' : '— Without Exam Marks —'}
                      </option>
                    </select>
                  </div>

                  {/* Target Class */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{language === 'bn' ? '৩. উত্তীর্ণ (পরবর্তী) শ্রেণি' : '3. Target (Next) Class'}</span>
                      <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check size={12} /> {language === 'bn' ? 'স্বয়ংক্রিয়' : 'Auto'}
                      </span>
                    </label>
                    <select
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-3 py-2 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>
                          {c.nameBn || c.name}
                        </option>
                      ))}
                      <option value="GRADUATE">
                        🎓 {language === 'bn' ? 'সমাপনী উত্তীর্ণ (গ্র্যাজুয়েট / প্রাক্তন)' : 'Graduated / Alumni'}
                      </option>
                    </select>
                  </div>

                  {/* Target Academic Year */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {language === 'bn' ? '৪. পরবর্তী শিক্ষাবর্ষ' : '4. Target Academic Year'}
                    </label>
                    <input
                      type="text"
                      value={targetAcademicYear}
                      onChange={(e) => setTargetAcademicYear(e.target.value)}
                      placeholder="e.g. 2027"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Second row: Promotion Rules & Roll Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                  {/* Promotion Rule Selectors */}
                  <div>
                    <span className="block font-semibold text-slate-700 mb-2">
                      {language === 'bn' ? 'উত্তরণের নীতি / শর্ত:' : 'Promotion Criteria:'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRuleMode('passed_only')}
                        className={`px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          ruleMode === 'passed_only'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {language === 'bn' ? 'পাসকৃতদের উত্তরণ (পাস মার্ক ও GPA > 0)' : 'Pass Only (GPA > 0)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRuleMode('all')}
                        className={`px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          ruleMode === 'all'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {language === 'bn' ? 'সকলকে উত্তরণ (General Promotion)' : 'All Students'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRuleMode('min_gpa')}
                        className={`px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          ruleMode === 'min_gpa'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {language === 'bn' ? 'শর্তসাপেক্ষ (Custom Criteria)' : 'Custom Criteria'}
                      </button>
                    </div>

                    {ruleMode === 'min_gpa' && (
                      <div className="flex items-center gap-4 mt-2.5 bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-900 font-medium">{language === 'bn' ? 'ন্যূনতম GPA:' : 'Min GPA:'}</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="5"
                            value={minGpa}
                            onChange={(e) => setMinGpa(parseFloat(e.target.value) || 0)}
                            className="w-16 bg-white border border-purple-300 rounded-md px-2 py-1 text-center font-bold text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-900 font-medium">{language === 'bn' ? 'সর্বোচ্চ ফেল বিষয়:' : 'Max Fails Allowed:'}</span>
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={maxFailedSubjects}
                            onChange={(e) => setMaxFailedSubjects(parseInt(e.target.value, 10) || 0)}
                            className="w-16 bg-white border border-purple-300 rounded-md px-2 py-1 text-center font-bold text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Roll Assignment Mode */}
                  <div>
                    <span className="block font-semibold text-slate-700 mb-2">
                      {language === 'bn' ? 'নতুন রোল নম্বর বরাদ্দ পদ্ধতি:' : 'New Roll Number Assignment:'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRollModeChange('merit')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          rollMode === 'merit'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Award size={14} />
                        <span>{language === 'bn' ? 'মেধানুযায়ী (১, ২, ৩...)' : 'By Exam Merit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRollModeChange('keep_existing')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          rollMode === 'keep_existing'
                            ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <RefreshCw size={14} />
                        <span>{language === 'bn' ? 'পূর্বের রোল অপরিবর্তিত' : 'Keep Existing Rolls'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRollModeChange('manual')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                          rollMode === 'manual'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <Sliders size={14} />
                        <span>{language === 'bn' ? 'ম্যানুয়াল / কাস্টম' : 'Manual Editing'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block">{language === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                  <span className="text-lg font-extrabold text-slate-800">{formatNumber(stats.total, language)}</span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-emerald-800 font-semibold block">{language === 'bn' ? 'পরীক্ষায় উত্তীর্ণ' : 'Passed'}</span>
                  <span className="text-lg font-extrabold text-emerald-700">
                    {formatNumber(stats.passed, language)}
                    <span className="text-xs font-normal text-emerald-600 ml-1">
                      ({stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-rose-800 font-semibold block">{language === 'bn' ? 'অনুত্তীর্ণ (ফেল)' : 'Failed'}</span>
                  <span className="text-lg font-extrabold text-rose-700">{formatNumber(stats.failed, language)}</span>
                </div>
                <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 shadow-2xs">
                  <span className="text-indigo-800 font-semibold block">{language === 'bn' ? 'উত্তীর্ণ হবে' : 'To Promote'}</span>
                  <span className="text-lg font-extrabold text-indigo-700">{formatNumber(stats.promoteCount, language)}</span>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-amber-800 font-semibold block">{language === 'bn' ? 'একই শ্রেণিতে থাকবে' : 'To Retain'}</span>
                  <span className="text-lg font-extrabold text-amber-700">{formatNumber(stats.retainCount, language)}</span>
                </div>
                <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200 shadow-2xs">
                  <span className="text-purple-800 font-semibold block">{language === 'bn' ? 'সমাপনী সম্পন্ন' : 'Graduating'}</span>
                  <span className="text-lg font-extrabold text-purple-700">{formatNumber(stats.graduateCount, language)}</span>
                </div>
              </div>

              {/* Table Toolbar & Search */}
              <div className="bg-white rounded-t-xl border border-b-0 border-slate-200 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder={language === 'bn' ? 'নাম বা রোল দিয়ে খুঁজুন...' : 'Search student or roll...'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 mr-1 flex items-center gap-1">
                    <Filter size={13} /> {language === 'bn' ? 'ফিল্টার:' : 'Filter:'}
                  </span>
                  {(['all', 'promoted', 'retained', 'passed', 'failed'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilterAction(f)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                        filterAction === f
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'all' ? (language === 'bn' ? 'সকল' : 'All') :
                       f === 'promoted' ? (language === 'bn' ? 'উত্তীর্ণ' : 'Promoted') :
                       f === 'retained' ? (language === 'bn' ? 'বহাল' : 'Retained') :
                       f === 'passed' ? (language === 'bn' ? 'পাস' : 'Passed') :
                       (language === 'bn' ? 'ফেল' : 'Failed')}
                    </button>
                  ))}
                </div>

                {/* Quick Batch Actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={handlePromoteAllPassed}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md font-semibold text-xs transition-colors"
                  >
                    {language === 'bn' ? 'পাসকৃতদের নির্বাচন' : 'Select All Passed'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePromoteAll}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-md font-semibold text-xs transition-colors"
                  >
                    {language === 'bn' ? 'সবাইকে উত্তরণ' : 'Promote All'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRetainAll}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-md font-semibold text-xs transition-colors"
                  >
                    {language === 'bn' ? 'সবাইকে বহাল' : 'Retain All'}
                  </button>
                </div>
              </div>

              {/* Student Promotion Interactive Table */}
              <div className="bg-white rounded-b-xl border border-slate-200 overflow-x-auto shadow-xs">
                {displayItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm">{language === 'bn' ? 'কোন শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}</p>
                    <p className="text-xs text-slate-400 mt-1">{language === 'bn' ? 'নির্বাচিত শ্রেণিতে কোন শিক্ষার্থী নথিভুক্ত নেই' : 'No active students enrolled in this class'}</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-12">{language === 'bn' ? 'মেধা' : 'Rank'}</th>
                        <th className="py-3 px-3 w-16 text-center">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                        <th className="py-3 px-4">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                        <th className="py-3 px-3 text-center">{language === 'bn' ? 'মোট প্রাপ্ত' : 'Obtained'}</th>
                        <th className="py-3 px-3 text-center">{language === 'bn' ? 'GPA ও গ্রেড' : 'GPA & Grade'}</th>
                        <th className="py-3 px-3 text-center">{language === 'bn' ? 'ফলাফল' : 'Result'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'উত্তরণ পদক্ষেপ (Action)' : 'Promotion Action'}</th>
                        <th className="py-3 px-3 text-center w-24 bg-emerald-50/70 text-emerald-900">{language === 'bn' ? 'নতুন রোল' : 'New Roll'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayItems.map((item) => {
                        const perf = item.examSummary;
                        const isPassed = perf ? perf.isPassed : true;
                        const isActionPromote = item.action === 'PROMOTE';
                        const isActionRetain = item.action === 'RETAIN';
                        const isActionGraduate = item.action === 'GRADUATE';

                        return (
                          <tr 
                            key={item.studentId}
                            className={`hover:bg-slate-50 transition-colors ${
                              isActionPromote ? 'bg-emerald-50/20' : 
                              isActionRetain ? 'bg-amber-50/20' : 
                              isActionGraduate ? 'bg-purple-50/20' : ''
                            }`}
                          >
                            {/* Merit Rank */}
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              {perf ? (
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                  perf.meritRank === 1 ? 'bg-amber-400 text-amber-950 font-black shadow-xs' :
                                  perf.meritRank === 2 ? 'bg-slate-300 text-slate-800 font-bold' :
                                  perf.meritRank === 3 ? 'bg-amber-600 text-white font-bold' :
                                  'text-slate-600'
                                }`}>
                                  {formatNumber(perf.meritRank, language)}
                                </span>
                              ) : '-'}
                            </td>

                            {/* Current Roll */}
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-600">
                              {item.currentRoll ? formatNumber(item.currentRoll, language) : '-'}
                            </td>

                            {/* Name & ID */}
                            <td className="py-2.5 px-4 font-medium text-slate-900">
                              <div>
                                <span className="font-bold">
                                  {language === 'bn' && item.student.nameBn ? item.student.nameBn : item.student.name}
                                </span>
                                {item.student.nameBn && language !== 'bn' && (
                                  <span className="block text-[11px] text-slate-500 font-normal">{item.student.nameBn}</span>
                                )}
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  ID: {item.student.studentId || item.student.id.substring(0, 8)}
                                </span>
                              </div>
                            </td>

                            {/* Total Obtained */}
                            <td className="py-2.5 px-3 text-center">
                              {perf && perf.totalFullMarks > 0 ? (
                                <div>
                                  <span className="font-bold text-slate-800">
                                    {formatNumber(perf.totalObtained, language)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    /{formatNumber(perf.totalFullMarks, language)} ({formatNumber(perf.percentage, language)}%)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* GPA & Grade */}
                            <td className="py-2.5 px-3 text-center font-bold">
                              {perf && perf.totalFullMarks > 0 ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="text-slate-800">{formatNumber(perf.gpa.toFixed(2), language)}</span>
                                  <span className={`px-1.5 py-0.2 rounded-xs text-[11px] font-bold ${
                                    perf.overallGrade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                                    perf.overallGrade === 'F' ? 'bg-rose-100 text-rose-800' :
                                    'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {perf.overallGrade}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            {/* Result & Fail info */}
                            <td className="py-2.5 px-3 text-center">
                              {perf && perf.totalFullMarks > 0 ? (
                                isPassed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 size={12} />
                                    <span>{language === 'bn' ? 'পাস' : 'Passed'}</span>
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                                      <AlertCircle size={12} />
                                      <span>{language === 'bn' ? 'ফেল' : 'Failed'} ({formatNumber(perf.failedSubjectCount, language)})</span>
                                    </span>
                                    {perf.failedSubjectNames && perf.failedSubjectNames.length > 0 && (
                                      <span className="text-[10px] text-rose-600 mt-0.5 max-w-[130px] truncate" title={perf.failedSubjectNames.join(', ')}>
                                        {perf.failedSubjectNames.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">{language === 'bn' ? 'মূল্যায়নহীন' : 'Unrated'}</span>
                              )}
                            </td>

                            {/* Action selector */}
                            <td className="py-2.5 px-4 text-center">
                              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setStudentAction(item.studentId, 'PROMOTE')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    isActionPromote
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title={language === 'bn' ? 'পরবর্তী শ্রেণিতে উত্তীর্ণ করুন' : 'Promote to next class'}
                                >
                                  {language === 'bn' ? 'উত্তীর্ণ' : 'Promote'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setStudentAction(item.studentId, 'RETAIN')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    isActionRetain
                                      ? 'bg-amber-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title={language === 'bn' ? 'একই শ্রেণিতে বহাল রাখুন' : 'Retain in same class'}
                                >
                                  {language === 'bn' ? 'বহাল' : 'Retain'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setStudentAction(item.studentId, 'GRADUATE')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    isActionGraduate
                                      ? 'bg-purple-600 text-white shadow-2xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title={language === 'bn' ? 'সমাপনী উত্তীর্ণ (গ্র্যাজুয়েট)' : 'Graduate'}
                                >
                                  🎓
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setStudentAction(item.studentId, 'SKIP')}
                                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                                    item.action === 'SKIP'
                                      ? 'bg-slate-700 text-white shadow-2xs'
                                      : 'text-slate-400 hover:text-slate-700'
                                  }`}
                                  title={language === 'bn' ? 'বাদ দিন' : 'Skip'}
                                >
                                  ✕
                                </button>
                              </div>
                            </td>

                            {/* New Roll Number Input */}
                            <td className="py-2.5 px-3 text-center bg-emerald-50/30">
                              {isActionPromote ? (
                                <input
                                  type="text"
                                  value={item.newRoll || ''}
                                  onChange={(e) => updateStudentNewRoll(item.studentId, e.target.value)}
                                  className="w-16 mx-auto bg-white border border-emerald-300 rounded-md px-2 py-1 text-center font-bold text-emerald-900 text-xs focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                                  placeholder="Roll"
                                />
                              ) : isActionRetain ? (
                                <span className="text-amber-800 font-semibold text-xs">
                                  {item.currentRoll ? formatNumber(item.currentRoll, language) : '-'} ({language === 'bn' ? 'বহাল' : 'Same'})
                                </span>
                              ) : isActionGraduate ? (
                                <span className="text-purple-700 font-bold text-xs">
                                  {language === 'bn' ? 'সমাপ্ত' : 'Alumni'}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bottom Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                  <span>
                    {language === 'bn'
                      ? `মোট ${formatNumber(stats.total, language)} জন শিক্ষার্থীর মধ্যে ${formatNumber(stats.promoteCount, language)} জন পরবর্তী শ্রেণি (${targetClass === 'GRADUATE' ? 'সমাপনী' : targetClass}) তে উত্তীর্ণ হবে।`
                      : `Promoting ${stats.promoteCount} of ${stats.total} students from ${sourceClass} to ${targetClass}.`}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="text-xs"
                  >
                    {t('cancel')}
                  </Button>

                  <Button
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={stats.promoteCount === 0 && stats.graduateCount === 0 && stats.retainCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 text-sm shadow-md flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    <span>
                      {language === 'bn' ? 'শ্রেণি উত্তরণ নিশ্চিত করুন' : 'Confirm & Execute Promotion'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: Promotion History Tab */}
          {activeView === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-base">
                    {language === 'bn' ? 'পূর্ববর্তী শ্রেণি উত্তরণের ইতিহাস ও গেজেট' : 'Past Promotion History & Gazettes'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {language === 'bn'
                      ? 'পূর্বে সম্পন্ন হওয়া সকল শ্রেণি উত্তরণের রেকর্ড এবং গেজেট প্রিন্ট করার সুবিধা'
                      : 'Review past promotion sessions and reprint official promotion gazettes'}
                  </p>
                </div>

                {promotionHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে সকল উত্তরণ ইতিহাস মুছে ফেলতে চান?' : 'Clear all promotion history?')) {
                        clearPromotionHistory();
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    {language === 'bn' ? 'ইতিহাস মুছে ফেলুন' : 'Clear History'}
                  </button>
                )}
              </div>

              {promotionHistory.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                  <History size={36} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-sm">{language === 'bn' ? 'এখনো কোন শ্রেণি উত্তরণ সম্পন্ন করা হয়নি' : 'No promotion history recorded yet'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === 'bn' ? 'উত্তরণ সম্পন্ন করলে তা এখানে সংরক্ষিত থাকবে' : 'Completed promotions will appear here'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {promotionHistory.map((rec) => (
                    <div 
                      key={rec.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {rec.sourceClass} ➔ {rec.targetClass}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                            {rec.academicYear} ➔ {rec.targetAcademicYear}
                          </span>
                          {rec.examName && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {rec.examName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{language === 'bn' ? 'তারিখ' : 'Date'}: {formatSafeDate(rec.timestamp, language === 'bn' ? 'bn-BD' : 'en-US')}</span>
                          <span>•</span>
                          <span>{language === 'bn' ? 'উত্তীর্ণ' : 'Promoted'}: <strong className="text-emerald-700">{formatNumber(rec.totalPromoted, language)}</strong></span>
                          <span>•</span>
                          <span>{language === 'bn' ? 'বহাল' : 'Retained'}: <strong className="text-amber-700">{formatNumber(rec.totalRetained, language)}</strong></span>
                          <span>•</span>
                          <span>{language === 'bn' ? 'কর্তৃপক্ষ' : 'By'}: {rec.promotedBy}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => setViewingGazette(rec)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 flex items-center gap-2"
                      >
                        <Printer size={15} />
                        <span>{language === 'bn' ? 'গেজেট দেখুন ও প্রিন্ট' : 'View & Print Gazette'}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={language === 'bn' ? 'শ্রেণি উত্তরণ নিশ্চিতকরণ' : 'Confirm Bulk Class Promotion'}
        message={
          language === 'bn'
            ? `আপনি কি নিশ্চিত যে ${sourceClass} শ্রেণির ${formatNumber(stats.promoteCount, language)} জন শিক্ষার্থীকে ${targetClass} শ্রেণিতে উত্তীর্ণ এবং নতুন রোল নম্বর বরাদ্দ করতে চান? এটি শিক্ষার্থীদের শ্রেণি ও রোল আপডেট করবে।`
            : `Are you sure you want to promote ${stats.promoteCount} students from ${sourceClass} to ${targetClass} for academic year ${targetAcademicYear}? This will update their class placement and roll numbers.`
        }
        confirmText={isProcessing ? (language === 'bn' ? 'উত্তরণ করা হচ্ছে...' : 'Promoting...') : (language === 'bn' ? 'হ্যাঁ, উত্তরণ সম্পন্ন করুন' : 'Yes, Execute Promotion')}
        cancelText={t('cancel')}
        confirmVariant="primary"
        onConfirm={handleExecutePromotion}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Success Modal / Action Dialog */}
      {completedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {language === 'bn' ? 'শ্রেণি উত্তরণ সফলভাবে সম্পন্ন হয়েছে!' : 'Class Promotion Completed Successfully!'}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {completedRecord.sourceClass} ➔ {completedRecord.targetClass} ({completedRecord.targetAcademicYear})
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs grid grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">{language === 'bn' ? 'উত্তীর্ণ' : 'Promoted'}</span>
                <span className="font-extrabold text-emerald-700 text-base">{formatNumber(completedRecord.totalPromoted, language)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{language === 'bn' ? 'বহাল' : 'Retained'}</span>
                <span className="font-extrabold text-amber-700 text-base">{formatNumber(completedRecord.totalRetained, language)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{language === 'bn' ? 'সমাপ্ত' : 'Graduated'}</span>
                <span className="font-extrabold text-purple-700 text-base">{formatNumber(completedRecord.totalGraduated, language)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => {
                  setViewingGazette(completedRecord);
                  setCompletedRecord(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 py-2.5 text-sm shadow-md"
              >
                <Printer size={16} />
                <span>{language === 'bn' ? 'অফিসিয়াল উত্তরণ গেজেট প্রিন্ট করুন' : 'Print Official Promotion Gazette'}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setCompletedRecord(null);
                  onClose();
                }}
                className="text-xs py-2 text-slate-600"
              >
                {language === 'bn' ? 'শিক্ষার্থী তালিকায় ফিরে যান' : 'Return to Student Registry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gazette Modal */}
      {viewingGazette && (
        <PromotionGazetteModal
          record={viewingGazette}
          onClose={() => setViewingGazette(null)}
        />
      )}
    </>
  );
};
