import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MarkRecord } from '../types';
import { formatNumber } from '../services/utils';
import { Button } from './ui/Button';
import { Save, Loader2 } from 'lucide-react';

interface EditableMark {
    obtained: number | string;
    cq: number | string;
    mcq: number | string;
    isAbsent: boolean;
    isDirty: boolean;
}

export const MarksEntry = () => {
  const { students, subjects, marks, exams, classes, bulkUpdateMarks, t, language, schoolProfile } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  // Local state to store edits before saving
  const [localMarks, setLocalMarks] = useState<Record<string, EditableMark>>({});

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

  // Initialize/Reset local state when selection changes
  useEffect(() => {
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
                  isDirty: false
              };
          });
      }
      setLocalMarks(initialMarks);
  }, [selectedClass, selectedSubjectId, selectedExamId, currentSubject]); 

  const handleInputChange = (studentId: string, field: 'obtained' | 'cq' | 'mcq' | 'isAbsent', value: string | boolean) => {
      // Validate Max Value
      if (currentSubject && typeof value === 'string') {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
              if (field === 'cq' && numValue > (currentSubject.cqMarks || 0)) return;
              if (field === 'mcq' && numValue > (currentSubject.mcqMarks || 0)) return;
              // If simple obtained (no CQ/MCQ), max is full marks
              if (field === 'obtained' && !currentSubject.hasCQ && !currentSubject.hasMCQ && numValue > currentSubject.fullMarks) return;
          }
      }

      setLocalMarks(prev => {
          const current = prev[studentId] || { obtained: '', cq: '', mcq: '', isAbsent: false, isDirty: false };
          const updated = { ...current, [field]: value, isDirty: true };
          
          if (field === 'isAbsent' && value === true) {
              updated.obtained = 0;
              updated.cq = 0;
              updated.mcq = 0;
          }

          // Auto-calculate total if CQ/MCQ present
          if (currentSubject && (currentSubject.hasCQ || currentSubject.hasMCQ) && field !== 'isAbsent') {
              // Parse numbers safely
              const parse = (val: string | number | undefined | null) => (val === undefined || val === null || val === '') ? 0 : parseFloat(String(val));
              
              if (field === 'cq' || field === 'mcq') {
                  const cqVal = field === 'cq' ? parse(value as string) : parse(current.cq);
                  const mcqVal = field === 'mcq' ? parse(value as string) : parse(current.mcq);
                  updated.obtained = cqVal + mcqVal;
              }
          }
          return { ...prev, [studentId]: updated };
      });
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

  const handleSaveAll = () => {
      if (!currentSubject || !selectedExamId) return;
      setIsSaving(true);

      const updates: (Omit<MarkRecord, 'id'> & { id?: string })[] = [];
      
      // We iterate over the students to ensure we capture all, even if localMarks is partial (though it shouldn't be)
      // However, iterating over localMarks is safer for what has been touched/loaded
      const studentIds = Object.keys(localMarks);
      
      studentIds.forEach(studentId => {
          const markData = localMarks[studentId];
          
          // Basic validation parsing
          let obtained = markData.obtained === '' ? 0 : Number(markData.obtained);
          let cq = markData.cq === '' ? undefined : Number(markData.cq);
          let mcq = markData.mcq === '' ? undefined : Number(markData.mcq);

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

      bulkUpdateMarks(updates);
      
      // Reset dirty flags
      setLocalMarks(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
              if (next[k]) next[k].isDirty = false;
          });
          return next;
      });

      setIsSaving(false);
      setFeedback('All marks saved successfully');
      setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('marks')}</h2>
          <p className="text-gray-500 text-sm">{t('marksEntryDesc')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            {feedback && <div className="text-green-600 text-sm font-medium animate-pulse bg-green-50 px-3 py-1 rounded whitespace-nowrap">{feedback}</div>}
            {currentSubject && enrolledStudents.length > 0 && (
                 <Button onClick={handleSaveAll} disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="animate-spin mr-2" size={16}/> : <Save className="mr-2" size={16}/>}
                    {t('save')} All
                </Button>
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
                {currentSubject.hasCQ && <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-28">{t('cqMarks')} <span className="text-gray-400">({currentSubject.cqMarks})</span></th>}
                {currentSubject.hasMCQ && <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-28">{t('mcqMarks')} <span className="text-gray-400">({currentSubject.mcqMarks})</span></th>}
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-28">{t('totalMarks')} <span className="text-gray-400">({currentSubject.fullMarks})</span></th>
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-20">{t('absent')}</th>
                <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-20">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrolledStudents.map((student, index) => {
                const markData = localMarks[student.id] || { obtained: '', cq: '', mcq: '', isAbsent: false, isDirty: false };
                
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
                  <tr key={student.id} className={`transition-colors hover:bg-blue-50/40 focus-within:bg-blue-50/80 ${markData.isDirty ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-gray-500 text-center text-sm">{formatNumber(index + 1, language)}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 text-center font-mono text-sm">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-4 py-2.5 text-right pr-4">
                        <div className="font-bold text-gray-900 font-bangla text-base leading-snug">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">ID: {student.studentId ? formatNumber(student.studentId, language) : '-'}</div>
                    </td>
                    
                    {currentSubject.hasCQ && (
                        <td className="px-2 py-2.5 text-center">
                            <input 
                                id={`mark-input-cq-${index}`}
                                type="number" min="0" max={currentSubject.cqMarks}
                                className={`w-24 border rounded px-3 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center
                                    ${Number(markData.cq) > (currentSubject.cqMarks || 100) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}
                                    ${markData.isAbsent ? 'opacity-50' : ''}
                                `}
                                value={markData.cq ?? ''}
                                placeholder="0"
                                disabled={markData.isAbsent}
                                onChange={(e) => handleInputChange(student.id, 'cq', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, 'cq')}
                            />
                        </td>
                    )}

                    {currentSubject.hasMCQ && (
                        <td className="px-2 py-2.5 text-center">
                            <input 
                                id={`mark-input-mcq-${index}`}
                                type="number" min="0" max={currentSubject.mcqMarks}
                                className={`w-24 border rounded px-3 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center
                                    ${Number(markData.mcq) > (currentSubject.mcqMarks || 100) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}
                                    ${markData.isAbsent ? 'opacity-50' : ''}
                                `}
                                value={markData.mcq ?? ''}
                                placeholder="0"
                                disabled={markData.isAbsent}
                                onChange={(e) => handleInputChange(student.id, 'mcq', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, 'mcq')}
                            />
                        </td>
                    )}

                    <td className="px-2 py-2.5 text-center">
                        {/* Only editable if NO CQ/MCQ, else read-only sum */}
                      <input 
                        id={`mark-input-obtained-${index}`}
                        type="number" 
                        min="0"
                        max={currentSubject.fullMarks}
                        className={`w-24 border rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-gray-900 text-center
                            ${currentSubject.hasCQ || currentSubject.hasMCQ ? 'bg-gray-100 font-bold' : 'bg-white'}
                            ${(isFail || markData.isAbsent) && hasEntry ? 'border-red-300 text-red-700' : 'border-gray-300'}
                            ${markData.isAbsent ? 'opacity-50' : ''}
                        `}
                        value={markData.obtained ?? ''}
                        placeholder="0"
                        readOnly={!!(currentSubject.hasCQ || currentSubject.hasMCQ) || markData.isAbsent}
                        onChange={(e) => handleInputChange(student.id, 'obtained', e.target.value)}
                        onKeyDown={(e) => !currentSubject.hasCQ && !currentSubject.hasMCQ && handleKeyDown(e, index, 'obtained')}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                        <input 
                            type="checkbox"
                            className="w-5 h-5 cursor-pointer"
                            checked={markData.isAbsent}
                            onChange={(e) => handleInputChange(student.id, 'isAbsent', e.target.checked)}
                        />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                        {markData.isAbsent ? (
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
          
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
               <Button onClick={handleSaveAll} disabled={isSaving} size="lg">
                    {isSaving ? <Loader2 className="animate-spin mr-2" size={20}/> : <Save className="mr-2" size={20}/>}
                    {t('save')} All Marks
               </Button>
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