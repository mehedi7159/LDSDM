import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, updateDoc, deleteDoc, startAfter } from 'firebase/firestore';
import { db, auth, firebaseConfig } from './firebase';
import { assertRestorePayloadSafe, isPublicShapedStudent } from './mainStoreWrite';
import { buildPublicPortalData } from './publicPortal';
import type {
  SchoolProfile,
  SchoolClass,
  Student,
  Subject,
  Exam,
  MarkRecord,
  RemarkRecord,
  FinanceTransaction,
  ClassFeeStructure,
  TrashItem,
  AcademicYear,
  Section,
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  ExamSubjectAssignment,
  PromotionHistoryRecord,
  GradingSystem,
  AppUser,
  StaffLeaveRecord,
  NoticeItem
} from '../types';
import { DEFAULT_GRADING_SYSTEM } from '../types';
import type { FeeTypeDef } from './feeTypes';
import type {
  DailyStudentAttendanceRecord,
  DailyStaffAttendanceRecord
} from './dailyAttendanceService';
import type {
  ClassRoutineItem,
  SyllabusItem,
  AcademicCalendarEvent
} from '../types/academic';

/**
 * ============================================================================
 * MULTI-STORE PERSISTENCE & AUTO-RECOVERY ENGINE (v3.0)
 * 
 * Provides unbreakable 4-Tier Data Resilience:
 * Tier 1: LocalStorage (Fast Synchronous UI Cache)
 * Tier 2: IndexedDB Permanent Vault (High Capacity, Persistent Storage Protected)
 * Tier 3: Cloud Firestore Vault (Realtime Sync & Cloud Historical Snapshots)
 * Tier 4: Auto-Rolling Point-in-Time Checkpoints (Up to 30 rotating snapshots)
 * Tier 5: Smart Auto-Resurrection on Startup (Auto-recovers when Chrome clears cache)
 * ============================================================================
 */

const DB_NAME = 'madrasah_permanent_vault_v2';
const DB_VERSION = 1;
const STORE_ENTITIES = 'entities';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_META = 'meta';

export interface SystemDataPayload {
  schoolProfile: SchoolProfile;
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  transactions: FinanceTransaction[];
  feeStructures: ClassFeeStructure[];
  feeTypes?: FeeTypeDef[];
  trashBin: TrashItem[];
  academicYears?: AcademicYear[];
  sections?: Section[];
  teachers?: AcademicTeacher[];
  classSubjectAssignments?: ClassSubjectAssignment[];
  teacherSubjectAssignments?: TeacherSubjectAssignment[];
  classTeacherAssignments?: ClassTeacherAssignment[];
  examSubjectAssignments?: ExamSubjectAssignment[];
  promotionHistory?: PromotionHistoryRecord[];
  gradingSystem?: GradingSystem[];
  institutionMembers?: any[];
  // Slices that live in the Firestore main_store payload / AppContext but
  // were missing from backups (Phase 2 completion): user accounts, notices
  // and staff leaves must survive a restore too.
  users?: AppUser[];
  notices?: NoticeItem[];
  staffLeaves?: StaffLeaveRecord[];
  // Daily attendance (Phase 2): synced via main_store, so it is backed up
  // and restored exactly like the core collections.
  dailyStudentAttendance?: DailyStudentAttendanceRecord[];
  dailyStaffAttendance?: DailyStaffAttendanceRecord[];
  // Academic schedule (Phase 2): routines, syllabus/lesson plans, calendar.
  classRoutines?: ClassRoutineItem[];
  syllabusItems?: SyllabusItem[];
  calendarEvents?: AcademicCalendarEvent[];
  /**
   * Raw snapshots of satellite modules that keep their data in their own
   * localStorage stores outside AppContext (library, transport, admission
   * applications, boarding, welfare, institutional operations, class
   * section details, AI advisor chat). Keyed by localStorage key. Restored
   * back to localStorage only — deliberately kept OUT of the Firestore
   * main_store document on restore.
   */
  extraLocalStores?: Record<string, any>;
}

export interface SystemDataCounts {
  students: number;
  classes: number;
  subjects: number;
  exams: number;
  marks: number;
  remarks: number;
  transactions: number;
  feeStructures: number;
  teachers: number;
  academicYears: number;
  trashBin: number;
}

export interface SystemSnapshot {
  id: string;
  timestamp: string;
  createdAt: number;
  trigger: 'auto_interval' | 'manual' | 'pre_restore' | 'pre_mutation' | 'cloud_sync' | 'resurrection';
  labelBn: string;
  labelEn: string;
  counts: SystemDataCounts;
  payload: SystemDataPayload;
  /** Phase 3: pinned snapshots are never pruned (manual, pre_restore, pre_mutation triggers). */
  pinned?: boolean;
  /** Phase 3: true when the snapshot carries students but no teachers — a degraded-state copy. */
  isDegraded?: boolean;
  /** Phase 3: % of students carrying beyond-public fields (100 when no students). */
  completenessPct?: number;
}

export interface MultiStoreHealth {
  localStorageOk: boolean;
  indexedDbOk: boolean;
  cloudSyncOk: boolean;
  persistentStorageGranted: boolean;
  totalSnapshots: number;
  lastSnapshotTime?: string;
  lastCloudSyncTime?: string;
  totalRecordsCount: number;
}

// ----------------------------------------------------------------------------
// IndexedDB Engine Initialization & Helper
// ----------------------------------------------------------------------------

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ENTITIES)) {
        db.createObjectStore(STORE_ENTITIES, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snapStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        snapStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Request persistent browser storage to prevent Chrome eviction
 */
export async function requestPersistentStorage(): Promise<{ isPersisted: boolean; quota?: number; usage?: number }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        let quota: number | undefined;
        let usage: number | undefined;
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          quota = estimate.quota;
          usage = estimate.usage;
        }
        return { isPersisted, quota, usage };
      }
    }
  } catch (err) {
    console.warn('[Storage] Persistent storage request notice:', err);
  }
  return { isPersisted: false };
}

export async function checkPersistentStorageStatus(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch (err) {
    console.warn('[Storage] Check persisted error:', err);
  }
  return false;
}

// ----------------------------------------------------------------------------
// Local Storage Snapshot Reader & Synchronizer
// ----------------------------------------------------------------------------

export function extractSystemCounts(payload: SystemDataPayload): SystemDataCounts {
  // Same rule as applyRemoteData (context/AppContext.tsx): a record whose
  // id appears in trashBin is not live — Diagnostics filters it out before
  // showing the count — so snapshots must not count it either. A student
  // deleted to trash but still present in the stored students array was
  // counted in every snapshot (174) while live showed 173.
  const trashedIds = new Set<string>();
  if (Array.isArray(payload.trashBin)) {
    payload.trashBin.forEach((t: any) => {
      if (t?.id) trashedIds.add(String(t.id));
      if (t?.data?.id) trashedIds.add(String(t.data.id));
    });
  }
  const activeStudents = Array.isArray(payload.students)
    ? payload.students.filter((s: any) => !trashedIds.has(String(s?.id)))
    : [];
  const activeTeachers = Array.isArray(payload.teachers)
    ? payload.teachers.filter((t: any) => !trashedIds.has(String(t?.id)))
    : [];
  return {
    students: activeStudents.length,
    classes: Array.isArray(payload.classes) ? payload.classes.length : 0,
    subjects: Array.isArray(payload.subjects) ? payload.subjects.length : 0,
    exams: Array.isArray(payload.exams) ? payload.exams.length : 0,
    marks: Array.isArray(payload.marks) ? payload.marks.length : 0,
    remarks: Array.isArray(payload.remarks) ? payload.remarks.length : 0,
    transactions: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
    feeStructures: Array.isArray(payload.feeStructures) ? payload.feeStructures.length : 0,
    teachers: activeTeachers.length,
    academicYears: Array.isArray(payload.academicYears) ? payload.academicYears.length : 0,
    trashBin: Array.isArray(payload.trashBin) ? payload.trashBin.length : 0,
  };
}

// ----------------------------------------------------------------------------
// Phase 3 (sync hardening, 4 Nov 2026): degraded detection, restore
// previews, and vault save options.
// ----------------------------------------------------------------------------

/** Phase 3: a state is degraded when it carries students but no teachers
 * (the 4 Nov 11:17 clobber signature). A payload without a teachers key
 * at all (pre-staff backups) is NOT judged degraded — absence of the
 * key is not evidence of loss. */
export function isDegradedPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const students = (payload as any).students;
  const teachers = (payload as any).teachers;
  return Array.isArray(students) && students.length > 0 && Array.isArray(teachers) && teachers.length === 0;
}

/** Phase 3: % of students carrying fields beyond the public-portal
 * list. 100 when there are no students (nothing to degrade). */
export function studentFieldCompletenessPct(payload: any): number {
  const students = payload && Array.isArray(payload.students) ? payload.students : [];
  if (students.length === 0) return 100;
  let full = 0;
  students.forEach((s: any) => { if (s && !isPublicShapedStudent(s)) full += 1; });
  return Math.round((full / students.length) * 100);
}

/** Phase 3: stored flag wins; older entries without flags are judged
 * from their payload. */
export function snapshotIsDegraded(snap: { isDegraded?: boolean; payload?: any }): boolean {
  if (typeof snap.isDegraded === 'boolean') return snap.isDegraded;
  return isDegradedPayload(snap.payload);
}

export function snapshotCompletenessPct(snap: { completenessPct?: number; payload?: any }): number {
  if (typeof snap.completenessPct === 'number') return snap.completenessPct;
  return studentFieldCompletenessPct(snap.payload);
}

/** Phase 3: the "last known-good" test (plan §6): teachers > 0,
 * users > 0, students > 0, and not degraded. A snapshot whose payload
 * lacks a users key (pre-users backups) fails the users condition —
 * it cannot be verified good. */
export function isLastKnownGoodSnapshot(snap: { payload?: any; isDegraded?: boolean }): boolean {
  if (snapshotIsDegraded(snap)) return false;
  const p = snap.payload || {};
  const teachers = Array.isArray(p.teachers) ? p.teachers.length : 0;
  const users = Array.isArray(p.users) ? p.users.length : 0;
  const students = Array.isArray(p.students) ? p.students.length : 0;
  return teachers > 0 && users > 0 && students > 0;
}

/** Counts compared by every restore preview. Fields absent from a
 * payload stay `undefined` (unknown) — the preview renders '—' and
 * the shrink gate skips them. */
export interface RestoreCounts {
  students?: number;
  teachers?: number;
  users?: number;
  marks?: number;
  exams?: number;
  subjects?: number;
  classes?: number;
  transactions?: number;
  remarks?: number;
  trashBin?: number;
}

const RESTORE_COUNT_FIELDS: Array<keyof RestoreCounts> = ['students', 'teachers', 'users', 'marks', 'exams', 'subjects', 'classes', 'transactions', 'remarks', 'trashBin'];

export const RESTORE_COUNT_LABELS: Record<keyof RestoreCounts, { bn: string; en: string }> = {
  students: { bn: 'শিক্ষার্থী', en: 'Students' },
  teachers: { bn: 'শিক্ষক ও স্টাফ', en: 'Teachers & staff' },
  users: { bn: 'ব্যবহারকারী', en: 'Users' },
  marks: { bn: 'নম্বর', en: 'Marks' },
  exams: { bn: 'পরীক্ষা', en: 'Exams' },
  subjects: { bn: 'বিষয়', en: 'Subjects' },
  classes: { bn: 'শ্রেণি', en: 'Classes' },
  transactions: { bn: 'লেনদেন', en: 'Transactions' },
  remarks: { bn: 'মন্তব্য', en: 'Remarks' },
  trashBin: { bn: 'রিসাইকেল বিন', en: 'Recycle bin' },
};

export function extractRestoreCounts(payload: any): RestoreCounts {
  if (!payload || typeof payload !== 'object') return {};
  const out: RestoreCounts = {};
  for (const f of RESTORE_COUNT_FIELDS) {
    const v = (payload as any)[f];
    if (Array.isArray(v)) out[f] = v.length;
  }
  return out;
}

export interface RestorePreviewRow {
  key: keyof RestoreCounts;
  labelBn: string;
  labelEn: string;
  from?: number;
  to?: number;
}

export interface RestorePreview {
  rows: RestorePreviewRow[];
  /** Shrinking fields with their preview-confirmed target sizes. */
  shrinks: Partial<Record<keyof RestoreCounts, number>>;
  isDegraded: boolean;
  completenessPct?: number;
  warningsBn: string[];
  warningsEn: string[];
  sourceLabel: string;
  sourceTime: string;
}

/** Phase 3: side-by-side current-vs-snapshot counts for EVERY restore
 * path. Shrinks and degraded snapshots become explicit warnings —
 * the user confirms THIS preview, and the restore writer refuses any
 * shrink the preview did not confirm. */
export function buildRestorePreview(
  current: RestoreCounts,
  snapshot: RestoreCounts,
  meta: { labelBn?: string; labelEn?: string; timestamp?: string; isDegraded?: boolean; completenessPct?: number }
): RestorePreview {
  const rows: RestorePreviewRow[] = [];
  const shrinks: Partial<Record<keyof RestoreCounts, number>> = {};
  const warningsBn: string[] = [];
  const warningsEn: string[] = [];
  for (const f of RESTORE_COUNT_FIELDS) {
    const from = current[f];
    const to = snapshot[f];
    rows.push({ key: f, labelBn: RESTORE_COUNT_LABELS[f].bn, labelEn: RESTORE_COUNT_LABELS[f].en, from, to });
    if (typeof from === 'number' && typeof to === 'number' && to < from) {
      shrinks[f] = to;
      warningsBn.push(`${RESTORE_COUNT_LABELS[f].bn}: ${from} → ${to} (কমবে)`);
      warningsEn.push(`${RESTORE_COUNT_LABELS[f].en}: ${from} → ${to} (will shrink)`);
    }
  }
  const isDegraded = meta.isDegraded === true;
  if (isDegraded) {
    warningsBn.unshift('এই স্ন্যাপশট ক্ষতিগ্রস্ত (degraded) অবস্থার কপি হতে পারে — এতে শিক্ষার্থী আছে কিন্তু শিক্ষক নেই। রিস্টোর করলে বর্তমান শিক্ষক তথ্য হারাতে পারে।');
    warningsEn.unshift('This snapshot may be a degraded copy — it has students but no teachers. Restoring it may lose current teacher records.');
  }
  if (typeof meta.completenessPct === 'number' && meta.completenessPct < 100) {
    warningsBn.push(`এই স্ন্যাপশটের শিক্ষার্থী রেকর্ডের মাত্র ${meta.completenessPct}% সম্পূর্ণ ফিল্ড বহন করে — বাকিগুলো শুধু পাবলিক ফিল্ডের কপি হতে পারে।`);
    warningsEn.push(`Only ${meta.completenessPct}% of this snapshot's student records carry full fields — the rest may be public-fields-only copies.`);
  }
  return {
    rows,
    shrinks,
    isDegraded,
    completenessPct: meta.completenessPct,
    warningsBn,
    warningsEn,
    sourceLabel: meta.labelBn || meta.labelEn || '',
    sourceTime: meta.timestamp || '',
  };
}

/** Phase 3 vault save options (5th arg of saveToIndexedDbVault). */
export interface VaultSaveOptions {
  /** Pin this snapshot (never pruned). Defaults by trigger below. */
  pinned?: boolean;
  /** Allow saving a degraded state. Auto triggers refuse degraded states unless this is true. */
  allowDegraded?: boolean;
}

/** Phase 3: these triggers are always pinned (plan §6). */
const PINNED_VAULT_TRIGGERS: Array<SystemSnapshot['trigger']> = ['manual', 'pre_restore', 'pre_mutation'];
/** Phase 3: these triggers are automatic — a degraded auto-save is skipped, never stored. */
const AUTO_VAULT_TRIGGERS: Array<SystemSnapshot['trigger']> = ['auto_interval', 'resurrection', 'cloud_sync'];

/**
 * localStorage keys of satellite modules that live outside AppContext
 * state. A full backup snapshots them verbatim so a restore brings those
 * modules back too. Deliberately EXCLUDED: SMS gateway config (contains an
 * API key — never export credentials), SMS/email logs (history, not data),
 * session markers and sync fingerprints.
 */
export const LOCAL_STORE_BACKUP_KEYS: string[] = [
  'madrasah_books_catalog',
  'madrasah_book_issues',
  'madrasah_transport_vehicles',
  'madrasah_transport_roster',
  'madrasah_mahfil_events',
  'madrasah_cocurricular_clubs',
  'mms_admission_applications_v1',
  'madrasah_admission_applications',
  'mms_online_admissions_v1',
  'mms_boarding_configs_v1',
  'mms_welfare_beneficiaries_v1',
  'madrasha_welfare_v1',
  'madrasha_class_sections_v1',
  'madrasha_ops_v1_assets',
  'madrasha_ops_v1_store',
  'madrasha_ops_v1_movements',
  'madrasha_ops_v1_houses',
  'madrasha_ops_v1_house_logs',
  'madrasha_ops_v1_alumni',
  'madrasha_ops_v1_health',
  'ai_principal_messages'
];

function readExtraLocalStores(): Record<string, any> {
  const out: Record<string, any> = {};
  if (typeof window === 'undefined' || !window.localStorage) return out;
  for (const key of LOCAL_STORE_BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== undefined) {
        try {
          out[key] = JSON.parse(raw);
        } catch {
          out[key] = raw;
        }
      }
    } catch {}
  }
  return out;
}

export function readCurrentLocalStoragePayload(): SystemDataPayload {
  const safeParse = <T>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      const val = localStorage.getItem(key);
      if (!val) return fallback;
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const defaultProfile: SchoolProfile = {
    name: 'MADRASHA MANAGEMENT HIGH SCHOOL',
    nameBn: 'দারুল উলুম মাদ্রাসা',
    address: 'Dhaka, Bangladesh',
    addressBn: 'ঢাকা, বাংলাদেশ',
    phone: '',
    email: '',
    academicYear: '২০২৬',
    headMasterName: 'অধ্যক্ষ সাহেব'
  };

  return {
    schoolProfile: safeParse<SchoolProfile>('schoolProfile', defaultProfile),
    students: safeParse<Student[]>('students', []),
    classes: safeParse<SchoolClass[]>('classes', []),
    subjects: safeParse<Subject[]>('subjects', []),
    exams: safeParse<Exam[]>('exams', []),
    marks: safeParse<MarkRecord[]>('marks', []),
    remarks: safeParse<RemarkRecord[]>('remarks', []),
    transactions: safeParse<FinanceTransaction[]>('madrasha_transactions', []),
    feeStructures: safeParse<ClassFeeStructure[]>('madrasha_fee_structures', []),
    feeTypes: safeParse<FeeTypeDef[]>('madrasha_fee_types', []),
    trashBin: safeParse<TrashItem[]>('madrasha_trash_bin', []),
    academicYears: safeParse<AcademicYear[]>('academicYears', []),
    sections: safeParse<Section[]>('sections', []),
    teachers: safeParse<AcademicTeacher[]>('teachers', []),
    classSubjectAssignments: safeParse<ClassSubjectAssignment[]>('classSubjectAssignments', []),
    teacherSubjectAssignments: safeParse<TeacherSubjectAssignment[]>('teacherSubjectAssignments', []),
    classTeacherAssignments: safeParse<ClassTeacherAssignment[]>('classTeacherAssignments', []),
    examSubjectAssignments: safeParse<ExamSubjectAssignment[]>('examSubjectAssignments', []),
    promotionHistory: safeParse<PromotionHistoryRecord[]>('madrasha_promotion_history', []),
    gradingSystem: safeParse<GradingSystem[]>('gradingSystem', DEFAULT_GRADING_SYSTEM),
    institutionMembers: safeParse<any[]>('madrasha_institution_members', []),
    users: safeParse<AppUser[]>('madrasha_app_users', []),
    notices: safeParse<NoticeItem[]>('madrasha_notices', []),
    staffLeaves: safeParse<StaffLeaveRecord[]>('madrasah_staff_leaves', []),
    dailyStudentAttendance: Object.values(
      safeParse<Record<string, DailyStudentAttendanceRecord>>('madrasah_daily_student_attendance', {})
    ),
    dailyStaffAttendance: Object.values(
      safeParse<Record<string, DailyStaffAttendanceRecord>>('madrasah_daily_staff_attendance', {})
    ),
    classRoutines: safeParse<ClassRoutineItem[]>('madrasha_academic_routines_v1', []),
    syllabusItems: safeParse<SyllabusItem[]>('madrasha_academic_syllabus_v1', []),
    calendarEvents: safeParse<AcademicCalendarEvent[]>('madrasha_academic_calendar_v1', []),
    extraLocalStores: readExtraLocalStores()
  };
}

export function writePayloadToLocalStorage(payload: SystemDataPayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  if (payload.schoolProfile) localStorage.setItem('schoolProfile', JSON.stringify(payload.schoolProfile));
  if (Array.isArray(payload.students)) localStorage.setItem('students', JSON.stringify(payload.students));
  if (Array.isArray(payload.classes)) localStorage.setItem('classes', JSON.stringify(payload.classes));
  if (Array.isArray(payload.subjects)) localStorage.setItem('subjects', JSON.stringify(payload.subjects));
  if (Array.isArray(payload.exams)) localStorage.setItem('exams', JSON.stringify(payload.exams));
  if (Array.isArray(payload.marks)) localStorage.setItem('marks', JSON.stringify(payload.marks));
  if (Array.isArray(payload.remarks)) localStorage.setItem('remarks', JSON.stringify(payload.remarks));
  if (Array.isArray(payload.transactions)) localStorage.setItem('madrasha_transactions', JSON.stringify(payload.transactions));
  if (Array.isArray(payload.feeStructures)) localStorage.setItem('madrasha_fee_structures', JSON.stringify(payload.feeStructures));
  if (Array.isArray(payload.feeTypes)) localStorage.setItem('madrasha_fee_types', JSON.stringify(payload.feeTypes));
  if (Array.isArray(payload.trashBin)) localStorage.setItem('madrasha_trash_bin', JSON.stringify(payload.trashBin));
  if (Array.isArray(payload.academicYears)) localStorage.setItem('academicYears', JSON.stringify(payload.academicYears));
  if (Array.isArray(payload.sections)) localStorage.setItem('sections', JSON.stringify(payload.sections));
  if (Array.isArray(payload.teachers)) localStorage.setItem('teachers', JSON.stringify(payload.teachers));
  if (Array.isArray(payload.classSubjectAssignments)) localStorage.setItem('classSubjectAssignments', JSON.stringify(payload.classSubjectAssignments));
  if (Array.isArray(payload.teacherSubjectAssignments)) localStorage.setItem('teacherSubjectAssignments', JSON.stringify(payload.teacherSubjectAssignments));
  if (Array.isArray(payload.classTeacherAssignments)) localStorage.setItem('classTeacherAssignments', JSON.stringify(payload.classTeacherAssignments));
  if (Array.isArray(payload.examSubjectAssignments)) localStorage.setItem('examSubjectAssignments', JSON.stringify(payload.examSubjectAssignments));
  if (Array.isArray(payload.promotionHistory)) localStorage.setItem('madrasha_promotion_history', JSON.stringify(payload.promotionHistory));
  if (Array.isArray(payload.institutionMembers) && payload.institutionMembers.length > 0) {
    localStorage.setItem('madrasha_institution_members', JSON.stringify(payload.institutionMembers));
  }
  if (Array.isArray(payload.gradingSystem)) localStorage.setItem('gradingSystem', JSON.stringify(payload.gradingSystem));
  if (Array.isArray(payload.users)) localStorage.setItem('madrasha_app_users', JSON.stringify(payload.users));
  if (Array.isArray(payload.notices)) localStorage.setItem('madrasha_notices', JSON.stringify(payload.notices));
  if (Array.isArray(payload.staffLeaves)) localStorage.setItem('madrasah_staff_leaves', JSON.stringify(payload.staffLeaves));
  // Attendance is stored by dailyAttendanceService as a map keyed
  // `${date}_${studentId}` / `${date}_${staffId}` — rebuild that shape.
  if (Array.isArray(payload.dailyStudentAttendance)) {
    const map: Record<string, DailyStudentAttendanceRecord> = {};
    payload.dailyStudentAttendance.forEach(r => {
      if (r && r.date && r.studentId) map[`${r.date}_${r.studentId}`] = r;
    });
    localStorage.setItem('madrasah_daily_student_attendance', JSON.stringify(map));
  }
  if (Array.isArray(payload.dailyStaffAttendance)) {
    const map: Record<string, DailyStaffAttendanceRecord> = {};
    payload.dailyStaffAttendance.forEach(r => {
      if (r && r.date && r.staffId) map[`${r.date}_${r.staffId}`] = r;
    });
    localStorage.setItem('madrasah_daily_staff_attendance', JSON.stringify(map));
  }
  if (Array.isArray(payload.classRoutines)) localStorage.setItem('madrasha_academic_routines_v1', JSON.stringify(payload.classRoutines));
  if (Array.isArray(payload.syllabusItems)) localStorage.setItem('madrasha_academic_syllabus_v1', JSON.stringify(payload.syllabusItems));
  if (Array.isArray(payload.calendarEvents)) localStorage.setItem('madrasha_academic_calendar_v1', JSON.stringify(payload.calendarEvents));
  // Satellite module stores: only keys actually present in the backup are
  // written back, so restoring an OLD backup (without this section) leaves
  // the current satellite data untouched.
  if (payload.extraLocalStores && typeof payload.extraLocalStores === 'object') {
    for (const key of LOCAL_STORE_BACKUP_KEYS) {
      if (Object.prototype.hasOwnProperty.call(payload.extraLocalStores, key)) {
        try {
          const value = payload.extraLocalStores[key];
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch {}
      }
    }
  }
}

// ----------------------------------------------------------------------------
// IndexedDB Vault Storage Operations
// ----------------------------------------------------------------------------

/**
 * Save full system state into IndexedDB Permanent Vault & Auto-create rolling snapshot
 */
export async function saveToIndexedDbVault(
  payload: SystemDataPayload, 
  trigger: SystemSnapshot['trigger'] = 'auto_interval',
  labelBn?: string,
  labelEn?: string,
  options?: VaultSaveOptions
): Promise<SystemSnapshot | null> {
  try {
    // Phase 3 degraded-skip: an automatic save must never rotate good
    // entries out with a degraded state (students present, teachers
    // gone — the 11:17 signature). Skip entirely, loudly, and keep
    // the vault's last good state. Explicit saves (manual,
    // pre-restore) always proceed — the user chose them.
    if (AUTO_VAULT_TRIGGERS.includes(trigger) && !options?.allowDegraded && isDegradedPayload(payload)) {
      console.warn('[Phase 3 vault] Auto-save skipped — state looks degraded (students present, teachers empty). Vault keeps its last good entries.');
      return null;
    }
    const db = await openIndexedDb();
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    // Write main current entity state
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_ENTITIES, STORE_META], 'readwrite');
      const entityStore = tx.objectStore(STORE_ENTITIES);
      const metaStore = tx.objectStore(STORE_META);

      entityStore.put({ key: 'current_system_payload', value: payload, updatedAt: Date.now(), counts });
      metaStore.put({ key: 'last_vault_sync', timestamp: new Date().toISOString(), totalRecords });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // If total records > 0, generate rolling snapshot
    if (totalRecords > 0) {
      const snapId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('bn-BD');

      const snapshot: SystemSnapshot = {
        id: snapId,
        timestamp: now.toISOString(),
        createdAt: Date.now(),
        trigger,
        labelBn: labelBn || `স্বয়ংক্রিয় ব্যাকআপ (${dateStr}, ${timeStr})`,
        labelEn: labelEn || `Automatic Checkpoint (${now.toLocaleDateString()}, ${now.toLocaleTimeString()})`,
        counts,
        payload,
        pinned: options?.pinned ?? PINNED_VAULT_TRIGGERS.includes(trigger),
        isDegraded: isDegradedPayload(payload),
        completenessPct: studentFieldCompletenessPct(payload)
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SNAPSHOTS], 'readwrite');
        const snapStore = tx.objectStore(STORE_SNAPSHOTS);
        snapStore.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Phase 3: vault cap 30 → 100; pinned snapshots never rotate out.
      await pruneOldSnapshots(100);

      return snapshot;
    }
  } catch (err) {
    console.warn('[IndexedDB Vault] Save error:', err);
  }
  return null;
}

/**
 * Phase 3: prune vault snapshots beyond maxKeep, newest-first.
 * Pinned snapshots are NEVER deleted; when pinned entries alone
 * reach maxKeep, nothing else is kept but pins still survive.
 */
async function pruneOldSnapshots(maxKeep = 100): Promise<void> {
  try {
    const db = await openIndexedDb();
    const snapshots = await getAllIndexedDbSnapshots();
    if (snapshots.length <= maxKeep) return;
    const pinned = snapshots.filter((s) => (s as SystemSnapshot).pinned === true);
    const unpinned = snapshots
      .filter((s) => (s as SystemSnapshot).pinned !== true)
      .sort((a, b) => b.createdAt - a.createdAt);
    const keepUnpinned = Math.max(0, maxKeep - pinned.length);
    const keepIds = new Set<string>([
      ...pinned.map((s) => s.id),
      ...unpinned.slice(0, keepUnpinned).map((s) => s.id),
    ]);
    const toDelete = snapshots.filter((s) => !keepIds.has(s.id));
    if (toDelete.length === 0) return;
    const tx = db.transaction([STORE_SNAPSHOTS], 'readwrite');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    for (const item of toDelete) {
      store.delete(item.id);
    }
  } catch (err) {
    console.warn('[IndexedDB Vault] Prune error:', err);
  }
}

/**
 * Get all saved snapshots from IndexedDB Permanent Vault
 */
export async function getAllIndexedDbSnapshots(): Promise<SystemSnapshot[]> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SNAPSHOTS], 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result || []) as SystemSnapshot[];
        list.sort((a, b) => b.createdAt - a.createdAt);
        resolve(list);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get current system payload from IndexedDB Vault
 */
export async function getIndexedDbCurrentPayload(): Promise<SystemDataPayload | null> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_ENTITIES], 'readonly');
      const store = tx.objectStore(STORE_ENTITIES);
      const request = store.get('current_system_payload');

      request.onsuccess = () => {
        if (request.result && request.result.value) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Smart Auto-Resurrection Engine
// ----------------------------------------------------------------------------

export interface ResurrectionResult {
  resurrected: boolean;
  source: 'indexeddb_current' | 'indexeddb_snapshot' | 'firestore_cloud' | 'none';
  counts: SystemDataCounts;
  messageBn: string;
  messageEn: string;
  restoredPayload?: SystemDataPayload;
}

/**
 * Smart Startup Guardian: If Chrome clear data occurred, this automatically
 * resurrects all data from IndexedDB Vault or Firestore Cloud!
 */
export async function resurrectDataIfEmpty(): Promise<ResurrectionResult> {
  const currentLocal = readCurrentLocalStoragePayload();
  const localCounts = extractSystemCounts(currentLocal);
  const totalLocal = Object.values(localCounts).reduce((a, b) => a + b, 0);

  // If local storage has adequate records, no resurrection required
  if (totalLocal > 3) {
    // Make sure we keep IndexedDB vault synchronized in background
    saveToIndexedDbVault(currentLocal, 'auto_interval').catch(() => {});
    return {
      resurrected: false,
      source: 'none',
      counts: localCounts,
      messageBn: 'লোকাল ডাটা উপস্থিত রয়েছে।',
      messageEn: 'Local data is intact.'
    };
  }

  // 1. Try restoring from IndexedDB Vault current state
  try {
    const idbPayload = await getIndexedDbCurrentPayload();
    if (idbPayload) {
      const idbCounts = extractSystemCounts(idbPayload);
      const totalIdb = Object.values(idbCounts).reduce((a, b) => a + b, 0);
      if (totalIdb > 0) {
        writePayloadToLocalStorage(idbPayload);
        return {
          resurrected: true,
          source: 'indexeddb_current',
          counts: idbCounts,
          messageBn: `ক্রোম ডাটা ক্লিয়ার হলেও স্থায়ী ব্যাকআপ ভল্ট থেকে ${idbCounts.students} জন শিক্ষার্থী ও ${idbCounts.marks} টি মার্কস স্বয়ংক্রিয়ভাবে উদ্ধার করা হয়েছে!`,
          messageEn: `Auto-restored ${idbCounts.students} students and ${idbCounts.marks} marks from IndexedDB Permanent Vault!`,
          restoredPayload: idbPayload
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] IndexedDB current check notice:', err);
  }

  // 2. Try restoring from IndexedDB Snapshots history
  try {
    const snapshots = await getAllIndexedDbSnapshots();
    if (snapshots.length > 0) {
      const bestSnap = snapshots[0];
      const snapCounts = bestSnap.counts;
      const totalSnap = Object.values(snapCounts).reduce((a, b) => a + b, 0);
      if (totalSnap > 0 && bestSnap.payload) {
        writePayloadToLocalStorage(bestSnap.payload);
        return {
          resurrected: true,
          source: 'indexeddb_snapshot',
          counts: snapCounts,
          messageBn: `পূর্বের সংরক্ষিত স্ন্যাপশট (${new Date(bestSnap.timestamp).toLocaleString('bn-BD')}) থেকে সমস্ত ডাটা উদ্ধার করা হয়েছে!`,
          messageEn: `Restored all data from snapshot (${new Date(bestSnap.timestamp).toLocaleString()})!`,
          restoredPayload: bestSnap.payload
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] Snapshot check notice:', err);
  }

  // 3. Try restoring from Firestore Cloud
  try {
    const docRef = doc(db, 'institution', 'main_store');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const cloudData = docSnap.data() as SystemDataPayload;
      const cloudCounts = extractSystemCounts(cloudData);
      const totalCloud = Object.values(cloudCounts).reduce((a, b) => a + b, 0);
      if (totalCloud > 0) {
        writePayloadToLocalStorage(cloudData);
        // Also save to IndexedDB Vault
        saveToIndexedDbVault(cloudData, 'resurrection').catch(() => {});
        return {
          resurrected: true,
          source: 'firestore_cloud',
          counts: cloudCounts,
          messageBn: `ক্লাউড ফায়ারস্টোর ভল্ট থেকে ${cloudCounts.students} জন শিক্ষার্থী ও প্রাতিষ্ঠানিক ডাটা সফলভাবে পুনরুদ্ধার করা হয়েছে!`,
          messageEn: `Successfully restored ${cloudCounts.students} students and institutional data from Cloud Firestore Vault!`,
          restoredPayload: cloudData
        };
      }
    }
  } catch (err) {
    console.warn('[Resurrection] Cloud check notice:', err);
  }

  return {
    resurrected: false,
    source: 'none',
    counts: localCounts,
    messageBn: 'কোনো পূর্ববর্তী ব্যাকআপ পাওয়া যায়নি।',
    messageEn: 'No previous backup found.'
  };
}

// ----------------------------------------------------------------------------
// Full System Backup Export & Import (JSON)
// ----------------------------------------------------------------------------

export interface SystemBackupPackage {
  version: '3.0.0-permanent-vault';
  system: 'Darul-Ulum-Madrasah-OS';
  exportedAt: string;
  sourceOrigin: string;
  counts: SystemDataCounts;
  checksum: string;
  payload: SystemDataPayload;
}

/**
 * Generate complete JSON backup file and trigger download
 */
export function downloadFullSystemBackup(payload?: SystemDataPayload, customName?: string): string {
  const data = payload || readCurrentLocalStoragePayload();
  const counts = extractSystemCounts(data);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${now.getHours()}-${now.getMinutes()}`;
  const filename = customName || `madrasha-full-system-backup-${dateStr}_${timeStr}.json`;

  const pkg: SystemBackupPackage = {
    version: '3.0.0-permanent-vault',
    system: 'Darul-Ulum-Madrasah-OS',
    exportedAt: now.toISOString(),
    sourceOrigin: typeof window !== 'undefined' ? window.location.origin : 'offline',
    counts,
    checksum: `chk_${Date.now()}_${counts.students}_${counts.marks}`,
    payload: data
  };

  if (typeof window !== 'undefined' && document) {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Also store as an instant checkpoint in IndexedDB
  saveToIndexedDbVault(data, 'manual', 'ম্যানুয়াল ব্যাকআপ ফাইল ডাউনলোড', 'Manual Backup Download').catch(() => {});

  return filename;
}

export interface BackupValidationInspection {
  isValid: boolean;
  version?: string;
  exportedAt?: string;
  counts: SystemDataCounts;
  errors: string[];
  warnings: string[];
  payload?: SystemDataPayload;
}

/**
 * Validates a JSON backup file content before restoring
 */
export function validateFullSystemBackup(jsonContent: string): BackupValidationInspection {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
        errors: ['ফাইলের ফরম্যাট সঠিক নয়। এটি একটি বৈধ JSON ফাইল হতে হবে।'],
        warnings: []
      };
    }

    // Extract payload
    const payload: SystemDataPayload = parsed.payload ? parsed.payload : parsed;
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      errors.push('ব্যাকআপ ফাইলে কোনো শিক্ষার্থী, পরীক্ষা, বিষয় বা লেনদেনের তথ্য নেই।');
    }

    if (!payload.schoolProfile) {
      warnings.push('মাদ্রাসা প্রোফাইল তথ্য অনুপস্থিত, ডিফল্ট প্রোফাইল ব্যবহার করা হবে।');
    }

    return {
      isValid: errors.length === 0,
      version: parsed.version || 'unknown',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      counts,
      errors,
      warnings,
      payload
    };
  } catch (err: any) {
    return {
      isValid: false,
      counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
      errors: ['JSON পার্সিং ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')],
      warnings: []
    };
  }
}

/**
 * Payload copy that is safe to write into the Firestore main_store
 * document: satellite local stores are device-local data and must not
 * bloat (or leak into) the cloud document.
 */
function toCloudStorePayload(payload: SystemDataPayload): Record<string, any> {
  const copy: Record<string, any> = { ...(payload as any) };
  delete copy.extraLocalStores;
  return copy;
}

/** Phase 3: explicit shrink handling (resolves the future-rules
 * false-positive class at the client level). A full restore may
 * shrink a field ONLY when the user confirmed exactly that target
 * size in the restore preview. Any other shrink throws BEFORE any
 * write. Fields absent from the payload are untouched by merge and
 * never count as shrinks. */
export function assertRestoreShrinksConfirmed(
  payload: any,
  existing: Record<string, any> | null,
  confirmedShrinks?: Partial<Record<keyof RestoreCounts, number>>
): void {
  if (!existing) return;
  const next = extractRestoreCounts(payload);
  const prev = extractRestoreCounts(existing);
  for (const f of RESTORE_COUNT_FIELDS) {
    const to = next[f];
    const from = prev[f];
    if (typeof to !== 'number' || typeof from !== 'number') continue;
    if (to < from) {
      const confirmed = confirmedShrinks ? confirmedShrinks[f] : undefined;
      if (confirmed !== to) {
        throw new Error(
          `Phase 3 restore refused — ${RESTORE_COUNT_LABELS[f].bn} would shrink from ${from} to ${to} without preview confirmation. ` +
            `A restore may shrink a list only when the preview confirmed exactly that size. Re-open the preview and confirm, or pick a newer snapshot.`
        );
      }
    }
  }
}

export interface RestoreReadback {
  verified: boolean;
  mismatches: string[];
  cloudCounts: RestoreCounts;
}

/** Phase 3: read-back verification for ALL restore paths (the
 * localDataRecovery pattern, generalized). Re-reads main_store and
 * checks every array field the payload carried: counts must match,
 * and every restored student/teacher id must be present in cloud. */
export async function verifyRestoreReadback(expectedPayload: any): Promise<RestoreReadback> {
  const docRef = doc(db, 'institution', 'main_store');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return { verified: false, mismatches: ['রিস্টোরের পর main_store ডকুমেন্ট পাওয়া যায়নি।'], cloudCounts: {} };
  }
  const data = snap.data() as Record<string, any>;
  const expected = extractRestoreCounts(expectedPayload);
  const cloudCounts = extractRestoreCounts(data);
  const mismatches: string[] = [];
  for (const f of RESTORE_COUNT_FIELDS) {
    const want = expected[f];
    const got = cloudCounts[f];
    if (typeof want === 'number' && typeof got === 'number' && want !== got) {
      mismatches.push(`${RESTORE_COUNT_LABELS[f].bn}: আশা ${want}, ক্লাউডে ${got}`);
    }
  }
  // Id parity for students + teachers (the two identity-critical lists).
  for (const f of ['students', 'teachers'] as const) {
    const wantList = (expectedPayload as any)?.[f];
    const gotList = (data as any)?.[f];
    if (Array.isArray(wantList) && Array.isArray(gotList)) {
      const gotIds = new Set(gotList.map((r: any) => r && String(r.id)).filter(Boolean));
      const missing = wantList.map((r: any) => r && String(r.id)).filter((id: string) => id && !gotIds.has(id));
      if (missing.length > 0) mismatches.push(`${RESTORE_COUNT_LABELS[f].bn}: ${missing.length}টি আইডি ক্লাউডে পাওয়া যায়নি`);
    }
  }
  return { verified: mismatches.length === 0, mismatches, cloudCounts };
}

/** Phase 3: explicit public-portal rebuild from a FRESH confirmed
 * main_store read — every restore path calls this instead of relying
 * on the next auto-sync. Returns false (never throws) on failure so
 * a portal failure never masks a restore result. */
export async function rebuildPublicPortalFromMain(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'institution', 'main_store'));
    if (!snap.exists()) return false;
    await setDoc(doc(db, 'institution', 'public_portal'), buildPublicPortalData(snap.data()));
    return true;
  } catch (err) {
    console.warn('[Phase 3 restore] Public portal rebuild notice:', err);
    return false;
  }
}

export interface PreRestoreSafety {
  vaultId: string | null;
  cloudId: string | null;
}

/** Phase 3 (3g): EVERY full restore creates a pre-restore safety
 * snapshot in vault AND cloud FIRST. The cloud safety snapshot is
 * REQUIRED: if it cannot be created, the restore aborts before any
 * write, because a bad restore without a cloud undo would be
 * unrecoverable. Vault safety is best-effort (IndexedDB may be
 * unavailable) and never blocks. */
export async function createPreRestoreSafetySnapshots(adminEmail?: string): Promise<PreRestoreSafety> {
  const current = readCurrentLocalStoragePayload();
  let vaultId: string | null = null;
  try {
    const snap = await saveToIndexedDbVault(current, 'pre_restore', 'রিস্টোরের পূর্ববর্তী স্বয়ংক্রিয় সেফটি স্ন্যাপশট', 'Pre-Restore Safety Checkpoint');
    vaultId = snap ? snap.id : null;
  } catch (err) {
    console.warn('[Phase 3 restore] Vault safety snapshot notice:', err);
  }
  if (!auth.currentUser) {
    throw new Error('রিস্টোর বন্ধ করা হয়েছে — ক্লাউড সেফটি স্ন্যাপশট বানাতে লগইন প্রয়োজন। লগইন করে আবার চেষ্টা করুন।');
  }
  const { payload } = await fetchFirestoreAuthoritativeSnapshot(adminEmail);
  const cloudId = await saveCloudSnapshotToFirestore(payload, 'রিস্টোরের পূর্ববর্তী সেফটি স্ন্যাপশট (ক্লাউড)', 'Pre-Restore Safety Snapshot (Cloud)', adminEmail, { pinned: true, trigger: 'pre_restore' });
  return { vaultId, cloudId };
}

export interface FullRestoreOptions {
  adminEmail?: string;
  targetMode?: 'full' | 'client_only';
  /** Preview-confirmed shrink targets (field -> new size). Any shrink
   * not listed here with its exact size is refused before any write. */
  confirmedShrinks?: Partial<Record<keyof RestoreCounts, number>>;
  restoredFromLabel?: string;
  version?: string;
  vaultSuccessLabelBn?: string;
  vaultSuccessLabelEn?: string;
}

export interface FullRestoreResult {
  success: boolean;
  counts: SystemDataCounts;
  message: string;
  /** Null for client_only restores (no cloud write, no read-back). */
  verification: RestoreReadback | null;
  portalRebuilt: boolean;
  safety: PreRestoreSafety | null;
}

/**
 * Phase 3 (single validated restore path for ALL channels): safety
 * snapshots first (vault + cloud, cloud required), choke + shrink
 * checks BEFORE any mutation, then local + vault + cloud writes,
 * read-back verification, and an explicit portal rebuild. A refused
 * restore mutates nothing (except the additive safety snapshots).
 * Cloud-write or verification failure returns success: false — the
 * caller must NOT claim success.
 */
async function performValidatedFullRestore(
  payload: SystemDataPayload,
  opts: FullRestoreOptions
): Promise<FullRestoreResult> {
  const adminEmail = opts.adminEmail;
  const targetMode = opts.targetMode || 'full';
  const counts = extractSystemCounts(payload);
  const vaultLabelBn = opts.vaultSuccessLabelBn || 'সফল ফাইল রিস্টোর স্ন্যাপশট';
  const vaultLabelEn = opts.vaultSuccessLabelEn || 'Restored from Backup File';
  if (targetMode === 'client_only') {
    // Local-only recovery: vault safety only, no cloud write, no
    // cloud safety needed (cloud untouched), no read-back, no portal.
    try {
      const current = readCurrentLocalStoragePayload();
      await saveToIndexedDbVault(current, 'pre_restore', 'রিস্টোরের পূর্ববর্তী স্বয়ংক্রিয় সেফটি স্ন্যাপশট', 'Pre-Restore Safety Checkpoint');
    } catch (err) {
      console.warn('[Phase 3 restore] Vault safety snapshot notice:', err);
    }
    writePayloadToLocalStorage(payload);
    await saveToIndexedDbVault(payload, 'manual', vaultLabelBn, vaultLabelEn);
    return {
      success: true,
      counts,
      message: `সফলভাবে ${counts.students} জন শিক্ষার্থী, ${counts.exams} টি পরীক্ষা এবং ${counts.marks} টি মার্কস লোকাল স্টোরেজে রিস্টোর সম্পন্ন হয়েছে (ক্লাউড অপরিবর্তিত)!`,
      verification: null,
      portalRebuilt: false,
      safety: null,
    };
  }

  // 1. Safety FIRST (cloud safety throws → restore aborts, nothing mutated).
  const safety = await createPreRestoreSafetySnapshots(adminEmail);

  // 2. Choke + shrink checks against FRESH cloud state, BEFORE mutation.
  const checkRef = doc(db, 'institution', 'main_store');
  const checkSnap = await getDoc(checkRef);
  const existing = checkSnap.exists() ? (checkSnap.data() as Record<string, any>) : null;
  const cloudPayload = toCloudStorePayload(payload);
  assertRestorePayloadSafe(
    {
      ...cloudPayload,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail || 'admin',
      version: opts.version || '3.0.0-permanent-vault',
      ...(opts.restoredFromLabel ? { restoredFromSnapshotAt: opts.restoredFromLabel } : {}),
    },
    existing
  );
  assertRestoreShrinksConfirmed(cloudPayload, existing, opts.confirmedShrinks);

  // 3. Local + vault writes.
  writePayloadToLocalStorage(payload);
  await saveToIndexedDbVault(payload, 'manual', vaultLabelBn, vaultLabelEn);

  // 4. Cloud write (undefined top-level keys stripped: merge keeps
  // the cloud value for fields an old backup predates, instead of
  // throwing on undefined).
  const writePayload: Record<string, any> = {};
  for (const [k, v] of Object.entries(cloudPayload)) {
    if (v !== undefined) writePayload[k] = v;
  }
  writePayload.updatedAt = new Date().toISOString();
  writePayload.updatedBy = adminEmail || 'admin';
  writePayload.version = opts.version || '3.0.0-permanent-vault';
  if (opts.restoredFromLabel) writePayload.restoredFromSnapshotAt = opts.restoredFromLabel;
  let cloudWriteError: string | null = null;
  try {
    await setDoc(doc(db, 'institution', 'main_store'), writePayload, { merge: true });
  } catch (err: any) {
    cloudWriteError = err?.message || 'অজ্ঞাত ত্রুটি';
    console.warn('[Phase 3 restore] Cloud write notice:', err);
  }
  if (cloudWriteError) {
    return {
      success: false,
      counts,
      message: `রিস্টোর লোকালি হয়েছে কিন্তু ক্লাউডে লেখা যায়নি (${cloudWriteError})। সেফটি স্ন্যাপশট থেকে আগের অবস্থায় ফেরা যাবে।`,
      verification: null,
      portalRebuilt: false,
      safety,
    };
  }

  // 5. Read-back verification (re-reads cloud; mismatch = failure).
  const verification = await verifyRestoreReadback(cloudPayload);
  if (!verification.verified) {
    return {
      success: false,
      counts,
      message: `রিস্টোরের পর যাচাইয়ে অমিল পাওয়া গেছে: ${verification.mismatches.join('। ')}। সেফটি স্ন্যাপশট থেকে আগের অবস্থায় ফেরা যাবে।`,
      verification,
      portalRebuilt: false,
      safety,
    };
  }

  // 6. Explicit portal rebuild from restored main state.
  const portalRebuilt = await rebuildPublicPortalFromMain();
  return {
    success: true,
    counts,
    message: `সফলভাবে ${counts.students} জন শিক্ষার্থী, ${counts.exams} টি পরীক্ষা এবং ${counts.marks} টি মার্কস রিস্টোর ও যাচাই সম্পন্ন হয়েছে!${portalRebuilt ? '' : ' (পাবলিক পোর্টাল রিবিল্ড হয়নি — পরের সিঙ্কে হবে।)'}`,
    verification,
    portalRebuilt,
    safety,
  };
}

/**
 * Execute safe full system restore (writes to LocalStorage, IndexedDB Vault, and Cloud).
 * Phase 3: routes through the single validated restore path above.
 */
export async function executeFullSystemRestore(
  payload: SystemDataPayload,
  adminEmail?: string,
  opts?: Omit<FullRestoreOptions, 'adminEmail'>
): Promise<FullRestoreResult> {
  return performValidatedFullRestore(payload, { ...(opts || {}), adminEmail });
}

/**
 * Rollback to a specific snapshot from history.
 * Phase 3: preview-confirmed shrinks pass through; refused restores mutate nothing.
 */
export async function rollbackToSpecificSnapshot(
  snapshotId: string,
  adminEmail?: string,
  confirmedShrinks?: Partial<Record<keyof RestoreCounts, number>>
): Promise<FullRestoreResult> {
  const snapshots = await getAllIndexedDbSnapshots();
  const target = snapshots.find(s => s.id === snapshotId);

  if (!target || !target.payload) {
    throw new Error('নির্দিষ্ট ব্যাকআপ স্ন্যাপশটটি পাওয়া যায়নি।');
  }
  const res = await performValidatedFullRestore(target.payload, {
    adminEmail,
    confirmedShrinks,
    restoredFromLabel: target.timestamp,
    version: '3.0.0-permanent-vault',
    vaultSuccessLabelBn: 'সফল রোলব্যাক স্ন্যাপশট',
    vaultSuccessLabelEn: 'Successful Rollback Snapshot',
  });
  return {
    ...res,
    message: res.success ? `সফলভাবে "${target.labelBn}" ভার্সনে রোলব্যাক ও যাচাই সম্পন্ন হয়েছে!` : res.message,
  };
}

// ----------------------------------------------------------------------------
// CLOUD DATA BACKUP & FIRESTORE SNAPSHOT ENGINE
// ----------------------------------------------------------------------------

export interface CloudDataSnapshotPackage {
  version: string;
  type: 'madrasha_cloud_firestore_snapshot' | 'madrasha_gdrive_snapshot';
  exportedAt: string;
  databaseId?: string;
  projectId?: string;
  exportedBy: string;
  source: string;
  counts: SystemDataCounts;
  checksum: string;
  securityHash: string;
  payload: SystemDataPayload;
}

export interface CloudStoredSnapshotMeta {
  id: string;
  timestamp: string;
  createdAt: number;
  labelBn: string;
  labelEn: string;
  exportedBy: string;
  counts: SystemDataCounts;
  payload: SystemDataPayload;
  /** Phase 3: pinned snapshots are exempt from retention prune. */
  pinned?: boolean;
  /** Phase 3: how this snapshot was created. */
  trigger?: 'manual' | 'daily' | 'pre_restore';
  /** Phase 3: one daily keep per day, retained 90 days. */
  dailyKeep?: boolean;
  /** Phase 3: true when the snapshot carries students but no teachers. */
  isDegraded?: boolean;
  /** Phase 3: % of students carrying beyond-public fields. */
  completenessPct?: number;
}

/**
 * Fetches current authoritative state directly from Cloud Firestore
 */
export async function fetchFirestoreAuthoritativeSnapshot(adminEmail?: string): Promise<{
  snapshot: CloudDataSnapshotPackage;
  payload: SystemDataPayload;
}> {
  const docRef = doc(db, 'institution', 'main_store');
  const docSnap = await getDoc(docRef);

  let payload: SystemDataPayload;
  if (docSnap.exists()) {
    payload = docSnap.data() as SystemDataPayload;
  } else {
    // If main_store doc isn't written yet, fallback to client local payload
    payload = readCurrentLocalStoragePayload();
  }

  const counts = extractSystemCounts(payload);
  const now = new Date();
  const rawSignature = `${counts.students}-${counts.exams}-${counts.marks}-${counts.transactions}-${now.getTime()}`;
  
  // Calculate deterministic checksum
  let hash = 0;
  for (let i = 0; i < rawSignature.length; i++) {
    const chr = rawSignature.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const checksum = `chk_cloud_${Math.abs(hash).toString(16)}_${Date.now()}`;
  const securityHash = `sec_sha256_${btoa(rawSignature).replace(/=/g, '')}`;

  const snapshot: CloudDataSnapshotPackage = {
    version: '3.0.0-cloud-snapshot',
    type: 'madrasha_cloud_firestore_snapshot',
    exportedAt: now.toISOString(),
    databaseId: (firebaseConfig as any).firestoreDatabaseId || '(default)',
    projectId: firebaseConfig.projectId || 'gen-lang-client-0692995380',
    exportedBy: adminEmail || 'admin@madrasah.system',
    source: 'firestore_cloud_live',
    counts,
    checksum,
    securityHash,
    payload
  };

  return { snapshot, payload };
}

/**
 * Generates a secure JSON snapshot of Firestore data and downloads it locally to client machine
 */
export async function downloadCloudFirestoreSnapshot(
  adminEmail?: string, 
  customFilename?: string
): Promise<{ filename: string; snapshot: CloudDataSnapshotPackage }> {
  const { snapshot, payload } = await fetchFirestoreAuthoritativeSnapshot(adminEmail);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = customFilename || `madrasah-cloud-firestore-snapshot-${dateStr}_${timeStr}.json`;

  if (typeof window !== 'undefined' && document) {
    const jsonContent = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Also record in local IndexedDB vault as a verified cloud snapshot
  saveToIndexedDbVault(
    payload, 
    'cloud_sync', 
    `ক্লাউড ফায়ারস্টোর স্ন্যাপশট ডাউনলোড (${now.toLocaleTimeString('bn-BD')})`, 
    `Cloud Firestore Snapshot Download (${now.toLocaleTimeString()})`
  ).catch(() => {});

  return { filename, snapshot };
}

export interface CloudSnapshotSaveOptions {
  pinned?: boolean;
  trigger?: 'manual' | 'daily' | 'pre_restore';
  dailyKeep?: boolean;
}

/**
 * Saves a timestamped snapshot document directly into Firestore collection `cloud_snapshots`.
 * Phase 3: stores pin/trigger/dailyKeep/degraded/completeness flags, and
 * prunes beyond retention after a successful create (best-effort).
 */
export async function saveCloudSnapshotToFirestore(
  payload?: SystemDataPayload,
  labelBn?: string,
  labelEn?: string,
  adminEmail?: string,
  options?: CloudSnapshotSaveOptions
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Authentication required: Firebase Authentication session is required to save snapshots to Cloud Firestore.');
  }
  const data = payload || readCurrentLocalStoragePayload();
  const counts = extractSystemCounts(data);
  const now = new Date();
  const snapId = `cloud_snap_${Date.now()}`;

  const snapshotDoc = {
    id: snapId,
    timestamp: now.toISOString(),
    createdAt: Date.now(),
    labelBn: labelBn || `ক্লাউড ডাটাবেস স্ন্যাপশট (${now.toLocaleDateString('bn-BD')})`,
    labelEn: labelEn || `Cloud Database Snapshot (${now.toLocaleDateString()})`,
    exportedBy: adminEmail || 'admin',
    counts,
    payload: data,
    version: '3.0.0-cloud-snapshot',
    pinned: options?.pinned === true,
    trigger: options?.trigger || 'manual',
    dailyKeep: options?.dailyKeep === true,
    isDegraded: isDegradedPayload(data),
    completenessPct: studentFieldCompletenessPct(data)
  };

  const docRef = doc(db, 'cloud_snapshots', snapId);
  await setDoc(docRef, snapshotDoc);

  // Phase 3 retention: prune beyond policy after a successful create
  // (best-effort — a prune failure never fails the snapshot itself).
  try {
    await pruneCloudSnapshots();
  } catch (err) {
    console.warn('[Cloud Snapshots] Retention prune notice:', err);
  }

  return snapId;
}

export interface CloudSnapshotPage {
  items: CloudStoredSnapshotMeta[];
  hasMore: boolean;
  lastCreatedAt: number | null;
}

/** Phase 3: cursor-paginated cloud snapshot list (20/page default).
 * The old 20-item hard cap is gone — the UI pages through everything. */
export async function fetchFirestoreCloudSnapshotsPage(
  pageSize = 20,
  startAfterCreatedAt?: number | null
): Promise<CloudSnapshotPage> {
  try {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (startAfterCreatedAt) constraints.push(startAfter(startAfterCreatedAt));
    constraints.push(limit(pageSize + 1));
    const q = query(collection(db, 'cloud_snapshots'), ...constraints);
    const snapDocs = await getDocs(q);
    const items: CloudStoredSnapshotMeta[] = [];
    snapDocs.forEach((d) => {
      items.push(d.data() as CloudStoredSnapshotMeta);
    });
    const hasMore = items.length > pageSize;
    const page = hasMore ? items.slice(0, pageSize) : items;
    return { items: page, hasMore, lastCreatedAt: page.length > 0 ? page[page.length - 1].createdAt : null };
  } catch (err) {
    console.warn('[Cloud Snapshots] Fetch page error:', err);
    return { items: [], hasMore: false, lastCreatedAt: null };
  }
}

/**
 * Fetches the newest 50 cloud snapshots (kept for existing callers).
 */
export async function fetchFirestoreCloudSnapshots(): Promise<CloudStoredSnapshotMeta[]> {
  const page = await fetchFirestoreCloudSnapshotsPage(50);
  return page.items;
}

/** Phase 3: pin/unpin a cloud snapshot (pinned snapshots are exempt from retention prune). */
export async function setCloudSnapshotPinned(id: string, pinned: boolean): Promise<void> {
  await updateDoc(doc(db, 'cloud_snapshots', id), { pinned });
}

/** Phase 3 retention (plan §6): keep pinned docs, the newest 50, and
 * one daily-keep per day for 90 days; delete the rest, oldest first.
 * Runs at most once per day per device (localStorage guard) so a
 * snapshot create never pays for a full walk more than daily, and
 * never throws to the create flow. */
export async function pruneCloudSnapshots(): Promise<string[]> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const today = new Date().toLocaleDateString('en-CA');
      if (window.localStorage.getItem('ldsdm_last_cloud_prune') === today) return [];
    }
    const q = query(collection(db, 'cloud_snapshots'), orderBy('createdAt', 'desc'), limit(200));
    const snapDocs = await getDocs(q);
    const docs: CloudStoredSnapshotMeta[] = [];
    snapDocs.forEach((d) => {
      docs.push(d.data() as CloudStoredSnapshotMeta);
    });
    const keep = new Set<string>();
    docs.forEach((d, idx) => { if (idx < 50) keep.add(d.id); });
    docs.forEach((d) => { if ((d as any).pinned === true) keep.add(d.id); });
    const dailyByDay = new Map<string, CloudStoredSnapshotMeta>();
    docs.forEach((d) => {
      if ((d as any).dailyKeep !== true) return;
      const day = new Date(d.createdAt).toLocaleDateString('en-CA');
      const prev = dailyByDay.get(day);
      if (!prev || d.createdAt > prev.createdAt) dailyByDay.set(day, d);
    });
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    dailyByDay.forEach((d) => { if (now - d.createdAt <= ninetyDays) keep.add(d.id); });
    const toDelete = docs.filter((d) => !keep.has(d.id)).sort((a, b) => a.createdAt - b.createdAt);
    const pruned: string[] = [];
    for (const d of toDelete) {
      try {
        await deleteDoc(doc(db, 'cloud_snapshots', d.id));
        pruned.push(d.id);
      } catch (err) {
        console.warn('[Cloud Snapshots] Prune delete notice:', d.id, err);
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ldsdm_last_cloud_prune', new Date().toLocaleDateString('en-CA'));
    }
    if (pruned.length > 0) console.log(`[Phase 3 cloud retention] Pruned ${pruned.length} snapshot(s):`, pruned);
    return pruned;
  } catch (err) {
    console.warn('[Cloud Snapshots] Prune error:', err);
    return [];
  }
}

/** Phase 3 (3b): automatic daily cloud snapshot — the FIRST confirmed
 * write of the day triggers one. Best-effort: never throws, never
 * updates its date key on failure or on a degraded skip, so a missed
 * day retries on the next confirmed write. */
export async function maybeCreateDailyCloudSnapshot(adminEmail?: string): Promise<'created' | 'skipped-today' | 'skipped-degraded' | 'skipped-noauth' | 'failed'> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'failed';
    const today = new Date().toLocaleDateString('en-CA');
    if (window.localStorage.getItem('ldsdm_last_daily_cloud_snapshot') === today) return 'skipped-today';
    if (!auth.currentUser) return 'skipped-noauth';
    const data = readCurrentLocalStoragePayload();
    if (isDegradedPayload(data)) {
      console.warn('[Phase 3 daily snapshot] Skipped — current state looks degraded (students present, teachers empty). Will retry on a later confirmed write.');
      return 'skipped-degraded';
    }
    await saveCloudSnapshotToFirestore(data, `দৈনিক স্বয়ংক্রিয় স্ন্যাপশট (${new Date().toLocaleDateString('bn-BD')})`, `Daily Automatic Snapshot (${new Date().toLocaleDateString()})`, adminEmail, { trigger: 'daily', dailyKeep: true });
    window.localStorage.setItem('ldsdm_last_daily_cloud_snapshot', today);
    return 'created';
  } catch (err) {
    console.warn('[Phase 3 daily snapshot] Failed:', err);
    return 'failed';
  }
}

/**
 * Validates a downloaded or uploaded Cloud Snapshot JSON file
 */
export function validateCloudSnapshotPackage(jsonContent: string): {
  isValid: boolean;
  isCloudSnapshot: boolean;
  exportedAt?: string;
  exportedBy?: string;
  databaseId?: string;
  counts: SystemDataCounts;
  errors: string[];
  warnings: string[];
  packageData?: CloudDataSnapshotPackage;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') {
      return {
        isValid: false,
        isCloudSnapshot: false,
        counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
        errors: ['ফাইলের ফরম্যাট সঠিক নয়। এটি একটি বৈধ JSON ফাইল হতে হবে।'],
        warnings: []
      };
    }

    const isCloudSnapshot = parsed.type === 'madrasha_cloud_firestore_snapshot' || parsed.source === 'firestore_cloud_live';
    const payload: SystemDataPayload = parsed.payload ? parsed.payload : parsed;
    const counts = extractSystemCounts(payload);
    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      errors.push('ক্লাউড স্ন্যাপশট ফাইলে কোনো শিক্ষার্থী, পরীক্ষা, বিষয় বা নম্বর রেকর্ড নেই।');
    }

    if (!isCloudSnapshot) {
      warnings.push('এটি স্ট্যান্ডার্ড ব্যাকআপ ফাইল, তবে সফলভাবে ক্লাউড ও লোকাল সিস্টেমে রিস্টোর করা যাবে।');
    }

    return {
      isValid: errors.length === 0,
      isCloudSnapshot,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      exportedBy: parsed.exportedBy || 'admin',
      databaseId: parsed.databaseId || (firebaseConfig as any).firestoreDatabaseId || '(default)',
      counts,
      errors,
      warnings,
      packageData: isCloudSnapshot ? parsed : {
        version: '3.0.0-cloud-snapshot',
        type: 'madrasha_cloud_firestore_snapshot',
        exportedAt: new Date().toISOString(),
        databaseId: (firebaseConfig as any).firestoreDatabaseId || '(default)',
        projectId: firebaseConfig.projectId || 'gen-lang-client-0692995380',
        exportedBy: 'admin',
        source: 'firestore_cloud_live',
        counts,
        checksum: 'imported_custom',
        securityHash: 'sec_imported',
        payload
      }
    };
  } catch (err: any) {
    return {
      isValid: false,
      isCloudSnapshot: false,
      counts: { students: 0, classes: 0, subjects: 0, exams: 0, marks: 0, remarks: 0, transactions: 0, feeStructures: 0, teachers: 0, academicYears: 0, trashBin: 0 },
      errors: ['JSON ফাইল স্ক্যান ব্যর্থ হয়েছে: ' + (err?.message || 'অজ্ঞাত ত্রুটি')],
      warnings: []
    };
  }
}

/**
 * Restores data from a previously generated Cloud Snapshot package.
 * Phase 3: routes through the single validated restore path.
 * Target mode:
 * - 'full': Restores client LocalStorage + IndexedDB Vault AND overwrites Firestore database
 * - 'client_only': Restores browser LocalStorage & IndexedDB (useful if client data was cleared, leaving cloud as-is)
 */
export async function restoreFromCloudSnapshotPackage(
  snapshotPkg: CloudDataSnapshotPackage,
  targetMode: 'full' | 'client_only' = 'full',
  adminEmail?: string
): Promise<FullRestoreResult> {
  const payload = snapshotPkg.payload;
  const res = await performValidatedFullRestore(payload, {
    adminEmail: adminEmail || snapshotPkg.exportedBy || 'admin',
    targetMode,
    restoredFromLabel: snapshotPkg.exportedAt,
    version: '3.0.0-cloud-snapshot-restored',
    vaultSuccessLabelBn: 'ক্লাউড স্ন্যাপশট থেকে রিস্টোর',
    vaultSuccessLabelEn: 'Restored from Cloud Snapshot',
  });
  return {
    ...res,
    message: res.success
      ? (targetMode === 'full'
        ? `✓ ক্লাউড স্ন্যাপশট থেকে ${res.counts.students} জন শিক্ষার্থী ও ${res.counts.marks} টি মার্কস সফলভাবে ক্লাউড ও লোকাল স্টোরেজে রিস্টোর ও যাচাই সম্পন্ন হয়েছে!`
        : `✓ ক্লাউড স্ন্যাপশট থেকে ক্লায়েন্ট স্টোরেজে ${res.counts.students} জন শিক্ষার্থী ও ${res.counts.marks} টি মার্কস পুনরুদ্ধার (Client Recovery) সম্পন্ন হয়েছে!`)
      : res.message,
  };
}

/** Phase 3: REAL cloud-snapshot restore (fixes the CloudSyncWidget
 * misnomer). Fetches the snapshot doc fresh, then restores THAT
 * snapshot through the validated path — never a pull of current
 * cloud dressed as a restore. */
export async function restoreCloudSnapshotDoc(
  snapshotId: string,
  adminEmail?: string,
  confirmedShrinks?: Partial<Record<keyof RestoreCounts, number>>
): Promise<FullRestoreResult> {
  const snapRef = doc(db, 'cloud_snapshots', snapshotId);
  const snapDoc = await getDoc(snapRef);
  if (!snapDoc.exists()) {
    throw new Error('ক্লাউড স্ন্যাপশটটি পাওয়া যায়নি — হয়তো ডিলিট করা হয়েছে।');
  }
  const data = snapDoc.data() as CloudStoredSnapshotMeta;
  if (!data.payload) {
    throw new Error('ক্লাউড স্ন্যাপশটে কোনো ডাটা নেই।');
  }
  return performValidatedFullRestore(data.payload, {
    adminEmail,
    targetMode: 'full',
    confirmedShrinks,
    restoredFromLabel: data.timestamp,
    version: '3.0.0-cloud-snapshot-restored',
    vaultSuccessLabelBn: 'ক্লাউড স্ন্যাপশট থেকে রিস্টোর',
    vaultSuccessLabelEn: 'Restored from Cloud Snapshot',
  });
}
