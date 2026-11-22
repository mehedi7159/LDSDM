/**
 * Real guardian PIN login — self-check (22 Nov 2026).
 *
 * Problem (L7): the guardian PIN was display-only — the portal
 * showed the last 4 digits of the student ID and the "পিন পাঠান"
 * button only showed a toast; nothing was ever sent or checked.
 * Guardians without email had no real way in.
 *
 * Fix (v1, smallest complete version): Student ID + 4-digit PIN.
 * The PIN is a per-student field (admin sets it in Student Manager;
 * blank = default last 4 of the student ID, exactly what the portal
 * already displayed). A correct PIN opens a guardian session scoped
 * to THAT student only (results, dues, attendance for that child).
 * 5 wrong tries lock that student ID for 15 minutes (client-side
 * counter + timestamp). The email/password guardian login is
 * untouched as the alternative path.
 *
 * HONEST LIMIT (do not hide): the public portal ALREADY shows
 * results/fees by student ID with NO login (by design, Sagor's
 * decision), so this PIN is ease + light gating, not hiding data
 * the portal already shows. Its real value is a simple personal
 * entry for guardians without email.
 *
 * Behavioural checks (the service is pure + storage-fallback safe,
 * so it runs in node) + static wiring checks (repo pattern) + tsc +
 * build. Live phone test with a TEST student is still needed.
 *
 * Run: npx tsx scripts/verify-guardian-pin-login.ts
 *      (or npm run test:guardian-pin-login).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getStudentPin,
  verifyGuardianPin,
  readGuardianPinSession,
  clearGuardianPinSession,
  clearGuardianPinAttempts,
  GUARDIAN_PIN_MAX_FAILS,
  GUARDIAN_PIN_LOCK_MS
} from '../services/guardianPin';
import type { Student } from '../types/student';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

const makeStudent = (over: Partial<Student> & { id: string; studentId: string }): Student => ({
  name: 'Test Student',
  classLevel: 'Class 6',
  status: 'Active',
  ...over
} as Student);

const students: Student[] = [
  makeStudent({ id: 'stu-1', studentId: '2026001' }), // default PIN 0001
  makeStudent({ id: 'stu-2', studentId: '2026002', guardianPin: '4321' }) // custom PIN
];

console.log('--- PIN rules ---');
check('default PIN is the last 4 digits of the student ID', () => {
  assert.strictEqual(getStudentPin(students[0]), '6001');
});
check('a stored custom PIN wins over the default', () => {
  assert.strictEqual(getStudentPin(students[1]), '4321');
});
check('a student with no studentId falls back to 7890 (as the old display did)', () => {
  assert.strictEqual(getStudentPin(makeStudent({ id: 'stu-x', studentId: '' })), '7890');
});

console.log('--- PIN check behaviour ---');
check('correct PIN opens the session for that student only', () => {
  clearGuardianPinSession();
  const r = verifyGuardianPin('2026001', '6001', students);
  assert.strictEqual(r.success, true, r.message);
  assert.strictEqual(r.student?.id, 'stu-1');
  assert.strictEqual(readGuardianPinSession()?.studentId, 'stu-1');
  clearGuardianPinSession();
});
check('correct custom PIN works too', () => {
  clearGuardianPinSession();
  const r = verifyGuardianPin('2026002', '4321', students);
  assert.strictEqual(r.success, true, r.message);
  assert.strictEqual(readGuardianPinSession()?.studentId, 'stu-2');
  clearGuardianPinSession();
});
check('wrong PIN is denied and does not open a session', () => {
  clearGuardianPinSession();
  clearGuardianPinAttempts('2026001');
  const r = verifyGuardianPin('2026001', '9999', students);
  assert.strictEqual(r.success, false);
  assert.strictEqual(readGuardianPinSession(), null);
});
check("another student's PIN does not open this student", () => {
  clearGuardianPinSession();
  clearGuardianPinAttempts('2026001');
  const r = verifyGuardianPin('2026001', '4321', students);
  assert.strictEqual(r.success, false);
  assert.strictEqual(readGuardianPinSession(), null);
});
check('unknown student ID is denied with a generic message (no leak)', () => {
  const r = verifyGuardianPin('9999999', '6001', students);
  assert.strictEqual(r.success, false);
  assert.ok(!r.message.includes('9999999'), 'message must not echo the unknown ID');
});
check('empty or short PIN is denied', () => {
  clearGuardianPinAttempts('2026001');
  assert.strictEqual(verifyGuardianPin('2026001', '', students).success, false);
  assert.strictEqual(verifyGuardianPin('2026001', '00', students).success, false);
});

console.log('--- Lockout after 5 wrong tries ---');
check('5 wrong tries lock the student ID for 15 minutes', () => {
  clearGuardianPinSession();
  clearGuardianPinAttempts('2026001');
  for (let i = 0; i < GUARDIAN_PIN_MAX_FAILS; i++) {
    assert.strictEqual(verifyGuardianPin('2026001', '9999', students).success, false);
  }
  const locked = verifyGuardianPin('2026001', '6001', students);
  assert.strictEqual(locked.success, false, 'even the RIGHT pin must fail while locked');
  assert.ok(locked.lockedUntil && locked.lockedUntil - Date.now() > 14 * 60 * 1000, 'lock must last ~15 minutes');
  assert.ok(locked.lockedUntil - Date.now() <= GUARDIAN_PIN_LOCK_MS, 'lock must not exceed 15 minutes');
  assert.ok(/১৫/.test(locked.message), 'lock message must say 15 minutes');
  clearGuardianPinAttempts('2026001');
});
check('lockout is per student ID — another student still works', () => {
  clearGuardianPinSession();
  clearGuardianPinAttempts('2026001');
  for (let i = 0; i < GUARDIAN_PIN_MAX_FAILS; i++) verifyGuardianPin('2026001', '9999', students);
  const r = verifyGuardianPin('2026002', '4321', students);
  assert.strictEqual(r.success, true, r.message);
  clearGuardianPinSession();
  clearGuardianPinAttempts('2026001');
});
check('logout clears the PIN session', () => {
  verifyGuardianPin('2026001', '6001', students);
  assert.strictEqual(readGuardianPinSession()?.studentId, 'stu-1');
  clearGuardianPinSession();
  assert.strictEqual(readGuardianPinSession(), null);
});

console.log('--- Wiring: the PIN session reaches the portal, scoped to one child ---');
const appContext = readSource('context/AppContext.tsx');
const appTsx = readSource('App.tsx');
const portal = readSource('components/GuardianPortal.tsx');
const mobile = readSource('components/StaffMobileApp.tsx');
const authPage = readSource('components/AuthPage.tsx');
const manager = readSource('components/portals/PortalsServicesManager.tsx');
const studentType = readSource('types/student.ts');
const studentManager = readSource('components/StudentManager.tsx');

check('AppContext exposes the PIN session (login + state)', () => {
  assert.ok(appContext.includes('loginWithGuardianPin'), 'AppContext must expose loginWithGuardianPin');
  assert.ok(appContext.includes('pinGuardianStudentId'), 'AppContext must expose pinGuardianStudentId');
});
check('App.tsx treats a PIN session as an authenticated guardian session', () => {
  assert.ok(appTsx.includes('pinGuardianStudentId'), 'App.tsx must read pinGuardianStudentId');
});
check('GuardianPortal scopes to the PIN student when a PIN session exists', () => {
  assert.ok(portal.includes('pinGuardianStudentId'), 'GuardianPortal must scope children to the PIN student');
});
check('StaffMobileApp shows the parent home for a PIN session', () => {
  assert.ok(mobile.includes('pinGuardianStudentId'), 'StaffMobileApp must recognise the PIN session');
});
check('AuthPage has the PIN login form', () => {
  assert.ok(authPage.includes('loginWithGuardianPin'), 'AuthPage must call loginWithGuardianPin');
});
check('the fake "পিন পাঠান" button is gone', () => {
  assert.ok(!manager.includes('পিন পাঠান'), 'PortalsServicesManager must not show the fake send-PIN button');
});
check('the manager shows the real PIN (stored or default)', () => {
  assert.ok(manager.includes('getStudentPin'), 'PortalsServicesManager must display getStudentPin(student)');
});
check('Student type carries the PIN field', () => {
  assert.ok(studentType.includes('guardianPin'), 'Student must have a guardianPin field');
});
check('Student Manager lets the admin set the PIN', () => {
  assert.ok(studentManager.includes('guardianPin'), 'StudentManager form must include guardianPin');
});
check('email/password guardian login is untouched', () => {
  assert.ok(appContext.includes('const signInWithEmail = async'), 'signInWithEmail must stay');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:guardian-pin-login'], 'tsx scripts/verify-guardian-pin-login.ts',
    'npm run test:guardian-pin-login must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: guardian-pin-login self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
