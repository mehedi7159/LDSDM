/**
 * Academic Year Service & Repository Layer
 * Manages institutional academic cycles, current year resolution, closing and auditing.
 * Works for BOTH School and Madrasah.
 */

import { AcademicYear, AcademicYearStatus } from '../types';
import { validateAcademicYear } from './academicValidation';
import { logAuditEvent } from './auditLog';

export const CANONICAL_PRIMARY_INSTITUTION_ID = 'inst_madrasah_primary';

/**
 * Generate a cryptographically secure, stable Academic Year ID
 */
export function generateAcademicYearId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 9);
  return `ay_${ts}_${rnd}`;
}

/**
 * Construct an immutable payload for creating a new Academic Year
 */
export function buildCreateAcademicYearPayload(
  input: Omit<AcademicYear, 'id'>,
  institutionId: string = CANONICAL_PRIMARY_INSTITUTION_ID,
  actor?: { uid: string; email: string },
  existingYears: AcademicYear[] = []
): { academicYear: AcademicYear | null; error?: string } {
  const validation = validateAcademicYear(input, existingYears);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid academic year data';
    return { academicYear: null, error: firstErr };
  }

  const now = new Date().toISOString();
  const stableId = generateAcademicYearId();
  const isFirst = existingYears.length === 0;
  const isCurrent = input.isCurrent ?? isFirst;
  const status: AcademicYearStatus = input.status || (isCurrent ? 'ACTIVE' : 'UPCOMING');

  const academicYear: AcademicYear = {
    ...input,
    id: stableId,
    institutionId: input.institutionId || institutionId,
    name: input.name.trim(),
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    status,
    isCurrent,
    createdAt: now,
    createdBy: actor?.uid || 'system',
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { academicYear };
}

/**
 * Construct an immutable payload for updating an existing Academic Year
 */
export function buildUpdateAcademicYearPayload(
  existing: AcademicYear,
  updates: Partial<AcademicYear>,
  actor?: { uid: string; email: string },
  existingYears: AcademicYear[] = []
): { academicYear: AcademicYear; error?: string } {
  const merged: AcademicYear = {
    ...existing,
    ...updates,
    id: existing.id // ID IMMUTABILITY GUARANTEE
  };

  const validation = validateAcademicYear(merged, existingYears, existing.id);
  if (!validation.isValid) {
    const firstErr = Object.values(validation.errors)[0] || 'Invalid academic year update';
    return { academicYear: existing, error: firstErr };
  }

  const now = new Date().toISOString();

  const academicYear: AcademicYear = {
    ...merged,
    id: existing.id,
    name: merged.name.trim(),
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };

  return { academicYear };
}

/**
 * Sets a specific academic year as the CURRENT active year
 * Guarantees that only ONE academic year is current at any time.
 */
export function setCurrentAcademicYear(
  years: AcademicYear[],
  targetId: string,
  actor?: { uid: string; email: string }
): { updatedYears: AcademicYear[]; targetYear: AcademicYear | null } {
  const now = new Date().toISOString();
  let targetYear: AcademicYear | null = null;

  const updatedYears = years.map(year => {
    if (year.id === targetId) {
      targetYear = {
        ...year,
        isCurrent: true,
        status: year.status === 'CLOSED' ? 'ACTIVE' : year.status,
        updatedAt: now,
        updatedBy: actor?.uid || 'system'
      };
      return targetYear;
    }
    return {
      ...year,
      isCurrent: false,
      updatedAt: year.isCurrent ? now : year.updatedAt,
      updatedBy: year.isCurrent ? (actor?.uid || 'system') : year.updatedBy
    };
  });

  return { updatedYears, targetYear };
}

/**
 * Closes an academic year safely without destroying historical records
 */
export function closeAcademicYear(
  existing: AcademicYear,
  actor?: { uid: string; email: string }
): AcademicYear {
  const now = new Date().toISOString();
  return {
    ...existing,
    status: 'CLOSED',
    isCurrent: false,
    updatedAt: now,
    updatedBy: actor?.uid || 'system'
  };
}

/**
 * Records an Academic Year audit log event
 */
export async function recordAcademicYearAuditEvent(params: {
  action: 'ACADEMIC_YEAR_CREATED' | 'ACADEMIC_YEAR_UPDATED' | 'ACADEMIC_YEAR_ACTIVATED' | 'ACADEMIC_YEAR_CLOSED';
  academicYear: AcademicYear;
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
      institutionId: params.institutionId || params.academicYear.institutionId || CANONICAL_PRIMARY_INSTITUTION_ID,
      targetType: 'academic_year',
      targetId: params.academicYear.id,
      targetName: params.academicYear.name,
      before: params.before || null,
      after: {
        id: params.academicYear.id,
        name: params.academicYear.name,
        status: params.academicYear.status,
        isCurrent: params.academicYear.isCurrent
      }
    });
  } catch (err) {
    console.warn('[AcademicYearService] Audit record notice:', err);
  }
}
