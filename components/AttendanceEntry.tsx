import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RemarkRecord } from '../types';
import { formatNumber } from '../services/utils';
import { CheckCircle2, Loader2, Sparkles, Users, UserPlus, FileSpreadsheet, Upload, Calendar, Award } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';
import { BulkAttendanceImportModal } from './BulkAttendanceImportModal';
import { DailyAttendanceHub } from './attendance/DailyAttendanceHub';
import { dailyAttendanceService } from '../services/dailyAttendanceService';

interface AttendanceEntryProps {
  onNavigate?: (tab: string) => void;
  initialMode?: 'students' | 'staff' | 'absentees' | 'sync_exam';
}

export const AttendanceEntry: React.FC<AttendanceEntryProps> = ({ onNavigate, initialMode = 'students' }) => {
  const { students, exams, classes, remarks, updateRemark, t, language, currentUser, isSuperAdmin, isAdmin, authUser } = useApp();
  const isOwner = isSuperAdmin || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();

  // Mode: 'daily' (modern daily tracking) vs 'exam_remarks' (term exam rollup)
  const [mainTab, setMainTab] = useState<'daily' | 'exam_remarks'>('daily');

  useEffect(() => {
    setMainTab('daily');
  }, [initialMode]);

  // If user is a class teacher with assigned classes, restrict to assigned classes
  const allowedClasses = useMemo(() => {
    if (isOwner || isAdmin || !currentUser?.assignedClasses || currentUser.assignedClasses.length === 0) {
      return classes;
    }
    const set = new Set(currentUser.assignedClasses);
    const filtered = classes.filter(c => set.has(c.id) || set.has(c.name));
    return filtered.length > 0 ? filtered : classes;
  }, [classes, currentUser, isOwner, isAdmin]);

  const [selectedClass, setSelectedClass] = useState<string>(allowedClasses[0]?.name || classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState<boolean>(false);

  useEffect(() => {
    if (allowedClasses.length > 0 && !allowedClasses.find(c => c.name === selectedClass)) {
      setSelectedClass(allowedClasses[0].name);
    }
  }, [allowedClasses, selectedClass]);

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

  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);

  const handleAutoFillFromDaily = () => {
    if (!selectedExamId) {
      setAutoFillNotice(language === 'bn' ? 'অনুগ্রহ করে পরীক্ষা নির্বাচন করুন।' : 'Please select an exam.');
      setTimeout(() => setAutoFillNotice(null), 3000);
      return;
    }
    const updated: Record<string, Partial<RemarkRecord>> = { ...localData };
    enrolledStudents.forEach(st => {
      const calc = dailyAttendanceService.calculateStudentAttendanceForExam(st.id);
      updated[st.id] = {
        workingDays: calc.workingDays,
        totalPresent: calc.totalPresent,
        totalAbsent: calc.totalAbsent,
        remark: calc.attendancePercentage >= 90 ? (language === 'bn' ? 'নিয়মিত ও উত্তম' : 'Excellent') : (language === 'bn' ? 'সন্তোষজনক' : 'Good')
      };
      pendingUpdatesRef.current[st.id] = updated[st.id];
    });
    setLocalData(updated);
    flushPendingSave();
    setAutoFillNotice(language === 'bn' ? 'দৈনিক উপস্থিতি থেকে স্বয়ংক্রিয়ভাবে হিসাব সম্পন্ন হয়েছে এবং সংরক্ষণ করা হয়েছে!' : 'Auto-calculated and saved from daily attendance records!');
    setTimeout(() => setAutoFillNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Main Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setMainTab('daily')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            mainTab === 'daily'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar size={16} />
          <span>{language === 'bn' ? '১. দৈনিক ডিজিটাল হাজিরা (Daily Attendance)' : '1. Daily Digital Attendance'}</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('exam_remarks')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            mainTab === 'exam_remarks'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award size={16} />
          <span>{language === 'bn' ? '২. পরীক্ষাভিত্তিক উপস্থিতি ও মন্তব্য (Exam Remarks)' : '2. Exam Attendance & Remarks'}</span>
        </button>
      </div>

      {mainTab === 'daily' ? (
        <DailyAttendanceHub onNavigateTab={onNavigate} initialMode={initialMode} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t('attendance')} & {t('comments')}</h2>
              <p className="text-gray-500 text-sm">{language === 'bn' ? 'শিক্ষার্থীদের কর্মদিবস, উপস্থিতি এবং মন্তব্য লিখুন (স্বয়ংক্রিয়ভাবে সেভ হয়)।' : 'Enter working days, attendance, and remarks for students (Auto-saved).'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={handleAutoFillFromDaily}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
                  title={language === 'bn' ? 'সংরক্ষিত দৈনিক উপস্থিতি থেকে এই টার্মের মোট কার্যদিবস ও উপস্থিতি স্বয়ংক্রিয় হিসাব করুন' : 'Auto-fill from daily logs'}
                >
                  <Sparkles size={15} />
                  <span>{language === 'bn' ? 'দৈনিক হাজিরা থেকে অটো গণনা' : 'Auto From Daily'}</span>
                </Button>

                <Button
                  onClick={() => setIsBulkImportOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 py-2 px-3.5"
                  title={language === 'bn' ? 'বাল্ক হাজিরা ইমপোর্ট' : 'Bulk import attendance'}
                >
                  <FileSpreadsheet size={15} />
                  <span>{language === 'bn' ? 'বাল্ক ইমপোর্ট' : 'Bulk Import'}</span>
                </Button>

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

      {autoFillNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{autoFillNotice}</span>
        </div>
      )}

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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-500">{t('class')}</label>
            {!isOwner && !isAdmin && currentUser?.assignedClasses && currentUser.assignedClasses.length > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                শ্রেণি শিক্ষক মোড
              </span>
            )}
          </div>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
            value={selectedClass}
            onChange={(e) => {
                setSelectedClass(e.target.value);
            }}
          >
            {allowedClasses.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
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
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase w-12 sm:w-16">S/N</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase w-24 sm:w-32">{t('studentId')}</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase min-w-[150px] sm:min-w-[200px]">{t('name')}</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase text-center w-20 sm:w-32">{t('workingDays')}</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase text-center w-20 sm:w-32">{t('totalPresent')}</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase text-center w-20 sm:w-32">{t('totalAbsent')}</th>
                <th className="px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-gray-500 uppercase text-left min-w-[120px]">{t('comments')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrolledStudents.map((student, index) => {
                const data = localData[student.id] || {};
                
                return (
                  <tr key={student.id} className="hover:bg-blue-50/40 focus-within:bg-blue-50/80 transition-colors">
                    <td className="px-3 sm:px-6 py-2 sm:py-3 font-medium text-gray-500 text-center sm:text-left">{formatNumber(index + 1, language)}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 font-medium text-gray-900 font-mono text-[11px] sm:text-xs">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-3 sm:px-6 py-2 sm:py-3 text-gray-700">
                        <div className="font-bold text-gray-900 truncate max-w-[160px] sm:max-w-[200px] font-bangla text-xs sm:text-sm">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {student.studentId ? formatNumber(student.studentId, language) : '-'}</div>
                    </td>
                    
                    <td className="px-2 sm:px-6 py-2 sm:py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-14 sm:w-20 border rounded px-1.5 sm:px-2 py-1 sm:py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300 text-xs sm:text-sm"
                            value={data.workingDays ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'workingDays', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-14 sm:w-20 border rounded px-1.5 sm:px-2 py-1 sm:py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300 text-xs sm:text-sm font-semibold text-emerald-700"
                            value={data.totalPresent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalPresent', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-14 sm:w-20 border rounded px-1.5 sm:px-2 py-1 sm:py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300 text-xs sm:text-sm font-semibold text-rose-600"
                            value={data.totalAbsent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalAbsent', e.target.value)}
                            onBlur={handleInputBlur}
                        />
                    </td>
                    <td className="px-2 sm:px-6 py-2 sm:py-3 text-left">
                        <input 
                            type="text"
                            className="w-full border rounded px-2 sm:px-3 py-1 sm:py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 text-xs"
                            value={data.remark ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'remark', e.target.value)}
                            onBlur={handleInputBlur}
                            placeholder={language === 'bn' ? 'মন্তব্য...' : 'Remark...'}
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
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs">
          <EmptyState
            icon={Users}
            title={language === 'bn' ? `${selectedClass} শ্রেণীতে কোনো শিক্ষার্থী নেই` : `No students enrolled in ${selectedClass}`}
            description={language === 'bn' 
              ? 'দৈনিক হাজিরা ও আচরণিক মন্তব্য লিপিবদ্ধ করার জন্য প্রথমে এই শ্রেণিতে শিক্ষার্থী ভর্তি বা তালিকাভুক্ত করুন।' 
              : 'Enroll students into this class to begin tracking daily attendance and remarks.'}
            actionLabel={language === 'bn' ? 'শিক্ষার্থী ভর্তি করুন' : 'Add First Student'}
            actionIcon={UserPlus}
            onAction={() => onNavigate ? onNavigate('students') : null}
            secondaryActionLabel={classes.length > 1 ? (language === 'bn' ? 'অন্য শ্রেণি নির্বাচন' : 'Change Class') : undefined}
            onSecondaryAction={() => {
              const nextClass = classes.find(c => c.name !== selectedClass);
              if (nextClass) setSelectedClass(nextClass.name);
            }}
            badge={language === 'bn' ? 'হাজিরা তালিকা ফাঁকা' : 'No Attendees'}
          />
        </div>
      )}
      {isBulkImportOpen && selectedExamId && (
        <BulkAttendanceImportModal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          selectedClass={selectedClass}
          selectedExamId={selectedExamId}
        />
      )}
        </div>
      )}
    </div>
  );
};
