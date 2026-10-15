/**
 * Production Exam & Marks Service Layer
 * Multi-tenant safe, RBAC-guarded, and DataScope-aware operations.
 * Works for BOTH School and Madrasah.
 */

import {
  Exam,
  ExamSubjectAssignment,
  MarkRecord,
  Subject,
  ClassSubjectAssignment,
  SchoolClass,
  Section,
  AcademicYear
} from '../types';
import { AuthorizationContext } from '../types/rbac';
import { checkPermission } from './authorization';
import {
  validateExam,
  validateExamSubjectAssignment,
  validateMarkRecord,
  validateExamFinalization
} from './examValidation';
import { calculateSubjectGrade, calculateSubjectGradePoint } from './gradingEngine';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * ID Generators (Always prefixed and stable)
 */
export function generateExamId(): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `ex_${ts}_${rnd}`;
}

export function generateExamSubjectId(): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `exs_${ts}_${rnd}`;
}

export function generateMarkId(): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `mrk_${ts}_${rnd}`;
}

// -------------------------------------------------------------
// EXAM BUILDERS & ACTIONS
// -------------------------------------------------------------

export function buildCreateExamPayload(
  input: Omit<Exam, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingExams: Exam[] = [],
  academicYears: AcademicYear[] = [],
  classes: SchoolClass[] = []
): { exam: Exam | null; error?: string } {
  const validation = validateExam(input, existingExams, academicYears, classes);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid exam data';
    return { exam: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateExamId();

  const exam: Exam = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    nameBn: input.nameBn ? input.nameBn.trim() : undefined,
    academicYear: input.academicYear.trim(),
    academicYearId: input.academicYearId || input.academicYear.trim(),
    category: input.category || 'Term',
    status: input.status || 'SCHEDULED',
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { exam };
}

export function buildUpdateExamPayload(
  existing: Exam,
  updates: Partial<Exam>,
  actor?: { uid: string; email: string },
  existingExams: Exam[] = [],
  academicYears: AcademicYear[] = [],
  classes: SchoolClass[] = []
): { exam: Exam; error?: string } {
  const merged: Exam = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateExam(merged, existingExams, academicYears, classes, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid exam update';
    return { exam: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const exam: Exam = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { exam };
}

export function buildArchiveExamPayload(
  existing: Exam,
  actor?: { uid: string; email: string }
): Exam {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'ARCHIVED',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

export function buildFinalizeExamPayload(
  existing: Exam,
  actor?: { uid: string; email: string }
): Exam {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'FINALIZED',
    finalizedAt: now,
    finalizedBy: actor?.uid || actor?.email || 'admin',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

// -------------------------------------------------------------
// EXAM SUBJECT ASSIGNMENT BUILDERS
// -------------------------------------------------------------

export function buildCreateExamSubjectPayload(
  input: Omit<ExamSubjectAssignment, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingAssignments: ExamSubjectAssignment[] = [],
  exams: Exam[] = [],
  subjects: Subject[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = [],
  classSubjectAssignments: ClassSubjectAssignment[] = []
): { assignment: ExamSubjectAssignment | null; error?: string } {
  const validation = validateExamSubjectAssignment(
    input,
    existingAssignments,
    exams,
    subjects,
    classes,
    sections,
    academicYears,
    classSubjectAssignments
  );

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid exam subject assignment';
    return { assignment: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateExamSubjectId();

  const assignment: ExamSubjectAssignment = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    status: input.status || 'ACTIVE',
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { assignment };
}

export function buildArchiveExamSubjectPayload(
  existing: ExamSubjectAssignment,
  actor?: { uid: string; email: string }
): ExamSubjectAssignment {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'INACTIVE',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

// -------------------------------------------------------------
// MARK RECORD BUILDERS & BATCH ENTRY
// -------------------------------------------------------------

export function buildUpsertMarkPayload(
  input: (Omit<Partial<MarkRecord>, 'id'> & { studentId: string; subjectId: string; examId: string; id?: string }) | (Omit<MarkRecord, 'id'> & { id?: string }),
  existingMark?: MarkRecord,
  subject?: Subject,
  examSubject?: ExamSubjectAssignment,
  exam?: Exam,
  actor?: { uid: string; email: string },
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID
): { mark: MarkRecord | null; error?: string } {
  const validation = validateMarkRecord(input, subject, examSubject, exam);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid mark record';
    return { mark: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = existingMark?.id || input.id || generateMarkId();
  const fullMarks = examSubject?.fullMarks ?? subject?.fullMarks ?? input.total ?? input.fullMarks ?? 100;
  const passMarks = examSubject?.passMarks ?? subject?.passMarks ?? input.passMarks ?? 33;
  const isAbsent = !!input.isAbsent;

  // Calculate total obtained accurately
  let obtained = 0;
  if (!isAbsent) {
    if (input.obtainedCQ !== undefined || input.obtainedMCQ !== undefined || input.obtainedPractical !== undefined) {
      obtained = (Number(input.obtainedCQ) || 0) + (Number(input.obtainedMCQ) || 0) + (Number(input.obtainedPractical) || 0);
    } else {
      obtained = Number(input.obtained) || 0;
    }
  }

  const grade = calculateSubjectGrade(obtained, fullMarks, undefined, isAbsent, passMarks);
  const gradePoint = calculateSubjectGradePoint(obtained, fullMarks, undefined, isAbsent, passMarks);

  const mark: MarkRecord = {
    ...existingMark,
    ...input,
    id: stableId,
    institutionId: input.institutionId || existingMark?.institutionId || institutionId,
    obtained,
    obtainedCQ: input.obtainedCQ !== undefined && !isAbsent ? Number(input.obtainedCQ) : undefined,
    obtainedMCQ: input.obtainedMCQ !== undefined && !isAbsent ? Number(input.obtainedMCQ) : undefined,
    obtainedPractical: input.obtainedPractical !== undefined && !isAbsent ? Number(input.obtainedPractical) : undefined,
    total: fullMarks,
    fullMarks,
    passMarks,
    isAbsent,
    absentReason: isAbsent ? input.absentReason : undefined,
    grade,
    gradePoint,
    status: input.status || existingMark?.status || 'SUBMITTED',
    enteredBy: existingMark?.enteredBy || actor?.uid || 'system',
    updatedBy: actor?.uid || 'system',
    createdAt: existingMark?.createdAt || now,
    updatedAt: now
  };

  return { mark };
}

// -------------------------------------------------------------
// TEACHER DATASCOPE & AUTHORIZATION VERIFICATION
// -------------------------------------------------------------

/**
 * Checks if a teacher or user is authorized to view or edit marks for a specific class/subject.
 * Enforces Level 2 (RBAC) and Level 3 (DataScope) boundary checks.
 */
export function verifyTeacherMarkAccess(
  authContext: AuthorizationContext | null,
  permission: 'marks.view' | 'marks.create' | 'marks.edit' | 'marks.correct' = 'marks.edit',
  scope: { classId: string; subjectId: string }
): { allowed: boolean; reason?: string } {
  if (!authContext) {
    return { allowed: false, reason: 'Authentication required' };
  }

  // Super Admin has universal platform authority
  if (authContext.isSuperAdmin || authContext.isInstitutionAdmin) {
    return { allowed: true };
  }

  // Permission check
  const hasPerm = checkPermission(authContext, permission, scope);
  if (!hasPerm) {
    return { 
      allowed: false, 
      reason: `Unauthorized: Missing permission '${permission}' or class/subject outside assigned scope.` 
    };
  }

  return { allowed: true };
}

// -------------------------------------------------------------
// AUDIT LOGGING HELPERS
// -------------------------------------------------------------

export async function recordExamAuditEvent(params: {
  action: 'EXAM_CREATED' | 'EXAM_UPDATED' | 'EXAM_ARCHIVED' | 'EXAM_FINALIZED';
  exam: Exam;
  actor: { uid: string; email: string; role?: string };
  institutionId?: string;
  before?: Record<string, any> | null;
}) {
  try {
    await logAuditEvent({
      action: params.action,
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role || 'admin',
      institutionId: params.institutionId || params.exam.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'exam',
      targetId: params.exam.id,
      targetName: params.exam.name,
      before: params.before || null,
      after: {
        id: params.exam.id,
        name: params.exam.name,
        academicYear: params.exam.academicYear,
        status: params.exam.status
      }
    });
  } catch (err) {
    console.warn('[ExamService] Audit record notice:', err);
  }
}

export async function recordExamSubjectAuditEvent(params: {
  action: 'EXAM_SUBJECT_ASSIGNED' | 'EXAM_SUBJECT_UPDATED' | 'EXAM_SUBJECT_ARCHIVED';
  assignment: ExamSubjectAssignment;
  actor: { uid: string; email: string; role?: string };
  institutionId?: string;
  before?: Record<string, any> | null;
}) {
  try {
    await logAuditEvent({
      action: params.action,
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role || 'admin',
      institutionId: params.institutionId || params.assignment.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'exam_subject',
      targetId: params.assignment.id,
      targetName: `Exam ${params.assignment.examId} -> Subject ${params.assignment.subjectId}`,
      before: params.before || null,
      after: {
        id: params.assignment.id,
        examId: params.assignment.examId,
        subjectId: params.assignment.subjectId,
        classId: params.assignment.classId,
        status: params.assignment.status
      }
    });
  } catch (err) {
    console.warn('[ExamService] Audit record notice:', err);
  }
}

export async function recordMarksAuditEvent(params: {
  action: 'MARKS_CREATED' | 'MARKS_UPDATED' | 'MARKS_SUBMITTED' | 'MARKS_LOCKED' | 'MARKS_FINALIZED' | 'MARKS_CORRECTED';
  examId: string;
  classId?: string;
  subjectId?: string;
  count: number;
  actor: { uid: string; email: string; role?: string };
  institutionId?: string;
  before?: Record<string, any> | null;
}) {
  try {
    await logAuditEvent({
      action: params.action,
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role || 'teacher',
      institutionId: params.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'mark',
      targetId: `${params.examId}_${params.subjectId || 'bulk'}`,
      targetName: `Marks update: ${params.count} records (Exam: ${params.examId})`,
      before: params.before || null,
      after: {
        examId: params.examId,
        subjectId: params.subjectId,
        classId: params.classId,
        recordsUpdated: params.count
      }
    });
  } catch (err) {
    console.warn('[ExamService] Audit record notice:', err);
  }
}
