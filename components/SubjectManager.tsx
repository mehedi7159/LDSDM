import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Subject, AcademicTeacher, ClassSubjectAssignment, TeacherSubjectAssignment, ClassTeacherAssignment } from '../types';
import { Button } from './ui/Button';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  FileText, 
  Search, 
  BookOpen, 
  UserCheck, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Archive, 
  Users, 
  GraduationCap,
  Calendar
} from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { BlankMarksheetView } from './BlankMarksheetView';
import { getTeacherSubjects, getTeacherClasses } from '../services/academicCoreService';

export type ManagerTab = 'directory' | 'class_assignment' | 'teacher_assignment' | 'exam_assignment' | 'blank_marksheet';

interface SubjectManagerProps {
  initialTab?: ManagerTab;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({ initialTab = 'directory' }) => {
  const { 
    subjects, 
    addSubject, 
    updateSubject, 
    archiveSubject, 
    deleteSubject, 
    classes, 
    sections,
    academicYears,
    teachers,
    addTeacher,
    updateTeacher,
    classSubjectAssignments,
    assignSubjectToClass,
    updateClassSubjectAssignment,
    archiveClassSubjectAssignment,
    teacherSubjectAssignments,
    assignTeacherToSubject,
    archiveTeacherSubjectAssignment,
    classTeacherAssignments,
    assignClassTeacher,
    archiveClassTeacherAssignment,
    exams, 
    t, 
    language 
  } = useApp();

  const [tab, setTab] = useState<ManagerTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedYearId, setSelectedYearId] = useState<string>(academicYears.find(y => y.isCurrent)?.id || academicYears[0]?.id || '');
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [focusedSubjectId, setFocusedSubjectId] = useState<string>('ALL');
  
  // Search & Filter state for Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Teacher Assignment View Mode: Teacher-Centric vs Class-Centric
  const [teacherViewMode, setTeacherViewMode] = useState<'by_teacher' | 'by_class'>('by_class');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);

  // Subject Form Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  
  const [newSubject, setNewSubject] = useState<Omit<Subject, 'id'>>({
    name: '',
    nameBn: '',
    code: '',
    category: 'General',
    type: 'Core',
    classLevel: selectedClass,
    examIds: [],
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    isFourthSubject: false,
    order: 0,
    hasCQ: false,
    cqMarks: 70,
    cqPassMarks: 23,
    hasMCQ: false,
    mcqMarks: 30,
    mcqPassMarks: 10,
    hasPractical: false,
    practicalMarks: 25,
    practicalPassMarks: 8,
    status: 'ACTIVE',
    group: ''
  });

  // Quick Teacher Form State
  const [newTeacherData, setNewTeacherData] = useState<Omit<AcademicTeacher, 'id'>>({
    name: '',
    nameBn: '',
    employeeCode: '',
    designation: 'Assistant Teacher',
    email: '',
    phone: '',
    status: 'ACTIVE'
  });

  // Keep selectedClass synchronized
  useEffect(() => {
    if (classes.length > 0 && !classes.some(c => c.name === selectedClass || c.id === selectedClass)) {
      setSelectedClass(classes[0].name);
    }
  }, [classes]);

  useEffect(() => {
    setNewSubject(prev => ({ ...prev, classLevel: selectedClass }));
  }, [selectedClass]);

  // Auto-calculate full marks and pass marks when components change
  useEffect(() => {
    if (newSubject.hasCQ || newSubject.hasMCQ || newSubject.hasPractical) {
      let totalFull = 0;
      let totalPass = 0;
      if (newSubject.hasCQ) {
        totalFull += (newSubject.cqMarks || 0);
        totalPass += (newSubject.cqPassMarks || 0);
      }
      if (newSubject.hasMCQ) {
        totalFull += (newSubject.mcqMarks || 0);
        totalPass += (newSubject.mcqPassMarks || 0);
      }
      if (newSubject.hasPractical) {
        totalFull += (newSubject.practicalMarks || 0);
        totalPass += (newSubject.practicalPassMarks || 0);
      }
      setNewSubject(prev => ({ ...prev, fullMarks: totalFull, passMarks: totalPass }));
    }
  }, [
    newSubject.hasCQ, 
    newSubject.cqMarks, 
    newSubject.cqPassMarks, 
    newSubject.hasMCQ, 
    newSubject.mcqMarks, 
    newSubject.mcqPassMarks,
    newSubject.hasPractical,
    newSubject.practicalMarks,
    newSubject.practicalPassMarks
  ]);

  // Filtered directory subjects
  const filteredSubjects = subjects
    .filter(s => {
      const matchClass = selectedClass === 'ALL' || !selectedClass || s.classLevel === selectedClass;
      const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? s.status !== 'INACTIVE' : s.status === 'INACTIVE');
      const matchCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
      const matchSearch = !searchQuery || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nameBn && s.nameBn.includes(searchQuery)) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchClass && matchStatus && matchCategory && matchSearch;
    })
    .sort((a, b) => a.order - b.order);

  const handleSubmitSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateSubject({ ...newSubject, id: editingId });
      setEditingId(null);
    } else {
      addSubject({ ...newSubject, classLevel: selectedClass, order: filteredSubjects.length + 1 });
    }
    
    setNewSubject({
      name: '',
      nameBn: '',
      code: '',
      category: 'General',
      type: 'Core',
      classLevel: selectedClass,
      examIds: [],
      fullMarks: 100,
      passMarks: 33,
      isOptional: false,
      isFourthSubject: false,
      order: 0,
      hasCQ: false,
      cqMarks: 70,
      cqPassMarks: 23,
      hasMCQ: false,
      mcqMarks: 30,
      mcqPassMarks: 10,
      hasPractical: false,
      practicalMarks: 25,
      practicalPassMarks: 8,
      status: 'ACTIVE',
      group: ''
    });
  };

  const handleEditSubject = (subject: Subject) => {
    setNewSubject(subject);
    setEditingId(subject.id);
    setSelectedClass(subject.classLevel);
  };

  const handleCancelSubject = () => {
    setEditingId(null);
    setNewSubject({
      name: '',
      nameBn: '',
      code: '',
      category: 'General',
      type: 'Core',
      classLevel: selectedClass,
      examIds: [],
      fullMarks: 100,
      passMarks: 33,
      isOptional: false,
      isFourthSubject: false,
      order: 0,
      hasCQ: false,
      cqMarks: 70,
      cqPassMarks: 23,
      hasMCQ: false,
      mcqMarks: 30,
      mcqPassMarks: 10,
      hasPractical: false,
      practicalMarks: 25,
      practicalPassMarks: 8,
      status: 'ACTIVE',
      group: ''
    });
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherData.name.trim()) return;
    addTeacher(newTeacherData);
    setNewTeacherData({
      name: '',
      nameBn: '',
      employeeCode: '',
      designation: 'Assistant Teacher',
      email: '',
      phone: '',
      status: 'ACTIVE'
    });
    setIsTeacherModalOpen(false);
  };

  const toggleSubjectExam = (subject: Subject) => {
    const currentExamIds = subject.examIds || [];
    const isAssigned = currentExamIds.includes(selectedExamId);
    let newExamIds;
    if (isAssigned) {
      newExamIds = currentExamIds.filter(id => id !== selectedExamId);
    } else {
      newExamIds = [...currentExamIds, selectedExamId];
    }
    updateSubject({ ...subject, examIds: newExamIds });
  };

  // Find class sections
  const currentClassObj = classes.find(c => c.name === selectedClass || c.id === selectedClass);
  const classSections = currentClassObj ? sections.filter(s => s.classId === currentClassObj.id || s.classId === currentClassObj.name) : [];

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={26} />
            {language === 'bn' ? 'একাডেমিক বিষয় ও শিক্ষক বণ্টন' : 'Academic Subjects & Teacher Assignment'}
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {language === 'bn' 
              ? 'স্কুল ও মাদ্রাসার বিষয় তালিকা, শ্রেণীভিত্তিক বণ্টন এবং শিক্ষক নিয়োগ ব্যবস্থাপনা' 
              : 'Manage subjects catalog, class curriculums, and teacher academic assignments.'}
          </p>
        </div>

        <div className="bg-gray-100 p-1.5 rounded-xl flex flex-wrap gap-1 w-full md:w-auto">
          <button 
            onClick={() => { setTab('directory'); setFocusedSubjectId('ALL'); }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tab === 'directory' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <BookOpen size={16} />
            {language === 'bn' ? 'বিষয় তালিকা' : 'Subject Catalog'}
          </button>
          <button 
            onClick={() => { setTab('class_assignment'); setFocusedSubjectId('ALL'); }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tab === 'class_assignment' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Layers size={16} />
            {language === 'bn' ? 'শ্রেণীভিত্তিক নির্ধারণ' : 'Class Assignment'}
          </button>
          <button 
            onClick={() => { setTab('teacher_assignment'); setFocusedSubjectId('ALL'); }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tab === 'teacher_assignment' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <UserCheck size={16} />
            {language === 'bn' ? 'শিক্ষক দায়িত্ব বণ্টন' : 'Teacher Assignment'}
          </button>
          <button 
            onClick={() => { setTab('exam_assignment'); setFocusedSubjectId('ALL'); }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tab === 'exam_assignment' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Calendar size={16} />
            {language === 'bn' ? 'পরীক্ষায় নির্ধারণ' : 'Exam Setup'}
          </button>
          <button 
            onClick={() => { setTab('blank_marksheet'); setFocusedSubjectId('ALL'); }}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tab === 'blank_marksheet' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'}`}
          >
            <FileText size={16} />
            {language === 'bn' ? 'নম্বর ফর্দ' : 'Blank Mark Sheet'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SUBJECT DIRECTORY & CATALOG                            */}
      {/* ------------------------------------------------------------- */}
      {tab === 'directory' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'বিষয় খুঁজুন (নাম বা কোড)...' : 'Search subjects by name or code...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">{t('selectClass')}:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-gray-900"
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    handleCancelSubject();
                  }}
                >
                  <option value="ALL">{language === 'bn' ? 'সকল শ্রেণী (All Classes)' : 'All Classes'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">স্ট্যাটাস:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-gray-900"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              {language === 'bn' ? `মোট বিষয়: ${filteredSubjects.length}` : `Total: ${filteredSubjects.length} subjects`}
            </div>
          </div>

          {/* Catalog Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subjects Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 w-12">{t('order')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">{t('subjectName')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">শ্রেণী</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-center">{t('fullMarks')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-center">{t('passMarks')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-center">{t('type')}</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          {language === 'bn' ? 'কোন বিষয় পাওয়া যায়নি। ডানদিকের ফর্ম থেকে নতুন বিষয় যোগ করুন।' : 'No subjects found. Add a new subject using the form.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((sub) => {
                        const isInactive = sub.status === 'INACTIVE';
                        return (
                          <tr key={sub.id} className={`${editingId === sub.id ? 'bg-blue-50' : 'hover:bg-gray-50/70'} ${isInactive ? 'opacity-60 bg-gray-50' : ''}`}>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{sub.order}</td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900 font-bangla flex items-center gap-1.5">
                                {sub.code && (
                                  <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                    {sub.code}
                                  </span>
                                )}
                                {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                                {sub.group && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold uppercase">{sub.group}</span>}
                              </div>
                              <div className="text-[11px] text-gray-400 flex flex-wrap gap-2 mt-0.5">
                                {sub.hasCQ && <span>CQ: {sub.cqMarks} ({sub.cqPassMarks})</span>}
                                {sub.hasMCQ && <span>MCQ: {sub.mcqMarks} ({sub.mcqPassMarks})</span>}
                                {sub.hasPractical && <span>ব্যবহারিক: {sub.practicalMarks} ({sub.practicalPassMarks})</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-600">{sub.classLevel || 'General'}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800">{sub.fullMarks}</td>
                            <td className="px-4 py-3 text-center font-bold text-emerald-700">{sub.passMarks}</td>
                            <td className="px-4 py-3 text-center">
                              {sub.isOptional ? (
                                <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">ঐচ্ছিক</span>
                              ) : (
                                <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">আবশ্যিক</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button 
                                  onClick={() => {
                                    setSelectedClass(sub.classLevel);
                                    setFocusedSubjectId(sub.id);
                                    setTab('blank_marksheet');
                                  }}
                                  className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded cursor-pointer transition-colors"
                                  title={language === 'bn' ? 'নম্বর ফর্দ দেখুন' : 'View Marksheet'}
                                >
                                  <FileText size={15} />
                                </button>
                                <button 
                                  onClick={() => handleEditSubject(sub)} 
                                  className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded cursor-pointer transition-colors" 
                                  title="Edit"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button 
                                  onClick={() => archiveSubject(sub.id)} 
                                  className="text-amber-600 hover:text-amber-800 p-1 hover:bg-amber-50 rounded cursor-pointer transition-colors" 
                                  title={isInactive ? 'Activate' : 'Deactivate / Archive'}
                                >
                                  <Archive size={15} />
                                </button>
                                <button 
                                  onClick={() => setSubjectToDelete(sub)} 
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded cursor-pointer transition-colors" 
                                  title="Delete to trash"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            {/* Create / Edit Subject Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  {editingId ? <Edit2 size={16} className="text-blue-600" /> : <Plus size={16} className="text-blue-600" />}
                  {editingId ? t('update') : (language === 'bn' ? 'নতুন বিষয় তৈরি' : 'Add New Subject')}
                </h3>
                {editingId && (
                  <button onClick={handleCancelSubject} className="text-xs text-red-500 flex items-center hover:underline cursor-pointer">
                    <X size={13} className="mr-0.5"/> Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitSubject} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('subjectName')} (English / Standard) *</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" 
                    value={newSubject.name} 
                    onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
                    placeholder="e.g. Mathematics / Hadith Sharif"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('subjectName')} (বাংলা নাম)</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 font-bangla focus:ring-2 focus:ring-blue-500" 
                    value={newSubject.nameBn || ''} 
                    onChange={e => setNewSubject({...newSubject, nameBn: e.target.value})} 
                    placeholder="যেমন: গণিত / হাদিস শরীফ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">বিষয় কোড (Code)</label>
                    <input 
                      type="text" 
                      className="w-full border rounded-lg p-2 text-sm font-mono bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 uppercase" 
                      value={newSubject.code || ''} 
                      onChange={e => setNewSubject({...newSubject, code: e.target.value.toUpperCase()})} 
                      placeholder="e.g. 109 / AR-101"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ক্যাটাগরি</label>
                    <select 
                      className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                      value={newSubject.category || 'General'}
                      onChange={e => setNewSubject({...newSubject, category: e.target.value as any})}
                    >
                      <option value="General">সাধারণ (General)</option>
                      <option value="Islamic">ইসলামিক / মাদ্রাসা (Islamic)</option>
                      <option value="Science">বিজ্ঞান (Science)</option>
                      <option value="Language">ভাষা ও সাহিত্য (Language)</option>
                      <option value="Commerce">ব্যবসায় শিক্ষা (Commerce)</option>
                      <option value="Vocational">ভোকেশনাল (Vocational)</option>
                    </select>
                  </div>
                </div>

                {/* Mark Components Checkboxes */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2">
                  <span className="text-xs font-bold text-gray-700 block">নম্বর উপাদান (Mark Components):</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newSubject.hasCQ} 
                        onChange={e => setNewSubject({...newSubject, hasCQ: e.target.checked})}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      CQ (সৃজনশীল)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newSubject.hasMCQ} 
                        onChange={e => setNewSubject({...newSubject, hasMCQ: e.target.checked})}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      MCQ (নৈর্ব্যক্তিক)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newSubject.hasPractical} 
                        onChange={e => setNewSubject({...newSubject, hasPractical: e.target.checked})}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      ব্যবহারিক (Practical)
                    </label>
                  </div>

                  {newSubject.hasCQ && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">CQ পূর্ণমান</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.cqMarks ?? 70} 
                          onChange={e => setNewSubject({...newSubject, cqMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">CQ পাস মার্ক</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.cqPassMarks ?? 23} 
                          onChange={e => setNewSubject({...newSubject, cqPassMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>
                  )}

                  {newSubject.hasMCQ && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">MCQ পূর্ণমান</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.mcqMarks ?? 30} 
                          onChange={e => setNewSubject({...newSubject, mcqMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">MCQ পাস মার্ক</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.mcqPassMarks ?? 10} 
                          onChange={e => setNewSubject({...newSubject, mcqPassMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>
                  )}

                  {newSubject.hasPractical && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">ব্যবহারিক পূর্ণমান</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.practicalMarks ?? 25} 
                          onChange={e => setNewSubject({...newSubject, practicalMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600">ব্যবহারিক পাস</label>
                        <input 
                          type="number" 
                          className="w-full border rounded p-1.5 text-xs bg-white text-gray-900" 
                          value={newSubject.practicalPassMarks ?? 8} 
                          onChange={e => setNewSubject({...newSubject, practicalPassMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t('fullMarks')} *</label>
                    <input 
                      type="number" 
                      className="w-full border rounded-lg p-2 text-sm bg-gray-50 text-gray-900 font-bold" 
                      value={newSubject.fullMarks ?? 100} 
                      readOnly={newSubject.hasCQ || newSubject.hasMCQ || newSubject.hasPractical}
                      onChange={e => setNewSubject({...newSubject, fullMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t('passMarks')} *</label>
                    <input 
                      type="number" 
                      className="w-full border rounded-lg p-2 text-sm bg-gray-50 text-gray-900 font-bold" 
                      value={newSubject.passMarks ?? 33}
                      readOnly={newSubject.hasCQ || newSubject.hasMCQ || newSubject.hasPractical}
                      onChange={e => setNewSubject({...newSubject, passMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 py-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newSubject.isOptional} 
                      onChange={e => setNewSubject({...newSubject, isOptional: e.target.checked})}
                      className="rounded text-blue-600"
                    />
                    ঐচ্ছিক বিষয় (Optional)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newSubject.isFourthSubject} 
                      onChange={e => setNewSubject({...newSubject, isFourthSubject: e.target.checked})}
                      className="rounded text-blue-600"
                    />
                    ৪র্থ বিষয় (4th Subject)
                  </label>
                </div>

                <Button type="submit" className="w-full py-2.5 font-bold">
                  {editingId ? <Edit2 size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />} 
                  {editingId ? t('update') : (language === 'bn' ? 'বিষয় সংরক্ষণ করুন' : 'Save Subject')}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: CLASS-SUBJECT ASSIGNMENT                               */}
      {/* ------------------------------------------------------------- */}
      {tab === 'class_assignment' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="text-blue-600" size={20} />
                {language === 'bn' ? 'শ্রেণীতে বিষয় নির্ধারণ' : 'Class-Subject Assignment'}
              </h3>
              <p className="text-xs text-gray-500">
                {language === 'bn' ? 'নির্বাচিত শিক্ষাবর্ষ ও শ্রেণীর জন্য পাঠ্য বিষয়াবলী নির্ধারণ করুন' : 'Assign active subjects to specific classes and curriculum for the academic year.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-gray-600">শিক্ষাবর্ষ:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900"
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-gray-600">{t('selectClass')}:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assignment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.filter(s => s.status !== 'INACTIVE').map(subject => {
              const currentClassObj = classes.find(c => c.name === selectedClass || c.id === selectedClass);
              const targetClassId = currentClassObj?.id || selectedClass;
              const assignment = classSubjectAssignments.find(
                a => a.subjectId === subject.id && 
                     (a.classId === targetClassId || a.classId === selectedClass) &&
                     (!selectedYearId || a.academicYearId === selectedYearId) &&
                     a.status === 'ACTIVE'
              );
              const isAssigned = !!assignment || (classSubjectAssignments.length === 0 && subject.classLevel === selectedClass);

              return (
                <div 
                  key={subject.id}
                  onClick={() => {
                    if (assignment) {
                      archiveClassSubjectAssignment(assignment.id);
                    } else {
                      assignSubjectToClass({
                        academicYearId: selectedYearId || 'ay_default',
                        classId: targetClassId,
                        subjectId: subject.id,
                        status: 'ACTIVE',
                        order: subject.order
                      });
                    }
                  }}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    isAssigned 
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs' 
                      : 'bg-white border-gray-200 hover:border-gray-300 opacity-75'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm font-bangla">
                        {language === 'bn' ? (subject.nameBn || subject.name) : subject.name}
                      </span>
                      {subject.code && (
                        <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                          {subject.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      <span>পূর্ণমান: {subject.fullMarks}</span>
                      <span>•</span>
                      <span>{subject.isOptional ? 'ঐচ্ছিক' : 'আবশ্যিক'}</span>
                    </div>
                  </div>

                  <div>
                    {isAssigned ? (
                      <CheckCircle2 className="text-blue-600" size={22} />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: TEACHER ACADEMIC ASSIGNMENT                            */}
      {/* ------------------------------------------------------------- */}
      {tab === 'teacher_assignment' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserCheck className="text-blue-600" size={20} />
                {language === 'bn' ? 'শিক্ষক দায়িত্ব ও শ্রেণী শিক্ষক বণ্টন' : 'Teacher Academic Assignment'}
              </h3>
              <p className="text-xs text-gray-500">
                {language === 'bn' 
                  ? 'প্রতিটি বিষয়ে পাঠদানকারী শিক্ষক ও প্রধান শ্রেণী শিক্ষক নির্ধারণ করুন' 
                  : 'Assign subject teachers and class/section in-charge teachers.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold">
                <button
                  onClick={() => setTeacherViewMode('by_class')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${teacherViewMode === 'by_class' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600'}`}
                >
                  শ্রেণীভিত্তিক ভিউ (By Class)
                </button>
                <button
                  onClick={() => setTeacherViewMode('by_teacher')}
                  className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${teacherViewMode === 'by_teacher' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600'}`}
                >
                  শিক্ষকভিত্তিক ভিউ (By Teacher)
                </button>
              </div>

              <Button onClick={() => setIsTeacherModalOpen(true)} className="text-xs font-bold py-1.5">
                <Plus size={14} className="mr-1" />
                {language === 'bn' ? 'শিক্ষক যুক্ত করুন' : 'Add Teacher'}
              </Button>
            </div>
          </div>

          {/* CLASS CENTRIC VIEW */}
          {teacherViewMode === 'by_class' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-wrap gap-4 items-center pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-600">{t('selectClass')}:</label>
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <GraduationCap size={18} className="text-blue-600" />
                  {language === 'bn' ? `${selectedClass} - বিষয়ভিত্তিক শিক্ষক তালিকা` : `${selectedClass} - Subject Teachers`}
                </h4>

                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {subjects.filter(s => s.classLevel === selectedClass && s.status !== 'INACTIVE').map(subject => {
                    const currentClassObj = classes.find(c => c.name === selectedClass || c.id === selectedClass);
                    const targetClassId = currentClassObj?.id || selectedClass;
                    const assignment = teacherSubjectAssignments.find(
                      a => a.subjectId === subject.id && 
                           (a.classId === targetClassId || a.classId === selectedClass) &&
                           a.status === 'ACTIVE'
                    );
                    const assignedTeacher = assignment ? teachers.find(t => t.id === assignment.teacherId) : null;

                    return (
                      <div key={subject.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-gray-50/50">
                        <div>
                          <div className="font-bold text-gray-900 font-bangla text-sm">
                            {language === 'bn' ? (subject.nameBn || subject.name) : subject.name}
                            {subject.code && <span className="ml-2 text-xs font-mono text-gray-500">[{subject.code}]</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {subject.isOptional ? 'ঐচ্ছিক বিষয়' : 'আবশ্যিক বিষয়'} • পূর্ণমান: {subject.fullMarks}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <select 
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-gray-900 min-w-[180px]"
                            value={assignment?.teacherId || ''}
                            onChange={(e) => {
                              const tId = e.target.value;
                              if (assignment) {
                                archiveTeacherSubjectAssignment(assignment.id);
                              }
                              if (tId) {
                                assignTeacherToSubject({
                                  academicYearId: selectedYearId || 'ay_default',
                                  classId: targetClassId,
                                  subjectId: subject.id,
                                  teacherId: tId,
                                  status: 'ACTIVE'
                                });
                              }
                            }}
                          >
                            <option value="">{language === 'bn' ? '-- শিক্ষক নির্বাচন করুন --' : '-- Assign Teacher --'}</option>
                            {teachers.filter(t => t.status === 'ACTIVE').map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
                            ))}
                          </select>

                          {assignedTeacher && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                              দায়িত্বপ্রাপ্ত
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TEACHER CENTRIC VIEW */}
          {teacherViewMode === 'by_teacher' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-wrap gap-4 items-center pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-600">শিক্ষক নির্বাচন:</label>
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900 min-w-[200px]"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTeacherId ? (
                <div className="space-y-4">
                  {(() => {
                    const currentTeacher = teachers.find(t => t.id === selectedTeacherId);
                    const teacherAssignments = teacherSubjectAssignments.filter(a => a.teacherId === selectedTeacherId && a.status === 'ACTIVE');
                    
                    return (
                      <div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/80 mb-4 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-gray-900 text-base">{currentTeacher?.name}</h4>
                            <p className="text-xs text-gray-500">{currentTeacher?.designation} • {currentTeacher?.email || 'No email'}</p>
                          </div>
                          <div className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg">
                            মোট দায়িত্ব: {teacherAssignments.length} টি বিষয়
                          </div>
                        </div>

                        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                          {teacherAssignments.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-xs">
                              এই শিক্ষকের জন্য এখনো কোনো বিষয় নির্ধারিত হয়নি।
                            </div>
                          ) : (
                            teacherAssignments.map(a => {
                              const sub = subjects.find(s => s.id === a.subjectId);
                              const cls = classes.find(c => c.id === a.classId || c.name === a.classId);
                              return (
                                <div key={a.id} className="p-4 flex items-center justify-between bg-white">
                                  <div>
                                    <div className="font-bold text-gray-900 text-sm">
                                      {sub ? (language === 'bn' ? (sub.nameBn || sub.name) : sub.name) : a.subjectId}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      শ্রেণী: {cls?.name || a.classId}
                                    </div>
                                  </div>

                                  <button 
                                    onClick={() => archiveTeacherSubjectAssignment(a.id)}
                                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1.5 hover:bg-red-50 rounded-lg cursor-pointer"
                                  >
                                    দায়িত্ব প্রত্যাহার
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  কোনো শিক্ষক পাওয়া যায়নি। উপরে 'Add Teacher' বাটনে ক্লিক করে শিক্ষক যোগ করুন।
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: EXAM ASSIGNMENT (BACKWARD COMPATIBILITY)               */}
      {/* ------------------------------------------------------------- */}
      {tab === 'exam_assignment' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={20} />
                {language === 'bn' ? 'পরীক্ষায় বিষয় নির্ধারণ' : 'Assign Subjects to Exam'}
              </h3>
              <p className="text-xs text-gray-500">
                {language === 'bn' ? 'পরীক্ষা অনুযায়ী কোন কোন বিষয়ে পরীক্ষা অনুষ্ঠিত হবে তা সিলেক্ট করুন' : 'Select subjects included in this examination schedule.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">{t('exam')}:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">{t('selectClass')}:</label>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white text-gray-900"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSubjects.map(sub => {
              const isAssigned = (sub.examIds || []).includes(selectedExamId);
              return (
                <div 
                  key={sub.id}
                  onClick={() => toggleSubjectExam(sub)}
                  className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${isAssigned ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  <span className="font-bold text-sm font-bangla">{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</span>
                  {sub.group && <span className="text-xs mt-1 opacity-80 uppercase font-bold">{sub.group}</span>}
                  <span className="text-[11px] mt-1 font-medium">{isAssigned ? '✓ অন্তর্ভুক্ত' : '+ অন্তর্ভুক্ত নয়'}</span>
                </div>
              );
            })}
            {filteredSubjects.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">
                এই শ্রেণীর জন্য কোনো বিষয় পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: BLANK MARK SHEET                                       */}
      {/* ------------------------------------------------------------- */}
      {tab === 'blank_marksheet' && (
        <BlankMarksheetView 
          initialClass={selectedClass} 
          initialSubjectId={focusedSubjectId} 
          onBack={() => setTab('directory')} 
        />
      )}

      {/* Quick Add Teacher Modal */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                {language === 'bn' ? 'নতুন শিক্ষক যুক্ত করুন' : 'Add Academic Teacher'}
              </h3>
              <button onClick={() => setIsTeacherModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">শিক্ষকের নাম (Full Name) *</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900" 
                  value={newTeacherData.name} 
                  onChange={e => setNewTeacherData({...newTeacherData, name: e.target.value})} 
                  placeholder="e.g. Maulana Abdur Rahman"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">পদবী (Designation)</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900" 
                  value={newTeacherData.designation || ''} 
                  onChange={e => setNewTeacherData({...newTeacherData, designation: e.target.value})} 
                  placeholder="e.g. Senior Teacher / Assistant Maulana"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">কোড (Code)</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-sm font-mono uppercase bg-white text-gray-900" 
                    value={newTeacherData.employeeCode || ''} 
                    onChange={e => setNewTeacherData({...newTeacherData, employeeCode: e.target.value.toUpperCase()})} 
                    placeholder="T-101"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">মোবাইল</label>
                  <input 
                    type="tel" 
                    className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900" 
                    value={newTeacherData.phone || ''} 
                    onChange={e => setNewTeacherData({...newTeacherData, phone: e.target.value})} 
                    placeholder="017xxxxxxxx"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsTeacherModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  সংরক্ষণ করুন
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!subjectToDelete}
        onClose={() => setSubjectToDelete(null)}
        onConfirm={() => {
          if (subjectToDelete) {
            deleteSubject(subjectToDelete.id);
            setSubjectToDelete(null);
          }
        }}
        title={language === 'bn' ? 'বিষয় ডিলিট নিশ্চিতকরণ' : 'Confirm Subject Deletion'}
        message={language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই বিষয়টি ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং প্রয়োজনে পরে রিস্টোর করা যাবে)' 
          : 'Are you sure you want to delete this subject? (It will be moved to the Trash Bin)'}
        highlightText={subjectToDelete ? `${language === 'bn' ? (subjectToDelete.nameBn || subjectToDelete.name) : subjectToDelete.name} • ${subjectToDelete.classLevel}` : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />
    </div>
  );
};
