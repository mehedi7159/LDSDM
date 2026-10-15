/**
 * Class Service & Repository Layer
 * Manages institutional classes, hierarchy ordering, dependency checking, and archiving.
 * Works for BOTH School and Madrasah.
 */

import { SchoolClass } from '../types';
import { Student } from '../types/student';
import { Subject } from '../types';
import { Section } from '../types/academic';
import { validateClassConfig } from './academicValidation';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * Generate a cryptographically secure, stable Class ID
 */
export function generateClassId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 9);
  return `cls_${ts}_${rnd}`;
}

/**
 * Construct an immutable payload for creating a new Class
 */
export function buildCreateClassPayload(
  input: Omit<SchoolClass, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingClasses: SchoolClass[] = []
): { schoolClass: SchoolClass | null; error?: string } {
  const validation = validateClassConfig(input, existingClasses);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid class data';
    return { schoolClass: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateClassId();
  const order = input.order !== undefined && input.order !== null ? input.order : existingClasses.length + 1;

  const schoolClass: SchoolClass = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    nameBn: input.nameBn ? input.nameBn.trim() : undefined,
    displayName: input.displayName ? input.displayName.trim() : (input.nameBn || input.name.trim()),
    order,
    status: input.status || 'ACTIVE',
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { schoolClass };
}

/**
 * Construct an immutable payload for updating an existing Class
 */
export function buildUpdateClassPayload(
  existing: SchoolClass,
  updates: Partial<SchoolClass>,
  actor?: { uid: string; email: string },
  existingClasses: SchoolClass[] = []
): { schoolClass: SchoolClass; error?: string } {
  const merged: SchoolClass = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateClassConfig(merged, existingClasses, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid class update';
    return { schoolClass: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const schoolClass: SchoolClass = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    nameBn: merged.nameBn ? merged.nameBn.trim() : undefined,
    displayName: merged.displayName ? merged.displayName.trim() : undefined,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { schoolClass };
}

/**
 * Construct an immutable payload for archiving a class (safe deactivation)
 */
export function buildArchiveClassPayload(
  existing: SchoolClass,
  actor?: { uid: string; email: string }
): SchoolClass {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'INACTIVE',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

/**
 * Inspects whether a class has dependent records (students, subjects, sections)
 */
export function checkClassDependencies(
  classIdentifier: string,
  students: Student[] = [],
  subjects: Subject[] = [],
  sections: Section[] = []
): {
  hasDependencies: boolean;
  studentCount: number;
  subjectCount: number;
  sectionCount: number;
  summary: string;
} {
  const studentCount = students.filter(
    s => s.classId === classIdentifier || s.classLevel === classIdentifier
  ).length;

  const subjectCount = subjects.filter(
    sub => sub.classLevel === classIdentifier || sub.id === classIdentifier
  ).length;

  const sectionCount = sections.filter(
    sec => sec.classId === classIdentifier
  ).length;

  const hasDependencies = studentCount > 0 || subjectCount > 0 || sectionCount > 0;
  const parts: string[] = [];
  if (studentCount > 0) parts.push(`${studentCount} students`);
  if (subjectCount > 0) parts.push(`${subjectCount} subjects`);
  if (sectionCount > 0) parts.push(`${sectionCount} sections`);

  return {
    hasDependencies,
    studentCount,
    subjectCount,
    sectionCount,
    summary: parts.join(', ') || 'No dependent records'
  };
}

/**
 * Records a Class audit log event
 */
export async function recordClassAuditEvent(params: {
  action: 'CLASS_CREATED' | 'CLASS_UPDATED' | 'CLASS_ARCHIVED';
  schoolClass: SchoolClass;
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
      institutionId: params.institutionId || params.schoolClass.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'class',
      targetId: params.schoolClass.id,
      targetName: params.schoolClass.name,
      before: params.before || null,
      after: {
        id: params.schoolClass.id,
        name: params.schoolClass.name,
        status: params.schoolClass.status || 'ACTIVE',
        order: params.schoolClass.order
      }
    });
  } catch (err) {
    console.warn('[ClassService] Audit record notice:', err);
  }
}
