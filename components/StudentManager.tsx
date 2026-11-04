import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { TrashItem } from '../context/AppContext';
import { Student } from '../types';
import { formatNumber } from '../services/utils';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Filter, 
  LayoutGrid, 
  List, 
  Users, 
  UserMinus, 
  UserCheck, 
  UserX, 
  RotateCcw, 
  Info,
  Eye,
  ShieldAlert,
  GraduationCap,
  FileText,
  CreditCard,
  Printer,
  Download,
  Calendar,
  Layers,
  Award,
  Phone,
  UserPlus,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { validateStudent } from '../services/studentValidation';
import {
  FEE_DISCOUNT_TYPES,
  FEE_DISCOUNT_TYPE_LABELS,
  ETIM_FUND_SOURCE,
  classFeeBase,
  toFeeNumber,
  normalizeFeeArrangement,
  validateFeeArrangement,
} from '../services/studentFeeArrangement';
import type { FeeDiscountType } from '../types/student';
import { amountFor, isFeeTypeEnabled } from '../services/feeTypes';
import { RETRY_LABEL, STUDENTS_CLOUD_FAILURE_MESSAGE, STUDENT_DELETE_CLOUD_FAILURE_MESSAGE } from '../services/cloudConfirm';
import { recordStudentAuditEvent } from '../services/studentService';
import { StudentProfileModal } from './StudentProfileModal';
import { AccessRestrictedView } from './AccessRestrictedView';
import { ClassPromotionModal } from './ClassPromotionModal';
import { TransferCertificateModal, TcRecord } from './students/TransferCertificateModal';
import { AdmissionApplicationManager, AdmissionApplication } from './students/AdmissionApplicationManager';
import { ClassSectionMatrixView } from './students/ClassSectionMatrixView';
import { GuardianDirectoryView } from './students/GuardianDirectoryView';
import { EmptyState } from './ui/EmptyState';
import { PageHeader } from './ui/PageHeader';
import { useTheme } from '../context/ThemeContext';

export type StudentSubTab = 
  | 'list'          // ১. শিক্ষার্থী তালিকা
  | 'admission'     // ২. নতুন ভর্তি ফরম
  | 'applications'  // ৩. ভর্তি আবেদন ও ট্র্যাকার
  | 'classes'       // ৪. শ্রেণি ও শাখাভিত্তিক শিক্ষার্থী
  | 'guardians'     // ৫. অভিভাবকের তথ্য
  | 'promotion'     // ৬. শ্রেণি পরিবর্তন / প্রমোশন
  | 'tc'            // ৭. শিক্ষার্থী ছাড়পত্র / TC
  | 'former';       // ৮. সাবেক শিক্ষার্থী

interface StudentManagerProps {
  initialOpenPromotion?: boolean;
  initialSubTab?: StudentSubTab;
  onNavigateTab?: (tab: string) => void;
  /** Open the full staff profile tab for one student (from the compact profile modal). */
  onViewFullProfile?: (studentId: string) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({ 
  initialOpenPromotion = false,
  initialSubTab = 'list',
  onNavigateTab,
  onViewFullProfile
}) => {
  const { 
    students, 
    addStudent, 
    updateStudent, 
    deleteStudent, 
    confirmStudentsCloudSync,
    confirmStudentDeleteCloudSync,
    classes, 
    feeStructures,
    feeTypes,
    t, 
    language,
    authUser,
    authClaims,
    authContext,
    hasPermission,
    isSuperAdmin,
    setActiveTab: setNavTab
  } = useApp();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // RBAC Permission checks
  const isOwner = isSuperAdmin || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const canView = isOwner || hasPermission('students.view');
  const canCreate = isOwner || hasPermission('students.create');
  const canEdit = isOwner || hasPermission('students.edit');
  const canDelete = isOwner || hasPermission('students.delete');
  const canArchive = isOwner || hasPermission('students.archive') || canEdit;
  const canPromote = isOwner || canEdit;
  const canAdd = canCreate;

  // Class Promotion Modal state
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(initialOpenPromotion);

  // Step 2 Sub-Navigation Hub Tab
  const [subTab, setSubTab] = useState<StudentSubTab>(initialSubTab || 'list');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Transfer Certificate (TC) state
  const [isTcModalOpen, setIsTcModalOpen] = useState(false);
  const [tcStudent, setTcStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (initialOpenPromotion) {
      setIsPromotionModalOpen(true);
    }
  }, [initialOpenPromotion]);

  // Student Profile Drawer / Modal state
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  // Data Scope (Class-level restrictions)
  const allowedClasses = authContext?.dataScopes?.allClasses === false
    ? (authContext.dataScopes.classes || [])
    : null;

  const availableClasses = allowedClasses
    ? classes.filter(c => allowedClasses.includes(c.id) || allowedClasses.includes(c.name))
    : classes;

  // Tab: 'all' (all enrolled), 'active' (regular examinees), 'inactive' (on leave / no exam), 'former' (students who left)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'former'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'roll' | 'studentId' | 'name' | 'classLevel'>('roll');
  const [listView, setListView] = useState<'table' | 'cards'>(() => typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Truthful-save Step 2: a failed cloud confirmation keeps the local
  // save and stores the next-list here, so the banner's retry button
  // re-confirms exactly what was saved (no re-save, no stale list).
  const [pendingStudentSave, setPendingStudentSave] = useState<Student[] | null>(null);
  const [pendingStudentDelete, setPendingStudentDelete] = useState<{ students: Student[]; trashBin: TrashItem[] } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isStudentDeleting, setIsStudentDeleting] = useState(false);

  // Modals for moving to former, restoring, and deleting
  const [studentToMoveFormer, setStudentToMoveFormer] = useState<Student | null>(null);
  const [moveFormerReason, setMoveFormerReason] = useState('');
  const [moveFormerDate, setMoveFormerDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentToRestore, setStudentToRestore] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const [formData, setFormData] = useState<{
    studentId: string;
    roll: string;
    name: string;
    nameBn: string;
    gender: 'male' | 'female' | 'other' | '';
    dateOfBirth: string;
    bloodGroup: string;
    fatherName: string;
    fatherNameBn: string;
    motherName: string;
    motherNameBn: string;
    guardianName: string;
    guardianPhone: string;
    guardianEmail: string;
    address: string;
    classLevel: string;
    group: string;
    admissionDate: string;
    status: 'Active' | 'Inactive' | 'Former';
    isFormer: boolean;
    leavingDate: string;
    leavingReason: string;
    // Tuition fee arrangement (amounts kept as input strings; normalized to numbers on save)
    feeDiscountType: FeeDiscountType;
    feeBaseAmount: string;
    feeWaiverAmount: string;
    feeFundAmount: string;
    feeFundSource: string;
  }>({
    studentId: '',
    roll: '',
    name: '',
    nameBn: '',
    gender: 'male',
    dateOfBirth: '',
    bloodGroup: '',
    fatherName: '',
    fatherNameBn: '',
    motherName: '',
    motherNameBn: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    address: '',
    classLevel: '',
    group: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    isFormer: false,
    leavingDate: '',
    leavingReason: '',
    feeDiscountType: 'none',
    feeBaseAmount: '',
    feeWaiverAmount: '',
    feeFundAmount: '',
    feeFundSource: '',
  });

  // Tuition fee arrangement, derived live from the form: the institute-set
  // base comes from the fee structure for the selected class when one
  // exists (tuition + food only when the food type is enabled — the same
  // rule dues use); otherwise the manually entered base is used.
  const feeStructForClass = feeStructures.find(f => f.classLevel === formData.classLevel);
  const feeArrangementInput = {
    discountType: formData.feeDiscountType,
    baseAmount: feeStructForClass ? classFeeBase(feeStructForClass, feeTypes) : toFeeNumber(formData.feeBaseAmount),
    waiverAmount: toFeeNumber(formData.feeWaiverAmount),
    fundAmount: toFeeNumber(formData.feeFundAmount),
    fundSource: formData.feeFundSource,
  };
  const feeArrangement = normalizeFeeArrangement(feeArrangementInput);

  // Reusable validation engine
  const validateForm = () => {
    const valResult = validateStudent({
      name: formData.name,
      classLevel: formData.classLevel,
      studentId: formData.studentId,
      guardianPhone: formData.guardianPhone,
      guardianEmail: formData.guardianEmail,
      fatherName: formData.fatherName,
      motherName: formData.motherName,
      address: formData.address,
      status: formData.status
    }, { isNewRegistration: !editingId });

    if (!valResult.isValid) {
      const firstErr = Object.values(valResult.errors)[0];
      setError(firstErr);
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

    // Tuition fee arrangement: waiver + fund must stay within the base,
    // and a named fund source is required for the 'other fund' type.
    const feeError = validateFeeArrangement(feeArrangementInput);
    if (feeError) {
      setError(feeError);
      return false;
    }

    return true;
  };

  const handleSave = async (stayInModal: boolean = false) => {
    setError(null);
    setSuccess(false);
    setPendingStudentSave(null);

    if (!validateForm()) return;

    const name = formData.name.trim();
    const isFormer = formData.status === 'Former' || !!formData.isFormer;
    const finalStatus: 'Active' | 'Inactive' | 'Former' = isFormer 
      ? 'Former' 
      : formData.status === 'Inactive' 
      ? 'Inactive' 
      : 'Active';

    const cleanRoll = formData.roll?.trim() || '';
    const autoStudentId = formData.studentId?.trim() || `${new Date().getFullYear()}${cleanRoll ? cleanRoll.padStart(3, '0') : String(students.length + 1).padStart(3, '0')}`;

    const dataToSave = {
      ...formData,
      name: name,
      studentId: autoStudentId,
      roll: cleanRoll || undefined,
      rollNumber: cleanRoll || undefined,
      isFormer,
      status: finalStatus,
      // Tuition fee arrangement, normalized (payable = base - waiver - fund,
      // never negative). Stored as numbers, overriding the string inputs
      // above; rides along with the existing cloud-confirmed student save.
      feeDiscountType: feeArrangement.discountType,
      feeBaseAmount: feeArrangement.baseAmount,
      feeWaiverAmount: feeArrangement.waiverAmount,
      feeFundAmount: feeArrangement.fundAmount,
      feeFundSource: feeArrangement.fundSource || undefined,
      feePayableAmount: feeArrangement.payableAmount,
    };

    try {
      // Truthful save (Step 2): the local mutation runs first, then the
      // awaited cloud confirmation decides the feedback. On failure the
      // modal stays open with an honest error + retry — never a false
      // success, and the local record is never dropped.
      let nextStudents: Student[];
      if (editingId) {
        const res = updateStudent({ ...dataToSave, id: editingId });
        nextStudents = res.students;
        if (authUser) {
          recordStudentAuditEvent({
            action: 'STUDENT_UPDATED',
            student: { ...dataToSave, id: editingId } as Student,
            actor: {
              uid: authUser.uid,
              email: authUser.email || '',
              role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
            }
          });
        }
      } else {
        const res = addStudent(dataToSave);
        nextStudents = res.students;
        if (authUser) {
          recordStudentAuditEvent({
            action: 'STUDENT_CREATED',
            student: { ...dataToSave, id: 'new' } as Student,
            actor: {
              uid: authUser.uid,
              email: authUser.email || '',
              role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
            }
          });
        }
      }

      const confirmResult = await confirmStudentsCloudSync(nextStudents);
      if (!confirmResult.success) {
        setPendingStudentSave(nextStudents);
        setError(confirmResult.message || STUDENTS_CLOUD_FAILURE_MESSAGE);
        return;
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

  // Retry re-confirms the still-local student save (no re-save needed).
  // On success the modal closes — re-saving would duplicate the record.
  const retryStudentSave = async () => {
    if (!pendingStudentSave) return;
    const result = await confirmStudentsCloudSync(pendingStudentSave);
    if (result.success) {
      setPendingStudentSave(null);
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setIsModalOpen(false);
      resetForm();
    } else {
      setError(result.message || STUDENTS_CLOUD_FAILURE_MESSAGE);
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
      roll: student.roll || student.rollNumber || '',
      name: student.name || '',
      nameBn: student.nameBn || '',
      gender: (student.gender as any) || 'male',
      dateOfBirth: student.dateOfBirth || '',
      bloodGroup: student.bloodGroup || '',
      fatherName: student.fatherName || '',
      fatherNameBn: student.fatherNameBn || '',
      motherName: student.motherName || '',
      motherNameBn: student.motherNameBn || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      address: student.address || '',
      classLevel: student.classLevel || '',
      group: student.group || '',
      admissionDate: student.admissionDate || '',
      status: currentStatus,
      isFormer,
      leavingDate: student.leavingDate || '',
      leavingReason: student.leavingReason || '',
      feeDiscountType: student.feeDiscountType || 'none',
      feeBaseAmount: student.feeBaseAmount ? String(student.feeBaseAmount) : '',
      feeWaiverAmount: student.feeWaiverAmount ? String(student.feeWaiverAmount) : '',
      feeFundAmount: student.feeFundAmount ? String(student.feeFundAmount) : '',
      feeFundSource: student.feeFundSource || '',
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
      roll: '',
      name: '',
      nameBn: '',
      gender: 'male',
      dateOfBirth: '',
      bloodGroup: '',
      fatherName: '',
      fatherNameBn: '',
      motherName: '',
      motherNameBn: '',
      guardianName: '',
      guardianPhone: '',
      guardianEmail: '',
      address: '',
      classLevel: defaultClass,
      group: '',
      admissionDate: new Date().toISOString().split('T')[0],
      status: defaultStatus,
      isFormer: defaultStatus === 'Former',
      leavingDate: '',
      leavingReason: '',
      feeDiscountType: 'none',
      feeBaseAmount: '',
      feeWaiverAmount: '',
      feeFundAmount: '',
      feeFundSource: '',
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
    const leavingReason = moveFormerReason.trim() || (language === 'bn' ? 'মাদ্রাসা ত্যাগ' : 'Left Madrasha');
    const leavingDate = moveFormerDate || new Date().toISOString().split('T')[0];

    updateStudent({
      ...studentToMoveFormer,
      isFormer: true,
      status: 'Former',
      leavingReason,
      leavingDate,
    });

    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_ARCHIVED',
        student: { ...studentToMoveFormer, isFormer: true, status: 'Former', leavingReason, leavingDate },
        actor: {
          uid: authUser.uid,
          email: authUser.email || '',
          role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
        },
        before: { status: studentToMoveFormer.status, isFormer: studentToMoveFormer.isFormer }
      });
    }

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

    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_UPDATED',
        student: { ...studentToRestore, isFormer: false, status: 'Active' },
        actor: {
          uid: authUser.uid,
          email: authUser.email || '',
          role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
        },
        before: { status: studentToRestore.status, isFormer: studentToRestore.isFormer }
      });
    }

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

  const handleTcIssued = (st: Student, record: TcRecord) => {
    updateStudent({
      ...st,
      status: 'Former',
      isFormer: true,
      leavingDate: record.issueDate,
      leavingReason: `ছাড়পত্র নং: ${record.tcNumber} (${record.leavingReason})`
    });
    setIsTcModalOpen(false);
    setTcStudent(null);
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_ARCHIVED',
        student: { ...st, isFormer: true, status: 'Former', leavingReason: record.leavingReason, leavingDate: record.issueDate },
        actor: {
          uid: authUser.uid,
          email: authUser.email || '',
          role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
        }
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ['রোল', 'আইডি', 'শিক্ষার্থীর নাম', 'ইংরেজি নাম', 'শ্রেণি', 'পিতার নাম', 'মোবাইল', 'অবস্থা'];
    const rows = filteredStudents.map(s => [
      s.roll || s.rollNumber || '',
      s.studentId || '',
      `"${s.nameBn || s.name}"`,
      `"${s.name}"`,
      s.classLevel,
      `"${s.fatherNameBn || s.fatherName || ''}"`,
      s.guardianPhone || '',
      s.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `madrasah_students_${filterClass}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Apply Data Scope class restriction
  const scopedBaseList = allowedClasses
    ? baseList.filter(s => allowedClasses.includes(s.classLevel) || (s.classId && allowedClasses.includes(s.classId)))
    : baseList;

  const filteredStudents = scopedBaseList
    .filter(s => {
      const matchesClass = filterClass === 'All' || s.classLevel === filterClass;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return matchesClass;
      return matchesClass && (
        (s.name && s.name.toLowerCase().includes(term)) || 
        (s.nameBn && s.nameBn.includes(term)) ||
        (s.studentId && String(s.studentId).toLowerCase().includes(term)) ||
        (s.roll != null && String(s.roll).toLowerCase().includes(term)) ||
        (s.rollNumber != null && String(s.rollNumber).toLowerCase().includes(term)) ||
        (s.guardianPhone != null && String(s.guardianPhone).includes(term)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(term)) ||
        (s.fatherNameBn && s.fatherNameBn.includes(term))
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'roll') {
        const rollA = parseInt(a.roll || a.rollNumber || '0', 10) || 0;
        const rollB = parseInt(b.roll || b.rollNumber || '0', 10) || 0;
        comparison = rollA - rollB;
      } else if (sortBy === 'classLevel') {
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

  if (!canView) {
  return (
      <AccessRestrictedView
        moduleName={language === 'bn' ? 'শিক্ষার্থী ব্যবস্থাপনা' : 'Student Management'}
        onGoToResults={() => setNavTab && setNavTab('results')}
      />
    );
  }

  // Shared student card: mobile list rows + desktop grid tiles. Stateless by design.
  const StudentCard: React.FC<{ student: Student; variant: 'row' | 'tile' }> = ({ student, variant }) => {
    const displayName = language === 'bn' ? (student.nameBn || student.name) : student.name;
    const altName = language === 'bn' ? (student.nameBn ? student.name : undefined) : student.nameBn;
    return (
      <div
        className={variant === 'tile'
          ? `rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs p-4 transition-colors ${student.isFormer || student.status === 'Former' ? 'bg-slate-50/50' : 'bg-white dark:bg-slate-900'}`
          : `p-3.5 transition-colors ${student.isFormer || student.status === 'Former' ? 'bg-slate-50/50' : 'bg-white dark:bg-slate-900'}`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {student.photoUrl ? (
              <img 
                src={student.photoUrl} 
                alt={student.name} 
                className="w-11 h-11 rounded-full object-cover border border-gray-200 dark:border-slate-700 shadow-2xs shrink-0" 
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase shadow-2xs shrink-0">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{displayName}</span>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {student.studentId}
                </span>
              </div>
              {altName && altName !== displayName && (
                <div className="text-xs text-gray-500 dark:text-slate-400 font-bangla truncate">{altName}</div>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-slate-300 flex-wrap">
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-medium text-[11px]">
                  {language === 'bn' ? 'রোল:' : 'Roll:'} <strong className="font-mono">{formatNumber(student.roll, language)}</strong>
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-medium text-[11px]">
                  {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}
                </span>
                {student.group && (
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">
                    {t(student.group.toLowerCase() as any) || student.group}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
            student.isFormer || student.status === 'Former' 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600' 
              : student.status === 'Inactive' 
              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700' 
              : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}>
            {student.isFormer || student.status === 'Former' 
              ? (language === 'bn' ? 'প্রাক্তন' : 'Former') 
              : student.status === 'Inactive' 
              ? (language === 'bn' ? 'অনিয়মিত' : 'Inactive') 
              : (language === 'bn' ? 'সক্রিয়' : 'Active')}
          </span>
        </div>

        {/* Guardian / Contact info on mobile */}
        {(student.fatherName || student.fatherNameBn || student.guardianPhone) && (
          <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-600 dark:text-slate-300">
            <div className="truncate">
              <span className="text-gray-400 dark:text-slate-500 text-[11px] mr-1">{language === 'bn' ? 'পিতা:' : 'Father:'}</span>
              <span className="font-medium text-gray-800 dark:text-slate-100">{language === 'bn' ? (student.fatherNameBn || student.fatherName || '—') : (student.fatherName || '—')}</span>
            </div>
            {student.guardianPhone && (
              <a 
                href={`tel:${student.guardianPhone}`}
                className="text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-semibold flex items-center gap-1 hover:underline shrink-0 ml-2"
              >
                📞 {student.guardianPhone}
              </a>
            )}
          </div>
        )}

        {/* Mobile Actions Bar */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setProfileStudent(student)}
            className="px-2.5 py-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Eye size={13} />
            <span>{language === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setTcStudent(student); setIsTcModalOpen(true); }}
            className="px-2 py-1 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Award size={13} />
            <span>{language === 'bn' ? 'ছাড়পত্র' : 'TC'}</span>
          </button>

          {canArchive && (
            !student.isFormer && student.status !== 'Former' ? (
              <>
                <button 
                  type="button"
                  onClick={() => toggleActiveInactive(student)} 
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    student.status === 'Inactive'
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100'
                  }`}
                >
                  {student.status === 'Inactive' ? <UserCheck size={14} /> : <UserX size={14} />}
                </button>
                <button 
                  type="button"
                  onClick={() => promptMoveToFormer(student)} 
                  className="p-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <UserMinus size={14} />
                </button>
              </>
            ) : (
              <button 
                type="button"
                onClick={() => promptRestore(student)} 
                className="px-2 py-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>{language === 'bn' ? 'পুনর্বহাল' : 'Restore'}</span>
              </button>
            )
          )}

          {canEdit && (
            <button 
              type="button"
              onClick={() => handleEdit(student)} 
              className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <Edit2 size={14} />
            </button>
          )}

          {canDelete && (
            <button 
              type="button"
              onClick={() => setStudentToDelete(student)} 
              className="p-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Hub Header & Quick Actions */}
      <PageHeader
        icon={Users}
        title={language === 'bn' ? '২. শিক্ষার্থী ব্যবস্থাপনা' : '2. Student Management'}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <Button 
              onClick={openAddModal}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-2 shadow-xs"
            >
              <UserPlus size={16} />
              <span>{language === 'bn' ? 'নতুন ভর্তি' : 'New Admission'}</span>
            </Button>
          )}
          {canPromote && (
            <Button
              onClick={() => setIsPromotionModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-xs"
            >
              <GraduationCap size={16} />
              <span>{language === 'bn' ? 'শ্রেণি প্রমোশন' : 'Promotion'}</span>
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => onNavigateTab ? onNavigateTab('student_id_cards') : (setNavTab && setNavTab('student_id_cards'))}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <CreditCard size={15} />
            <span>{language === 'bn' ? 'আইডি কার্ড' : 'ID Cards'}</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => onNavigateTab ? onNavigateTab('student_reports') : (setNavTab && setNavTab('student_reports'))}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <FileText size={15} />
            <span>{language === 'bn' ? 'রিপোর্ট' : 'Reports'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* 2. Top KPI Summary Strip (Conforming to User Blueprint: মোট শিক্ষার্থী · শ্রেণি · সক্রিয় শিক্ষার্থী) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div 
          onClick={() => { setSubTab('list'); setActiveTab('all'); }}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-teal-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{language === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
            <Users size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 font-bangla">{formatNumber(allCurrentStudentsList.length, language)}</p>
        </div>

        <div 
          onClick={() => { setSubTab('list'); setActiveTab('active'); }}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-2xs bg-emerald-50/20 hover:border-emerald-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">{language === 'bn' ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</span>
            <UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 font-bangla">{formatNumber(activeStudentsList.length, language)}</p>
        </div>

        <div 
          onClick={() => { setSubTab('list'); setActiveTab('inactive'); }}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-2xs bg-amber-50/20 hover:border-amber-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">{language === 'bn' ? 'অনিয়মিত শিক্ষার্থী' : 'Inactive'}</span>
            <UserX size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1 font-bangla">{formatNumber(inactiveStudentsList.length, language)}</p>
        </div>

        <div 
          onClick={() => { setSubTab('former'); setActiveTab('former'); }}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs bg-slate-50/50 hover:border-slate-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">{language === 'bn' ? 'সাবেক শিক্ষার্থী' : 'Former Students'}</span>
            <UserMinus size={16} className="text-slate-600 dark:text-slate-300" />
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 font-bangla">{formatNumber(formerStudentsList.length, language)}</p>
        </div>

        <div 
          onClick={() => setSubTab('classes')}
          className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-2xs bg-indigo-50/20 hover:border-indigo-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">{language === 'bn' ? 'শ্রেণি / জামাত' : 'Classes'}</span>
            <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-900 dark:text-indigo-200 mt-1 font-bangla">{formatNumber(classes.length, language)}</p>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs matching Step 2 blueprint */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'list'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users size={15} />
          <span>{language === 'bn' ? 'তালিকা' : 'Directory'}</span>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('admission'); openAddModal(); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'admission'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserPlus size={15} />
          <span>{language === 'bn' ? 'নতুন ভর্তি' : 'New Admission'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('applications')}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'applications'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText size={15} />
          <span>{language === 'bn' ? 'আবেদন' : 'Applications'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('classes')}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'classes'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers size={15} />
          <span>{language === 'bn' ? 'শ্রেণিভিত্তিক' : 'Classes'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('guardians')}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'guardians'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Phone size={15} />
          <span>{language === 'bn' ? 'অভিভাবক' : 'Guardians'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsPromotionModalOpen(true)}
          className="flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
        >
          <GraduationCap size={15} />
          <span>{language === 'bn' ? 'প্রমোশন' : 'Promotion'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('tc')}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'tc'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award size={15} />
          <span>{language === 'bn' ? 'ছাড়পত্র' : 'TC'}</span>
        </button>

        <button
          type="button"
          onClick={() => { setSubTab('former'); setActiveTab('former'); }}
          className={`flex items-center gap-2 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'former'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserMinus size={15} />
          <span>{language === 'bn' ? 'সাবেক' : 'Former'}</span>
        </button>
      </div>

      {/* View switching for Sub-Tabs */}
      {subTab === 'applications' && (
        <AdmissionApplicationManager onEnrollStudent={() => setSubTab('list')} />
      )}

      {subTab === 'classes' && (
        <ClassSectionMatrixView 
          onSelectClass={(cls) => { setFilterClass(cls); setSubTab('list'); }} 
          onOpenPromotion={(cls) => { setFilterClass(cls); setIsPromotionModalOpen(true); }} 
        />
      )}

      {subTab === 'guardians' && (
        <GuardianDirectoryView />
      )}

      {subTab === 'tc' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Award className="text-teal-700 dark:text-teal-400" size={20} />
                  <span>{language === 'bn' ? 'শিক্ষার্থী ছাড়পত্র ও প্রশংসাপত্র (TC) প্রদান' : 'Issue Transfer Certificate'}</span>
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  {language === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন (নাম, রোল বা আইডি)' : 'Select Student'}
                </label>
                <select 
                  onChange={(e) => {
                    const found = students.find(s => s.id === e.target.value);
                    if (found) {
                      setTcStudent(found);
                      setIsTcModalOpen(true);
                    }
                  }}
                  defaultValue=""
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
                >
                  <option value="" disabled>{language === 'bn' ? '-- শিক্ষার্থী নির্বাচন করুন --' : '-- Select a Student --'}</option>
                  {allCurrentStudentsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nameBn || s.name} • শ্রেণি: {s.classLevel} • রোল: {s.roll || s.rollNumber || '—'} (আইডি: {s.studentId || s.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Button 
                  onClick={() => {
                    if (allCurrentStudentsList[0]) {
                      setTcStudent(allCurrentStudentsList[0]);
                      setIsTcModalOpen(true);
                    }
                  }}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Award size={16} />
                  <span>{language === 'bn' ? 'ছাড়পত্র উইজার্ড খুলুন' : 'Open TC Wizard'}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Former / TC Issued Students registry */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UserMinus size={17} className="text-slate-600 dark:text-slate-300" />
              <span>{language === 'bn' ? 'পূর্বে ছাড়পত্র প্রাপ্ত ও সাবেক শিক্ষার্থীর তালিকা' : 'Alumni & TC Records'}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">নাম</th>
                    <th className="py-2.5 px-3">আইডি ও শ্রেণি</th>
                    <th className="py-2.5 px-3">ত্যাগের কারণ / TC নং</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3 text-right">পুনরায় প্রিন্ট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {formerStudentsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">কোনো ছাড়পত্র রেকর্ড নেই</td>
                    </tr>
                  ) : (
                    formerStudentsList.slice(0, 10).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">{s.nameBn || s.name}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{s.classLevel} (আইডি: {s.studentId || '—'})</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200 font-medium">{s.leavingReason || 'মাদ্রাসা ত্যাগ'}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{s.leavingDate || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => { setTcStudent(s); setIsTcModalOpen(true); }}
                            className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-800 dark:text-teal-300 rounded-lg text-xs font-bold border border-teal-200 dark:border-teal-800 cursor-pointer"
                          >
                            প্রিন্ট TC
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(subTab === 'list' || subTab === 'former' || subTab === 'admission') && (
        <>
          {/* Tabs: All Enrolled vs Active vs Inactive vs Former Students */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-xl px-2 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 dark:text-slate-300 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Users size={17} />
          <span>{language === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'all' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
          }`}>
            {formatNumber(allCurrentStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'active'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 dark:text-slate-300 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserCheck size={17} />
          <span>{language === 'bn' ? 'সক্রিয় (নিয়মিত)' : 'Active'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
          }`}>
            {formatNumber(activeStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inactive')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inactive'
              ? 'border-amber-600 text-amber-800 dark:text-amber-300 bg-amber-50/60 rounded-t-lg'
              : 'border-transparent text-gray-600 dark:text-slate-300 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserX size={17} />
          <span>{language === 'bn' ? 'অনিয়মিত (পরীক্ষা ছাড়া)' : 'Inactive'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
          }`}>
            {formatNumber(inactiveStudentsList.length, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('former')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'former'
              ? 'border-slate-600 text-slate-800 dark:text-slate-100 bg-slate-100/70 rounded-t-lg'
              : 'border-transparent text-gray-600 dark:text-slate-300 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <UserMinus size={17} />
          <span>{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী' : 'Former Students'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
            activeTab === 'former' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
          }`}>
            {formatNumber(formerStudentsList.length, language)}
          </span>
        </button>
      </div>

      {/* Inactive Students Info Notice */}
      {activeTab === 'inactive' && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <Info size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{language === 'bn' ? 'অনিয়মিত শিক্ষার্থী সংক্রান্ত তথ্য:' : 'Inactive Student Information:'}</p>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{t('inactiveStudentsNotice')}</p>
          </div>
        </div>
      )}

      {/* Former Students Info Notice */}
      {activeTab === 'former' && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs sm:text-sm flex items-start gap-2.5">
          <Info size={18} className="text-slate-600 dark:text-slate-300 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {t('formerStudentInfoNotice')}
          </div>
        </div>
      )}

      {/* Search & Class Filter */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500" size={17} />
          <input
            type="text"
            placeholder={language === 'bn' ? 'নাম, আইডি, রোল, পিতা বা ফোন নম্বর দিয়ে খুঁজুন...' : 'Search by name, ID, roll, father, or phone...'}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-xs font-medium placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500" size={17} />
          <select
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-xs font-semibold"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="All">{t('allClasses')}</option>
            {availableClasses.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
        </div>

        {canPromote && filterClass !== 'All' && (
          <button
            type="button"
            onClick={() => setIsPromotionModalOpen(true)}
            className="shrink-0 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            title={language === 'bn' ? `${filterClass} এর সকল শিক্ষার্থীকে পরবর্তী শ্রেণিতে উত্তীর্ণ করুন` : `Promote ${filterClass} students`}
          >
            <GraduationCap size={15} />
            <span>{language === 'bn' ? `${filterClass} প্রমোশন` : `Promote ${filterClass}`}</span>
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-bold"
            title="Download CSV"
          >
            <Download size={14} />
            <span>{language === 'bn' ? 'CSV Export' : 'Export'}</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-bold"
            title="Print List"
          >
            <Printer size={14} />
            <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
          </Button>
          <div className="shrink-0">
            <SegmentedControl
              value={listView}
              onChange={(id) => setListView(id as 'table' | 'cards')}
              ariaLabel={language === 'bn' ? 'তালিকা ভিউ' : 'List view'}
              options={[
                { id: 'cards', label: language === 'bn' ? 'কার্ড' : 'Cards', icon: <LayoutGrid size={14} />, title: language === 'bn' ? 'কার্ড ভিউ' : 'Card view' },
                { id: 'table', label: language === 'bn' ? 'টেবিল' : 'Table', icon: <List size={14} />, title: language === 'bn' ? 'টেবিল ভিউ' : 'Table view' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Student List Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-800 overflow-hidden">
        {/* Desktop Table View */}
        <div className={listView === 'table' ? 'block overflow-x-auto' : 'hidden'}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">{t('sn')}</th>
                <th 
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('roll')}
                >
                  <div className="flex items-center gap-1">
                    <span>{language === 'bn' ? 'রোল' : 'Roll'}</span>
                    {sortBy === 'roll' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('studentId')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('studentId')}</span>
                    {sortBy === 'studentId' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('name')}</span>
                    {sortBy === 'name' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('classLevel')}
                >
                  <div className="flex items-center gap-1">
                    <span>{activeTab === 'former' ? (language === 'bn' ? 'শেষ শ্রেণী' : 'Last Class') : t('class')}</span>
                    {sortBy === 'classLevel' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th className="px-4 py-3.5">
                  {activeTab === 'former' ? t('leavingReason') : (language === 'bn' ? 'পিতা ও যোগাযোগ' : 'Father & Contact')}
                </th>
                <th className="px-4 py-3.5">{t('status')}</th>
                <th className="px-4 py-3.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <EmptyState
                      icon={Users}
                      title={activeTab === 'former' ? t('noFormerStudents') : activeTab === 'inactive' ? (language === 'bn' ? 'কোনো অনিয়মিত শিক্ষার্থী নেই' : 'No inactive students found') : (language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found')}
                      actionLabel={canAdd ? (language === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি' : 'New Admission') : undefined}
                      onAction={canAdd ? () => setSubTab('admission') : undefined}
                      actionIcon={UserPlus}
                    />
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 font-medium text-center">{formatNumber(idx + 1, language)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                      {(student.roll || student.rollNumber) ? formatNumber(student.roll || student.rollNumber, language) : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-300">
                      {student.studentId ? formatNumber(student.studentId, language) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center text-xs border border-indigo-200/60 shrink-0">
                          {(student.name || 'S')[0].toUpperCase()}
                        </div>
                        <div className="truncate max-w-[170px]">
                          <div className="font-bold text-gray-900 dark:text-white truncate font-bangla">{language === 'bn' ? (student.nameBn || student.name) : student.name}</div>
                          {language !== 'bn' && student.nameBn && <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate font-bangla">{student.nameBn}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap font-medium">
                      <span>{language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span>
                      {student.group && <span className="ml-1 text-[9px] bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-1.5 py-0.5 rounded font-bold uppercase">{t(student.group.toLowerCase() as any) || student.group}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 truncate max-w-[180px]">
                      {activeTab === 'former' ? (
                        <div>
                          <div className="text-gray-900 dark:text-white text-xs font-medium">{student.leavingReason || (language === 'bn' ? 'মাদ্রাসা ত্যাগ' : 'Left')}</div>
                          {student.leavingDate && (
                            <div className="text-[11px] text-gray-400 dark:text-slate-500">{student.leavingDate}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-gray-800 dark:text-slate-100 truncate font-bangla">
                            {language === 'bn' ? (student.fatherNameBn || student.fatherName || '—') : (student.fatherName || '—')}
                          </div>
                          {student.guardianPhone && (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                              📞 {student.guardianPhone}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        student.isFormer || student.status === 'Former' 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600' 
                          : student.status === 'Inactive' 
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700' 
                          : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {student.isFormer || student.status === 'Former' 
                          ? (language === 'bn' ? 'প্রাক্তন' : 'Former') 
                          : student.status === 'Inactive' 
                          ? (language === 'bn' ? 'অনিয়মিত' : 'Inactive') 
                          : (language === 'bn' ? 'সক্রিয়' : 'Active')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {/* Profile View */}
                        <button
                          type="button"
                          onClick={() => setProfileStudent(student)}
                          title={language === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Issue Transfer Certificate (TC) */}
                        <button
                          type="button"
                          onClick={() => { setTcStudent(student); setIsTcModalOpen(true); }}
                          title={language === 'bn' ? 'ছাড়পত্র / TC তৈরি করুন' : 'Issue Transfer Certificate'}
                          className="p-1.5 text-teal-700 dark:text-teal-400 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Award size={15} />
                        </button>

                        {canArchive && (
                          activeTab !== 'former' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleActiveInactive(student)}
                                title={student.status === 'Inactive' 
                                  ? (language === 'bn' ? 'সক্রিয় করুন' : 'Make Active')
                                  : (language === 'bn' ? 'অনিয়মিত করুন' : 'Make Inactive')}
                                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                  student.status === 'Inactive'
                                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
                                    : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50'
                                }`}
                              >
                                {student.status === 'Inactive' ? <UserCheck size={15} /> : <UserX size={15} />}
                              </button>
                              <button 
                                type="button"
                                onClick={() => promptMoveToFormer(student)} 
                                title={t('moveToFormer')}
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              >
                                <UserMinus size={15} />
                              </button>
                            </>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => promptRestore(student)} 
                              title={t('restoreStudent')}
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )
                        )}

                        {canEdit && (
                          <button 
                            type="button"
                            onClick={() => handleEdit(student)} 
                            title={t('editStudent' as any) || 'Edit'}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}

                        {canDelete && (
                          <button 
                            type="button"
                            onClick={() => setStudentToDelete(student)} 
                            title="Delete"
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Card Grid View */}
        <div className={listView === 'cards' ? 'hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4' : 'hidden'}>
          {filteredStudents.length === 0 ? (
            <div className="col-span-full p-4">
              <EmptyState
                icon={Users}
                title={activeTab === 'former' ? t('noFormerStudents') : activeTab === 'inactive' ? (language === 'bn' ? 'কোনো অনিয়মিত শিক্ষার্থী নেই' : 'No inactive students found') : (language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found')}
                actionLabel={canAdd ? (language === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি' : 'New Admission') : undefined}
                onAction={canAdd ? () => setSubTab('admission') : undefined}
                actionIcon={UserPlus}
              />
            </div>
          ) : (
            filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} variant="tile" />
            ))
          )}
        </div>

        {/* Mobile Cards View (< md) */}
        <div className={listView === 'cards' ? 'md:hidden divide-y divide-gray-100 dark:divide-slate-800' : 'hidden'}>
          {filteredStudents.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Users}
                title={activeTab === 'former' ? t('noFormerStudents') : activeTab === 'inactive' ? (language === 'bn' ? 'কোনো অনিয়মিত শিক্ষার্থী নেই' : 'No inactive students found') : (language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found')}
                actionLabel={canAdd ? (language === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি' : 'New Admission') : undefined}
                onAction={canAdd ? () => setSubTab('admission') : undefined}
                actionIcon={UserPlus}
              />
            </div>
          ) : (
            filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} variant="row" />
            ))
          )}
        </div>
      </div>
      </>
      )}

      {/* Move to Former Modal */}
      {studentToMoveFormer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-amber-50/70">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <UserMinus className="text-amber-600 dark:text-amber-400" size={20} />
                <h3 className="font-bold text-base sm:text-lg">{t('moveToFormer')}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setStudentToMoveFormer(null)} 
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/60 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {t('confirmMoveToFormer')}
              </div>

              <div className="text-sm bg-gray-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-1 border border-gray-200/60">
                <div className="font-bold text-gray-900 dark:text-white font-bangla">{language === 'bn' ? (studentToMoveFormer.nameBn || studentToMoveFormer.name) : studentToMoveFormer.name}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                  {t('studentId')}: {studentToMoveFormer.studentId || '-'} &bull; {t('class')}: {studentToMoveFormer.classLevel}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('leavingReason')}</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  placeholder={language === 'bn' ? 'যেমন: মাদ্রাসা ত্যাগ / ছাড়পত্র গ্রহণ / স্থানান্তর' : 'e.g. Madrasha transfer / TC / Completed'}
                  value={moveFormerReason}
                  onChange={(e) => setMoveFormerReason(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('leavingDate')}</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/70">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <RotateCcw className="text-emerald-600 dark:text-emerald-400" size={20} />
                <h3 className="font-bold text-base sm:text-lg">{t('restoreStudent')}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setStudentToRestore(null)} 
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm bg-gray-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-1 border border-gray-200/60">
                <div className="font-bold text-gray-900 dark:text-white font-bangla">{language === 'bn' ? (studentToRestore.nameBn || studentToRestore.name) : studentToRestore.name}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                  {t('studentId')}: {studentToRestore.studentId || '-'} &bull; {t('class')}: {studentToRestore.classLevel}
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white rounded-t-3xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold">
                  {editingId ? (language === 'bn' ? 'শিক্ষার্থীর তথ্য সম্পাদনা' : 'Edit Student Profile') : (language === 'bn' ? 'নতুন শিক্ষার্থী ভর্তি ও নিবন্ধন' : 'New Student Registration')}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 dark:text-slate-500 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-slate-800"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>
              {error && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>{error}</span>
                  {pendingStudentSave && (
                    <button type="button" onClick={retryStudentSave} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold">{RETRY_LABEL}</button>
                  )}
                </div>
              )}
              {success && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold">
                  {t('savedSuccessfully' as any) || 'Saved successfully!'}
                </div>
              )}

              {/* 1. Academic Information Section */}
              <div className="space-y-3">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b pb-1.5">
                  <span>🎓 একাডেমিক ও ভর্তি সংক্রান্ত তথ্য (Academic Info)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('class')} <span className="text-red-500">*</span></label>
                    <select 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.classLevel || ''} 
                      onChange={e => setFormData({ ...formData, classLevel: e.target.value })}
                    >
                      <option value="">ক্লাস নির্বাচন করুন</option>
                      {availableClasses.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'রোল নম্বর' : 'Roll Number'} <span className="text-indigo-600 dark:text-indigo-400 font-normal">(ঐচ্ছিক)</span></label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono" 
                      value={formData.roll || ''} 
                      onChange={e => setFormData({...formData, roll: e.target.value})} 
                      placeholder="e.g. 101"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('studentId')} <span className="text-gray-400 dark:text-slate-500 font-normal">(অটো জেনারেট)</span></label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono" 
                      value={formData.studentId || ''} 
                      onChange={e => setFormData({...formData, studentId: e.target.value})} 
                      placeholder={`e.g. ${new Date().getFullYear()}001`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ভর্তির তারিখ' : 'Admission Date'}</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.admissionDate || ''} 
                      onChange={e => setFormData({...formData, admissionDate: e.target.value})} 
                    />
                  </div>

                  {(formData.classLevel === 'Class 9' || formData.classLevel === 'Class 10') && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('group')}</label>
                      <select 
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                        value={formData.group || ''} 
                        onChange={e => setFormData({...formData, group: e.target.value as any})}
                      >
                        <option value="">গ্রুপ নির্বাচন করুন</option>
                        <option value="General">{t('general') || 'General'}</option>
                        <option value="Science">{t('science')}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Tuition Fee Arrangement Section */}
              <div className="space-y-3 pt-2">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b pb-1.5">
                  <span>💰 টিউশন ফি ব্যবস্থা (Tuition Fee)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'প্রতিষ্ঠান নির্ধারিত মাসিক ফি (৳)' : 'Institute Monthly Fee (৳)'}</label>
                    {feeStructForClass ? (
                      <div className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                        ৳{feeArrangement.baseAmount.toLocaleString()}
                        {(() => {
                          const tuition = amountFor(feeStructForClass, 'tuition');
                          const foodOn = isFeeTypeEnabled(feeTypes, 'food');
                          const food = foodOn ? amountFor(feeStructForClass, 'food') : 0;
                          if (tuition <= 0 && food <= 0) return null;
                          const parts = [`${language === 'bn' ? 'টিউশন' : 'Tuition'} ৳${tuition.toLocaleString()}`];
                          if (food > 0) parts.push(`${language === 'bn' ? 'বোর্ডিং' : 'Boarding'} ৳${food.toLocaleString()}`);
                          return (
                            <span className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {parts.join(' + ')}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        value={formData.feeBaseAmount || ''}
                        onChange={e => setFormData({ ...formData, feeBaseAmount: e.target.value })}
                        placeholder={language === 'bn' ? 'যেমন: ৫০০' : 'e.g. 500'}
                      />
                    )}
                    {!feeStructForClass && (
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">{language === 'bn' ? 'এই শ্রেণির জন্য ফি স্ট্রাকচার সেট করা নেই — মাসিক ফি লিখুন।' : 'No fee structure set for this class — enter the monthly fee.'}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ছাড়ের ধরন' : 'Discount Type'}</label>
                    <select
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                      value={formData.feeDiscountType || 'none'}
                      onChange={e => setFormData({ ...formData, feeDiscountType: e.target.value as FeeDiscountType })}
                    >
                      {FEE_DISCOUNT_TYPES.map(dt => (
                        <option key={dt} value={dt}>{FEE_DISCOUNT_TYPE_LABELS[dt]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.feeDiscountType === 'partial' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ওয়েভারের পরিমাণ (৳)' : 'Waiver Amount (৳)'} <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        value={formData.feeWaiverAmount || ''}
                        onChange={e => setFormData({ ...formData, feeWaiverAmount: e.target.value })}
                        placeholder={language === 'bn' ? 'যেমন: ২০০' : 'e.g. 200'}
                      />
                    </div>
                  </div>
                )}

                {(formData.feeDiscountType === 'etim' || formData.feeDiscountType === 'other') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ফান্ড থেকে দেওয়া হবে (৳)' : 'Fund Contribution (৳)'} <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                        value={formData.feeFundAmount || ''}
                        onChange={e => setFormData({ ...formData, feeFundAmount: e.target.value })}
                        placeholder={language === 'bn' ? 'যেমন: ৩০০' : 'e.g. 300'}
                      />
                    </div>
                    {formData.feeDiscountType === 'etim' ? (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ফান্ডের উৎস' : 'Fund Source'}</label>
                        <div className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">{ETIM_FUND_SOURCE}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'ফান্ডের নাম/উৎস' : 'Fund Name / Source'} <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bangla"
                          value={formData.feeFundSource || ''}
                          onChange={e => setFormData({ ...formData, feeFundSource: e.target.value })}
                          placeholder={language === 'bn' ? 'যেমন: যাকাত ফান্ড' : 'e.g. Zakat Fund'}
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.feeDiscountType === 'full' && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
                    {language === 'bn' ? 'সম্পূর্ণ ফি মওকুফ — শিক্ষার্থীকে মাসিক ফি দিতে হবে না।' : 'Full waiver — the student pays no monthly fee.'}
                  </p>
                )}

                {/* Live split: base = waiver/fund + student payable */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-slate-200">
                    <span>{language === 'bn' ? 'প্রতিষ্ঠান ফি' : 'Institute Fee'}</span>
                    <span className="font-mono">৳{feeArrangement.baseAmount.toLocaleString()}</span>
                  </div>
                  {feeArrangement.waiverAmount > 0 && (
                    <div className="flex justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <span>{language === 'bn' ? 'ছাড় (ওয়েভার)' : 'Waiver'}</span>
                      <span className="font-mono">− ৳{feeArrangement.waiverAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {feeArrangement.fundAmount > 0 && (
                    <div className="flex justify-between text-xs font-semibold text-teal-700 dark:text-teal-400">
                      <span>{feeArrangement.fundSource || (language === 'bn' ? 'ফান্ড থেকে' : 'From Fund')}</span>
                      <span className="font-mono">− ৳{feeArrangement.fundAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white">{language === 'bn' ? 'শিক্ষার্থী দেবে (মাসিক)' : 'Student Pays (Monthly)'}</span>
                    <span className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">৳{feeArrangement.payableAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 2. Personal Information Section */}
              <div className="space-y-3 pt-2">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b pb-1.5">
                  <span>👤 শিক্ষার্থীর ব্যক্তিগত তথ্য (Personal Profile)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('name')} (English) <span className="text-red-500">*</span></label>
                    <input 
                      ref={nameInputRef}
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      placeholder="e.g. Abdullah Al Mamun"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('name')} (বাংলায়)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bangla" 
                      value={formData.nameBn || ''} 
                      onChange={e => setFormData({...formData, nameBn: e.target.value})} 
                      placeholder="যেমন: আব্দুল্লাহ আল মামুন"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'লিঙ্গ' : 'Gender'}</label>
                    <select 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.gender || 'male'} 
                      onChange={e => setFormData({...formData, gender: e.target.value as any})}
                    >
                      <option value="male">{language === 'bn' ? 'ছাত্র (Male)' : 'Male'}</option>
                      <option value="female">{language === 'bn' ? 'ছাত্রী (Female)' : 'Female'}</option>
                      <option value="other">{language === 'bn' ? 'অন্যান্য (Other)' : 'Other'}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'জন্ম তারিখ' : 'Date of Birth'}</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.dateOfBirth || ''} 
                      onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}</label>
                    <select 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono" 
                      value={formData.bloodGroup || ''} 
                      onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
                    >
                      <option value="">নির্বাচন করুন</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. Guardian & Contact Section */}
              <div className="space-y-3 pt-2">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b pb-1.5">
                  <span>👨‍👩‍👧 অভিভাবক ও যোগাযোগের ঠিকানা (Guardian & Contact)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('fatherName')} (English)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.fatherName || ''} 
                      onChange={e => setFormData({...formData, fatherName: e.target.value})} 
                      placeholder="Father's name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('fatherName')} (বাংলায়)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bangla" 
                      value={formData.fatherNameBn || ''} 
                      onChange={e => setFormData({...formData, fatherNameBn: e.target.value})} 
                      placeholder="পিতার নাম"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('motherName')} (English)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.motherName || ''} 
                      onChange={e => setFormData({...formData, motherName: e.target.value})} 
                      placeholder="Mother's name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{t('motherName')} (বাংলায়)</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bangla" 
                      value={formData.motherNameBn || ''} 
                      onChange={e => setFormData({...formData, motherNameBn: e.target.value})} 
                      placeholder="মাতার নাম"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'অভিভাবকের মোবাইল নম্বর' : 'Guardian Mobile Phone'}</label>
                    <input 
                      type="tel" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono" 
                      value={formData.guardianPhone || ''} 
                      onChange={e => setFormData({...formData, guardianPhone: e.target.value})} 
                      placeholder="017XXXXXXXX"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-200">{language === 'bn' ? 'গ্রাম / ঠিকানা' : 'Address / Village'}</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                      value={formData.address || ''} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                      placeholder={language === 'bn' ? 'গ্রাম, ডাকঘর, উপজেলা, জেলা' : 'Village, Post, Upazila, District'}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Status Section */}
              <div className="space-y-3 pt-2">
                <div className="text-xs uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b pb-1.5">
                  <span>⚙️ বর্তমান স্ট্যাটাস (Student Lifecycle Status)</span>
                </div>
                <div className="space-y-1">
                  <select 
                    className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
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
                    <option value="Active">{language === 'bn' ? 'Active (সক্রিয় / নিয়মিত - পরীক্ষায় অংশগ্রহণ করবে)' : 'Active (Regular)'}</option>
                    <option value="Inactive">{language === 'bn' ? 'Inactive (অনিয়মিত / সাময়িক বিরতি - পরীক্ষা ছাড়া)' : 'Inactive (No Exam)'}</option>
                    <option value="Former">{language === 'bn' ? 'Former (প্রাক্তন / চলে গেছে)' : 'Former (Left)'}</option>
                  </select>
                </div>
              </div>

              {(formData.status === 'Former' || formData.isFormer) && (
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <UserMinus size={15} className="text-amber-600 dark:text-amber-400" />
                    <span>{language === 'bn' ? 'প্রাক্তন শিক্ষার্থী সংক্রান্ত তথ্য' : 'Former Student Information'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('leavingReason')}</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                        value={formData.leavingReason || ''} 
                        onChange={e => setFormData({...formData, leavingReason: e.target.value})} 
                        placeholder={language === 'bn' ? 'মাদ্রাসা ত্যাগ / ছাড়পত্র গ্রহণ / স্থানান্তর' : 'Reason for leaving'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('leavingDate')}</label>
                      <input 
                        type="date" 
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-2 text-xs focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" 
                        value={formData.leavingDate || ''} 
                        onChange={e => setFormData({...formData, leavingDate: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky action footer inside student modal - Save button always visible */}
              <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 -mx-6 -mb-6 p-4 rounded-b-3xl flex flex-wrap items-center justify-end gap-2.5 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
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
        onClose={() => { setStudentToDelete(null); setDeleteError(null); setPendingStudentDelete(null); }}
        onConfirm={async () => {
          if (!studentToDelete) return;
          // Truthful delete (Step 2): the local delete runs once, then
          // the awaited cloud confirmation decides. On failure the
          // dialog stays open showing the honest error, and the confirm
          // button becomes a retry for the already-local delete.
          setIsStudentDeleting(true);
          try {
            const pending = pendingStudentDelete ?? (() => {
              const res = deleteStudent(studentToDelete.id);
              if (!res) { setStudentToDelete(null); return null; }
              setPendingStudentDelete(res);
              return res;
            })();
            if (!pending) return;
            const result = await confirmStudentDeleteCloudSync(pending.students, pending.trashBin);
            if (result.success) {
              setPendingStudentDelete(null);
              setDeleteError(null);
              setStudentToDelete(null);
            } else {
              setDeleteError(result.message || STUDENT_DELETE_CLOUD_FAILURE_MESSAGE);
            }
          } finally {
            setIsStudentDeleting(false);
          }
        }}
        title={language === 'bn' ? 'শিক্ষার্থী ডিলিট নিশ্চিতকরণ' : 'Confirm Student Deletion'}
        message={deleteError || (language === 'bn' 
          ? 'আপনি কি নিশ্চিত যে এই শিক্ষার্থীর সকল তথ্য ও রেকর্ড ডিলিট করতে চান? (এটি ট্র্যাশ বিনে জমা হবে এবং পরে প্রয়োজনে রিস্টোর করা যাবে)' 
          : 'Are you sure you want to delete this student record? (It will be moved to the Trash Bin)')}
        confirmLabel={deleteError ? RETRY_LABEL : undefined}
        isLoading={isStudentDeleting}
        highlightText={studentToDelete ? `${language === 'bn' ? (studentToDelete.nameBn || studentToDelete.name) : studentToDelete.name} • ${studentToDelete.classLevel} ${studentToDelete.studentId ? `(${studentToDelete.studentId})` : ''}` : undefined}
        cancelLabel={language === 'bn' ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

      {/* Student Profile Detail Modal */}
      <StudentProfileModal
        isOpen={!!profileStudent}
        student={profileStudent}
        onClose={() => setProfileStudent(null)}
        language={language}
        onViewFullProfile={onViewFullProfile}
        feeBase={profileStudent ? (() => {
          const struct = feeStructures.find(f => f.classLevel === profileStudent.classLevel);
          return struct ? classFeeBase(struct, feeTypes) : undefined;
        })() : undefined}
      />

      {/* Class Promotion Modal */}
      <ClassPromotionModal
        isOpen={isPromotionModalOpen}
        onClose={() => setIsPromotionModalOpen(false)}
        initialClass={filterClass !== 'All' ? filterClass : undefined}
      />

      {/* Transfer Certificate (TC) Generator Modal */}
      <TransferCertificateModal
        isOpen={isTcModalOpen}
        student={tcStudent}
        onClose={() => {
          setIsTcModalOpen(false);
          setTcStudent(null);
        }}
        onTcIssued={handleTcIssued}
      />
    </div>
  );
};
