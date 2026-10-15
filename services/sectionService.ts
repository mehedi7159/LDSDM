/**
 * Section Service & Repository Layer
 * Manages class sections, capacities, dependencies, and archiving.
 * Works for BOTH School and Madrasah.
 */

import { Section, SchoolClass } from '../types';
import { Student } from '../types/student';
import { validateSectionConfig } from './academicValidation';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * Generate a cryptographically secure, stable Section ID
 */
export function generateSectionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 9);
  return `sec_${ts}_${rnd}`;
}

/**
 * Construct an immutable payload for creating a new Section
 */
export function buildCreateSectionPayload(
  input: Omit<Section, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingSections: Section[] = [],
  existingClasses: SchoolClass[] = []
): { section: Section | null; error?: string } {
  const validation = validateSectionConfig(input, existingSections, existingClasses);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid section data';
    return { section: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateSectionId();

  const section: Section = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    displayName: input.displayName ? input.displayName.trim() : input.name.trim(),
    capacity: input.capacity !== undefined ? input.capacity : undefined,
    status: input.status || 'ACTIVE',
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { section };
}

/**
 * Construct an immutable payload for updating an existing Section
 */
export function buildUpdateSectionPayload(
  existing: Section,
  updates: Partial<Section>,
  actor?: { uid: string; email: string },
  existingSections: Section[] = [],
  existingClasses: SchoolClass[] = []
): { section: Section; error?: string } {
  const merged: Section = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateSectionConfig(merged, existingSections, existingClasses, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid section update';
    return { section: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const section: Section = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    displayName: merged.displayName ? merged.displayName.trim() : undefined,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { section };
}

/**
 * Construct an immutable payload for archiving a section (safe deactivation)
 */
export function buildArchiveSectionPayload(
  existing: Section,
  actor?: { uid: string; email: string }
): Section {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'INACTIVE',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

/**
 * Inspects whether a section has dependent enrolled students
 */
export function checkSectionDependencies(
  sectionId: string,
  students: Student[] = []
): {
  hasDependencies: boolean;
  studentCount: number;
  summary: string;
} {
  const studentCount = students.filter(s => s.sectionId === sectionId).length;
  return {
    hasDependencies: studentCount > 0,
    studentCount,
    summary: studentCount > 0 ? `${studentCount} students enrolled` : 'No enrolled students'
  };
}

/**
 * Records a Section audit log event
 */
export async function recordSectionAuditEvent(params: {
  action: 'SECTION_CREATED' | 'SECTION_UPDATED' | 'SECTION_ARCHIVED';
  section: Section;
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
      institutionId: params.institutionId || params.section.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'section',
      targetId: params.section.id,
      targetName: params.section.name,
      before: params.before || null,
      after: {
        id: params.section.id,
        name: params.section.name,
        classId: params.section.classId,
        status: params.section.status
      }
    });
  } catch (err) {
    console.warn('[SectionService] Audit record notice:', err);
  }
}
