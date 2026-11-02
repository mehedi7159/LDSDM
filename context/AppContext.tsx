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
  UserRole,
  StaffLeaveRecord
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
  getLastMembersSyncStatus,
  setInstitutionMember,
  deleteInstitutionMember,
  deleteInstitutionMembers,
  approveInstitutionMember
} from '../services/rbac';
import { generateId, deriveRoleFromDesignation } from '../services/utils';
import { signInGateForStatus } from '../services/staffRole';
import {
  normalizeRoleKey,
  bestDesignationRole,
  pickAuthoritativeUser,
  pickBestStaffRecord,
  effectiveRoleKeys,
  sanitizeAdditionalRoles,
  roleKeyToRoleId
} from '../services/roleResolution';
import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import type { FeeTypeDef } from '../services/feeTypes';
import { DEFAULT_FEE_TYPES, BANNER_CLASS_FEES, isUnmigratedLegacyPlayStructure } from '../services/feeTypes';
import {
  GOOGLE_PASSWORD_LOGIN_DENIED,
  GOOGLE_SIGNUP_EXISTING_MEMBER,
  approvalPasswordFor,
  buildGoogleSignupMember,
  googlePopupErrorMessage,
  isGoogleOnlyAccount
} from '../services/googleSignupRules';
import { buildMainStorePayload } from '../services/mainStorePayload';
import { buildPublicPortalData } from '../services/publicPortal';
import {
  dailyAttendanceService,
  DailyStudentAttendanceRecord,
  DailyStaffAttendanceRecord
} from '../services/dailyAttendanceService';
import { academicScheduleService } from '../services/academicScheduleService';
import type { ClassRoutineItem, SyllabusItem, AcademicCalendarEvent } from '../types/academic';
import { translations, Language } from '../services/translations';
import { generateSampleMadrashaData, generateSampleFinanceData, defaultFeeStructures } from '../services/sampleData';
import { db, auth, googleProvider, setCachedGoogleAccessToken, clearCachedGoogleAccessToken, getCachedGoogleAccessToken } from '../services/firebase';
import { provisionStaffFirebaseUser, createPrimaryFirebaseUser, isStaffProvisioningRole, shouldHealPortalLogin, resolveCredentialSyncNeed, getStaffCanonicalEmail } from '../services/staffProvisioning';
import { syncStaffCredentialToFirebase, type StaffCredentialSyncStatus } from '../services/staffCredentialSync';
import { doc, onSnapshot, setDoc, getDoc, collection } from 'firebase/firestore';
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
  recordStudentAuditEvent,
  hydrateStudentLifecycle
} from '../services/studentService';
import { confirmDeleteCloudSync } from '../services/staffDeletion';
import {
  writeAttendanceFieldToCloud,
  writeStaffAttendanceFieldToCloud,
  writeTransactionsFieldToCloud,
  writeMarksFieldToCloud,
  writeStudentsFieldToCloud,
  writeStudentDeleteFieldsToCloud,
  writeStaffFieldsToCloud,
  writeNoticesFieldToCloud,
  writeScheduleFieldsToCloud,
  writeStaffLeavesFieldToCloud,
  writeFeeStructuresFieldToCloud,
  writeFeeTypesFieldToCloud,
  confirmCloudWrite,
  ATTENDANCE_CLOUD_FAILURE_MESSAGE,
  FEE_CLOUD_FAILURE_MESSAGE,
  FEE_STRUCTURES_CLOUD_FAILURE_MESSAGE,
  FEE_TYPES_CLOUD_FAILURE_MESSAGE,
  MARKS_CLOUD_FAILURE_MESSAGE,
  STUDENTS_CLOUD_FAILURE_MESSAGE,
  STUDENT_DELETE_CLOUD_FAILURE_MESSAGE,
  STAFF_CLOUD_FAILURE_MESSAGE,
  NOTICES_CLOUD_FAILURE_MESSAGE,
  SCHEDULE_CLOUD_FAILURE_MESSAGE,
  LEAVE_CLOUD_FAILURE_MESSAGE,
  queuePendingConfirm,
  clearPendingConfirm,
  readPendingConfirms,
  type CloudConfirmResult,
} from '../services/cloudConfirm';
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
  // First main_store snapshot gate (Nov 2026 stale-flash fix): true once
  // the first main_store doc has been applied; StaffManager hides
  // localStorage-backed staff rows until then (or the timeout below).
  cloudHydrated: boolean;
  cloudHydrationTimedOut: boolean;
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
  isOwnerAdmin: boolean;
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
  addStudent: (student: Omit<Student, 'id'>) => { student: Student; students: Student[] };
  updateStudent: (student: Student) => { student: Student; students: Student[] };
  bulkUpdateStudents: (nextStudents: Student[]) => Student[];
  deleteStudent: (id: string) => { students: Student[]; trashBin: TrashItem[] } | null;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  updateSubject: (subject: Subject) => void;
  archiveSubject: (id: string) => void;
  deleteSubject: (id: string) => void;
  addTeacher: (teacher: Omit<AcademicTeacher, 'id'>, loginRole?: UserRole) => Promise<{ success: boolean; message?: string; provisioning?: 'synced' | 'skipped' | 'failed'; nextTeachers?: AcademicTeacher[]; nextUsers?: AppUser[] }>;
  updateTeacher: (teacher: AcademicTeacher, loginRole?: UserRole) => Promise<StaffCredentialSyncStatus & { nextTeachers?: AcademicTeacher[]; nextUsers?: AppUser[] }>;
  deleteTeacher: (teacherId: string) => Promise<{ success: boolean; message?: string }>;
  archiveTeacher: (id: string) => void;
  staffLeaves: StaffLeaveRecord[];
  setStaffLeaves: React.Dispatch<React.SetStateAction<StaffLeaveRecord[]>>;
  // Daily attendance + academic schedule slices. The local services
  // (dailyAttendanceService / academicScheduleService) remain the UI-facing
  // API; these mirrors exist so the data syncs via main_store and backups.
  dailyStudentAttendance: DailyStudentAttendanceRecord[];
  dailyStaffAttendance: DailyStaffAttendanceRecord[];
  classRoutines: ClassRoutineItem[];
  syllabusItems: SyllabusItem[];
  calendarEvents: AcademicCalendarEvent[];
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
  bulkUpdateMarks: (newMarks: (Omit<MarkRecord, 'id'> & { id?: string })[]) => MarkRecord[];
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
  confirmAttendanceCloudSync: () => Promise<CloudConfirmResult>;
  confirmStaffAttendanceCloudSync: () => Promise<CloudConfirmResult>;
  confirmFeeCloudSync: (nextTransactions?: FinanceTransaction[], failureMessage?: string) => Promise<CloudConfirmResult>;
  confirmMarksCloudSync: (nextMarks?: MarkRecord[]) => Promise<CloudConfirmResult>;
  confirmStudentsCloudSync: (nextStudents?: Student[]) => Promise<CloudConfirmResult>;
  confirmStudentDeleteCloudSync: (nextStudents?: Student[], nextTrashBin?: TrashItem[]) => Promise<CloudConfirmResult>;
  confirmStaffCloudSync: (nextTeachers?: AcademicTeacher[], nextUsers?: AppUser[]) => Promise<CloudConfirmResult>;
  confirmNoticesCloudSync: (nextNotices?: NoticeItem[]) => Promise<CloudConfirmResult>;
  confirmScheduleCloudSync: () => Promise<CloudConfirmResult>;
  confirmLeavesCloudSync: (nextLeaves?: StaffLeaveRecord[]) => Promise<CloudConfirmResult>;
  updateTransaction: (transaction: FinanceTransaction) => void;
  deleteTransaction: (id: string) => void;
  setTransactions: (transactions: FinanceTransaction[]) => void;
  updateFeeStructure: (structure: ClassFeeStructure) => void;
  setFeeStructures: (structures: ClassFeeStructure[]) => void;
  feeTypes: FeeTypeDef[];
  setFeeTypes: (types: FeeTypeDef[]) => void;
  updateFeeTypes: (types: FeeTypeDef[]) => void;
  confirmFeeStructuresCloudSync: (nextStructures?: ClassFeeStructure[]) => Promise<CloudConfirmResult>;
  confirmFeeTypesCloudSync: (nextTypes?: FeeTypeDef[]) => Promise<CloudConfirmResult>;
  addNotice: (notice: Omit<NoticeItem, 'id' | 'createdAt'>) => NoticeItem;
  updateNotice: (notice: NoticeItem) => NoticeItem;
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
  signUpWithGoogle: (requestedRole: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemoRole: (roleKey: 'superadmin' | 'principal' | 'teacher' | 'accountant' | 'office_staff' | 'guardian') => Promise<void>;
  logoutAdmin: () => Promise<void>;
  authDeniedMessage: string | null;
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
  /**
   * Multi-role support: the signed-in person's effective role keys —
   * primary role first, then additionalRoles (from the account, the
   * member document and the linked staff record), deduplicated.
   * Permissions are the union over this set.
   */
  effectiveRoles: UserRole[];
  currentMember: InstitutionMember | null;
  institutionRoles: CustomRole[];
  refreshInstitutionRoles: () => Promise<void>;
  pendingMembers: InstitutionMember[];
  refreshPendingMembers: () => Promise<void>;
  pendingMembersError: string | null;
  approveMember: (uid: string, roleId?: string, assignedClasses?: string[], assignedSubjects?: string[]) => Promise<{ success: boolean; message?: string; approvedTeacher?: AcademicTeacher; approvedUser?: AppUser }>;
  rejectMember: (uid: string) => Promise<{ success: boolean; message?: string }>;
  t: (key: keyof typeof translations['en']) => string;
}

// Login gate denial (Nov 2026 — delete-effective auth): shown when a
// Firebase account with no backing staff/user record tries to enter.
// The Firebase account itself survives deletion (no service account
// for true deletion yet), so the app session — not Firebase — is
// what this denies. Distinctive string, also used as a live marker.
const ACCOUNT_LOGIN_DENIED =
  'এই অ্যাকাউন্টটি আর সক্রিয় নেই — মুছে ফেলা হয়েছে বা নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।';

const defaultSchoolProfile: SchoolProfile = {
  name: 'MADRASHA MANAGEMENT HIGH SCHOOL',
  address: '123 Education Road, Dhaka, Bangladesh',
  phone: '+880 1234 567890',
  email: 'info@madrasha.edu.bd',
  academicYear: new Date().getFullYear().toString(),
  headMasterName: '',
  resultCardTemplate: 'Classic',
  showHeadmasterSignature: true,
  showGuardianSignature: true,
  // Anek Bangla is the system-wide Bengali font: numbers never clip and remain crystal-clear.
  banglaFont: 'Anek Bangla',
  banglaNumberFont: 'Anek Bangla',
  uiFont: 'Anek Bangla',
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
    phone: '',
    email: SUPER_ADMIN_EMAIL,
    role: 'super_admin',
    designation: 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন',
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
    const raw = saved ? JSON.parse(saved) : defaultSchoolProfile;
    return {
      ...raw,
      banglaFont: (!raw.banglaFont || raw.banglaFont === 'Hind Siliguri' || raw.banglaFont.includes('Noto')) ? 'Anek Bangla' : raw.banglaFont,
      banglaNumberFont: (!raw.banglaNumberFont || raw.banglaNumberFont === 'Hind Siliguri' || raw.banglaNumberFont.includes('Noto')) ? 'Anek Bangla' : raw.banglaNumberFont,
      uiFont: (!raw.uiFont || raw.uiFont === 'Hind Siliguri' || raw.uiFont.includes('Noto')) ? 'Anek Bangla' : raw.uiFont,
    };
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: Student) => !s?.id?.startsWith('demo-std-') && s?.id !== 'st-1' && s?.id !== 'st-2');
        }
      } catch {}
    }
    return [];
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('subjects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((sub: Subject) => !sub?.id?.startsWith('demo-sub-'));
        }
      } catch {}
    }
    return [];
  });

  // Staff leave records live in the shared store (and main_store) so every
  // device/admin sees the same data — previously they were kept only in one
  // browser's localStorage inside the Staff screen and never synced.
  const [staffLeaves, setStaffLeaves] = useState<StaffLeaveRecord[]>(() => {
    try {
      const saved = localStorage.getItem('madrasah_staff_leaves');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((l: any) => l?.id !== 'leave_1');
      }
    } catch {}
    return [];
  });
  // Fresh-reader for the leave cloud-confirm retry (same pattern as
  // transactionsRef): confirm functions run from effects whose closures
  // may hold stale state, so the retry reads through this ref instead.
  const staffLeavesRef = useRef<StaffLeaveRecord[]>([]);
  useEffect(() => {
    staffLeavesRef.current = staffLeaves;
  }, [staffLeaves]);

  // Daily attendance records (student + staff). Previously these lived ONLY
  // in dailyAttendanceService's localStorage on a single device — never in
  // the Firestore payload, never in backups. They are now mirrored here so
  // they sync through main_store like every other collection. The service
  // remains the write API for all attendance UI; a subscription effect
  // below keeps this state in step with every service write, and cloud
  // hydration pushes remote data back into the service (silently).
  const [dailyStudentAttendance, setDailyStudentAttendance] = useState<DailyStudentAttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('madrasah_daily_student_attendance');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return Object.values(parsed);
      }
    } catch {}
    return [];
  });

  const [dailyStaffAttendance, setDailyStaffAttendance] = useState<DailyStaffAttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('madrasah_daily_staff_attendance');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return Object.values(parsed);
      }
    } catch {}
    return [];
  });

  // Academic schedule slices (class routines, syllabus/lesson plans, annual
  // calendar). Same story as attendance: academicScheduleService kept them
  // in single-device localStorage only. Mirrored here for cloud sync; this
  // is also the data foundation for the future teacher routine view.
  const [classRoutines, setClassRoutines] = useState<ClassRoutineItem[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_academic_routines_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [syllabusItems, setSyllabusItems] = useState<SyllabusItem[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_academic_syllabus_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_academic_calendar_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
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
    // Also load teachers from institution members if not present —
    // ACTIVE members only (Phase 1): a pending applicant must never be
    // synthesized into a teacher entry, or signup would again leak
    // unapproved people into the teacher list.
    const membersSaved = localStorage.getItem('madrasha_institution_members');
    if (membersSaved) {
      try {
        const membersList: any[] = JSON.parse(membersSaved);
        membersList.forEach(m => {
          if (m && m.status === 'active' && (m.roleId === 'role_teacher' || m.requestedRole?.includes('শিক্ষক') || m.requestedRole?.includes('Teacher'))) {
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((m: MarkRecord) => !m?.id?.startsWith('demo-mark-'));
        }
      } catch {}
    }
    return [];
  });

  const [remarks, setRemarks] = useState<RemarkRecord[]>(() => {
    const saved = localStorage.getItem('remarks');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => {
    const saved = localStorage.getItem('madrasha_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t: FinanceTransaction) => !t?.id?.startsWith('tx-init-'));
        }
      } catch {}
    }
    return [];
  });

  // Fresh-reader for the fee cloud-confirm retry: confirm functions run
  // from effects whose closures may hold stale state, so the retry reads
  // through this ref instead of the render-time `transactions` value.
  const transactionsRef = useRef<FinanceTransaction[]>([]);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Fresh-readers for the Step 2 cloud-confirm retries (same pattern as
  // transactionsRef): save-time confirms pass explicit next-lists (state
  // has not landed yet), while the foreground/online/login retry reads
  // through these refs, which are fresh by then.
  const studentsRef = useRef<Student[]>([]);
  useEffect(() => { studentsRef.current = students; }, [students]);
  const marksRef = useRef<MarkRecord[]>([]);
  useEffect(() => { marksRef.current = marks; }, [marks]);
  const teachersRef = useRef<AcademicTeacher[]>([]);
  useEffect(() => { teachersRef.current = teachers; }, [teachers]);
  const trashBinRef = useRef<TrashItem[]>([]);
  useEffect(() => { trashBinRef.current = trashBin; }, [trashBin]);
  // noticesRef + usersRef live after their state declarations below
  // (notices/users state is declared after this block) — see below.

  const [feeStructures, setFeeStructures] = useState<ClassFeeStructure[]>(() => {
    const saved = localStorage.getItem('madrasha_fee_structures');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Fee types are DATA (2 Nov 2026): the setup page edits this list, and
  // adding a type needs no code change. Empty stored list = never
  // initialized -> seed defaults (there is no delete-type action).
  const [feeTypes, setFeeTypes] = useState<FeeTypeDef[]>(() => {
    const saved = localStorage.getItem('madrasha_fee_types');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_FEE_TYPES;
  });

  // Fresh-readers for the Fee Setup cloud-confirm retries (same pattern
  // as transactionsRef above; declared after the state they mirror).
  const feeStructuresRef = useRef<ClassFeeStructure[]>([]);
  useEffect(() => {
    feeStructuresRef.current = feeStructures;
  }, [feeStructures]);
  const feeTypesRef = useRef<FeeTypeDef[]>([]);
  useEffect(() => {
    feeTypesRef.current = feeTypes;
  }, [feeTypes]);

  const [promotionHistory, setPromotionHistory] = useState<PromotionHistoryRecord[]>(() => {
    const saved = localStorage.getItem('madrasha_promotion_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [notices, setNotices] = useState<NoticeItem[]>(() => {
    const saved = localStorage.getItem('madrasha_notices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((n: NoticeItem) => !n?.id?.startsWith('notice-urgent-') && !n?.id?.startsWith('notice-exam-') && !n?.id?.startsWith('notice-update-'));
        }
      } catch {}
    }
    return [];
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
    return newNotice;
  };

  const updateNotice = (updatedNotice: NoticeItem) => {
    // Truthful-save Step 2: return the stored object (with the fresh
    // updatedAt) so the caller confirms exactly what was saved.
    const stored: NoticeItem = { ...updatedNotice, updatedAt: new Date().toISOString() };
    setNotices(prev => prev.map(n => n.id === stored.id ? stored : n));
    return stored;
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

  // First main_store snapshot gate (Nov 2026 stale-flash fix):
  // cloudHydrated turns true when the first main_store getDoc/snapshot
  // is applied; cloudHydrationTimedOut turns true 6s after boot if no
  // snapshot landed (offline/slow network) so local data can render
  // WITH an explicit stale/offline label instead of blocking forever.
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [cloudHydrationTimedOut, setCloudHydrationTimedOut] = useState(false);
  
  // Auth state - Authoritative Firebase Auth & Custom Claims (Zero Trust in LocalStorage flags)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authClaims, setAuthClaims] = useState<Record<string, any> | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>(SUPER_ADMIN_EMAIL);
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
  const [currentMember, setCurrentMember] = useState<InstitutionMember | null>(null);

  const isSuperAdmin = isVerifiedSuperAdmin(authUser, authClaims);

  // Phase 2: the context never provided this — StaffManager and
  // Dashboard destructured it and silently got undefined, so every
  // "admin tier" check that relied on it fell through to the other
  // conditions. Defined here with the same rule other components
  // compute locally (super_admin, or the owner's email).
  const isOwnerAdmin = isSuperAdmin || (authUser?.email || adminEmail || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // NOTE: `currentRole`, `authContext` and `hasPermission` are derived
  // further below, immediately after `currentUser` is computed — role
  // resolution must read the signed-in account (built from `users`
  // state), and the account is authoritative over the member document
  // (see services/roleResolution.ts for the precedence rules).

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

  // Pending Institution Members State & Actions
  const [pendingMembers, setPendingMembers] = useState<InstitutionMember[]>([]);

  // Pending-applicant list error state (Phase 1): getAllInstitutionMembers
  // never throws — on Firestore timeout it silently returns the local
  // cache. The UI must therefore distinguish "no applicants" from
  // "update failed, showing stale cache", never silently cache-only.
  const [pendingMembersError, setPendingMembersError] = useState<string | null>(null);
  const refreshPendingMembers = async () => {
    try {
      const all = await getAllInstitutionMembers('inst_madrasah_primary');
      const pending = all.filter(m => m.status === 'pending');
      setPendingMembers(pending);
      // Firestore leg timed out or errored: the list above is local
      // cache only — say so instead of presenting it as fresh.
      if (!getLastMembersSyncStatus().cloudOk) {
        setPendingMembersError('অনুমোদনের তালিকা আপডেট হয়নি — পুরনো তালিকা দেখানো হচ্ছে।');
      } else {
        setPendingMembersError(null);
      }
    } catch (err) {
      console.warn('Pending members fetch error:', err);
      setPendingMembersError('অনুমোদনের তালিকা আপডেট হয়নি — পুরনো তালিকা দেখানো হচ্ছে।');
    }
  };

  useEffect(() => {
    refreshPendingMembers();
  }, [authUser]);

  // Live pending-applicant feed (Phase 1): the codebase already uses
  // onSnapshot for main_store/public_portal, so members get the same
  // treatment — any approval, rejection or new application refreshes
  // the pending list without waiting for a remount. The refresh itself
  // merges local cache + Firestore, so local-only applications are
  // never dropped by a Firestore-only snapshot.
  useEffect(() => {
    const membersCol = collection(db, 'institutions', 'inst_madrasah_primary', 'members');
    const unsubscribe = onSnapshot(
      membersCol,
      () => { refreshPendingMembers(); },
      (err) => {
        console.warn('Members snapshot listener notice:', err?.message || err);
        setPendingMembersError('অনুমোদনের তালিকা আপডেট হয়নি — পুরনো তালিকা দেখানো হচ্ছে।');
      }
    );
    return () => { try { unsubscribe(); } catch {} };
    // Intentionally once: refreshPendingMembers only reads stable
    // imports + setters, so the closure never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveMember = async (
    uid: string, 
    roleId?: string, 
    assignedClasses: string[] = [], 
    assignedSubjects: string[] = []
  ): Promise<{ success: boolean; message?: string; approvedTeacher?: AcademicTeacher; approvedUser?: AppUser }> => {
    try {
      const all = await getAllInstitutionMembers('inst_madrasah_primary');
      const target = all.find(m => m.uid === uid);
      const effectiveRole = roleId || target?.roleId || 'role_teacher';
      const actorUid = authUser?.uid || 'admin';

      await approveInstitutionMember(
        'inst_madrasah_primary',
        uid,
        effectiveRole,
        assignedClasses,
        assignedSubjects,
        actorUid
      );

      // If current member was this user, update active state
      if (currentMember?.uid === uid) {
        setCurrentMember(prev => prev ? { ...prev, status: 'active', roleId: effectiveRole } : null);
      }

      // Update in users state
      const cleanRole: UserRole = (effectiveRole.replace('role_', '')) as UserRole;
      // Approval cloud-confirm (rank #1 fix, 31 Oct 2026): the caller
      // confirms these exact records into main_store. The old code
      // confirmed map-only lists built from stale closure state, so a
      // member-only applicant was absent from both lists and the
      // confirm "succeeded" while cloud never received the records.
      // These records mirror the local-state updaters below (same
      // predicates, same construction, same Google-only password rule
      // — never a stamped '123456').
      const foundApprovedUser = users.find(u => u.id === uid || (target?.email && u.email?.toLowerCase() === target.email.toLowerCase()));
      let approvedUser: AppUser | undefined;
      if (foundApprovedUser) {
        approvedUser = {
          ...foundApprovedUser,
          status: 'active',
          role: cleanRole,
          assignedClasses: assignedClasses.length > 0 ? assignedClasses : foundApprovedUser.assignedClasses
        };
      } else if (target) {
        const approvedGoogleOnly = isGoogleOnlyAccount(target);
        const approvedPassword = approvalPasswordFor(target);
        approvedUser = {
          id: target.uid,
          name: target.displayName || 'User',
          nameBn: target.displayName || 'ব্যবহারকারী',
          phone: target.phone || '',
          email: target.email || undefined,
          ...(approvedGoogleOnly ? { authProvider: 'google' as const } : {}),
          ...(approvedPassword !== undefined ? { password: approvedPassword } : {}),
          role: cleanRole,
          assignedClasses,
          status: 'active',
          createdAt: target.createdAt || new Date().toISOString()
        };
      }
      let approvedTeacher: AcademicTeacher | undefined;
      if (cleanRole === 'teacher' && target) {
        const existsApprovedTeacher = teachers.find(t => t.id === uid || (target.email && t.email?.toLowerCase() === target.email.toLowerCase()) || (target.phone && t.phone === target.phone));
        if (existsApprovedTeacher) {
          approvedTeacher = { ...existsApprovedTeacher, status: 'ACTIVE' as const, assignedClasses };
        } else {
          const approvedTeacherGoogleOnly = isGoogleOnlyAccount(target);
          const approvedTeacherPassword = approvalPasswordFor(target);
          approvedTeacher = {
            id: uid,
            institutionId: 'inst_madrasah_primary',
            name: target.displayName || 'Teacher',
            nameBn: target.displayName || 'শিক্ষক',
            phone: target.phone || '',
            email: target.email,
            ...(approvedTeacherGoogleOnly ? { authProvider: 'google' as const } : {}),
            ...(approvedTeacherPassword !== undefined ? { password: approvedTeacherPassword } : {}),
            designation: target.requestedRole || 'সহকারী শিক্ষক',
            status: 'ACTIVE',
            assignedClasses,
            assignedSubjects,
            createdAt: target.createdAt || new Date().toISOString()
          };
        }
      }
      setUsers(prev => {
        const found = prev.find(u => u.id === uid || (target?.email && u.email?.toLowerCase() === target.email.toLowerCase()));
        if (found) {
          return prev.map(u => (u.id === found.id) ? {
            ...u,
            status: 'active',
            role: cleanRole,
            assignedClasses: assignedClasses.length > 0 ? assignedClasses : u.assignedClasses
          } : u);
        }
        if (target) {
          // Google-only members must NEVER get the legacy '123456'
          // fallback: a stamped default password would open portal
          // password-login for an account that was never given one.
          const googleOnly = isGoogleOnlyAccount(target);
          const approvalPassword = approvalPasswordFor(target);
          const newUser: AppUser = {
            id: target.uid,
            name: target.displayName || 'User',
            nameBn: target.displayName || 'ব্যবহারকারী',
            phone: target.phone || '',
            email: target.email || undefined,
            ...(googleOnly ? { authProvider: 'google' as const } : {}),
            ...(approvalPassword !== undefined ? { password: approvalPassword } : {}),
            role: cleanRole,
            assignedClasses,
            status: 'active',
            createdAt: target.createdAt || new Date().toISOString()
          };
          return [newUser, ...prev];
        }
        return prev;
      });

      // If teacher, ensure present and ACTIVE in academic teachers list
      if (cleanRole === 'teacher' && target) {
        // Same Google-only rule as the account record above: no
        // stamped '123456' password for Google-only members.
        const teacherGoogleOnly = isGoogleOnlyAccount(target);
        const teacherApprovalPassword = approvalPasswordFor(target);
        setTeachers(prev => {
          const exists = prev.find(t => t.id === uid || (target.email && t.email?.toLowerCase() === target.email.toLowerCase()) || (target.phone && t.phone === target.phone));
          if (exists) {
            const updated = prev.map(t => t.id === exists.id ? { ...t, status: 'ACTIVE' as const, assignedClasses } : t);
            try { localStorage.setItem('teachers', JSON.stringify(updated)); } catch (e) {}
            return updated;
          } else {
            const newT: AcademicTeacher = {
              id: uid,
              institutionId: 'inst_madrasah_primary',
              name: target.displayName || 'Teacher',
              nameBn: target.displayName || 'শিক্ষক',
              phone: target.phone || '',
              email: target.email,
              ...(teacherGoogleOnly ? { authProvider: 'google' as const } : {}),
              ...(teacherApprovalPassword !== undefined ? { password: teacherApprovalPassword } : {}),
              designation: target.requestedRole || 'সহকারী শিক্ষক',
              status: 'ACTIVE',
              assignedClasses,
              assignedSubjects,
              createdAt: target.createdAt || new Date().toISOString()
            };
            const updated = [newT, ...prev];
            try { localStorage.setItem('teachers', JSON.stringify(updated)); } catch (e) {}
            return updated;
          }
        });
      }

      await refreshPendingMembers();
      return { success: true, message: 'সফলভাবে অ্যাকাউন্ট অনুমোদন ও সক্রিয় করা হয়েছে!', approvedTeacher, approvedUser };
    } catch (e: any) {
      console.error('Approve error:', e);
      return { success: false, message: e.message || 'অনুমোদন সম্পন্ন করা যায়নি।' };
    }
  };

  const rejectMember = async (uid: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await deleteInstitutionMember('inst_madrasah_primary', uid);
      setUsers(prev => prev.filter(u => u.id !== uid));
      setTeachers(prev => prev.filter(t => t.id !== uid));
      await refreshPendingMembers();
      return { success: true, message: 'আবেদনটি বাতিল করা হয়েছে।' };
    } catch (e: any) {
      return { success: false, message: e.message || 'বাতিল করা যায়নি।' };
    }
  };

  // App Users State & Persistence (excluding demo accounts)
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('madrasha_app_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(u =>
            !u.id.startsWith('user_teacher_') &&
            !u.id.startsWith('user_acc_') &&
            !u.id.startsWith('user_staff_') &&
            !u.id.startsWith('user_guardian_') &&
            !u.id.startsWith('user_principal_') &&
            !Boolean(u.email && u.email.includes('madrasha.local'))
          );
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch (e) {}
    return defaultAppUsers;
  });

  useEffect(() => {
    try {
      localStorage.setItem('madrasha_app_users', JSON.stringify(users));
    } catch (e) {}
  }, [users]);

  // Step 2 fresh-readers (declared here because notices/users state is
  // declared after the transactionsRef block above).
  const noticesRef = useRef<NoticeItem[]>([]);
  useEffect(() => { noticesRef.current = notices; }, [notices]);
  const usersRef = useRef<AppUser[]>([]);
  useEffect(() => { usersRef.current = users; }, [users]);

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
      const isOwnerAccount = (authUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const realDisplayName = authUser.displayName || (isOwnerAccount ? 'Mehedi Hasan Sagor' : (authUser.email?.split('@')[0] || 'User'));
      const realDisplayNameBn = authUser.displayName || (isOwnerAccount ? 'মেহেদী হাসান সাগর' : (authUser.email?.split('@')[0] || 'ব্যবহারকারী'));

      // Among duplicate account records for the same person, the
      // Firebase-uid-linked record wins; otherwise the authoritative
      // (non-teacher-stamped) record wins — never plain array order, so
      // a leftover teacher duplicate cannot shadow the real account
      // (see services/roleResolution.ts).
      const found =
        users.find(u => u.id === authUser.uid) ||
        pickAuthoritativeUser<AppUser>(
          users.filter(u => u.email && authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase())
        );
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
      // No users[] account for this Firebase user (e.g. deleted in the
      // 29 Oct incident) — fall back to the linked teacher record's
      // designation, exactly like the loginWithEmailOrPhone heal, instead
      // of stamping every unmatched Firebase login as 'teacher' (which
      // put the principal behind the mobile-only gate on desktop).
      const linkedTeacherForAuth = pickBestStaffRecord<AcademicTeacher>(
        teachers.filter(t => t.email && authUser.email && t.email.toLowerCase() === authUser.email.toLowerCase())
      );
      const mappedRole: UserRole = isSuperAdmin
        ? 'super_admin'
        : linkedTeacherForAuth
          ? deriveRoleFromDesignation(linkedTeacherForAuth.designation)
          : (authRole === 'principal' ? 'principal' : authRole === 'accountant' ? 'accountant' : authRole === 'guardian' ? 'guardian' : authRole === 'staff' ? 'staff' : 'teacher');
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
  }, [users, activeAppUserId, authUser, currentMember, isSuperAdmin, authRole, teachers]);

  const userRole: UserRole | null = currentUser?.role || (authRole as UserRole) || null;

  // ------------------------------------------------------------------
  // Role resolution — precedence (see services/roleResolution.ts):
  //   (a) the logged-in account's own stored role is authoritative;
  //   (b) then the member document's roleId;
  //   (c) then the auth-claims role.
  // The member document NO LONGER outranks the account: a stale
  // 'role_teacher' member doc used to shadow an accountant account in
  // the CustomRole layer (and in the mobile app's role pick).
  //
  // Multi-role: effectiveRoles = primary + additionalRoles gathered
  // from the account, the member document and the linked staff record.
  // Permissions below are the UNION over this set; a single-role user
  // gets exactly the historical outcomes (scripts/test-rbac-multirole.ts
  // proves it against the Phase-6 equivalence matrix).
  // ------------------------------------------------------------------
  const primaryRoleKey: UserRole | null =
    normalizeRoleKey(currentUser?.role) ||
    normalizeRoleKey(currentMember?.roleId) ||
    normalizeRoleKey(authRole as string) ||
    null;

  // The staff record describing the signed-in person (id / userId /
  // email / phone linkage — the same linkage the staff directory uses).
  // When duplicates match, the record whose designation names the
  // strongest (non-teacher) role wins.
  const linkedStaffRecord = React.useMemo(() => {
    const email = (currentUser?.email || authUser?.email || '').toLowerCase();
    const phone = currentUser?.phone || currentMember?.phone || '';
    const matches = teachers.filter(t =>
      (currentUser?.id && (t.id === currentUser.id || t.userId === currentUser.id)) ||
      (email !== '' && t.email && t.email.toLowerCase() === email) ||
      (phone !== '' && t.phone && t.phone === phone)
    );
    return pickBestStaffRecord<AcademicTeacher>(matches);
  }, [teachers, currentUser, currentMember, authUser]);

  const effectiveRoles: UserRole[] = React.useMemo(
    () =>
      effectiveRoleKeys(primaryRoleKey, [
        currentUser?.additionalRoles,
        (currentMember?.additionalRoleIds || []).map(id => normalizeRoleKey(id)),
        (linkedStaffRecord?.additionalRoles || []) as (string | null | undefined)[]
      ]),
    [primaryRoleKey, currentUser, currentMember, linkedStaffRecord]
  );

  const resolveRoleDocForKey = (key: UserRole | null): CustomRole | null => {
    if (!key || institutionRoles.length === 0) return null;
    const alias = key === 'staff' ? 'office_staff' : key === 'guardian' ? 'parent' : null;
    return (
      institutionRoles.find(r => r.id === roleKeyToRoleId(key)) ||
      (alias ? institutionRoles.find(r => r.id === roleKeyToRoleId(alias)) : undefined) ||
      institutionRoles.find(r => r.name === key || (alias !== null && r.name === alias)) ||
      null
    );
  };

  // The primary role's CustomRole document. Falls back to the member
  // document's exact role id so institution-custom roles (whose ids do
  // not follow the role_<key> pattern) keep resolving as before.
  const currentRole: CustomRole | null = React.useMemo(() => {
    const byAccount = resolveRoleDocForKey(primaryRoleKey);
    if (byAccount) return byAccount;
    if (currentMember?.roleId && institutionRoles.length > 0) {
      return institutionRoles.find(r => r.id === currentMember.roleId) || null;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionRoles, primaryRoleKey, currentMember]);

  const additionalRoleDocs: CustomRole[] = React.useMemo(() => {
    const docs: CustomRole[] = [];
    for (const key of effectiveRoles) {
      if (key === primaryRoleKey) continue;
      const doc = resolveRoleDocForKey(key);
      if (doc && doc.id !== currentRole?.id && !docs.some(d => d.id === doc.id)) {
        docs.push(doc);
      }
    }
    return docs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRoles, primaryRoleKey, institutionRoles, currentRole]);

  const authContext: AuthorizationContext = buildAuthorizationContext(
    authUser,
    authClaims,
    currentMember,
    currentRole,
    'inst_madrasah_primary',
    additionalRoleDocs.length > 0 ? additionalRoleDocs : undefined
  );

  // The canonical hardcoded per-role grant branches (verbatim from the
  // pre-multi-role hasPermission). Returns true only on a grant.
  const hardcodedBranchGrants = (role: string | null | undefined, permission: Permission): boolean => {
    const key = normalizeRoleKey(role) || role;
    if (key === 'accountant') {
      if (permission.startsWith('finance.') || permission.startsWith('fees.') || permission.startsWith('payments.')) return true;
      if (permission === 'reports.view' || permission === 'students.view') return true;
    }
    if (key === 'teacher') {
      if (permission.startsWith('attendance.') || permission.startsWith('marks.') || permission.startsWith('subjects.')) return true;
      if (permission === 'reports.view' || permission === 'students.view') return true;
    }
    if (key === 'guardian') {
      if (permission === 'students.view' || permission === 'marks.view' || permission === 'attendance.view' || permission === 'fees.view') return true;
    }
    return false;
  };

  const hasPermission = (
    permission: Permission,
    scope?: { classId?: string; subjectId?: string; studentId?: string }
  ): boolean => {
    const isOwner = (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isSuperAdmin || isOwner || isAdmin || currentUser?.role === 'super_admin') {
      return true;
    }

    // The historical primary-role expression (kept verbatim so the
    // single-role path is untouched).
    const effectiveRole = currentUser?.role || currentMember?.roleId?.replace('role_', '') || userRole;

    // Phase 6 (RBAC Option A): the principal veto is a DENY, not a
    // grant — evaluated before every grant layer. Multi-role: holding
    // principal in ANY slot keeps the veto (system.backup /
    // system.audit stay denied to principals), while the owner /
    // super-admin short-circuit above still outranks it, as before.
    if (
      (effectiveRole === 'principal' || effectiveRoles.includes('principal')) &&
      (permission === 'system.backup' || permission === 'system.audit')
    ) {
      return false;
    }

    // Phase 6 precedence: the CustomRole layer first — now built from
    // the UNION of all effective roles' documents (for a single-role
    // user this context is identical to the historical one).
    if (checkPermission(authContext, permission, scope)) {
      return true;
    }

    // Hardcoded fallback branches — granted when ANY effective role's
    // branch grants (for a single-role user, just the primary branch,
    // exactly as before; the principal branch grants everything that
    // survived the veto).
    const rolesToTry: Array<string | null | undefined> =
      effectiveRoles.length > 0 ? effectiveRoles : [effectiveRole];
    for (const roleKey of rolesToTry) {
      if (normalizeRoleKey(roleKey) === 'principal') return true;
      if (hardcodedBranchGrants(roleKey, permission)) return true;
    }

    return false;
  };

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

    // Also block signups that collide with an admin-created staff record —
    // otherwise the same person ends up with two parallel accounts
    // (one in users, one in teachers) and login picks whichever matches first.
    const existingStaff = teachers.find(t =>
      (cleanPhone && t.phone && t.phone.trim() === cleanPhone) ||
      (cleanEmail && t.email && t.email.trim().toLowerCase() === cleanEmail)
    );
    if (existingStaff) {
      return {
        success: false,
        message: 'এই মোবাইল নম্বর অথবা ইমেইল দিয়ে স্টাফ তালিকায় ইতোমধ্যে একটি অ্যাকাউন্ট আছে। নতুন সাইনআপ না করে অ্যাডমিনের সাথে যোগাযোগ করুন।'
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
    const targetUser = users.find(u => u.id === userId);
    const email = (targetUser?.email || '').toLowerCase();
    // Phase 2 parity with deleteTeacher: the same narrowed guard
    // (owner record or own record only) — the old version had NO
    // guard at all, so routing a guarded record here deleted it.
    const adminUid = authUser?.uid;
    const adminIsOwner = (authUser?.email || adminEmail || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isOwnerTarget = email !== '' && email === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isOwnerTarget || (adminUid && userId === adminUid && adminIsOwner)) {
      return { success: false, message: 'এটা মালিকের অ্যাকাউন্ট, মোছা যাবে না।' };
    }
    if (adminUid && userId === adminUid) {
      return { success: false, message: 'নিজের অ্যাকাউন্ট এখান থেকে মোছা যাবে না।' };
    }
    // Id/email link only (never phone) — the linked staff record is
    // removed too, otherwise the login fallback rebuilds this account
    // from the teachers list on the next sign-in.
    const remainingUsers = users.filter(u => u.id !== userId);
    const remainingTeachers = teachers.filter(t =>
      t.id !== userId &&
      !(email !== '' && (t.email || '').toLowerCase() === email)
    );
    setUsers(remainingUsers);
    setTeachers(remainingTeachers);
    // Awaited cloud confirm (was: unconditional success while the
    // write lived in the debounced auto-sync).
    const cloudSync = await confirmDeleteCloudSync(() =>
      setDoc(doc(db, 'institution', 'main_store'), {
        teachers: remainingTeachers,
        users: remainingUsers,
        updatedBy: currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'system_user',
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    );
    if (!cloudSync.success) {
      setCloudStatus('error');
      return { success: false, message: cloudSync.message };
    }
    setCloudStatus('connected');
    setCloudLastSynced(new Date().toLocaleTimeString());
    // Member cleanup AFTER the cloud confirm, honestly reported.
    const memberRes = await deleteInstitutionMembers('inst_madrasah_primary', [userId]);
    try { await refreshPendingMembers(); } catch {}
    if (!memberRes.ok) {
      return { success: true, message: 'ব্যবহারকারী ডিলিট হয়েছে। তবে member তথ্য মোছা যায়নি — আবার চেষ্টা করুন।' };
    }
    return { success: true, message: 'ব্যবহারকারী সফলভাবে ডিলিট হয়েছে।' };
  };

  const loginWithEmailOrPhone = async (
    identifier: string, 
    password: string
  ): Promise<{ success: boolean; message?: string; user?: AppUser }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // Duplicate-safe: when several account records match the identifier
    // (a leftover teacher-stamped duplicate next to the real account),
    // the authoritative non-teacher record wins — never plain array
    // order (see services/roleResolution.ts).
    let user = pickAuthoritativeUser<AppUser>(users.filter(u =>
      (u.phone && u.phone.trim() === cleanId) ||
      (u.email && u.email.trim().toLowerCase() === cleanId)
    ));

    // If not found in users, check academic teachers (added by admin).
    // Same duplicate rule for staff records: the record whose
    // designation names a non-teacher role (e.g. the real Accountant
    // record) beats a plain-teacher duplicate, in any order.
    if (!user) {
      const teacher = pickBestStaffRecord<AcademicTeacher>(teachers.filter(t =>
        (t.phone && t.phone.trim() === cleanId) ||
        (t.email && t.email.trim().toLowerCase() === cleanId)
      ));
      if (teacher) {
        user = {
          id: teacher.id,
          name: teacher.name,
          nameBn: teacher.nameBn || teacher.name,
          phone: teacher.phone || '',
          email: teacher.email || undefined,
          password: teacher.password || '123456',
          authProvider: teacher.authProvider,
          role: deriveRoleFromDesignation(teacher.designation),
          additionalRoles: sanitizeAdditionalRoles(teacher.additionalRoles, deriveRoleFromDesignation(teacher.designation)) as UserRole[],
          designation: teacher.designation || 'সহকারী শিক্ষক',
          assignedClasses: teacher.assignedClasses || [],
          assignedSubjects: teacher.assignedSubjects || [],
          status: (teacher.status?.toUpperCase() === 'PENDING') ? 'pending' : 'active',
          createdAt: teacher.createdAt || new Date().toISOString()
        };
        // Auto-persist in users
        setUsers(prev => [user!, ...prev.filter(u => u.id !== user!.id)]);
        try {
          const stored = localStorage.getItem('madrasha_app_users');
          const list = stored ? JSON.parse(stored) : [];
          localStorage.setItem('madrasha_app_users', JSON.stringify([user, ...list.filter((u: any) => u.id !== user!.id)]));
        } catch (e) {}
      }
    }

    if (!user) {
      const isPending = pendingMembers.some(m => 
        (m.phone && m.phone.trim() === cleanId) || 
        (m.email && m.email.trim().toLowerCase() === cleanId)
      );
      if (isPending) {
        return {
          success: false,
          message: 'আপনার অ্যাকাউন্টটি এখনও অ্যাডমিনের অনুমোদনের অপেক্ষায় রয়েছে (Pending Admin Approval)। অ্যাডমিন প্যানেল থেকে অনুমোদন করলেই আপনি প্রবেশ করতে পারবেন।'
        };
      }

      return {
        success: false,
        message: 'এই মোবাইল বা ইমেইলে কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি। সঠিক তথ্য দিন অথবা অ্যাডমিনের সাথে যোগাযোগ করুন।'
      };
    }

    // Google-only accounts can never use password-login: they were
    // never given a password, and no '123456' fallback may stand in
    // for one (see approvalPasswordFor). This check runs before the
    // password comparison, which skips password-less records.
    if (isGoogleOnlyAccount(user)) {
      return {
        success: false,
        message: GOOGLE_PASSWORD_LOGIN_DENIED
      };
    }

    if (user.password && user.password !== cleanPass) {
      return {
        success: false,
        message: 'ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।'
      };
    }

    if (user.status === 'pending') {
      return {
        success: false,
        message: 'আপনার অ্যাকাউন্টটি অনুমোদনের অপেক্ষায় রয়েছে (Pending Approval)। অ্যাডমিন অনুমোদন করলেই আপনি ড্যাশবোর্ডে প্রবেশ করতে পারবেন।'
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
    const isOwner = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isAdministrative = user.role === 'super_admin' || user.role === 'principal' || isOwner;
    // Portal-login self-heal (25 Oct 2026 follow-up): mirror the main
    // login's self-heal — a staff member logging in through the portal
    // gets a Firebase session too, so their writes sync to the cloud.
    // Same gates: stored password matched, real email from the matched
    // record (never the typed identifier, which may be a phone number),
    // staff roles only. Guardians and every failure keep the local
    // session exactly as before.
    let portalAuthed = false;
    const staffCanonical = getStaffCanonicalEmail(user.email, user.phone, user.id);
    if (shouldHealPortalLogin(user.role, user.email, user.password, cleanPass, user.phone, user.id) && staffCanonical) {
      try {
        const signed = await signInWithEmailAndPassword(auth, staffCanonical, cleanPass);
        setAuthUser(signed.user);
        portalAuthed = true;
      } catch (fbErr: any) {
        if (fbErr?.code === 'auth/user-not-found' || fbErr?.code === 'auth/invalid-credential') {
          try {
            const healed = await createPrimaryFirebaseUser(auth, staffCanonical, cleanPass, user.phone, user.id);
            if (healed === 'created' && auth.currentUser) {
              setAuthUser(auth.currentUser);
              portalAuthed = true;
            }
          } catch {}
        }
      }
    }
    if (!portalAuthed && !auth.currentUser) {
      setAuthUser(null);
    } else if (auth.currentUser) {
      setAuthUser(auth.currentUser);
    }
    // Login gate (B) — same rule for the phone path: a Firebase
    // session just healed from a stale local record must not survive
    // when the cloud no longer backs the account. The local lists
    // already produced this user, so only a fresh cloud read can
    // catch a stale record; a failed read fails OPEN (the snapshot
    // gate denies once cloud truth lands). On denial the local
    // session set above is undone — nothing is left behind.
    if (portalAuthed && auth.currentUser) {
      let cloudBacked: boolean | null = null;
      try {
        const snap = await getDoc(doc(db, 'institution', 'main_store'));
        const data = snap.data() as any;
        const cloudUsers: any[] = Array.isArray(data?.users) ? data.users : [];
        const cloudTeachers: any[] = Array.isArray(data?.teachers) ? data.teachers : [];
        const cleanPhoneDigits = (user.phone || '').replace(/[^0-9]/g, '');
        const userEmailLower = (user.email || '').toLowerCase();
        cloudBacked =
          cloudUsers.some(u => u.id === user.id || (userEmailLower && u.email && String(u.email).toLowerCase() === userEmailLower) || (cleanPhoneDigits && (u.phone || '').replace(/[^0-9]/g, '') === cleanPhoneDigits)) ||
          cloudTeachers.some(t => t.id === user.id || (userEmailLower && t.email && String(t.email).toLowerCase() === userEmailLower) || (cleanPhoneDigits && (t.phone || '').replace(/[^0-9]/g, '') === cleanPhoneDigits));
      } catch (gateErr) {
        console.warn('Login gate cloud check notice:', (gateErr as any)?.message || gateErr);
      }
      if (cloudBacked === false) {
        try { await signOut(auth); } catch {}
        setAuthUser(null);
        setActiveAppUserId(null);
        try {
          localStorage.removeItem('madrasha_active_app_user_id');
          localStorage.removeItem('madrasha_active_auth_session');
        } catch {}
        return { success: false, message: ACCOUNT_LOGIN_DENIED };
      }
    }
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
      additionalRoleIds: (user.additionalRoles || []).map(r => roleKeyToRoleId(r)),
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
        roleId: `role_${user.role}`,
        additionalRoleIds: memberRecord.additionalRoleIds
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
  // Phase 2 (public-data split): which Firestore document currently feeds
  // this session — 'main' (institution/main_store, signed-in) or 'public'
  // (institution/public_portal, anonymous portal visitors).
  const feedKindRef = useRef<'none' | 'main' | 'public'>('none');

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

        const isOwnerAccount = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
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
          } else if (isOwnerAccount) {
            const newUser: AppUser = {
              id: user.uid,
              name: realName,
              nameBn: realNameBn,
              email: user.email || undefined,
              role: 'super_admin',
              designation: 'প্রতিষ্ঠাতা ও সুপার অ্যাডমিন',
              status: 'active',
              createdAt: new Date().toISOString()
            };
            updatedList = [newUser, ...prevUsers];
          } else {
            // SAFEGUARD (b): never mint a local teacher/active entry
            // for an unmatched non-owner Firebase user. A Google
            // sign-up's role lives ONLY in its pending member doc —
            // the pending gate blocks entry until approval, and
            // approval writes the real account record. Minting here
            // used to leak a users-only teacher card into the staff
            // directory before approval (and, once auto-synced, back
            // into the cloud users array). Existing/approved users
            // are untouched: they match the branch above.
            updatedList = prevUsers;
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
      setCurrentMember(null);
    }
  }, [authUser]);

  // The signed-in user's CustomRole document(s) are no longer resolved
  // here — `currentRole` is now DERIVED next to `currentUser` above
  // (account role first, member roleId as fallback), because the old
  // effect collected BOTH ids into a set and returned whichever role
  // document happened to sit first in the roles array — a stale
  // 'role_teacher' member document could shadow the account's real
  // role. History: until Phase 2 `currentRole` was never assigned at
  // all (stayed null), which silently disabled the whole CustomRole
  // layer; Phase 6 flipped hasPermission precedence (CustomRole layer
  // first, hardcoded branches as fallback — outcomes unchanged, see
  // scripts/test-rbac-equivalence.ts).

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
      const cleanStudents = data.students
        .filter(s => !s.id?.startsWith('demo-std-') && s.id !== 'st-1' && s.id !== 'st-2')
        .map(hydrateStudentLifecycle);
      setStudents(cleanStudents);
      try { localStorage.setItem('students', JSON.stringify(cleanStudents)); } catch {}
    }
    if (data.subjects && Array.isArray(data.subjects)) {
      const cleanSubjects = data.subjects.filter(s => !s.id?.startsWith('demo-sub-'));
      setSubjects(cleanSubjects);
      try { localStorage.setItem('subjects', JSON.stringify(cleanSubjects)); } catch {}
    }
    if (data.exams && Array.isArray(data.exams)) {
      setExams(data.exams);
      try { localStorage.setItem('exams', JSON.stringify(data.exams)); } catch {}
    }
    if (data.marks && Array.isArray(data.marks)) {
      const cleanMarks = data.marks.filter(m => !m.id?.startsWith('demo-mark-'));
      setMarks(cleanMarks);
      try { localStorage.setItem('marks', JSON.stringify(cleanMarks)); } catch {}
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
      const cleanTransactions = data.transactions.filter(t => !t.id?.startsWith('tx-init-'));
      setTransactions(cleanTransactions);
      try { localStorage.setItem('madrasha_transactions', JSON.stringify(cleanTransactions)); } catch {}
    }
    if (data.feeStructures && Array.isArray(data.feeStructures)) {
      setFeeStructures(data.feeStructures);
      try { localStorage.setItem('madrasha_fee_structures', JSON.stringify(data.feeStructures)); } catch {}
    }
    if (data.feeTypes && Array.isArray(data.feeTypes) && data.feeTypes.length > 0) {
      setFeeTypes(data.feeTypes);
      try { localStorage.setItem('madrasha_fee_types', JSON.stringify(data.feeTypes)); } catch {}
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
      try { localStorage.setItem('teachers', JSON.stringify(data.teachers)); } catch {}
    }
    if (data.staffLeaves && Array.isArray(data.staffLeaves)) {
      setStaffLeaves(data.staffLeaves);
      try { localStorage.setItem('madrasah_staff_leaves', JSON.stringify(data.staffLeaves)); } catch {}
    }
    // Attendance hydration MERGES into the local services (24 Oct 2026
    // visibility fix) — it must never wholesale-replace. The live cloud
    // attendance arrays were empty (no teacher session has ever synced
    // them), so replace() wiped every teacher's phone-local records on
    // the next snapshot/getDoc before any sync could upload them. Merge
    // keeps local records (incoming wins on id conflict) and the state
    // is then read back from the merged service, so the next authed
    // sync uploads the backlog instead of an empty array. Schedule
    // hydration below keeps replace* (routines/calendar have no
    // equivalent phone-local backlog; same-pattern risk noted).
    if (data.dailyStudentAttendance && Array.isArray(data.dailyStudentAttendance)) {
      dailyAttendanceService.mergeStudentRecords(data.dailyStudentAttendance);
      setDailyStudentAttendance(dailyAttendanceService.getAllStudentRecords());
    }
    if (data.dailyStaffAttendance && Array.isArray(data.dailyStaffAttendance)) {
      dailyAttendanceService.mergeStaffRecords(data.dailyStaffAttendance);
      setDailyStaffAttendance(dailyAttendanceService.getAllStaffRecords());
    }
    if (data.classRoutines && Array.isArray(data.classRoutines)) {
      setClassRoutines(data.classRoutines);
      academicScheduleService.replaceRoutines(data.classRoutines);
    }
    if (data.syllabusItems && Array.isArray(data.syllabusItems)) {
      setSyllabusItems(data.syllabusItems);
      academicScheduleService.replaceSyllabusItems(data.syllabusItems);
    }
    if (data.calendarEvents && Array.isArray(data.calendarEvents)) {
      setCalendarEvents(data.calendarEvents);
      academicScheduleService.replaceCalendarEvents(data.calendarEvents);
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
      const cleanUsers = data.users.filter(u =>
        !u.id.startsWith('user_teacher_') &&
        !u.id.startsWith('user_acc_') &&
        !u.id.startsWith('user_staff_') &&
        !u.id.startsWith('user_guardian_') &&
        !u.id.startsWith('user_principal_') &&
        !Boolean(u.email && u.email.includes('madrasha.local'))
      );
      // One-way role heal: accounts created through the staff directory used
      // to be stamped role 'teacher' no matter the designation (the
      // accountant landed on the teacher portal). When the staff record's
      // designation clearly names a non-teacher role, trust the designation.
      // Only ever moves a 'teacher' stamp; deliberate roles stay untouched.
      //
      // Multi-match rule (the duplicate-record fix): a person can have
      // SEVERAL staff records (e.g. a leftover plain-teacher duplicate
      // next to the real Accountant record). The old code used
      // staffList.find(...) — first match wins — so the duplicate could
      // shadow the real record and the heal silently did nothing. Now
      // ALL matching records are considered and a non-teacher
      // designation always beats a plain teacher record, in any order
      // (services/roleResolution.ts: bestDesignationRole).
      const staffList: any[] = Array.isArray(data.teachers) ? data.teachers : [];
      const healedUsers = cleanUsers.map(u => {
        const matches = staffList.filter((t: any) =>
          t.id === u.id ||
          (u.email && t.email && t.email.toLowerCase() === u.email.toLowerCase()) ||
          (u.phone && t.phone && t.phone === u.phone)
        );
        // Multi-role: adopt additionalRoles recorded on any matching
        // staff record when the account itself does not carry them yet.
        const staffAdditional = sanitizeAdditionalRoles(
          matches.flatMap((t: any) => (Array.isArray(t.additionalRoles) ? t.additionalRoles : [])),
          u.role
        );
        const withAdditional =
          staffAdditional.length > 0 && !(Array.isArray(u.additionalRoles) && u.additionalRoles.length > 0)
            ? { ...u, additionalRoles: staffAdditional as UserRole[] }
            : u;
        if (u.role !== 'teacher') return withAdditional;
        const derived = bestDesignationRole([
          ...matches,
          { designation: u.designation }
        ]);
        return derived !== 'teacher'
          ? { ...withAdditional, role: derived as UserRole }
          : withAdditional;
      });
      setUsers(healedUsers);
      try { localStorage.setItem('madrasha_app_users', JSON.stringify(healedUsers)); } catch {}
    }
    if (data.notices && Array.isArray(data.notices)) {
      const cleanNotices = data.notices.filter(n => !n.id?.startsWith('notice-urgent-') && !n.id?.startsWith('notice-exam-') && !n.id?.startsWith('notice-update-'));
      setNotices(cleanNotices);
      try { localStorage.setItem('madrasha_notices', JSON.stringify(cleanNotices)); } catch {}
    }

    setCloudStatus('connected');
    const timeStr = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCloudLastSynced(timeStr);

    setTimeout(() => {
      isRemoteUpdateRef.current = false;
    }, 400);
  };

  // One-time startup sweep to purge any legacy demo data from localStorage across all modules
  useEffect(() => {
    try {
      const cleanups: Array<{ key: string; isDemo: (item: any) => boolean }> = [
        { key: 'students', isDemo: (s) => s?.id?.startsWith('demo-std-') || s?.id === 'st-1' || s?.id === 'st-2' },
        { key: 'subjects', isDemo: (s) => s?.id?.startsWith('demo-sub-') },
        { key: 'marks', isDemo: (m) => m?.id?.startsWith('demo-mark-') },
        { key: 'madrasha_transactions', isDemo: (t) => t?.id?.startsWith('tx-init-') },
        { key: 'madrasha_notices', isDemo: (n) => n?.id?.startsWith('notice-urgent-') || n?.id?.startsWith('notice-exam-') || n?.id?.startsWith('notice-update-') },
        { key: 'madrasha_app_users', isDemo: (u) => u?.id?.startsWith('user_teacher_') || u?.id?.startsWith('user_acc_') || u?.id?.startsWith('user_staff_') || u?.id?.startsWith('user_guardian_') || u?.id?.startsWith('user_principal_') || (u?.email && u?.email?.includes('madrasha.local')) },
        { key: 'madrasah_staff_leaves', isDemo: (l) => l?.id === 'leave_1' },
        { key: 'madrasah_books_catalog', isDemo: (b) => b?.id?.startsWith('book-') },
        { key: 'madrasah_book_issues', isDemo: (i) => i?.id?.startsWith('issue-') },
        { key: 'madrasah_transport_vehicles', isDemo: (v) => v?.id?.startsWith('veh-') },
        { key: 'madrasah_transport_roster', isDemo: (r) => r?.id?.startsWith('tr-') },
        { key: 'madrasah_mahfil_events', isDemo: (e) => e?.id?.startsWith('evt-') },
        { key: 'madrasah_cocurricular_clubs', isDemo: (c) => c?.id?.startsWith('club-') },
        { key: 'madrasha_ops_v1_assets', isDemo: (a) => a?.id?.startsWith('ast-') },
        { key: 'madrasha_ops_v1_store', isDemo: (s) => s?.id?.startsWith('itm-') },
        { key: 'madrasha_ops_v1_movements', isDemo: (m) => m?.id?.startsWith('mov-') },
        { key: 'madrasha_ops_v1_houses', isDemo: (h) => h?.id?.startsWith('house-') },
        { key: 'madrasha_ops_v1_house_logs', isDemo: (l) => l?.id?.startsWith('hpl-') },
        { key: 'madrasha_ops_v1_alumni', isDemo: (a) => a?.id?.startsWith('alm-') },
        { key: 'madrasha_ops_v1_health', isDemo: (h) => h?.id?.startsWith('hlth-') },
        { key: 'madrasha_admissions_v1', isDemo: (a) => a?.id?.startsWith('adm-') },
        { key: 'madrasah_admissions_v1', isDemo: (a) => a?.id?.startsWith('app-') },
        { key: 'madrasha_sms_logs_v1', isDemo: (s) => s?.id?.startsWith('sms-log-') },
        { key: 'madrasha_welfare_v1', isDemo: (w) => w?.id?.startsWith('wel-') },
      ];

      cleanups.forEach(({ key, isDemo }) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter(item => !isDemo(item));
              localStorage.setItem(key, JSON.stringify(filtered));
            }
          } catch {}
        }
      });
    } catch (e) {
      console.warn('Startup demo data cleanup notice:', e);
    }
  }, []);

  // Load from and Listen to Firebase Firestore in real-time.
  //
  // Phase 2 (public-data split): sessions with a real login read the full
  // `institution/main_store` exactly as before. Anonymous sessions (the
  // public portal: landing page, result search, student profile by ID)
  // read the derived, public-safe `institution/public_portal` document
  // instead — with a graceful fallback to main_store whenever the public
  // document does not exist yet (i.e. before the first signed-in sync
  // creates it), so the portal keeps working at every step of the rollout.
  useEffect(() => {
    setCloudStatus('syncing');

    let cancelled = false;
    let activeUnsubscribe: (() => void) | null = null;

    const stopActiveFeed = () => {
      if (activeUnsubscribe) {
        try { activeUnsubscribe(); } catch {}
        activeUnsubscribe = null;
      }
    };

    const startMainStoreFeed = () => {
      if (cancelled) return;
      stopActiveFeed();
      feedKindRef.current = 'main';
      const docRef = doc(db, 'institution', 'main_store');

      // Immediate direct getDoc load to guarantee instant data availability on boot
      getDoc(docRef)
        .then((snap) => {
          if (!cancelled && snap.exists()) {
            applyRemoteData(snap.data());
            setCloudHydrated(true);
          }
        })
        .catch((err) => {
          console.warn('Initial direct getDoc load notice:', err?.message || err);
        });

      activeUnsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (cancelled) return;
          if (snapshot.exists()) {
            applyRemoteData(snapshot.data());
            setCloudHydrated(true);
          } else {
            setCloudStatus('connected');
            setCloudLastSynced('No Cloud Data Found');
            setCloudHydrated(true);
          }
        },
        (error) => {
          if (cancelled) return;
          console.warn('Firestore snapshot listener notice:', error?.message || error);
          if (error?.code === 'permission-denied') {
            console.warn('[Firestore] Permission denied');
            setCloudStatus('error');
          } else {
            setCloudStatus('offline');
          }
        }
      );
    };

    const startPublicFeed = () => {
      if (cancelled) return;
      stopActiveFeed();
      feedKindRef.current = 'public';
      const publicDocRef = doc(db, 'institution', 'public_portal');
      let fellBack = false;

      // If the public document is missing (not created yet) or unreadable,
      // fall back to the previous behaviour so the portal never breaks.
      const fallbackToMainStore = () => {
        if (cancelled || fellBack) return;
        fellBack = true;
        startMainStoreFeed();
      };

      getDoc(publicDocRef)
        .then((snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            applyRemoteData(snap.data());
          } else {
            fallbackToMainStore();
          }
        })
        .catch((err) => {
          console.warn('Public portal getDoc load notice:', err?.message || err);
          fallbackToMainStore();
        });

      activeUnsubscribe = onSnapshot(
        publicDocRef,
        (snapshot) => {
          if (cancelled) return;
          if (snapshot.exists()) {
            applyRemoteData(snapshot.data());
          } else {
            fallbackToMainStore();
          }
        },
        (error) => {
          if (cancelled) return;
          console.warn('Public portal snapshot listener notice:', error?.message || error);
          if (error?.code === 'permission-denied') {
            fallbackToMainStore();
          } else {
            setCloudStatus('offline');
          }
        }
      );
    };

    // A saved app-level session (Firebase or local portal login) counts as
    // signed in for data purposes — those users keep the full store feed.
    const hasLocalAppSession = () => {
      try {
        return !!(
          localStorage.getItem('madrasha_active_auth_session') ||
          localStorage.getItem('madrasha_active_app_user_id')
        );
      } catch {
        return false;
      }
    };

    const startInitialFeed = () => {
      if (cancelled || feedKindRef.current !== 'none') return;
      if (hasLocalAppSession()) {
        startMainStoreFeed();
      } else {
        startPublicFeed();
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      if (user) {
        // Signed in at boot, or signing in after an anonymous start:
        // switch to (or stay on) the full store feed.
        if (feedKindRef.current !== 'main') {
          startMainStoreFeed();
        }
      } else {
        startInitialFeed();
      }
    });

    // Safety net: if Firebase Auth state never resolves, start with the
    // same decision a logged-out visitor would get; a later sign-in still
    // switches the feed via the auth listener above.
    const safetyTimer = setTimeout(startInitialFeed, 3000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      stopActiveFeed();
    };
  }, []);

  // First-snapshot timeout (Nov 2026 stale-flash fix): if no main_store
  // snapshot lands within 6s (offline / very slow network), fall back
  // to local data — StaffManager then labels it stale/offline instead
  // of presenting it as current, and never blocks forever.
  useEffect(() => {
    if (cloudHydrated) return;
    const t = setTimeout(() => setCloudHydrationTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [cloudHydrated]);

  // Background debounced auto-sync to Firebase Firestore on local state changes
  useEffect(() => {
    if (isRemoteUpdateRef.current) return;

    // CRITICAL CLOUD PROTECTION: Never auto-sync until initial remote data status has resolved
    if (!hasLoadedRemoteRef.current) return;

    // CRITICAL EMPTY DATA PROTECTION: Never overwrite cloud data with empty local state
    if (students.length === 0 && marks.length === 0) {
      return;
    }

    // Phase 2 (public-data split): an anonymous session holds ONLY the
    // public subset in state. It must never write that partial state back
    // over the full store. Signed-in sessions sync exactly as before.
    if (feedKindRef.current === 'public' && !auth.currentUser) {
      return;
    }

    setCloudStatus('syncing');

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = buildMainStorePayload(
          {
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
            feeTypes,
            trashBin,
            promotionHistory,
            users,
            notices,
            staffLeaves,
            dailyStudentAttendance,
            dailyStaffAttendance,
            classRoutines,
            syllabusItems,
            calendarEvents
          },
          currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'system_user'
        );

        await setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true });

        // Phase 2 (public-data split): keep the derived public portal
        // document in step with the store. Written as a full replace (no
        // merge) so records deleted from the store also disappear from
        // the public document. A failure here never fails the main sync.
        try {
          await setDoc(doc(db, 'institution', 'public_portal'), buildPublicPortalData(payload));
        } catch (pubErr: any) {
          console.warn('Public portal sync notice:', pubErr?.message || pubErr);
        }

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
  }, [schoolProfile, students, subjects, teachers, classSubjectAssignments, teacherSubjectAssignments, classTeacherAssignments, exams, examSubjectAssignments, marks, remarks, classes, academicYears, sections, transactions, feeStructures, feeTypes, trashBin, promotionHistory, users, notices, staffLeaves, dailyStudentAttendance, dailyStaffAttendance, classRoutines, syllabusItems, calendarEvents, currentUser, isAdmin, authUser, adminEmail]);

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
    localStorage.setItem('madrasha_fee_types', JSON.stringify(feeTypes));
  }, [feeTypes]);

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
    try { localStorage.setItem('madrasah_staff_leaves', JSON.stringify(staffLeaves)); } catch {}
  }, [staffLeaves]);

  // Sync bridge for the local-first services: whenever attendance or
  // schedule data is written through dailyAttendanceService /
  // academicScheduleService (all existing UI uses those services), mirror
  // the new data into shared state. That single state change is what makes
  // the debounced Firestore auto-sync above carry attendance, routines,
  // syllabus and calendar to the cloud — and into backups. Reads here use
  // the raw storage values so the bridge never triggers the services'
  // first-run seed data as a side effect.
  useEffect(() => {
    const readStoredArray = (key: string): any[] => {
      try {
        const saved = localStorage.getItem(key);
        const parsed = saved ? JSON.parse(saved) : null;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const pullFromServices = () => {
      setDailyStudentAttendance(dailyAttendanceService.getAllStudentRecords());
      setDailyStaffAttendance(dailyAttendanceService.getAllStaffRecords());
      setClassRoutines(readStoredArray('madrasha_academic_routines_v1'));
      setSyllabusItems(readStoredArray('madrasha_academic_syllabus_v1'));
      setCalendarEvents(readStoredArray('madrasha_academic_calendar_v1'));
    };
    const unsubscribeAttendance = dailyAttendanceService.subscribe(pullFromServices);
    const unsubscribeSchedule = academicScheduleService.subscribe(pullFromServices);
    return () => {
      unsubscribeAttendance();
      unsubscribeSchedule();
    };
  }, []);

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
        if (Array.isArray(p.staffLeaves)) setStaffLeaves(p.staffLeaves);
        if (Array.isArray(p.users)) setUsers(p.users);
        if (Array.isArray(p.notices)) setNotices(p.notices);
        // Attendance resurrection MERGES, never replaces (Step 3 stale-view
        // / wipe fix). The old replace* calls wiped unsynced phone-local
        // records whenever this effect ran with an empty/stale restored
        // array — and the trigger CAN fire while the service singleton
        // still holds unsynced records: resurrectDataIfEmpty() fires when
        // the COUNTED local collections total <= 3, but extractSystemCounts
        // does not count attendance at all, so a device with few counted
        // records and a populated attendance backlog passed the gate.
        // Merge (same as the live-feed hydration path) preserves the
        // backlog; incoming wins on id conflict. The disk keys that
        // resurrectDataIfEmpty() already overwrote are repaired by the
        // merge's saveToStorage before any sync reads them, and no
        // disk-key reader runs between the two. Schedule restore below
        // keeps replace* deliberately (routines/calendar have no
        // phone-local backlog).
        if (Array.isArray(p.dailyStudentAttendance)) {
          dailyAttendanceService.mergeStudentRecords(p.dailyStudentAttendance);
          setDailyStudentAttendance(dailyAttendanceService.getAllStudentRecords());
        }
        if (Array.isArray(p.dailyStaffAttendance)) {
          dailyAttendanceService.mergeStaffRecords(p.dailyStaffAttendance);
          setDailyStaffAttendance(dailyAttendanceService.getAllStaffRecords());
        }
        if (Array.isArray(p.classRoutines)) {
          setClassRoutines(p.classRoutines);
          academicScheduleService.replaceRoutines(p.classRoutines);
        }
        if (Array.isArray(p.syllabusItems)) {
          setSyllabusItems(p.syllabusItems);
          academicScheduleService.replaceSyllabusItems(p.syllabusItems);
        }
        if (Array.isArray(p.calendarEvents)) {
          setCalendarEvents(p.calendarEvents);
          academicScheduleService.replaceCalendarEvents(p.calendarEvents);
        }
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
          promotionHistory,
          users,
          notices,
          staffLeaves,
          dailyStudentAttendance,
          dailyStaffAttendance,
          classRoutines,
          syllabusItems,
          calendarEvents
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
    promotionHistory,
    users,
    notices,
    staffLeaves,
    dailyStudentAttendance,
    dailyStaffAttendance,
    classRoutines,
    syllabusItems,
    calendarEvents
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
          promotionHistory,
          users,
          notices,
          staffLeaves,
          dailyStudentAttendance,
          dailyStaffAttendance,
          classRoutines,
          syllabusItems,
          calendarEvents
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
    promotionHistory,
    users,
    notices,
    staffLeaves,
    dailyStudentAttendance,
    dailyStaffAttendance,
    classRoutines,
    syllabusItems,
    calendarEvents
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
          promotionHistory,
          users,
          notices,
          staffLeaves,
          dailyStudentAttendance,
          dailyStaffAttendance,
          classRoutines,
          syllabusItems,
          calendarEvents
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
    promotionHistory,
    users,
    notices,
    staffLeaves,
    dailyStudentAttendance,
    dailyStaffAttendance,
    classRoutines,
    syllabusItems,
    calendarEvents
  ]);

  // Force Push/Pull functions
  const forcePushToCloud = async () => {
    setCloudStatus('syncing');
    try {
      const payload = buildMainStorePayload(
        {
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
          feeTypes,
          trashBin,
          promotionHistory,
          users,
          notices,
          staffLeaves,
          dailyStudentAttendance,
          dailyStaffAttendance,
          classRoutines,
          syllabusItems,
          calendarEvents
        },
        currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || SUPER_ADMIN_EMAIL
      );
      await setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true });

      // Phase 2 (public-data split): refresh the derived public portal
      // document alongside the manual push as well.
      try {
        await setDoc(doc(db, 'institution', 'public_portal'), buildPublicPortalData(payload));
      } catch (pubErr: any) {
        console.warn('Public portal sync notice:', pubErr?.message || pubErr);
      }

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
        const isOwnerAccount = (result.user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
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
      const isOwnerAccount = (auth.currentUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
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

    const isOwnerAccount = trimmedEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    // Firebase sign-in failure code, captured so the local-fallback steps
    // below can decide whether a login-time self-heal is warranted.
    let firebaseSignInCode: string | undefined;

    // 1. Try Firebase Auth
    try {
      const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      if (result.user) {
        setAuthUser(result.user);
        if (result.user.email) setAdminEmail(result.user.email);
        // Login gate (A) — delete-effective auth: a Firebase account
        // survives staff deletion, so a surviving account with no
        // backing record must not mint a session. Owner always passes.
        // Local lists first; a fresh cloud read decides when they do
        // not back the account (fresh device / stale lists). A failed
        // cloud read fails OPEN (cloudBacked stays null) — the
        // post-hydration gate denies the session as soon as the
        // snapshot lands.
        {
          const gateEmail = (result.user.email || '').toLowerCase();
          const gateUid = result.user.uid;
          const storedUid = readStoredSessionUid();
          const canonicalDigits = /^staff\.(\d+)@madrashasystem\.com$/.exec(gateEmail)?.[1];
          const locallyBacked = isOwnerAccount ||
            usersRef.current.some(u => u.id === gateUid || (u.email && u.email.toLowerCase() === gateEmail)) ||
            teachersRef.current.some(t => t.email && t.email.toLowerCase() === gateEmail) ||
            (canonicalDigits ? (usersRef.current.some(u => (u.phone || '').replace(/[^0-9]/g, '') === canonicalDigits) || teachersRef.current.some(t => (t.phone || '').replace(/[^0-9]/g, '') === canonicalDigits)) : false) ||
            (storedUid ? (usersRef.current.some(u => u.id === storedUid) || teachersRef.current.some(t => t.id === storedUid)) : false);
          if (!locallyBacked) {
            let cloudBacked: boolean | null = null;
            try {
              const snap = await getDoc(doc(db, 'institution', 'main_store'));
              const data = snap.data() as any;
              const cloudUsers: any[] = Array.isArray(data?.users) ? data.users : [];
              const cloudTeachers: any[] = Array.isArray(data?.teachers) ? data.teachers : [];
              cloudBacked =
                cloudUsers.some(u => u.id === gateUid || (u.email && String(u.email).toLowerCase() === gateEmail)) ||
                cloudTeachers.some(t => t.email && String(t.email).toLowerCase() === gateEmail) ||
                (canonicalDigits ? (cloudUsers.some(u => (u.phone || '').replace(/[^0-9]/g, '') === canonicalDigits) || cloudTeachers.some(t => (t.phone || '').replace(/[^0-9]/g, '') === canonicalDigits)) : false) ||
                (storedUid ? (cloudUsers.some(u => u.id === storedUid) || cloudTeachers.some(t => t.id === storedUid)) : false);
            } catch (gateErr) {
              console.warn('Login gate cloud check notice:', (gateErr as any)?.message || gateErr);
            }
            if (cloudBacked === false) {
              try { await signOut(auth); } catch {}
              try {
                localStorage.removeItem('madrasha_active_auth_session');
                localStorage.removeItem('madrasha_active_app_user_id');
              } catch {}
              setAuthUser(null);
              return { success: false, error: ACCOUNT_LOGIN_DENIED };
            }
          }
        }
        // Session roleId follows the person's account record when one
        // exists — it used to be hard-coded 'role_teacher' for every
        // non-owner, which re-stamped an accountant as a teacher
        // whenever this stored session was restored.
        const matchedAccount = pickAuthoritativeUser<AppUser>(
          users.filter(u => u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase())
        );
        localStorage.setItem('madrasha_active_auth_session', JSON.stringify({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          roleId: isOwnerAccount
            ? 'role_institution_admin'
            : (matchedAccount ? roleKeyToRoleId(matchedAccount.role) : 'role_teacher'),
          additionalRoleIds: (matchedAccount?.additionalRoles || []).map(r => roleKeyToRoleId(r))
        }));
        return { success: true };
      }
    } catch (firebaseErr: any) {
      firebaseSignInCode = firebaseErr?.code;
      console.warn('Firebase signIn notice:', firebaseErr?.code, firebaseErr?.message);

      if (isOwnerAccount) {
        if (firebaseErr?.code === 'auth/user-not-found') {
          return {
            success: false,
            error: `অ্যাডমিন অ্যাকাউন্টটি এখনও ফায়ারবেস অথেনটিকেশনে তৈরি করা হয়নি। ফায়ারবেস কনসোল (Firebase Console -> Authentication -> Users) থেকে "${SUPER_ADMIN_EMAIL}" অ্যাকাউন্টটি তৈরি করুন অথবা অনুমোদিত গুগল সাইন-ইন ব্যবহার করুন।`
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
      const member = allMembers.find(m =>
        (m.email && m.email.toLowerCase() === trimmedEmail.toLowerCase()) ||
        (m.phone && m.phone.trim() === trimmedEmail.trim())
      );

      if (member) {
        // Google-only members have no password: the check below skips
        // password-less records, so deny explicitly before it.
        if (isGoogleOnlyAccount(member)) {
          return { success: false, error: GOOGLE_PASSWORD_LOGIN_DENIED };
        }
        if (member.password && member.password !== password) {
          return { success: false, error: 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে।' };
        }

        // Phase 1 pending gate: password matched, but the account is
        // NOT active — no Firebase account, no session, no self-heal.
        // This runs BEFORE createPrimaryFirebaseUser below, so a
        // pending applicant can never gain a Firebase identity (and
        // therefore cloud-write access) merely by logging in.
        const gateStep2 = signInGateForStatus(member.status);
        if (gateStep2.blocked) {
          return { success: false, error: gateStep2.message };
        }

        // The account record outranks the member document: if the
        // member doc still carries a stale roleId (e.g. 'role_teacher'
        // from signup) while the person's account says 'accountant',
        // the session follows the ACCOUNT (see roleResolution.ts).
        const account = pickAuthoritativeUser<AppUser>(users.filter(u =>
          (u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase()) ||
          (member.phone && u.phone && u.phone === member.phone)
        ));
        const sessionMember: InstitutionMember =
          account && normalizeRoleKey(member.roleId) !== account.role
            ? {
                ...member,
                roleId: roleKeyToRoleId(account.role),
                additionalRoleIds: (account.additionalRoles || []).map(r => roleKeyToRoleId(r))
              }
            : member;

        // Auto-provisioning, login-time self-heal (25 Oct 2026): this
        // member passed the local password check but step 1 failed, so
        // they have no Firebase user yet. Create it now on the primary
        // auth with the verified password, and the session becomes
        // authed (cloud writes pass the rule). Staff roles only, and
        // only when a stored password actually matched — a wrong
        // password returns early above and never reaches here.
        // Canonical email first: a phone identifier (or a synthetic
        // @madrasha.local address) must NOT reach the old @-only guard,
        // or phone-only members never heal. Best-effort: any failure
        // just keeps the local session.
        const healEmailStep2 = getStaffCanonicalEmail(member.email, member.phone, member.uid);
        if (
          member.password &&
          healEmailStep2 &&
          isStaffProvisioningRole(normalizeRoleKey(sessionMember.roleId)) &&
          (firebaseSignInCode === 'auth/user-not-found' || firebaseSignInCode === 'auth/invalid-credential')
        ) {
          try {
            const healed = await createPrimaryFirebaseUser(auth, healEmailStep2, password, member.phone, member.uid);
            if (healed === 'created' && auth.currentUser) {
              setAuthUser(auth.currentUser);
              if (auth.currentUser.email) setAdminEmail(auth.currentUser.email);
            }
          } catch {}
        }

        // Local portal session only (Never synthetic authUser for cloud operations)
        setActiveAppUserId(sessionMember.uid);
        setCurrentMember(sessionMember);
        localStorage.setItem('madrasha_active_auth_session', JSON.stringify(sessionMember));
        return { success: true };
      }
    } catch (dbErr) {
      console.warn('Member lookup notice:', dbErr);
    }

    // 3. Check App Users (Admin, Principal, Teacher, Accountant, Guardian)
    // Duplicate-safe pick: a non-teacher record beats a teacher-stamped
    // duplicate of the same person (see services/roleResolution.ts).
    let foundUser = pickAuthoritativeUser<AppUser>(users.filter(u =>
      (u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase()) ||
      (u.phone && u.phone.trim() === trimmedEmail.trim())
    ));

    // Fallback to teachers array if not yet in users
    if (!foundUser) {
      const matchedTeacher = pickBestStaffRecord<AcademicTeacher>(teachers.filter(t =>
        (t.email && t.email.toLowerCase() === trimmedEmail.toLowerCase()) ||
        (t.phone && t.phone.trim() === trimmedEmail.trim())
      ));
      if (matchedTeacher) {
        foundUser = {
          id: matchedTeacher.id,
          name: matchedTeacher.name,
          nameBn: matchedTeacher.nameBn || matchedTeacher.name,
          phone: matchedTeacher.phone || '',
          email: matchedTeacher.email || undefined,
          password: matchedTeacher.password || '123456',
          role: deriveRoleFromDesignation(matchedTeacher.designation),
          additionalRoles: sanitizeAdditionalRoles(matchedTeacher.additionalRoles, deriveRoleFromDesignation(matchedTeacher.designation)) as UserRole[],
          designation: matchedTeacher.designation || 'সহকারী শিক্ষক',
          assignedClasses: matchedTeacher.assignedClasses || [],
          assignedSubjects: matchedTeacher.assignedSubjects || [],
          status: (matchedTeacher.status?.toUpperCase() === 'PENDING') ? 'pending' : 'active',
          createdAt: matchedTeacher.createdAt || new Date().toISOString()
        };
        // Auto-heal users state
        setUsers(prev => [foundUser!, ...prev.filter(u => u.id !== foundUser!.id)]);
      }
    }

    if (foundUser) {
      // Google-only accounts: same explicit deny as the member path.
      if (isGoogleOnlyAccount(foundUser)) {
        return { success: false, error: GOOGLE_PASSWORD_LOGIN_DENIED };
      }
      if (foundUser.password && foundUser.password !== password) {
        return { success: false, error: 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে।' };
      }
      if (foundUser.status === 'blocked') {
        return { success: false, error: 'আপনার অ্যাকাউন্টটি স্থগিত (Blocked) করা হয়েছে।' };
      }

      // Phase 1 pending gate (user-record path): same rule as step 2.
      // A pending account record, or a linked member application that
      // is not active, gets no Firebase self-heal and no session.
      const gateStep3 = signInGateForStatus(foundUser.status);
      if (gateStep3.blocked) {
        return { success: false, error: gateStep3.message };
      }
      try {
        const allMembersStep3 = await getAllInstitutionMembers('inst_madrasah_primary');
        const linkedMember = allMembersStep3.find(m =>
          m.uid === foundUser.id ||
          (foundUser.email && m.email.toLowerCase() === foundUser.email.toLowerCase())
        );
        if (linkedMember) {
          const gateLinked = signInGateForStatus(linkedMember.status);
          if (gateLinked.blocked) {
            return { success: false, error: gateLinked.message };
          }
        }
      } catch {}

      // Auto-provisioning & Firebase Auth session self-heal for all staff roles (email or phone)
      const healEmailStep3 = getStaffCanonicalEmail(foundUser.email, foundUser.phone, foundUser.id);
      if (
        foundUser.password &&
        healEmailStep3 &&
        isStaffProvisioningRole(foundUser.role)
      ) {
        try {
          try {
            const signed = await signInWithEmailAndPassword(auth, healEmailStep3, password);
            if (signed.user) {
              setAuthUser(signed.user);
              if (signed.user.email) setAdminEmail(signed.user.email);
            }
          } catch (signInErr: any) {
            if (signInErr?.code === 'auth/user-not-found' || signInErr?.code === 'auth/invalid-credential') {
              const healed = await createPrimaryFirebaseUser(auth, healEmailStep3, password, foundUser.phone, foundUser.id);
              if (healed === 'created' && auth.currentUser) {
                setAuthUser(auth.currentUser);
                if (auth.currentUser.email) setAdminEmail(auth.currentUser.email);
              }
            }
          }
        } catch {}
      }

      setActiveAppUserId(foundUser.id);
      const isOwner = (foundUser.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
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
        additionalRoleIds: (foundUser.additionalRoles || []).map(r => roleKeyToRoleId(r)),
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

    const isOwnerAccount = trimmedEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
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
    } else if (requestedRole.toLowerCase().includes('principal') || requestedRole.toLowerCase().includes('অধ্যক্ষ') || requestedRole.toLowerCase().includes('সুপার') || requestedRole.toLowerCase().includes('মুহতামিম')) {
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

    // NO teachers-list entry here (Phase 1): a signup is only a pending
    // application. Teacher records are created ONLY by approveMember —
    // inserting an ACTIVE entry at signup is exactly how unapproved
    // people used to appear in the teacher list.

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

  // Google Sign-Up (25 Oct 2026): register view's "Google দিয়ে নিবন্ধন করুন".
  // Mirrors email sign-up's approval model, but the Firebase user
  // already exists after the popup — so the member doc id MUST be the
  // Firebase uid (boot lookup uses authUser.uid), status is ALWAYS
  // pending, and NO password and NO teachers-list entry are created.
  // Role comes only from this member doc (never from the auth-state
  // stamp, which no longer mints teacher/active entries for unmatched
  // non-owner users). Approval then resolves the active role.
  const signUpWithGoogle = async (
    requestedRole: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    let result: any = null;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Google sign-up popup notice:', err?.code);
      return { success: false, error: googlePopupErrorMessage(err?.code) };
    }

    const user = result?.user;
    const email = (user?.email || '').trim();
    if (!user || !email) {
      try { await signOut(auth); } catch {}
      return { success: false, error: 'Google নিবন্ধন সম্পন্ন হয়নি। আবার চেষ্টা করুন।' };
    }

    // Owner email can never self-register (same rule as email sign-up).
    if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      try { await signOut(auth); } catch {}
      return {
        success: false,
        error: 'প্রধান অ্যাডমিন অ্যাকাউন্ট পাবলিক রেজিস্ট্রেশন থেকে তৈরি করা যাবে না। Google দিয়ে প্রবেশ করতে লগইন ব্যবহার করুন।'
      };
    }

    // Existing member → must log in, never a duplicate member doc.
    try {
      const allMembers = await getAllInstitutionMembers('inst_madrasah_primary');
      const existing = allMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        try { await signOut(auth); } catch {}
        return { success: false, error: GOOGLE_SIGNUP_EXISTING_MEMBER };
      }
    } catch (e) {}

    const displayName = user.displayName || email.split('@')[0] || 'User';

    // Member construction lives in googleSignupRules so the verify
    // script tests the real builder (uid = Firebase uid, pending,
    // no password, authProvider 'google').
    const memberData: InstitutionMember = {
      ...buildGoogleSignupMember({
        uid: user.uid,
        email,
        displayName,
        phone,
        requestedRole,
      }),
      institutionId: 'inst_madrasah_primary',
    };

    try {
      await setInstitutionMember('inst_madrasah_primary', memberData, user.uid);
    } catch (e) {
      console.warn('Google sign-up member write notice:', e);
      try { await signOut(auth); } catch {}
      return { success: false, error: 'Google নিবন্ধন সম্পন্ন হয়নি। আবার চেষ্টা করুন।' };
    }

    // NO teachers-list entry here (unlike email sign-up): a pending
    // applicant must not appear in the staff directory before approval.
    // Approval creates the account/teacher records, with no password.

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedGoogleAccessToken(credential.accessToken);
    }
    setAuthUser(user);
    setAdminEmail(email);
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
        email: SUPER_ADMIN_EMAIL,
        name: 'অধ্যক্ষ / অ্যাডমিন (ডেমো ভিউ)',
        roleId: 'role_institution_admin'
      },
      principal: {
        email: 'principal@madrasha.edu.bd',
        name: 'অধ্যক্ষ মাওলানা আব্দুল করিম (ডেমো)',
        roleId: 'role_principal'
      },
      teacher: {
        email: 'teacher.mahmud@madrasha.edu.bd',
        name: 'মাওলানা মাহমুদুর রহমান (সহকারী শিক্ষক)',
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
    setModeState('viewer');
    setIsAuthReady(true);
    setActiveTabState('dashboard');
    setActiveAppUserId(null);
    localStorage.removeItem('madrasha_active_app_user_id');
    localStorage.removeItem('madrasha_active_auth_session');
    localStorage.setItem('madrasha_app_mode', 'viewer');
    localStorage.setItem('madrasha_active_tab', 'dashboard');
  };

  // ------------------------------------------------------------------
  // Login gate (Nov 2026 — delete-effective auth, audit follow-up).
  // A Firebase account survives staff deletion (deleteTeacher removes
  // teachers[]/users[]/members but there is no deleteUser without a
  // service account), so Firebase-first login used to mint a
  // teacher-stamped session for a deleted person. Two layers close it:
  //  (A) signInWithEmail / loginWithEmailOrPhone deny at login time
  //      (fresh cloud read when local lists do not back the account);
  //  (C) this effect denies restored sessions as soon as the first
  //      cloud snapshot lands. Owner always passes; users[]-matched
  //      and teacher-matched sessions are untouched; pending members
  //      never reach here (their gates block earlier). A failed cloud
  //      read fails OPEN — the snapshot gate still denies once cloud
  //      truth arrives. The message clears on the next successful
  //      Firebase sign-in (see the effect below).
  // ------------------------------------------------------------------
  const [authDeniedMessage, setAuthDeniedMessage] = useState<string | null>(null);

  const readStoredSessionUid = (): string | null => {
    try {
      const raw = localStorage.getItem('madrasha_active_auth_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed.uid === 'string') ? parsed.uid : null;
    } catch { return null; }
  };

  useEffect(() => {
    if (authUser) setAuthDeniedMessage(null);
  }, [authUser]);

  // Deliberately UNGUARDED by uid: the check re-runs on every lists
  // change, so a user deleted WHILE still logged in is denied on the
  // next snapshot too — not only on the next login. The checks are
  // cheap some() scans and no-ops for backed sessions; denial clears
  // the session, so there is no loop.
  useEffect(() => {
    if (!hasLoadedRemoteRef.current) return;
    // Case 1: Firebase session (restored or freshly signed in).
    if (authUser) {
      const email = (authUser.email || '').toLowerCase();
      if (email === SUPER_ADMIN_EMAIL.toLowerCase()) return;
      const storedUid = readStoredSessionUid();
      const canonicalDigits = /^staff\.(\d+)@madrashasystem\.com$/.exec(email)?.[1];
      const backed =
        users.some(u => u.id === authUser.uid || (u.email && u.email.toLowerCase() === email)) ||
        teachers.some(t => t.email && t.email.toLowerCase() === email) ||
        (canonicalDigits ? (users.some(u => (u.phone || '').replace(/[^0-9]/g, '') === canonicalDigits) || teachers.some(t => (t.phone || '').replace(/[^0-9]/g, '') === canonicalDigits)) : false) ||
        (storedUid ? (users.some(u => u.id === storedUid) || teachers.some(t => t.id === storedUid)) : false);
      if (!backed) {
        logoutAdmin();
        setAuthDeniedMessage(ACCOUNT_LOGIN_DENIED);
      }
      return;
    }
    // Case 2: local-only session (no Firebase user) whose record is
    // gone from both lists after hydration (stale-device phone login).
    const localId = activeAppUserId || currentMember?.uid || null;
    if (!localId) return;
    const backedLocal = users.some(u => u.id === localId) || teachers.some(t => t.id === localId);
    if (!backedLocal) {
      setActiveAppUserId(null);
      setCurrentMember(null);
      try {
        localStorage.removeItem('madrasha_active_app_user_id');
        localStorage.removeItem('madrasha_active_auth_session');
      } catch {}
      setAuthDeniedMessage(ACCOUNT_LOGIN_DENIED);
    }
  }, [authUser, users, teachers, activeAppUserId, currentMember]);

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
    // Truthful-save Step 2: compute the next list once, set it, and
    // return it — the caller passes it to confirmStudentsCloudSync, so
    // the cloud write carries exactly what was saved (never a stale
    // render-time list, never a re-derived one).
    const nextStudents = [...students, finalStudent];
    setStudents(nextStudents);
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_CREATED',
        student: finalStudent,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
    return { student: finalStudent, students: nextStudents };
  };

  const updateStudent = (updatedStudent: Student) => {
    const existing = students.find(s => s.id === updatedStudent.id);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { student: finalStudent } = existing 
      ? buildUpdateStudentPayload(existing, updatedStudent, actor)
      : { student: updatedStudent };
    const nextStudents = students.map(s => s.id === finalStudent.id ? finalStudent : s);
    setStudents(nextStudents);
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_UPDATED',
        student: finalStudent,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, classLevel: existing.classLevel, status: existing.status } : null
      });
    }
    return { student: finalStudent, students: nextStudents };
  };

  // Truthful-save Step 2-বাকি: single batched set for callers that
  // update MANY students in one event (StudentPromotionModal). The
  // per-student updateStudent reads render-time `students`, so calling
  // it in a loop keeps only the last student's change (last setState
  // wins) — this batched setter is the loop-safe path, and the caller
  // passes the same list to confirmStudentsCloudSync.
  const bulkUpdateStudents = (nextStudents: Student[]) => {
    setStudents(nextStudents);
    return nextStudents;
  };

  const deleteStudent = (id: string) => {
    const st = students.find(s => s.id === id);
    if (!st) return null;
    const trashEntry: TrashItem = { id: generateId(), type: 'student', data: st, deletedAt: new Date().toLocaleString() };
    const nextTrashBin = [trashEntry, ...trashBin];
    const nextStudents = students.filter(s => s.id !== id);
    setTrashBin(nextTrashBin);
    setStudents(nextStudents);
    if (authUser) {
      recordStudentAuditEvent({
        action: 'STUDENT_ARCHIVED',
        student: st,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
      });
    }
    return { students: nextStudents, trashBin: nextTrashBin };
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
  const addTeacher = async (teacherData: Omit<AcademicTeacher, 'id'>, loginRole?: UserRole): Promise<{ success: boolean; message?: string; provisioning?: 'synced' | 'skipped' | 'failed'; nextTeachers?: AcademicTeacher[]; nextUsers?: AppUser[] }> => {
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { teacher, error } = buildCreateTeacherPayload(teacherData, 'inst_madrasah_primary', actor, teachers);
    if (!teacher) {
      // Validation failed (e.g. duplicate employee code) — surface it instead
      // of silently doing nothing while the UI shows a success toast.
      return { success: false, message: error || 'তথ্য যাচাইয়ে সমস্যা হয়েছে।' };
    }
    if (teacher) {
      // The login role comes from the explicit role chosen in the staff form;
      // without one it is derived from the designation — never hard-coded,
      // otherwise every staff member (e.g. the accountant) becomes a teacher.
      const effectiveRole: UserRole = loginRole ?? deriveRoleFromDesignation(teacher.designation);
      const rawPassword = teacherData.password?.trim() || '123456';
      const cleanEmail = teacher.email?.trim().toLowerCase() || undefined;
      const cleanPhone = teacher.phone?.trim() || '';
      // Multi-role: additional roles chosen in the staff form ride on
      // teacherData.additionalRoles; they are written to the staff
      // record, the login account and the member document together so
      // the three never disagree.
      const additionalRoles = sanitizeAdditionalRoles(teacherData.additionalRoles, effectiveRole);

      const teacherWithCredentials: AcademicTeacher = {
        ...teacher,
        password: rawPassword,
        email: cleanEmail,
        additionalRoles: additionalRoles.length > 0 ? additionalRoles : undefined,
        status: teacherData.status || 'ACTIVE'
      };

      // Truthful-save Step 2: next lists computed once, set, and
      // returned — the caller passes them to confirmStaffCloudSync.
      const nextTeachers = [...teachers, teacherWithCredentials];
      setTeachers(nextTeachers);
      
      // Auto-sync into institution members store with teacher.id as UID
      const memberData: InstitutionMember = {
        uid: teacher.id,
        institutionId: 'inst_madrasah_primary',
        email: cleanEmail || (cleanPhone ? `teacher.${cleanPhone.replace(/[^0-9]/g, '')}@madrasha.local` : `teacher.${teacher.id}@madrasha.local`),
        displayName: teacher.nameBn || teacher.name,
        phone: cleanPhone,
        password: rawPassword,
        roleId: `role_${effectiveRole}`,
        additionalRoleIds: additionalRoles.map(r => roleKeyToRoleId(r)),
        requestedRole: teacher.designation || 'সহকারী শিক্ষক (Teacher)',
        status: 'active',
        assignedClasses: teacher.assignedClasses || [],
        assignedSubjects: teacher.assignedSubjects || [],
        createdAt: teacher.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setInstitutionMember('inst_madrasah_primary', memberData, teacher.id).catch(() => {});

      // Auto-create/sync AppUser in users list for direct login
      const userObj: AppUser = {
        id: teacher.id,
        name: teacher.name,
        nameBn: teacher.nameBn || teacher.name,
        phone: cleanPhone,
        email: cleanEmail,
        password: rawPassword,
        role: effectiveRole,
        additionalRoles: additionalRoles.length > 0 ? [...additionalRoles] : undefined,
        designation: teacher.designation || 'মুয়াল্লিম / সহকারী শিক্ষক',
        assignedClasses: teacher.assignedClasses || [],
        status: 'active',
        createdAt: teacher.createdAt || new Date().toISOString()
      };

      const nextUsers = [
        userObj,
        ...users.filter(u => 
          u.id !== teacher.id && 
          (!cleanEmail || u.email?.toLowerCase() !== cleanEmail) &&
          (!cleanPhone || u.phone !== cleanPhone)
        )
      ];
      setUsers(nextUsers);

      if (authUser) {
        recordTeacherAuditEvent({
          action: 'TEACHER_CREATED',
          teacher: teacherWithCredentials,
          actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' }
        });
      }

      // Auto-provisioning, creation-time (25 Oct 2026): on a secondary
      // app instance, so the admin's session is never disturbed. Real
      // email + stored password only — phone-only records (no email)
      // are skipped and self-heal on first login instead. Step 2
      // truthfulness change: the result is now AWAITED and reported
      // instead of fire-and-forget — the old create toast claimed
      // "login account created" even when provisioning failed. The
      // provisioning mechanism itself is unchanged; a failure still
      // never blocks creation, it only changes the toast, and the
      // staff member's next login still retries automatically.
      let provisioning: 'synced' | 'skipped' | 'failed' = 'skipped';
      const staffCanonical = getStaffCanonicalEmail(cleanEmail, cleanPhone, teacher.id);
      if (staffCanonical && rawPassword) {
        try {
          const result = await provisionStaffFirebaseUser(staffCanonical, rawPassword, cleanPhone, teacher.id);
          provisioning = result === 'failed' ? 'failed' : 'synced';
        } catch {
          provisioning = 'failed';
        }
      }
      return { success: true, provisioning, nextTeachers, nextUsers };
    }
    return { success: true };
  };

  // Permanently remove a staff member everywhere at once: the staff record,
  // the linked login account and the institution-member entry. Deleting only
  // one of these used to leave the others behind, so the person kept showing
  // up in the directory and could even log back in via the teachers fallback.
  const deleteTeacher = async (teacherId: string): Promise<{ success: boolean; message?: string }> => {
    const target = teachers.find(t => t.id === teacherId);
    const linkedUser = users.find(u => u.id === teacherId);
    const email = (target?.email || linkedUser?.email || '').toLowerCase();
    // Phase 2: id OR verified-email ONLY — phone NEVER matches. The
    // old phone rule is exactly what made Arafat undeletable (his
    // dummy number collides with the owner's) and what risked deleting
    // the wrong person on a shared or mistyped number.
    const matches = (x: { id: string; email?: string }) =>
      x.id === teacherId ||
      (email !== '' && (x.email || '').toLowerCase() === email);

    const matchedUsers = users.filter(matches);
    // Phase 2 narrowed guard (not removed): block ONLY the owner
    // record or the admin's own record — never any other record.
    // The owner message is used ONLY when it really is the owner.
    const adminUid = authUser?.uid;
    const adminIsOwner = (authUser?.email || adminEmail || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isOwnerTarget =
      (email !== '' && email === SUPER_ADMIN_EMAIL.toLowerCase()) ||
      matchedUsers.some(u => (u.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    if (isOwnerTarget || (adminUid && teacherId === adminUid && adminIsOwner)) {
      return { success: false, message: 'এটা মালিকের অ্যাকাউন্ট, মোছা যাবে না।' };
    }
    if (adminUid && teacherId === adminUid) {
      return { success: false, message: 'নিজের অ্যাকাউন্ট এখান থেকে মোছা যাবে না।' };
    }

    // Lists as they must look after this delete — computed from the same
    // closure values the guard above used, so the forced cloud write
    // below carries exactly the deletion (React state updates are async,
    // so awaiting the regular forcePushToCloud here would still push the
    // OLD lists containing the deleted record).
    const remainingTeachers = teachers.filter(t => !matches(t));
    const remainingUsers = users.filter(u => !matches(u));

    setTeachers(prev => prev.filter(t => !matches(t)));
    setUsers(prev => prev.filter(u => !matches(u)));

    // Cloud confirmation (25 Oct 2026 follow-up): previously this returned
    // success unconditionally while the real cloud write lived in the
    // debounced auto-sync and could fail silently (unauthenticated
    // session, offline) — so a "deleted" record came back on the next
    // hydration. Now the main_store teachers/users write is awaited here
    // and a failure is reported plainly instead of a false success. The
    // write touches ONLY teachers/users (+ metadata) so no other
    // collection can be disturbed; the regular auto-sync still runs after
    // the state change and rewrites the same filtered lists.
    const cloudSync = await confirmDeleteCloudSync(() =>
      setDoc(doc(db, 'institution', 'main_store'), {
        teachers: remainingTeachers,
        users: remainingUsers,
        updatedBy: currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'system_user',
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    );
    if (!cloudSync.success) {
      setCloudStatus('error');
      return { success: false, message: cloudSync.message };
    }
    setCloudStatus('connected');
    setCloudLastSynced(new Date().toLocaleTimeString());
    // Phase 2 honest member cleanup: member docs are deleted ONLY
    // after the cloud confirm (never before), and partial failures are
    // reported instead of swallowed.
    const memberUids = Array.from(new Set([teacherId, ...matchedUsers.map(u => u.id)]));
    const memberRes = await deleteInstitutionMembers('inst_madrasah_primary', memberUids);
    try { await refreshPendingMembers(); } catch {}
    if (!memberRes.ok) {
      return { success: true, message: `শিক্ষক/কর্মী ও তার লগইন অ্যাকাউন্ট মুছে ফেলা হয়েছে। তবে ${memberRes.failedUids.length}টি member তথ্য মোছা যায়নি — আবার চেষ্টা করুন।` };
    }
    return { success: true, message: 'শিক্ষক/কর্মী ও তার লগইন অ্যাকাউন্ট সম্পূর্ণভাবে মুছে ফেলা হয়েছে।' };
  };

  // Truthful-save cloud confirmation (25 Oct 2026) — teacher attendance
  // and accountant fee collections only. Both previously showed success
  // on local save while the real cloud write lived in the debounced
  // auto-sync and could fail silently. These functions await a targeted
  // one-field main_store write (deleteTeacher template) and report the
  // truth: success only on a confirmed write, otherwise a failure that
  // keeps the data local and queues it for retry. They never drop local
  // data, never touch other fields, and never change the auto-sync
  // behavior for other operations.
  const confirmActorName = () =>
    currentUser?.name || currentUser?.email || auth.currentUser?.email || authUser?.email || adminEmail || 'system_user';

  const confirmAttendanceCloudSync = async (): Promise<CloudConfirmResult> => {
    const records = dailyAttendanceService.getAllStudentRecords();
    setDailyStudentAttendance(records);
    const result = await confirmCloudWrite(
      () => writeAttendanceFieldToCloud(records, confirmActorName()),
      ATTENDANCE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('attendance');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('attendance');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmStaffAttendanceCloudSync = async (): Promise<CloudConfirmResult> => {
    const records = dailyAttendanceService.getAllStaffRecords();
    setDailyStaffAttendance(records);
    const result = await confirmCloudWrite(
      () => writeStaffAttendanceFieldToCloud(records, confirmActorName()),
      ATTENDANCE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('staffAttendance');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('staffAttendance');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmFeeCloudSync = async (
    nextTransactions?: FinanceTransaction[],
    failureMessage?: string
  ): Promise<CloudConfirmResult> => {
    // Callers pass the post-add list ([created, ...prev]) because the
    // setState from addTransaction has not landed yet at save time.
    // The no-arg retry path reads through transactionsRef instead.
    const list = nextTransactions ?? transactionsRef.current;
    const result = await confirmCloudWrite(
      () => writeTransactionsFieldToCloud(list, confirmActorName()),
      failureMessage || FEE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('fee');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('fee');
      setCloudStatus('error');
    }
    return result;
  };

  // Truthful-save Step 2 (25 Oct 2026): the same pattern for marks,
  // students, student delete, staff, notices, and schedule. Save-time
  // callers pass explicit next-lists (state has not landed yet); the
  // no-arg retry path reads through the refs above. Schedule reads the
  // academicScheduleService singleton (always fresh, like attendance).
  const confirmMarksCloudSync = async (
    nextMarks?: MarkRecord[]
  ): Promise<CloudConfirmResult> => {
    const list = nextMarks ?? marksRef.current;
    const result = await confirmCloudWrite(
      () => writeMarksFieldToCloud(list, confirmActorName()),
      MARKS_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('marks');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('marks');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmStudentsCloudSync = async (
    nextStudents?: Student[]
  ): Promise<CloudConfirmResult> => {
    const list = nextStudents ?? studentsRef.current;
    const result = await confirmCloudWrite(
      () => writeStudentsFieldToCloud(list, confirmActorName()),
      STUDENTS_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('students');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('students');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmStudentDeleteCloudSync = async (
    nextStudents?: Student[],
    nextTrashBin?: TrashItem[]
  ): Promise<CloudConfirmResult> => {
    const studentList = nextStudents ?? studentsRef.current;
    const trashList = nextTrashBin ?? trashBinRef.current;
    const result = await confirmCloudWrite(
      () => writeStudentDeleteFieldsToCloud(studentList, trashList, confirmActorName()),
      STUDENT_DELETE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('studentDelete');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('studentDelete');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmStaffCloudSync = async (
    nextTeachers?: AcademicTeacher[],
    nextUsers?: AppUser[]
  ): Promise<CloudConfirmResult> => {
    const teacherList = nextTeachers ?? teachersRef.current;
    const userList = nextUsers ?? usersRef.current;
    const result = await confirmCloudWrite(
      () => writeStaffFieldsToCloud(teacherList, userList, confirmActorName()),
      STAFF_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('staff');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('staff');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmNoticesCloudSync = async (
    nextNotices?: NoticeItem[]
  ): Promise<CloudConfirmResult> => {
    const list = nextNotices ?? noticesRef.current;
    const result = await confirmCloudWrite(
      () => writeNoticesFieldToCloud(list, confirmActorName()),
      NOTICES_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('notices');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('notices');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmScheduleCloudSync = async (): Promise<CloudConfirmResult> => {
    const result = await confirmCloudWrite(
      () => writeScheduleFieldsToCloud(
        academicScheduleService.getRoutines(),
        academicScheduleService.getSyllabusItems(),
        academicScheduleService.getCalendarEvents(),
        confirmActorName()
      ),
      SCHEDULE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('schedule');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('schedule');
      setCloudStatus('error');
    }
    return result;
  };

  // Step 4 (25 Oct 2026): staff leave records — staff-submitted requests
  // (always PENDING) and admin approve/reject decisions share this one
  // confirmed write. Admin-entered leaves keep their existing direct
  // setStaffLeaves path; only the mobile request and the decision
  // transitions go through here.
  const confirmLeavesCloudSync = async (
    nextLeaves?: StaffLeaveRecord[]
  ): Promise<CloudConfirmResult> => {
    const list = nextLeaves ?? staffLeavesRef.current;
    const result = await confirmCloudWrite(
      () => writeStaffLeavesFieldToCloud(list, confirmActorName()),
      LEAVE_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('leaves');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('leaves');
      setCloudStatus('error');
    }
    return result;
  };

  // Truthful-save for Fee Setup (2 Nov 2026): fee-structure and fee-type
  // saves confirm against cloud before the UI reports success. Save-time
  // callers pass explicit next-lists (state has not landed yet); the
  // no-arg retry path reads through the refs above.
  const confirmFeeStructuresCloudSync = async (
    nextStructures?: ClassFeeStructure[]
  ): Promise<CloudConfirmResult> => {
    const list = nextStructures ?? feeStructuresRef.current;
    const result = await confirmCloudWrite(
      () => writeFeeStructuresFieldToCloud(list, confirmActorName()),
      FEE_STRUCTURES_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('feeStructures');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('feeStructures');
      setCloudStatus('error');
    }
    return result;
  };

  const confirmFeeTypesCloudSync = async (
    nextTypes?: FeeTypeDef[]
  ): Promise<CloudConfirmResult> => {
    const list = nextTypes ?? feeTypesRef.current;
    const result = await confirmCloudWrite(
      () => writeFeeTypesFieldToCloud(list, confirmActorName()),
      FEE_TYPES_CLOUD_FAILURE_MESSAGE
    );
    if (result.success) {
      clearPendingConfirm('feeTypes');
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } else {
      queuePendingConfirm('feeTypes');
      setCloudStatus('error');
    }
    return result;
  };

  // Retry for the truthful-save paths (no general sync queue).
  // Runs on app start, when the user returns to the foreground, when the
  // device comes back online, and when a signed-in session appears
  // (covers a fresh login healing a previously local-only session).
  // Silent in both directions: a failed retry stays queued for the next
  // trigger, and the user is never spammed — the save-time failure
  // notice is where the retry action lives. Skipped without an identity
  // (the write rule would deny it) or while offline.
  const retryInFlightRef = useRef(false);
  const retryPendingCloudConfirms = async (): Promise<void> => {
    if (retryInFlightRef.current) return;
    const pending = readPendingConfirms();
    if (pending.length === 0) return;
    const hasSession = !!(auth.currentUser || localStorage.getItem('madrasha_active_auth_session') || localStorage.getItem('madrasha_active_app_user_id'));
    if (!hasSession) return;
    retryInFlightRef.current = true;
    try {
      if (pending.includes('attendance')) await confirmAttendanceCloudSync();
      if (pending.includes('staffAttendance')) await confirmStaffAttendanceCloudSync();
      if (pending.includes('fee')) await confirmFeeCloudSync();
      if (pending.includes('marks')) await confirmMarksCloudSync();
      if (pending.includes('students')) await confirmStudentsCloudSync();
      if (pending.includes('studentDelete')) await confirmStudentDeleteCloudSync();
      if (pending.includes('staff')) await confirmStaffCloudSync();
      if (pending.includes('notices')) await confirmNoticesCloudSync();
      if (pending.includes('schedule')) await confirmScheduleCloudSync();
      if (pending.includes('leaves')) await confirmLeavesCloudSync();
      if (pending.includes('feeStructures')) await confirmFeeStructuresCloudSync();
      if (pending.includes('feeTypes')) await confirmFeeTypesCloudSync();
    } finally {
      retryInFlightRef.current = false;
    }
  };

  useEffect(() => {
    retryPendingCloudConfirms();
    const onVisible = () => {
      if (document.visibilityState === 'visible') retryPendingCloudConfirms();
    };
    const onOnline = () => retryPendingCloudConfirms();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
    // Intentionally once: the retry reads fresh data through the service
    // singleton / transactionsRef, never through render-time state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authUser) retryPendingCloudConfirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // One-time banner fee seeding (2 Nov 2026): the principal's confirmed
  // banner fee chart becomes the saved Fee Setup defaults. Runs once per
  // boot, only after the first server snapshot has settled
  // (cloudHydrated — never from an unsettled view) and only with a
  // signed-in session (main_store writes are authenticated-only).
  // Data-driven guard — it can never overwrite his later edits:
  //  - structures: seed ONLY banner classes with no saved structure,
  //    plus Play ONLY while it is still exactly the old legacy state
  //    (500 tuition, nothing else — isUnmigratedLegacyPlayStructure).
  //  - types: ensure the banner's types (admission, admission_form,
  //    exam) exist and are enabled; every other stored row is untouched
  //    (session / registration / form fillup / book / food keep their
  //    stored enabled flags and amounts exactly as they are).
  // Once seeded, every banner class has a structure and Play is no
  // longer legacy, so the guard is false forever — a Fee Setup edit +
  // Save is never reset by re-seeding. Writes go ONLY through the
  // confirmed union writers (never the wholesale auto-sync); a failure
  // queues the 'feeStructures'/'feeTypes' kinds for the existing retry
  // path and no success is claimed (this effect shows no toast).
  const bannerFeeSeedAttemptedRef = useRef(false);
  useEffect(() => {
    if (!cloudHydrated || !authUser) return;
    if (bannerFeeSeedAttemptedRef.current) return;
    bannerFeeSeedAttemptedRef.current = true;
    const seed = async () => {
      const currentStructures = feeStructuresRef.current;
      const byLevel = new Map<string, ClassFeeStructure>();
      currentStructures.forEach(s => { if (s.classLevel) byLevel.set(s.classLevel, s); });
      const toSeed: ClassFeeStructure[] = [];
      Object.entries(BANNER_CLASS_FEES).forEach(([classLevel, fees]) => {
        const existing = byLevel.get(classLevel);
        if (!existing) {
          const cls = classes.find(c => c.name === classLevel);
          if (!cls) return;
          toSeed.push({
            id: `fs-${cls.id}`,
            classLevel,
            monthlyTuition: fees.tuition,
            admissionFee: fees.admission,
            examFee: fees.exam,
            boardingFee: 0,
            bookFee: 0,
            amounts: { tuition: fees.tuition, admission: fees.admission, admission_form: fees.admission_form, exam: fees.exam },
          });
        } else if (isUnmigratedLegacyPlayStructure(existing)) {
          toSeed.push({
            id: existing.id,
            classLevel,
            monthlyTuition: fees.tuition,
            admissionFee: fees.admission,
            examFee: fees.exam,
            boardingFee: 0,
            bookFee: 0,
            amounts: { tuition: fees.tuition, admission: fees.admission, admission_form: fees.admission_form, exam: fees.exam },
          });
        }
      });
      if (toSeed.length > 0) {
        const nextStructures = currentStructures.slice();
        toSeed.forEach(s => {
          const idx = nextStructures.findIndex(f => f.classLevel === s.classLevel);
          if (idx >= 0) nextStructures[idx] = s;
          else nextStructures.push(s);
        });
        setFeeStructures(nextStructures);
        // Minimal payload: the union writer appends/replaces only these
        // classLevels, so a concurrent edit to any other class is kept.
        await confirmFeeStructuresCloudSync(toSeed);
      }

      const currentTypes = feeTypesRef.current;
      const nextTypes = currentTypes.slice();
      const touchedTypes: FeeTypeDef[] = [];
      (['admission', 'exam', 'admission_form'] as const).forEach(id => {
        const idx = nextTypes.findIndex(t => t.id === id);
        if (idx < 0) {
          const fallback = DEFAULT_FEE_TYPES.find(t => t.id === id);
          if (!fallback) return;
          nextTypes.push(fallback);
          touchedTypes.push(fallback);
        } else if (!nextTypes[idx].enabled) {
          const updated = { ...nextTypes[idx], enabled: true };
          nextTypes[idx] = updated;
          touchedTypes.push(updated);
        }
      });
      if (touchedTypes.length > 0) {
        setFeeTypes(nextTypes);
        // Minimal payload: the id-union writer keeps every other stored
        // row exactly as it is.
        await confirmFeeTypesCloudSync(touchedTypes);
      }
    };
    void seed();
    // Intentionally once per boot (ref-guarded) and gated on the settled
    // snapshot + session; the refs mirror the snapshot-applied state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudHydrated, authUser, classes]);

  const updateTeacher = async (updatedTeacher: AcademicTeacher, loginRole?: UserRole): Promise<StaffCredentialSyncStatus & { nextTeachers?: AcademicTeacher[]; nextUsers?: AppUser[]; error?: string }> => {
    const existing = teachers.find(t => t.id === updatedTeacher.id);
    // Keep the login role in step with the staff form's role choice;
    // without an explicit choice, derive it from the designation.
    const effectiveRole: UserRole = loginRole ?? deriveRoleFromDesignation(updatedTeacher.designation);
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;
    const { teacher, error: validationError } = existing
      ? buildUpdateTeacherPayload(existing, updatedTeacher, actor, teachers)
      : { teacher: updatedTeacher, error: undefined };
    // Phase 2 edit validation: a payload error (duplicate code,
    // invalid email, ...) must STOP the save here. The old code
    // ignored the error, saved the OLD record, and the caller showed
    // a success toast — the edit looked saved while nothing changed.
    if (validationError) {
      return { status: 'failed', reason: 'invalid-input', error: validationError };
    }

    // Never invent a password: blank keeps the stored one, and a record
    // with no password anywhere stays passwordless (29 Oct 2026).
    const rawPassword = updatedTeacher.password?.trim() || existing?.password || '';
    const cleanEmail = teacher.email?.trim().toLowerCase() || undefined;
    const cleanPhone = teacher.phone?.trim() || '';
    // Multi-role: the form passes additionalRoles on updatedTeacher;
    // when a caller does not mention them (e.g. quick-approve), keep
    // the ones already stored on the record.
    const additionalRoles = sanitizeAdditionalRoles(
      updatedTeacher.additionalRoles ?? existing?.additionalRoles,
      effectiveRole
    );

    const teacherWithCredentials: AcademicTeacher = {
      ...teacher,
      password: rawPassword,
      email: cleanEmail,
      phone: cleanPhone,
      additionalRoles: additionalRoles.length > 0 ? additionalRoles : undefined,
      status: updatedTeacher.status || teacher.status || 'ACTIVE'
    };

    // Truthful-save Step 2: next lists computed once (same mapping the
    // setters used to do inline), set, and returned — the caller passes
    // them to confirmStaffCloudSync.
    const nextTeachers = teachers.map(t => t.id === teacher.id ? teacherWithCredentials : t);
    setTeachers(nextTeachers);

    // Update in users
    const nextUsers = users.map(u => {
      if (u.id === teacher.id || (cleanEmail && u.email?.toLowerCase() === cleanEmail) || (cleanPhone && u.phone === cleanPhone)) {
        return {
          ...u,
          name: teacher.name,
          nameBn: teacher.nameBn || teacher.name,
          email: cleanEmail,
          phone: cleanPhone,
          password: rawPassword,
          designation: teacher.designation,
          role: effectiveRole,
          additionalRoles: additionalRoles.length > 0 ? [...additionalRoles] : undefined,
          assignedClasses: teacher.assignedClasses || [],
          status: 'active'
        };
      }
      return u;
    });
    setUsers(nextUsers);

    // Update in institution members
    const memberData: InstitutionMember = {
      uid: teacher.id,
      institutionId: 'inst_madrasah_primary',
      email: cleanEmail || (cleanPhone ? `teacher.${cleanPhone.replace(/[^0-9]/g, '')}@madrasha.local` : `teacher.${teacher.id}@madrasha.local`),
      displayName: teacher.nameBn || teacher.name,
      phone: cleanPhone,
      password: rawPassword,
      roleId: `role_${effectiveRole}`,
      additionalRoleIds: additionalRoles.map(r => roleKeyToRoleId(r)),
      requestedRole: teacher.designation || 'সহকারী শিক্ষক (Teacher)',
      status: 'active',
      assignedClasses: teacher.assignedClasses || [],
      assignedSubjects: teacher.assignedSubjects || [],
      createdAt: teacher.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setInstitutionMember('inst_madrasah_primary', memberData, teacher.id).catch(() => {});

    if (authUser) {
      recordTeacherAuditEvent({
        action: 'TEACHER_UPDATED',
        teacher: teacherWithCredentials,
        actor: { uid: authUser.uid, email: authUser.email || '', role: authRole || 'admin' },
        before: existing ? { name: existing.name, designation: existing.designation, status: existing.status } : null
      });
    }

    // Firebase credential sync (25 Oct 2026 follow-up): the app record
    // above is authoritative and already saved; the Firebase user still
    // holds the old credentials. Sync only when a credential actually
    // changed — the local change is never blocked and this never throws.
    const syncNeed = resolveCredentialSyncNeed(
      existing ? { password: existing.password, email: existing.email } : undefined,
      rawPassword,
      cleanEmail,
      effectiveRole
    );
    if (syncNeed === 'not-needed') return { status: 'not-needed', nextTeachers, nextUsers };
    if (syncNeed === 'skipped-no-prior') return { status: 'skipped', reason: 'no-prior-record', nextTeachers, nextUsers };
    if (syncNeed === 'skipped-non-staff') return { status: 'skipped', reason: 'non-staff-role', nextTeachers, nextUsers };
    if (syncNeed === 'skipped-no-email') return { status: 'skipped', reason: 'no-email', nextTeachers, nextUsers };
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) return { status: 'failed', reason: 'admin-not-signed-in', nextTeachers, nextUsers };
      const credential = await syncStaffCredentialToFirebase({
        idToken: token,
        oldEmail: existing?.email?.trim().toLowerCase() || undefined,
        email: cleanEmail,
        password: (rawPassword && rawPassword !== existing?.password) ? rawPassword : undefined,
      });
      return { ...credential, nextTeachers, nextUsers };
    } catch {
      return { status: 'failed', reason: 'network', nextTeachers, nextUsers };
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
    if (!newMarks || newMarks.length === 0) return [] as MarkRecord[];
    const actor = authUser ? { uid: authUser.uid, email: authUser.email || '' } : undefined;

    // Truthful-save Step 2: the merged list is computed once (same
    // merge the setter used to do inline), set, and returned — the
    // caller passes it to confirmMarksCloudSync. Note: this reads the
    // render-time `marks` instead of the setter's `prev`; every caller
    // today invokes it once per save event, so the two are identical.
    const marksMap = new Map<string, MarkRecord>();
    marks.forEach(m => marksMap.set(`${m.studentId}-${m.subjectId}-${m.examId}`, m));

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

    const mergedMarks = Array.from(marksMap.values());
    setMarks(mergedMarks);

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
    return mergedMarks;
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
        examFee: details?.examFee,
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

  const updateFeeTypes = (types: FeeTypeDef[]) => {
    setFeeTypes(types);
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

  // Confirmation lives at the single call site (DataSecurityBackupCenter's
  // ConfirmDialog) — this action itself just empties the bin.
  const emptyTrash = () => {
    setTrashBin([]);
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
      localStorage.setItem('madrasha_transactions', JSON.stringify([]));
      localStorage.setItem('promotionHistory', JSON.stringify([]));
      localStorage.setItem('madrasha_notices', JSON.stringify([]));
      localStorage.setItem('madrasha_fee_structures', JSON.stringify([]));
      localStorage.setItem('madrasah_staff_leaves', JSON.stringify([]));
      localStorage.setItem('madrasah_books_catalog', JSON.stringify([]));
      localStorage.setItem('madrasah_book_issues', JSON.stringify([]));
      localStorage.setItem('madrasah_transport_vehicles', JSON.stringify([]));
      localStorage.setItem('madrasah_transport_roster', JSON.stringify([]));
      localStorage.setItem('madrasah_mahfil_events', JSON.stringify([]));
      localStorage.setItem('madrasah_cocurricular_clubs', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_assets', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_store', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_movements', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_houses', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_house_logs', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_alumni', JSON.stringify([]));
      localStorage.setItem('madrasha_ops_v1_health', JSON.stringify([]));
      localStorage.setItem('madrasha_admissions_v1', JSON.stringify([]));
      localStorage.setItem('madrasah_admissions_v1', JSON.stringify([]));
      localStorage.setItem('madrasha_sms_logs_v1', JSON.stringify([]));
      localStorage.setItem('madrasha_welfare_v1', JSON.stringify([]));

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
          feeStructures: [],
          updatedAt: new Date().toISOString(),
          updatedBy: authUser?.email || adminEmail || SUPER_ADMIN_EMAIL
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
    const dict = (translations as Record<string, Record<string, string>>)[language];
    return dict?.[key] || translations['en'][key] || key;
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
      cloudHydrated,
      cloudHydrationTimedOut,
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
      deleteTeacher,
      staffLeaves,
      setStaffLeaves,
      dailyStudentAttendance,
      dailyStaffAttendance,
      classRoutines,
      syllabusItems,
      calendarEvents,
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
      bulkUpdateStudents,
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
      confirmAttendanceCloudSync,
      confirmStaffAttendanceCloudSync,
      confirmFeeCloudSync,
      confirmMarksCloudSync,
      confirmStudentsCloudSync,
      confirmStudentDeleteCloudSync,
      confirmStaffCloudSync,
      confirmNoticesCloudSync,
      confirmScheduleCloudSync,
      confirmLeavesCloudSync,
      confirmFeeStructuresCloudSync,
      confirmFeeTypesCloudSync,
      updateTransaction,
      deleteTransaction,
      setTransactions,
      updateFeeStructure,
      setFeeStructures,
      feeTypes,
      setFeeTypes,
      updateFeeTypes,
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
      signUpWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      loginAsDemoRole,
      logoutAdmin,
      authDeniedMessage,
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
      isOwnerAdmin,
      authContext,
      hasPermission,
      currentRole,
      effectiveRoles,
      currentMember,
      institutionRoles,
      refreshInstitutionRoles,
      users,
      setUsers,
      currentUser,
      userRole,
      pendingMembers,
      refreshPendingMembers,
      pendingMembersError,
      approveMember,
      rejectMember,
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
