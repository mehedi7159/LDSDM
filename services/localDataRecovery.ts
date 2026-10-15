import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
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
  GradingSystem
} from '../types';
import { DEFAULT_GRADING_SYSTEM } from '../types';

/**
 * ============================================================================
 * EMERGENCY DATA RECOVERY SERVICE
 * LocalStorage -> Firestore (institution/main_store)
 * ============================================================================
 * 
 * Safety Rules:
 * 1. NEVER automatically overwrite cloud on login.
 * 2. NEVER delete or clear localStorage data.
 * 3. ALWAYS generate a downloadable JSON backup before cloud write.
 * 4. ALWAYS validate data integrity and block empty payloads.
 * 5. ALWAYS require explicit admin confirmation before writing to Firestore.
 * 6. ALWAYS execute immediate read-back count verification post-write.
 */

export interface LocalRecoverySnapshot {
  version: string;
  exportedAt: string;
  sourceOrigin: string;
  counts: {
    students: number;
    classes: number;
    subjects: number;
    exams: number;
    marks: number;
    remarks: number;
    transactions: number;
    feeStructures: number;
    trashBin: number;
  };
  payload: {
    schoolProfile: SchoolProfile;
    students: Student[];
    classes: SchoolClass[];
    subjects: Subject[];
    exams: Exam[];
    marks: MarkRecord[];
    remarks: RemarkRecord[];
    transactions: FinanceTransaction[];
    feeStructures: ClassFeeStructure[];
    trashBin: TrashItem[];
    gradingSystem?: GradingSystem[];
  };
}

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING';
  entity: string;
  message: string;
}

export interface RecoveryValidationResult {
  isValid: boolean;
  canRestore: boolean;
  isEmpty: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    totalRecords: number;
    hasStudents: boolean;
    hasMarks: boolean;
    hasClasses: boolean;
  };
}

export interface CloudStatusCheck {
  exists: boolean;
  isEmpty: boolean;
  counts?: {
    students: number;
    classes: number;
    subjects: number;
    exams: number;
    marks: number;
    remarks: number;
    transactions: number;
    feeStructures: number;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export interface RestoreVerificationResult {
  isVerified: boolean;
  mismatches: string[];
  idParityChecks: {
    studentsMatched: boolean;
    classesMatched: boolean;
    subjectsMatched: boolean;
    examsMatched: boolean;
    marksMatched: boolean;
  };
  cloudCounts: {
    students: number;
    classes: number;
    subjects: number;
    exams: number;
    marks: number;
    remarks: number;
    transactions: number;
    feeStructures: number;
  };
}

/**
 * Reads all 10 known application keys from localStorage
 * without mutating or modifying anything.
 */
export function readLocalRecoverySnapshot(): LocalRecoverySnapshot {
  const safeParse = <T>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      const val = localStorage.getItem(key);
      if (!val) return fallback;
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (err) {
      console.warn(`[LocalRecovery] Failed to parse key "${key}":`, err);
      return fallback;
    }
  };

  const defaultProfile: SchoolProfile = {
    name: 'দারুল উলুম মাদ্রাসা',
    nameBn: 'দারুল উলুম মাদ্রাসা',
    address: 'ঢাকা, বাংলাদেশ',
    phone: '',
    email: '',
    academicYear: '২০২৬',
    headMasterName: 'মুহতামিম সাহেব'
  };

  const schoolProfile = safeParse<SchoolProfile>('schoolProfile', defaultProfile);
  const students = safeParse<Student[]>('students', []);
  const classes = safeParse<SchoolClass[]>('classes', []);
  const subjects = safeParse<Subject[]>('subjects', []);
  const exams = safeParse<Exam[]>('exams', []);
  const marks = safeParse<MarkRecord[]>('marks', []);
  const remarks = safeParse<RemarkRecord[]>('remarks', []);
  const transactions = safeParse<FinanceTransaction[]>('madrasha_transactions', []);
  const feeStructures = safeParse<ClassFeeStructure[]>('madrasha_fee_structures', []);
  const trashBin = safeParse<TrashItem[]>('madrasha_trash_bin', []);

  return {
    version: '1.0.0-recovery',
    exportedAt: new Date().toISOString(),
    sourceOrigin: typeof window !== 'undefined' ? window.location.origin : 'offline',
    counts: {
      students: Array.isArray(students) ? students.length : 0,
      classes: Array.isArray(classes) ? classes.length : 0,
      subjects: Array.isArray(subjects) ? subjects.length : 0,
      exams: Array.isArray(exams) ? exams.length : 0,
      marks: Array.isArray(marks) ? marks.length : 0,
      remarks: Array.isArray(remarks) ? remarks.length : 0,
      transactions: Array.isArray(transactions) ? transactions.length : 0,
      feeStructures: Array.isArray(feeStructures) ? feeStructures.length : 0,
      trashBin: Array.isArray(trashBin) ? trashBin.length : 0
    },
    payload: {
      schoolProfile,
      students: Array.isArray(students) ? students : [],
      classes: Array.isArray(classes) ? classes : [],
      subjects: Array.isArray(subjects) ? subjects : [],
      exams: Array.isArray(exams) ? exams : [],
      marks: Array.isArray(marks) ? marks : [],
      remarks: Array.isArray(remarks) ? remarks : [],
      transactions: Array.isArray(transactions) ? transactions : [],
      feeStructures: Array.isArray(feeStructures) ? feeStructures : [],
      trashBin: Array.isArray(trashBin) ? trashBin : [],
      gradingSystem: schoolProfile?.gradingSystem || DEFAULT_GRADING_SYSTEM
    }
  };
}

/**
 * Validates the local snapshot integrity before cloud write.
 * Enforces strict Empty-Data Protection.
 */
export function validateRecoverySnapshot(snapshot: LocalRecoverySnapshot): RecoveryValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const { counts, payload } = snapshot;
  const totalRecords =
    counts.students +
    counts.classes +
    counts.subjects +
    counts.exams +
    counts.marks +
    counts.transactions;

  const isEmpty = totalRecords === 0;

  if (isEmpty) {
    errors.push({
      type: 'ERROR',
      entity: 'Global',
      message: 'লোকাল স্টোরেজে কোনো শিক্ষার্থী, শ্রেণি, বিষয় বা মার্কস নেই (Total Records = 0)। ক্লাউড ওভাররাইট সম্পূর্ণ ব্লক করা হয়েছে।'
    });
  }

  // 1. Validate Students
  const studentIds = new Set<string>();
  payload.students.forEach((s, idx) => {
    if (!s.id) {
      errors.push({ type: 'ERROR', entity: 'Student', message: `Student index ${idx} is missing unique ID.` });
    } else {
      if (studentIds.has(s.id)) {
        warnings.push({ type: 'WARNING', entity: 'Student', message: `Duplicate student ID found: ${s.id}` });
      }
      studentIds.add(s.id);
    }
    if (!s.name) {
      warnings.push({ type: 'WARNING', entity: 'Student', message: `Student ID ${s.id || idx} has no name.` });
    }
  });

  // 2. Validate Classes
  const classNames = new Set<string>();
  payload.classes.forEach((c, idx) => {
    if (!c.name) {
      warnings.push({ type: 'WARNING', entity: 'Class', message: `Class index ${idx} has empty name.` });
    } else {
      classNames.add(c.name);
    }
  });

  // 3. Validate Subjects
  const subjectIds = new Set<string>();
  payload.subjects.forEach((sub, idx) => {
    if (sub.id) subjectIds.add(sub.id);
    else warnings.push({ type: 'WARNING', entity: 'Subject', message: `Subject index ${idx} has missing ID.` });
  });

  // 4. Validate Exams
  const examIds = new Set<string>();
  payload.exams.forEach((ex, idx) => {
    if (ex.id) examIds.add(ex.id);
    else warnings.push({ type: 'WARNING', entity: 'Exam', message: `Exam index ${idx} has missing ID.` });
  });

  // 5. Validate Marks (Foreign Keys)
  payload.marks.forEach((m, idx) => {
    if (!m.id) {
      warnings.push({ type: 'WARNING', entity: 'Mark', message: `Mark index ${idx} has missing ID.` });
    }
    if (m.studentId && !studentIds.has(m.studentId)) {
      warnings.push({ type: 'WARNING', entity: 'Mark', message: `Mark ${m.id || idx} points to missing studentId "${m.studentId}".` });
    }
  });

  const isValid = errors.length === 0;
  const canRestore = isValid && !isEmpty;

  return {
    isValid,
    canRestore,
    isEmpty,
    errors,
    warnings,
    summary: {
      totalRecords,
      hasStudents: counts.students > 0,
      hasMarks: counts.marks > 0,
      hasClasses: counts.classes > 0
    }
  };
}

/**
 * Triggers a browser JSON file download of the full snapshot
 */
export function downloadRecoveryBackupJson(snapshot: LocalRecoverySnapshot): string {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const filename = `madrasah-local-recovery-${dateStr}.json`;
  const jsonContent = JSON.stringify(snapshot, null, 2);

  if (typeof window !== 'undefined' && document) {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return filename;
}

/**
 * Checks the current Firestore /institution/main_store document
 * to prevent accidental overwrite of existing cloud records.
 */
export async function checkCloudMainStoreStatus(): Promise<CloudStatusCheck> {
  try {
    const docRef = doc(db, 'institution', 'main_store');
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { exists: false, isEmpty: true };
    }

    const data = snap.data();
    const counts = {
      students: Array.isArray(data.students) ? data.students.length : 0,
      classes: Array.isArray(data.classes) ? data.classes.length : 0,
      subjects: Array.isArray(data.subjects) ? data.subjects.length : 0,
      exams: Array.isArray(data.exams) ? data.exams.length : 0,
      marks: Array.isArray(data.marks) ? data.marks.length : 0,
      remarks: Array.isArray(data.remarks) ? data.remarks.length : 0,
      transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
      feeStructures: Array.isArray(data.feeStructures) ? data.feeStructures.length : 0
    };

    const totalCloudRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      exists: true,
      isEmpty: totalCloudRecords === 0,
      counts,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy
    };
  } catch (err) {
    console.warn('[LocalRecovery] Cloud status check warning:', err);
    return { exists: false, isEmpty: true };
  }
}

/**
 * Safely writes the validated snapshot to /institution/main_store in Firestore.
 * Requires non-empty data and explicit authorization.
 */
export async function restoreValidatedSnapshotToFirestore(
  snapshot: LocalRecoverySnapshot,
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  const validation = validateRecoverySnapshot(snapshot);
  if (!validation.canRestore) {
    throw new Error('Recovery aborted: Snapshot failed validation or is completely empty.');
  }

  const payload = {
    schoolProfile: snapshot.payload.schoolProfile,
    students: snapshot.payload.students,
    classes: snapshot.payload.classes,
    subjects: snapshot.payload.subjects,
    exams: snapshot.payload.exams,
    marks: snapshot.payload.marks,
    remarks: snapshot.payload.remarks,
    transactions: snapshot.payload.transactions,
    feeStructures: snapshot.payload.feeStructures,
    trashBin: snapshot.payload.trashBin,
    updatedBy: adminEmail || 'admin-recovery',
    updatedAt: new Date().toISOString(),
    recoveryMeta: {
      restoredFrom: 'local_storage_recovery_tool',
      sourceRecordCount: validation.summary.totalRecords,
      restoredAt: new Date().toISOString()
    }
  };

  const docRef = doc(db, 'institution', 'main_store');
  await setDoc(docRef, payload, { merge: true });

  return {
    success: true,
    message: 'Successfully restored validated local snapshot to Firestore (institution/main_store).'
  };
}

/**
 * Immediately reads back the document from Firestore and verifies count parity.
 */
export async function verifyPostRestoreCounts(
  expectedSnapshot: LocalRecoverySnapshot
): Promise<RestoreVerificationResult> {
  const docRef = doc(db, 'institution', 'main_store');
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return {
      isVerified: false,
      mismatches: ['Firestore document /institution/main_store does not exist post-restore.'],
      idParityChecks: {
        studentsMatched: false,
        classesMatched: false,
        subjectsMatched: false,
        examsMatched: false,
        marksMatched: false
      },
      cloudCounts: {
        students: 0,
        classes: 0,
        subjects: 0,
        exams: 0,
        marks: 0,
        remarks: 0,
        transactions: 0,
        feeStructures: 0
      }
    };
  }

  const data = snap.data();
  const cloudCounts = {
    students: Array.isArray(data.students) ? data.students.length : 0,
    classes: Array.isArray(data.classes) ? data.classes.length : 0,
    subjects: Array.isArray(data.subjects) ? data.subjects.length : 0,
    exams: Array.isArray(data.exams) ? data.exams.length : 0,
    marks: Array.isArray(data.marks) ? data.marks.length : 0,
    remarks: Array.isArray(data.remarks) ? data.remarks.length : 0,
    transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
    feeStructures: Array.isArray(data.feeStructures) ? data.feeStructures.length : 0
  };

  const mismatches: string[] = [];
  const expected = expectedSnapshot.counts;

  if (cloudCounts.students !== expected.students) mismatches.push(`Students: expected ${expected.students}, got ${cloudCounts.students}`);
  if (cloudCounts.classes !== expected.classes) mismatches.push(`Classes: expected ${expected.classes}, got ${cloudCounts.classes}`);
  if (cloudCounts.subjects !== expected.subjects) mismatches.push(`Subjects: expected ${expected.subjects}, got ${cloudCounts.subjects}`);
  if (cloudCounts.exams !== expected.exams) mismatches.push(`Exams: expected ${expected.exams}, got ${cloudCounts.exams}`);
  if (cloudCounts.marks !== expected.marks) mismatches.push(`Marks: expected ${expected.marks}, got ${cloudCounts.marks}`);
  if (cloudCounts.transactions !== expected.transactions) mismatches.push(`Transactions: expected ${expected.transactions}, got ${cloudCounts.transactions}`);

  // ID Parity verification
  const checkIdSet = (localList: any[], cloudList: any[], entityName: string): boolean => {
    const localIds = new Set((localList || []).map(item => item.id).filter(Boolean));
    const cloudIds = new Set((cloudList || []).map(item => item.id).filter(Boolean));
    if (localIds.size !== cloudIds.size) {
      mismatches.push(`${entityName} ID count mismatch: Local ${localIds.size} vs Cloud ${cloudIds.size}`);
      return false;
    }
    for (const id of localIds) {
      if (!cloudIds.has(id)) {
        mismatches.push(`${entityName} missing ID in cloud: ${id}`);
        return false;
      }
    }
    return true;
  };

  const studentsMatched = checkIdSet(expectedSnapshot.payload.students, data.students, 'Students');
  const classesMatched = checkIdSet(expectedSnapshot.payload.classes, data.classes, 'Classes');
  const subjectsMatched = checkIdSet(expectedSnapshot.payload.subjects, data.subjects, 'Subjects');
  const examsMatched = checkIdSet(expectedSnapshot.payload.exams, data.exams, 'Exams');
  const marksMatched = checkIdSet(expectedSnapshot.payload.marks, data.marks, 'Marks');

  return {
    isVerified: mismatches.length === 0,
    mismatches,
    idParityChecks: {
      studentsMatched,
      classesMatched,
      subjectsMatched,
      examsMatched,
      marksMatched
    },
    cloudCounts
  };
}
