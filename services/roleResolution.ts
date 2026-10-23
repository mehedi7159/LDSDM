/**
 * Role resolution helpers — ONE place that decides which role wins when
 * several records describe the same person.
 *
 * Why this exists (the accountant→teacher mobile bug): a person can be
 * described by up to four records at once — the login account (users[]),
 * the institution-member document, the CustomRole document and one or
 * more staff (teachers[]) records. Historically each consumer picked
 * whichever record it happened to look at FIRST (array order, or the
 * member document before the account), and 'teacher' is the historical
 * default stamp, so a leftover duplicate teacher record (or a stale
 * member document) could silently shadow the person's real role and
 * route an accountant to the teacher home.
 *
 * The precedence implemented here — used by the login paths, the
 * cloud-load role heal, AppContext.hasPermission and the mobile app —
 * is:
 *   (a) the logged-in account's own stored role (after the heal below),
 *   (b) a role derived from the LINKED staff record's designation.
 * Within any set of competing records, a specific non-teacher role
 * ALWAYS beats the plain 'teacher' stamp, regardless of record order:
 * 'teacher' is the weakest signal because it was the fallback value
 * written by older code paths.
 */
import type { UserRole } from '../types';
import { deriveRoleFromDesignation, type DesignationRole } from './utils';

export const KNOWN_ROLE_KEYS: UserRole[] = [
  'super_admin',
  'principal',
  'teacher',
  'accountant',
  'staff',
  'guardian'
];

/**
 * Strength ordering for conflict resolution ONLY (not a permission
 * ranking): when two records disagree, the higher-strength role wins.
 * 'teacher' is last because it is the historical default/fallback stamp.
 */
const ROLE_STRENGTH: Record<string, number> = {
  super_admin: 60,
  principal: 50,
  accountant: 40,
  staff: 30,
  guardian: 20,
  teacher: 10
};

export const roleStrength = (role?: string | null): number =>
  ROLE_STRENGTH[role || ''] ?? 0;

/**
 * Normalize any stored role representation ('role_accountant',
 * 'accountant', 'parent', 'office_staff', …) to a canonical UserRole
 * key, or null when it does not name a known role.
 */
export function normalizeRoleKey(raw?: string | null): UserRole | null {
  if (!raw) return null;
  let k = String(raw).trim().toLowerCase();
  if (k.startsWith('role_')) k = k.slice('role_'.length);
  if (k === 'parent') k = 'guardian';
  if (k === 'office_staff') k = 'staff';
  if (k === 'institution_admin') k = 'super_admin';
  return (KNOWN_ROLE_KEYS as string[]).includes(k) ? (k as UserRole) : null;
}

/** 'accountant' → 'role_accountant' (the CustomRole/member id form). */
export const roleKeyToRoleId = (key: string): string => `role_${key}`;

/**
 * Pick the strongest role out of a set of candidates. Non-teacher beats
 * teacher; ties keep the first candidate (stable).
 */
export function strongestRoleKey(
  candidates: Array<string | null | undefined>
): UserRole | null {
  let best: UserRole | null = null;
  let bestStrength = -1;
  for (const c of candidates) {
    const key = normalizeRoleKey(c);
    if (!key) continue;
    const s = roleStrength(key);
    if (s > bestStrength) {
      best = key;
      bestStrength = s;
    }
  }
  return best;
}

/**
 * Derive a role from ALL staff records that describe one person (there
 * may be duplicates). A designation that names a non-teacher role beats
 * any number of plain teacher records, in any order.
 */
export function bestDesignationRole(
  records: Array<{ designation?: string | null } | null | undefined>
): DesignationRole {
  const derived = records
    .filter(Boolean)
    .map(r => deriveRoleFromDesignation(r!.designation));
  const best = strongestRoleKey(derived);
  return (best as DesignationRole | null) || 'teacher';
}

/**
 * When several login-account records match one person (duplicates by
 * email/phone), the authoritative one is the first NON-teacher record;
 * the teacher-stamped duplicate must never win just by sitting earlier
 * in the array. Falls back to the first match when all are teachers.
 */
export function pickAuthoritativeUser<T extends { role?: string | null }>(
  matches: T[]
): T | null {
  if (!matches || matches.length === 0) return null;
  return matches.find(m => normalizeRoleKey(m.role) !== 'teacher') || matches[0];
}

/**
 * When several staff records match one person, prefer the record whose
 * designation names a non-teacher role (e.g. the real Accountant record
 * over a leftover plain-teacher duplicate), then the strongest role.
 */
export function pickBestStaffRecord<
  T extends { designation?: string | null }
>(matches: T[]): T | null {
  if (!matches || matches.length === 0) return null;
  let best = matches[0];
  let bestStrength = roleStrength(deriveRoleFromDesignation(best.designation));
  for (const m of matches.slice(1)) {
    const s = roleStrength(deriveRoleFromDesignation(m.designation));
    if (s > bestStrength) {
      best = m;
      bestStrength = s;
    }
  }
  return best;
}

/**
 * Effective role set for a person: primary role first, then every
 * additional role, normalized and deduplicated. This is the set whose
 * permissions are unioned and whose mobile homes are offered.
 */
export function effectiveRoleKeys(
  primary: string | null | undefined,
  additionalSources: Array<Array<string | null | undefined> | null | undefined>
): UserRole[] {
  const out: UserRole[] = [];
  const push = (raw: string | null | undefined) => {
    const key = normalizeRoleKey(raw);
    if (key && !out.includes(key)) out.push(key);
  };
  push(primary);
  for (const src of additionalSources) {
    (src || []).forEach(push);
  }
  return out;
}

/**
 * Clean an additionalRoles list for storage: known roles only, no
 * 'super_admin' (never grantable as an add-on), never the primary role
 * itself, deduplicated.
 */
export function sanitizeAdditionalRoles(
  roles: Array<string | null | undefined> | null | undefined,
  primaryRole?: string | null
): UserRole[] {
  const primary = normalizeRoleKey(primaryRole);
  const out: UserRole[] = [];
  for (const r of roles || []) {
    const key = normalizeRoleKey(r);
    if (!key || key === 'super_admin' || key === primary) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Desktop home tab for a role. Non-admin roles must NOT land on the
 * principal-oriented Dashboard: each gets its primary work module.
 * Admin-tier roles (owner / super_admin / admin / principal) keep the
 * Dashboard exactly as before.
 */
export function roleHomeTab(role?: string | null): string {
  switch (normalizeRoleKey(role)) {
    case 'teacher': return 'attendance';
    case 'accountant': return 'finance';
    case 'staff': return 'students';
    case 'guardian': return 'guardian_portal';
    default: return 'dashboard';
  }
}
