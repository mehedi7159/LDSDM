/**
 * Multi-role support — verification for the union permission logic and
 * the duplicate-safe role resolution (services/roleResolution.ts).
 *
 * What this proves:
 *  1. SINGLE-ROLE UNCHANGED: the new AppContext.hasPermission (union
 *     over effectiveRoles, CustomRole layer built from all role docs)
 *     answers IDENTICALLY to the Phase-6 single-role implementation
 *     (the `hasPermissionNew` of scripts/test-rbac-equivalence.ts)
 *     for every role × permission × scope × member-state combination,
 *     when the person holds exactly one role.
 *  2. UNION GRANTS: an accountant+teacher (in either primary order)
 *     is granted BOTH roles' permissions (fees./finance./payments.
 *     and attendance./marks./subjects.), at the hasPermission layer
 *     and at the raw checkPermission layer.
 *  3. VETO HOLDS: system.backup / system.audit stay DENIED whenever
 *     principal is held in ANY slot (primary or additional).
 *  4. RESOLUTION HELPERS: a non-teacher designation/account beats a
 *     plain-teacher duplicate regardless of record order.
 *
 * The hasPermission replicas below are faithful copies of the two
 * implementations (branch bodies verbatim); both use the REAL
 * checkPermission / buildAuthorizationContext / role templates.
 *
 * Run: npx tsx scripts/test-rbac-multirole.ts
 * Exit code 0 = all proofs hold.
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
import {
  normalizeRoleKey,
  bestDesignationRole,
  pickAuthoritativeUser,
  pickBestStaffRecord,
  effectiveRoleKeys,
  sanitizeAdditionalRoles
} from '../services/roleResolution';
import { deriveRoleFromDesignation } from '../services/utils';
import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import type { CustomRole, InstitutionMember, Permission } from '../types/rbac';
import type { UserRole } from '../types';

const INSTITUTION_ID = 'inst_madrasah_primary';

// ---------------------------------------------------------------------------
// Role documents exactly as the app resolves them: seeded from the
// CURRENT templates (staff → office_staff template), merged on load.
// ---------------------------------------------------------------------------
const KEY_TO_TEMPLATE: Record<string, string> = {
  teacher: 'teacher',
  accountant: 'accountant',
  principal: 'principal',
  staff: 'office_staff',
  guardian: 'guardian',
  super_admin: 'institution_admin'
};

function roleDocForKey(key: string): CustomRole | null {
  const templateKey = KEY_TO_TEMPLATE[key];
  if (!templateKey) return null;
  const t = DEFAULT_ROLE_TEMPLATES.find(x => x.templateKey === templateKey);
  if (!t) return null;
  const now = '2026-01-01T00:00:00.000Z';
  return mergeRolePermissionsWithTemplate({
    id: `role_${templateKey}`,
    institutionId: INSTITUTION_ID,
    name: t.defaultName,
    displayName: t.displayNameBn,
    permissions: [...t.permissions],
    dataScopes: t.defaultScopes,
    isSystemRole: templateKey === 'institution_admin',
    isActive: true,
    createdAt: now,
    createdBy: 'script',
    updatedAt: now,
    updatedBy: 'script'
  });
}

function makeMember(
  roleId: string,
  status: InstitutionMember['status'],
  assignedClasses: string[] = [],
  additionalRoleIds: string[] = []
): InstitutionMember {
  return {
    uid: 'uid_scenario',
    institutionId: INSTITUTION_ID,
    email: 'someone@example.com',
    roleId,
    additionalRoleIds,
    status,
    assignedClasses,
    assignedSubjects: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

function makeAuthUser(email: string): any {
  return { uid: 'uid_scenario', email };
}

// ---------------------------------------------------------------------------
// The canonical hardcoded branches (verbatim grant bodies).
// ---------------------------------------------------------------------------
function hardcodedBranches(effectiveRole: string | undefined, permission: Permission): boolean | undefined {
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

// ---------------------------------------------------------------------------
// REFERENCE: the Phase-6 single-role hasPermission (AppContext @ da0cde1),
// identical to hasPermissionNew in scripts/test-rbac-equivalence.ts.
// ---------------------------------------------------------------------------
interface SingleScenario {
  email: string;
  claims: Record<string, any> | null;
  isAdminFlag: boolean;
  currentUserRole?: string;
  member: InstitutionMember | null;
  storedRole: CustomRole | null;
}

function hasPermissionSingle(
  s: SingleScenario,
  permission: Permission,
  scope?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  const authUser = makeAuthUser(s.email);
  const isSuperAdmin = isVerifiedSuperAdmin(authUser, s.claims);
  const isOwner = (s.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isSuperAdmin || isOwner || s.isAdminFlag || s.currentUserRole === 'super_admin') {
    return true;
  }

  const effectiveRole = s.currentUserRole || s.member?.roleId?.replace('role_', '');

  if (effectiveRole === 'principal' && (permission === 'system.backup' || permission === 'system.audit')) {
    return false;
  }

  const authContext = buildAuthorizationContext(authUser, s.claims, s.member, s.storedRole, INSTITUTION_ID);
  if (checkPermission(authContext, permission, scope)) {
    return true;
  }

  if (effectiveRole === 'principal') {
    return true;
  }

  return hardcodedBranches(effectiveRole, permission) || false;
}

// ---------------------------------------------------------------------------
// NEW: faithful replica of the multi-role AppContext.hasPermission.
// ---------------------------------------------------------------------------
interface MultiScenario {
  email: string;
  claims: Record<string, any> | null;
  isAdminFlag: boolean;
  primaryRole: UserRole | null;
  additionalRoles: UserRole[];
  member: InstitutionMember | null;
}

function hardcodedBranchGrants(role: string | null | undefined, permission: Permission): boolean {
  const key = normalizeRoleKey(role) || role;
  if (key === 'accountant') {
    if (permission.startsWith('finance.') || permission.startsWith('fees.') || permission.startsWith('payments.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (key === 'teacher') {
    if (permission.startsWith('attendance.') || permission.startsWith('marks.') || permission.startsWith('subjects.')) return true;
    if (permission === 'reports.view' || permission === 'students.view') return true;
  }
  if (key === 'guardian') {
    if (permission === 'students.view' || permission === 'marks.view' || permission === 'attendance.view' || permission === 'fees.view') return true;
  }
  return false;
}

function hasPermissionMulti(
  s: MultiScenario,
  permission: Permission,
  scope?: { classId?: string; subjectId?: string; studentId?: string }
): boolean {
  const authUser = makeAuthUser(s.email);
  const isSuperAdmin = isVerifiedSuperAdmin(authUser, s.claims);
  const isOwner = (s.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isSuperAdmin || isOwner || s.isAdminFlag || s.primaryRole === 'super_admin') {
    return true;
  }

  const effectiveRole = s.primaryRole || s.member?.roleId?.replace('role_', '');
  const effectiveRoles = effectiveRoleKeys(s.primaryRole, [s.additionalRoles]);

  if (
    (effectiveRole === 'principal' || effectiveRoles.includes('principal')) &&
    (permission === 'system.backup' || permission === 'system.audit')
  ) {
    return false;
  }

  const primaryDoc = s.primaryRole ? roleDocForKey(s.primaryRole) : null;
  const additionalDocs: CustomRole[] = [];
  for (const key of effectiveRoles) {
    if (key === s.primaryRole) continue;
    const doc = roleDocForKey(key);
    if (doc && doc.id !== primaryDoc?.id && !additionalDocs.some(d => d.id === doc.id)) {
      additionalDocs.push(doc);
    }
  }
  const authContext = buildAuthorizationContext(
    authUser, s.claims, s.member, primaryDoc, INSTITUTION_ID,
    additionalDocs.length > 0 ? additionalDocs : undefined
  );
  if (checkPermission(authContext, permission, scope)) {
    return true;
  }

  const rolesToTry: Array<string | null | undefined> =
    effectiveRoles.length > 0 ? effectiveRoles : [effectiveRole];
  for (const roleKey of rolesToTry) {
    if (normalizeRoleKey(roleKey) === 'principal') return true;
    if (hardcodedBranchGrants(roleKey, permission)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Permission universe (same as the Phase-6 equivalence matrix).
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

// ---------------------------------------------------------------------------
// Tiny assertion harness.
// ---------------------------------------------------------------------------
let failures = 0;
function expect(label: string, actual: boolean, wanted: boolean) {
  if (actual !== wanted) {
    failures++;
    console.log(`  FAIL: ${label} — got ${actual}, wanted ${wanted}`);
  }
}
function expectEq(label: string, actual: unknown, wanted: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    failures++;
    console.log(`  FAIL: ${label} — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(wanted)}`);
  }
}

function main() {
  console.log('================================================================');
  console.log('Multi-role RBAC — union logic + duplicate-safe role resolution');
  console.log('================================================================');

  // ------------------------------------------------------------------
  // 1. Single-role equivalence: multi replica (effectiveRoles = [role])
  //    must equal the Phase-6 single-role reference everywhere.
  // ------------------------------------------------------------------
  const singleRoles: UserRole[] = ['teacher', 'accountant', 'principal', 'staff', 'guardian'];
  let combos = 0;
  let mismatches = 0;
  const mismatchSamples: string[] = [];

  for (const role of singleRoles) {
    const roleId = `role_${KEY_TO_TEMPLATE[role]}`;
    const memberVariants: Array<{ name: string; member: InstitutionMember | null }> = [
      { name: 'no-member', member: null },
      { name: 'member-active', member: makeMember(roleId, 'active') },
      { name: 'member-active-assigned-cls2', member: makeMember(roleId, 'active', ['cls_2']) },
      { name: 'member-inactive', member: makeMember(roleId, 'inactive') },
      { name: 'member-suspended', member: makeMember(roleId, 'suspended') }
    ];
    for (const mv of memberVariants) {
      const single: SingleScenario = {
        email: 'someone@example.com',
        claims: null,
        isAdminFlag: false,
        currentUserRole: role,
        member: mv.member,
        storedRole: roleDocForKey(role)
      };
      const multi: MultiScenario = {
        email: 'someone@example.com',
        claims: null,
        isAdminFlag: false,
        primaryRole: role,
        additionalRoles: [],
        member: mv.member
      };
      for (const permission of PERMISSIONS) {
        for (const scope of SCOPES) {
          combos++;
          const before = hasPermissionSingle(single, permission as Permission, scope);
          const after = hasPermissionMulti(multi, permission as Permission, scope);
          if (before !== after) {
            mismatches++;
            if (mismatchSamples.length < 15) {
              mismatchSamples.push(`role=${role} ${mv.name} | ${permission} | scope=${JSON.stringify(scope)} | single=${before} multi=${after}`);
            }
          }
        }
      }
    }
  }
  console.log(`[1] Single-role equivalence: ${combos} combinations, ${mismatches} mismatches`);
  mismatchSamples.forEach(m => console.log('    MISMATCH: ' + m));
  if (mismatches > 0) failures += mismatches;

  // ------------------------------------------------------------------
  // 2. Union grants: accountant + teacher (both primary orders).
  // ------------------------------------------------------------------
  const memberAcct = makeMember('role_accountant', 'active', [], ['role_teacher']);
  const memberTeach = makeMember('role_teacher', 'active', ['cls_2'], ['role_accountant']);
  const acctFirst: MultiScenario = {
    email: 'someone@example.com', claims: null, isAdminFlag: false,
    primaryRole: 'accountant', additionalRoles: ['teacher'], member: memberAcct
  };
  const teachFirst: MultiScenario = {
    email: 'someone@example.com', claims: null, isAdminFlag: false,
    primaryRole: 'teacher', additionalRoles: ['accountant'], member: memberTeach
  };
  const unionGrants = [
    'fees.view', 'fees.create', 'fees.edit', 'payments.create', 'finance.view', 'finance.create',
    'marks.view', 'marks.create', 'marks.edit', 'attendance.view', 'attendance.create',
    'subjects.view', 'subjects.create', 'reports.view', 'students.view', 'results.view'
  ];
  for (const p of unionGrants) {
    expect(`union acct+teacher grants ${p} (accountant primary)`, hasPermissionMulti(acctFirst, p as Permission), true);
    expect(`union acct+teacher grants ${p} (teacher primary)`, hasPermissionMulti(teachFirst, p as Permission), true);
  }
  // …and things NEITHER role grants stay denied.
  for (const p of ['users.view', 'roles.view', 'institution.settings.view', 'students.delete', 'whatever.unknown']) {
    expect(`union acct+teacher denies ${p}`, hasPermissionMulti(acctFirst, p as Permission), false);
    expect(`union acct+teacher denies ${p} (teacher primary)`, hasPermissionMulti(teachFirst, p as Permission), false);
  }
  // Scoped union checks.
  expect('union finance.view scoped cls_9 (accountant scope allClasses)',
    hasPermissionMulti(acctFirst, 'finance.view' as Permission, { classId: 'cls_9' }), true);
  expect('union marks.edit scoped cls_2 (matches single-teacher outcome)',
    hasPermissionMulti(teachFirst, 'marks.edit' as Permission, { classId: 'cls_2' }),
    hasPermissionSingle(
      { email: 'someone@example.com', claims: null, isAdminFlag: false, currentUserRole: 'teacher', member: memberTeach, storedRole: roleDocForKey('teacher') },
      'marks.edit' as Permission, { classId: 'cls_2' }
    ));

  // Raw checkPermission layer (what PermissionGate sees).
  const unionCtx = buildAuthorizationContext(
    makeAuthUser('someone@example.com'), null, memberAcct,
    roleDocForKey('accountant'), INSTITUTION_ID, [roleDocForKey('teacher')!]
  );
  const teacherOnlyCtx = buildAuthorizationContext(
    makeAuthUser('someone@example.com'), null, memberTeach,
    roleDocForKey('teacher'), INSTITUTION_ID
  );
  const acctOnlyCtx = buildAuthorizationContext(
    makeAuthUser('someone@example.com'), null, memberAcct,
    roleDocForKey('accountant'), INSTITUTION_ID
  );
  expect('checkPermission union ctx grants fees.create', checkPermission(unionCtx, 'fees.create' as Permission), true);
  expect('checkPermission union ctx grants marks.create', checkPermission(unionCtx, 'marks.create' as Permission), true);
  expect('checkPermission teacher-only ctx denies fees.create', checkPermission(teacherOnlyCtx, 'fees.create' as Permission), false);
  expect('checkPermission accountant-only ctx denies marks.create', checkPermission(acctOnlyCtx, 'marks.create' as Permission), false);
  console.log('[2] Union grants (accountant+teacher): checked');

  // ------------------------------------------------------------------
  // 3. Principal veto holds in every slot.
  // ------------------------------------------------------------------
  for (const [label, s] of [
    ['principal only', { email: 'someone@example.com', claims: null, isAdminFlag: false, primaryRole: 'principal' as UserRole, additionalRoles: [] as UserRole[], member: makeMember('role_principal', 'active') }],
    ['teacher + principal', { email: 'someone@example.com', claims: null, isAdminFlag: false, primaryRole: 'teacher' as UserRole, additionalRoles: ['principal'] as UserRole[], member: makeMember('role_teacher', 'active', [], ['role_principal']) }],
    ['accountant + principal', { email: 'someone@example.com', claims: null, isAdminFlag: false, primaryRole: 'accountant' as UserRole, additionalRoles: ['principal'] as UserRole[], member: makeMember('role_accountant', 'active', [], ['role_principal']) }]
  ] as Array<[string, MultiScenario]>) {
    expect(`veto ${label}: system.backup denied`, hasPermissionMulti(s, 'system.backup' as Permission), false);
    expect(`veto ${label}: system.audit denied`, hasPermissionMulti(s, 'system.audit' as Permission), false);
  }
  // …while a principal+teacher still gets the union of normal grants.
  const princTeach: MultiScenario = {
    email: 'someone@example.com', claims: null, isAdminFlag: false,
    primaryRole: 'teacher', additionalRoles: ['principal'], member: makeMember('role_teacher', 'active', [], ['role_principal'])
  };
  expect('principal+teacher grants marks.create', hasPermissionMulti(princTeach, 'marks.create' as Permission), true);
  expect('principal+teacher grants fees.view', hasPermissionMulti(princTeach, 'fees.view' as Permission), true);
  console.log('[3] Principal veto (system.backup / system.audit): holds in every slot');

  // ------------------------------------------------------------------
  // 4. Resolution helpers: duplicates can no longer misroute a login.
  // ------------------------------------------------------------------
  const TEACHER_REC = { designation: 'সহকারী শিক্ষক (Assistant Teacher)' };
  const ACCT_REC = { designation: 'হিসাবরক্ষক / ক্যাশিয়ার (Accountant)' };
  expectEq('bestDesignationRole teacher-dup first', bestDesignationRole([TEACHER_REC, ACCT_REC]), 'accountant');
  expectEq('bestDesignationRole accountant first', bestDesignationRole([ACCT_REC, TEACHER_REC]), 'accountant');
  expectEq('bestDesignationRole plain teachers only', bestDesignationRole([TEACHER_REC, TEACHER_REC]), 'teacher');
  expectEq('pickBestStaffRecord picks accountant record', pickBestStaffRecord([TEACHER_REC, ACCT_REC]), ACCT_REC);
  expectEq(
    'pickAuthoritativeUser skips teacher-stamped duplicate',
    pickAuthoritativeUser([{ id: 'dup', role: 'teacher' as UserRole }, { id: 'real', role: 'accountant' as UserRole }])?.id,
    'real'
  );
  expectEq(
    'pickAuthoritativeUser keeps accountant when first',
    pickAuthoritativeUser([{ id: 'real', role: 'accountant' as UserRole }, { id: 'dup', role: 'teacher' as UserRole }])?.id,
    'real'
  );
  expectEq(
    'pickAuthoritativeUser all-teacher falls back to first',
    pickAuthoritativeUser([{ id: 'a', role: 'teacher' as UserRole }, { id: 'b', role: 'teacher' as UserRole }])?.id,
    'a'
  );
  expectEq('effectiveRoleKeys dedupes, primary first',
    effectiveRoleKeys('accountant', [['teacher', 'teacher'], ['guardian']]),
    ['accountant', 'teacher', 'guardian']);
  expectEq('sanitizeAdditionalRoles drops primary + super_admin',
    sanitizeAdditionalRoles(['teacher', 'super_admin', 'accountant'], 'accountant'),
    ['teacher']);
  expectEq('normalizeRoleKey role_accountant', normalizeRoleKey('role_accountant'), 'accountant');
  expectEq('normalizeRoleKey parent alias', normalizeRoleKey('parent'), 'guardian');
  expectEq('normalizeRoleKey office_staff alias', normalizeRoleKey('office_staff'), 'staff');
  expectEq('normalizeRoleKey unknown', normalizeRoleKey('bogus'), null);
  expectEq('deriveRoleFromDesignation sanity (accountant)', deriveRoleFromDesignation(ACCT_REC.designation), 'accountant');
  console.log('[4] Resolution helpers: duplicate-safe precedence verified');

  console.log('================================================================');
  if (failures === 0) {
    console.log('RESULT: ALL CHECKS PASSED — single-role outcomes unchanged,');
    console.log('        multi-role union grants work, principal veto holds,');
    console.log('        duplicate records can no longer misroute a login.');
  } else {
    console.log(`RESULT: ${failures} FAILURE(S) — see above.`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

main();
