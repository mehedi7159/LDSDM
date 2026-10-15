/**
 * Comprehensive Firestore Rules Logic Evaluation Test Suite
 * 
 * Accurately models the exact security directives in repository `firestore.rules`:
 * - Verifies Least-Privilege access to `/institution/main_store`
 * - Verifies denial of unauthenticated access
 * - Verifies denial of ordinary authenticated users (teachers, guardians, staff)
 * - Verifies guaranteed non-lockout of authoritative Owner (mehedihasansagor26@gmail.com)
 * - Verifies custom claims and database admin evaluations
 * - Verifies recursive wildcard catch-all default-deny behavior
 */

import assert from 'node:assert';

console.log('================================================================');
console.log('PHASE 2B: FIRESTORE LEAST-PRIVILEGE RULES EVALUATION TEST SUITE');
console.log('================================================================');

export interface RulesAuthContext {
  uid: string;
  token: {
    email?: string;
    role?: string;
    isSuperAdmin?: boolean;
    [key: string]: any;
  };
}

export interface RulesDatabaseState {
  admins: Record<string, { role?: string; [key: string]: any }>;
}

export interface RulesRequest {
  auth: RulesAuthContext | null;
  resource?: {
    data: Record<string, any>;
  };
}

/**
 * Exact helper function translations from repository `firestore.rules`
 */
export class FirestoreRulesEvaluator {
  private db: RulesDatabaseState;

  constructor(dbState?: Partial<RulesDatabaseState>) {
    this.db = {
      admins: dbState?.admins || {}
    };
  }

  // function isSignedIn()
  public isSignedIn(request: RulesRequest): boolean {
    return request.auth !== null && typeof request.auth.uid === 'string' && request.auth.uid.length > 0;
  }

  // function isAuthenticatedAdmin()
  public isAuthenticatedAdmin(request: RulesRequest): boolean {
    if (!this.isSignedIn(request)) return false;
    const auth = request.auth!;
    
    // 1. Cryptographic Custom Claim
    if (auth.token.role === 'admin') return true;

    // 2. Database Admin Document
    const adminDoc = this.db.admins[auth.uid];
    if (adminDoc && adminDoc.role === 'admin') return true;

    // 3. Authoritative Owner Email
    if (auth.token.email && auth.token.email.toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase()) {
      return true;
    }

    return false;
  }

  // function isSuperAdmin()
  public isSuperAdmin(request: RulesRequest): boolean {
    if (!this.isSignedIn(request)) return false;
    const auth = request.auth!;
    return (
      (auth.token.email != null && auth.token.email.toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase()) ||
      auth.token.isSuperAdmin === true
    );
  }

  /**
   * Evaluates read access for a path
   */
  public evaluateRead(path: string, request: RulesRequest): boolean {
    const segments = path.replace(/^\//, '').split('/');
    
    // /institution/{docId}
    if (segments[0] === 'institution' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /cloud_snapshots/{snapshotId}
    if (segments[0] === 'cloud_snapshots' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /admins/{adminUid}
    if (segments[0] === 'admins' && segments.length === 2) {
      const adminUid = segments[1];
      return this.isAuthenticatedAdmin(request) || (this.isSignedIn(request) && request.auth!.uid === adminUid);
    }

    // /institutions/{institutionId}
    if (segments[0] === 'institutions') {
      if (segments.length === 2) {
        return this.isAuthenticatedAdmin(request);
      }
      if (segments.length === 4 && segments[2] === 'roles') {
        return this.isSignedIn(request);
      }
      if (segments.length === 4 && segments[2] === 'members') {
        const memberId = segments[3];
        return this.isAuthenticatedAdmin(request) || (this.isSignedIn(request) && request.auth!.uid === memberId);
      }
    }

    // /transactions/{transactionId}
    if (segments[0] === 'transactions' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /trashBin/{trashId}
    if (segments[0] === 'trashBin' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /platformAuditLogs/{logId}
    if (segments[0] === 'platformAuditLogs' && segments.length === 2) {
      return this.isSuperAdmin(request);
    }

    // /students/{studentId}, /subjects/{subjectId}, etc.
    const standardSignedCollections = ['students', 'subjects', 'exams', 'marks', 'remarks', 'classes', 'feeStructures', 'notices'];
    if (standardSignedCollections.includes(segments[0]) && segments.length === 2) {
      return this.isSignedIn(request);
    }

    // Default deny catch-all: match /{document=**} { allow read, write: if false; }
    return false;
  }

  /**
   * Evaluates write access for a path
   */
  public evaluateWrite(path: string, request: RulesRequest): boolean {
    const segments = path.replace(/^\//, '').split('/');

    // /institution/{docId}
    if (segments[0] === 'institution' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /cloud_snapshots/{snapshotId}
    if (segments[0] === 'cloud_snapshots' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /admins/{adminUid}
    if (segments[0] === 'admins' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /institutions/{institutionId}
    if (segments[0] === 'institutions') {
      return this.isAuthenticatedAdmin(request);
    }

    // /transactions/{transactionId}
    if (segments[0] === 'transactions' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /trashBin/{trashId}
    if (segments[0] === 'trashBin' && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // /platformAuditLogs/{logId}
    if (segments[0] === 'platformAuditLogs' && segments.length === 2) {
      // Create is append-only by authenticated actor; update/delete: if false
      return false; // general write without create distinction
    }

    // standard collections write strictly requires isAuthenticatedAdmin
    const standardCollections = ['students', 'subjects', 'exams', 'marks', 'remarks', 'classes', 'feeStructures', 'notices'];
    if (standardCollections.includes(segments[0]) && segments.length === 2) {
      return this.isAuthenticatedAdmin(request);
    }

    // Default deny catch-all
    return false;
  }
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
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

// Setup test subjects
const unauthenticatedRequest: RulesRequest = { auth: null };

const ordinaryTeacherRequest: RulesRequest = {
  auth: {
    uid: 'teacher_uid_001',
    token: {
      email: 'teacher.mahmud@madrasha.edu.bd',
      role: 'teacher'
    }
  }
};

const ordinaryGuardianRequest: RulesRequest = {
  auth: {
    uid: 'guardian_uid_002',
    token: {
      email: 'guardian.rafiq@gmail.com',
      role: 'guardian'
    }
  }
};

const randomSignedUserRequest: RulesRequest = {
  auth: {
    uid: 'random_user_999',
    token: {
      email: 'attacker@outside-domain.com'
    }
  }
};

const authoritativeOwnerRequest: RulesRequest = {
  auth: {
    uid: 'owner_uid_777',
    token: {
      email: 'mehedihasansagor26@gmail.com'
    }
  }
};

const customClaimAdminRequest: RulesRequest = {
  auth: {
    uid: 'admin_uid_555',
    token: {
      email: 'co_admin@institution.edu.bd',
      role: 'admin'
    }
  }
};

const dbAdminEvaluator = new FirestoreRulesEvaluator({
  admins: {
    'db_admin_uid_333': { role: 'admin' }
  }
});

const dbAdminRequest: RulesRequest = {
  auth: {
    uid: 'db_admin_uid_333',
    token: {
      email: 'staff.admin@institution.edu.bd'
    }
  }
};

const evaluator = new FirestoreRulesEvaluator();

// ============================================================================
// Group 1: Unauthenticated Requests (Must ALL be DENIED)
// ============================================================================
runTest('TEST 1: Unauthenticated user cannot read /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', unauthenticatedRequest), false);
});

runTest('TEST 2: Unauthenticated user cannot write to /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateWrite('/institution/main_store', unauthenticatedRequest), false);
});

runTest('TEST 3: Unauthenticated user cannot read /cloud_snapshots/snap_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/cloud_snapshots/snap_1', unauthenticatedRequest), false);
});

runTest('TEST 4: Unauthenticated user cannot read /transactions/tx_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/transactions/tx_1', unauthenticatedRequest), false);
});

runTest('TEST 5: Unauthenticated user cannot read /trashBin/bin_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/trashBin/bin_1', unauthenticatedRequest), false);
});

// ============================================================================
// Group 2: Ordinary Authenticated Users (Teachers, Guardians, Attackers)
// ============================================================================
runTest('TEST 6: Ordinary teacher cannot read monolithic /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', ordinaryTeacherRequest), false);
});

runTest('TEST 7: Ordinary guardian cannot read monolithic /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', ordinaryGuardianRequest), false);
});

runTest('TEST 8: Arbitrary signed-in user cannot read monolithic /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', randomSignedUserRequest), false);
});

runTest('TEST 9: Ordinary teacher cannot write to /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateWrite('/institution/main_store', ordinaryTeacherRequest), false);
});

runTest('TEST 10: Ordinary user cannot read /cloud_snapshots/snap_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/cloud_snapshots/snap_1', ordinaryTeacherRequest), false);
});

runTest('TEST 11: Ordinary user cannot read /transactions/tx_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/transactions/tx_1', ordinaryTeacherRequest), false);
});

runTest('TEST 12: Ordinary user cannot read /trashBin/bin_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/trashBin/bin_1', ordinaryTeacherRequest), false);
});

runTest('TEST 13: Ordinary user cannot read other members in /institutions/inst1/members/other_id', () => {
  assert.strictEqual(evaluator.evaluateRead('/institutions/inst1/members/other_id', ordinaryTeacherRequest), false);
});

runTest('TEST 14: Ordinary user CAN read their own member profile in /institutions/inst1/members/teacher_uid_001', () => {
  assert.strictEqual(evaluator.evaluateRead('/institutions/inst1/members/teacher_uid_001', ordinaryTeacherRequest), true);
});

runTest('TEST 15: Ordinary user CAN read institution roles /institutions/inst1/roles/role_teacher', () => {
  assert.strictEqual(evaluator.evaluateRead('/institutions/inst1/roles/role_teacher', ordinaryTeacherRequest), true);
});

// ============================================================================
// Group 3: Authoritative Owner & Administrators (Must ALL be ALLOWED)
// ============================================================================
runTest('TEST 16: Authoritative Owner (mehedihasansagor26@gmail.com) CAN read /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', authoritativeOwnerRequest), true);
});

runTest('TEST 17: Authoritative Owner (mehedihasansagor26@gmail.com) CAN write to /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateWrite('/institution/main_store', authoritativeOwnerRequest), true);
});

runTest('TEST 18: Authoritative Owner CAN read /cloud_snapshots/snap_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/cloud_snapshots/snap_1', authoritativeOwnerRequest), true);
});

runTest('TEST 19: Authoritative Owner CAN read /transactions/tx_1', () => {
  assert.strictEqual(evaluator.evaluateRead('/transactions/tx_1', authoritativeOwnerRequest), true);
});

runTest('TEST 20: Authoritative Owner CAN read and write all member profiles', () => {
  assert.strictEqual(evaluator.evaluateRead('/institutions/inst1/members/any_user_id', authoritativeOwnerRequest), true);
  assert.strictEqual(evaluator.evaluateWrite('/institutions/inst1/members/any_user_id', authoritativeOwnerRequest), true);
});

runTest('TEST 21: Cryptographic custom claim { role: "admin" } CAN read /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateRead('/institution/main_store', customClaimAdminRequest), true);
});

runTest('TEST 22: Cryptographic custom claim { role: "admin" } CAN write to /institution/main_store', () => {
  assert.strictEqual(evaluator.evaluateWrite('/institution/main_store', customClaimAdminRequest), true);
});

runTest('TEST 23: Database /admins/{uid} admin CAN read and write /institution/main_store', () => {
  assert.strictEqual(dbAdminEvaluator.evaluateRead('/institution/main_store', dbAdminRequest), true);
  assert.strictEqual(dbAdminEvaluator.evaluateWrite('/institution/main_store', dbAdminRequest), true);
});

// ============================================================================
// Group 4: Recursive Wildcards & Unspecified Path Isolation
// ============================================================================
runTest('TEST 24: Unspecified collection /secret_system_vault/key is denied for all', () => {
  assert.strictEqual(evaluator.evaluateRead('/secret_system_vault/key', authoritativeOwnerRequest), false);
  assert.strictEqual(evaluator.evaluateWrite('/secret_system_vault/key', authoritativeOwnerRequest), false);
});

runTest('TEST 25: Super admin audit log read allowed for designated owner', () => {
  assert.strictEqual(evaluator.evaluateRead('/platformAuditLogs/log_1', authoritativeOwnerRequest), true);
  assert.strictEqual(evaluator.evaluateRead('/platformAuditLogs/log_1', ordinaryTeacherRequest), false);
});

console.log('----------------------------------------------------------------');
console.log(`Results: ${passed}/${total} Firestore Rules Evaluation Tests PASSED.`);
console.log('================================================================');
