import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { 
  SchoolProfile, 
  Student, 
  Subject, 
  Exam, 
  MarkRecord, 
  RemarkRecord, 
  SchoolClass, 
  FinanceTransaction, 
  ClassFeeStructure,
  Institution,
  InstitutionType,
  ModuleKey,
  TermKey,
  AcademicYear,
  Section,
  PromotionHistoryRecord,
  NoticeItem,
  AppUser,
  UserRole
} from '../types';
import { recordPromotionAuditEvent } from '../services/promotionService';
import type { 
  CustomRole, 
  InstitutionMember, 
  Permission, 
  AuthorizationContext 
} from '../types/rbac';
import { 
  isVerifiedSuperAdmin, 
  checkPermission, 
  buildAuthorizationContext 
} from '../services/authorization';
import { 
  getInstitutionRoles, 
  initializeInstitutionDefaultRoles, 
  getInstitutionMember,
  getAllInstitutionMembers,
  setInstitutionMember,
  deleteInstitutionMember
} from '../services/rbac';
import { generateId } from '../services/utils';
import { translations, Language } from '../services/translations';
import { generateSampleMadrashaData, generateSampleFinanceData, defaultFeeStructures } from '../services/sampleData';
import { db, auth, googleProvider, setCachedGoogleAccessToken, clearCachedGoogleAccessToken, getCachedGoogleAccessToken } from '../services/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  getDefaultInstitutionConfig, 
  isModuleEnabled as checkModuleEnabled, 
  getTerm as resolveTerm 
} from '../services/institutionConfigEngine';
import { 
  buildCreateStudentPayload, 
  buildUpdateStudentPayload, 
  recordStudentAuditEvent 
} from '../services/studentService';
import {
  buildCreateAcademicYearPayload,
  buildUpdateAcademicYearPayload,
  setCurrentAcademicYear,
  closeAcademicYear,
  recordAcademicYearAuditEvent
} from '../services/academicYearService';
import {
  buildCreateClassPayload,
  buildUpdateClassPayload,
  buildArchiveClassPayload,
  recordClassAuditEvent
} from '../services/classService';
import {
  buildCreateSectionPayload,
  buildUpdateSectionPayload,
  buildArchiveSectionPayload,
  recordSectionAuditEvent
} from '../services/sectionService';
import {
  buildCreateSubjectPayload,
  buildUpdateSubjectPayload,
  buildArchiveSubjectPayload,
  buildCreateTeacherPayload,
  buildUpdateTeacherPayload,
  buildArchiveTeacherPayload,
  buildCreateClassSubjectPayload,
  buildCreateTeacherSubjectPayload,
  buildCreateClassTeacherPayload,
  recordSubjectAuditEvent,
  recordClassSubjectAuditEvent,
  recordTeacherSubjectAuditEvent,
  recordTeacherAuditEvent
} from '../services/academicCoreService';
import {
  buildCreateExamPayload,
  buildUpdateExamPayload,
  buildArchiveExamPayload,
  buildFinalizeExamPayload,
  buildCreateExamSubjectPayload,
  buildArchiveExamSubjectPayload,
  buildUpsertMarkPayload,
  recordExamAuditEvent,
  recordExamSubjectAuditEvent,
  recordMarksAuditEvent
} from '../services/examService';
import {
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  ExamSubjectAssignment
} from '../types';
import {
  resurrectDataIfEmpty,
  saveToIndexedDbVault,
  requestPersistentStorage,
  readCurrentLocalStoragePayload
} from '../services/multiStorePersistence';
import {
  uploadBackupToGoogleDrive,
  getGoogleDriveBackupSettings
} from '../services/googleDriveBackupService';

export interface TrashItem {
  id: string;
  type: 'student' | 'subject' | 'exam' | 'class' | 'transaction' | 'section' | 'academic_year' | 'teacher';
  data: any;
  deletedAt: string;
}

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';
export type AppMode = 'admin' | 'viewer';

interface AppState {
  institutionConfig: Institution;
  institutionType: InstitutionType;
  schoolProfile: SchoolProfile;
  academicYears: AcademicYear[];
  sections: Section[];
  students: Student[];
  subjects: Subject[];
  teachers: AcademicTeacher[];
  classSubjectAssignments: ClassSubjectAssignment[];
  teacherSubjectAssignments: TeacherSubjectAssignment[];
  classTeacherAssignments: ClassTeacherAssignment[];
  exams: Exam[];
  examSubjectAssignments: ExamSubjectAssignment[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  classes: SchoolClass[];
  transactions: FinanceTransaction[];
  feeStructures: ClassFeeStructure[];
  promotionHistory: PromotionHistoryRecord[];
  notices: NoticeItem[];
  language: Language;
  trashBin: TrashItem[];
  cloudStatus: CloudSyncStatus;
  cloudLastSynced: string;
  mode: AppMode;
  isAdmin: boolean;
  authUser: User | null;
  authClaims: Record<string, any> | null;
  authRole: string | null;
  adminEmail: string;
  users: AppUser[];
  isAuthReady: boolean;
  activeTab: string;
}

interface AppContextType extends AppState {
  isAuthReady: boolean;
  activeTab: string;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  currentUser: AppUser | null;
  userRole: UserRole | null;
  signUpUser: (data: {
    name: string;
    nameBn?: string;
    phone: string;
    email?: string;
    password?: string;
    role: UserRole;
    designation?: string;
    assignedClasses?: string[];
    studentId?: string;
    studentClass?: string;
  }) => Promise<{ success: boolean; message: string; user?: AppUser }>;
  updateAppUser: (user: AppUser) => Promise<{ success: boolean; message?: string }>;
  deleteAppUser: (userId: string) => Promise<{ success: boolean; message?: string }>;
  loginWithEmailOrPhone: (identifier: string, password: string) => Promise<{ success: boolean; message?: string; user?: AppUser }>;
  logoutUser: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  isModuleEnabled: (module: ModuleKey) => boolean;
  getTerm: (term: TermKey) => string;
  setInstitutionType: (type: InstitutionType) => void;
  updateInstitutionConfig: (config: Partial<Institution>) => void;
  updateSchoolProfile: (profile: SchoolProfile) => void;
  addAcademicYear: (data: Omit<AcademicYear, 'id'>) => void;
  updateAcademicYear: (year: AcademicYear) => void;
  setActiveAcademicYear: (id: string) => void;
  closeAcademicYear: (id: string) => void;
  setAcademicYears: (years: AcademicYear[]) => void;
  addSection: (data: Omit<Section, 'id'>) => void;
  updateSection: (section: Section) => void;
  archiveSection: (id: string) => void;
  deleteSection: (id: string) => void;
  setSections: (sections: Section[]) => void;
  archiveClass: (id: string) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (student: Student) => void;
  deleteStudent: (id: string) => void;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  updateSubject: (subject: Subject) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  addTeacher: (teacher: Omit<AcademicTeacher, 'id'>) => void;
  updateTeacher: (teacher: AcademicTeacher) => void;
  archiveTeacher: (id: string) => void;
  setTeachers: (teachers: AcademicTeacher[]) => void;
  assignSubjectToClass: (assignment: Omit<ClassSubjectAssignment, 'id'>) => void;
  updateClassSubjectAssignment: (assignment: ClassSubjectAssignment) => void;
  archiveClassSubjectAssignment: (id: string) => void;
  setClassSubjectAssignments: (assignments: ClassSubjectAssignment[]) => void;
  assignTeacherToSubject: (assignment: Omit<TeacherSubjectAssignment, 'id'>) => void;
  updateTeacherSubjectAssignment: (assignment: TeacherSubjectAssignment) => void;
  archiveTeacherSubjectAssignment: (id: string) => void;
  setTeacherSubjectAssignments: (assignments: TeacherSubjectAssignment[]) => void;
  assignClassTeacher: (assignment: Omit<ClassTeacherAssignment, 'id'>) => void;
  archiveClassTeacherAssignment: (id: string) => void;
  setClassTeacherAssignments: (assignments: ClassTeacherAssignment[]) => void;
  updateMark: (mark: Omit<MarkRecord, 'id'> & { id?: string }) => void;
  bulkUpdateMarks: (newMarks: (Omit<MarkRecord, 'id'> & { id?: string })[]) => void;
  addExam: (name: string, category: Exam['category'], nameBn?: string, details?: Partial<Exam>) => void;
  updateExam: (exam: Exam) => void;
  archiveExam: (id: string) => void;
  finalizeExam: (id: string) => void;
  deleteExam: (id: string) => void;
  scheduleExamSubject: (assignment: Omit<ExamSubjectAssignment, 'id'>) => void;
  archiveExamSubject: (id: string) => void;
  setExamSubjectAssignments: (assignments: ExamSubjectAssignment[]) => void;
  updateRemark: (studentId: string, examId: string, data: Partial<RemarkRecord>) => void;
  addClass: (name: string, nameBn?: string, details?: Partial<SchoolClass>) => void;
  updateClass: (cls: SchoolClass) => void;
  deleteClass: (id: string) => void;
  addTransaction: (transaction: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  updateTransaction: (transaction: FinanceTransaction) => void;
  deleteTransaction: (id: string) => void;
  setTransactions: (transactions: FinanceTransaction[]) => void;
  updateFeeStructure: (structure: ClassFeeStructure) => void;
  setFeeStructures: (structures: ClassFeeStructure[]) => void;
  addNotice: (notice: Omit<NoticeItem, 'id' | 'createdAt'>) => void;
  updateNotice: (notice: NoticeItem) => void;
  deleteNotice: (id: string) => void;
  setNotices: (notices: NoticeItem[]) => void;
  togglePinNotice: (id: string) => void;
  restoreFromTrash: (trashId: string) => void;
  permanentlyDeleteTrashItem: (trashId: string) => void;
  restoreAllFromTrash: () => void;
  emptyTrash: () => void;
  bulkPromoteStudents: (updatedStudents: Student[], historyRecord: PromotionHistoryRecord) => Promise<void>;
  promotionHistory: PromotionHistoryRecord[];
  clearPromotionHistory: () => void;
  setLanguage: (lang: Language) => void;
  setStudents: (students: Student[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setClasses: (classes: SchoolClass[]) => void;
  setExams: (exams: Exam[]) => void;
  setMarks: (marks: MarkRecord[]) => void;
  setRemarks: (remarks: RemarkRecord[]) => void;
  seedDemoMadrashaData: () => void;
  clearAllDemoData: () => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, displayName: string, requestedRole: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemoRole: (roleKey: 'superadmin' | 'principal' | 'teacher' | 'accountant' | 'office_staff' | 'guardian') => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refreshAdminClaims: () => Promise<boolean>;
  setMode: (mode: AppMode) => void;
  forcePushToCloud: () => Promise<void>;
  forcePullFromCloud: () => Promise<void>;
  isRecoveryModalOpen: boolean;
  setIsRecoveryModalOpen: (open: boolean) => void;
  isDataSecurityModalOpen: boolean;
  setIsDataSecurityModalOpen: (open: boolean) => void;
  isSuperAdmin: boolean;
  authContext: AuthorizationContext;
  hasPermission: (permission: Permission, scope?: { classId?: string; subjectId?: string; studentId?: string }) => boolean;
  currentRole: CustomRole | null;
  currentMember: InstitutionMember | null;
  institutionRoles: CustomRole[];
  refreshInstitutionRoles: () => Promise<void>;
  t: (key: keyof typeof translations['en']) => string;
}

const defaultSchoolProfile: SchoolProfile = {
  name: 'MADRASHA MANAGEMENT HIGH SCHOOL',
  address: '123 Education Road, Dhaka, Bangladesh',
  phone: '+880 1234 567890',
  email: 'info@madrasha.edu.bd',
  academicYear: new Date().getFullYear().toString(),
  headMasterName: 'Moulana Abdul Karim',
  resultCardTemplate: 'Classic',
  showHeadmasterSignature: true,
  showGuardianSignature: true,
  banglaFont: 'Noto Sans Bengali',
  banglaNumberFont: 'Noto Sans Bengali',
};

const defaultClasses: SchoolClass[] = [
  { id: '1', name: 'Play', order: 1 },
  { id: '2', name: 'Class 1', order: 2 },
  { id: '3', name: 'Class 2', order: 3 },
  { id: '4', name: 'Class 3', order: 4 },
  { id: '5', name: 'Class 5', order: 5 },
  { id: '6', name: 'Class 6', order: 6 },
  { id: '7', name: 'Class 7', order: 7 },
  { id: '8', name: 'Class 8', order: 8 },
  { id: '9', name: 'Class 9', order: 9 },
  { id: '10', name: 'Class 10', order: 10 },
];

const defaultAppUsers: AppUser[] = [
  {
    id: 'user_admin_01',
    name: 'Mehedi Hasan Sagor',
    nameBn: 'মেহেদী হাসান সাগর',
    phone: '01700000000',
    email: 'mehedihasansagor26@gmail.com',
    password: '123',
    role: 'super_admin',
    designation: 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_principal_01',
    name: 'Moulana Abdul Karim',
    nameBn: 'মাওলানা আব্দুল করিম',
    phone: '01755555555',
    email: 'principal@madrasha.local',
    password: '123',
    role: 'principal',
    designation: 'অধ্যক্ষ / মুহতামিম',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_teacher_01',
    name: 'Hafez Mawlana Hafizur Rahman',
    nameBn: 'হাফেজ মাওলানা হাফিজুর রহমান',
    phone: '01711111111',
    email: 'hafizur@madrasha.local',
    password: '123',
    role: 'teacher',
    designation: 'সিনিয়র মুয়াল্লিম',
    assignedClasses: ['ইবতেদায়ী ১ম', 'ইবতেদায়ী ২য়'],
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_acc_01',
    name: 'Muhammad Abdullah',
    nameBn: 'মুহাম্মদ আবদুল্লাহ',
    phone: '01722222222',
    email: 'accountant@madrasha.local',
    password: '123',
    role: 'accountant',
    designation: 'প্রধান হিসাবরক্ষক',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_staff_01',
    name: 'Abdur Rahim',
    nameBn: 'আব্দুর রহিম',
    phone: '01733333333',
    email: 'staff@madrasha.local',
    password: '123',
    role: 'staff',
    designation: 'অফিস সহকারী',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_guardian_01',
    name: 'Md. Rafiqul Islam',
    nameBn: 'মো: রফিকুল ইসলাম',
    phone: '01744444444',
    email: 'guardian@madrasha.local',
    password: '123',
    role: 'guardian',
    designation: 'অভিভাবক',
    status: 'active',
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];

// Singleton AppContext to ensure provider-consumer connection across updates
const AppContext = ((globalThis as any).__APP_CONTEXT__ || 
  ((globalThis as any).__APP_CONTEXT__ = createContext<AppContextType | undefined>(undefined))) as React.Context<AppContextType | undefined>;

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  const [institutionType, setInstitutionTypeState] = useState<InstitutionType>(() => {
    const saved = localStorage.getItem('institutionType');
    return (saved as InstitutionType) || 'MADRASAH';
  });

  const [institutionConfig, setInstitutionConfig] = useState<Institution>(() => {
    const saved = localStorage.getItem('institutionConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback to default
      }
    }
    const currentType = (localStorage.getItem('institutionType') as InstitutionType) || 'MADRASAH';
    return getDefaultInstitutionConfig(currentType);
  });

  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => {
    const saved = localStorage.getItem('schoolProfile');
    return saved ? JSON.parse(saved) : defaultSchoolProfile;
  });

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() => {
    const saved = localStorage.getItem('academicYears');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    const currentYear = defaultSchoolProfile.academicYear || new Date().getFullYear().toString();
    return [{
      id: `ay_${currentYear}`,
      institutionId: 'inst_madrasah_primary',
      name: currentYear,
      status: 'ACTIVE',
      isCurrent: true,
      createdAt: new Date().toISOString()
    }];
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    const saved = localStorage.getItem('classes');
    return saved ? JSON.parse(saved) : defaultClasses;
  });

  const [sections, setSections] = useState<Section[]>(() => {
    const saved = localStorage.getItem('sections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [trashBin, setTrashBin] = useState<TrashItem[]>(() => {
    const saved = localStorage.getItem('madrasha_trash_bin');
    return saved ? JSON.parse(saved) : [];
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('students');
    return saved ? JSON.parse(saved) : [];
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('subjects');
    return saved ? JSON.parse(saved) : [];
  });

  const [teachers, setTeachers] = useState<AcademicTeacher[]>(() => {
    const teachersMap = new Map<string, AcademicTeacher>();
    const saved = localStorage.getItem('teachers');
    if (saved) {
      try {
        const parsed: AcademicTeacher[] = JSON.parse(saved);
        parsed.forEach(t => { if (t && t.id) teachersMap.set(t.id, t); });
      } catch {}
    }
    // Also load teachers from institution members if not present
    const membersSaved = localStorage.getItem('madrasha_institution_members');
    if (membersSaved) {
      try {
        const membersList: any[] = JSON.parse(membersSaved);
        membersList.forEach(m => {
          if (m && (m.roleId === 'role_teacher' || m.requestedRole?.includes('শিক্ষক') || m.requestedRole?.includes('Teacher'))) {
            if (!teachersMap.has(m.uid)) {
              teachersMap.set(m.uid, {
                id: m.uid,
                institutionId: 'inst_madrasah_primary',
                name: m.displayName || m.name || 'সহকারী শিক্ষক',
                nameBn: m.displayName || m.nameBn || 'সহকারী শিক্ষক',
                phone: m.phone || '',
                designation: m.requestedRole || 'সহকারী শিক্ষক',
                status: 'ACTIVE',
                createdAt: m.createdAt || new Date().toISOString()
              });
            }
          }
        });
      } catch {}
    }
    return Array.from(teachersMap.values());
  });

  const [classSubjectAssignments, setClassSubjectAssignments] = useState<ClassSubjectAssignment[]>(() => {
    const saved = localStorage.getItem('classSubjectAssignments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [teacherSubjectAssignments, setTeacherSubjectAssignments] = useState<TeacherSubjectAssignment[]>(() => {
    const saved = localStorage.getItem('teacherSubjectAssignments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [classTeacherAssignments, setClassTeacherAssignments] = useState<ClassTeacherAssignment[]>(() => {
    const saved = localStorage.getItem('classTeacherAssignments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('exams');
    return saved ? JSON.parse(saved) : [{ id: '1', name: 'Annual Examination', academicYear: '2024', category: 'Term' }];
  });

  const [examSubjectAssignments, setExamSubjectAssignments] = useState<ExamSubjectAssignment[]>(() => {
    const saved = localStorage.getItem('examSubjectAssignments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [marks, setMarks] = useState<MarkRecord[]>(() => {
    const saved = localStorage.getItem('marks');
    return saved ? JSON.parse(saved) : [];
  });

  const [remarks, setRemarks] = useState<RemarkRecord[]>(() => {
    const saved = localStorage.getItem('remarks');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => {
    const saved = localStorage.getItem('madrasha_transactions');
    return saved ? JSON.parse(saved) : generateSampleFinanceData();
  });

  const [feeStructures, setFeeStructures] = useState<ClassFeeStructure[]>(() => {
    const saved = localStorage.getItem('madrasha_fee_structures');
    return saved ? JSON.parse(saved) : defaultFeeStructures;
  });

  const [promotionHistory, setPromotionHistory] = useState<PromotionHistoryRecord[]>(() => {
    const saved = localStorage.getItem('madrasha_promotion_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const defaultSampleNotices: NoticeItem[] = [
    {
      id: 'notice-urgent-1',
      title: 'জরুরি সতর্কতা: তীব্র শৈত্যপ্রবাহ ও দুর্যোগপূর্ণ আবহাওয়ার কারণে শ্রেণি কার্যক্রম স্থগিত',
      content: 'সরকারি ও প্রাতিষ্ঠানিক নির্দেশনানুযায়ী তীব্র শৈত্যপ্রবাহ ও দুর্যোগপূর্ণ আবহাওয়ার কারণে আগামীকাল বৃহস্পতিবার সকল শ্রেণির ক্লাস স্থগিত থাকবে। তবে আবাসিক হেফজ ও কিতাবখানা নিজস্ব সূচি অনুযায়ী পরিচালিত হবে।',
      category: 'cancellation',
      priority: 'urgent',
      target: 'all',
      isPinned: true,
      isActive: true,
      showMarquee: true,
      showAlertBanner: true,
      authorName: 'মুহতামিম কার্যালয়',
      authorRole: 'অধ্যক্ষ',
      date: '2026-10-07',
      createdAt: new Date().toISOString()
    },
    {
      id: 'notice-exam-1',
      title: 'আসন্ন ১ম সাময়িক পরীক্ষা ২০২৬ এর চূড়ান্ত রুটিন ও প্রবেশপত্র বিতরণ সংক্রান্ত বিজ্ঞপ্তি',
      content: 'সকল শিক্ষার্থী ও অভিভাবকদের জানানো যাচ্ছে যে, আগামী ১৫ অক্টোবর থেকে ১ম সাময়িক পরীক্ষা শুরু হবে। ১২ অক্টোবরের মধ্যে অফিস কক্ষ থেকে পরীক্ষার প্রবেশপত্র সংগ্রহ করতে হবে।',
      category: 'exam',
      priority: 'important',
      target: 'students',
      isPinned: true,
      isActive: true,
      showMarquee: true,
      showAlertBanner: true,
      authorName: 'পরীক্ষা নিয়ন্ত্রণ কমিটি',
      authorRole: 'পরীক্ষা নিয়ন্ত্রক',
      date: '2026-10-06',
      createdAt: new Date().toISOString()
    },
    {
      id: 'notice-update-1',
      title: 'অভিভাবক সমাবেশ ও মাসিক মূল্যায়ন ফলাফল পর্যালোচনা সংক্রান্ত নোটিশ',
      content: 'আগামী শনিবার সকাল ১০:০০ ঘটিকায় মাদ্রাসার অডিটোরিয়ামে অভিভাবক সমাবেশ অনুষ্ঠিত হবে। সকল অভিভাবককে যথাসময়ে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।',
      category: 'urgent',
      priority: 'important',
      target: 'guardians',
      isPinned: false,
      isActive: true,
      showMarquee: true,
      showAlertBanner: false,
      authorName: 'প্রশাসন বিভাগ',
      authorRole: 'অফিস ইনচার্জ',
      date: '2026-10-05',
      createdAt: new Date().toISOString()
    }
  ];

  const [notices, setNotices] = useState<NoticeItem[]>(() => {
    const saved = localStorage.getItem('madrasha_notices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return defaultSampleNotices;
  });

  useEffect(() => {
    localStorage.setItem('madrasha_notices', JSON.stringify(notices));
  }, [notices]);

  const addNotice = (noticeData: Omit<NoticeItem, 'id' | 'createdAt'>) => {
    const newNotice: NoticeItem = {
      ...noticeData,
      id: `notice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      isActive: noticeData.isActive !== undefined ? noticeData.isActive : true,
      showMarquee: noticeData.showMarquee !== undefined ? noticeData.showMarquee : true,
      showAlertBanner: noticeData.showAlertBanner !== undefined ? noticeData.showAlertBanner : (noticeData.priority === 'urgent' || noticeData.category === 'cancellation'),
      createdAt: new Date().toISOString()
    };
    setNotices(prev => [newNotice, ...prev]);
  };

  const updateNotice = (updatedNotice: NoticeItem) => {
    setNotices(prev => prev.map(n => n.id === updatedNotice.id ? { ...updatedNotice, updatedAt: new Date().toISOString() } : n));
  };

  const deleteNotice = (id: string) => {
    setNotices(prev => prev.filter(n => n.id !== id));
  };

  const togglePinNotice = (id: string) => {
    setNotices(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  // Cloud Sync & Security State
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing');
  const [cloudLastSynced, setCloudLastSynced] = useState<string>('Initializing...');
  
  // Auth state - Authoritative Firebase Auth & Custom Claims (Zero Trust in LocalStorage flags)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authClaims, setAuthClaims] = useState<Record<string, any> | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('mehedihasansagor26@gmail.com');
  const [mode, setModeState] = useState<AppMode>('viewer');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false);
  const [isDataSecurityModalOpen, setIsDataSecurityModalOpen] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const saved = localStorage.getItem('madrasha_active_tab');
    return saved || 'dashboard';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('madrasha_active_tab', tab);
  };

  // Multi-Institution RBAC State
  const [institutionRoles, setInstitutionRoles] = useState<CustomRole[]>([]);
  const [currentRole, setCurrentRole] = useState<CustomRole | null>(null);
  const [currentMember, setCurrentMember] = useState<InstitutionMember | null>(null);

  const isSuperAdmin = isVerifiedSuperAdmin(authUser, authClaims);

  const authContext: AuthorizationContext = buildAuthorizationContext(
    authUser,
    authClaims,
    currentMember,
    currentRole,
    'inst_madrasah_primary'
  );

  const hasPermission = (
    permission: Permission, 
    scope?: { classId?: string; subjectId?: string; studentId?: string }
  ): boolean => {
    const isOwner = (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
    if (isSuperAdmin || isOwner || isAdmin || currentUser?.role === 'super_admin') {
      return true;
    }

    const effectiveRole = currentUser?.role || currentMember?.roleId?.replace('role_', '') || userRole;

    if (effectiveRole === 'principal') {
      if (permission === 'system.backup' || permission === 'system.audit') return false;
      return true;
    }

    if (effectiveRole === 'accountant') {
      if (permission.startsWith('finance.') || permission.startsWith('fees.') || permission.startsWith('payments.')) return true;
      if (permission === 'reports.view' || permission === 'students.view') return true;
    }

    if (effectiveRole === 'teacher') {
      if (permission.startsWith('attendance.') || permission.startsWith('marks.') || permission.startsWith('subjects.')) return true;
      if (permission === 'reports.view' || permission === 'students.view') return true;
    }

    if (effectiveRole === 'guardian' || effectiveRole === 'parent') {
      if (permission === 'students.view' || permission === 'marks.view' || permission === 'attendance.view' || permission === 'fees.view') return true;
    }

    return checkPermission(authContext, permission, scope);
  };

  const refreshInstitutionRoles = async () => {
    try {
      const roles = await getInstitutionRoles('inst_madrasah_primary');
      if (roles.length > 0) {
        setInstitutionRoles(roles);
      } else if (isAdmin && authUser) {
        const initial = await initializeInstitutionDefaultRoles('inst_madrasah_primary', authUser.uid);
        setInstitutionRoles(initial);
      }
    } catch (err) {
      console.warn('[RBAC] Roles fetch error:', err);
    }
  };

  // App Users State & Persistence
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_app_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultAppUsers;
  });

  useEffect(() => {
    try {
      localStorage.setItem('madrasha_app_users', JSON.stringify(users));
    } catch (e) {}
  }, [users]);

  const [activeAppUserId, setActiveAppUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('madrasha_active_app_user_id');
      if (saved) return saved;
      const session = localStorage.getItem('madrasha_active_auth_session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.uid || null;
      }
    } catch (e) {}
    return null;
  });

  const currentUser: AppUser | null = React.useMemo(() => {
    if (authUser) {
      const isOwnerAccount = (authUser.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
      const realDisplayName = authUser.displayName || (isOwnerAccount ? 'Mehedi Hasan Sagor' : (authUser.email?.split('@')[0] || 'User'));
      const realDisplayNameBn = authUser.displayName || (isOwnerAccount ? 'মেহেদী হাসান সাগর' : (authUser.email?.split('@')[0] || 'ব্যবহারকারী'));

      const found = users.find(u => u.id === authUser.uid || (u.email && authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase()));
      if (found) {
        if (found.name === 'Moulana Abdul Karim' || !found.name || isOwnerAccount) {
          return {
            ...found,
            name: realDisplayName,
            nameBn: realDisplayNameBn,
            email: authUser.email || found.email,
            role: isOwnerAccount ? 'super_admin' : found.role,
            designation: isOwnerAccount ? 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন' : (found.designation || 'সদস্য')
          };
        }
        return found;
      }
      const mappedRole: UserRole = isSuperAdmin ? 'super_admin' : (authRole === 'principal' ? 'principal' : authRole === 'accountant' ? 'accountant' : authRole === 'guardian' ? 'guardian' : authRole === 'staff' ? 'staff' : 'teacher');
      return {
        id: authUser.uid,
        name: realDisplayName,
        nameBn: realDisplayNameBn,
        email: authUser.email || undefined,
        phone: currentMember?.phone || undefined,
        role: mappedRole,
        assignedClasses: currentMember?.assignedClasses || [],
        assignedSubjects: currentMember?.assignedSubjects || [],
        status: 'active',
        createdAt: currentMember?.createdAt || new Date().toISOString()
      };
    }
    if (activeAppUserId) {
      const found = users.find(u => u.id === activeAppUserId);
      if (found) return found;
    }
    return null;
  }, [users, activeAppUserId, authUser, currentMember, isSuperAdmin, authRole]);

  const userRole: UserRole | null = currentUser?.role || (authRole as UserRole) || null;

  const signUpUser = async (data: {
    name: string;
    nameBn?: string;
    phone: string;
    email?: string;
    password?: string;
    role: UserRole;
    designation?: string;
    assignedClasses?: string[];
    studentId?: string;
    studentClass?: string;
  }): Promise<{ success: boolean; message: string; user?: AppUser }> => {
    const cleanPhone = (data.phone || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();

    const existing = users.find(u => 
      (cleanPhone && u.phone === cleanPhone) || 
      (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
    );

    if (existing) {
      return {
        success: false,
        message: 'এই মোবাইল নম্বর অথবা ইমেইল দিয়ে ইতোমধ্যে একটি একাউন্ট খোলা আছে।'
      };
    }

    const newUser: AppUser = {
      id: 'usr_' + generateId(),
      name: data.name.trim(),
      nameBn: (data.nameBn || data.name).trim(),
      phone: cleanPhone,
      email: cleanEmail || undefined,
      password: data.password?.trim() || '123',
      role: data.role,
      designation: data.designation?.trim(),
      assignedClasses: data.assignedClasses || [],
      studentId: data.studentId,
      studentClass: data.studentClass,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [newUser, ...prev]);

    try {
      const memberObj: InstitutionMember = {
        uid: newUser.id,
        institutionId: 'inst_madrasah_primary',
        email: newUser.email || (newUser.phone ? `${newUser.phone}@madrasha.local` : `${newUser.id}@madrasha.local`),
        displayName: newUser.nameBn || newUser.name,
        phone: newUser.phone,
        roleId: newUser.role === 'super_admin' ? 'role_institution_admin' : `role_${newUser.role}`,
        requestedRole: newUser.role,
        status: 'active',
        assignedClasses: newUser.assignedClasses || [],
        assignedSubjects: [],
        createdAt: newUser.createdAt,
        updatedAt: newUser.createdAt
      };
      setInstitutionMember('inst_madrasah_primary', memberObj, newUser.id).catch(() => {});
    } catch (e) {}

    return {
      success: true,
      message: 'নতুন একাউন্ট সফলভাবে তৈরি হয়েছে!',
      user: newUser
    };
  };

  const updateAppUser = async (user: AppUser): Promise<{ success: boolean; message?: string }> => {
    setUsers(prev => prev.map(u => u.id === user.id ? user : u));

    try {
      const memberObj: InstitutionMember = {
        uid: user.id,
        institutionId: 'inst_madrasah_primary',
        email: user.email || (user.phone ? `${user.phone}@madrasha.local` : `${user.id}@madrasha.local`),
        displayName: user.nameBn || user.name,
        phone: user.phone,
        roleId: user.role === 'super_admin' ? 'role_institution_admin' : `role_${user.role}`,
        requestedRole: user.role,
        status: user.status === 'blocked' ? 'suspended' : 'active',
        assignedClasses: user.assignedClasses || [],
        assignedSubjects: user.assignedSubjects || [],
        createdAt: user.createdAt,
        updatedAt: new Date().toISOString()
      };
      setInstitutionMember('inst_madrasah_primary', memberObj, user.id).catch(() => {});
    } catch (e) {}

    return { success: true, message: 'ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে!' };
  };

  const deleteAppUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    try {
      deleteInstitutionMember('inst_madrasah_primary', userId).catch(() => {});
    } catch (e) {}
    return { success: true, message: 'ব্যবহারকারী সফলভাবে ডিলিট হয়েছে।' };
  };

  const loginWithEmailOrPhone = async (
    identifier: string, 
    password: string
  ): Promise<{ success: boolean; message?: string; user?: AppUser }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    const user = users.find(u => 
      (u.phone && u.phone.trim() === cleanId) || 
      (u.email && u.email.trim().toLowerCase() === cleanId)
    );

    if (!user) {
      return {
        success: false,
        message: 'এই মোবাইল বা ইমেইলে কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি।'
      };
    }

    if (user.password && user.password !== cleanPass) {
      return {
        success: false,
        message: 'ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।'
      };
    }

    if (user.status === 'blocked') {
      return {
        success: false,
        message: 'আপনার অ্যাকাউন্টটি স্থগিত (Blocked) করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।'
      };
    }

    setActiveAppUserId(user.id);
    try {
      localStorage.setItem('madrasha_active_app_user_id', user.id);
    } catch (e) {}

    // Role portal session
    const isOwner = (user.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
    const isAdministrative = user.role === 'super_admin' || user.role === 'principal' || isOwner;
    setAuthUser(null);
    setAdminEmail(user.email || '');
    setIsAdmin(isAdministrative);
    setAuthRole(user.role);
    setModeState(isAdministrative ? 'editor' : 'viewer');

    const memberRecord: InstitutionMember = {
      uid: user.id,
      institutionId: 'inst_madrasah_primary',
      email: user.email || `${user.phone}@madrasha.local`,
      displayName: user.nameBn || user.name,
      roleId: `role_${user.role}`,
      status: 'active',
      assignedClasses: user.assignedClasses || [],
      assignedSubjects: user.assignedSubjects || [],
      createdAt: user.createdAt,
      updatedAt: new Date().toISOString()
    };
    setCurrentMember(memberRecord);

    if (user.role === 'guardian') {
      setActiveTabState('guardian_portal');
    } else if (user.role === 'teacher') {
      setActiveTabState('marks');
    } else if (user.role === 'accountant') {
      setActiveTabState('finance');
    } else {
      setActiveTabState('dashboard');
    }

    try {
      localStorage.setItem('madrasha_active_auth_session', JSON.stringify({
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleId: `role_${user.role}`
      }));
    } catch (e) {}

    return {
      success: true,
      message: 'লগইন সফল হয়েছে!',
      user
    };
  };

  const logoutUser = async () => {
    setActiveAppUserId(null);
    try {
      localStorage.removeItem('madrasha_active_app_user_id');
    } catch (e) {}
    await logoutAdmin();
  };

  const isRemoteUpdateRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRemoteRef = useRef(false);

  // Monitor Firebase Auth changes and authoritatively verify Custom Claims (role: "admin") or designated Owner
  useEffect(() => {
    // Safety fail-safe: Ensure the UI never hangs in an infinite loading state
    const authTimeoutTimer = setTimeout(() => {
      setIsAuthReady(true);
    }, 1200);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      clearTimeout(authTimeoutTimer);

      if (user) {
        setAuthUser(user);
        if (user.email) {
          setAdminEmail(user.email);
        }

        const isOwnerAccount = (user.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
        const realName = user.displayName || (isOwnerAccount ? 'Mehedi Hasan Sagor' : (user.email?.split('@')[0] || 'User'));
        const realNameBn = user.displayName || (isOwnerAccount ? 'মেহেদী হাসান সাগর' : (user.email?.split('@')[0] || 'ব্যবহারকারী'));

        // Fast-path for owner account without waiting on network
        if (isOwnerAccount) {
          setIsAdmin(true);
          setAuthRole('admin');
          setModeState('admin');
        }

        // Synchronize authenticated user profile into app users list (replaces demo names)
        setUsers(prevUsers => {
          const userEmail = (user.email || '').toLowerCase();
          const existingIdx = prevUsers.findIndex(u => 
            (u.email && u.email.toLowerCase() === userEmail) || u.id === user.uid || (isOwnerAccount && (u.role === 'super_admin' || u.id === 'user_admin_01'))
          );
          let updatedList: AppUser[];
          if (existingIdx >= 0) {
            updatedList = [...prevUsers];
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              id: user.uid,
              name: realName,
              nameBn: realNameBn,
              email: user.email || updatedList[existingIdx].email,
              role: isOwnerAccount ? 'super_admin' : updatedList[existingIdx].role,
              designation: isOwnerAccount ? 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন' : (updatedList[existingIdx].designation || 'সদস্য'),
              status: 'active'
            };
          } else {
            const newUser: AppUser = {
              id: user.uid,
              name: realName,
              nameBn: realNameBn,
              email: user.email || undefined,
              role: isOwnerAccount ? 'super_admin' : 'teacher',
              designation: isOwnerAccount ? 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন' : 'মুয়াল্লিম',
              status: 'active',
              createdAt: new Date().toISOString()
            };
            updatedList = [newUser, ...prevUsers];
          }
          try {
            localStorage.setItem('madrasha_app_users', JSON.stringify(updatedList));
          } catch (e) {}
          return updatedList;
        });

        try {
          // Wrap token result with a 1500ms timeout to prevent network hang on slow mobile connections
          const fetchClaimsPromise = user.getIdTokenResult(false).catch(() => user.getIdTokenResult());
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
          
          const tokenResult = await Promise.race([fetchClaimsPromise, timeoutPromise]);
          const claims = tokenResult?.claims || {};
          const role = typeof claims.role === 'string' ? claims.role : (isOwnerAccount ? 'admin' : null);
          const hasAdminAccess = role === 'admin' || isOwnerAccount;

          setAuthClaims(claims);
          setAuthRole(role);
          setIsAdmin(hasAdminAccess);
          setModeState(hasAdminAccess ? 'admin' : 'viewer');

          // Ensure RBAC role document is written for owner in Firestore asynchronously
          if (hasAdminAccess) {
            const adminDocRef = doc(db, 'admins', user.uid);
            setDoc(adminDocRef, {
              uid: user.uid,
              email: user.email,
              role: 'admin',
              lastActiveAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.warn('Could not read user auth claims:', err);
          if (!isOwnerAccount) {
            setAuthClaims(null);
            setAuthRole(null);
            setIsAdmin(false);
            setModeState('viewer');
          }
        } finally {
          setIsAuthReady(true);
        }
      } else {
        const savedSession = localStorage.getItem('madrasha_active_auth_session');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.uid) {
              // Local portal session only (guardian or teacher portal)
              // CRITICAL SECURITY RULE: A local session must NEVER grant remote Admin privileges or set authUser.
              setCurrentMember(parsed);
              if (parsed.uid) {
                setActiveAppUserId(parsed.uid);
              }
            }
          } catch (e) {}
        }
        setAuthUser(null);
        setAdminEmail('');
        setAuthClaims(null);
        setAuthRole(null);
        setIsAdmin(false);
        setModeState('viewer');
        setIsAuthReady(true);
      }
    });

    return () => {
      clearTimeout(authTimeoutTimer);
      unsubscribeAuth();
    };
  }, []);

  // Multi-Institution RBAC: Load Custom Roles and Member record
  useEffect(() => {
    if (authUser) {
      refreshInstitutionRoles();
      getInstitutionMember('inst_madrasah_primary', authUser.uid)
        .then(member => {
          if (member) {
            setCurrentMember(member);
          }
        })
        .catch(err => console.warn('[RBAC] Member fetch notice:', err));
    } else {
      setInstitutionRoles([]);
      setCurrentRole(null);
      setCurrentMember(null);
    }
  }, [authUser]);

  // Helper: Atomically load remote data into both React state and localStorage cache
  const applyRemoteData = (data: any) => {
    if (!data) return;
    hasLoadedRemoteRef.current = true;
    isRemoteUpdateRef.current = true;

    if (data.schoolProfile) {
      setSchoolProfile(data.schoolProfile);
      try { localStorage.setItem('schoolProfile', JSON.stringify(data.schoolProfile)); } catch {}
    }
    if (data.students && Array.isArray(data.students)) {
      setStudents(data.students);
      try { localStorage.setItem('students', JSON.stringify(data.students)); } catch {}
    }
    if (data.subjects && Array.isArray(data.subjects)) {
      setSubjects(data.subjects);
      try { localStorage.setItem('subjects', JSON.stringify(data.subjects)); } catch {}
    }
    if (data.exams && Array.isArray(data.exams)) {
      setExams(data.exams);
      try { localStorage.setItem('exams', JSON.stringify(data.exams)); } catch {}
    }
    if (data.marks && Array.isArray(data.marks)) {
      setMarks(data.marks);
      try { localStorage.setItem('marks', JSON.stringify(data.marks)); } catch {}
    }
    if (data.remarks && Array.isArray(data.remarks)) {
      setRemarks(data.remarks);
      try { localStorage.setItem('remarks', JSON.stringify(data.remarks)); } catch {}
    }
    if (data.classes && Array.isArray(data.classes)) {
      setClasses(data.classes);
      try { localStorage.setItem('classes', JSON.stringify(data.classes)); } catch {}
    }
    if (data.academicYears && Array.isArray(data.academicYears)) {
      setAcademicYears(data.academicYears);
      try { localStorage.setItem('academicYears', JSON.stringify(data.academicYears)); } catch {}
    }
    if (data.sections && Array.isArray(data.sections)) {
      setSections(data.sections);
      try { localStorage.setItem('sections', JSON.stringify(data.sections)); } catch {}
    }
    if (data.transactions && Array.isArray(data.transactions)) {
      setTransactions(data.transactions);
      try { localStorage.setItem('madrasha_transactions', JSON.stringify(data.transactions)); } catch {}
    }
    if (data.feeStructures && Array.isArray(data.feeStructures)) {
      setFeeStructures(data.feeStructures);
      try { localStorage.setItem('madrasha_fee_structures', JSON.stringify(data.feeStructures)); } catch {}
    }
    if (data.trashBin && Array.isArray(data.trashBin)) {
      setTrashBin(data.trashBin);
      try { localStorage.setItem('madrasha_trash_bin', JSON.stringify(data.trashBin)); } catch {}
    }
    if (data.promotionHistory && Array.isArray(data.promotionHistory)) {
      setPromotionHistory(data.promotionHistory);
      try { localStorage.setItem('madrasha_promotion_history', JSON.stringify(data.promotionHistory)); } catch {}
    }
    if (data.teachers && Array.isArray(data.teachers)) {
      setTeachers(data.teachers);
      try { localStorage.setItem('madrasha_teachers', JSON.stringify(data.teachers)); } catch {}
    }
    if (data.classSubjectAssignments && Array.isArray(data.classSubjectAssignments)) {
      setClassSubjectAssignments(data.classSubjectAssignments);
      try { localStorage.setItem('madrasha_class_subject_assignments', JSON.stringify(data.classSubjectAssignments)); } catch {}
    }
    if (data.teacherSubjectAssignments && Array.isArray(data.teacherSubjectAssignments)) {
      setTeacherSubjectAssignments(data.teacherSubjectAssignments);
      try { localStorage.setItem('madrasha_teacher_subject_assignments', JSON.stringify(data.teacherSubjectAssignments)); } catch {}
    }
    if (data.classTeacherAssignments && Array.isArray(data.classTeacherAssignments)) {
      setClassTeacherAssignments(data.classTeacherAssignments);
      try { localStorage.setItem('madrasha_class_teacher_assignments', JSON.stringify(data.classTeacherAssignments)); } catch {}
    }
    if (data.examSubjectAssignments && Array.isArray(data.examSubjectAssignments)) {
      setExamSubjectAssignments(data.examSubjectAssignments);
      try { localStorage.setItem('madrasha_exam_subject_assignments', JSON.stringify(data.examSubjectAssignments)); } catch {}
    }
    if (data.users && Array.isArray(data.users)) {
      setUsers(data.users);
      try { localStorage.setItem('madrasha_app_users', JSON.stringify(data.users)); } catch {}
    }
    if (data.notices && Array.isArray(data.notices)) {
      setNotices(data.notices);
      try { localStorage.setItem('madrasha_notices', JSON.stringify(data.notices)); } catch {}
    }

    setCloudStatus('connected');
    const timeStr = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCloudLastSynced(timeStr);

    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 400);
  };

  // Load from and Listen to Firebase Firestore in real-time
  useEffect(() => {
    const docRef = doc(db, 'institution', 'main_store');
    
    setCloudStatus('syncing');

    // Immediate direct getDoc load to guarantee instant data availability on boot
    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          applyRemoteData(snap.data());
        }
      })
      .catch((err) => {
        console.warn('Initial direct getDoc load notice:', err?.message || err);
      });

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          applyRemoteData(snapshot.data());
        } else {
          setCloudStatus('connected');
          setCloudLastSynced('No Cloud Data Found');
        }
      },
      (error) => {
        console.warn('Firestore snapshot listener notice:', error?.message || error);
        if (error?.code === 'permission-denied') {
          console.warn('[Firestore] Permission denied');
          setCloudStatus('error');
        } else {
          setCloudStatus('offline');
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Background debounced auto-sync to Firebase Firestore on local state changes
  useEffect(() => {
    if (isRemoteUpdateRef.current) return;

    // CRITICAL CLOUD PROTECTION: Never auto-sync until initial remote data status has resolved
    if (!hasLoadedRemoteRef.current) return;

    // CRITICAL EMPTY DATA PROTECTION: Never overwrite cloud data with empty local state
    if (students.length === 0 && marks.length === 0) {
      return;
    }

    setCloudStatus('syncing');

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          schoolProfile,
          students,
          subjects,
          teachers,
          classSubjectAssignments,
          teacherSubjectAssignments,
          classTeacherAssignments,
          exams,
          examSubjectAssignments,
          marks,
          remarks,
          classes,
          academicYears,
          sections,
          transactions,
          feeStructures,
          trashBin,
          promotionHistory,
          users,
          notices,
          updatedBy: currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'system_user',
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true });
        setCloudStatus('connected');
        setCloudLastSynced(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.warn('Failed to sync changes to Firestore:', err?.message || err);
        if (err?.code === 'permission-denied') {
          setCloudStatus('error');
        } else {
          setCloudStatus('offline');
        }
      }
    }, 1200);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [schoolProfile, students, subjects, teachers, classSubjectAssignments, teacherSubjectAssignments, classTeacherAssignments, exams, examSubjectAssignments, marks, remarks, classes, academicYears, sections, transactions, feeStructures, trashBin, promotionHistory, users, notices, currentUser, isAdmin, authUser, adminEmail]);

  // Offline LocalStorage updates
  useEffect(() => {
    localStorage.setItem('schoolProfile', JSON.stringify(schoolProfile));
  }, [schoolProfile]);

  useEffect(() => {
    localStorage.setItem('academicYears', JSON.stringify(academicYears));
  }, [academicYears]);

  useEffect(() => {
    localStorage.setItem('classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('sections', JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('madrasha_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('madrasha_fee_structures', JSON.stringify(feeStructures));
  }, [feeStructures]);

  useEffect(() => {
    localStorage.setItem('madrasha_trash_bin', JSON.stringify(trashBin));
  }, [trashBin]);

  useEffect(() => {
    localStorage.setItem('madrasha_promotion_history', JSON.stringify(promotionHistory));
  }, [promotionHistory]);

  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('teachers', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('classSubjectAssignments', JSON.stringify(classSubjectAssignments));
  }, [classSubjectAssignments]);

  useEffect(() => {
    localStorage.setItem('teacherSubjectAssignments', JSON.stringify(teacherSubjectAssignments));
  }, [teacherSubjectAssignments]);

  useEffect(() => {
    localStorage.setItem('classTeacherAssignments', JSON.stringify(classTeacherAssignments));
  }, [classTeacherAssignments]);

  useEffect(() => {
    localStorage.setItem('exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('examSubjectAssignments', JSON.stringify(examSubjectAssignments));
  }, [examSubjectAssignments]);

  useEffect(() => {
    localStorage.setItem('marks', JSON.stringify(marks));
  }, [marks]);

  useEffect(() => {
    localStorage.setItem('remarks', JSON.stringify(remarks));
  }, [remarks]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // MULTI-STORE PERSISTENCE & AUTO-RESURRECTION GUARDIAN
  // 1. On Mount: Request persistent browser storage & Auto-Resurrect if Chrome clear data occurred
  useEffect(() => {
    // Request persistent storage from browser to prevent eviction
    requestPersistentStorage().catch(err => console.warn('[Storage] Persist request notice:', err));

    // Check if auto-resurrection from IndexedDB Vault or Cloud Firestore is needed
    resurrectDataIfEmpty().then((res) => {
      if (res.resurrected && res.restoredPayload) {
        const p = res.restoredPayload;
        if (p.schoolProfile) setSchoolProfile(p.schoolProfile);
        if (Array.isArray(p.students) && p.students.length > 0) setStudents(p.students);
        if (Array.isArray(p.classes) && p.classes.length > 0) setClasses(p.classes);
        if (Array.isArray(p.subjects) && p.subjects.length > 0) setSubjects(p.subjects);
        if (Array.isArray(p.exams) && p.exams.length > 0) setExams(p.exams);
        if (Array.isArray(p.marks) && p.marks.length > 0) setMarks(p.marks);
        if (Array.isArray(p.remarks)) setRemarks(p.remarks);
        if (Array.isArray(p.transactions) && p.transactions.length > 0) setTransactions(p.transactions);
        if (Array.isArray(p.feeStructures)) setFeeStructures(p.feeStructures);
        if (Array.isArray(p.trashBin)) setTrashBin(p.trashBin);
        if (Array.isArray(p.academicYears)) setAcademicYears(p.academicYears);
        if (Array.isArray(p.sections)) setSections(p.sections);
        if (Array.isArray(p.teachers)) setTeachers(p.teachers);
        if (Array.isArray(p.classSubjectAssignments)) setClassSubjectAssignments(p.classSubjectAssignments);
        if (Array.isArray(p.teacherSubjectAssignments)) setTeacherSubjectAssignments(p.teacherSubjectAssignments);
        if (Array.isArray(p.classTeacherAssignments)) setClassTeacherAssignments(p.classTeacherAssignments);
        if (Array.isArray(p.examSubjectAssignments)) setExamSubjectAssignments(p.examSubjectAssignments);
        if (Array.isArray(p.promotionHistory)) setPromotionHistory(p.promotionHistory);
        console.log('[Data Guardian] Auto-Resurrection complete:', res.messageEn);
      }
    }).catch(err => console.warn('[Data Guardian] Startup check notice:', err));
  }, []);

  // 2. Debounced multi-store synchronization into IndexedDB Permanent Vault & Auto Rolling Snapshot
  useEffect(() => {
    const timer = setTimeout(() => {
      if (students.length > 0 || marks.length > 0 || classes.length > 0) {
        saveToIndexedDbVault({
          schoolProfile,
          students,
          classes,
          subjects,
          exams,
          marks,
          remarks,
          transactions,
          feeStructures,
          trashBin,
          academicYears,
          sections,
          teachers,
          classSubjectAssignments,
          teacherSubjectAssignments,
          classTeacherAssignments,
          examSubjectAssignments,
          promotionHistory
        }, 'auto_interval').catch(err => console.warn('[IndexedDB Vault] Background sync notice:', err));
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    schoolProfile,
    students,
    classes,
    subjects,
    exams,
    marks,
    remarks,
    transactions,
    feeStructures,
    trashBin,
    academicYears,
    sections,
    teachers,
    classSubjectAssignments,
    teacherSubjectAssignments,
    classTeacherAssignments,
    examSubjectAssignments,
    promotionHistory
  ]);

  // 3. Periodic 15-minute background rolling snapshot timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (students.length > 0 || marks.length > 0 || classes.length > 0) {
        saveToIndexedDbVault({
          schoolProfile,
          students,
          classes,
          subjects,
          exams,
          marks,
          remarks,
          transactions,
          feeStructures,
          trashBin,
          academicYears,
          sections,
          teachers,
          classSubjectAssignments,
          teacherSubjectAssignments,
          classTeacherAssignments,
          examSubjectAssignments,
          promotionHistory
        }, 'auto_interval', '১৫ মিনিট পর্যায়ক্রমিক অটো ব্যাকআপ', '15-min Periodic Checkpoint').catch(() => {});
      }
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [
    schoolProfile,
    students,
    classes,
    subjects,
    exams,
    marks,
    remarks,
    transactions,
    feeStructures,
    trashBin,
    academicYears,
    sections,
    teachers,
    classSubjectAssignments,
    teacherSubjectAssignments,
    classTeacherAssignments,
    examSubjectAssignments,
    promotionHistory
  ]);

  // 4. Background Google Drive Periodic Auto-Backup
  useEffect(() => {
    const runDriveAutoBackup = async () => {
      const settings = getGoogleDriveBackupSettings();
      if (!settings.autoBackupEnabled) return;
      const token = getCachedGoogleAccessToken();
      if (!token || !authUser || !isAdmin) return;

      if (students.length === 0 && marks.length === 0 && classes.length === 0) return;

      try {
        await uploadBackupToGoogleDrive({
          schoolProfile,
          students,
          classes,
          subjects,
          exams,
          marks,
          remarks,
          transactions,
          feeStructures,
          trashBin,
          academicYears,
          sections,
          teachers,
          classSubjectAssignments,
          teacherSubjectAssignments,
          classTeacherAssignments,
          examSubjectAssignments,
          promotionHistory
        }, {
          backupType: 'auto_interval',
          label: 'অটো ড্রাইভ ব্যাকআপ',
          token
        });
      } catch (e) {
        console.warn('[Google Drive Auto-Backup] Background task note:', e);
      }
    };

    const settings = getGoogleDriveBackupSettings();
    const intervalMs = Math.max(15, settings.intervalMinutes || 30) * 60 * 1000;
    const intervalId = setInterval(runDriveAutoBackup, intervalMs);

    return () => clearInterval(intervalId);
  }, [
    authUser,
    isAdmin,
    schoolProfile,
    students,
    classes,
    subjects,
    exams,
    marks,
    remarks,
    transactions,
    feeStructures,
    trashBin,
    academicYears,
    sections,
    teachers,
    classSubjectAssignments,
    teacherSubjectAssignments,
    classTeacherAssignments,
    examSubjectAssignments,
    promotionHistory
  ]);

  // Force Push/Pull functions
  const forcePushToCloud = async () => {
    setCloudStatus('syncing');
    try {
      const payload = {
        schoolProfile,
        students,
        subjects,
        teachers,
        classSubjectAssignments,
        teacherSubjectAssignments,
        classTeacherAssignments,
        exams,
        examSubjectAssignments,
        marks,
        remarks,
        classes,
        academicYears,
        sections,
        transactions,
        feeStructures,
        trashBin,
        promotionHistory,
        users,
        notices,
        updatedBy: currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'mehedihasansagor26@gmail.com',
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true });
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } catch (e: any) {
      setCloudStatus('error');
      console.warn('Force push error:', e?.message || e);
      throw e;
    }
  };

  const forcePullFromCloud = async () => {
    setCloudStatus('syncing');
    try {
      const snap = await getDoc(doc(db, 'institution', 'main_store'));
      if (snap.exists()) {
        hasLoadedRemoteRef.current = true;
        applyRemoteData(snap.data());
        setCloudStatus('connected');
        return snap.data();
      } else {
        setCloudStatus('connected');
        setCloudLastSynced('No Cloud Data Found');
        return null;
      }
    } catch (e: any) {
      setCloudStatus('error');
      console.warn('Force pull error:', e?.message || e);
      throw e;
    }
  };

  // Mode switching
  const setMode = (newMode: AppMode) => {
    // Mode can only be switched to 'admin' if user possesses verified Admin permissions
    if (newMode === 'admin' && !isAdmin) {
      setModeState('viewer');
      return;
    }
    setModeState(newMode);
    localStorage.setItem('madrasha_app_mode', newMode);
  };

  // Google Login Auth & Custom Claims Validation
  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setAuthUser(result.user);
        if (result.user.email) {
          setAdminEmail(result.user.email);
        }

        // Extract Google OAuth Access Token for Drive API operations
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedGoogleAccessToken(credential.accessToken);
        }

        // Force refresh ID token to get latest claims from backend
        const tokenResult = await result.user.getIdTokenResult(true);
        const claims = tokenResult.claims || {};
        const role = typeof claims.role === 'string' ? claims.role : null;
        const isOwnerAccount = (result.user.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
        const hasAdminAccess = role === 'admin' || isOwnerAccount;

        setAuthClaims(claims);
        setAuthRole(role || (isOwnerAccount ? 'admin' : null));
        setIsAdmin(hasAdminAccess);
        setModeState(hasAdminAccess ? 'admin' : 'viewer');

        if (hasAdminAccess) {
          try {
            const adminDocRef = doc(db, 'admins', result.user.uid);
            await setDoc(adminDocRef, {
              uid: result.user.uid,
              email: result.user.email,
              role: 'admin',
              lastActiveAt: new Date().toISOString()
            }, { merge: true });
          } catch (syncErr) {
            console.warn('Admin RBAC doc sync:', syncErr);
          }
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Google sign-in popup notice:', err);
      return false;
    }
  };

  // Refresh user ID token and claims
  const refreshAdminClaims = async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      setAuthClaims(null);
      setAuthRole(null);
      setModeState('viewer');
      return false;
    }
    try {
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      const claims = tokenResult.claims || {};
      const role = typeof claims.role === 'string' ? claims.role : null;
      const isOwnerAccount = (auth.currentUser.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
      const hasAdminAccess = role === 'admin' || isOwnerAccount;

      setAuthClaims(claims);
      setAuthRole(role || (isOwnerAccount ? 'admin' : null));
      setIsAdmin(hasAdminAccess);
      setModeState(hasAdminAccess ? 'admin' : 'viewer');
      return hasAdminAccess;
    } catch (e) {
      console.warn('Failed to refresh custom claims:', e);
      return false;
    }
  };

  // Email/Password Login
  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return { success: false, error: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন।' };
    }

    const isOwnerAccount = trimmedEmail.toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();

    // 1. Try Firebase Auth
    try {
      const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      if (result.user) {
        setAuthUser(result.user);
        if (result.user.email) setAdminEmail(result.user.email);
        localStorage.setItem('madrasha_active_auth_session', JSON.stringify({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          roleId: isOwnerAccount ? 'role_institution_admin' : 'role_teacher'
        }));
        return { success: true };
      }
    } catch (firebaseErr: any) {
      console.warn('Firebase signIn notice:', firebaseErr?.code, firebaseErr?.message);

      if (isOwnerAccount) {
        if (firebaseErr?.code === 'auth/user-not-found') {
          return {
            success: false,
            error: 'অ্যাডমিন অ্যাকাউন্টটি এখনও ফায়ারবেস অথেনটিকেশনে তৈরি করা হয়নি। ফায়ারবেস কনসোল (Firebase Console -> Authentication -> Users) থেকে "mehedihasansagor26@gmail.com" অ্যাকাউন্টটি তৈরি করুন অথবা অনুমোদিত গুগল সাইন-ইন ব্যবহার করুন।'
          };
        }
        return {
          success: false,
          error: (firebaseErr?.code === 'auth/invalid-credential' || firebaseErr?.code === 'auth/wrong-password')
            ? 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে। সঠিক পাসওয়ার্ড দিন অথবা গুগল দিয়ে লগইন করুন।'
            : (firebaseErr?.message || 'লগইন সম্পন্ন করা যায়নি। অনুগ্রহ করে গুগল সাইন-ইন ব্যবহার করুন।')
        };
      }
    }

    // 2. Check Database / Local Storage registered members (Non-admin local portal access)
    try {
      const allMembers = await getAllInstitutionMembers('inst_madrasah_primary');
      const member = allMembers.find(m => m.email.toLowerCase() === trimmedEmail.toLowerCase());

      if (member) {
        if (member.password && member.password !== password) {
          return { success: false, error: 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে।' };
        }

        // Local portal session only (Never synthetic authUser for cloud operations)
        setActiveAppUserId(member.uid);
        setCurrentMember(member);
        localStorage.setItem('madrasha_active_auth_session', JSON.stringify(member));
        return { success: true };
      }
    } catch (dbErr) {
      console.warn('Member lookup notice:', dbErr);
    }

    // 3. Check App Users (Admin, Principal, Teacher, Accountant, Guardian)
    const foundUser = users.find(u => 
      (u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase()) ||
      (u.phone && u.phone.trim() === trimmedEmail.trim())
    );

    if (foundUser) {
      if (foundUser.password && foundUser.password !== password) {
        return { success: false, error: 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে।' };
      }
      if (foundUser.status === 'blocked') {
        return { success: false, error: 'আপনার অ্যাকাউন্টটি স্থগিত (Blocked) করা হয়েছে।' };
      }

      setActiveAppUserId(foundUser.id);
      const isOwner = (foundUser.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
      const isAdministrative = foundUser.role === 'super_admin' || foundUser.role === 'principal' || isOwner;
      setIsAdmin(isAdministrative);
      setAuthRole(foundUser.role);
      setModeState(isAdministrative ? 'editor' : 'viewer');

      const memberRecord: InstitutionMember = {
        uid: foundUser.id,
        institutionId: 'inst_madrasah_primary',
        email: foundUser.email || `${foundUser.phone}@madrasha.local`,
        displayName: foundUser.nameBn || foundUser.name,
        roleId: `role_${foundUser.role}`,
        status: 'active',
        assignedClasses: foundUser.assignedClasses || [],
        assignedSubjects: foundUser.assignedSubjects || [],
        createdAt: foundUser.createdAt,
        updatedAt: new Date().toISOString()
      };
      setCurrentMember(memberRecord);

      if (foundUser.role === 'guardian') {
        setActiveTabState('guardian_portal');
      } else if (foundUser.role === 'teacher') {
        setActiveTabState('marks');
      } else if (foundUser.role === 'accountant') {
        setActiveTabState('finance');
      } else {
        setActiveTabState('dashboard');
      }

      localStorage.setItem('madrasha_active_app_user_id', foundUser.id);
      localStorage.setItem('madrasha_active_auth_session', JSON.stringify(memberRecord));
      return { success: true };
    }

    return { 
      success: false, 
      error: 'এই ইমেইল বা ফোন নম্বর দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে সঠিক তথ্য দিন।' 
    };
  };

  // Email/Password Register
  const signUpWithEmail = async (
    email: string, 
    password: string, 
    displayName: string, 
    requestedRole: string, 
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return { success: false, error: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন।' };
    }

    const isOwnerAccount = trimmedEmail.toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
    if (isOwnerAccount) {
      return {
        success: false,
        error: 'প্রধান অ্যাডমিন অ্যাকাউন্ট পাবলিক রেজিস্ট্রেশন থেকে তৈরি করা যাবে না। ফায়ারবেস কনসোল বা ট্রাস্টেড অ্যাডমিন এসডিকে (Firebase Console / Admin SDK) দিয়ে অ্যাকাউন্ট তৈরি করুন এবং সরাসরি সাইন-ইন ব্যবহার করুন।'
      };
    }

    // Check if already registered
    try {
      const allMembers = await getAllInstitutionMembers('inst_madrasah_primary');
      const existing = allMembers.find(m => m.email.toLowerCase() === trimmedEmail.toLowerCase());
      if (existing) {
        return { success: false, error: 'এই ইমেইল ঠিকানা দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে। লগইন করুন।' };
      }
    } catch (e) {}

    const uid = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    let defaultRole = 'role_teacher';
    if (requestedRole.toLowerCase().includes('account') || requestedRole.toLowerCase().includes('ক্যাশ')) {
      defaultRole = 'role_accountant';
    } else if (requestedRole.toLowerCase().includes('principal') || requestedRole.toLowerCase().includes('মুহতামিম')) {
      defaultRole = 'role_principal';
    } else if (requestedRole.toLowerCase().includes('staff') || requestedRole.toLowerCase().includes('অফিস')) {
      defaultRole = 'role_office_staff';
    } else if (requestedRole.toLowerCase().includes('guardian') || requestedRole.toLowerCase().includes('অভিভাবক')) {
      defaultRole = 'role_guardian';
    }

    const memberData: InstitutionMember = {
      uid,
      institutionId: 'inst_madrasah_primary',
      email: trimmedEmail,
      displayName,
      phone: phone || '',
      password, // securely stored for login validation
      roleId: defaultRole,
      requestedRole,
      status: 'pending',
      assignedClasses: [],
      assignedSubjects: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore and local storage
    try {
      await setInstitutionMember('inst_madrasah_primary', memberData, uid);
    } catch (e) {
      console.warn('setInstitutionMember fallback notice:', e);
    }

    // If teacher role, also register in academic teachers list
    if (defaultRole === 'role_teacher') {
      const academicTeacher: AcademicTeacher = {
        id: uid,
        institutionId: 'inst_madrasah_primary',
        name: displayName,
        nameBn: displayName,
        phone: phone || '',
        designation: requestedRole || 'সহকারী শিক্ষক',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      setTeachers(prev => {
        if (!prev.some(t => t.id === uid || (phone && t.phone === phone))) {
          const updated = [...prev, academicTeacher];
          localStorage.setItem('teachers', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }

    // Local membership application created (no elevated or remote admin privileges)
    setAuthUser(null);
    setAdminEmail(trimmedEmail);
    setIsAdmin(false);
    setAuthRole(memberData.roleId);
    setModeState('viewer');

    setCurrentMember(memberData);
    localStorage.setItem('madrasha_active_auth_session', JSON.stringify(memberData));

    return { success: true };
  };

  // Password Reset
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err: any) {
      console.warn('Password reset error:', err);
      return { success: false, error: err.message || 'পাসওয়ার্ড রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে।' };
    }
  };

  // Instant Demo Role Login (Simulation for reviewing/testing role features)
  const loginAsDemoRole = async (
    roleKey: 'superadmin' | 'principal' | 'teacher' | 'accountant' | 'office_staff' | 'guardian'
  ) => {
    const demoConfigs: Record<string, { email: string; name: string; roleId: string; classes?: string[]; subjects?: string[] }> = {
      superadmin: {
        email: 'mehedihasansagor26@gmail.com',
        name: 'মুহতামিম / অ্যাডমিন (ডেমো ভিউ)',
        roleId: 'role_institution_admin'
      },
      principal: {
        email: 'principal@madrasha.edu.bd',
        name: 'মুহতামিম মাওলানা আব্দুল করিম (ডেমো)',
        roleId: 'role_principal'
      },
      teacher: {
        email: 'teacher.mahmud@madrasha.edu.bd',
        name: 'মাওলানা মাহমুদুর রহমান (ডেমো উস্তাদ)',
        roleId: 'role_teacher',
        classes: ['cls_7', 'cls_8', '1', '2'],
        subjects: ['sub_math', 'sub_arabic']
      },
      accountant: {
        email: 'accountant.hafiz@madrasha.edu.bd',
        name: 'মুহাম্মদ হাফিজুর রহমান (ডেমো ক্যাশিয়ার)',
        roleId: 'role_accountant'
      },
      guardian: {
        email: 'guardian.rafiq@gmail.com',
        name: 'মো. রফিকুল ইসলাম (ডেমো অভিভাবক)',
        roleId: 'role_guardian'
      },
      office_staff: {
        email: 'staff.zahir@madrasha.edu.bd',
        name: 'মো. জহিরুল ইসলাম (ডেমো অফিস সহকারী)',
        roleId: 'role_office_staff'
      }
    };

    const target = demoConfigs[roleKey];
    if (!target) return;

    // Demo role preview is for local UI exploration only.
    // CRITICAL SECURITY RULE: Demo roles MUST NOT set authUser or grant remote Firestore admin privileges.
    setAuthUser(null);
    setAdminEmail(target.email);
    setIsAdmin(false);
    setAuthRole(target.roleId);
    setModeState('viewer');

    const memberRecord: InstitutionMember = {
      uid: `demo_${roleKey}_uid`,
      institutionId: 'inst_madrasah_primary',
      email: target.email,
      displayName: target.name,
      roleId: target.roleId,
      status: 'active',
      assignedClasses: target.classes || [],
      assignedSubjects: target.subjects || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCurrentMember(memberRecord);

    if (roleKey === 'guardian') {
      setActiveTabState('guardian_portal');
    } else if (roleKey === 'teacher') {
      setActiveTabState('teacher_portal');
    } else {
      setActiveTabState('dashboard');
    }
  };

  const logoutAdmin = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    clearCachedGoogleAccessToken();
    setIsAdmin(false);
    setAuthUser(null);
    setAuthClaims(null);
    setAuthRole(null);
    setCurrentMember(null);
    setCurrentRole(null);
    setModeState('viewer');
    setIsAuthReady(true);
    setActiveTabState('dashboard');
    setActiveAppUserId(null);
    localStorage.removeItem('madrasha_active_app_user_id');
    localStorage.removeItem('madrasha_active_auth_session');
    localStorage.setItem('madrasha_app_mode', 'viewer');
    localStorage.setItem('madrasha_active_tab', 'dashboard');
  };

  // State manipulation handlers
  const updateSchoolProfile = (profile: SchoolProfile) => {
    setSchoolProfile(profile);
    setExams(prev => prev.map(e => ({ ...e, academicYear: profile.academicYear })));
  };

  // Academic Structure handlers
  const addAcademicYear = (data: Omit<AcademicYear, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { academicYear } = buildCreateAcademicYearPayload(data, 'inst_madrasah_primary', actor, academicYears);
    if (academicYear) {
      if (academicYear.isCurrent) {
        const { updatedYears } = setCurrentAcademicYear([...academicYears, academicYear], academicYear.id, actor);
        setAcademicYears(updatedYears);
      } else {
        setAcademicYears(prev => [...prev, academicYear]);
      }
      if (authUser) {
        recordAcademicYearAuditEvent({
          action: 'ACADEMIC_YEAR_CREATED',
          academicYear,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const updateAcademicYear = (updated: AcademicYear) => {
    const existing = academicYears.find(y => y.id === updated.id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { academicYear } = buildUpdateAcademicYearPayload(existing, updated, actor, academicYears);
    setAcademicYears(prev => prev.map(y => y.id === updated.id ? academicYear : y));
    if (authUser) {
      recordAcademicYearAuditEvent({
        action: 'ACADEMIC_YEAR_UPDATED',
        academicYear,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: { name: existing.name, status: existing.status, isCurrent: existing.isCurrent }
      });
    }
  };

  const setActiveAcademicYear = (id: string) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { updatedYears, targetYear } = setCurrentAcademicYear(academicYears, id, actor);
    setAcademicYears(updatedYears);
    if (targetYear && authUser) {
      recordAcademicYearAuditEvent({
        action: 'ACADEMIC_YEAR_ACTIVATED',
        academicYear: targetYear,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const closeAcademicYearItem = (id: string) => {
    const existing = academicYears.find(y => y.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const closed = closeAcademicYear(existing, actor);
    setAcademicYears(prev => prev.map(y => y.id === id ? closed : y));
    if (authUser) {
      recordAcademicYearAuditEvent({
        action: 'ACADEMIC_YEAR_CLOSED',
        academicYear: closed,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const addClass = (name: string, nameBn?: string, details?: Partial<SchoolClass>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { schoolClass } = buildCreateClassPayload({
      name,
      nameBn,
      order: classes.length + 1,
      status: 'ACTIVE',
      ...details
    }, 'inst_madrasah_primary', actor, classes);

    const finalClass = schoolClass || ({ id: generateId(), name, nameBn, order: classes.length + 1, status: 'ACTIVE' } as SchoolClass);
    setClasses(prev => [...prev, finalClass]);
    if (authUser) {
      recordClassAuditEvent({
        action: 'CLASS_CREATED',
        schoolClass: finalClass,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const updateClass = (updatedClass: SchoolClass) => {
    const existing = classes.find(c => c.id === updatedClass.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { schoolClass } = existing 
      ? buildUpdateClassPayload(existing, updatedClass, actor, classes)
      : { schoolClass: updatedClass };
    setClasses(prev => prev.map(c => c.id === schoolClass.id ? schoolClass : c));
    if (authUser) {
      recordClassAuditEvent({
        action: 'CLASS_UPDATED',
        schoolClass,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, status: existing.status, order: existing.order } : null
      });
    }
  };

  const archiveClass = (id: string) => {
    const existing = classes.find(c => c.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveClassPayload(existing, actor);
    setClasses(prev => prev.map(c => c.id === id ? archived : c));
    if (authUser) {
      recordClassAuditEvent({
        action: 'CLASS_ARCHIVED',
        schoolClass: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const deleteClass = (id: string) => {
    const cls = classes.find(c => c.id === id);
    if (cls) {
      setTrashBin(prev => [{ id: generateId(), type: 'class', data: cls, deletedAt: new Date().toLocaleString() }, ...prev]);
      setClasses(prev => prev.filter(c => c.id !== id));
      if (authUser) {
        recordClassAuditEvent({
          action: 'CLASS_ARCHIVED',
          schoolClass: cls,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const addSection = (data: Omit<Section, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { section } = buildCreateSectionPayload(data, 'inst_madrasah_primary', actor, sections, classes);
    if (section) {
      setSections(prev => [...prev, section]);
      if (authUser) {
        recordSectionAuditEvent({
          action: 'SECTION_CREATED',
          section,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const updateSection = (updated: Section) => {
    const existing = sections.find(s => s.id === updated.id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { section } = buildUpdateSectionPayload(existing, updated, actor, sections, classes);
    setSections(prev => prev.map(s => s.id === updated.id ? section : s));
    if (authUser) {
      recordSectionAuditEvent({
        action: 'SECTION_UPDATED',
        section,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: { name: existing.name, classId: existing.classId, status: existing.status }
      });
    }
  };

  const archiveSection = (id: string) => {
    const existing = sections.find(s => s.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveSectionPayload(existing, actor);
    setSections(prev => prev.map(s => s.id === id ? archived : s));
    if (authUser) {
      recordSectionAuditEvent({
        action: 'SECTION_ARCHIVED',
        section: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const deleteSection = (id: string) => {
    const sec = sections.find(s => s.id === id);
    if (sec) {
      setTrashBin(prev => [{ id: generateId(), type: 'section' as any, data: sec, deletedAt: new Date().toLocaleString() }, ...prev]);
      setSections(prev => prev.filter(s => s.id !== id));
      if (authUser) {
        recordSectionAuditEvent({
          action: 'SECTION_ARCHIVED',
          section: sec,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const addStudent = (student: Omit<Student, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { student: newStudent } = buildCreateStudentPayload(student, 'inst_madrasah_primary', actor);
    const finalStudent = newStudent || ({ ...student, id: generateId() } as Student);
    setStudents(prev => [...prev, finalStudent]);
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_CREATED',
        student: finalStudent,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const updateStudent = (updatedStudent: Student) => {
    const existing = students.find(s => s.id === updatedStudent.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { student: finalStudent } = existing 
      ? buildUpdateStudentPayload(existing, updatedStudent, actor)
      : { student: updatedStudent };
    setStudents(prev => prev.map(s => s.id === finalStudent.id ? finalStudent : s));
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_UPDATED',
        student: finalStudent,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, classLevel: existing.classLevel, status: existing.status } : null
      });
    }
  };

  const deleteStudent = (id: string) => {
    const st = students.find(s => s.id === id);
    if (st) {
      setTrashBin(prev => [{ id: generateId(), type: 'student', data: st, deletedAt: new Date().toLocaleString() }, ...prev]);
      setStudents(prev => prev.filter(s => s.id !== id));
      if (authUser) {
        recordStudentAuditEvent({
          action: 'STUDENT_ARCHIVED',
          student: st,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const bulkPromoteStudents = async (
    updatedStudentsList: Student[],
    historyRecord: PromotionHistoryRecord
  ) => {
    setStudents(updatedStudentsList);
    setPromotionHistory(prev => [historyRecord, ...prev]);

    if (authUser) {
      recordPromotionAuditEvent({
        historyRecord,
        actor: {
          uid: authUser.uid,
          email: authUser.email || '',
          role: isSuperAdmin ? 'superadmin' : (authRole || 'admin')
        }
      });
    }
  };

  const clearPromotionHistory = () => {
    setPromotionHistory([]);
    localStorage.removeItem('madrasha_promotion_history');
  };

  const addSubject = (subject: Omit<Subject, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { subject: newSubject } = buildCreateSubjectPayload(subject, 'inst_madrasah_primary', actor, subjects);
    const finalSubject = newSubject || ({ ...subject, id: generateId() } as Subject);
    setSubjects(prev => [...prev, finalSubject]);
    if (authUser) {
      recordSubjectAuditEvent({
        action: 'SUBJECT_CREATED',
        subject: finalSubject,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const updateSubject = (updatedSubject: Subject) => {
    const existing = subjects.find(s => s.id === updatedSubject.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { subject: finalSubject } = existing
      ? buildUpdateSubjectPayload(existing, updatedSubject, actor, subjects)
      : { subject: updatedSubject };
    setSubjects(prev => prev.map(s => s.id === finalSubject.id ? finalSubject : s));
    if (authUser) {
      recordSubjectAuditEvent({
        action: 'SUBJECT_UPDATED',
        subject: finalSubject,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, code: existing.code, fullMarks: existing.fullMarks, status: existing.status } : null
      });
    }
  };

  const archiveSubject = (id: string) => {
    const existing = subjects.find(s => s.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveSubjectPayload(existing, actor);
    setSubjects(prev => prev.map(s => s.id === id ? archived : s));
    if (authUser) {
      recordSubjectAuditEvent({
        action: 'SUBJECT_ARCHIVED',
        subject: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const deleteSubject = (id: string) => {
    const sub = subjects.find(s => s.id === id);
    if (sub) {
      setTrashBin(prev => [{ id: generateId(), type: 'subject', data: sub, deletedAt: new Date().toLocaleString() }, ...prev]);
      setSubjects(prev => prev.filter(s => s.id !== id));
      if (authUser) {
        recordSubjectAuditEvent({
          action: 'SUBJECT_ARCHIVED',
          subject: sub,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  // Academic Teacher handlers
  const addTeacher = (teacherData: Omit<AcademicTeacher, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { teacher } = buildCreateTeacherPayload(teacherData, 'inst_madrasah_primary', actor, teachers);
    if (teacher) {
      setTeachers(prev => [...prev, teacher]);
      
      // Auto-sync into institution members store
      const memberData: InstitutionMember = {
        uid: teacher.id,
        institutionId: 'inst_madrasah_primary',
        email: teacher.phone ? `teacher.${teacher.phone.replace(/[^0-9]/g, '')}@madrasha.local` : `teacher.${teacher.id}@madrasha.local`,
        displayName: teacher.nameBn || teacher.name,
        phone: teacher.phone || '',
        roleId: 'role_teacher',
        requestedRole: teacher.designation || 'সহকারী শিক্ষক (Teacher)',
        status: teacher.status === 'ACTIVE' ? 'active' : 'inactive',
        assignedClasses: [],
        assignedSubjects: [],
        createdAt: teacher.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setInstitutionMember('inst_madrasah_primary', memberData, authUser?.uid || teacher.id).catch(() => {});

      if (authUser) {
        recordTeacherAuditEvent({
          action: 'TEACHER_CREATED',
          teacher,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const updateTeacher = (updatedTeacher: AcademicTeacher) => {
    const existing = teachers.find(t => t.id === updatedTeacher.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { teacher } = existing
      ? buildUpdateTeacherPayload(existing, updatedTeacher, actor, teachers)
      : { teacher: updatedTeacher };
    setTeachers(prev => prev.map(t => t.id === teacher.id ? teacher : t));
    if (authUser) {
      recordTeacherAuditEvent({
        action: 'TEACHER_UPDATED',
        teacher,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, designation: existing.designation, status: existing.status } : null
      });
    }
  };

  const archiveTeacher = (id: string) => {
    const existing = teachers.find(t => t.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveTeacherPayload(existing, actor);
    setTeachers(prev => prev.map(t => t.id === id ? archived : t));
    if (authUser) {
      recordTeacherAuditEvent({
        action: 'TEACHER_ARCHIVED',
        teacher: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  // Class-Subject Assignment handlers
  const assignSubjectToClass = (assignmentData: Omit<ClassSubjectAssignment, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { assignment } = buildCreateClassSubjectPayload(
      assignmentData,
      'inst_madrasah_primary',
      actor,
      classSubjectAssignments,
      classes,
      sections,
      subjects,
      academicYears
    );
    if (assignment) {
      setClassSubjectAssignments(prev => [...prev, assignment]);
      if (authUser) {
        recordClassSubjectAuditEvent({
          action: 'CLASS_SUBJECT_ASSIGNED',
          assignment,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const updateClassSubjectAssignment = (updated: ClassSubjectAssignment) => {
    const existing = classSubjectAssignments.find(a => a.id === updated.id);
    const now = new Date().toISOString();
    const finalAssignment: ClassSubjectAssignment = {
      ...updated,
      id: updated.id,
      updatedAt: now,
      updatedBy: authUser?.uid || 'system'
    };
    setClassSubjectAssignments(prev => prev.map(a => a.id === updated.id ? finalAssignment : a));
    if (authUser) {
      recordClassSubjectAuditEvent({
        action: 'CLASS_SUBJECT_UPDATED',
        assignment: finalAssignment,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { status: existing.status, order: existing.order } : null
      });
    }
  };

  const archiveClassSubjectAssignment = (id: string) => {
    const existing = classSubjectAssignments.find(a => a.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const archived: ClassSubjectAssignment = {
      ...existing,
      status: 'INACTIVE',
      updatedAt: now,
      updatedBy: authUser?.uid || 'system'
    };
    setClassSubjectAssignments(prev => prev.map(a => a.id === id ? archived : a));
    if (authUser) {
      recordClassSubjectAuditEvent({
        action: 'CLASS_SUBJECT_ARCHIVED',
        assignment: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  // Teacher-Subject Assignment handlers
  const assignTeacherToSubject = (assignmentData: Omit<TeacherSubjectAssignment, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { assignment } = buildCreateTeacherSubjectPayload(
      assignmentData,
      'inst_madrasah_primary',
      actor,
      teacherSubjectAssignments,
      teachers,
      subjects,
      classes,
      sections,
      academicYears
    );
    if (assignment) {
      setTeacherSubjectAssignments(prev => [...prev, assignment]);
      if (authUser) {
        recordTeacherSubjectAuditEvent({
          action: 'TEACHER_SUBJECT_ASSIGNED',
          assignment,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const updateTeacherSubjectAssignment = (updated: TeacherSubjectAssignment) => {
    const existing = teacherSubjectAssignments.find(a => a.id === updated.id);
    const now = new Date().toISOString();
    const finalAssignment: TeacherSubjectAssignment = {
      ...updated,
      id: updated.id,
      updatedAt: now,
      updatedBy: authUser?.uid || 'system'
    };
    setTeacherSubjectAssignments(prev => prev.map(a => a.id === updated.id ? finalAssignment : a));
    if (authUser) {
      recordTeacherSubjectAuditEvent({
        action: 'TEACHER_SUBJECT_UPDATED',
        assignment: finalAssignment,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { status: existing.status } : null
      });
    }
  };

  const archiveTeacherSubjectAssignment = (id: string) => {
    const existing = teacherSubjectAssignments.find(a => a.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const archived: TeacherSubjectAssignment = {
      ...existing,
      status: 'INACTIVE',
      updatedAt: now,
      updatedBy: authUser?.uid || 'system'
    };
    setTeacherSubjectAssignments(prev => prev.map(a => a.id === id ? archived : a));
    if (authUser) {
      recordTeacherSubjectAuditEvent({
        action: 'TEACHER_SUBJECT_ARCHIVED',
        assignment: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  // Class Teacher Assignment handlers
  const assignClassTeacher = (assignmentData: Omit<ClassTeacherAssignment, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { assignment } = buildCreateClassTeacherPayload(
      assignmentData,
      'inst_madrasah_primary',
      actor,
      classTeacherAssignments,
      teachers,
      classes,
      sections,
      academicYears
    );
    if (assignment) {
      setClassTeacherAssignments(prev => [...prev, assignment]);
    }
  };

  const archiveClassTeacherAssignment = (id: string) => {
    const existing = classTeacherAssignments.find(a => a.id === id);
    if (!existing) return;
    const now = new Date().toISOString();
    const archived: ClassTeacherAssignment = {
      ...existing,
      status: 'INACTIVE',
      updatedAt: now,
      updatedBy: authUser?.uid || 'system'
    };
    setClassTeacherAssignments(prev => prev.map(a => a.id === id ? archived : a));
  };

  // Marks handlers
  const updateMark = (markData: Omit<MarkRecord, 'id'> & { id?: string }) => {
    const existing = marks.find(m => m.studentId === markData.studentId && m.subjectId === markData.subjectId && m.examId === markData.examId);
    const sub = subjects.find(s => s.id === markData.subjectId);
    const exSub = examSubjectAssignments.find(es => es.examId === markData.examId && es.subjectId === markData.subjectId);
    const exam = exams.find(e => e.id === markData.examId);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;

    const { mark } = buildUpsertMarkPayload(markData, existing, sub, exSub, exam, actor);
    const finalMark = mark || ({ ...markData, id: generateId() } as MarkRecord);

    setMarks(prev => {
      const idx = prev.findIndex(m => m.studentId === finalMark.studentId && m.subjectId === finalMark.subjectId && m.examId === finalMark.examId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalMark;
        return next;
      }
      return [...prev, finalMark];
    });
  };

  const bulkUpdateMarks = (newMarks: (Omit<MarkRecord, 'id'> & { id?: string })[]) => {
    if (!newMarks || newMarks.length === 0) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;

    setMarks(prev => {
      const marksMap = new Map();
      prev.forEach(m => marksMap.set(`${m.studentId}-${m.subjectId}-${m.examId}`, m));

      newMarks.forEach(newData => {
        const key = `${newData.studentId}-${newData.subjectId}-${newData.examId}`;
        const existing = marksMap.get(key);
        const sub = subjects.find(s => s.id === newData.subjectId);
        const exSub = examSubjectAssignments.find(es => es.examId === newData.examId && es.subjectId === newData.subjectId);
        const exam = exams.find(e => e.id === newData.examId);

        const { mark } = buildUpsertMarkPayload(newData, existing, sub, exSub, exam, actor);
        const finalMark = mark || (existing ? { ...existing, ...newData } : { ...newData, id: generateId() } as MarkRecord);
        marksMap.set(key, finalMark);
      });

      return Array.from(marksMap.values());
    });

    if (authUser && newMarks.length > 0) {
      recordMarksAuditEvent({
        action: 'MARKS_UPDATED',
        examId: newMarks[0].examId,
        subjectId: newMarks[0].subjectId,
        classId: newMarks[0].classId,
        count: newMarks.length,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'teacher' }
      });
    }
  };

  // Exam handlers
  const addExam = (name: string, category: Exam['category'], nameBn?: string, details?: Partial<Exam>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { exam } = buildCreateExamPayload(
      {
        name,
        nameBn,
        category,
        academicYear: details?.academicYear || schoolProfile.academicYear || new Date().getFullYear().toString(),
        academicYearId: details?.academicYearId,
        classIds: details?.classIds || [],
        startDate: details?.startDate,
        endDate: details?.endDate,
        status: details?.status || 'SCHEDULED',
        contributions: details?.contributions,
        enableContributions: details?.enableContributions,
        description: details?.description
      },
      'inst_madrasah_primary',
      actor,
      exams,
      academicYears,
      classes
    );

    const finalExam = exam || ({
      id: generateId(),
      name,
      nameBn,
      category,
      academicYear: schoolProfile.academicYear,
      status: 'SCHEDULED',
      ...details
    } as Exam);

    setExams(prev => [...prev, finalExam]);
    if (authUser) {
      recordExamAuditEvent({
        action: 'EXAM_CREATED',
        exam: finalExam,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const updateExam = (updatedExam: Exam) => {
    const existing = exams.find(e => e.id === updatedExam.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { exam: finalExam } = existing
      ? buildUpdateExamPayload(existing, updatedExam, actor, exams, academicYears, classes)
      : { exam: updatedExam };
    setExams(prev => prev.map(e => e.id === finalExam.id ? finalExam : e));
    if (authUser) {
      recordExamAuditEvent({
        action: 'EXAM_UPDATED',
        exam: finalExam,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, status: existing.status } : null
      });
    }
  };

  const archiveExam = (id: string) => {
    const existing = exams.find(e => e.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveExamPayload(existing, actor);
    setExams(prev => prev.map(e => e.id === id ? archived : e));
    if (authUser) {
      recordExamAuditEvent({
        action: 'EXAM_ARCHIVED',
        exam: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const finalizeExam = (id: string) => {
    const existing = exams.find(e => e.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const finalized = buildFinalizeExamPayload(existing, actor);
    setExams(prev => prev.map(e => e.id === id ? finalized : e));
    if (authUser) {
      recordExamAuditEvent({
        action: 'EXAM_FINALIZED',
        exam: finalized,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const deleteExam = (id: string) => {
    const exam = exams.find(e => e.id === id);
    if (exam) {
      setTrashBin(prev => [{ id: generateId(), type: 'exam', data: exam, deletedAt: new Date().toLocaleString() }, ...prev]);
      setExams(prev => prev.filter(e => e.id !== id));
      if (authUser) {
        recordExamAuditEvent({
          action: 'EXAM_ARCHIVED',
          exam,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  // Exam Subject Assignment handlers
  const scheduleExamSubject = (assignmentData: Omit<ExamSubjectAssignment, 'id'>) => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { assignment } = buildCreateExamSubjectPayload(
      assignmentData,
      'inst_madrasah_primary',
      actor,
      examSubjectAssignments,
      exams,
      subjects,
      classes,
      sections,
      academicYears,
      classSubjectAssignments
    );
    if (assignment) {
      setExamSubjectAssignments(prev => [...prev, assignment]);
      if (authUser) {
        recordExamSubjectAuditEvent({
          action: 'EXAM_SUBJECT_ASSIGNED',
          assignment,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }
    }
  };

  const archiveExamSubject = (id: string) => {
    const existing = examSubjectAssignments.find(a => a.id === id);
    if (!existing) return;
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const archived = buildArchiveExamSubjectPayload(existing, actor);
    setExamSubjectAssignments(prev => prev.map(a => a.id === id ? archived : a));
    if (authUser) {
      recordExamSubjectAuditEvent({
        action: 'EXAM_SUBJECT_ARCHIVED',
        assignment: archived,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
  };

  const addTransaction = (txData: Omit<FinanceTransaction, 'id' | 'createdAt'>): FinanceTransaction => {
    const newTx: FinanceTransaction = {
      ...txData,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev]);
    return newTx;
  };

  const updateTransaction = (updatedTx: FinanceTransaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      setTrashBin(prev => [{ id: generateId(), type: 'transaction', data: tx, deletedAt: new Date().toLocaleString() }, ...prev]);
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const updateFeeStructure = (updatedStructure: ClassFeeStructure) => {
    setFeeStructures(prev => {
      const exists = prev.find(f => f.classLevel === updatedStructure.classLevel || f.id === updatedStructure.id);
      if (exists) {
        return prev.map(f => (f.classLevel === updatedStructure.classLevel || f.id === updatedStructure.id) ? updatedStructure : f);
      } else {
        return [...prev, { ...updatedStructure, id: generateId() }];
      }
    });
  };

  const restoreFromTrash = (trashId: string) => {
    const item = trashBin.find(t => t.id === trashId);
    if (!item) return;

    if (item.type === 'student') {
      setStudents(prev => [...prev, item.data]);
    } else if (item.type === 'subject') {
      setSubjects(prev => [...prev, item.data]);
    } else if (item.type === 'exam') {
      setExams(prev => [...prev, item.data]);
    } else if (item.type === 'class') {
      setClasses(prev => [...prev, item.data]);
    } else if (item.type === 'transaction') {
      setTransactions(prev => [item.data, ...prev]);
    }

    setTrashBin(prev => prev.filter(t => t.id !== trashId));
  };

  const permanentlyDeleteTrashItem = (trashId: string) => {
    setTrashBin(prev => prev.filter(t => t.id !== trashId));
  };

  const restoreAllFromTrash = () => {
    trashBin.forEach(item => {
      if (item.type === 'student') {
        setStudents(prev => [...prev, item.data]);
      } else if (item.type === 'subject') {
        setSubjects(prev => [...prev, item.data]);
      } else if (item.type === 'exam') {
        setExams(prev => [...prev, item.data]);
      } else if (item.type === 'class') {
        setClasses(prev => [...prev, item.data]);
      } else if (item.type === 'transaction') {
        setTransactions(prev => [item.data, ...prev]);
      }
    });
    setTrashBin([]);
  };

  const emptyTrash = () => {
    if (confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে রিসাইকেল বিন স্থায়ীভাবে খালি করতে চান?' : 'Are you sure you want to permanently empty recycle bin?')) {
      setTrashBin([]);
    }
  };

  const updateRemark = (studentId: string, examId: string, data: Partial<RemarkRecord>) => {
    setRemarks(prev => {
      const existing = prev.find(r => r.studentId === studentId && r.examId === examId);
      if (existing) {
        return prev.map(r => r.studentId === studentId && r.examId === examId ? { ...r, ...data } : r);
      } else {
        return [...prev, { studentId, examId, remark: '', ...data }];
      }
    });
  };

  const seedDemoMadrashaData = () => {
    const { sampleStudents, sampleSubjects, sampleMarks, sampleExams } = generateSampleMadrashaData(classes, exams);
    if (sampleExams && sampleExams.length > exams.length) {
      setExams(sampleExams);
    }
    setStudents(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const toAdd = sampleStudents.filter(s => !existingIds.has(s.id));
      return [...prev, ...toAdd];
    });
    setSubjects(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const toAdd = sampleSubjects.filter(s => !existingIds.has(s.id));
      return [...prev, ...toAdd];
    });
    setMarks(prev => {
      const existingKeys = new Set(prev.map(m => `${m.studentId}-${m.subjectId}-${m.examId}`));
      const toAdd = sampleMarks.filter(m => !existingKeys.has(`${m.studentId}-${m.subjectId}-${m.examId}`));
      return [...prev, ...toAdd];
    });
    const sampleFinance = generateSampleFinanceData(sampleStudents);
    setTransactions(prev => {
      if (prev.length === 0) return sampleFinance;
      const existingIds = new Set(prev.map(t => t.id));
      const toAdd = sampleFinance.filter(t => !existingIds.has(t.id));
      return [...toAdd, ...prev];
    });
  };

  const clearAllDemoData = async (): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Take safety snapshot before clearing
      try {
        const current = readCurrentLocalStoragePayload();
        await saveToIndexedDbVault(current, 'manual', 'ডেমো ডেটা মোছার পূর্ববর্তী ব্যাকআপ', 'Pre-Clear Safety Checkpoint');
      } catch (e) {
        console.warn('Pre-clear checkpoint snapshot:', e);
      }

      // 2. Clear state
      setStudents([]);
      setMarks([]);
      setRemarks([]);
      setTransactions([]);
      setPromotionHistory([]);
      setNotices([]);

      // 3. Clear localStorage items
      localStorage.setItem('students', JSON.stringify([]));
      localStorage.setItem('marks', JSON.stringify([]));
      localStorage.setItem('remarks', JSON.stringify([]));
      localStorage.setItem('transactions', JSON.stringify([]));
      localStorage.setItem('promotionHistory', JSON.stringify([]));
      localStorage.setItem('notices', JSON.stringify([]));

      // 4. Push clean state to Cloud Firestore
      try {
        const docRef = doc(db, 'institution', 'main_store');
        await setDoc(docRef, {
          students: [],
          marks: [],
          remarks: [],
          transactions: [],
          promotionHistory: [],
          notices: [],
          updatedAt: new Date().toISOString(),
          updatedBy: authUser?.email || adminEmail || 'mehedihasansagor26@gmail.com'
        }, { merge: true });
      } catch (err) {
        console.warn('Cloud clear notice:', err);
      }

      return {
        success: true,
        message: 'সকল ডেমো ডেটা সফলভাবে মুছে ফেলা হয়েছে! সিস্টেম এখন সম্পূর্ণ ফ্রেশ।'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'ডেমো ডেটা মুছতে ত্রুটি হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')
      };
    }
  };

  const isModuleEnabled = (module: ModuleKey): boolean => {
    return checkModuleEnabled(institutionConfig, module);
  };

  const getTerm = (term: TermKey): string => {
    return resolveTerm(institutionConfig, term, language === 'bn' ? 'bn' : 'en');
  };

  const setInstitutionType = (type: InstitutionType) => {
    setInstitutionTypeState(type);
    localStorage.setItem('institutionType', type);
    const newConfig = getDefaultInstitutionConfig(type);
    setInstitutionConfig(newConfig);
    localStorage.setItem('institutionConfig', JSON.stringify(newConfig));
  };

  const updateInstitutionConfig = (config: Partial<Institution>) => {
    setInstitutionConfig((prev) => {
      const updated = { ...prev, ...config, updatedAt: new Date().toISOString() };
      localStorage.setItem('institutionConfig', JSON.stringify(updated));
      return updated;
    });
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <AppContext.Provider value={{
      institutionConfig,
      institutionType,
      isModuleEnabled,
      getTerm,
      setInstitutionType,
      updateInstitutionConfig,
      schoolProfile,
      academicYears,
      sections,
      students,
      subjects,
      teachers,
      classSubjectAssignments,
      teacherSubjectAssignments,
      classTeacherAssignments,
      exams,
      examSubjectAssignments,
      marks,
      remarks,
      classes,
      transactions,
      feeStructures,
      language,
      trashBin,
      cloudStatus,
      cloudLastSynced,
      mode,
      isAdmin,
      authUser,
      authClaims,
      authRole,
      adminEmail,
      updateSchoolProfile,
      addAcademicYear,
      updateAcademicYear,
      setActiveAcademicYear,
      closeAcademicYear: closeAcademicYearItem,
      setAcademicYears,
      addSection,
      updateSection,
      archiveSection,
      deleteSection,
      setSections,
      archiveClass,
      addStudent,
      updateStudent,
      deleteStudent,
      addSubject,
      updateSubject,
      archiveSubject,
      deleteSubject,
      addTeacher,
      updateTeacher,
      archiveTeacher,
      setTeachers,
      assignSubjectToClass,
      updateClassSubjectAssignment,
      archiveClassSubjectAssignment,
      setClassSubjectAssignments,
      assignTeacherToSubject,
      updateTeacherSubjectAssignment,
      archiveTeacherSubjectAssignment,
      setTeacherSubjectAssignments,
      assignClassTeacher,
      archiveClassTeacherAssignment,
      setClassTeacherAssignments,
      updateMark,
      bulkUpdateMarks,
      addExam,
      updateExam,
      archiveExam,
      finalizeExam,
      deleteExam,
      scheduleExamSubject,
      archiveExamSubject,
      setExamSubjectAssignments,
      updateRemark,
      addClass,
      updateClass,
      deleteClass,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setTransactions,
      updateFeeStructure,
      setFeeStructures,
      restoreFromTrash,
      permanentlyDeleteTrashItem,
      restoreAllFromTrash,
      emptyTrash,
      bulkPromoteStudents,
      promotionHistory,
      clearPromotionHistory,
      notices,
      addNotice,
      updateNotice,
      deleteNotice,
      setNotices,
      togglePinNotice,
      setLanguage,
      setStudents,
      setSubjects,
      setClasses,
      setExams,
      setMarks,
      setRemarks,
      seedDemoMadrashaData,
      clearAllDemoData,
      loginWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      loginAsDemoRole,
      logoutAdmin,
      refreshAdminClaims,
      setMode,
      forcePushToCloud,
      forcePullFromCloud,
      isRecoveryModalOpen,
      setIsRecoveryModalOpen,
      isDataSecurityModalOpen,
      setIsDataSecurityModalOpen,
      isAuthReady,
      activeTab,
      setActiveTab,
      isSuperAdmin,
      authContext,
      hasPermission,
      currentRole,
      currentMember,
      institutionRoles,
      refreshInstitutionRoles,
      users,
      setUsers,
      currentUser,
      userRole,
      signUpUser,
      updateAppUser,
      deleteAppUser,
      loginWithEmailOrPhone,
      logoutUser,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
