/**
 * Phase 6 (RBAC Option A) — permission-equivalence proof.
 *
 * The Phase 6 change flipped the precedence inside AppContext.hasPermission:
 *   BEFORE: owner/super-admin short-circuit → hardcoded per-role branches →
 *           checkPermission() (CustomRole layer) as fallback.
 *   AFTER:  owner/super-admin short-circuit → principal veto (the one DENY
 *           in the old branch layer) → checkPermission() FIRST → hardcoded
 *           per-role branches as fallback.
 * At the same time the role templates in services/rbac.ts were aligned to
 * the hardcoded branches and stored roles are merged with their template on
 * load (union — additions only). For the flip to be safe, EVERY
 * role × permission × member-state × scope combination must answer
 * identically before and after.
 *
 * This script proves it empirically:
 *  - hasPermissionOld / hasPermissionNew below are faithful replicas of the
 *    pre- and post-change AppContext logic (the branch bodies are verbatim).
 *  - Both use the REAL checkPermission / buildAuthorizationContext /
 *    isVerifiedSuperAdmin from services/authorization.ts.
 *  - OLD runs against role documents seeded from the PRE-change templates
 *    (embedded verbatim below as OLD_TEMPLATES); NEW runs against the same
 *    stored documents after the REAL mergeRolePermissionsWithTemplate()
 *    has applied the REAL (aligned) DEFAULT_ROLE_TEMPLATES imported from
 *    services/rbac.ts.
 *
 * Run: npx tsx scripts/test-rbac-equivalence.ts
 * Exit code 0 = full equivalence over the tested matrix.
 */
import {
  checkPermission,
  buildAuthorizationContext,
  isVerifiedSuperAdmin
} from '../services/authorization';
import {
  DEFAULT_ROLE_TEMPLATES,
  mergeRolePermissionsWithTemplate
} from '../services/rbac';
import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import type { CustomRole, InstitutionMember, Permission } from '../types/rbac';

const INSTITUTION_ID = 'inst_madrasah_primary';

// ---------------------------------------------------------------------------
// Pre-change templates, verbatim from services/rbac.ts @ 3646b0b (Phase 5).
// ---------------------------------------------------------------------------
const OLD_TEMPLATES: Record<string, { name: string; permissions: string[]; dataScopes: any }> = {
  institution_admin: {
    name: 'institution_admin',
    permissions: ['*'],
    dataScopes: { allClasses: true, allSubjects: true }
  },
  principal: {
    name: 'principal',
    permissions: [
      'students.view', 'students.edit', 'teachers.view', 'classes.view',
      'subjects.view', 'attendance.view', 'exams.view', 'marks.view',
      'results.view', 'results.print', 'fees.view', 'finance.view',
      'reports.view', 'reports.print', 'institution.settings.view'
    ],
    dataScopes: { allClasses: true, allSubjects: true }
  },
  teacher: {
    name: 'teacher',
    permissions: [
      'students.view', 'classes.view', 'subjects.view',
      'attendance.view', 'attendance.create', 'attendance.edit',
      'exams.view', 'marks.view', 'marks.create', 'marks.edit', 'results.view'
    ],
    dataScopes: { allClasses: false, classes: [], allSubjects: false, subjects: [] }
  },
  accountant: {
    name: 'accountant',
    permissions: [
      'students.view', 'fees.view', 'fees.create', 'fees.edit',
      'payments.view', 'payments.create', 'payments.edit',
      'finance.view', 'finance.create', 'finance.edit',
      'reports.view', 'reports.print'
    ],
    dataScopes: { allClasses: true }
  },
  office_staff: {
    name: 'office_staff',
    permissions: [
      'students.view', 'students.create', 'students.edit', 'classes.view',
      'attendance.view', 'results.view', 'results.print', 'reports.view'
    ],
    dataScopes: { allClasses: true }
  },
  librarian: {
    name: 'librarian',
    permissions: ['students.view', 'reports.view'],
    dataScopes: { allClasses: true }
  }
};

function seededRoleDoc(templateKey: string, extraPermissions: string[] = []): CustomRole {
  const t = OLD_TEMPLATES[templateKey];
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: `role_${templateKey}`,
    institutionId: INSTITUTION_ID,
    name: t.name,
    displayName: t.name,
    permissions: [...t.permissions, ...extraPermissions],
    dataScopes: t.dataScopes,
    isSystemRole: templateKey === 'institution_admin',
    isActive: true,
    createdAt: now,
    createdBy: 'script',
    updatedAt: now,
    updatedBy: 'script'
  };
}

// ---------------------------------------------------------------------------
// Scenario input shared by both replicas.
// ---------------------------------------------------------------------------
interface Scenario {
  email: string;
  claims: Record<string, any> | null;
  isAdminFlag: boolean;
  currentUserRole?: string;
  memberRoleId?: string;
  userRoleFallback?: string;
  member: InstitutionMember | null;
  storedRole: CustomRole | null; // role document as resolved by the app
}

function makeAuthUser(email: string): any {
  return { uid: 'uid_scenario', email };
}

function hardcodedBranches(
  effectiveRole: string | undefined,
  permission: Permission
): boolean | undefined {
  // Verbatim grant bodies of the canonical hardcoded branches.
  // Returns true when a branch grants, undefined when no branch grants.
  // (The principal branch's grant-all is handled by the callers because of
  // its embedded veto.)
  if (effectiveRole === 'accountant') {
    if (permission.startsWith('finance.') || permission.startsWith('fees.') || permission.startsWith('payments.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (effectiveRole === 'teacher') {
    if (permission.startsWith('attendance.') || permission.startsWith('marks.') || permission.startsWith('subjects.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (effectiveRole === 'guardian' || effectiveRole === 'parent') {
    if (permission === 'students.view' || permission === 'marks.view' || permission === 'attendance.view' || permission === 'fees.view') return true;
  }
  return undefined;
}

function hasPermissionOld(
  s: Scenario,
  permission: Permission,
  scope?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  const authUser = makeAuthUser(s.email);
  const isSuperAdmin = isVerifiedSuperAdmin(authUser, s.claims);
  const isOwner = (s.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isSuperAdmin || isOwner || s.isAdminFlag || s.currentUserRole === 'super_admin') {
    return true;
  }

  const effectiveRole = s.currentUserRole || s.memberRoleId?.replace('role_', '') || s.userRoleFallback;

  if (effectiveRole === 'principal') {
    if (permission === 'system.backup' || permission === 'system.audit') return false;
    return true;
  }

  const granted = hardcodedBranches(effectiveRole, permission);
  if (granted) return true;

  const authContext = buildAuthorizationContext(authUser, s.claims, s.member, s.storedRole, INSTITUTION_ID);
  return checkPermission(authContext, permission, scope);
}

function hasPermissionNew(
  s: Scenario,
  permission: Permission,
  scope?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  const authUser = makeAuthUser(s.email);
  const isSuperAdmin = isVerifiedSuperAdmin(authUser, s.claims);
  const isOwner = (s.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isSuperAdmin || isOwner || s.isAdminFlag || s.currentUserRole === 'super_admin') {
    return true;
  }

  const effectiveRole = s.currentUserRole || s.memberRoleId?.replace('role_', '') || s.userRoleFallback;

  // Principal veto first (the one DENY), exactly as in the new AppContext code.
  if (effectiveRole === 'principal' && (permission === 'system.backup' || permission === 'system.audit')) {
    return false;
  }

  // CustomRole layer first — against the stored role AFTER the load-time
  // template merge that the new getInstitutionRoles performs.
  const mergedRole = s.storedRole ? mergeRolePermissionsWithTemplate(s.storedRole) : null;
  const authContext = buildAuthorizationContext(authUser, s.claims, s.member, mergedRole, INSTITUTION_ID);
  if (checkPermission(authContext, permission, scope)) {
    return true;
  }

  if (effectiveRole === 'principal') {
    return true;
  }

  const granted = hardcodedBranches(effectiveRole, permission);
  if (granted) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Permission universe: every StandardPermission in types/rbac.ts, plus the
// strings the UI actually passes, prefix probes, vetoed keys and an unknown
// key (principal must grant it; everyone else must not).
// ---------------------------------------------------------------------------
const PERMISSIONS: string[] = [
  'academicYears.view', 'academicYears.create', 'academicYears.edit', 'academicYears.archive',
  'classes.view', 'classes.create', 'classes.edit', 'classes.delete', 'classes.archive',
  'sections.view', 'sections.create', 'sections.edit', 'sections.archive',
  'students.view', 'students.create', 'students.edit', 'students.delete', 'students.archive',
  'students.print', 'students.export',
  'teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete',
  'subjects.view', 'subjects.create', 'subjects.edit', 'subjects.delete', 'subjects.archive',
  'subjects.export', 'subjects.print',
  'subjectAssignments.view', 'subjectAssignments.create', 'subjectAssignments.edit', 'subjectAssignments.archive',
  'teacherAssignments.view', 'teacherAssignments.create', 'teacherAssignments.edit', 'teacherAssignments.archive',
  'classTeacherAssignments.view', 'classTeacherAssignments.create', 'classTeacherAssignments.edit', 'classTeacherAssignments.archive',
  'attendance.view', 'attendance.create', 'attendance.edit', 'attendance.delete',
  'exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.archive', 'exams.finalize',
  'examSubjects.view', 'examSubjects.create', 'examSubjects.edit', 'examSubjects.archive',
  'marks.view', 'marks.create', 'marks.edit', 'marks.submit', 'marks.correct', 'marks.finalize',
  'marks.delete', 'marks.export', 'marks.print',
  'grading.view', 'grading.edit',
  'results.view', 'results.print',
  'fees.view', 'fees.create', 'fees.edit', 'fees.delete',
  'payments.view', 'payments.create', 'payments.edit', 'payments.delete',
  'finance.view', 'finance.create', 'finance.edit', 'finance.delete', 'finance.collect_fee',
  'reports.view', 'reports.print', 'reports.export',
  'users.view', 'users.invite', 'users.edit', 'users.disable', 'users.delete',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  'institution.settings.view', 'institution.settings.edit',
  'academic.view',
  'system.backup', 'system.audit',
  'whatever.unknown'
];

const SCOPES: Array<{ classId?: string; subjectId?: string; studentId?: string } | undefined> = [
  undefined,
  { classId: 'cls_1' },
  { classId: 'cls_2' },
  { subjectId: 'sub_1' },
  { classId: 'cls_1', subjectId: 'sub_1' }
];

function makeMember(roleId: string, status: InstitutionMember['status'], assignedClasses: string[] = []): InstitutionMember {
  return {
    uid: 'uid_scenario',
    institutionId: INSTITUTION_ID,
    email: 'someone@example.com',
    roleId,
    status,
    assignedClasses,
    assignedSubjects: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

// users[].role → the stored role document the app would have resolved
// (seeded from the PRE-change templates; guardian/parent had no document).
const ROLE_TO_TEMPLATE: Record<string, string | null> = {
  principal: 'principal',
  accountant: 'accountant',
  teacher: 'teacher',
  office_staff: 'office_staff',
  librarian: 'librarian',
  institution_admin: 'institution_admin',
  staff: 'office_staff', // roleAliases in AppContext: staff → office_staff
  guardian: null,        // no guardian role doc existed before this phase
  parent: null,          // alias guardian — likewise no document
  super_admin: 'institution_admin'
};

function buildScenarios(): Array<{ label: string; scenario: Scenario }> {
  const out: Array<{ label: string; scenario: Scenario }> = [];
  const roles = Object.keys(ROLE_TO_TEMPLATE);

  for (const role of roles) {
    const templateKey = ROLE_TO_TEMPLATE[role];
    const roleId = templateKey ? `role_${templateKey}` : 'role_teacher';
    const memberVariants: Array<{ name: string; member: InstitutionMember | null }> = [
      { name: 'no-member', member: null },
      { name: 'member-active', member: makeMember(roleId, 'active') },
      { name: 'member-active-assigned-cls2', member: makeMember(roleId, 'active', ['cls_2']) },
      { name: 'member-inactive', member: makeMember(roleId, 'inactive') },
      { name: 'member-suspended', member: makeMember(roleId, 'suspended') }
    ];
    for (const mv of memberVariants) {
      out.push({
        label: `role=${role} stored=seeded ${mv.name}`,
        scenario: {
          email: 'someone@example.com',
          claims: null,
          isAdminFlag: false,
          currentUserRole: role,
          memberRoleId: mv.member?.roleId,
          member: mv.member,
          storedRole: templateKey ? seededRoleDoc(templateKey) : null
        }
      });
      out.push({
        label: `role=${role} stored=none ${mv.name}`,
        scenario: {
          email: 'someone@example.com',
          claims: null,
          isAdminFlag: false,
          currentUserRole: role,
          memberRoleId: mv.member?.roleId,
          member: mv.member,
          storedRole: null
        }
      });
    }
    // Stored role carrying admin-added custom grants (merge must preserve).
    if (templateKey) {
      out.push({
        label: `role=${role} stored=seeded+custom-grants member-active`,
        scenario: {
          email: 'someone@example.com',
          claims: null,
          isAdminFlag: false,
          currentUserRole: role,
          memberRoleId: roleId,
          member: makeMember(roleId, 'active'),
          storedRole: seededRoleDoc(templateKey, ['users.view', 'exams.create'])
        }
      });
    }
  }

  // effectiveRole derived ONLY from the member record (no users[].role).
  for (const templateKey of ['teacher', 'accountant', 'principal', 'office_staff']) {
    out.push({
      label: `member-only roleId=role_${templateKey} member-active`,
      scenario: {
        email: 'someone@example.com',
        claims: null,
        isAdminFlag: false,
        currentUserRole: undefined,
        memberRoleId: `role_${templateKey}`,
        member: makeMember(`role_${templateKey}`, 'active'),
        storedRole: seededRoleDoc(templateKey)
      }
    });
  }

  // effectiveRole derived ONLY from the userRole fallback.
  out.push({
    label: 'fallback-only userRole=teacher stored=none no-member',
    scenario: {
      email: 'someone@example.com',
      claims: null,
      isAdminFlag: false,
      currentUserRole: undefined,
      memberRoleId: undefined,
      userRoleFallback: 'teacher',
      member: null,
      storedRole: null
    }
  });

  // No role at all.
  out.push({
    label: 'no-role stored=none no-member',
    scenario: {
      email: 'someone@example.com',
      claims: null,
      isAdminFlag: false,
      currentUserRole: undefined,
      memberRoleId: undefined,
      member: null,
      storedRole: null
    }
  });

  // Owner / verified super admin / isAdmin flag short-circuits.
  for (const role of roles) {
    const templateKey = ROLE_TO_TEMPLATE[role];
    out.push({
      label: `owner-email role=${role}`,
      scenario: {
        email: SUPER_ADMIN_EMAIL,
        claims: { role: 'admin' },
        isAdminFlag: false,
        currentUserRole: role,
        memberRoleId: templateKey ? `role_${templateKey}` : undefined,
        member: templateKey ? makeMember(`role_${templateKey}`, 'active') : null,
        storedRole: templateKey ? seededRoleDoc(templateKey) : null
      }
    });
    out.push({
      label: `isAdmin-flag role=${role}`,
      scenario: {
        email: 'someone@example.com',
        claims: null,
        isAdminFlag: true,
        currentUserRole: role,
        memberRoleId: templateKey ? `role_${templateKey}` : undefined,
        member: templateKey ? makeMember(`role_${templateKey}`, 'active') : null,
        storedRole: templateKey ? seededRoleDoc(templateKey) : null
      }
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Run the matrix.
// ---------------------------------------------------------------------------
function main() {
  // Sanity: the NEW templates imported from the repo must be the aligned ones.
  const teacherTemplate = DEFAULT_ROLE_TEMPLATES.find(t => t.templateKey === 'teacher');
  if (!teacherTemplate?.permissions.includes('reports.view')) {
    console.error('FATAL: aligned teacher template not found (reports.view missing).');
    process.exit(2);
  }

  const scenarios = buildScenarios();
  let total = 0;
  let mismatches = 0;
  const mismatchSamples: string[] = [];

  for (const { label, scenario } of scenarios) {
    for (const permission of PERMISSIONS) {
      for (const scope of SCOPES) {
        total++;
        const before = hasPermissionOld(scenario, permission as Permission, scope);
        const after = hasPermissionNew(scenario, permission as Permission, scope);
        if (before !== after) {
          mismatches++;
          if (mismatchSamples.length < 25) {
            mismatchSamples.push(
              `${label} | ${permission} | scope=${JSON.stringify(scope)} | old=${before} new=${after}`
            );
          }
        }
      }
    }
  }

  console.log('================================================================');
  console.log('RBAC Phase 6 — permission equivalence (OLD vs NEW hasPermission)');
  console.log('================================================================');
  console.log(`Scenarios:            ${scenarios.length}`);
  console.log(`Permissions tested:   ${PERMISSIONS.length}`);
  console.log(`Scope variants:       ${SCOPES.length}`);
  console.log(`Total combinations:   ${total}`);
  console.log(`Mismatches:           ${mismatches}`);
  if (mismatchSamples.length > 0) {
    console.log('--- first mismatches ---');
    mismatchSamples.forEach(m => console.log('  MISMATCH: ' + m));
  }
  console.log(mismatches === 0
    ? 'RESULT: EQUIVALENT — the precedence flip changes no outcome.'
    : 'RESULT: NOT EQUIVALENT — see mismatches above.');
  process.exit(mismatches === 0 ? 0 : 1);
}

main();
