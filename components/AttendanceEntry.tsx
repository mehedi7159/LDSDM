import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { RemarkRecord } from '../types';
import { formatNumber } from '../services/utils';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export const AttendanceEntry = () => {
  const { students, exams, classes, remarks, updateRemark, t, language } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  const [localData, setLocalData] = useState<Record<string, Partial<RemarkRecord>>>({});
  const pendingUpdatesRef = useRef<Record<string, Partial<RemarkRecord>>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams]);

  const enrolledStudents = students
    .filter(s => s.classLevel === selectedClass && s.status === 'Active' && !s.isFormer)
    .sort((a, b) => {
        if (sortBy === 'id') {
            return (a.studentId || '').localeCompare(b.studentId || '');
        }
        return a.name.localeCompare(b.name);
    });

  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!selectedExamId) return;

    const studentIds = Object.keys(pendingUpdatesRef.current);
    if (studentIds.length === 0) return;

    studentIds.forEach(studentId => {
      const data = pendingUpdatesRef.current[studentId];
      if (data) {
        updateRemark(studentId, selectedExamId, {
          workingDays: data.workingDays,
          totalPresent: data.totalPresent,
          totalAbsent: data.totalAbsent,
          remark: data.remark
        });
      }
    });

    pendingUpdatesRef.current = {};
    setSaveStatus('saved');
  }, [selectedExamId, updateRemark]);

  useEffect(() => {
      flushPendingSave();

      const initialData: Record<string, Partial<RemarkRecord>> = {};
      if (selectedExamId) {
          enrolledStudents.forEach(student => {
              const existing = remarks.find(r => r.studentId === student.id && r.examId === selectedExamId);
              initialData[student.id] = {
                  workingDays: existing?.workingDays ?? undefined,
                  totalPresent: existing?.totalPresent ?? undefined,
                  totalAbsent: existing?.totalAbsent ?? undefined,
                  remark: existing?.remark ?? '',
              };
          });
      }
      setLocalData(initialData);
      setSaveStatus('saved');
  }, [selectedClass, selectedExamId, remarks]); 

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleInputChange = (studentId: string, field: keyof RemarkRecord, value: string) => {
      setSaveStatus('saving');

      setLocalData(prev => {
          const current = prev[studentId] || {};
          const parsedValue = field === 'remark' ? value : (value === '' ? undefined : Number(value));
          const updated = { ...current, [field]: parsedValue };
          
          pendingUpdatesRef.current[studentId] = updated;

          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => {
            flushPendingSave();
          }, 300);

          return { ...prev, [studentId]: updated };
      });
  };

  const handleInputBlur = () => {
    flushPendingSave();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('attendance')} & {t('comments')}</h2>
          <p className="text-gray-500 text-sm">{language === 'bn' ? 'শিক্ষার্থীদের কর্মদিবস, উপস্থিতি এবং মন্তব্য লিখুন (স্বয়ংক্রিয়ভাবে সেভ হয়)।' : 'Enter working days, attendance, and remarks for students (Auto-saved).'}</p>
        </div>
        <div className="flex items-center gap-2">
            {saveStatus === 'saving' ? (
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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {enrolledStudents.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase w-16">S/N</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase w-32">{t('studentId')}</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase min-w-[200px]">{t('name')}</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('workingDays')}</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('totalPresent')}</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-32">{t('totalAbsent')}</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-left">{t('comments')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrolledStudents.map((student, index) => {
                const data = localData[student.id] || {};
                
                return (
                  <tr key={student.id} className="hover:bg-blue-50/40 focus-within:bg-blue-50/80 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-500">{formatNumber(index + 1, language)}</td>
                    <td className="px-6 py-3 font-medium text-gray-900 font-mono">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-6 py-3 text-gray-700">
                        <div className="font-bold text-gray-900 truncate max-w-[200px] font-bangla">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {student.studentId ? formatNumber(student.studentId, language) : '-'}</div>
                    </td>
                    
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.workingDays ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'workingDays', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.totalPresent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalPresent', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.totalAbsent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalAbsent', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-6 py-3 text-left">
                        <input 
                            type="text"
                            className="w-full border rounded px-3 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                            value={data.remark ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'remark', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          
          <div className="bg-gray-50/70 px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles size={14} className="text-indigo-500" />
              {language === 'bn' 
                ? 'উপস্থিতি ও মন্তব্য লেখার সাথে সাথে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।' 
                : 'Attendance and remarks are auto-saved in real-time as you type.'}
            </span>
            <span className="font-mono text-gray-400">
              Total {enrolledStudents.length} {language === 'bn' ? 'শিক্ষার্থী' : 'students'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500">Select a valid class and exam, or add students to get started.</p>
        </div>
      )}
    </div>
  );
};
