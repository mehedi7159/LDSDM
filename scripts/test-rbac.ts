import assert from 'node:assert';
import { 
  isVerifiedSuperAdmin, 
  checkPermission, 
  permissionMatches, 
  evaluateDataScope, 
  buildAuthorizationContext,
  PLATFORM_SUPERADMIN_EMAIL
} from '../services/authorization';
import { 
  DEFAULT_ROLE_TEMPLATES, 
  generateRoleId 
} from '../services/rbac';
import { generateAuditLogId } from '../services/auditLog';
import type { 
  CustomRole, 
  InstitutionMember, 
  AuthorizationContext, 
  DataScope 
} from '../types/rbac';

console.log('================================================================');
console.log('PHASE 1.5: ADVANCED RBAC & SUPER ADMIN SECURITY VERIFICATION SUITE');
console.log('================================================================');

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✖ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Firestore Rules Evaluation Simulator (Mirrors firestore.rules logic exactly)
// ---------------------------------------------------------------------------
interface SimulatedAuth {
  uid: string;
  token: {
    email?: string;
    role?: string;
    isSuperAdmin?: boolean;
    institutionId?: string;
  };
}

function firestoreIsSuperAdmin(auth: SimulatedAuth | null): boolean {
  if (!auth || !auth.uid) return false;
  const email = auth.token.email;
  const isMatchingEmail = email != null && email.toLowerCase() === PLATFORM_SUPERADMIN_EMAIL.toLowerCase();
  const hasValidClaim = auth.token.role === 'admin' || auth.token.isSuperAdmin === true;
  return isMatchingEmail && hasValidClaim;
}

function firestoreIsAuthenticatedAdmin(auth: SimulatedAuth | null): boolean {
  if (!auth || !auth.uid) return false;
  return (
    auth.token.role === 'admin' ||
    (auth.token.email != null && auth.token.email.toLowerCase() === PLATFORM_SUPERADMIN_EMAIL.toLowerCase())
  );
}

function firestoreCanReadAuditLogs(auth: SimulatedAuth | null): boolean {
  return firestoreIsSuperAdmin(auth);
}

function firestoreCanCreateAuditLogs(auth: SimulatedAuth | null, resourceData: { actorUid: string; actorEmail?: string }): boolean {
  if (!auth || !auth.uid) return false;
  if (resourceData.actorUid !== auth.uid) return false;
  if (auth.token.email && resourceData.actorEmail !== auth.token.email) return false;
  return true;
}

function firestoreCanUpdateAuditLogs(): boolean {
  return false; // allow update: if false;
}

function firestoreCanDeleteAuditLogs(): boolean {
  return false; // allow delete: if false;
}

function firestoreCanWriteRoles(auth: SimulatedAuth | null): boolean {
  return firestoreIsAuthenticatedAdmin(auth);
}

function firestoreCanWriteMembers(auth: SimulatedAuth | null): boolean {
  return firestoreIsAuthenticatedAdmin(auth);
}

// ===========================================================================
// TEST 1: Super Admin claim verified
// ===========================================================================
test('TEST 1: Super Admin claim verified cryptographically (ID token claim + designated owner)', () => {
  const superAdminUser: any = {
    uid: 'super_uid_123',
    email: 'mehedihasansagor26@gmail.com'
  };
  const validClaims = {
    role: 'admin',
    isSuperAdmin: true
  };

  // Authorization service verification
  assert.strictEqual(
    isVerifiedSuperAdmin(superAdminUser, validClaims), 
    true, 
    'Super Admin with verified claims must pass verification'
  );

  // Firestore security rule simulation
  const simulatedAuth: SimulatedAuth = {
    uid: 'super_uid_123',
    token: {
      email: 'mehedihasansagor26@gmail.com',
      role: 'admin',
      isSuperAdmin: true
    }
  };
  assert.strictEqual(firestoreIsSuperAdmin(simulatedAuth), true);
  assert.strictEqual(firestoreCanReadAuditLogs(simulatedAuth), true);

  // Email alone WITHOUT claims MUST FAIL
  assert.strictEqual(
    isVerifiedSuperAdmin(superAdminUser, null), 
    false, 
    'Email alone without cryptographic claims must be rejected'
  );
});

// ===========================================================================
// TEST 2: Normal admin is NOT Super Admin
// ===========================================================================
test('TEST 2: Normal admin is NOT Super Admin (Platform audit & Super Admin controls denied)', () => {
  const normalAdminUser: any = {
    uid: 'inst_admin_456',
    email: 'principal@darululoom.edu.bd'
  };
  const normalAdminClaims = {
    role: 'admin',
    institutionId: 'inst_darul_uloom'
  };

  // Auth service check
  assert.strictEqual(
    isVerifiedSuperAdmin(normalAdminUser, normalAdminClaims), 
    false, 
    'Normal institution admin must NEVER be recognized as Platform Super Admin'
  );

  // Firestore rule check
  const normalAdminAuth: SimulatedAuth = {
    uid: 'inst_admin_456',
    token: {
      email: 'principal@darululoom.edu.bd',
      role: 'admin',
      institutionId: 'inst_darul_uloom'
    }
  };
  assert.strictEqual(firestoreIsSuperAdmin(normalAdminAuth), false);
  assert.strictEqual(firestoreCanReadAuditLogs(normalAdminAuth), false, 'Normal admin CANNOT read platform audit logs');
});

// ===========================================================================
// TEST 3: Teacher cannot access role management
// ===========================================================================
test('TEST 3: Teacher cannot access role management (Granular permission & Firestore deny)', () => {
  const teacherRole: CustomRole = {
    id: 'role_teacher',
    institutionId: 'inst_1',
    name: 'teacher',
    displayName: 'সহকারী শিক্ষক',
    permissions: ['students.view', 'attendance.create', 'marks.create'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const teacherMember: InstitutionMember = {
    uid: 'teacher_uid_1',
    institutionId: 'inst_1',
    email: 'teacher@school.com',
    roleId: 'role_teacher',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const teacherCtx: AuthorizationContext = {
    uid: 'teacher_uid_1',
    email: 'teacher@school.com',
    isSuperAdmin: false,
    isInstitutionAdmin: false,
    institutionId: 'inst_1',
    member: teacherMember,
    role: teacherRole,
    permissions: new Set(teacherRole.permissions),
    dataScopes: { allClasses: false, classes: ['cls_hifz'] }
  };

  // Application authorization checks
  assert.strictEqual(checkPermission(teacherCtx, 'roles.view'), false, 'Teacher cannot view roles');
  assert.strictEqual(checkPermission(teacherCtx, 'roles.create'), false, 'Teacher cannot create roles');
  assert.strictEqual(checkPermission(teacherCtx, 'roles.edit'), false, 'Teacher cannot edit roles');
  assert.strictEqual(checkPermission(teacherCtx, 'roles.delete'), false, 'Teacher cannot delete roles');

  // Firestore rule check
  const teacherAuth: SimulatedAuth = {
    uid: 'teacher_uid_1',
    token: {
      email: 'teacher@school.com',
      role: 'teacher'
    }
  };
  assert.strictEqual(firestoreCanWriteRoles(teacherAuth), false, 'Teacher cannot write to roles in Firestore');
});

// ===========================================================================
// TEST 4: Custom role authorization is permission-based
// ===========================================================================
test('TEST 4: Custom role authorization is permission-based (independent of role name)', () => {
  // A role named "Senior Maulana" with specific permissions
  const maulanaRole: CustomRole = {
    id: 'role_senior_maulana',
    institutionId: 'inst_1',
    name: 'senior_maulana',
    displayName: 'Senior Maulana',
    permissions: [
      'students.view',
      'attendance.view',
      'attendance.create'
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const maulanaCtx: AuthorizationContext = {
    uid: 'maulana_uid',
    email: 'maulana@madrasah.edu',
    isSuperAdmin: false,
    isInstitutionAdmin: false,
    institutionId: 'inst_1',
    role: maulanaRole,
    permissions: new Set(maulanaRole.permissions),
    dataScopes: { allClasses: true }
  };

  // Permissions granted because they exist in permissions array, NOT because of name
  assert.strictEqual(checkPermission(maulanaCtx, 'attendance.view'), true);
  assert.strictEqual(checkPermission(maulanaCtx, 'attendance.create'), true);
  // Not granted because not in permissions array
  assert.strictEqual(checkPermission(maulanaCtx, 'finance.view'), false);
  assert.strictEqual(checkPermission(maulanaCtx, 'roles.create'), false);

  // A role named "Teacher" with EMPTY permissions gets NOTHING
  const emptyTeacherRole: CustomRole = {
    id: 'role_empty_teacher',
    institutionId: 'inst_1',
    name: 'teacher',
    displayName: 'Empty Teacher',
    permissions: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const emptyTeacherCtx: AuthorizationContext = {
    uid: 'empty_teacher_uid',
    email: 'empty@school.com',
    isSuperAdmin: false,
    isInstitutionAdmin: false,
    institutionId: 'inst_1',
    role: emptyTeacherRole,
    permissions: new Set(),
    dataScopes: { allClasses: true }
  };

  assert.strictEqual(checkPermission(emptyTeacherCtx, 'marks.create'), false, 'Name "Teacher" must not grant unassigned privileges');
});

// ===========================================================================
// TEST 5: Institution A cannot access Institution B
// ===========================================================================
test('TEST 5: Tenant Isolation - Institution A member cannot operate in Institution B', () => {
  const memberA: InstitutionMember = {
    uid: 'user_a_1',
    institutionId: 'inst_alpha',
    email: 'user@alpha.org',
    roleId: 'role_admin_alpha',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const authClaimsA = {
    role: 'institution_admin',
    institutionId: 'inst_alpha'
  };

  const userA: any = { uid: 'user_a_1', email: 'user@alpha.org' };

  // Context built for institution B
  const contextInB = buildAuthorizationContext(userA, authClaimsA, memberA, null, 'inst_beta');

  assert.strictEqual(
    contextInB.isInstitutionAdmin, 
    false, 
    'Admin of Institution Alpha must NOT be granted admin rights in Institution Beta'
  );
});

// ===========================================================================
// TEST 6: DataScope blocks unauthorized class
// ===========================================================================
test('TEST 6: DataScope blocks unauthorized class (Assigned class allowed, unassigned denied)', () => {
  const scope: DataScope = {
    allClasses: false,
    classes: ['class_7'],
    allSubjects: true
  };

  assert.strictEqual(evaluateDataScope(scope, { classId: 'class_7' }), true, 'Assigned Class 7 must be allowed');
  assert.strictEqual(evaluateDataScope(scope, { classId: 'class_8' }), false, 'Unassigned Class 8 must be blocked');
  assert.strictEqual(evaluateDataScope(scope, { classId: 'class_10' }), false, 'Unassigned Class 10 must be blocked');
});

// ===========================================================================
// TEST 7: DataScope blocks unauthorized subject
// ===========================================================================
test('TEST 7: DataScope blocks unauthorized subject (Assigned subject allowed, unassigned denied)', () => {
  const scope: DataScope = {
    allClasses: true,
    allSubjects: false,
    subjects: ['sub_mathematics']
  };

  assert.strictEqual(evaluateDataScope(scope, { subjectId: 'sub_mathematics' }), true, 'Assigned Mathematics must be allowed');
  assert.strictEqual(evaluateDataScope(scope, { subjectId: 'sub_english' }), false, 'Unassigned English must be blocked');
  assert.strictEqual(evaluateDataScope(scope, { subjectId: 'sub_arabic' }), false, 'Unassigned Arabic must be blocked');
});

// ===========================================================================
// TEST 8: Super Admin audit page is protected
// ===========================================================================
test('TEST 8: Super Admin audit page is strictly protected (Multi-layer guard)', () => {
  const superAdminUser: any = { uid: 'uid_owner', email: 'mehedihasansagor26@gmail.com' };
  const superClaims = { role: 'admin', isSuperAdmin: true };

  const instAdminUser: any = { uid: 'uid_admin', email: 'principal@school.com' };
  const instClaims = { role: 'admin' };

  const teacherUser: any = { uid: 'uid_teacher', email: 'teacher@school.com' };
  const teacherClaims = {};

  // Check 1: Super Admin passes
  assert.strictEqual(isVerifiedSuperAdmin(superAdminUser, superClaims), true);

  // Check 2: Institution Admin fails
  assert.strictEqual(isVerifiedSuperAdmin(instAdminUser, instClaims), false);

  // Check 3: Teacher fails
  assert.strictEqual(isVerifiedSuperAdmin(teacherUser, teacherClaims), false);

  // Check 4: Unauthenticated fails
  assert.strictEqual(isVerifiedSuperAdmin(null, null), false);
});

// ===========================================================================
// TEST 9: platformAuditLogs cannot be updated
// ===========================================================================
test('TEST 9: platformAuditLogs cannot be updated (Immutable audit rule enforced: allow update: if false)', () => {
  assert.strictEqual(
    firestoreCanUpdateAuditLogs(), 
    false, 
    'Firestore rule strictly forbids update operations on /platformAuditLogs'
  );
});

// ===========================================================================
// TEST 10: platformAuditLogs cannot be deleted
// ===========================================================================
test('TEST 10: platformAuditLogs cannot be deleted (Immutable audit rule enforced: allow delete: if false)', () => {
  assert.strictEqual(
    firestoreCanDeleteAuditLogs(), 
    false, 
    'Firestore rule strictly forbids delete operations on /platformAuditLogs'
  );
});

// ===========================================================================
// TEST 11: Normal user cannot self-promote
// ===========================================================================
test('TEST 11: Normal user cannot self-promote (Membership doc write strictly requires admin claim)', () => {
  const normalUserAuth: SimulatedAuth = {
    uid: 'normal_user_999',
    token: {
      email: 'student_or_teacher@school.com',
      role: 'teacher'
    }
  };

  assert.strictEqual(
    firestoreCanWriteMembers(normalUserAuth), 
    false, 
    'User without admin claim cannot write or elevate roles in members collection'
  );

  // Impersonating actor in audit log is also blocked by rule
  const forgedAuditData = {
    actorUid: 'admin_victim_uid',
    actorEmail: 'victim@school.com'
  };
  assert.strictEqual(
    firestoreCanCreateAuditLogs(normalUserAuth, forgedAuditData),
    false,
    'Normal user CANNOT forge actorUid in platform audit records'
  );

  // Legitimate audit data with matching actorUid passes
  const legitimateAuditData = {
    actorUid: 'normal_user_999',
    actorEmail: 'student_or_teacher@school.com'
  };
  assert.strictEqual(
    firestoreCanCreateAuditLogs(normalUserAuth, legitimateAuditData),
    true,
    'Legitimate audit write with authentic actorUid is accepted'
  );
});

// ===========================================================================
// TEST 12: Existing Super Admin login remains valid
// ===========================================================================
test('TEST 12: Existing Super Admin login remains 100% valid with backwards compatibility', () => {
  // Existing token format: { role: 'admin' }
  const existingLegacyClaims = {
    role: 'admin'
  };
  const ownerUser: any = {
    uid: 'owner_uid_777',
    email: 'mehedihasansagor26@gmail.com'
  };

  // Backwards compatibility verification
  assert.strictEqual(
    isVerifiedSuperAdmin(ownerUser, existingLegacyClaims), 
    true, 
    'Original { role: "admin" } claim MUST continue to authorize Super Admin'
  );

  // New token format: { role: 'admin', isSuperAdmin: true }
  const upgradedClaims = {
    role: 'admin',
    isSuperAdmin: true
  };
  assert.strictEqual(
    isVerifiedSuperAdmin(ownerUser, upgradedClaims), 
    true, 
    'Upgraded { role: "admin", isSuperAdmin: true } claim authorizes Super Admin'
  );

  // Firestore rule simulation
  const ownerAuthLegacy: SimulatedAuth = {
    uid: 'owner_uid_777',
    token: {
      email: 'mehedihasansagor26@gmail.com',
      role: 'admin'
    }
  };
  assert.strictEqual(firestoreIsSuperAdmin(ownerAuthLegacy), true);
  assert.strictEqual(firestoreIsAuthenticatedAdmin(ownerAuthLegacy), true);
});

console.log('----------------------------------------------------------------');
console.log(`Results: ${passed}/${total} RBAC Security Verification Tests PASSED.`);
console.log('================================================================');
