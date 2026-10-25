/**
 * Staff mobile self-service helpers (Step 4, 25 Oct 2026). Pure functions —
 * no Firestore, no React — so the verify script can prove them directly.
 *
 * Design rules enforced here (not in the UI, so no screen can bypass them):
 * - A staff-submitted leave request is ALWAYS PENDING. The caller cannot
 *   choose a status: admin-entered leaves are APPROVED by the admin's own
 *   action, staff requests go through PENDING → APPROVED/REJECTED.
 * - Only a PENDING row may transition. APPROVED/REJECTED rows are final.
 * - Reports count APPROVED leaves overlapping the day (the MadrasaReports
 *   filter, mirrored here so the script proves the same rule).
 * - Mobile profile edit allows ONLY display fields. Email, phone and
 *   password feed login identity, provisioning and record matching;
 *   designation feeds role derivation; assigned classes/subjects feed
 *   access scoping; status and roles are admin-only. All of those are
 *   refused by construction in sanitizeProfileEdit.
 * - Staff self-attendance is NOT built here (admin-only, user's decision).
 */
import type { StaffLeaveRecord } from '../types';
import type { AcademicTeacher } from '../types/academic';

export type StaffLeaveType = StaffLeaveRecord['leaveType'];

export const STAFF_LEAVE_TYPE_OPTIONS: { value: StaffLeaveType; labelBn: string; labelEn: string }[] = [
  { value: 'CASUAL', labelBn: 'নৈমিত্তিক ছুটি', labelEn: 'Casual Leave' },
  { value: 'SICK', labelBn: 'অসুস্থতাজনিত ছুটি', labelEn: 'Sick Leave' },
  { value: 'HAJJ_UMRAH', labelBn: 'হজ্ব/ওমরাহ ছুটি', labelEn: 'Hajj/Umrah Leave' },
  { value: 'SPECIAL', labelBn: 'বিশেষ ছুটি', labelEn: 'Special Leave' },
  { value: 'MATERNITY', labelBn: 'মাতৃত্বকালীন ছুটি', labelEn: 'Maternity Leave' },
];

/** Inclusive day count (same-day = 1). Returns 0 for an invalid or reversed range. */
export function computeLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export interface LeaveRequestInput {
  teacherId: string;
  teacherName: string;
  designation: string;
  leaveType: StaffLeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Builds a staff-submitted leave request. Status is hard-coded PENDING —
 * there is no status input, so no caller can file a pre-approved request.
 */
export function buildStaffLeaveRequest(input: LeaveRequestInput, id: string): StaffLeaveRecord {
  return {
    id,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    designation: input.designation,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    daysCount: computeLeaveDays(input.startDate, input.endDate),
    reason: input.reason,
    status: 'PENDING',
    appliedAt: new Date().toISOString(),
  };
}

/**
 * Applies an admin decision. Only a PENDING row transitions; APPROVED and
 * REJECTED rows (and unknown ids) are returned untouched. `decidedBy` is
 * recorded on the row so the leave tab shows who decided.
 */
export function decideStaffLeave(
  leaves: StaffLeaveRecord[],
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  decidedBy: string
): StaffLeaveRecord[] {
  return leaves.map((l) =>
    l.id === id && l.status === 'PENDING' ? { ...l, status: decision, approvedBy: decidedBy } : l
  );
}

/** Counts APPROVED leaves overlapping the given ISO day (reports rule). */
export function countApprovedLeavesOn(leaves: StaffLeaveRecord[], dateIso: string): number {
  return leaves.filter(
    (l) => l.status === 'APPROVED' && l.startDate <= dateIso && l.endDate >= dateIso
  ).length;
}

/**
 * The ONLY fields a staff member may edit about themselves on mobile.
 * Everything else (email, phone, password, designation, assigned classes /
 * subjects, status, roles, id, userId) is admin-only and is refused here
 * by construction — it is not copied from the patch at all.
 */
export const EDITABLE_PROFILE_FIELDS = ['name', 'nameBn', 'employeeCode'] as const;

export interface EditableProfilePatch {
  name?: string;
  nameBn?: string;
  employeeCode?: string;
}

/** Applies only the allowlisted fields; an empty name keeps the old name. */
export function sanitizeProfileEdit(
  record: AcademicTeacher,
  patch: EditableProfilePatch
): AcademicTeacher {
  const name = (patch.name ?? '').trim();
  return {
    ...record,
    name: name ? name : record.name,
    nameBn: (patch.nameBn ?? '').trim() || record.nameBn,
    employeeCode: (patch.employeeCode ?? '').trim() || record.employeeCode,
  };
}
