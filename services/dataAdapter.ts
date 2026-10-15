import { db, auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
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
 * PHASE 4D-1 — CLIENT DATA ADAPTER & READ COMPATIBILITY LAYER
 * ============================================================================
 * 
 * Strict Safety Directives:
 * - NO Firestore document copy/move/modify/delete.
 * - NO collection rename or production cutover.
 * - NO dual-write to tenant collections.
 * - Default data source is STRICTLY the legacy root data source.
 * ============================================================================
 */

export type DataSourceMode = 'LEGACY_ROOT' | 'TENANT_SCOPED';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

// ============================================================================
// DOMAIN ENTITY INTERFACES (Strictly Separated Concepts)
// ============================================================================

/**
 * Daily Attendance (Future entity — distinct from exam-level remarks)
 */
export interface DailyAttendanceRecord {
  id: string;
  institutionId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remark?: string;
  recordedBy?: string;
}

/**
 * Student Fee Due (Future entity — distinct from fee template configurations)
 */
export interface StudentFeeDueRecord {
  id: string;
  institutionId: string;
  studentId: string;
  classLevel: string;
  feeStructureId: string;
  month: string; // YYYY-MM
  amount: number;
  discount: number;
  netDue: number;
  isPaid: boolean;
  dueDate: string;
}

/**
 * Fee Payment (Future entity — distinct from fee dues and general vouchers)
 */
export interface FeePaymentRecord {
  id: string;
  institutionId: string;
  receiptNo: string;
  studentId: string;
  feeDueId?: string;
  amount: number;
  paymentMethod: string;
  collectedAt: string;
  collectedBy: string;
}

/**
 * Double-Entry Ledger Entry (Future entity — distinct from single-entry cash vouchers)
 */
export interface DoubleEntryLedgerRecord {
  id: string;
  institutionId: string;
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  fundId: string;
  postedAt: string;
}

/**
 * Immutable Audit Log (Future entity — distinct from recoverable trash bin)
 */
export interface AuditLogRecord {
  id: string;
  institutionId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'MIGRATE' | 'SECURITY';
  entity: string;
  entityId: string;
  performedBy: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// DATA INTEGRITY & AUDIT TYPES
// ============================================================================

export type IntegritySeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  entity: string;
  entityId: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DataIntegrityReport {
  isHealthy: boolean;
  totalErrors: number;
  totalWarnings: number;
  generatedAt: string;
  sourceMode: DataSourceMode;
  tenantId: string;
  census: {
    students: number;
    classes: number;
    subjects: number;
    exams: number;
    marks: number;
    remarks: number;
    transactions: number;
    feeStructures: number;
    trashItems: number;
  };
  checksums: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    totalMarksSum: number;
  };
  issues: IntegrityIssue[];
}

// ============================================================================
// REPOSITORY INTERFACES
// ============================================================================

export interface IInstitutionRepository {
  getProfile(): Promise<SchoolProfile>;
  getGradingSystem(): Promise<GradingSystem[]>;
  getTenantMetadata(): Promise<{ institutionId: string; type: string; status: string }>;
}

export interface IStudentRepository {
  getAll(): Promise<Student[]>;
  getById(id: string): Promise<Student | null>;
  getByClass(classLevel: string): Promise<Student[]>;
  getCount(): Promise<number>;
}

export interface IClassRepository {
  getAll(): Promise<SchoolClass[]>;
  getById(id: string): Promise<SchoolClass | null>;
}

export interface ISubjectRepository {
  getAll(): Promise<Subject[]>;
  getByClass(classLevel: string): Promise<Subject[]>;
}

export interface IExamRepository {
  getAll(): Promise<Exam[]>;
  getById(id: string): Promise<Exam | null>;
}

export interface IMarkRepository {
  getAll(): Promise<MarkRecord[]>;
  getByExam(examId: string): Promise<MarkRecord[]>;
  getByStudent(studentId: string): Promise<MarkRecord[]>;
}

/**
 * Performance Remark Repository:
 * Handles exam-wise performance observations and aggregate term attendance.
 * (STRICTLY SEPARATED from future daily attendance records)
 */
export interface IPerformanceRemarkRepository {
  getAll(): Promise<RemarkRecord[]>;
  getByExam(examId: string): Promise<RemarkRecord[]>;
  getByStudent(studentId: string): Promise<RemarkRecord[]>;
}

/**
 * Transaction Repository:
 * Handles current single-entry cash flow vouchers.
 * (STRICTLY SEPARATED from future double-entry ledger entries)
 */
export interface ITransactionRepository {
  getAll(): Promise<FinanceTransaction[]>;
  getByType(type: 'INCOME' | 'EXPENSE'): Promise<FinanceTransaction[]>;
  getByFund(fundType: string): Promise<FinanceTransaction[]>;
  calculateFinancialSummary(): Promise<{ totalIncome: number; totalExpense: number; netBalance: number }>;
}

/**
 * Fee Structure Repository:
 * Handles academic fee templates & catalog configurations.
 * (STRICTLY SEPARATED from actual student dues or payment receipts)
 */
export interface IFeeStructureRepository {
  getAll(): Promise<ClassFeeStructure[]>;
  getByClass(classLevel: string): Promise<ClassFeeStructure | null>;
}

/**
 * Trash Repository:
 * Handles recoverable soft-deleted items.
 * (STRICTLY SEPARATED from immutable audit logs)
 */
export interface ITrashRepository {
  getAll(): Promise<TrashItem[]>;
}

/**
 * Future Domain Repositories (Stubs / Read-only abstractions for Phase 4D-1)
 */
export interface IAttendanceRepository {
  getAll(): Promise<DailyAttendanceRecord[]>;
  getByDate(date: string): Promise<DailyAttendanceRecord[]>;
}

export interface IStudentFeeDuesRepository {
  getAll(): Promise<StudentFeeDueRecord[]>;
  getByStudent(studentId: string): Promise<StudentFeeDueRecord[]>;
}

export interface IPaymentRepository {
  getAll(): Promise<FeePaymentRecord[]>;
  getByStudent(studentId: string): Promise<FeePaymentRecord[]>;
}

export interface IDoubleEntryLedgerRepository {
  getAll(): Promise<DoubleEntryLedgerRecord[]>;
}

export interface IAuditLogRepository {
  getAll(): Promise<AuditLogRecord[]>;
}

/**
 * Unified Data Adapter Interface
 */
export interface IDataAdapter {
  readonly mode: DataSourceMode;
  readonly tenantId: string;
  readonly isReadOnly: boolean;

  institution: IInstitutionRepository;
  students: IStudentRepository;
  classes: IClassRepository;
  subjects: ISubjectRepository;
  exams: IExamRepository;
  marks: IMarkRepository;
  remarks: IPerformanceRemarkRepository;
  transactions: ITransactionRepository;
  feeStructures: IFeeStructureRepository;
  trash: ITrashRepository;

  // Future separated domains (Stubs in Phase 4D-1)
  attendance: IAttendanceRepository;
  studentFeeDues: IStudentFeeDuesRepository;
  payments: IPaymentRepository;
  doubleEntryLedger: IDoubleEntryLedgerRepository;
  auditLogs: IAuditLogRepository;

  validateIntegrity(): Promise<DataIntegrityReport>;
}

// ============================================================================
// LEGACY DATA ADAPTER (Current Production Read Implementation)
// ============================================================================

/**
 * Helper to fetch legacy root state from Firestore institution/main_store
 * with fallback to local cached snapshots when offline or unauthenticated.
 */
async function fetchLegacyRootSnapshot(): Promise<Record<string, any>> {
  try {
    // 1. If authenticated, attempt direct read from authoritative Firestore root doc
    if (auth.currentUser) {
      const docRef = doc(db, 'institution', 'main_store');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
    }
  } catch (err) {
    console.warn('[LegacyDataAdapter] Remote fetch warning, reading local snapshot:', err);
  }

  // 2. LocalStorage snapshot fallback (safe offline reading)
  const localData: Record<string, any> = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const p = localStorage.getItem('schoolProfile');
      if (p) localData.schoolProfile = JSON.parse(p);
      const st = localStorage.getItem('students');
      if (st) localData.students = JSON.parse(st);
      const cl = localStorage.getItem('classes');
      if (cl) localData.classes = JSON.parse(cl);
      const sub = localStorage.getItem('subjects');
      if (sub) localData.subjects = JSON.parse(sub);
      const ex = localStorage.getItem('exams');
      if (ex) localData.exams = JSON.parse(ex);
      const mk = localStorage.getItem('marks');
      if (mk) localData.marks = JSON.parse(mk);
      const rm = localStorage.getItem('remarks');
      if (rm) localData.remarks = JSON.parse(rm);
      const tr = localStorage.getItem('madrasha_transactions');
      if (tr) localData.transactions = JSON.parse(tr);
      const fs = localStorage.getItem('madrasha_fee_structures');
      if (fs) localData.feeStructures = JSON.parse(fs);
      const tb = localStorage.getItem('madrasha_trash_bin');
      if (tb) localData.trashBin = JSON.parse(tb);
    }
  } catch (e) {
    console.warn('[LegacyDataAdapter] Local snapshot error:', e);
  }

  return localData;
}

export class LegacyDataAdapter implements IDataAdapter {
  public readonly mode: DataSourceMode = 'LEGACY_ROOT';
  public readonly tenantId: string = CANONICAL_PRIMARY_INSTITUTION_ID;
  public readonly isReadOnly: boolean = true; // In Phase 4D-1, adapter layer operates in strict non-destructive read mode

  public institution: IInstitutionRepository;
  public students: IStudentRepository;
  public classes: IClassRepository;
  public subjects: ISubjectRepository;
  public exams: IExamRepository;
  public marks: IMarkRepository;
  public remarks: IPerformanceRemarkRepository;
  public transactions: ITransactionRepository;
  public feeStructures: IFeeStructureRepository;
  public trash: ITrashRepository;

  // Stubs for future separated domains
  public attendance: IAttendanceRepository;
  public studentFeeDues: IStudentFeeDuesRepository;
  public payments: IPaymentRepository;
  public doubleEntryLedger: IDoubleEntryLedgerRepository;
  public auditLogs: IAuditLogRepository;

  constructor() {
    this.institution = {
      getProfile: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return snap.schoolProfile || {
          name: 'দারুল উলুম মাদ্রাসা',
          nameBn: 'দারুল উলুম মাদ্রাসা',
          address: 'ঢাকা, বাংলাদেশ',
          phone: '',
          email: '',
          academicYear: '২০২৬',
          headMasterName: 'মুহতামিম সাহেব'
        };
      },
      getGradingSystem: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return snap.schoolProfile?.gradingSystem || DEFAULT_GRADING_SYSTEM;
      },
      getTenantMetadata: async () => ({
        institutionId: CANONICAL_PRIMARY_INSTITUTION_ID,
        type: 'MADRASAH',
        status: 'ACTIVE'
      })
    };

    this.students = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.students) ? snap.students : [];
      },
      getById: async (id: string) => {
        const list = await this.students.getAll();
        return list.find(s => s.id === id || s.studentId === id) || null;
      },
      getByClass: async (classLevel: string) => {
        const list = await this.students.getAll();
        return list.filter(s => s.classLevel === classLevel);
      },
      getCount: async () => {
        const list = await this.students.getAll();
        return list.length;
      }
    };

    this.classes = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.classes) ? snap.classes : [];
      },
      getById: async (id: string) => {
        const list = await this.classes.getAll();
        return list.find(c => c.id === id || c.name === id) || null;
      }
    };

    this.subjects = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.subjects) ? snap.subjects : [];
      },
      getByClass: async (classLevel: string) => {
        const list = await this.subjects.getAll();
        return list.filter(s => s.classLevel === classLevel);
      }
    };

    this.exams = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.exams) ? snap.exams : [];
      },
      getById: async (id: string) => {
        const list = await this.exams.getAll();
        return list.find(e => e.id === id) || null;
      }
    };

    this.marks = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.marks) ? snap.marks : [];
      },
      getByExam: async (examId: string) => {
        const list = await this.marks.getAll();
        return list.filter(m => m.examId === examId);
      },
      getByStudent: async (studentId: string) => {
        const list = await this.marks.getAll();
        return list.filter(m => m.studentId === studentId);
      }
    };

    this.remarks = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.remarks) ? snap.remarks : [];
      },
      getByExam: async (examId: string) => {
        const list = await this.remarks.getAll();
        return list.filter(r => r.examId === examId);
      },
      getByStudent: async (studentId: string) => {
        const list = await this.remarks.getAll();
        return list.filter(r => r.studentId === studentId);
      }
    };

    this.transactions = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.transactions) ? snap.transactions : [];
      },
      getByType: async (type: 'INCOME' | 'EXPENSE') => {
        const list = await this.transactions.getAll();
        return list.filter(t => t.type === type);
      },
      getByFund: async (fundType: string) => {
        const list = await this.transactions.getAll();
        return list.filter(t => t.fundType === fundType);
      },
      calculateFinancialSummary: async () => {
        const list = await this.transactions.getAll();
        let totalIncome = 0;
        let totalExpense = 0;
        for (const t of list) {
          const amt = Number(t.amount) || 0;
          if (t.type === 'INCOME') totalIncome += amt;
          else if (t.type === 'EXPENSE') totalExpense += amt;
        }
        return {
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense
        };
      }
    };

    this.feeStructures = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.feeStructures) ? snap.feeStructures : [];
      },
      getByClass: async (classLevel: string) => {
        const list = await this.feeStructures.getAll();
        return list.find(f => f.classLevel === classLevel) || null;
      }
    };

    this.trash = {
      getAll: async () => {
        const snap = await fetchLegacyRootSnapshot();
        return Array.isArray(snap.trashBin) ? snap.trashBin : [];
      }
    };

    // Stubs for future domains (return empty list in legacy mode)
    this.attendance = {
      getAll: async () => [],
      getByDate: async () => []
    };

    this.studentFeeDues = {
      getAll: async () => [],
      getByStudent: async () => []
    };

    this.payments = {
      getAll: async () => [],
      getByStudent: async () => []
    };

    this.doubleEntryLedger = {
      getAll: async () => []
    };

    this.auditLogs = {
      getAll: async () => []
    };
  }

  public async validateIntegrity(): Promise<DataIntegrityReport> {
    const [
      students,
      classes,
      subjects,
      exams,
      marks,
      remarks,
      transactions,
      feeStructures,
      trashItems
    ] = await Promise.all([
      this.students.getAll(),
      this.classes.getAll(),
      this.subjects.getAll(),
      this.exams.getAll(),
      this.marks.getAll(),
      this.remarks.getAll(),
      this.transactions.getAll(),
      this.feeStructures.getAll(),
      this.trash.getAll()
    ]);

    return executeDataIntegrityValidation({
      sourceMode: this.mode,
      tenantId: this.tenantId,
      students,
      classes,
      subjects,
      exams,
      marks,
      remarks,
      transactions,
      feeStructures,
      trashItems
    });
  }
}

// ============================================================================
// FUTURE TENANT DATA ADAPTER (Safe Read-Only Preview / Architecture Stub)
// ============================================================================

/**
 * FutureTenantDataAdapter:
 * Represents the target subcollection path `/institutions/{tenantId}/...`.
 * STRICT RULE IN PHASE 4D-1:
 * - NO production writes.
 * - Read operations safely query tenant subcollections or return empty collections
 *   without affecting current production data.
 */
export class FutureTenantDataAdapter implements IDataAdapter {
  public readonly mode: DataSourceMode = 'TENANT_SCOPED';
  public readonly tenantId: string;
  public readonly isReadOnly: boolean = true;

  public institution: IInstitutionRepository;
  public students: IStudentRepository;
  public classes: IClassRepository;
  public subjects: ISubjectRepository;
  public exams: IExamRepository;
  public marks: IMarkRepository;
  public remarks: IPerformanceRemarkRepository;
  public transactions: ITransactionRepository;
  public feeStructures: IFeeStructureRepository;
  public trash: ITrashRepository;

  public attendance: IAttendanceRepository;
  public studentFeeDues: IStudentFeeDuesRepository;
  public payments: IPaymentRepository;
  public doubleEntryLedger: IDoubleEntryLedgerRepository;
  public auditLogs: IAuditLogRepository;

  constructor(tenantId: string = CANONICAL_PRIMARY_INSTITUTION_ID) {
    this.tenantId = tenantId;

    this.institution = {
      getProfile: async () => ({
        name: 'দারুল উলুম মাদ্রাসা',
        nameBn: 'দারুল উলুম মাদ্রাসা',
        address: 'ঢাকা, বাংলাদেশ',
        phone: '',
        email: '',
        academicYear: '২০২৬',
        headMasterName: 'মুহতামিম সাহেব'
      }),
      getGradingSystem: async () => DEFAULT_GRADING_SYSTEM,
      getTenantMetadata: async () => ({
        institutionId: this.tenantId,
        type: 'MADRASAH',
        status: 'ACTIVE'
      })
    };

    this.students = {
      getAll: async () => [],
      getById: async () => null,
      getByClass: async () => [],
      getCount: async () => 0
    };

    this.classes = {
      getAll: async () => [],
      getById: async () => null
    };

    this.subjects = {
      getAll: async () => [],
      getByClass: async () => []
    };

    this.exams = {
      getAll: async () => [],
      getById: async () => null
    };

    this.marks = {
      getAll: async () => [],
      getByExam: async () => [],
      getByStudent: async () => []
    };

    this.remarks = {
      getAll: async () => [],
      getByExam: async () => [],
      getByStudent: async () => []
    };

    this.transactions = {
      getAll: async () => [],
      getByType: async () => [],
      getByFund: async () => [],
      calculateFinancialSummary: async () => ({ totalIncome: 0, totalExpense: 0, netBalance: 0 })
    };

    this.feeStructures = {
      getAll: async () => [],
      getByClass: async () => null
    };

    this.trash = {
      getAll: async () => []
    };

    this.attendance = {
      getAll: async () => [],
      getByDate: async () => []
    };

    this.studentFeeDues = {
      getAll: async () => [],
      getByStudent: async () => []
    };

    this.payments = {
      getAll: async () => [],
      getByStudent: async () => []
    };

    this.doubleEntryLedger = {
      getAll: async () => []
    };

    this.auditLogs = {
      getAll: async () => []
    };
  }

  public async validateIntegrity(): Promise<DataIntegrityReport> {
    return {
      isHealthy: true,
      totalErrors: 0,
      totalWarnings: 0,
      generatedAt: new Date().toISOString(),
      sourceMode: this.mode,
      tenantId: this.tenantId,
      census: {
        students: 0,
        classes: 0,
        subjects: 0,
        exams: 0,
        marks: 0,
        remarks: 0,
        transactions: 0,
        feeStructures: 0,
        trashItems: 0
      },
      checksums: {
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        totalMarksSum: 0
      },
      issues: [
        {
          severity: 'INFO',
          entity: 'TenantScope',
          entityId: this.tenantId,
          message: 'Tenant collections are in read-only architectural preview mode. Migration has not been executed.'
        }
      ]
    };
  }
}

// ============================================================================
// DATA INTEGRITY VALIDATION ENGINE (Non-Destructive & Pure Analysis)
// ============================================================================

export interface ValidationInputPayload {
  sourceMode: DataSourceMode;
  tenantId: string;
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  transactions: FinanceTransaction[];
  feeStructures: ClassFeeStructure[];
  trashItems: TrashItem[];
}

/**
 * Pure non-destructive validation function that detects:
 * - Missing IDs
 * - Orphan records (marks without students, remarks without exams)
 * - Inconsistent class linkages
 * - Financial calculation totals
 * 
 * IMPORTANT: DOES NOT ALTER OR DELETE ANY PRODUCTION DATA.
 */
export function executeDataIntegrityValidation(data: ValidationInputPayload): DataIntegrityReport {
  const issues: IntegrityIssue[] = [];

  const studentIdMap = new Map<string, Student>();
  const classNamesSet = new Set<string>();
  const classIdsSet = new Set<string>();
  const subjectIdsSet = new Set<string>();
  const examIdsSet = new Set<string>();

  // 1. Index Classes
  for (const c of data.classes) {
    if (!c.id || !c.name) {
      issues.push({
        severity: 'ERROR',
        entity: 'Class',
        entityId: c.id || 'unknown',
        message: 'Class record missing required id or name field.'
      });
    }
    if (c.id) classIdsSet.add(c.id);
    if (c.name) classNamesSet.add(c.name);
  }

  // 2. Validate Students
  for (const s of data.students) {
    if (!s.id) {
      issues.push({
        severity: 'ERROR',
        entity: 'Student',
        entityId: 'unassigned',
        message: 'Student record is missing unique primary GUID id.'
      });
    } else {
      studentIdMap.set(s.id, s);
    }

    if (!s.studentId) {
      issues.push({
        severity: 'WARNING',
        entity: 'Student',
        entityId: s.id,
        message: `Student "${s.name}" is missing human-readable studentId/roll code.`
      });
    }

    if (s.classLevel && !classNamesSet.has(s.classLevel) && !classIdsSet.has(s.classLevel)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Student',
        entityId: s.id,
        message: `Student "${s.name}" has classLevel "${s.classLevel}" which is not found in registered Classes list.`
      });
    }
  }

  // 3. Validate Subjects
  for (const sub of data.subjects) {
    if (!sub.id || !sub.name) {
      issues.push({
        severity: 'ERROR',
        entity: 'Subject',
        entityId: sub.id || 'unknown',
        message: 'Subject record missing required id or name.'
      });
    } else {
      subjectIdsSet.add(sub.id);
    }

    if (sub.classLevel && !classNamesSet.has(sub.classLevel) && !classIdsSet.has(sub.classLevel)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Subject',
        entityId: sub.id,
        message: `Subject "${sub.name}" classLevel "${sub.classLevel}" does not match registered classes.`
      });
    }
  }

  // 4. Validate Exams
  for (const ex of data.exams) {
    if (!ex.id || !ex.name) {
      issues.push({
        severity: 'ERROR',
        entity: 'Exam',
        entityId: ex.id || 'unknown',
        message: 'Exam record missing required id or name.'
      });
    } else {
      examIdsSet.add(ex.id);
    }
  }

  // 5. Validate Marks (Foreign Key Integrity)
  let totalMarksSum = 0;
  for (const m of data.marks) {
    totalMarksSum += (Number(m.obtained) || 0);

    if (!m.id) {
      issues.push({
        severity: 'ERROR',
        entity: 'Mark',
        entityId: 'missing_id',
        message: 'Mark entry is missing record id.'
      });
    }

    if (!m.studentId || !studentIdMap.has(m.studentId)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Mark',
        entityId: m.id,
        message: `Orphan Mark: StudentId "${m.studentId}" not found in registered students.`
      });
    }

    if (!m.subjectId || !subjectIdsSet.has(m.subjectId)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Mark',
        entityId: m.id,
        message: `Orphan Mark: SubjectId "${m.subjectId}" not found in registered subjects.`
      });
    }

    if (!m.examId || !examIdsSet.has(m.examId)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Mark',
        entityId: m.id,
        message: `Orphan Mark: ExamId "${m.examId}" not found in registered exams.`
      });
    }
  }

  // 6. Validate Remarks
  for (const r of data.remarks) {
    if (!r.studentId || !studentIdMap.has(r.studentId)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Remark',
        entityId: `${r.studentId}_${r.examId}`,
        message: `Orphan Remark: StudentId "${r.studentId}" not found in registered students.`
      });
    }
    if (!r.examId || !examIdsSet.has(r.examId)) {
      issues.push({
        severity: 'WARNING',
        entity: 'Remark',
        entityId: `${r.studentId}_${r.examId}`,
        message: `Orphan Remark: ExamId "${r.examId}" not found in registered exams.`
      });
    }
  }

  // 7. Validate Transactions & Compute Checksums
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of data.transactions) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'INCOME') totalIncome += amt;
    else if (t.type === 'EXPENSE') totalExpense += amt;

    if (!t.voucherNo) {
      issues.push({
        severity: 'WARNING',
        entity: 'Transaction',
        entityId: t.id,
        message: 'Transaction voucher has missing voucherNo.'
      });
    }

    if (amt <= 0) {
      issues.push({
        severity: 'WARNING',
        entity: 'Transaction',
        entityId: t.id,
        message: `Transaction ${t.voucherNo || t.id} has invalid non-positive amount (${amt}).`
      });
    }
  }

  const totalErrors = issues.filter(i => i.severity === 'ERROR').length;
  const totalWarnings = issues.filter(i => i.severity === 'WARNING').length;

  return {
    isHealthy: totalErrors === 0,
    totalErrors,
    totalWarnings,
    generatedAt: new Date().toISOString(),
    sourceMode: data.sourceMode,
    tenantId: data.tenantId,
    census: {
      students: data.students.length,
      classes: data.classes.length,
      subjects: data.subjects.length,
      exams: data.exams.length,
      marks: data.marks.length,
      remarks: data.remarks.length,
      transactions: data.transactions.length,
      feeStructures: data.feeStructures.length,
      trashItems: data.trashItems.length
    },
    checksums: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalMarksSum
    },
    issues
  };
}

// ============================================================================
// DATA ADAPTER FACTORY
// ============================================================================

let currentAdapterInstance: IDataAdapter | null = null;

/**
 * Factory to get the active DataAdapter.
 * 
 * STRICT ARCHITECTURAL PRINCIPLE:
 * Default is ALWAYS `LegacyDataAdapter` (mode: 'LEGACY_ROOT').
 * Future tenant adapter is only instantiated if VITE_USE_TENANT_COLLECTIONS === 'true'.
 */
export function getDataAdapter(tenantId: string = CANONICAL_PRIMARY_INSTITUTION_ID): IDataAdapter {
  const isTenantModeActive = typeof process !== 'undefined' 
    ? process.env?.VITE_USE_TENANT_COLLECTIONS === 'true'
    : (import.meta as any)?.env?.VITE_USE_TENANT_COLLECTIONS === 'true';

  if (isTenantModeActive) {
    if (!currentAdapterInstance || currentAdapterInstance.mode !== 'TENANT_SCOPED') {
      console.log(`[DataAdapter] Initializing FutureTenantDataAdapter for tenant "${tenantId}" (Read-Only Preview)`);
      currentAdapterInstance = new FutureTenantDataAdapter(tenantId);
    }
    return currentAdapterInstance;
  }

  if (!currentAdapterInstance || currentAdapterInstance.mode !== 'LEGACY_ROOT') {
    currentAdapterInstance = new LegacyDataAdapter();
  }
  return currentAdapterInstance;
}
