/**
 * Single source of truth for staff designation → role mapping (HR audit,
 * Phase 1/3). Free-text designations used to decide roles through
 * deriveRoleFromDesignation substring matching alone, which turned
 * দপ্তরি/পিয়ন/ড্রাইভার/মুহতামিম-style titles into teachers. From now on:
 *
 * - New records pick a designation from DESIGNATION_OPTIONS (a SELECT),
 *   each mapped to ONE fixed role.
 * - "Other" requires an explicit role pick — free text alone never
 *   decides a role.
 * - Existing free-text designations keep working through
 *   deriveRoleFromDesignation ONLY as a fallback, and records that rely
 *   on it carry needsRoleVerify so an admin can fix them by hand.
 * - Approval and display NEVER derive a role from designation when a
 *   linked login account exists — the account's role wins.
 */
import { deriveRoleFromDesignation } from './utils';
import type { AppUser, UserRole } from '../types';

export interface DesignationOption {
  /** Stored designation string. */
  value: string;
  labelBn: string;
  role: UserRole;
}

export const DESIGNATION_OPTIONS: DesignationOption[] = [
  { value: 'মুয়াল্লিম (সহকারী শিক্ষক)', labelBn: 'মুয়াল্লিম (সহকারী শিক্ষক)', role: 'teacher' },
  { value: 'সহকারী শিক্ষক', labelBn: 'সহকারী শিক্ষক', role: 'teacher' },
  { value: 'অধ্যক্ষ', labelBn: 'অধ্যক্ষ', role: 'principal' },
  { value: 'হিসাবরক্ষক', labelBn: 'হিসাবরক্ষক', role: 'accountant' },
  { value: 'অফিস স্টাফ', labelBn: 'অফিস স্টাফ', role: 'staff' },
  { value: 'লাইব্রেরিয়ান', labelBn: 'লাইব্রেরিয়ান', role: 'staff' },
  { value: 'দপ্তরি', labelBn: 'দপ্তরি / সাপোর্ট স্টাফ', role: 'staff' },
  { value: 'অভিভাবক', labelBn: 'অভিভাবক', role: 'guardian' },
];

/** Select value for "other": requires an explicit role pick alongside. */
export const DESIGNATION_OTHER = '__other__';

/** Bangla labels for role chips (merged directory cards, filters). */
export const ROLE_LABEL_BN: Record<string, string> = {
  teacher: 'শিক্ষক',
  accountant: 'হিসাবরক্ষক',
  staff: 'অফিস স্টাফ',
  principal: 'অধ্যক্ষ',
  guardian: 'অভিভাবক',
  super_admin: 'সুপার অ্যাডমিন',
};

export function roleLabelBn(role?: string | null): string {
  return ROLE_LABEL_BN[role || ''] || 'স্টাফ';
}

/** Fixed-list mapping only — null for legacy free text (fallback applies). */
export function roleForDesignation(designation?: string | null): UserRole | null {
  const d = (designation || '').trim();
  if (!d) return null;
  const exact = DESIGNATION_OPTIONS.find(o => o.value === d);
  return exact ? exact.role : null;
}

export function isMappedDesignation(designation?: string | null): boolean {
  return roleForDesignation(designation) !== null;
}

export interface StaffRoleRecord {
  id?: string;
  email?: string;
  phone?: string;
  designation?: string;
  requestedRole?: string;
  roleId?: string;
  additionalRoles?: string[];
}

/** Link a staff/member record to its login account (id, then email, then phone). */
export function findLinkedUser(record: StaffRoleRecord, users: AppUser[]): AppUser | undefined {
  return users.find(u =>
    (record.id && u.id === record.id) ||
    (record.email && u.email && u.email.toLowerCase() === record.email.toLowerCase()) ||
    (record.phone && u.phone === record.phone)
  );
}

export interface ResolvedStaffRole {
  role: UserRole;
  additionalRoles: UserRole[];
  /** True when no linked account and no fixed-list mapping — derived only. */
  needsRoleVerify: boolean;
}

/**
 * ONE role-determination function for display, KPI, filters and approval.
 * Linked account role first; fixed designation mapping second;
 * deriveRoleFromDesignation ONLY as a legacy fallback (flagged).
 */
export function resolveStaffRole(record: StaffRoleRecord, users: AppUser[]): ResolvedStaffRole {
  const linked = findLinkedUser(record, users);
  if (linked) {
    return {
      role: linked.role,
      additionalRoles: (linked.additionalRoles || []) as UserRole[],
      needsRoleVerify: false,
    };
  }
  const mapped = roleForDesignation(record.designation) || roleForDesignation(record.requestedRole);
  if (mapped) {
    return {
      role: mapped,
      additionalRoles: (record.additionalRoles || []) as UserRole[],
      needsRoleVerify: false,
    };
  }
  return {
    role: deriveRoleFromDesignation(record.designation || record.requestedRole),
    additionalRoles: (record.additionalRoles || []) as UserRole[],
    needsRoleVerify: true,
  };
}

/**
 * The single approval role rule (quick-approve, Tab 2 approve, merged
 * pending-strip approve): linked account role wins; a stored roleId
 * (pending members carry theirs from signup) comes next; then the
 * fixed designation mapping; deriveRole only as a last fallback.
 */
export function resolveApprovalRoleId(record: StaffRoleRecord, users: AppUser[]): string {
  const linked = findLinkedUser(record, users);
  if (linked) return `role_${linked.role}`;
  if (record.roleId && record.roleId.startsWith('role_')) return record.roleId;
  const mapped = roleForDesignation(record.designation) || roleForDesignation(record.requestedRole);
  if (mapped) return `role_${mapped}`;
  return `role_${deriveRoleFromDesignation(record.designation || record.requestedRole)}`;
}

/**
 * Sign-in gate rule (Phase 1): only 'active' accounts may log in.
 * Used by BOTH sign-in paths (member path and user-record path) so
 * the messages can never drift apart. Returns blocked:false for
 * active (or unknown) statuses — unknown means "no evidence of
 * pending", which must not lock out legacy accounts.
 */
export function signInGateForStatus(status?: string | null): { blocked: boolean; message?: string } {
  if (!status || status === 'active') return { blocked: false };
  return {
    blocked: true,
    message: status === 'pending'
      ? 'আপনার অ্যাকাউন্ট এখনো অনুমোদনের অপেক্ষায় আছে। অ্যাডমিন অনুমোদন করলে লগইন করতে পারবেন।'
      : 'আপনার অ্যাকাউন্টটি সক্রিয় নয়। অফিসে যোগাযোগ করুন।'
  };
}
