import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { formatNumber } from '../services/utils';
import { Button } from './ui/Button';
import { Plus, Search, Edit2, Trash2, Filter, Users, UserMinus, UserCheck, UserX, RotateCcw, Info } from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';

export const StudentManager = () => {
  const { students, addStudent, updateStudent, deleteStudent, classes, t, language } = useApp();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Tab: 'all' (all enrolled), 'active' (regular examinees), 'inactive' (on leave / no exam), 'former' (students who left)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'former'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'studentId' | 'name' | 'classLevel'>('studentId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Modals for moving to former, restoring, and deleting
  const [studentToMoveFormer, setStudentToMoveFormer] = useState<Student | null>(null);
  const [moveFormerReason, setMoveFormerReason] = useState('');
  const [moveFormerDate, setMoveFormerDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentToRestore, setStudentToRestore] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    studentId: '',
    name: '',
    nameBn: '',
    fatherName: '',
    fatherNameBn: '',
    motherName: '',
    motherNameBn: '',
    classLevel: '',
    group: '',
    status: 'Active',
    isFormer: false,
    leavingDate: '',
    leavingReason: '',
  });

  const validateForm = () => {
    const name = formData.name?.trim();
    const classLevel = formData.classLevel;

    if (!name || !classLevel) {
      setError(t('nameAndClassRequired'));
      return false;
    }

    if (formData.studentId?.trim()) {
      const isDuplicateId = students.some(s => 
        s.studentId === formData.studentId.trim() && s.id !== (editingId || '')
      );
      if (isDuplicateId) {
        setError(t('duplicateIdError'));
        return false;
      }
    }

    return true;
  };

  const handleSave = (stayInModal: boolean = false) => {
    setError(null);
    setSuccess(false);

    if (!validateForm()) return;

    const name = formData.name.trim();
    const isFormer = formData.status === 'Former' || !!formData.isFormer;
    const finalStatus: 'Active' | 'Inactive' | 'Former' = isFormer 
      ? 'Former' 
      : formData.status === 'Inactive' 
      ? 'Inactive' 
      : 'Active';

    const dataToSave = {
      ...formData,
      name: name,
      studentId: formData.studentId?.trim() || '',
      isFormer,
      status: finalStatus,
    };

    try {
      if (editingId) {
        updateStudent({ ...dataToSave, id: editingId });
      } else {
        addStudent(dataToSave);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      if (stayInModal) {
        const currentClass = formData.classLevel;
        resetForm(currentClass);
        setTimeout(() => nameInputRef.current?.focus(), 0);
      } else {
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to save student:', err);
      setError('Failed to save student. Please try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
  };

  const handleEdit = (student: Student) => {
    const isFormer = student.isFormer || student.status === 'Former';
    const currentStatus: 'Active' | 'Inactive' | 'Former' = isFormer 
      ? 'Former' 
      : student.status === 'Inactive' 
      ? 'Inactive' 
      : 'Active';

    setFormData({
      studentId: student.studentId || '',
      name: student.name || '',
      nameBn: student.nameBn || '',
      fatherName: student.fatherName || '',
      fatherNameBn: student.fatherNameBn || '',
      motherName: student.motherName || '',
      motherNameBn: student.motherNameBn || '',
      classLevel: student.classLevel || '',
      group: student.group || '',
      status: currentStatus,
      isFormer,
      leavingDate: student.leavingDate || '',
      leavingReason: student.leavingReason || '',
    });
    setEditingId(student.id);
    setError(null);
    setSuccess(false);
    setIsModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const resetForm = (targetClass?: string) => {
    const defaultClass = targetClass || (filterClass !== 'All' ? filterClass : (classes[0]?.name || ''));
    setEditingId(null);
    const defaultStatus: 'Active' | 'Inactive' | 'Former' = 
      activeTab === 'former' ? 'Former' : 
      activeTab === 'inactive' ? 'Inactive' : 'Active';

    setFormData({
      studentId: '',
      name: '',
      nameBn: '',
      fatherName: '',
      fatherNameBn: '',
      motherName: '',
      motherNameBn: '',
      classLevel: defaultClass,
      group: '',
      status: defaultStatus,
      isFormer: defaultStatus === 'Former',
      leavingDate: '',
      leavingReason: '',
    });
  };

  const openAddModal = () => {
    resetForm();
    setError(null);
    setSuccess(false);
    setIsModalOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const promptMoveToFormer = (student: Student) => {
    setStudentToMoveFormer(student);
    setMoveFormerReason('');
    setMoveFormerDate(new Date().toISOString().split('T')[0]);
  };

  const confirmMoveToFormer = () => {
    if (!studentToMoveFormer) return;
    updateStudent({
      ...studentToMoveFormer,
      isFormer: true,
      status: 'Former',
      leavingReason: moveFormerReason.trim() || (language === 'bn' ? 'মাদ্রাসা ত্যাগ' : 'Left Madrasha'),
      leavingDate: moveFormerDate || new Date().toISOString().split('T')[0],
    });
    setStudentToMoveFormer(null);
  };

  const promptRestore = (student: Student) => {
    setStudentToRestore(student);
  };

  const confirmRestore = () => {
    if (!studentToRestore) return;
    updateStudent({
      ...studentToRestore,
      isFormer: false,
      status: 'Active',
    });
    setStudentToRestore(null);
  };

  const toggleActiveInactive = (student: Student) => {
    const nextStatus: 'Active' | 'Inactive' = student.status === 'Inactive' ? 'Active' : 'Inactive';
    updateStudent({
      ...student,
      status: nextStatus,
      isFormer: false,
    });
  };

  // Divide into running (all, active, inactive) and former students
  const activeStudentsList = students.filter(s => !s.isFormer && s.status === 'Active');
  const inactiveStudentsList = students.filter(s => !s.isFormer && s.status === 'Inactive');
  const allCurrentStudentsList = students.filter(s => !s.isFormer && s.status !== 'Former');
  const formerStudentsList = students.filter(s => s.isFormer || s.status === 'Former');

  const baseList = 
    activeTab === 'active' ? activeStudentsList :
    activeTab === 'inactive' ? inactiveStudentsList :
    activeTab === 'former' ? formerStudentsList :
    allCurrentStudentsList;

  const filteredStudents = baseList
    .filter(s => 
      (filterClass === 'All' || s.classLevel === filterClass) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       (s.nameBn && s.nameBn.includes(searchTerm)) ||
       (s.studentId && s.studentId.includes(searchTerm)))
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'classLevel') {
        comparison = a.classLevel.localeCompare(b.classLevel);
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'studentId') {
        comparison = (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true });
      }

      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('students')}</h2>
          <p className="text-gray-500 text-sm">{t('manageStudentsInfo')}</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={18} className="mr-2" /> {t('addStudent')}
        </Button>
      </div>

      {/* Tabs: All Enrolled vs Active vs Inactive vs Former Students */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-2 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Users size={17} />
          <span>{language === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {formatNumber(allCurrentStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'active'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserCheck size={17} />
          <span>{language === 'bn' ? 'সক্রিয় (নিয়মিত)' : 'Active'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {formatNumber(activeStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inactive')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inactive'
              ? 'border-amber-600 text-amber-800 bg-amber-50/60 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserX size={17} />
          <span>{language === 'bn' ? 'অনিয়মিত (পরীক্ষা ছাড়া)' : 'Inactive'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'inactive' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'
          }`}>
            {formatNumber(inactiveStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('former')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'former'
              ? 'border-slate-600 text-slate-800 bg-slate-100/70 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserMinus size={17} />
          <span>{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী' : 'Former Students'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'former' ? 'bg-slate-200 text-slate-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {formatNumber(formerStudentsList.length, language)}
          </span>
        </button>
      </div>

      {/* Inactive Students Info Notice */}
      {activeTab === 'inactive' && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{language === 'bn' ? 'অনিয়মিত শিক্ষার্থী সংক্রান্ত তথ্য:' : 'Inactive Student Information:'}</p>
            <p className="text-amber-800 leading-relaxed">{t('inactiveStudentsNotice')}</p>
          </div>
        </div>
      )}

      {/* Former Students Info Notice */}
      {activeTab === 'former' && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <Info size={18} className="text-slate-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {t('formerStudentInfoNotice')}
          </div>
        </div>
      )}

      {/* Search & Class Filter */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <select
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-gray-900 text-sm"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="All">{t('allClasses')}</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 w-16">{t('sn')}</th>
                <th 
                  className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('studentId')}
                >
                  {t('studentId')} {sortBy === 'studentId' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('name')}
                >
                  {t('name')} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('classLevel')}
                >
                  {activeTab === 'former' ? (language === 'bn' ? 'শেষ শ্রেণী' : 'Last Class') : t('class')} {sortBy === 'classLevel' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  {activeTab === 'former' ? t('leavingReason') : t('fatherName')}
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">{t('status')}</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {activeTab === 'former' ? t('noFormerStudents') : activeTab === 'inactive' ? (language === 'bn' ? 'কোনো অনিয়মিত শিক্ষার্থী নেই।' : 'No inactive students found.') : t('noData')}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-gray-500 font-medium">{formatNumber(idx + 1, language)}</td>
                    <td className="px-6 py-3 font-mono text-gray-600">{student.studentId ? formatNumber(student.studentId, language) : '-'}</td>
                    <td className="px-6 py-3">
                      <div className="font-bold text-gray-900 truncate max-w-[150px] font-bangla">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                      {language !== 'bn' && student.nameBn && <div className="text-[10px] text-gray-400 truncate max-w-[150px] font-bangla">{student.nameBn}</div>}
                    </td>
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                      {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}
                      {student.group && <span className="ml-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-bold uppercase">{t(student.group.toLowerCase() as any) || student.group}</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600 truncate max-w-[160px] font-bangla">
                      {activeTab === 'former' ? (
                        <div>
                          <div className="text-gray-900 text-xs font-medium">{student.leavingReason || (language === 'bn' ? 'মাদ্রাসা ত্যাগ' : 'Left')}</div>
                          {student.leavingDate && (
                            <div className="text-[11px] text-gray-400">{student.leavingDate}</div>
                          )}
                        </div>
                      ) : (
                        language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        student.isFormer || student.status === 'Former' 
                          ? 'bg-slate-100 text-slate-700 border border-slate-300' 
                          : student.status === 'Inactive' 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {student.isFormer || student.status === 'Former' 
                          ? (language === 'bn' ? 'প্রাক্তন' : 'Former') 
                          : student.status === 'Inactive' 
                          ? (language === 'bn' ? 'অনিয়মিত' : 'Inactive') 
                          : (language === 'bn' ? 'সক্রিয়' : 'Active')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {activeTab !== 'former' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleActiveInactive(student)}
                              title={student.status === 'Inactive' 
                                ? (language === 'bn' ? 'সক্রিয় করুন (পরীক্ষায় অংশ নেবে)' : 'Make Active (Will attend exam)')
                                : (language === 'bn' ? 'অনিয়মিত করুন (পরীক্ষায় অংশ নেবে না)' : 'Make Inactive (Will not attend exam)')}
                              className={`p-1.5 rounded cursor-pointer transition-colors ${
                                student.status === 'Inactive'
                                  ? 'text-emerald-700 hover:bg-emerald-50'
                                  : 'text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              {student.status === 'Inactive' ? <UserCheck size={16} /> : <UserX size={16} />}
                            </button>
                            <button 
                              type="button"
                              onClick={() => promptMoveToFormer(student)} 
                              title={t('moveToFormer')}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                            >
                              <UserMinus size={16} />
                            </button>
                          </>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => promptRestore(student)} 
                            title={t('restoreStudent')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer transition-colors"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleEdit(student)} 
                          title={t('editStudent' as any) || 'Edit'}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setStudentToDelete(student)} 
                          title="Delete"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Move to Former Modal */}
      {studentToMoveFormer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-amber-50/70">
              <div className="flex items-center gap-2 text-amber-900">
                <UserMinus className="text-amber-600" size={20} />
                <h3 className="font-bold text-base sm:text-lg">{t('moveToFormer')}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setStudentToMoveFormer(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/60 text-xs text-amber-800 leading-relaxed">
                {t('confirmMoveToFormer')}
              </div>

              <div className="text-sm bg-gray-50 p-3 rounded-lg space-y-1 border border-gray-200/60">
                <div className="font-bold text-gray-900 font-bangla">{language === 'bn' ? (studentToMoveFormer.nameBn || studentToMoveFormer.name) : studentToMoveFormer.name}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {t('studentId')}: {studentToMoveFormer.studentId || '-'} &bull; {t('class')}: {studentToMoveFormer.classLevel}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">{t('leavingReason')}</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 bg-white text-gray-900"
                  placeholder={language === 'bn' ? 'যেমন: মাদ্রাসা ত্যাগ / ছাড়পত্র গ্রহণ / স্থানান্তর' : 'e.g. Madrasha transfer / TC / Completed'}
                  value={moveFormerReason}
                  onChange={(e) => setMoveFormerReason(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">{t('leavingDate')}</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 bg-white text-gray-900"
                  value={moveFormerDate}
                  onChange={(e) => setMoveFormerDate(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setStudentToMoveFormer(null)}>
                  {t('cancel')}
                </Button>
                <Button 
                  type="button" 
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={confirmMoveToFormer}
                >
                  {language === 'bn' ? 'প্রাক্তন তালিকায় স্থানান্তর করুন' : 'Confirm Move'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Student Modal */}
      {studentToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-emerald-50/70">
              <div className="flex items-center gap-2 text-emerald-900">
                <RotateCcw className="text-emerald-600" size={20} />
                <h3 className="font-bold text-base sm:text-lg">{t('restoreStudent')}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setStudentToRestore(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm bg-gray-50 p-3 rounded-lg space-y-1 border border-gray-200/60">
                <div className="font-bold text-gray-900 font-bangla">{language === 'bn' ? (studentToRestore.nameBn || studentToRestore.name) : studentToRestore.name}</div>
                <div className="text-xs text-gray-500 font-mono">
                  {t('studentId')}: {studentToRestore.studentId || '-'} &bull; {t('class')}: {studentToRestore.classLevel}
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                {language === 'bn' 
                  ? 'আপনি কি এই শিক্ষার্থীকে পুনরায় বর্তমান শিক্ষার্থী তালিকায় ফিরিয়ে আনতে চান? এর ফলে রানিং ক্লাস কার্যক্রমে এই শিক্ষার্থীর নাম যুক্ত হবে।'
                  : 'Do you want to restore this student back to the current running student list?'}
              </p>

              <div className="pt-3 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setStudentToRestore(null)}>
                  {t('cancel')}
                </Button>
                <Button 
                  type="button" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={confirmRestore}
                >
                  {language === 'bn' ? 'হ্যাঁ, ফিরিয়ে আনুন' : 'Yes, Restore'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{editingId ? t('editStudent') : t('addStudent')}</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
                  {t('savedSuccessfully' as any) || 'Saved successfully!'}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('studentId')}</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" 
                    value={formData.studentId || ''} 
                    onChange={e => setFormData({...formData, studentId: e.target.value})} 
                    placeholder="e.g. 2024001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('name')} <span className="text-red-500">*</span></label>
                  <input 
                    ref={nameInputRef}
                    type="text" 
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('name')} (Bangla)</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-bangla" value={formData.nameBn || ''} onChange={e => setFormData({...formData, nameBn: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('fatherName')}</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" value={formData.fatherName || ''} onChange={e => setFormData({...formData, fatherName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('fatherName')} (Bangla)</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-bangla" value={formData.fatherNameBn || ''} onChange={e => setFormData({...formData, fatherNameBn: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('motherName')}</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" value={formData.motherName || ''} onChange={e => setFormData({...formData, motherName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('motherName')} (Bangla)</label>
                  <input type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-bangla" value={formData.motherNameBn || ''} onChange={e => setFormData({...formData, motherNameBn: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('class')} <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" 
                    value={formData.classLevel || ''} 
                    onChange={e => {
                      const newClass = e.target.value;
                      setFormData({
                        ...formData, 
                        classLevel: newClass
                      });
                    }}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                  </select>
                </div>
                {(formData.classLevel === 'Class 9' || formData.classLevel === 'Class 10') && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t('group')}</label>
                    <select className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" value={formData.group || ''} onChange={e => setFormData({...formData, group: e.target.value as any})}>
                      <option value="">Select Group</option>
                      <option value="General">{t('general') || 'General'}</option>
                      <option value="Science">{t('science')}</option>
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">{t('status')}</label>
                  <select 
                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900" 
                    value={formData.status || 'Active'} 
                    onChange={e => {
                      const newStatus = e.target.value as 'Active' | 'Inactive' | 'Former';
                      setFormData({
                        ...formData, 
                        status: newStatus,
                        isFormer: newStatus === 'Former'
                      });
                    }}
                  >
                    <option value="Active">{language === 'bn' ? 'Active (সক্রিয় / নিয়মিত)' : 'Active (Regular)'}</option>
                    <option value="Inactive">{language === 'bn' ? 'Inactive (অনিয়মিত / সাময়িক বিরতি)' : 'Inactive (No Exam)'}</option>
                    <option value="Former">{language === 'bn' ? 'Former (প্রাক্তন / চলে গেছে)' : 'Former (Left)'}</option>
                  </select>
                  {formData.status === 'Inactive' && (
                    <div className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-1.5 flex items-start gap-1.5">
                      <Info size={14} className="shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        {language === 'bn'
                          ? 'অনিয়মিত শিক্ষার্থী মাদ্রাসায় অধ্যয়নরত কিন্তু কোনো কারণে পরীক্ষায় অংশ নিচ্ছে না। এদের নাম স্টুডেন্ট লিস্টে থাকবে কিন্তু পরীক্ষার মার্কস এন্ট্রি তালিকায় থাকবে না।'
                          : 'Inactive students are enrolled in the madrasah but temporarily not taking exams. They remain in the student list but will not appear in exam mark entry.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(formData.status === 'Former' || formData.isFormer) && (
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
                  <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <UserMinus size={15} className="text-amber-600" />
                    <span>{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী সংক্রান্ত তথ্য' : 'Former Student Information'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">{t('leavingReason')}</label>
                      <input 
                        type="text" 
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 bg-white text-gray-900" 
                        value={formData.leavingReason || ''} 
                        onChange={e => setFormData({...formData, leavingReason: e.target.value})} 
                        placeholder={language === 'bn' ? 'মাদ্রাসা ত্যাগ / ছাড়পত্র গ্রহণ / স্থানান্তর' : 'Reason for leaving'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">{t('leavingDate')}</label>
                      <input 
                        type="date" 
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 bg-white text-gray-900" 
                        value={formData.leavingDate || ''} 
                        onChange={e => setFormData({...formData, leavingDate: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                {!editingId && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => handleSave(true)}
                  >
                    {t('saveAndAddAnother' as any) || 'Save & Add Another'}
                  </Button>
                )}
                <Button type="submit">{t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={() => {
          if (studentToDelete) {
            deleteStudent(studentToDelete.id);
            setStudentToDelete(null);
          }
        }}
        title={language === 'bn' ? 'শিক্ষার্থী ডিলিট নিশ্চিতকরণ' : 'Confirm Student Deletion'}
        message={language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই শিক্ষার্থীর সকল তথ্য ও রেকর্ড ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং পরে প্রয়োজনে রিস্টোর করা যাবে)' 
          : 'Are you sure you want to delete this student record? (It will be moved to the Trash Bin)'}
        highlightText={studentToDelete ? `${language === 'bn' ? (studentToDelete.nameBn || studentToDelete.name) : studentToDelete.name} • ${studentToDelete.classLevel} ${studentToDelete.studentId ? `(${studentToDelete.studentId})` : ''}` : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />
    </div>
  );
};
