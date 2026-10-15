import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Exam, ExamSubjectAssignment, ExamStatus } from '../types';
import { Button } from './ui/Button';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Archive, 
  Lock, 
  Layers, 
  BookOpen, 
  Search,
  CheckCheck
} from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { validateExamFinalization } from '../services/examValidation';

export const ExamManager = () => {
  const { 
    exams, 
    addExam, 
    updateExam, 
    archiveExam, 
    finalizeExam, 
    deleteExam, 
    classes, 
    subjects, 
    academicYears, 
    classSubjectAssignments,
    examSubjectAssignments,
    scheduleExamSubject,
    archiveExamSubject,
    marks,
    students,
    t, 
    language,
    hasPermission 
  } = useApp();

  const [selectedYearId, setSelectedYearId] = useState<string>(
    academicYears.find(y => y.isCurrent)?.id || academicYears[0]?.id || ''
  );
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExamStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active modal/tab states
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [schedulingExam, setSchedulingExam] = useState<Exam | null>(null);
  const [examToFinalize, setExamToFinalize] = useState<Exam | null>(null);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);

  // New/Edit Exam Form State
  const [formData, setFormData] = useState<Partial<Exam>>({
    name: '',
    nameBn: '',
    academicYear: academicYears.find(y => y.isCurrent)?.name || new Date().getFullYear().toString(),
    category: 'Term',
    status: 'SCHEDULED',
    startDate: '',
    endDate: '',
    description: '',
    classIds: []
  });

  const filteredExams = exams
    .filter(e => {
      const matchYear = !selectedYearId || e.academicYearId === selectedYearId || e.academicYear === selectedYearId || e.academicYear === academicYears.find(y => y.id === selectedYearId)?.name;
      const matchStatus = statusFilter === 'ALL' || e.status === statusFilter || (!e.status && statusFilter === 'SCHEDULED');
      const matchClass = selectedClass === 'ALL' || !e.classIds || e.classIds.length === 0 || e.classIds.includes(selectedClass);
      const matchSearch = !searchQuery || 
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (e.nameBn && e.nameBn.includes(searchQuery));
      return matchYear && matchStatus && matchClass && matchSearch;
    });

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingExamId) {
      const existing = exams.find(ex => ex.id === editingExamId);
      if (existing) {
        updateExam({
          ...existing,
          ...formData,
          name: formData.name.trim(),
          academicYear: formData.academicYear || existing.academicYear,
          category: formData.category || existing.category
        } as Exam);
      }
      setEditingExamId(null);
    } else {
      addExam(
        formData.name.trim(),
        formData.category || 'Term',
        formData.nameBn?.trim(),
        {
          ...formData,
          academicYearId: selectedYearId
        }
      );
    }

    setFormData({
      name: '',
      nameBn: '',
      academicYear: academicYears.find(y => y.id === selectedYearId)?.name || new Date().getFullYear().toString(),
      category: 'Term',
      status: 'SCHEDULED',
      startDate: '',
      endDate: '',
      description: '',
      classIds: []
    });
  };

  const startEditExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setFormData({
      name: exam.name,
      nameBn: exam.nameBn,
      academicYear: exam.academicYear,
      category: exam.category,
      status: exam.status || 'SCHEDULED',
      startDate: exam.startDate || '',
      endDate: exam.endDate || '',
      description: exam.description || '',
      classIds: exam.classIds || []
    });
  };

  const handleFinalizeConfirm = (exam: Exam) => {
    const relevantAssignments = examSubjectAssignments.filter(es => es.examId === exam.id && es.status === 'ACTIVE');
    const validation = validateExamFinalization(exam, relevantAssignments, marks, students);
    if (!validation.isValid) {
      alert(Object.values(validation.errors)[0]);
      return;
    }
    finalizeExam(exam.id);
    setExamToFinalize(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={26} />
            {language === 'bn' ? 'পরীক্ষা ব্যবস্থাপনা ও সিডিউল' : 'Exam Management & Scheduling'}
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {language === 'bn' 
              ? 'টার্ম ও মডেল পরীক্ষা তৈরি, বিষয় সিডিউল এবং ফলাফল চূড়ান্তকরণ' 
              : 'Configure examination terms, subject schedules, and lock finalized grades.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
            <label className="text-xs font-bold text-gray-600">শিক্ষাবর্ষ:</label>
            <select 
              className="bg-transparent text-xs font-bold text-gray-900 border-none outline-none cursor-pointer"
              value={selectedYearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                const yr = academicYears.find(y => y.id === e.target.value);
                if (yr) setFormData(prev => ({ ...prev, academicYear: yr.name }));
              }}
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Exam List & Create Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exam List Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={language === 'bn' ? 'পরীক্ষা খুঁজুন...' : 'Search exams...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-600">স্ট্যাটাস:</label>
              <select 
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-gray-900"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Status</option>
                <option value="SCHEDULED">নির্ধারিত (Scheduled)</option>
                <option value="MARKS_ENTRY">নম্বর গ্রহণ (Marks Entry)</option>
                <option value="FINALIZED">চূড়ান্তকৃত (Finalized)</option>
                <option value="ARCHIVED">আর্কাইভ (Archived)</option>
              </select>
            </div>
          </div>

          {/* Exams List Cards */}
          <div className="space-y-3">
            {filteredExams.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-gray-100 text-center text-gray-400 text-sm">
                {language === 'bn' ? 'কোন পরীক্ষা পাওয়া যায়নি। ডানদিকের ফর্ম থেকে নতুন পরীক্ষা যোগ করুন।' : 'No exams found. Create an exam using the form.'}
              </div>
            ) : (
              filteredExams.map(exam => {
                const isFinalized = exam.status === 'FINALIZED';
                const isArchived = exam.status === 'ARCHIVED';
                const scheduledSubjects = examSubjectAssignments.filter(es => es.examId === exam.id && es.status === 'ACTIVE');

                return (
                  <div 
                    key={exam.id} 
                    className={`bg-white p-5 rounded-2xl border transition-all shadow-xs ${
                      isFinalized ? 'border-emerald-200 bg-emerald-50/20' : 
                      isArchived ? 'border-gray-200 opacity-60 bg-gray-50' : 'border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base font-bangla">
                            {language === 'bn' ? (exam.nameBn || exam.name) : exam.name}
                          </h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                            {exam.category}
                          </span>
                          {isFinalized && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <Lock size={12} /> চূড়ান্তকৃত (Finalized)
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                          <span>শিক্ষাবর্ষ: <strong>{exam.academicYear}</strong></span>
                          <span>•</span>
                          <span>নির্ধারিত বিষয়: <strong>{scheduledSubjects.length} টি</strong></span>
                          {exam.startDate && (
                            <>
                              <span>•</span>
                              <span>তারিখ: {exam.startDate} {exam.endDate ? `- ${exam.endDate}` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Subject Scheduling Button */}
                        <button
                          onClick={() => setSchedulingExam(exam)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Layers size={14} />
                          {language === 'bn' ? 'বিষয় সিডিউল' : 'Subjects'}
                        </button>

                        {/* Finalize Button */}
                        {!isFinalized && !isArchived && (
                          <button
                            onClick={() => setExamToFinalize(exam)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Finalize Exam & Lock Grades"
                          >
                            <CheckCheck size={14} />
                            {language === 'bn' ? 'ফাইনাল লক' : 'Finalize'}
                          </button>
                        )}

                        {/* Edit Button */}
                        {!isFinalized && (
                          <button
                            onClick={() => startEditExam(exam)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Exam"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}

                        {/* Archive Toggle */}
                        <button
                          onClick={() => archiveExam(exam.id)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title={isArchived ? 'Unarchive' : 'Archive'}
                        >
                          <Archive size={16} />
                        </button>

                        {/* Delete Button */}
                        {!isFinalized && (
                          <button
                            onClick={() => setExamToDelete(exam)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Create / Edit Exam Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              {editingExamId ? <Edit2 size={16} className="text-blue-600" /> : <Plus size={16} className="text-blue-600" />}
              {editingExamId ? t('update') : (language === 'bn' ? 'নতুন পরীক্ষা তৈরি' : 'Create New Exam')}
            </h3>
            {editingExamId && (
              <button 
                onClick={() => {
                  setEditingExamId(null);
                  setFormData({
                    name: '',
                    nameBn: '',
                    academicYear: academicYears.find(y => y.id === selectedYearId)?.name || new Date().getFullYear().toString(),
                    category: 'Term',
                    status: 'SCHEDULED'
                  });
                }} 
                className="text-xs text-red-500 flex items-center hover:underline cursor-pointer"
              >
                <X size={13} className="mr-0.5"/> Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveExam} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">পরীক্ষার নাম (English / Standard) *</label>
              <input 
                required 
                type="text" 
                className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" 
                value={formData.name || ''} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. 1st Term Examination / Annual Exam"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">পরীক্ষার নাম (বাংলা)</label>
              <input 
                type="text" 
                className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 font-bangla focus:ring-2 focus:ring-blue-500" 
                value={formData.nameBn || ''} 
                onChange={e => setFormData({ ...formData, nameBn: e.target.value })} 
                placeholder="যেমন: ১ম সাময়িক পরীক্ষা / বার্ষিক পরীক্ষা"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ক্যাটাগরি *</label>
                <select 
                  className="w-full border rounded-lg p-2 text-xs font-bold bg-white text-gray-900"
                  value={formData.category || 'Term'}
                  onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                >
                  <option value="Term">সাময়িক (Term Exam)</option>
                  <option value="Model">মডেল টেস্ট (Model Test)</option>
                  <option value="Monthly">মাসিক মূল্যায়ন (Monthly)</option>
                  <option value="ClassTest">ক্লাস টেস্ট (Class Test)</option>
                  <option value="Final">চূড়ান্ত পরীক্ষা (Final)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">স্ট্যাটাস</label>
                <select 
                  className="w-full border rounded-lg p-2 text-xs font-bold bg-white text-gray-900"
                  value={formData.status || 'SCHEDULED'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="SCHEDULED">নির্ধারিত (Scheduled)</option>
                  <option value="MARKS_ENTRY">নম্বর গ্রহণ (Marks Entry)</option>
                  <option value="DRAFT">খসড়া (Draft)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">শুরুর তারিখ</label>
                <input 
                  type="date" 
                  className="w-full border rounded-lg p-2 text-xs bg-white text-gray-900"
                  value={formData.startDate || ''}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">শেষের তারিখ</label>
                <input 
                  type="date" 
                  className="w-full border rounded-lg p-2 text-xs bg-white text-gray-900"
                  value={formData.endDate || ''}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-2.5 font-bold">
              {editingExamId ? <Edit2 size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
              {editingExamId ? t('update') : (language === 'bn' ? 'পরীক্ষা সংরক্ষণ করুন' : 'Save Exam')}
            </Button>
          </form>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUBJECT SCHEDULING MODAL                                      */}
      {/* ------------------------------------------------------------- */}
      {schedulingExam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 font-bangla">
                  <Layers className="text-blue-600" size={20} />
                  {schedulingExam.nameBn || schedulingExam.name} - বিষয় সিডিউল
                </h3>
                <p className="text-xs text-gray-500">
                  {language === 'bn' ? 'এই পরীক্ষায় কোন কোন বিষয়ের পরীক্ষা অনুষ্ঠিত হবে তা নির্ধারণ করুন' : 'Schedule subjects and configure exam mark breakdown.'}
                </p>
              </div>
              <button onClick={() => setSchedulingExam(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {classes.map(cls => {
                const classSubjects = subjects.filter(s => s.classLevel === cls.name && s.status !== 'INACTIVE');
                if (classSubjects.length === 0) return null;

                return (
                  <div key={cls.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                    <h4 className="font-bold text-gray-800 text-sm flex items-center justify-between">
                      <span>{cls.displayName || cls.nameBn || cls.name}</span>
                      <span className="text-xs text-gray-400">মোট বিষয়: {classSubjects.length} টি</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {classSubjects.map(sub => {
                        const targetClassId = cls.id || cls.name;
                        const assignment = examSubjectAssignments.find(
                          es => es.examId === schedulingExam.id &&
                               es.subjectId === sub.id &&
                               (es.classId === targetClassId || es.classId === cls.name) &&
                               es.status === 'ACTIVE'
                        );
                        const isScheduled = !!assignment;

                        return (
                          <div 
                            key={sub.id}
                            onClick={() => {
                              if (isScheduled && assignment) {
                                archiveExamSubject(assignment.id);
                              } else {
                                scheduleExamSubject({
                                  examId: schedulingExam.id,
                                  academicYearId: selectedYearId,
                                  classId: targetClassId,
                                  subjectId: sub.id,
                                  fullMarks: sub.fullMarks,
                                  passMarks: sub.passMarks,
                                  cqFullMarks: sub.cqMarks,
                                  cqPassMarks: sub.cqPassMarks,
                                  mcqFullMarks: sub.mcqMarks,
                                  mcqPassMarks: sub.mcqPassMarks,
                                  practicalFullMarks: sub.practicalMarks,
                                  practicalPassMarks: sub.practicalPassMarks,
                                  status: 'ACTIVE'
                                });
                              }
                            }}
                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                              isScheduled 
                                ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bangla">{sub.nameBn || sub.name}</div>
                              <div className="text-[10px] text-gray-400 font-normal">পূর্ণমান: {sub.fullMarks}</div>
                            </div>

                            <div>
                              {isScheduled ? (
                                <CheckCircle2 className="text-blue-600" size={18} />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-gray-300"></div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <Button onClick={() => setSchedulingExam(null)}>
                সম্পন্ন (Done)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!examToFinalize}
        onClose={() => setExamToFinalize(null)}
        onConfirm={() => {
          if (examToFinalize) handleFinalizeConfirm(examToFinalize);
        }}
        title={language === 'bn' ? 'পরীক্ষা চূড়ান্তকরণ ও ফলাফল লক' : 'Finalize Exam & Lock Grades'}
        message={language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই পরীক্ষাটি চূড়ান্ত করতে চান? চূড়ান্তকরণের পর সাধারণ শিক্ষকরা আর কোনো নম্বর পরিবর্তন করতে পারবেন না।' 
          : 'Are you sure you want to finalize this exam? Marks and result cards will be permanently locked against teacher edits.'}
        highlightText={examToFinalize ? (examToFinalize.nameBn || examToFinalize.name) : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, চূড়ান্ত লক করুন' : 'Yes, Finalize & Lock'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="warning"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!examToDelete}
        onClose={() => setExamToDelete(null)}
        onConfirm={() => {
          if (examToDelete) {
            deleteExam(examToDelete.id);
            setExamToDelete(null);
          }
        }}
        title={language === 'bn' ? 'পরীক্ষা ডিলিট নিশ্চিতকরণ' : 'Confirm Exam Deletion'}
        message={language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই পরীক্ষাটি ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে)' 
          : 'Are you sure you want to delete this exam?'}
        highlightText={examToDelete ? (examToDelete.nameBn || examToDelete.name) : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />
    </div>
  );
};
