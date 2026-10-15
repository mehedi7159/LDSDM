/**
 * Student Domain Service & Repository Layer
 * 
 * PHASE 2 — STUDENT MANAGEMENT FOUNDATION
 * Provides normalized business logic, filtering, immutable payload construction,
 * audit trail recording, and safe read-compatibility.
 * 
 * STRICT DIRECTIVES:
 * - NO production collection switch or dual-writing in this phase.
 * - Legacy source (`institution/main_store`) remains 100% active.
 * - Student ID is stable, canonical, and immutable.
 */

import type { Student, StudentFilterOptions, StudentLifecycleStatus } from '../types/student';
import { validateStudent } from './studentValidation';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * Future Tenant Subcollection Definition:
 * Path: institutions/{institutionId}/students/{studentId}
 * 
 * DIRECTIVE: Prepared as non-activated foundation.
 * Production reads and writes remain on existing repositories.
 */
export const TENANT_STUDENTS_SUBCOLLECTION = 'students';
export function getTenantStudentsCollectionPath(institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID): string {
  return `institutions/${institutionId}/${TENANT_STUDENTS_SUBCOLLECTION}`;
}

/**
 * Generate a cryptographically secure, stable student ID
 */
export function generateStudentId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 9);
  return `std_${ts}_${rnd}`;
}

/**
 * Normalize any student object (legacy or new) to the standard Student model.
 * Guarantees stable ID, consistent status, and backward compatibility.
 */
export function normalizeStudent(
  raw: any, 
  defaultInstitutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID
): Student {
  const isFormer = raw.isFormer === true || raw.status === 'Former' || raw.status === 'archived';
  const rawStatus = raw.status || (isFormer ? 'Former' : 'Active');

  let normalizedStatus: StudentLifecycleStatus = 'Active';
  if (rawStatus === 'Former' || rawStatus === 'archived' || isFormer) {
    normalizedStatus = 'Former';
  } else if (rawStatus === 'Inactive' || rawStatus === 'inactive') {
    normalizedStatus = 'Inactive';
  } else if (rawStatus === 'transferred') {
    normalizedStatus = 'transferred';
  } else if (rawStatus === 'graduated') {
    normalizedStatus = 'graduated';
  } else if (rawStatus === 'dropped') {
    normalizedStatus = 'dropped';
  } else {
    normalizedStatus = 'Active';
  }

  // Preserve stable ID
  const stableId = raw.id || raw.studentId || generateStudentId();

  return {
    id: String(stableId),
    institutionId: raw.institutionId || defaultInstitutionId,
    studentId: raw.studentId ? String(raw.studentId) : undefined,
    studentCode: raw.studentCode || raw.studentId || undefined,
    admissionNumber: raw.admissionNumber || undefined,
    name: String(raw.name || '').trim(),
    nameBn: raw.nameBn ? String(raw.nameBn).trim() : undefined,
    nameEn: raw.nameEn ? String(raw.nameEn).trim() : undefined,
    gender: raw.gender || undefined,
    dateOfBirth: raw.dateOfBirth || undefined,
    bloodGroup: raw.bloodGroup || undefined,
    religion: raw.religion || undefined,
    classId: raw.classId || raw.classLevel || undefined,
    classLevel: String(raw.classLevel || raw.classId || '').trim(),
    sectionId: raw.sectionId || undefined,
    roll: raw.roll ? String(raw.roll).trim() : undefined,
    rollNumber: raw.rollNumber ? String(raw.rollNumber).trim() : (raw.roll ? String(raw.roll).trim() : undefined),
    academicYearId: raw.academicYearId || undefined,
    admissionDate: raw.admissionDate || undefined,
    group: raw.group || '',
    fatherName: raw.fatherName || undefined,
    fatherNameBn: raw.fatherNameBn || undefined,
    motherName: raw.motherName || undefined,
    motherNameBn: raw.motherNameBn || undefined,
    guardianName: raw.guardianName || raw.fatherName || undefined,
    guardianPhone: raw.guardianPhone || undefined,
    guardianEmail: raw.guardianEmail || undefined,
    address: raw.address || undefined,
    photoUrl: raw.photoUrl || undefined,
    status: normalizedStatus,
    isFormer,
    leavingDate: raw.leavingDate || undefined,
    leavingReason: raw.leavingReason || undefined,
    metadata: raw.metadata || {},
    createdAt: raw.createdAt || undefined,
    createdBy: raw.createdBy || undefined,
    updatedAt: raw.updatedAt || undefined,
    updatedBy: raw.updatedBy || undefined
  };
}

/**
 * Filter and search students with multi-criteria support
 */
export function filterStudents(
  students: Student[], 
  options: StudentFilterOptions = {}
): Student[] {
  let list = students;

  // 1. Status Filter
  if (options.status && options.status !== 'all') {
    if (options.status === 'Active' || options.status === 'active') {
      list = list.filter(s => !s.isFormer && (s.status === 'Active' || s.status === 'active'));
    } else if (options.status === 'Inactive' || options.status === 'inactive') {
      list = list.filter(s => !s.isFormer && (s.status === 'Inactive' || s.status === 'inactive'));
    } else if (options.status === 'Former' || options.status === 'archived') {
      list = list.filter(s => s.isFormer || s.status === 'Former' || s.status === 'archived');
    } else {
      list = list.filter(s => s.status === options.status);
    }
  }

  // 2. Class Filter (Matches either classLevel or classId)
  if (options.classLevel && options.classLevel !== 'All') {
    list = list.filter(s => s.classLevel === options.classLevel || s.classId === options.classLevel);
  }
  if (options.classId && options.classId !== 'All') {
    list = list.filter(s => s.classId === options.classId || s.classLevel === options.classId);
  }

  // 3. Section Filter
  if (options.sectionId && options.sectionId !== 'All') {
    list = list.filter(s => s.sectionId === options.sectionId);
  }

  // 4. Academic Year Filter
  if (options.academicYearId && options.academicYearId !== 'All') {
    list = list.filter(s => s.academicYearId === options.academicYearId);
  }

  // 5. Search Term (Student name, Bengali name, studentId, roll, admission number, guardian)
  if (options.searchTerm && options.searchTerm.trim().length > 0) {
    const q = options.searchTerm.trim().toLowerCase();
    list = list.filter(s => {
      const name = (s.name || '').toLowerCase();
      const nameBn = (s.nameBn || '');
      const studentId = (s.studentId || '').toLowerCase();
      const studentCode = (s.studentCode || '').toLowerCase();
      const admissionNumber = (s.admissionNumber || '').toLowerCase();
      const roll = (s.roll || s.rollNumber || '').toLowerCase();
      const father = (s.fatherName || '').toLowerCase();
      const guardian = (s.guardianName || '').toLowerCase();
      const phone = (s.guardianPhone || '').toLowerCase();

      return (
        name.includes(q) ||
        nameBn.includes(q) ||
        studentId.includes(q) ||
        studentCode.includes(q) ||
        admissionNumber.includes(q) ||
        roll.includes(q) ||
        father.includes(q) ||
        guardian.includes(q) ||
        phone.includes(q)
      );
    });
  }

  return list;
}

/**
 * Retrieve a student by immutable ID or external studentId
 */
export function findStudentById(students: Student[], id: string): Student | undefined {
  if (!id) return undefined;
  return students.find(s => s.id === id || s.studentId === id);
}

/**
 * Construct an immutable payload for creating a new student
 */
export function buildCreateStudentPayload(
  input: Omit<Student, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string }
): { student: Student; error?: string } {
  // Validate required fields
  const validation = validateStudent(input, { isNewRegistration: true });
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid student data';
    return { student: null as any, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateStudentId();
  const isFormer = input.status === 'Former' || input.status === 'archived' || !!input.isFormer;
  const status: StudentLifecycleStatus = isFormer ? 'Former' : (input.status || 'Active');

  const student: Student = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    status,
    isFormer,
    rollNumber: input.rollNumber || input.roll,
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { student };
}

/**
 * Construct an immutable payload for updating an existing student
 * Strictly preserves the student's stable primary ID.
 */
export function buildUpdateStudentPayload(
  existing: Student,
  updates: Partial<Student>,
  actor?: { uid: string; email: string }
): { student: Student; error?: string } {
  const merged: Student = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateStudent(merged);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid update data';
    return { student: existing, error: firstErr };
  }

  const now = new Date().toISOString();
  const isFormer = merged.status === 'Former' || merged.status === 'archived' || !!merged.isFormer;

  const student: Student = {
    ...merged,
    id: existing.id,
    isFormer,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { student };
}

/**
 * Construct an immutable payload for archiving a student (without permanent deletion)
 */
export function buildArchiveStudentPayload(
  existing: Student,
  reason?: string,
  actor?: { uid: string; email: string }
): Student {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  return {
    ...existing,
    status: 'Former',
    isFormer: true,
    leavingDate: existing.leavingDate || today,
    leavingReason: reason || existing.leavingReason || 'Archived from institution active registry',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

/**
 * Record a student lifecycle action to the platform audit log
 */
export async function recordStudentAuditEvent(params: {
  action: 'STUDENT_CREATED' | 'STUDENT_UPDATED' | 'STUDENT_ARCHIVED';
  student: Student;
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
      institutionId: params.institutionId || params.student.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'student',
      targetId: params.student.id,
      targetName: params.student.name,
      before: params.before || null,
      after: {
        id: params.student.id,
        studentId: params.student.studentId,
        name: params.student.name,
        classLevel: params.student.classLevel,
        status: params.student.status
      },
      metadata: {
        roll: params.student.roll || params.student.rollNumber,
        admissionNumber: params.student.admissionNumber
      }
    });
  } catch (err) {
    console.warn('[StudentService] Audit event record warning:', err);
  }
}
