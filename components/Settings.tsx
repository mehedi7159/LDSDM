import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { 
  Save, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Download, 
  Upload, 
  Building2, 
  BookOpen, 
  Cloud, 
  Shield, 
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  GraduationCap,
  Sparkles,
  Percent,
  Plus
} from 'lucide-react';
import { Exam, SchoolClass } from '../types';
import { CloudSyncWidget } from './CloudSyncWidget';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ExamRestoreModal } from './ExamRestoreModal';
import { exportExamBackup } from '../services/examBackupService';
import { logAuditEvent } from '../services/auditLog';
import { DataSecurityBackupCenter } from './DataSecurityBackupCenter';

interface SettingsProps {
  initialTab?: 'info' | 'subjects_exam' | 'backup';
}

export const Settings: React.FC<SettingsProps> = ({ initialTab = 'info' }) => {
  const { 
    schoolProfile, 
    updateSchoolProfile, 
    exams, 
    addExam, 
    updateExam, 
    deleteExam, 
    classes, 
    addClass, 
    updateClass, 
    deleteClass, 
    students, 
    subjects, 
    setSubjects, 
    marks, 
    setMarks, 
    remarks, 
    setRemarks, 
    setStudents, 
    setClasses,
    setExams,
    trashBin, 
    restoreFromTrash, 
    emptyTrash, 
    authUser,
    authClaims,
    isSuperAdmin,
    t, 
    language 
  } = useApp();

  const [formData, setFormData] = useState(schoolProfile);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'info' | 'subjects_exam' | 'backup'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveSettingsTab(initialTab);
    }
  }, [initialTab]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExamRestoreModalOpen, setIsExamRestoreModalOpen] = useState(false);
  const [restoreBannerInfo, setRestoreBannerInfo] = useState<string | null>(null);

  // Confirmation dialog states
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [isConfirmEmptyTrashOpen, setIsConfirmEmptyTrashOpen] = useState(false);

  // Exam Form State
  const [newExamName, setNewExamName] = useState('');
  const [newExamNameBn, setNewExamNameBn] = useState('');
  const [newExamCategory, setNewExamCategory] = useState<Exam['category']>('Term');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editExamName, setEditExamName] = useState('');
  const [editExamNameBn, setEditExamNameBn] = useState('');
  const [editExamCategory, setEditExamCategory] = useState<Exam['category']>('Term');

  // Class Form State
  const [newClassName, setNewClassName] = useState('');
  const [newClassNameBn, setNewClassNameBn] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassNameBn, setEditClassNameBn] = useState('');

  // Exam Contributions State
  const [expandedContributionsExamId, setExpandedContributionsExamId] = useState<string | null>(null);
  const [newContribExamId, setNewContribExamId] = useState<string>('');
  const [newContribPercentage, setNewContribPercentage] = useState<number>(30);
  const [selectedExamBackupId, setSelectedExamBackupId] = useState<string>('all');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (field: 'logoUrl' | 'signatureUrl' | 'watermarkUrl') => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolProfile(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Exam Operations
  const handleAddExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newExamName.trim()) {
      addExam(newExamName.trim(), newExamCategory, newExamNameBn.trim());
      setNewExamName('');
      setNewExamNameBn('');
      setNewExamCategory('Term');
    }
  };

  const startEditingExam = (exam: Exam) => {
    setEditingExamId(exam.id);
    setEditExamName(exam.name);
    setEditExamNameBn(exam.nameBn || '');
    setEditExamCategory(exam.category || 'Term');
  };

  const saveExamEdit = (id: string) => {
    const exam = exams.find(e => e.id === id);
    if (exam && editExamName.trim()) {
      updateExam({ ...exam, name: editExamName.trim(), nameBn: editExamNameBn.trim(), category: editExamCategory });
    }
    setEditingExamId(null);
  };

  // Class Operations
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClassName.trim()) {
      addClass(newClassName.trim(), newClassNameBn.trim());
      setNewClassName('');
      setNewClassNameBn('');
    }
  };

  const startEditingClass = (cls: SchoolClass) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassNameBn(cls.nameBn || '');
  };

  const saveClassEdit = (id: string) => {
    const cls = classes.find(c => c.id === id);
    if (cls && editClassName.trim()) {
      updateClass({ ...cls, name: editClassName.trim(), nameBn: editClassNameBn.trim() });
    }
    setEditingClassId(null);
  };

  const addContribution = (examId: string) => {
    if (!newContribExamId) return;
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;

    const existingContribs = exam.contributions || [];
    const totalCurrentPercentage = existingContribs.reduce((sum, c) => sum + c.percentage, 0);

    if (totalCurrentPercentage + newContribPercentage > 100) {
      alert(language === 'bn' ? 'মোট অবদান ১০০% এর বেশি হতে পারে না।' : 'Total contribution percentage cannot exceed 100%.');
      return;
    }

    if (existingContribs.some(c => c.examId === newContribExamId)) {
      alert(language === 'bn' ? 'এই পরীক্ষাটি ইতিমধ্যে তালিকায় যুক্ত আছে।' : 'This exam is already in contributions.');
      return;
    }

    const updatedContribs = [...existingContribs, { examId: newContribExamId, percentage: newContribPercentage }];
    updateExam({ ...exam, contributions: updatedContribs });
    setNewContribExamId('');
  };

  const removeContribution = (examId: string, targetExamId: string) => {
    const exam = exams.find(e => e.id === examId);
    if (!exam || !exam.contributions) return;

    const updatedContribs = exam.contributions.filter(c => c.examId !== targetExamId);
    updateExam({ ...exam, contributions: updatedContribs });
  };

  // Backup & Restore Handlers
  const handleFullBackup = () => {
    const data = { 
      schoolProfile, 
      students, 
      subjects, 
      exams, 
      marks, 
      remarks, 
      classes,
      language: localStorage.getItem('language') || 'en'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `madrasha_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFullRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.schoolProfile) localStorage.setItem('schoolProfile', JSON.stringify(data.schoolProfile));
          if (data.students) localStorage.setItem('students', JSON.stringify(data.students));
          if (data.subjects) localStorage.setItem('subjects', JSON.stringify(data.subjects));
          if (data.exams) localStorage.setItem('exams', JSON.stringify(data.exams));
          if (data.marks) localStorage.setItem('marks', JSON.stringify(data.marks));
          if (data.remarks) localStorage.setItem('remarks', JSON.stringify(data.remarks));
          if (data.classes) localStorage.setItem('classes', JSON.stringify(data.classes));
          if (data.language) localStorage.setItem('language', data.language);
          alert(language === 'bn' ? 'তথ্য সফলভাবে পুনরুদ্ধার করা হয়েছে! পেজটি রিলোড হচ্ছে।' : 'Data restored successfully! Reloading...');
          window.location.reload();
        } catch {
          alert(language === 'bn' ? 'ভুল বা ক্ষতিগ্রস্ত ব্যাকআপ ফাইল।' : 'Invalid or corrupted backup file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleStudentBackup = () => {
    const data = { students, exportDate: new Date().toISOString(), version: '1.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `madrasha_students_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStudentRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          const studentList = Array.isArray(content) ? content : content.students;
          if (studentList && studentList.length > 0) {
            if (confirm(language === 'bn' 
              ? `সতর্কতা: এটি বর্তমান শিক্ষার্থী তালিকা প্রতিস্থাপন করবে (${studentList.length} জন শিক্ষার্থী)। আপনি কি নিশ্চিত?` 
              : `Warning: This will replace current student list (${studentList.length} students). Continue?`)) {
              setStudents(studentList);
              localStorage.setItem('students', JSON.stringify(studentList));
              alert(language === 'bn' ? 'শিক্ষার্থী তালিকা সফলভাবে রিস্টোর হয়েছে!' : 'Student list restored!');
            }
          }
        } catch {
          alert(language === 'bn' ? 'ভুল ব্যাকআপ ফাইল।' : 'Invalid backup file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExamMarksBackup = (customExamId?: string) => {
    const examIdToUse = customExamId || selectedExamBackupId;
    exportExamBackup({
      examId: examIdToUse,
      exams,
      marks,
      remarks,
      students,
      subjects,
      classes,
      schoolProfile
    });
  };

  const handleExamMarksRestoreSuccess = (result: any) => {
    if (!result) return;
    
    // 1. Update React App Context State
    setMarks(result.updatedMarks);
    setRemarks(result.updatedRemarks);
    setExams(result.updatedExams);
    if (result.updatedSubjects && result.updatedSubjects.length > subjects.length) {
      setSubjects(result.updatedSubjects);
    }

    // 2. Persist to LocalStorage
    localStorage.setItem('marks', JSON.stringify(result.updatedMarks));
    localStorage.setItem('remarks', JSON.stringify(result.updatedRemarks));
    localStorage.setItem('exams', JSON.stringify(result.updatedExams));
    if (result.updatedSubjects) {
      localStorage.setItem('subjects', JSON.stringify(result.updatedSubjects));
    }

    // 3. Set visual notification banner
    const bannerText = language === 'bn' 
      ? `"${result.stats.targetExamName}" পরীক্ষার ${result.stats.restoredMarksCount} টি নম্বর সফলভাবে রিস্টোর হয়েছে!`
      : `Restored ${result.stats.restoredMarksCount} marks for exam "${result.stats.targetExamName}"!`;
    setRestoreBannerInfo(bannerText);
    setTimeout(() => setRestoreBannerInfo(null), 8000);

    // 4. Record audit event
    if (authUser) {
      logAuditEvent({
        action: 'EXAM_MARKS_RESTORED',
        actorUid: authUser.uid,
        actorEmail: authUser.email || '',
        actorRole: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin'),
        institutionId: 'main_store',
        targetType: 'settings',
        targetId: result.stats.targetExamId,
        targetName: result.stats.targetExamName,
        metadata: {
          actionType: 'EXAM_MARKS_RESTORE',
          restoredMarksCount: result.stats.restoredMarksCount,
          insertedMarksCount: result.stats.insertedMarksCount,
          replacedMarksCount: result.stats.replacedMarksCount,
          restoredRemarksCount: result.stats.restoredRemarksCount,
          examCreated: result.stats.examCreated
        }
      }).catch(err => console.warn('Audit log notice:', err));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-16 px-2 sm:px-4">
      
      {/* Modern Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={22} />
            </span>
            {t('schoolSettings')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('schoolSettingsDesc')}
          </p>
        </div>

        {/* Action / Success Pill */}
        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 animate-in fade-in">
            <CheckCircle2 size={16} />
            {language === 'bn' ? 'সেটিংস সংরক্ষিত হয়েছে' : 'Settings Saved'}
          </div>
        )}
      </div>

      {/* Modern Tab Bar */}
      <div className="grid grid-cols-3 bg-slate-200/60 p-1.5 rounded-2xl gap-1.5 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveSettingsTab('info')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl transition-all cursor-pointer ${
            activeSettingsTab === 'info'
              ? 'bg-white text-indigo-600 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Building2 size={16} />
          <span className="truncate">{t('tabMadrasahInfo')}</span>
        </button>

        <button
          onClick={() => setActiveSettingsTab('subjects_exam')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl transition-all cursor-pointer ${
            activeSettingsTab === 'subjects_exam'
              ? 'bg-white text-indigo-600 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <BookOpen size={16} />
          <span className="truncate">{t('tabSubjectsExam')}</span>
        </button>

        <button
          onClick={() => setActiveSettingsTab('backup')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl transition-all cursor-pointer ${
            activeSettingsTab === 'backup'
              ? 'bg-white text-indigo-600 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Cloud size={16} />
          <span className="truncate">{t('tabBackupSystem')}</span>
        </button>
      </div>

      {/* ===================== TAB 1: MADRASAH INFO ===================== */}
      {activeSettingsTab === 'info' && (
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Card 1: Basic Institution Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('schoolProfile')}</h3>
                <p className="text-xs text-slate-400">{language === 'bn' ? 'মাদ্রাসার প্রাথমিক তথ্য ও যোগাযোগের ঠিকানা' : 'Primary institutional details & contact info'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('schoolName')} (English)</label>
                <input 
                  name="name" 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('schoolName')} (বাংলা)</label>
                <input 
                  name="nameBn" 
                  type="text" 
                  value={formData.nameBn || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-bangla font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('address')} (English)</label>
                <input 
                  name="address" 
                  type="text" 
                  value={formData.address || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('address')} (বাংলা)</label>
                <input 
                  name="addressBn" 
                  type="text" 
                  value={formData.addressBn || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-bangla font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('eiin')}</label>
                <input 
                  name="eiin" 
                  type="text" 
                  value={formData.eiin || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('phone')}</label>
                <input 
                  name="phone" 
                  type="text" 
                  value={formData.phone || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('email')}</label>
                <input 
                  name="email" 
                  type="email" 
                  value={formData.email || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('establishedYear')}</label>
                <input 
                  name="established" 
                  type="text" 
                  value={formData.established || ''} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all" 
                />
              </div>
            </div>
          </div>

          {/* Card 2: Branding & Media Uploads */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <ImageIcon size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{language === 'bn' ? 'ব্র্যান্ডিং ও প্রাতিষ্ঠানিক ছবি' : 'Branding & Visual Assets'}</h3>
                <p className="text-xs text-slate-400">{language === 'bn' ? 'লোগো, প্রধান শিক্ষকের স্বাক্ষর এবং জলছাপ আপলোড করুন' : 'Upload logo, official signature, and report watermark'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Logo Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('uploadLogo')}</label>
                  <p className="text-[11px] text-slate-400 mb-2.5">{language === 'bn' ? 'পিএনজি বা জেপিজি ফরম্যাট' : 'PNG or JPG image'}</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, 'logoUrl')} 
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" 
                  />
                </div>
                {formData.logoUrl && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                    <img src={formData.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded" />
                    <button type="button" onClick={() => removeFile('logoUrl')} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Signature Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('uploadSignature')}</label>
                  <p className="text-[11px] text-slate-400 mb-2.5">{language === 'bn' ? 'স্বচ্ছ ব্যাকগ্রাউন্ড স্বাক্ষর' : 'Transparent signature'}</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, 'signatureUrl')} 
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" 
                  />
                </div>
                {formData.signatureUrl && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                    <img src={formData.signatureUrl} alt="Signature" className="h-8 w-auto max-w-[80px] object-contain rounded" />
                    <button type="button" onClick={() => removeFile('signatureUrl')} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Watermark Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('uploadWatermark')}</label>
                  <p className="text-[11px] text-slate-400 mb-2.5">{language === 'bn' ? 'রেজাল্ট কার্ডের জলছাপ' : 'Mark sheet watermark'}</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, 'watermarkUrl')} 
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" 
                  />
                </div>
                {formData.watermarkUrl && (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                    <img src={formData.watermarkUrl} alt="Watermark" className="h-9 w-9 object-contain rounded" />
                    <button type="button" onClick={() => removeFile('watermarkUrl')} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Result Card Preferences & Typography */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('resultCardOptions') || 'Result Card & Typography Customization'}</h3>
                <p className="text-xs text-slate-400">{language === 'bn' ? 'ফন্ট স্টাইল, টেমপ্লেট এবং রেজাল্ট কার্ডের ভিজ্যুয়াল অপশনসমূহ' : 'Fonts, themes and result card layout options'}</p>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-indigo-50/30 transition-all cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.showWatermark || false} 
                  onChange={(e) => setFormData({...formData, showWatermark: e.target.checked})} 
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-xs font-bold text-slate-700">{t('showWatermark')}</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-indigo-50/30 transition-all cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.showLogoOnCard !== false} 
                  onChange={(e) => setFormData({...formData, showLogoOnCard: e.target.checked})} 
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-xs font-bold text-slate-700">{t('showLogoOnCard')}</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-indigo-50/30 transition-all cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.showHeadmasterSignature !== false} 
                  onChange={(e) => setFormData({...formData, showHeadmasterSignature: e.target.checked})} 
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-xs font-bold text-slate-700">{t('showHeadmasterSignature')}</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-indigo-50/30 transition-all cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.showGuardianSignature !== false} 
                  onChange={(e) => setFormData({...formData, showGuardianSignature: e.target.checked})} 
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-xs font-bold text-slate-700">{t('showGuardianSignature')}</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60 hover:bg-indigo-50/30 transition-all cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={formData.showClassTeacherSignature !== false} 
                  onChange={(e) => setFormData({...formData, showClassTeacherSignature: e.target.checked})} 
                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-xs font-bold text-slate-700">{t('showClassTeacherSignature') || 'Class Teacher Signature'}</span>
              </label>
            </div>

            {/* Dynamic Bangla Font & Typography Suite Card */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600" />
                    <span>{language === 'bn' ? 'বাংলা ফন্ট ও টাইপোগ্রাফি কনফিগারেশন' : 'Bangla Typography & Font Suite'}</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    {language === 'bn' 
                      ? 'পুরো সফটওয়্যার এবং রেজাল্ট শিটের জন্য আপনার পছন্দের বাংলা ফন্ট ও সংখ্যা নির্বাচন করুন (১, ১০, ১০০ ইত্যাদি সকল সংখ্যা তাৎক্ষণিক প্রিভিউ সহ)।' 
                      : 'Choose your preferred Bengali font & numeral rendering dynamically without hardcoded CSS.'}
                  </p>
                </div>
              </div>

              {/* Dynamic Interactive Font Selector Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {[
                  { id: 'Noto Sans Bengali', nameBn: 'নোতো সান্স বাংলা', tag: 'সেরা ও স্পষ্ট', desc: 'সর্বাধিক স্পষ্ট বাংলা ফন্ট। ১, ১০, ১০০ সহ সকল সংখ্যা অত্যন্ত পরিষ্কার।' },
                  { id: 'Anek Bangla', nameBn: 'অনেক বাংলা', tag: 'বড় ও বোল্ড সংখ্যা', desc: 'আধুনিক জ্যামিতিক নকশা ও চমৎকার বাংলা সংখ্যা রেন্ডারিং।' },
                  { id: 'Hind Siliguri', nameBn: 'হিন্দ শিলিগুড়ি', tag: 'জনপ্রিয় ক্লাসিক', desc: 'প্রচলিত স্ট্যান্ডার্ড বাংলা ওয়েব ফন্ট।' },
                  { id: 'Kalpurush', nameBn: 'কালপুরুষ', tag: 'অফিসিয়াল ডকুমেন্টস', desc: 'চিরচেনা ক্লাসিক সনদ ও নোটিশ উপযোগী ফন্ট।' },
                  { id: 'Tiro Bangla', nameBn: 'তিরো বাংলা', tag: 'ফরমাল ও মার্জিত', desc: 'প্রকাশনা ও প্রথাগত প্রাতিষ্ঠানিক ফন্ট।' },
                  { id: 'Noto Serif Bengali', nameBn: 'নোতো শেরিফ', tag: 'ঐতিহ্যবাহী শেরিফ', desc: 'বই ও সার্টিফিকেট উপযোগী মার্জিত শেরিফ ফন্ট।' },
                  { id: 'Baloo Da 2', nameBn: 'বালু দা ২', tag: 'গোলাকার ও আকর্ষণীয়', desc: 'মডার্ন কার্ভড ও ফ্রেন্ডলি ডিজাইন।' },
                  { id: 'Mina', nameBn: 'মিনা', tag: 'মিনিমালিস্ট', desc: 'সরল ও হালকা গঠনের বাংলা ফন্ট।' },
                  { id: 'Atma', nameBn: 'আত্মা', tag: 'হস্তাক্ষর', desc: 'হাতে লেখার মতো ক্যাজুয়াল স্টাইল।' },
                ].map((f) => {
                  const isSelected = (formData.banglaFont || 'Noto Sans Bengali') === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setFormData({ ...formData, banglaFont: f.id, banglaNumberFont: f.id });
                        // Dynamically update CSS root variables immediately for instant preview
                        document.documentElement.style.setProperty('--bangla-font', `'${f.id}', 'Noto Sans Bengali', sans-serif`);
                        document.documentElement.style.setProperty('--bangla-num-font', `'${f.id}', 'Noto Sans Bengali', sans-serif`);
                        document.body.style.fontFamily = `'${f.id}', 'Noto Sans Bengali', sans-serif`;
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span 
                            className="font-bold text-sm text-slate-900"
                            style={{ fontFamily: `'${f.id}', sans-serif` }}
                          >
                            {f.nameBn}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isSelected 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {f.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
                          {f.desc}
                        </p>
                      </div>

                      {/* Mini Live Preview in this font */}
                      <div 
                        className="p-2 rounded-xl bg-white border border-slate-100 text-xs text-slate-800 flex items-center justify-between font-medium"
                        style={{ fontFamily: `'${f.id}', sans-serif` }}
                      >
                        <span className="truncate">ক খ গ ঘ ঙ</span>
                        <span className="font-bold text-indigo-700">১, ১০, ১০০, ১০০০</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Interactive Typography Sandbox / Preview Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span>{language === 'bn' ? 'লাইভ ফন্ট ও সংখ্যা প্রিভিউ স্যান্ডবক্স' : 'Live Font & Numeral Preview'}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 font-mono text-[11px] border border-white/10">
                    {formData.banglaFont || 'Noto Sans Bengali'}
                  </span>
                </div>

                <div 
                  className="space-y-1.5 pt-1"
                  style={{ fontFamily: `'${formData.banglaFont || 'Noto Sans Bengali'}', sans-serif` }}
                >
                  <p className="text-base sm:text-lg font-bold text-slate-100">
                    বিসমিল্লাহির রাহমানির রাহিম — {schoolProfile.nameBn || schoolProfile.name}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    মাদরাসা ম্যানেজমেন্ট সিস্টেম: শিক্ষার্থীর রোল নম্বর, নম্বর এন্ট্রি, মাসিক বেতন ও স্বয়ংক্রিয় পরীক্ষার ফলাফল প্রস্তুতকরণ।
                  </p>
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold text-amber-300">
                    <span>বাংলা সংখ্যামালা: ১, ২, ৩, ৪, ৫, ৬, ৭, ৮, ৯, ১০, ৫০, ১০০, ৫০০, ১০০০</span>
                    <span className="text-emerald-300">| জিপিএ: ৫.০০ (A+)</span>
                  </div>
                </div>
              </div>

              {/* Direct Dropdown Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('resultCardTemplate')}</label>
                  <select 
                    value={formData.resultCardTemplate || 'Classic'} 
                    onChange={(e) => setFormData({...formData, resultCardTemplate: e.target.value as any})}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="Classic">{t('classic')}</option>
                    <option value="Monthly">{t('monthly')}</option>
                    <option value="Term">{t('term')}</option>
                    <option value="BW_Term">{t('bw_term')}</option>
                    <option value="Premium_Dakhil">{t('premium_dakhil')}</option>
                    <option value="Premium_Colored">{t('premium_colored')}</option>
                    <option value="Premium_Royal">{t('premium_royal')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('banglaFont')}</label>
                  <select 
                    value={formData.banglaFont || 'Noto Sans Bengali'} 
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setFormData({...formData, banglaFont: newFont});
                      document.documentElement.style.setProperty('--bangla-font', `'${newFont}', 'Noto Sans Bengali', sans-serif`);
                      document.body.style.fontFamily = `'${newFont}', 'Noto Sans Bengali', sans-serif`;
                    }}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="Noto Sans Bengali">Noto Sans Bengali (নোতো সান্স বাংলা - ডিফল্ট ও সর্বাধিক স্পষ্ট)</option>
                    <option value="Anek Bangla">Anek Bangla (অনেক বাংলা - বড় ও স্পষ্ট সংখ্যা)</option>
                    <option value="Hind Siliguri">Hind Siliguri (হিন্দ শিলিগুড়ি)</option>
                    <option value="Kalpurush">Kalpurush (কালপুরুষ)</option>
                    <option value="Tiro Bangla">Tiro Bangla (তিরো বাংলা)</option>
                    <option value="Noto Serif Bengali">Noto Serif Bengali (নোতো শেরিফ বাংলা)</option>
                    <option value="Baloo Da 2">Baloo Da 2 (বালু দা ২)</option>
                    <option value="Mina">Mina (মিনা)</option>
                    <option value="Atma">Atma (আত্মা)</option>
                    <option value="Galada">Galada (গলাদা)</option>
                    <option value="Alkatra">Alkatra (আলকাতরা)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('banglaNumberFont')}</label>
                  <select 
                    value={formData.banglaNumberFont || 'Noto Sans Bengali'} 
                    onChange={(e) => {
                      const newNumFont = e.target.value;
                      setFormData({...formData, banglaNumberFont: newNumFont});
                      document.documentElement.style.setProperty('--bangla-num-font', `'${newNumFont}', 'Noto Sans Bengali', sans-serif`);
                    }}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="Noto Sans Bengali">Noto Sans Bengali (নোতো সান্স বাংলা - ১, ১০, ১০০ স্পষ্ট)</option>
                    <option value="Anek Bangla">Anek Bangla (অনেক বাংলা - স্পষ্ট জ্যামিতিক সংখ্যা)</option>
                    <option value="Hind Siliguri">Hind Siliguri (হিন্দ শিলিগুড়ি)</option>
                    <option value="Kalpurush">Kalpurush (কালপুরুষ)</option>
                    <option value="Tiro Bangla">Tiro Bangla (তিরো বাংলা)</option>
                    <option value="Noto Serif Bengali">Noto Serif Bengali (নোতো শেরিফ বাংলা)</option>
                    <option value="Baloo Da 2">Baloo Da 2 (বালু দা ২)</option>
                    <option value="Mina">Mina (মিনা)</option>
                    <option value="Atma">Atma (আত্মা)</option>
                    <option value="Galada">Galada (গলাদা)</option>
                    <option value="Alkatra">Alkatra (আলকাতরা)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky/Bottom Save Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="py-3.5 px-8 bg-[#5438dc] hover:bg-[#472fc4] text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-[0.99] cursor-pointer"
            >
              <Save size={18} />
              <span>{t('saveConfig')}</span>
            </button>
          </div>
        </form>
      )}

      {/* ===================== TAB 2: SUBJECTS & EXAM ===================== */}
      {activeSettingsTab === 'subjects_exam' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Exam Configuration Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('examConfig')}</h3>
                  <p className="text-xs text-slate-400">{exams.length} {language === 'bn' ? 'টি পরীক্ষা কনফিগার করা আছে' : 'exams configured'}</p>
                </div>
              </div>
            </div>

            {/* Exam List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {exams.map(exam => (
                <div key={exam.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/60 transition-all space-y-2.5">
                  {editingExamId === exam.id ? (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-indigo-200">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          className="border border-slate-200 rounded-lg p-2 text-xs bg-white text-slate-900" 
                          value={editExamName} 
                          onChange={e => setEditExamName(e.target.value)} 
                          placeholder="Name (EN)" 
                        />
                        <input 
                          className="border border-slate-200 rounded-lg p-2 text-xs bg-white text-slate-900 font-bangla" 
                          value={editExamNameBn} 
                          onChange={e => setEditExamNameBn(e.target.value)} 
                          placeholder="নাম (বাংলা)" 
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <select 
                          className="border border-slate-200 rounded-lg p-1.5 text-xs bg-white flex-1" 
                          value={editExamCategory} 
                          onChange={e => setEditExamCategory(e.target.value as any)}
                        >
                          <option value="Term">{t('termFinal')}</option>
                          <option value="Model">{t('modelTest')}</option>
                          <option value="Monthly">{t('monthlyExam')}</option>
                        </select>
                        <div className="flex gap-1">
                          <button onClick={() => saveExamEdit(exam.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={16}/></button>
                          <button onClick={() => setEditingExamId(null)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {exam.name} {exam.nameBn && <span className="font-bangla text-slate-500 font-medium">({exam.nameBn})</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                              {exam.category === 'Term' ? t('termFinal') : exam.category === 'Model' ? t('modelTest') : t('monthlyExam')}
                            </span>
                            {exam.contributions && exam.contributions.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 flex items-center gap-1">
                                <Percent size={10} /> {language === 'bn' ? 'অবদানযুক্ত' : 'Consolidated'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleExamMarksBackup(exam.id)}
                            title={language === 'bn' ? `${exam.name}-এর নম্বর ব্যাকআপ নিন` : `Download backup of ${exam.name}`}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Download size={15}/>
                          </button>
                          <button 
                            onClick={() => setExpandedContributionsExamId(expandedContributionsExamId === exam.id ? null : exam.id)} 
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl transition-all"
                          >
                            % {exam.contributions?.length || 0}
                          </button>
                          <button onClick={() => startEditingExam(exam)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><Edit2 size={15}/></button>
                          <button onClick={() => setExamToDelete(exam)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all" title="Delete"><Trash2 size={15}/></button>
                        </div>
                      </div>

                      {/* Contribution Manager Accordion */}
                      {expandedContributionsExamId === exam.id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 bg-white p-3.5 rounded-xl border">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>{language === 'bn' ? 'পূর্ববর্তী পরীক্ষা অবদান' : 'Contributor Exams'}</span>
                            <span className="text-[11px] text-indigo-600">
                              {language === 'bn' ? `মূল পরীক্ষা: ${100 - (exam.contributions || []).reduce((s, c) => s + c.percentage, 0)}%` : `Main Exam: ${100 - (exam.contributions || []).reduce((s, c) => s + c.percentage, 0)}%`}
                            </span>
                          </div>

                          {exam.contributions && exam.contributions.length > 0 ? (
                            <div className="space-y-1.5">
                              {exam.contributions.map((c, idx) => {
                                const contribExam = exams.find(e => e.id === c.examId);
                                return (
                                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <span className="font-semibold text-slate-800">{contribExam?.name || 'Unknown'}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">{c.percentage}%</span>
                                      <button type="button" onClick={() => removeContribution(exam.id, c.examId)} className="text-rose-500 hover:text-rose-700 p-0.5"><Trash2 size={13}/></button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">{language === 'bn' ? 'কোনো অবদানকারী পরীক্ষা নেই।' : 'No contributors added.'}</p>
                          )}

                          <div className="flex items-center gap-1.5 pt-1">
                            <select 
                              value={newContribExamId} 
                              onChange={e => setNewContribExamId(e.target.value)} 
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white flex-1"
                            >
                              <option value="">{language === 'bn' ? 'পরীক্ষা নির্বাচন করুন' : 'Select exam'}</option>
                              {exams.filter(e => e.id !== exam.id).map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                            <input 
                              type="number" 
                              min="1" 
                              max="100" 
                              value={newContribPercentage} 
                              onChange={e => setNewContribPercentage(Number(e.target.value))} 
                              className="w-12 border border-slate-200 rounded-lg p-1.5 text-xs text-center font-bold bg-white" 
                            />
                            <button 
                              type="button" 
                              onClick={() => addContribution(exam.id)} 
                              className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 cursor-pointer"
                            >
                              {language === 'bn' ? 'যুক্ত' : 'Add'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Exam Form */}
            <form onSubmit={handleAddExam} className="pt-4 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  value={newExamName} 
                  onChange={e => setNewExamName(e.target.value)} 
                  className="border border-slate-200 rounded-xl p-2.5 text-xs bg-white text-slate-900 font-medium" 
                  placeholder="Exam Name (EN)" 
                  required 
                />
                <input 
                  type="text" 
                  value={newExamNameBn} 
                  onChange={e => setNewExamNameBn(e.target.value)} 
                  className="border border-slate-200 rounded-xl p-2.5 text-xs bg-white text-slate-900 font-bangla font-medium" 
                  placeholder="পরীক্ষার নাম (বাংলা)" 
                />
              </div>
              <div className="flex gap-2">
                <select 
                  className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs bg-white text-slate-900 font-medium" 
                  value={newExamCategory} 
                  onChange={e => setNewExamCategory(e.target.value as any)}
                >
                  <option value="Term">{t('termFinal')}</option>
                  <option value="Model">{t('modelTest')}</option>
                  <option value="Monthly">{t('monthlyExam')}</option>
                </select>
                <button 
                  type="submit" 
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> {t('addExam')}
                </button>
              </div>
            </form>
          </div>

          {/* Class Configuration Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('classConfig')}</h3>
                  <p className="text-xs text-slate-400">{classes.length} {language === 'bn' ? 'টি শ্রেণি সংরক্ষিত আছে' : 'classes configured'}</p>
                </div>
              </div>
            </div>

            {/* Class List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {classes.map(cls => (
                <div key={cls.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                  {editingClassId === cls.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input className="border border-slate-200 rounded-lg p-1.5 text-xs flex-1 bg-white" value={editClassName} onChange={e => setEditClassName(e.target.value)} />
                      <input className="border border-slate-200 rounded-lg p-1.5 text-xs flex-1 font-bangla bg-white" value={editClassNameBn} onChange={e => setEditClassNameBn(e.target.value)} placeholder="বাংলা" />
                      <button onClick={() => saveClassEdit(cls.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingClassId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-slate-800">
                        {cls.name} {cls.nameBn && <span className="font-bangla font-medium text-slate-500">({cls.nameBn})</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditingClass(cls)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><Edit2 size={14}/></button>
                        <button onClick={() => setClassToDelete(cls)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all" title="Delete"><Trash2 size={14}/></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add Class Form */}
            <form onSubmit={handleAddClass} className="pt-4 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  value={newClassName} 
                  onChange={e => setNewClassName(e.target.value)} 
                  className="border border-slate-200 rounded-xl p-2.5 text-xs bg-white text-slate-900 font-medium" 
                  placeholder="Class Name (EN)" 
                  required 
                />
                <input 
                  type="text" 
                  value={newClassNameBn} 
                  onChange={e => setNewClassNameBn(e.target.value)} 
                  className="border border-slate-200 rounded-xl p-2.5 text-xs bg-white text-slate-900 font-bangla font-medium" 
                  placeholder="শ্রেণির নাম (বাংলা)" 
                />
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> {t('addClass')}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* ===================== TAB 3: BACKUP & CLOUD ===================== */}
      {activeSettingsTab === 'backup' && (
        <div className="space-y-7">
          
          {/* Complete Multi-Store Data Security Hub */}
          <DataSecurityBackupCenter />

          {/* Recycle Bin & Trash */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('recycleBin')}</h3>
                  <p className="text-xs text-slate-500">{t('recycleBinDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                  {trashBin.length} {language === 'bn' ? 'টি আইটেম' : 'items'}
                </span>
                {trashBin.length > 0 && (
                  <button onClick={() => setIsConfirmEmptyTrashOpen(true)} className="px-3 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer">
                    {t('emptyTrash')}
                  </button>
                )}
              </div>
            </div>

            {trashBin.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                {language === 'bn' ? 'রিসাইকেল বিন সম্পূর্ণ খালি রয়েছে।' : 'Recycle bin is completely empty.'}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {trashBin.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-amber-50/30 text-xs transition-all">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded">
                          {item.type}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          {item.type === 'student' && (item.data.name || item.data.nameBn)}
                          {item.type === 'subject' && (item.data.name || item.data.nameBn)}
                          {item.type === 'exam' && (item.data.name || item.data.nameBn)}
                          {item.type === 'class' && (item.data.name || item.data.nameBn)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {language === 'bn' ? 'ডিলিট হয়েছে:' : 'Deleted:'} {item.deletedAt}
                      </p>
                    </div>
                    <button 
                      onClick={() => restoreFromTrash(item.id)} 
                      className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer"
                    >
                      {t('restore')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Local File Backup & Restore Hub */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('dataBackupRestore')}</h3>
                <p className="text-xs text-slate-400">{t('dataBackupRestoreDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Full System Backup */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('fullSystemBackup')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{language === 'bn' ? 'সবকিছু একসাথে এক্সপোর্ট ও ইম্পোর্ট' : 'Export & import entire academy database'}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleFullBackup} className="flex-1 py-2.5 px-3 bg-[#5438dc] hover:bg-[#472fc4] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Download size={14} /> {language === 'bn' ? 'ডাউনলোড' : 'Download'}
                  </button>
                  <div className="relative flex-1">
                    <input type="file" accept=".json" onChange={handleFullRestore} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <button className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 pointer-events-none">
                      <Upload size={14} /> {language === 'bn' ? 'আপলোড' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Database Backup */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('studentBackup')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{students.length} {language === 'bn' ? 'জন শিক্ষার্থীর তালিকা' : 'students registered'}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleStudentBackup} className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    <Download size={14} /> {language === 'bn' ? 'এক্সপোর্ট' : 'Export'}
                  </button>
                  <div className="relative flex-1">
                    <input type="file" accept=".json" onChange={handleStudentRestore} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    <button className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 pointer-events-none">
                      <Upload size={14} /> {language === 'bn' ? 'ইম্পোর্ট' : 'Import'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Exam Marks Backup & Restore Hub */}
              <div className="p-4 rounded-2xl border border-purple-200/80 bg-purple-50/40 space-y-3 col-span-1 sm:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{t('examMarksBackup')}</h4>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-purple-200/80 text-purple-900 rounded-md">
                        Enhanced
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{t('examMarksBackupDesc')}</p>
                  </div>
                  <select 
                    value={selectedExamBackupId} 
                    onChange={e => setSelectedExamBackupId(e.target.value)}
                    className="border border-purple-200 rounded-xl px-3 py-1.5 text-xs bg-white text-slate-900 font-medium shadow-2xs"
                  >
                    <option value="all">{t('allExams')}</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>

                {restoreBannerInfo && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{restoreBannerInfo}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => handleExamMarksBackup()} 
                    className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Download size={14} /> {language === 'bn' ? 'নম্বর এক্সপোর্ট' : 'Export Marks'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsExamRestoreModalOpen(true)} 
                    className="flex-1 py-2.5 px-3 bg-white hover:bg-purple-50 text-purple-700 font-bold text-xs rounded-xl border border-purple-300 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Upload size={14} /> {language === 'bn' ? 'নম্বর রিস্টোর হাব' : 'Restore Marks Hub'}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Enhanced Exam Restore Modal */}
      <ExamRestoreModal
        isOpen={isExamRestoreModalOpen}
        onClose={() => setIsExamRestoreModalOpen(false)}
        exams={exams}
        marks={marks}
        remarks={remarks}
        subjects={subjects}
        classes={classes}
        language={language}
        onRestoreSuccess={handleExamMarksRestoreSuccess}
        t={t}
      />

      {/* Delete Exam Confirmation Dialog */}
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
          ? 'আপনি কি নিশ্চিত যে এই পরীক্ষাটি ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং পরে রিস্টোর করা যাবে)' 
          : 'Are you sure you want to delete this exam? (It will be moved to the Trash Bin)'}
        highlightText={examToDelete ? `${examToDelete.name} ${examToDelete.nameBn ? `(${examToDelete.nameBn})` : ''}` : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!classToDelete}
        onClose={() => setClassToDelete(null)}
        onConfirm={() => {
          if (classToDelete) {
            deleteClass(classToDelete.id);
            setClassToDelete(null);
          }
        }}
        title={language === 'bn' ? 'শ্রেণি ডিলিট নিশ্চিতকরণ' : 'Confirm Class Deletion'}
        message={language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই শ্রেণিটি ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং পরে রিস্টোর করা যাবে)' 
          : 'Are you sure you want to delete this class? (It will be moved to the Trash Bin)'}
        highlightText={classToDelete ? `${classToDelete.name} ${classToDelete.nameBn ? `(${classToDelete.nameBn})` : ''}` : undefined}
        confirmLabel={language === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

      {/* Empty Trash Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmEmptyTrashOpen}
        onClose={() => setIsConfirmEmptyTrashOpen(false)}
        onConfirm={() => {
          emptyTrash();
          setIsConfirmEmptyTrashOpen(false);
        }}
        title={language === 'bn' ? 'রিসাইকেল বিন খালি করা' : 'Empty Recycle Bin'}
        message={language === 'bn' 
          ? 'সতর্কতা: রিসাইকেল বিন খালি করলে সকল ট্র্যাশ আইটেম চিরতরে মুছে যাবে এবং আর কখনো পুনরুদ্ধার করা সম্ভব হবে না। আপনি কি নিশ্চিত?' 
          : 'Warning: Emptying the trash bin will permanently erase all trashed items forever. This cannot be undone. Are you sure?'}
        confirmLabel={language === 'bn' ? 'স্থায়ীভাবে মুছুন' : 'Empty Trash'}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

    </div>
  );
};
