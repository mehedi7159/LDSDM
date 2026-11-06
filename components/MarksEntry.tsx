import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { MarkRecord, Subject } from '../types';
import { formatNumber } from '../services/utils';
import { MARKS_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../services/cloudConfirm';
import { isMarkEntryAllowedForExam } from '../services/markEntryGate';
import { CheckCircle2, Loader2, Sparkles, AlertTriangle, Lock, UserCheck, ShieldAlert, Save, Users, UserPlus, BookOpen, Plus, Award, AlertCircle } from 'lucide-react';
import { calculateSubjectGrade, calculateSubjectGradePoint } from '../services/gradingEngine';
import { EmptyState } from './ui/EmptyState';
import { PageHeader } from './ui/PageHeader';

interface MarksEntryProps {
  onNavigate?: (tab: string) => void;
}

interface EditableMark {
  obtained: number | string;
  cq: number | string;
  mcq: number | string;
  practical: number | string;
  isAbsent: boolean;
  absentReason?: string;
}

interface MarkValidationResult {
  isValid: boolean;
  cqError?: string;
  mcqError?: string;
  practicalError?: string;
  obtainedError?: string;
}

const validateStudentMark = (mark: EditableMark | undefined, subject: Subject | undefined, language: string): MarkValidationResult => {
  if (!mark || !subject || mark.isAbsent) {
    return { isValid: true };
  }

  let isValid = true;
  let cqError: string | undefined;
  let mcqError: string | undefined;
  let practicalError: string | undefined;
  let obtainedError: string | undefined;

  // Validate CQ
  if (subject.hasCQ && mark.cq !== '' && mark.cq !== undefined && mark.cq !== null) {
    const numCQ = parseFloat(String(mark.cq));
    const maxCQ = subject.cqMarks ?? 0;
    if (isNaN(numCQ) || numCQ < 0 || numCQ > maxCQ) {
      isValid = false;
      cqError = numCQ > maxCQ 
        ? (language === 'bn' ? `সর্বোচ্চ ${formatNumber(maxCQ, language)}` : `Max: ${maxCQ}`)
        : (language === 'bn' ? 'অবৈধ নম্বর' : 'Invalid');
    }
  }

  // Validate MCQ
  if (subject.hasMCQ && mark.mcq !== '' && mark.mcq !== undefined && mark.mcq !== null) {
    const numMCQ = parseFloat(String(mark.mcq));
    const maxMCQ = subject.mcqMarks ?? 0;
    if (isNaN(numMCQ) || numMCQ < 0 || numMCQ > maxMCQ) {
      isValid = false;
      mcqError = numMCQ > maxMCQ 
        ? (language === 'bn' ? `সর্বোচ্চ ${formatNumber(maxMCQ, language)}` : `Max: ${maxMCQ}`)
        : (language === 'bn' ? 'অবৈধ নম্বর' : 'Invalid');
    }
  }

  // Validate Practical
  if (subject.hasPractical && mark.practical !== '' && mark.practical !== undefined && mark.practical !== null) {
    const numPractical = parseFloat(String(mark.practical));
    const maxPractical = subject.practicalMarks ?? 0;
    if (isNaN(numPractical) || numPractical < 0 || numPractical > maxPractical) {
      isValid = false;
      practicalError = numPractical > maxPractical 
        ? (language === 'bn' ? `সর্বোচ্চ ${formatNumber(maxPractical, language)}` : `Max: ${maxPractical}`)
        : (language === 'bn' ? 'অবৈধ নম্বর' : 'Invalid');
    }
  }

  // Validate Simple Obtained (when subject has no breakdown)
  if (!subject.hasCQ && !subject.hasMCQ && !subject.hasPractical && mark.obtained !== '' && mark.obtained !== undefined && mark.obtained !== null) {
    const numObtained = parseFloat(String(mark.obtained));
    const maxObtained = subject.fullMarks;
    if (isNaN(numObtained) || numObtained < 0 || numObtained > maxObtained) {
      isValid = false;
      obtainedError = numObtained > maxObtained 
        ? (language === 'bn' ? `সর্বোচ্চ ${formatNumber(maxObtained, language)}` : `Max: ${maxObtained}`)
        : (language === 'bn' ? 'অবৈধ নম্বর' : 'Invalid');
    }
  }

  // Validate Total Sum if breakdown exceeds fullMarks
  if ((subject.hasCQ || subject.hasMCQ || subject.hasPractical) && mark.obtained !== '' && mark.obtained !== undefined && mark.obtained !== null) {
    const numObtained = parseFloat(String(mark.obtained));
    if (numObtained > subject.fullMarks) {
      isValid = false;
      obtainedError = language === 'bn' ? `মোট সর্বোচ্চ ${formatNumber(subject.fullMarks, language)}` : `Max Total: ${subject.fullMarks}`;
    }
  }

  return { isValid, cqError, mcqError, practicalError, obtainedError };
};

export const MarksEntry: React.FC<MarksEntryProps> = ({ onNavigate }) => {
  const { 
    students, 
    subjects, 
    marks, 
    exams, 
    classes, 
    bulkUpdateMarks, 
    confirmMarksCloudSync,
    markEntryEnabled,
    t, 
    language, 
    authContext,
    isSuperAdmin,
    isAdmin,
    authUser,
    adminEmail
  } = useApp();

  const isOwnerAdmin = isSuperAdmin || (authUser?.email || adminEmail || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('saved');
  // Truthful-save Step 2-বাকি: the last marks list whose cloud
  // confirmation failed — kept for the retry button (re-confirm only,
  // the marks themselves are already saved locally).
  const [cloudFailure, setCloudFailure] = useState<string | null>(null);
  const lastFailedMarksRef = useRef<MarkRecord[] | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  // Local state to store edits for fast snappy input response
  const [localMarks, setLocalMarks] = useState<Record<string, EditableMark>>({});
  const pendingUpdatesRef = useRef<Record<string, EditableMark>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // DataScope Scoping
  const userScope = authContext?.dataScopes;
  const isScopedTeacher = !isSuperAdmin && !isAdmin && userScope && (!userScope.allClasses || !userScope.allSubjects);

  const allowedClasses = classes.filter(cls => {
    if (!isScopedTeacher || !userScope?.classes) return true;
    return userScope.classes.includes(cls.id) || userScope.classes.includes(cls.name);
  });

  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === selectedClass);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(selectedExamId));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const filteredSubjects = classSubjectsInThisClass
    .filter(s => {
      if (isScopedTeacher && userScope?.subjects) {
        if (!userScope.subjects.includes(s.id)) return false;
      }
      if (anySubjectAssignedToThisExam) {
        return s.examIds && s.examIds.includes(selectedExamId);
      }
      return true;
    });

  // Select first subject default
  useEffect(() => {
    if (filteredSubjects.length > 0) {
      if (!selectedSubjectId || !filteredSubjects.find(s => s.id === selectedSubjectId)) {
        setSelectedSubjectId(filteredSubjects[0].id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [selectedClass, selectedExamId, subjects, filteredSubjects]);

  // Select first exam default
  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams]);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentExam = exams.find(e => e.id === selectedExamId);
  const isExamLocked = !isOwnerAdmin && (currentExam?.status === 'FINALIZED' || currentExam?.status === 'ARCHIVED');

  // Admin mark-entry switches (Nov 2026): global OFF or this exam's
  // toggle OFF closes entry for EVERYONE here, including the owner
  // admin (unlike the FINALIZED lock above, which the owner bypasses)
  // — admin re-enables from Exam Management to enter again. Missing
  // flags = allowed. Entry inputs + Save honour the combined block.
  const isEntryClosedByAdmin = !isMarkEntryAllowedForExam(currentExam, markEntryEnabled);
  const isEntryDisabled = isExamLocked || isEntryClosedByAdmin;

  const enrolledStudents = students
    .filter(s => s.classLevel === selectedClass && s.status === 'Active' && !s.isFormer)
    .filter(s => {
      if (!currentSubject || !currentSubject.group || currentSubject.group === 'All') return true;
      return s.group === currentSubject.group;
    })
    .sort((a, b) => {
      if (sortBy === 'id') {
        return (a.studentId || '').localeCompare(b.studentId || '');
      }
      return a.name.localeCompare(b.name);
    });

  // Flush any pending auto-save immediately, skipping any invalid records
  const flushPendingSave = useCallback(async (): Promise<'saved' | 'error' | 'idle'> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (!currentSubject || !selectedExamId || isExamLocked) return 'idle';
    const studentIds = Object.keys(pendingUpdatesRef.current);
    if (studentIds.length === 0) return 'idle';

    // Admin switch gate: pending edits for a closed exam are refused,
    // never silently saved — the closed banner above explains why.
    // Pending edits are left untouched so they can still save if the
    // admin re-opens entry.
    if (isEntryClosedByAdmin) {
      setSaveStatus('error');
      return 'error';
    }

    const updates: (Omit<MarkRecord, 'id'> & { id?: string })[] = [];
    const remainingPending: Record<string, EditableMark> = {};

    studentIds.forEach(studentId => {
      const markData = pendingUpdatesRef.current[studentId];
      if (!markData) return;
      
      const validation = validateStudentMark(markData, currentSubject, language);
      if (!validation.isValid) {
        remainingPending[studentId] = markData;
        return;
      }

      const obtained = markData.obtained === '' ? 0 : Number(markData.obtained);
      const cq = markData.cq === '' ? undefined : Number(markData.cq);
      const mcq = markData.mcq === '' ? undefined : Number(markData.mcq);
      const practical = markData.practical === '' ? undefined : Number(markData.practical);

      updates.push({
        studentId,
        subjectId: currentSubject.id,
        examId: selectedExamId,
        obtained,
        obtainedCQ: cq,
        obtainedMCQ: mcq,
        obtainedPractical: practical,
        isAbsent: markData.isAbsent,
        absentReason: markData.absentReason,
        total: currentSubject.fullMarks,
        fullMarks: currentSubject.fullMarks,
        passMarks: currentSubject.passMarks
      });
    });

    // Truthful-save Step 2-বাকি: 'সংরক্ষিত' দেখায় শুধু cloud
    // confirm হলে। Failure-এ নম্বর ফোনেই থাকে (কখনো মোছা হয় না),
    // error দেখায় + retry-র জন্য list ধরে রাখে (auto-retry-ও চলে)।
    let nextMarks: MarkRecord[] | null = null;
    if (updates.length > 0) {
      nextMarks = bulkUpdateMarks(updates);
    }
    
    pendingUpdatesRef.current = remainingPending;
    // bulkUpdateMarks returns null when the exam closed after the
    // edits were typed — refuse, do not confirm anything.
    if (nextMarks === null) {
      setSaveStatus('error');
      return 'error';
    }
    if (nextMarks) {
      const result = await confirmMarksCloudSync(nextMarks);
      if (!result.success) {
        setCloudFailure(result.message || MARKS_CLOUD_FAILURE_MESSAGE);
        lastFailedMarksRef.current = nextMarks;
        setSaveStatus('error');
        return 'error';
      }
      setCloudFailure(null);
      lastFailedMarksRef.current = null;
    }
    if (Object.keys(remainingPending).length > 0) {
      setSaveStatus('error');
      return 'error';
    }
    setSaveStatus('saved');
    return 'saved';
  }, [currentSubject, selectedExamId, bulkUpdateMarks, confirmMarksCloudSync, language, isExamLocked, isEntryClosedByAdmin]);

  // Retry re-confirms the last failed marks list (never re-saves).
  const retryMarksCloudSync = async () => {
    const list = lastFailedMarksRef.current;
    if (!list) return;
    const result = await confirmMarksCloudSync(list);
    if (result.success) {
      setCloudFailure(null);
      lastFailedMarksRef.current = null;
      setSaveStatus('saved');
    } else {
      setCloudFailure(result.message || MARKS_CLOUD_FAILURE_MESSAGE);
    }
  };

  // Initialize local state when selection changes
  useEffect(() => {
    flushPendingSave();

    const initialMarks: Record<string, EditableMark> = {};
    if (currentSubject && selectedExamId) {
      enrolledStudents.forEach(student => {
        const existing = marks.find(m => 
          m.studentId === student.id && 
          m.subjectId === currentSubject.id && 
          m.examId === selectedExamId
        );
        initialMarks[student.id] = {
          obtained: existing ? existing.obtained : '',
          cq: existing?.obtainedCQ ?? '',
          mcq: existing?.obtainedMCQ ?? '',
          practical: existing?.obtainedPractical ?? '',
          isAbsent: existing?.isAbsent ?? false,
          absentReason: existing?.absentReason ?? ''
        };
      });
    }
    setLocalMarks(initialMarks);
    // Truthful-save Step 2-বাকি: flush নিজেই terminal status
    // ('saved'/'error') সেট করে — এখানে আর unconditional 'saved'
    // বসানো যাবে না, নইলে cloud-failure ঢাকা পড়বে।
  }, [selectedClass, selectedSubjectId, selectedExamId, currentSubject?.id]); 

  // Clean up on unmount
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleInputChange = (studentId: string, field: 'obtained' | 'cq' | 'mcq' | 'practical' | 'isAbsent' | 'absentReason', value: string | boolean) => {
    if (isExamLocked || isEntryClosedByAdmin) return;

    setLocalMarks(prev => {
      const current = prev[studentId] || { obtained: '', cq: '', mcq: '', practical: '', isAbsent: false };
      const updated = { ...current, [field]: value };
      
      if (field === 'isAbsent' && value === true) {
        updated.obtained = 0;
        updated.cq = 0;
        updated.mcq = 0;
        updated.practical = 0;
      }

      // Auto-calculate total if breakdown present
      if (currentSubject && (currentSubject.hasCQ || currentSubject.hasMCQ || currentSubject.hasPractical) && field !== 'isAbsent' && field !== 'absentReason') {
        const parse = (val: string | number | undefined | null) => (val === undefined || val === null || val === '') ? 0 : parseFloat(String(val));
        
        const cqVal = field === 'cq' ? parse(value as string) : parse(current.cq);
        const mcqVal = field === 'mcq' ? parse(value as string) : parse(current.mcq);
        const practicalVal = field === 'practical' ? parse(value as string) : parse(current.practical);
        updated.obtained = cqVal + mcqVal + practicalVal;
      }

      pendingUpdatesRef.current[studentId] = updated;

      const validation = validateStudentMark(updated, currentSubject, language);
      if (!validation.isValid) {
        setSaveStatus('error');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      } else {
        setSaveStatus('saving');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        const delay = field === 'isAbsent' ? 50 : 350;
        saveTimeoutRef.current = setTimeout(() => {
          flushPendingSave();
        }, delay);
      }

      return {
        ...prev,
        [studentId]: updated
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <PageHeader
        icon={Sparkles}
        title={language === 'bn' ? 'নম্বর এন্ট্রি ও মূল্যায়ন' : 'Marks Entry & Evaluation'}
      >
        <div className="flex items-center gap-3">
          {isExamLocked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-800">
              <Lock size={14} />
              {language === 'bn' ? 'পরীক্ষা চূড়ান্তকৃত (Read-Only)' : 'Finalized (Read-Only)'}
            </div>
          )}

          {isEntryClosedByAdmin && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800">
              <Lock size={14} />
              {language === 'bn' ? 'মার্ক এন্ট্রি বন্ধ (এডমিন)' : 'Marks entry closed (admin)'}
            </div>
          )}

          {/* Auto-Save Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700">
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-blue-600 dark:text-blue-400">{language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...'}</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">{language === 'bn' ? 'সংরক্ষিত' : 'Saved'}</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-400">{language === 'bn' ? 'ত্রুটি' : 'Error'}</span>
              </>
            )}
          </div>

          <button
            onClick={flushPendingSave}
            disabled={isEntryDisabled}
            className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            {language === 'bn' ? 'সেভ করুন' : 'Save'}
          </button>
        </div>
      </PageHeader>

      {/* Admin-switch closed banner (Nov 2026): entry refused while
          closed; pending edits stay untouched for a later re-open. No
          retry button — retrying a cloud confirm must never write
          marks for a closed exam. */}
      {isEntryClosedByAdmin && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-center gap-3">
          <Lock size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1 text-xs font-bold leading-relaxed">
            {language === 'bn'
              ? 'মার্ক এন্ট্রি এখন বন্ধ আছে — এডমিন এই পরীক্ষার জন্য এন্ট্রি বন্ধ রেখেছেন। এন্ট্রি চালু করতে Exam Management থেকে মার্ক এন্ট্রি খুলতে হবে।'
              : 'Marks entry is closed for this exam by the admin. Re-open it from Exam Management to enter marks again.'}
          </div>
        </div>
      )}

      {/* Truthful-save Step 2-বাকি: cloud-failure banner (marks stay local, retry re-confirms only) */}
      {cloudFailure && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 text-xs font-bold leading-relaxed">{cloudFailure}</div>
          <button
            type="button"
            onClick={retryMarksCloudSync}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
          >
            {language === 'bn' ? RETRY_LABEL : 'Retry'}
          </button>
        </div>
      )}

      {/* Control Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center w-full sm:w-auto">
          {/* Exam Selector */}
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[11px] font-bold text-gray-600 dark:text-slate-300">{t('exam')}:</label>
            <select
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 text-gray-900 dark:text-white w-full"
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[11px] font-bold text-gray-600 dark:text-slate-300">{t('selectClass')}:</label>
            <select
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 text-gray-900 dark:text-white w-full"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              {allowedClasses.map(c => (
                <option key={c.id} value={c.name}>{language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[11px] font-bold text-gray-600 dark:text-slate-300">{t('subject')}:</label>
            <select
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 text-gray-900 dark:text-white w-full sm:min-w-[200px]"
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
            >
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {language === 'bn' ? (s.nameBn || s.name) : s.name} (পূর্ণমান: {s.fullMarks})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Total Students Counter */}
        <div className="text-xs font-bold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-gray-100 dark:border-slate-800 self-stretch sm:self-auto text-center sm:text-left">
          {language === 'bn' ? `শিক্ষার্থী সংখ্যা: ${enrolledStudents.length} জন` : `Enrolled Students: ${enrolledStudents.length}`}
        </div>
      </div>

      {/* Marks Table or Friendly Empty State */}
      {filteredSubjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/80">
          <EmptyState
            icon={BookOpen}
            title={language === 'bn' ? `${selectedClass} শ্রেণীতে কোনো বিষয় যোগ করা হয়নি` : `No subjects found in ${selectedClass}`}
            description={language === 'bn' 
              ? 'প্রথমে বিষয় যোগ করুন।' 
              : 'Add a subject first.'}
            actionLabel={language === 'bn' ? 'প্রথম বিষয় যোগ করুন' : 'Add First Subject'}
            actionIcon={Plus}
            onAction={() => onNavigate ? onNavigate('subjects') : null}
            secondaryActionLabel={allowedClasses.length > 1 ? (language === 'bn' ? 'অন্য শ্রেণি নির্বাচন' : 'Change Class') : undefined}
            onSecondaryAction={() => {
              const nextClass = allowedClasses.find(c => c.name !== selectedClass);
              if (nextClass) setSelectedClass(nextClass.name);
            }}
            badge={language === 'bn' ? 'বিষয় অনুপস্থিত' : 'No Subjects'}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs w-16">রোল</th>
                  <th className="px-4 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs">শিক্ষার্থীর নাম</th>
                  
                  {currentSubject?.hasCQ && (
                    <th className="px-3 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-28">
                      CQ ({currentSubject.cqMarks})
                    </th>
                  )}

                  {currentSubject?.hasMCQ && (
                    <th className="px-3 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-28">
                      MCQ ({currentSubject.mcqMarks})
                    </th>
                  )}

                  {currentSubject?.hasPractical && (
                    <th className="px-3 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-28">
                      ব্যবহারিক ({currentSubject.practicalMarks})
                    </th>
                  )}

                  <th className="px-3 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-32">
                    মোট নম্বর ({currentSubject?.fullMarks || 100})
                  </th>

                  <th className="px-3 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-24">গ্রেড / GPA</th>
                  <th className="px-4 py-3 font-bold text-gray-700 dark:text-slate-200 text-xs text-center w-24">অনুপস্থিত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {enrolledStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 sm:p-12">
                      <EmptyState
                        icon={Users}
                        title={language === 'bn' ? `${selectedClass} শ্রেণীতে কোনো শিক্ষার্থী নেই` : `No students enrolled in ${selectedClass}`}
                        description={language === 'bn' 
                          ? 'প্রথমে শিক্ষার্থী ভর্তি করুন।' 
                          : 'Enroll a student first.'}
                        actionLabel={language === 'bn' ? 'শিক্ষার্থী ভর্তি করুন' : 'Add First Student'}
                        actionIcon={UserPlus}
                        onAction={() => onNavigate ? onNavigate('students') : null}
                        secondaryActionLabel={allowedClasses.length > 1 ? (language === 'bn' ? 'অন্য শ্রেণি দেখুন' : 'Switch Class') : undefined}
                        onSecondaryAction={() => {
                          const nextClass = allowedClasses.find(c => c.name !== selectedClass);
                          if (nextClass) setSelectedClass(nextClass.name);
                        }}
                        badge={language === 'bn' ? 'শূন্য শিক্ষার্থী' : 'No Students'}
                      />
                    </td>
                  </tr>
                ) : (
                enrolledStudents.map((student, idx) => {
                  const mark = localMarks[student.id] || { obtained: '', cq: '', mcq: '', practical: '', isAbsent: false };
                  const validation = validateStudentMark(mark, currentSubject, language);
                  const isAbsent = mark.isAbsent;
                  
                  const numObtained = mark.obtained === '' ? 0 : Number(mark.obtained);
                  const grade = calculateSubjectGrade(numObtained, currentSubject?.fullMarks, undefined, isAbsent, currentSubject?.passMarks);
                  const gradePoint = calculateSubjectGradePoint(numObtained, currentSubject?.fullMarks, undefined, isAbsent, currentSubject?.passMarks);

                  return (
                    <tr key={student.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/40'}>
                      <td className="px-4 py-3 font-mono font-bold text-xs text-gray-700 dark:text-slate-200">
                        {student.rollNumber || student.roll || idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 dark:text-white text-xs font-bangla">{student.name}</div>
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">{student.studentId || student.id}</div>
                      </td>

                      {/* CQ Input */}
                      {currentSubject?.hasCQ && (
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            disabled={isAbsent || isEntryDisabled}
                            value={mark.cq ?? ''}
                            onChange={e => handleInputChange(student.id, 'cq', e.target.value)}
                            className={`w-20 text-center border rounded-lg p-1.5 text-xs font-bold ${
                              validation.cqError ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200' : 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-gray-200 dark:border-slate-700'
                            } disabled:bg-gray-100 disabled:opacity-50`}
                            placeholder="0"
                          />
                        </td>
                      )}

                      {/* MCQ Input */}
                      {currentSubject?.hasMCQ && (
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            disabled={isAbsent || isEntryDisabled}
                            value={mark.mcq ?? ''}
                            onChange={e => handleInputChange(student.id, 'mcq', e.target.value)}
                            className={`w-20 text-center border rounded-lg p-1.5 text-xs font-bold ${
                              validation.mcqError ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200' : 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-gray-200 dark:border-slate-700'
                            } disabled:bg-gray-100 disabled:opacity-50`}
                            placeholder="0"
                          />
                        </td>
                      )}

                      {/* Practical Input */}
                      {currentSubject?.hasPractical && (
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            disabled={isAbsent || isEntryDisabled}
                            value={mark.practical ?? ''}
                            onChange={e => handleInputChange(student.id, 'practical', e.target.value)}
                            className={`w-20 text-center border rounded-lg p-1.5 text-xs font-bold ${
                              validation.practicalError ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200' : 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-gray-200 dark:border-slate-700'
                            } disabled:bg-gray-100 disabled:opacity-50`}
                            placeholder="0"
                          />
                        </td>
                      )}

                      {/* Total Obtained */}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          disabled={isAbsent || isEntryDisabled || currentSubject?.hasCQ || currentSubject?.hasMCQ || currentSubject?.hasPractical}
                          value={mark.obtained ?? ''}
                          onChange={e => handleInputChange(student.id, 'obtained', e.target.value)}
                          className={`w-24 text-center border rounded-lg p-1.5 text-xs font-black ${
                            validation.obtainedError ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200' : 'bg-gray-50 dark:bg-slate-800/60 text-blue-900 dark:text-blue-200 border-gray-200 dark:border-slate-700'
                          } disabled:opacity-75`}
                          placeholder="0"
                        />
                      </td>

                      {/* Grade / GPA preview */}
                      <td className="px-3 py-2 text-center">
                        {isAbsent ? (
                          <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">ABS</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className={`text-xs font-black px-2 py-0.5 rounded ${
                              grade === 'F' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                            }`}>
                              {grade}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
                              ({gradePoint.toFixed(1)})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Absent Toggle */}
                      <td className="px-4 py-2 text-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isEntryDisabled}
                            checked={isAbsent}
                            onChange={e => handleInputChange(student.id, 'isAbsent', e.target.checked)}
                            className="rounded text-red-600 dark:text-red-400 focus:ring-red-500"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};
