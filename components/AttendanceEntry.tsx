import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { RemarkRecord } from '../types';
import { formatNumber } from '../services/utils';
import { Button } from './ui/Button';
import { Save, Loader2 } from 'lucide-react';

export const AttendanceEntry = () => {
  const { students, exams, classes, remarks, updateRemark, t, language, schoolProfile } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'id'>('name');

  const [localData, setLocalData] = useState<Record<string, Partial<RemarkRecord> & { isDirty: boolean }>>({});

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

  useEffect(() => {
      const initialData: Record<string, Partial<RemarkRecord> & { isDirty: boolean }> = {};
      if (selectedExamId) {
          enrolledStudents.forEach(student => {
              const existing = remarks.find(r => r.studentId === student.id && r.examId === selectedExamId);
              initialData[student.id] = {
                  workingDays: existing?.workingDays ?? undefined,
                  totalPresent: existing?.totalPresent ?? undefined,
                  totalAbsent: existing?.totalAbsent ?? undefined,
                  remark: existing?.remark ?? '',
                  isDirty: false
              };
          });
      }
      setLocalData(initialData);
  }, [selectedClass, selectedExamId, remarks]); 

  const handleInputChange = (studentId: string, field: keyof RemarkRecord, value: string) => {
      setLocalData(prev => {
          const current = prev[studentId] || { isDirty: false };
          const parsedValue = field === 'remark' ? value : (value === '' ? undefined : Number(value));
          const updated = { ...current, [field]: parsedValue, isDirty: true };
          return { ...prev, [studentId]: updated };
      });
  };

  const handleSaveAll = () => {
      if (!selectedExamId) return;
      setIsSaving(true);
      
      const studentIds = Object.keys(localData);
      
      studentIds.forEach(studentId => {
          const data = localData[studentId];
          if (data.isDirty) {
              updateRemark(studentId, selectedExamId, {
                  workingDays: data.workingDays,
                  totalPresent: data.totalPresent,
                  totalAbsent: data.totalAbsent,
                  remark: data.remark
              });
          }
      });

      setLocalData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
              if (next[k]) next[k].isDirty = false;
          });
          return next;
      });

      setIsSaving(false);
      setFeedback(language === 'bn' ? 'উপস্থিতি ও মন্তব্য সফলভাবে সংরক্ষিত হয়েছে' : 'Attendance & Remarks saved successfully');
      setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('attendance')} & {t('comments')}</h2>
          <p className="text-gray-500 text-sm">{language === 'bn' ? 'শিক্ষার্থীদের কর্মদিবস, উপস্থিতি এবং মন্তব্য লিখুন।' : 'Enter working days, attendance, and remarks for students.'}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            {feedback && <div className="text-green-600 text-sm font-medium animate-pulse bg-green-50 px-3 py-1 rounded whitespace-nowrap">{feedback}</div>}
            {enrolledStudents.length > 0 && (
                 <Button onClick={handleSaveAll} disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="animate-spin mr-2" size={16}/> : <Save className="mr-2" size={16}/>}
                    {t('save')} All
                </Button>
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
                const data = localData[student.id] || { isDirty: false };
                
                return (
                  <tr key={student.id} className={`hover:bg-gray-50 ${data.isDirty ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-3 font-medium text-gray-500">{formatNumber(index + 1, language)}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-6 py-3 text-gray-700">
                        <div className="font-bold text-gray-900 truncate max-w-[200px] font-bangla">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                        <div className="text-[10px] text-gray-400">ID: {student.studentId ? formatNumber(student.studentId, language) : '-'}</div>
                    </td>
                    
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.workingDays ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'workingDays', e.target.value)}
                        />
                    </td>
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.totalPresent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalPresent', e.target.value)}
                        />
                    </td>
                    <td className="px-6 py-3 text-center">
                        <input 
                            type="number" min="0"
                            className="w-20 border rounded px-2 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-center border-gray-300"
                            value={data.totalAbsent ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'totalAbsent', e.target.value)}
                        />
                    </td>
                    <td className="px-6 py-3 text-left">
                        <input 
                            type="text"
                            className="w-full border rounded px-3 py-1.5 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none border-gray-300"
                            value={data.remark ?? ''}
                            onChange={(e) => handleInputChange(student.id, 'remark', e.target.value)}
                        />
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
                    {t('save')} All
               </Button>
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
