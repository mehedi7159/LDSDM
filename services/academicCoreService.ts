/**
 * Academic Core Service & Repository Layer
 * Subject Management, Teacher Academic Identity, Class-Subject Assignment,
 * Teacher-Subject Assignment, and DataScope Queries.
 * Works for BOTH School and Madrasah.
 */

import {
  Subject,
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  SchoolClass,
  Section,
  AcademicYear
} from '../types';
import { Student } from '../types/student';
import { DataScope } from '../types/rbac';
import {
  validateSubject,
  validateAcademicTeacher,
  validateClassSubjectAssignment,
  validateTeacherSubjectAssignment,
  validateClassTeacherAssignment
} from './subjectValidation';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * ID Generators (Always prefixed and stable)
 */
export function generateSubjectId(): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `sub_${ts}_${rnd}`;
}

export function generateTeacherId(): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `tch_${ts}_${rnd}`;
}

export function generateAssignmentId(prefix: 'csa' | 'tsa' | 'cta' = 'csa'): string {
  const ts = Date.now().toString(36);
  const rnd = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    : Math.random().toString(36).substring(2, 9);
  return `${prefix}_${ts}_${rnd}`;
}

// -------------------------------------------------------------
// SUBJECT BUILDERS & ACTIONS
// -------------------------------------------------------------

export function buildCreateSubjectPayload(
  input: Omit<Subject, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingSubjects: Subject[] = []
): { subject: Subject | null; error?: string } {
  const validation = validateSubject(input, existingSubjects);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid subject data';
    return { subject: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateSubjectId();
  const fullMarks = input.fullMarks !== undefined ? Number(input.fullMarks) : 100;
  const passMarks = input.passMarks !== undefined ? Number(input.passMarks) : 33;
  const order = input.order !== undefined && input.order !== null ? input.order : existingSubjects.length + 1;

  const subject: Subject = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    nameBn: input.nameBn ? input.nameBn.trim() : undefined,
    shortName: input.shortName ? input.shortName.trim() : undefined,
    displayName: input.displayName ? input.displayName.trim() : (input.nameBn || input.name.trim()),
    classLevel: input.classLevel || '',
    code: input.code ? input.code.trim().toUpperCase() : undefined,
    category: input.category || 'General',
    type: input.type || (input.isOptional ? 'Optional' : 'Core'),
    fullMarks,
    maxMarks: input.maxMarks || fullMarks,
    passMarks,
    isOptional: !!input.isOptional,
    isFourthSubject: !!input.isFourthSubject,
    order,
    status: input.status || 'ACTIVE',
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { subject };
}

export function buildUpdateSubjectPayload(
  existing: Subject,
  updates: Partial<Subject>,
  actor?: { uid: string; email: string },
  existingSubjects: Subject[] = []
): { subject: Subject; error?: string } {
  const merged: Subject = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateSubject(merged, existingSubjects, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid subject update';
    return { subject: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const subject: Subject = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    nameBn: merged.nameBn ? merged.nameBn.trim() : undefined,
    code: merged.code ? merged.code.trim().toUpperCase() : undefined,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { subject };
}

export function buildArchiveSubjectPayload(
  existing: Subject,
  actor?: { uid: string; email: string }
): Subject {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'INACTIVE',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

// -------------------------------------------------------------
// TEACHER BUILDERS & ACTIONS
// -------------------------------------------------------------

export function buildCreateTeacherPayload(
  input: Omit<AcademicTeacher, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingTeachers: AcademicTeacher[] = []
): { teacher: AcademicTeacher | null; error?: string } {
  const validation = validateAcademicTeacher(input, existingTeachers);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid teacher data';
    return { teacher: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateTeacherId();

  const teacher: AcademicTeacher = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    nameBn: input.nameBn ? input.nameBn.trim() : undefined,
    employeeCode: input.employeeCode ? input.employeeCode.trim().toUpperCase() : undefined,
    designation: input.designation ? input.designation.trim() : 'Assistant Teacher',
    email: input.email ? input.email.trim().toLowerCase() : undefined,
    phone: input.phone ? input.phone.trim() : undefined,
    status: input.status || 'ACTIVE',
    assignedClasses: input.assignedClasses || [],
    assignedSubjects: input.assignedSubjects || [],
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { teacher };
}

export function buildUpdateTeacherPayload(
  existing: AcademicTeacher,
  updates: Partial<AcademicTeacher>,
  actor?: { uid: string; email: string },
  existingTeachers: AcademicTeacher[] = []
): { teacher: AcademicTeacher; error?: string } {
  const merged: AcademicTeacher = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateAcademicTeacher(merged, existingTeachers, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid teacher update';
    return { teacher: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const teacher: AcademicTeacher = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    nameBn: merged.nameBn ? merged.nameBn.trim() : undefined,
    employeeCode: merged.employeeCode ? merged.employeeCode.trim().toUpperCase() : undefined,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { teacher };
}

export function buildArchiveTeacherPayload(
  existing: AcademicTeacher,
  actor?: { uid: string; email: string }
): AcademicTeacher {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'INACTIVE',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

// -------------------------------------------------------------
// CLASS-SUBJECT ASSIGNMENT BUILDERS
// -------------------------------------------------------------

export function buildCreateClassSubjectPayload(
  input: Omit<ClassSubjectAssignment, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingAssignments: ClassSubjectAssignment[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  subjects: Subject[] = [],
  academicYears: AcademicYear[] = []
): { assignment: ClassSubjectAssignment | null; error?: string } {
  const validation = validateClassSubjectAssignment(
    input,
    existingAssignments,
    classes,
    sections,
    subjects,
    academicYears
  );

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid class-subject assignment';
    return { assignment: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateAssignmentId('csa');
  const order = input.order !== undefined ? input.order : existingAssignments.length + 1;

  const assignment: ClassSubjectAssignment = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    status: input.status || 'ACTIVE',
    order,
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { assignment };
}

// -------------------------------------------------------------
// TEACHER-SUBJECT ASSIGNMENT BUILDERS
// -------------------------------------------------------------

export function buildCreateTeacherSubjectPayload(
  input: Omit<TeacherSubjectAssignment, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingAssignments: TeacherSubjectAssignment[] = [],
  teachers: AcademicTeacher[] = [],
  subjects: Subject[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = []
): { assignment: TeacherSubjectAssignment | null; error?: string } {
  const validation = validateTeacherSubjectAssignment(
    input,
    existingAssignments,
    teachers,
    subjects,
    classes,
    sections,
    academicYears
  );

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid teacher-subject assignment';
    return { assignment: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateAssignmentId('tsa');

  const assignment: TeacherSubjectAssignment = {
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

// -------------------------------------------------------------
// CLASS TEACHER ASSIGNMENT BUILDERS
// -------------------------------------------------------------

export function buildCreateClassTeacherPayload(
  input: Omit<ClassTeacherAssignment, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingAssignments: ClassTeacherAssignment[] = [],
  teachers: AcademicTeacher[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = []
): { assignment: ClassTeacherAssignment | null; error?: string } {
  const validation = validateClassTeacherAssignment(
    input,
    existingAssignments,
    teachers,
    classes,
    sections,
    academicYears
  );

  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid class-teacher assignment';
    return { assignment: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateAssignmentId('cta');

  const assignment: ClassTeacherAssignment = {
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

// -------------------------------------------------------------
// QUERY & DATASCOPE FUNCTIONS (For Exam & Marks Preparation)
// -------------------------------------------------------------

/**
 * Returns all valid active subjects for a given class & academic year
 */
export function getSubjectsForClass(
  classIdentifier: string,
  academicYearId?: string,
  assignments: ClassSubjectAssignment[] = [],
  subjects: Subject[] = []
): Subject[] {
  // Check assigned subjects via ClassSubjectAssignment first
  const relevantAssignments = assignments.filter(a => 
    (a.classId === classIdentifier || a.classId === classIdentifier) &&
    (!academicYearId || a.academicYearId === academicYearId) &&
    a.status === 'ACTIVE'
  );

  if (relevantAssignments.length > 0) {
    const subjectIds = new Set(relevantAssignments.map(a => a.subjectId));
    return subjects
      .filter(s => subjectIds.has(s.id) && s.status !== 'INACTIVE')
      .sort((a, b) => a.order - b.order);
  }

  // Fallback to legacy classLevel linkage if no explicit ClassSubjectAssignment exists
  return subjects
    .filter(s => (s.classLevel === classIdentifier || s.classLevel === classIdentifier) && s.status !== 'INACTIVE')
    .sort((a, b) => a.order - b.order);
}

/**
 * Returns valid subjects for an individual student based on their academic placement
 */
export function getSubjectsForStudent(
  student: Student,
  assignments: ClassSubjectAssignment[] = [],
  subjects: Subject[] = []
): Subject[] {
  const classId = student.classId || student.classLevel || '';
  const academicYearId = student.academicYearId || '';

  // Get base class subjects
  const classSubjects = getSubjectsForClass(classId, academicYearId, assignments, subjects);

  // If student has specific section and section-specific subjects exist, include them
  if (student.sectionId && assignments.length > 0) {
    const sectionAssignments = assignments.filter(a =>
      a.classId === classId &&
      a.sectionId === student.sectionId &&
      (!academicYearId || a.academicYearId === academicYearId) &&
      a.status === 'ACTIVE'
    );
    if (sectionAssignments.length > 0) {
      const sectionSubjectIds = new Set(sectionAssignments.map(a => a.subjectId));
      return subjects.filter(s => sectionSubjectIds.has(s.id) && s.status !== 'INACTIVE');
    }
  }

  // Filter out non-matching group subjects if applicable (e.g. Science vs General in class 9/10)
  if (student.group && (student.group as string) !== 'All') {
    return classSubjects.filter(s => !s.group || s.group === 'All' || s.group === (student.group as any));
  }

  return classSubjects;
}

/**
 * Returns all active assignments for a specific teacher
 */
export function getTeacherAssignments(
  teacherId: string,
  assignments: TeacherSubjectAssignment[] = []
): TeacherSubjectAssignment[] {
  return assignments.filter(a => a.teacherId === teacherId && a.status === 'ACTIVE');
}

/**
 * Returns all subjects taught by a teacher
 */
export function getTeacherSubjects(
  teacherId: string,
  assignments: TeacherSubjectAssignment[] = [],
  subjects: Subject[] = []
): Subject[] {
  const teacherAssignments = getTeacherAssignments(teacherId, assignments);
  const subjectIds = new Set(teacherAssignments.map(a => a.subjectId));
  return subjects.filter(s => subjectIds.has(s.id));
}

/**
 * Returns all classes taught by a teacher
 */
export function getTeacherClasses(
  teacherId: string,
  assignments: TeacherSubjectAssignment[] = [],
  classes: SchoolClass[] = []
): SchoolClass[] {
  const teacherAssignments = getTeacherAssignments(teacherId, assignments);
  const classIds = new Set(teacherAssignments.map(a => a.classId));
  return classes.filter(c => classIds.has(c.id) || classIds.has(c.name));
}

/**
 * Returns all sections taught by a teacher
 */
export function getTeacherSections(
  teacherId: string,
  assignments: TeacherSubjectAssignment[] = [],
  sections: Section[] = []
): Section[] {
  const teacherAssignments = getTeacherAssignments(teacherId, assignments);
  const sectionIds = new Set(teacherAssignments.map(a => a.sectionId).filter(Boolean));
  return sections.filter(s => sectionIds.has(s.id));
}

/**
 * Derives DataScope permissions for a teacher based on their active assignments
 */
export function deriveTeacherDataScope(
  teacherId: string,
  teacherSubjectAssignments: TeacherSubjectAssignment[] = [],
  classTeacherAssignments: ClassTeacherAssignment[] = []
): DataScope {
  const subAssignments = teacherSubjectAssignments.filter(a => a.teacherId === teacherId && a.status === 'ACTIVE');
  const classAssignments = classTeacherAssignments.filter(a => a.teacherId === teacherId && a.status === 'ACTIVE');

  const assignedClasses = new Set<string>();
  const assignedSubjects = new Set<string>();

  subAssignments.forEach(a => {
    if (a.classId) assignedClasses.add(a.classId);
    if (a.subjectId) assignedSubjects.add(a.subjectId);
  });

  classAssignments.forEach(a => {
    if (a.classId) assignedClasses.add(a.classId);
  });

  return {
    allClasses: false,
    classes: Array.from(assignedClasses),
    allSubjects: false,
    subjects: Array.from(assignedSubjects)
  };
}

// -------------------------------------------------------------
// AUDIT LOGGING HELPERS
// -------------------------------------------------------------

export async function recordSubjectAuditEvent(params: {
  action: 'SUBJECT_CREATED' | 'SUBJECT_UPDATED' | 'SUBJECT_ARCHIVED';
  subject: Subject;
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
      institutionId: params.institutionId || params.subject.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'subject',
      targetId: params.subject.id,
      targetName: params.subject.name,
      before: params.before || null,
      after: {
        id: params.subject.id,
        name: params.subject.name,
        code: params.subject.code,
        fullMarks: params.subject.fullMarks,
        passMarks: params.subject.passMarks,
        status: params.subject.status || 'ACTIVE'
      }
    });
  } catch (err) {
    console.warn('[AcademicCoreService] Audit record notice:', err);
  }
}

export async function recordClassSubjectAuditEvent(params: {
  action: 'CLASS_SUBJECT_ASSIGNED' | 'CLASS_SUBJECT_UPDATED' | 'CLASS_SUBJECT_ARCHIVED';
  assignment: ClassSubjectAssignment;
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
      targetType: 'subject_assignment',
      targetId: params.assignment.id,
      targetName: `Class ${params.assignment.classId} -> Subject ${params.assignment.subjectId}`,
      before: params.before || null,
      after: {
        id: params.assignment.id,
        classId: params.assignment.classId,
        subjectId: params.assignment.subjectId,
        academicYearId: params.assignment.academicYearId,
        status: params.assignment.status
      }
    });
  } catch (err) {
    console.warn('[AcademicCoreService] Audit record notice:', err);
  }
}

export async function recordTeacherSubjectAuditEvent(params: {
  action: 'TEACHER_SUBJECT_ASSIGNED' | 'TEACHER_SUBJECT_UPDATED' | 'TEACHER_SUBJECT_ARCHIVED';
  assignment: TeacherSubjectAssignment;
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
      targetType: 'teacher_assignment',
      targetId: params.assignment.id,
      targetName: `Teacher ${params.assignment.teacherId} -> Subject ${params.assignment.subjectId}`,
      before: params.before || null,
      after: {
        id: params.assignment.id,
        teacherId: params.assignment.teacherId,
        subjectId: params.assignment.subjectId,
        classId: params.assignment.classId,
        academicYearId: params.assignment.academicYearId,
        status: params.assignment.status
      }
    });
  } catch (err) {
    console.warn('[AcademicCoreService] Audit record notice:', err);
  }
}

export async function recordTeacherAuditEvent(params: {
  action: 'TEACHER_CREATED' | 'TEACHER_UPDATED' | 'TEACHER_ARCHIVED';
  teacher: AcademicTeacher;
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
      institutionId: params.institutionId || params.teacher.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'teacher',
      targetId: params.teacher.id,
      targetName: params.teacher.name,
      targetEmail: params.teacher.email,
      before: params.before || null,
      after: {
        id: params.teacher.id,
        name: params.teacher.name,
        designation: params.teacher.designation,
        status: params.teacher.status
      }
    });
  } catch (err) {
    console.warn('[AcademicCoreService] Audit record notice:', err);
  }
}
