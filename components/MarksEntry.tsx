import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { MarkRecord, Subject } from '../types';
import { formatNumber } from '../services/utils';
import { CheckCircle2, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

interface EditableMark {
    obtained: number | string;
    cq: number | string;
    mcq: number | string;
    isAbsent: boolean;
}

interface MarkValidationResult {
  isValid: boolean;
  cqError?: string;
  mcqError?: string;
  obtainedError?: string;
}

const validateStudentMark = (mark: EditableMark | undefined, subject: Subject | undefined, language: string): MarkValidationResult => {
  if (!mark || !subject || mark.isAbsent) {
    return { isValid: true };
  }

  let isValid = true;
  let cqError: string | undefined;
  let mcqError: string | undefined;
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

  // Validate Simple Obtained (when subject has no CQ/MCQ breakdown)
  if (!subject.hasCQ && !subject.hasMCQ && mark.obtained !== '' && mark.obtained !== undefined && mark.obtained !== null) {
    const numObtained = parseFloat(String(mark.obtained));
    const maxObtained = subject.fullMarks;
    if (isNaN(numObtained) || numObtained < 0 || numObtained > maxObtained) {
      isValid = false;
      obtainedError = numObtained > maxObtained 
        ? (language === 'bn' ? `সর্বোচ্চ ${formatNumber(maxObtained, language)}` : `Max: ${maxObtained}`)
        : (language === 'bn' ? 'অবৈধ নম্বর' : 'Invalid');
    }
  }

  // Validate Total Sum if CQ/MCQ breakdown exceeds fullMarks
  if ((subject.hasCQ || subject.hasMCQ) && mark.obtained !== '' && mark.obtained !== undefined && mark.obtained !== null) {
    const numObtained = parseFloat(String(mark.obtained));
    if (numObtained > subject.fullMarks) {
      isValid = false;
      obtainedError = language === 'bn' ? `মোট সর্বোচ্চ ${formatNumber(subject.fullMarks, language)}` : `Max Total: ${subject.fullMarks}`;
    }
  }

  return { isValid, cqError, mcqError, obtainedError };
};

export const MarksEntry = () => {
  const { students, subjects, marks, exams, classes, bulkUpdateMarks, t, language } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('saved');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  // Local state to store edits for fast snappy input response
  const [localMarks, setLocalMarks] = useState<Record<string, EditableMark>>({});
  const pendingUpdatesRef = useRef<Record<string, EditableMark>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === selectedClass);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(selectedExamId));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const filteredSubjects = classSubjectsInThisClass
    .filter(s => {
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

  // Check if any mark in current table has an error
  const hasAnyInvalidMarks = (Object.values(localMarks) as EditableMark[]).some(m => !validateStudentMark(m, currentSubject, language).isValid);

  // Flush any pending auto-save immediately, skipping any invalid records
  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (!currentSubject || !selectedExamId) return;
    const studentIds = Object.keys(pendingUpdatesRef.current);
    if (studentIds.length === 0) return;

    const updates: (Omit<MarkRecord, 'id'> & { id?: string })[] = [];
    const remainingPending: Record<string, EditableMark> = {};

    studentIds.forEach(studentId => {
      const markData = pendingUpdatesRef.current[studentId];
      if (!markData) return;
      
      const validation = validateStudentMark(markData, currentSubject, language);
      if (!validation.isValid) {
        // Keep in pending, DO NOT auto-save invalid value
        remainingPending[studentId] = markData;
        return;
      }

      const obtained = markData.obtained === '' ? 0 : Number(markData.obtained);
      const cq = markData.cq === '' ? undefined : Number(markData.cq);
      const mcq = markData.mcq === '' ? undefined : Number(markData.mcq);

      updates.push({
        studentId,
        subjectId: currentSubject.id,
        examId: selectedExamId,
        obtained,
        obtainedCQ: cq,
        obtainedMCQ: mcq,
        isAbsent: markData.isAbsent,
        total: currentSubject.fullMarks
      });
    });

    if (updates.length > 0) {
      bulkUpdateMarks(updates);
    }
    
    pendingUpdatesRef.current = remainingPending;
    if (Object.keys(remainingPending).length > 0) {
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
    }
  }, [currentSubject, selectedExamId, bulkUpdateMarks, language]);

  // Initialize local state when selection changes
  useEffect(() => {
      // Flush before switching
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
                  isAbsent: existing?.isAbsent ?? false,
              };
          });
      }
      setLocalMarks(initialMarks);
      setSaveStatus('saved');
  }, [selectedClass, selectedSubjectId, selectedExamId, currentSubject?.id]); 

  // Clean up on unmount
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleInputChange = (studentId: string, field: 'obtained' | 'cq' | 'mcq' | 'isAbsent', value: string | boolean) => {
      setLocalMarks(prev => {
          const current = prev[studentId] || { obtained: '', cq: '', mcq: '', isAbsent: false };
          const updated = { ...current, [field]: value };
          
          if (field === 'isAbsent' && value === true) {
              updated.obtained = 0;
              updated.cq = 0;
              updated.mcq = 0;
          }

          // Auto-calculate total if CQ/MCQ present
          if (currentSubject && (currentSubject.hasCQ || currentSubject.hasMCQ) && field !== 'isAbsent') {
              const parse = (val: string | number | undefined | null) => (val === undefined || val === null || val === '') ? 0 : parseFloat(String(val));
              
              if (field === 'cq' || field === 'mcq') {
                  const cqVal = field === 'cq' ? parse(value as string) : parse(current.cq);
                  const mcqVal = field === 'mcq' ? parse(value as string) : parse(current.mcq);
                  updated.obtained = cqVal + mcqVal;
              }
          }

          // Track pending update
          pendingUpdatesRef.current[studentId] = updated;

          const validation = validateStudentMark(updated, currentSubject, language);
          if (!validation.isValid) {
            setSaveStatus('error');
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          } else {
            setSaveStatus('saving');
            // Schedule auto-save for valid entries
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            const delay = field === 'isAbsent' ? 50 : 300;
            saveTimeoutRef.current = setTimeout(() => {
              flushPendingSave();
            }, delay);
          }

          return { ...prev, [studentId]: updated };
      });
  };

  const handleInputBlur = () => {
    // Immediately persist on blur for extra guarantee (skips invalid)
    flushPendingSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number, currentField: 'cq' | 'mcq' | 'obtained') => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const isShift = e.shiftKey;
      let targetIndex = currentIndex;
      let targetField = currentField;

      if (!isShift) {
        // Forward navigation: move to next field in current student or next student
        if (currentField === 'cq' && currentSubject?.hasMCQ) {
          targetField = 'mcq';
        } else {
          targetIndex = currentIndex + 1;
          targetField = currentSubject?.hasCQ ? 'cq' : currentSubject?.hasMCQ ? 'mcq' : 'obtained';
        }

        while (targetIndex < enrolledStudents.length) {
          const nextStudent = enrolledStudents[targetIndex];
          const isAbsent = localMarks[nextStudent.id]?.isAbsent;
          if (!isAbsent) {
            const el = document.getElementById(`mark-input-${targetField}-${targetIndex}`) as HTMLInputElement | null;
            if (el && !el.disabled && !el.readOnly) {
              el.focus();
              try { el.select(); } catch {}
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              return;
            }
          }
          if (targetField === 'cq' && currentSubject?.hasMCQ) {
            targetField = 'mcq';
          } else {
            targetIndex++;
            targetField = currentSubject?.hasCQ ? 'cq' : currentSubject?.hasMCQ ? 'mcq' : 'obtained';
          }
        }
      } else {
        // Backward navigation with Shift + Enter
        if (currentField === 'mcq' && currentSubject?.hasCQ) {
          targetField = 'cq';
        } else {
          targetIndex = currentIndex - 1;
          targetField = currentSubject?.hasMCQ ? 'mcq' : currentSubject?.hasCQ ? 'cq' : 'obtained';
        }

        while (targetIndex >= 0) {
          const prevStudent = enrolledStudents[targetIndex];
          const isAbsent = localMarks[prevStudent.id]?.isAbsent;
          if (!isAbsent) {
            const el = document.getElementById(`mark-input-${targetField}-${targetIndex}`) as HTMLInputElement | null;
            if (el && !el.disabled && !el.readOnly) {
              el.focus();
              try { el.select(); } catch {}
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              return;
            }
          }
          if (targetField === 'mcq' && currentSubject?.hasCQ) {
            targetField = 'cq';
          } else {
            targetIndex--;
            targetField = currentSubject?.hasMCQ ? 'mcq' : currentSubject?.hasCQ ? 'cq' : 'obtained';
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('marks')}</h2>
          <p className="text-gray-500 text-sm">{language === 'bn' ? 'নম্বর লিখলেই স্বয়ংক্রিয়ভাবে সেভ হবে। সর্বোচ্চ নম্বরের বেশি লিখলে সতর্কবার্তা দেখাবে।' : 'Marks auto-save as you type. Exceeding marks are highlighted in red.'}</p>
        </div>
        <div className="flex items-center gap-2">
            {hasAnyInvalidMarks || saveStatus === 'error' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-300 shadow-xs animate-pulse">
                <AlertTriangle size={14} className="text-red-600" />
                {language === 'bn' ? 'সর্বোচ্চ ছাড়িয়েছে (অটো-সেভ স্থগিত)' : 'Max limit exceeded (Auto-save paused)'}
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse shadow-xs">
                <Loader2 size={13} className="animate-spin text-amber-600" />
                {language === 'bn' ? 'সংরক্ষিত হচ্ছে...' : 'Auto-saving...'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs transition-all">
                <CheckCircle2 size={14} className="text-emerald-600" />
                {language === 'bn' ? 'অটো-সেভ সক্রিয়' : 'Auto-saved'}
              </span>
            )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('exam')}</label>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
          >
            {exams.map(e => <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name} ({formatNumber(e.academicYear, language)})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('class')}</label>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
            value={selectedClass}
            onChange={(e) => {
                setSelectedClass(e.target.value);
            }}
          >
            {classes.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('subject')}</label>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
          >
            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{language === 'bn' ? (s.nameBn || s.name) : s.name} ({formatNumber(s.fullMarks, language)})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'id')}
          >
            <option value="name">Name</option>
            <option value="id">Student ID</option>
          </select>
        </div>
      </div>

      {currentSubject && enrolledStudents.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase w-14 text-center">S/N</th>
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase w-28 text-center">{t('studentId')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right pr-4">{t('name')}</th>
                {currentSubject.hasCQ && <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('cqMarks')} <span className="text-gray-400 font-mono">({currentSubject.cqMarks})</span></th>}
                {currentSubject.hasMCQ && <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('mcqMarks')} <span className="text-gray-400 font-mono">({currentSubject.mcqMarks})</span></th>}
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('totalMarks')} <span className="text-gray-400 font-mono">({currentSubject.fullMarks})</span></th>
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-20">{t('absent')}</th>
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-20">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrolledStudents.map((student, index) => {
                const markData = localMarks[student.id] || { obtained: '', cq: '', mcq: '', isAbsent: false };
                const validation = validateStudentMark(markData, currentSubject, language);

                // Logic to determine fail status in row visual only
                let isFail = false;
                const ob = Number(markData.obtained);
                const cq = Number(markData.cq);
                const mcq = Number(markData.mcq);
                
                if (currentSubject.hasCQ && cq < (currentSubject.cqPassMarks ?? 0)) isFail = true;
                if (currentSubject.hasMCQ && mcq < (currentSubject.mcqPassMarks ?? 0)) isFail = true;
                if (!currentSubject.hasCQ && !currentSubject.hasMCQ && markData.obtained !== '' && ob < currentSubject.passMarks) isFail = true;
                
                // If nothing entered, don't show fail/pass
                const hasEntry = markData.obtained !== '' || markData.cq !== '' || markData.mcq !== '';

                return (
                  <tr key={student.id} className={`transition-colors hover:bg-blue-50/40 focus-within:bg-blue-50/80 ${!validation.isValid ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-gray-500 text-center text-sm">{formatNumber(index + 1, language)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 text-center font-mono text-sm">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-4 py-2.5 text-right pr-4">
                        <div className="font-bold text-gray-900 font-bangla text-base leading-snug">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">ID: {student.studentId ? formatNumber(student.studentId, language) : '-'}</div>
                    </td>
                    
                    {currentSubject.hasCQ && (
                        <td className="px-2 py-2.5 text-center align-top">
                            <div className="flex flex-col items-center">
                              <input 
                                  id={`mark-input-cq-${index}`}
                                  type="number" min="0" max={currentSubject.cqMarks}
                                  className={`w-24 border rounded px-2.5 py-1.5 outline-none text-center transition-all
                                      ${validation.cqError 
                                        ? 'bg-red-50 border-red-500 text-red-700 font-bold ring-2 ring-red-400 focus:ring-red-500' 
                                        : 'bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500'}
                                      ${markData.isAbsent ? 'opacity-50' : ''}
                                  `}
                                  value={markData.cq ?? ''}
                                  placeholder="0"
                                  disabled={markData.isAbsent}
                                  onChange={(e) => handleInputChange(student.id, 'cq', e.target.value)}
                                  onBlur={handleInputBlur}
                                  onKeyDown={(e) => handleKeyDown(e, index, 'cq')}
                              />
                              {validation.cqError && (
                                <span className="text-[10px] text-red-600 font-bold mt-1 bg-red-100/90 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap animate-bounce">
                                  ⚠️ {validation.cqError}
                                </span>
                              )}
                            </div>
                        </td>
                    )}

                    {currentSubject.hasMCQ && (
                        <td className="px-2 py-2.5 text-center align-top">
                            <div className="flex flex-col items-center">
                              <input 
                                  id={`mark-input-mcq-${index}`}
                                  type="number" min="0" max={currentSubject.mcqMarks}
                                  className={`w-24 border rounded px-2.5 py-1.5 outline-none text-center transition-all
                                      ${validation.mcqError 
                                        ? 'bg-red-50 border-red-500 text-red-700 font-bold ring-2 ring-red-400 focus:ring-red-500' 
                                        : 'bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500'}
                                      ${markData.isAbsent ? 'opacity-50' : ''}
                                  `}
                                  value={markData.mcq ?? ''}
                                  placeholder="0"
                                  disabled={markData.isAbsent}
                                  onChange={(e) => handleInputChange(student.id, 'mcq', e.target.value)}
                                  onBlur={handleInputBlur}
                                  onKeyDown={(e) => handleKeyDown(e, index, 'mcq')}
                              />
                              {validation.mcqError && (
                                <span className="text-[10px] text-red-600 font-bold mt-1 bg-red-100/90 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap animate-bounce">
                                  ⚠️ {validation.mcqError}
                                </span>
                              )}
                            </div>
                        </td>
                    )}

                    <td className="px-2 py-2.5 text-center align-top">
                      <div className="flex flex-col items-center">
                        {/* Only editable if NO CQ/MCQ, else read-only sum */}
                        <input 
                          id={`mark-input-obtained-${index}`}
                          type="number" 
                          min="0"
                          max={currentSubject.fullMarks}
                          className={`w-24 border rounded px-2.5 py-1.5 outline-none transition-all text-center
                              ${currentSubject.hasCQ || currentSubject.hasMCQ ? 'bg-gray-100 font-bold' : 'bg-white'}
                              ${validation.obtainedError 
                                ? 'bg-red-50 border-red-500 text-red-700 font-bold ring-2 ring-red-400 focus:ring-red-500' 
                                : ((isFail || markData.isAbsent) && hasEntry ? 'border-red-300 text-red-700' : 'border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500')}
                              ${markData.isAbsent ? 'opacity-50' : ''}
                          `}
                          value={markData.obtained ?? ''}
                          placeholder="0"
                          readOnly={!!(currentSubject.hasCQ || currentSubject.hasMCQ) || markData.isAbsent}
                          onChange={(e) => handleInputChange(student.id, 'obtained', e.target.value)}
                          onBlur={handleInputBlur}
                          onKeyDown={(e) => !currentSubject.hasCQ && !currentSubject.hasMCQ && handleKeyDown(e, index, 'obtained')}
                        />
                        {validation.obtainedError && (
                          <span className="text-[10px] text-red-600 font-bold mt-1 bg-red-100/90 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap animate-bounce">
                            ⚠️ {validation.obtainedError}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle">
                        <input 
                            type="checkbox"
                            className="w-5 h-5 cursor-pointer accent-blue-600"
                            checked={markData.isAbsent}
                            onChange={(e) => handleInputChange(student.id, 'isAbsent', e.target.checked)}
                        />
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle">
                        {!validation.isValid ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-red-100 text-red-700 border border-red-300">
                                {language === 'bn' ? 'অবৈধ' : 'Invalid'}
                            </span>
                        ) : markData.isAbsent ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                                {t('absent')}
                            </span>
                        ) : hasEntry ? (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isFail ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isFail ? t('fail') : t('pass')}
                            </span>
                        ) : <span className="text-xs text-gray-400">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          
          <div className="bg-gray-50/70 px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles size={14} className="text-indigo-500" />
              {language === 'bn' 
                ? 'কীবোর্ডের Enter চেপে পরবর্তী শিক্ষার্থীর নম্বরে যান। প্রতিটি সঠিক নম্বর স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।' 
                : 'Press Enter to jump to the next student. Valid entries auto-save in real-time.'}
            </span>
            <span className="font-mono text-gray-400">
              Total {enrolledStudents.length} {language === 'bn' ? 'শিক্ষার্থী' : 'students'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">Select a valid class and subject, or add students/subjects to get started.</p>
        </div>
      )}
    </div>
  );
};