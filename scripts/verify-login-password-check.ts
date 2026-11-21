/**
 * Login password check — self-check (22 Nov 2026).
 *
 * Problem (verified in code on main 105f70c, AppContext.tsx:5850/:5957):
 * signInWithEmail steps 2 and 3 checked the password only when a
 * stored password existed —
 *   if (member.password && member.password !== password) → deny
 * Staff Hub members have NO stored password (addTeacher/updateTeacher
 * write it only to Firebase Auth, never to the record), so the check
 * was skipped entirely: a real email + WRONG password still minted a
 * local session after Firebase Auth failed. Firebase is the only
 * password check — a password-less record must be denied outright.
 *
 * Fix (one line per step): deny when there is no stored password OR
 * it does not match —
 *   if (!member.password || member.password !== password) → deny
 *   if (!foundUser.password || foundUser.password !== password) → deny
 * Everything else stays: Google-only accounts are denied first,
 * pending/blocked gates still run, the Firebase success path still
 * mints a session, and self-heal still requires a stored password
 * that actually matched (no password is ever re-stored in a record).
 *
 * This script is static (the repo's established verify-script
 * pattern): signInWithEmail lives inside a 7,000-line React context
 * and cannot run standalone. It proves the guard structure by
 * RED→GREEN: on the old code the new-guard checks fail; after the
 * fix they pass. Live behaviour (wrong password denied on the phone)
 * is a morning-audit check, not covered here.
 *
 * Run: npx tsx scripts/verify-login-password-check.ts
 *      (or npm run test:login-password-check).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const fileExists = (rel: string) => fs.existsSync(path.join(repoRoot, rel));

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

/** Strip line + block comments so doc mentions don't count. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

const WRONG_PASSWORD_MSG = 'ভুল পাসওয়ার্ড প্রদান করা হয়েছে।';

const appContext = readSource('context/AppContext.tsx');
const fnStart = appContext.indexOf('const signInWithEmail = async');
assert.ok(fnStart >= 0, 'signInWithEmail must exist in context/AppContext.tsx');
const fnEnd = appContext.indexOf('const signUpWithEmail = async', fnStart);
assert.ok(fnEnd > fnStart, 'signUpWithEmail must follow signInWithEmail');
const rawSignIn = appContext.slice(fnStart, fnEnd);

// Step boundaries are line comments — find them BEFORE stripping.
const step2Start = rawSignIn.indexOf('// 2. Check Database');
const step3Start = rawSignIn.indexOf('// 3. Check App Users');
assert.ok(step2Start >= 0 && step3Start > step2Start, 'steps 2 and 3 must exist in signInWithEmail');
const step1 = stripComments(rawSignIn.slice(0, step2Start));
const step2 = stripComments(rawSignIn.slice(step2Start, step3Start));
const step3 = stripComments(rawSignIn.slice(step3Start));
const signIn = stripComments(rawSignIn);

console.log('--- Step 2 (member records): password-less must be denied ---');
check('step 2: old skip pattern is gone (no "member.password && ... !== password" guard)', () => {
  assert.ok(!step2.includes('if (member.password && member.password !== password)'),
    'old guard still skips password-less members');
});
check('step 2: deny when there is no stored password or it does not match', () => {
  assert.ok(step2.includes('if (!member.password || member.password !== password)'),
    'must deny with if (!member.password || member.password !== password)');
  assert.ok(step2.includes(`error: '${WRONG_PASSWORD_MSG}'`),
    'deny must use the existing wrong-password message');
});
check('step 2: Google-only accounts are still denied before the password guard', () => {
  const googleDeny = step2.indexOf('GOOGLE_PASSWORD_LOGIN_DENIED');
  const guard = step2.indexOf('if (!member.password || member.password !== password)');
  assert.ok(googleDeny >= 0, 'Google-only deny must stay in step 2');
  assert.ok(guard > googleDeny, 'Google-only deny must come before the password guard');
});
check('step 2: pending gate still runs after the password guard', () => {
  const guard = step2.indexOf('if (!member.password || member.password !== password)');
  const gate = step2.indexOf('signInGateForStatus(member.status)');
  assert.ok(gate > guard, 'pending gate must still run after the password guard');
});
check('step 2: self-heal still requires a stored password (no unconditional heal)', () => {
  assert.ok(step2.includes('member.password &&'), 'self-heal must still require member.password');
});

console.log('--- Step 3 (users / teachers): password-less must be denied ---');
check('step 3: old skip pattern is gone (no "foundUser.password && ... !== password" guard)', () => {
  assert.ok(!step3.includes('if (foundUser.password && foundUser.password !== password)'),
    'old guard still skips password-less users');
});
check('step 3: deny when there is no stored password or it does not match', () => {
  assert.ok(step3.includes('if (!foundUser.password || foundUser.password !== password)'),
    'must deny with if (!foundUser.password || foundUser.password !== password)');
  assert.ok(step3.includes(`error: '${WRONG_PASSWORD_MSG}'`),
    'deny must use the existing wrong-password message');
});
check('step 3: Google-only accounts are still denied before the password guard', () => {
  const googleDeny = step3.indexOf('GOOGLE_PASSWORD_LOGIN_DENIED');
  const guard = step3.indexOf('if (!foundUser.password || foundUser.password !== password)');
  assert.ok(googleDeny >= 0, 'Google-only deny must stay in step 3');
  assert.ok(guard > googleDeny, 'Google-only deny must come before the password guard');
});
check('step 3: pending + blocked gates still run after the password guard', () => {
  const guard = step3.indexOf('if (!foundUser.password || foundUser.password !== password)');
  assert.ok(step3.indexOf('signInGateForStatus(foundUser.status)') > guard,
    'pending gate must still run after the password guard');
  assert.ok(step3.indexOf("foundUser.status === 'blocked'") > guard,
    'blocked check must still run after the password guard');
});
check('step 3: self-heal still requires a stored password (no unconditional heal)', () => {
  assert.ok(step3.includes('foundUser.password &&'), 'self-heal must still require foundUser.password');
});
check('step 3: no password is stored in the session member record', () => {
  const recStart = step3.indexOf('const memberRecord: InstitutionMember = {');
  assert.ok(recStart >= 0, 'memberRecord must exist in step 3');
  const rec = step3.slice(recStart, step3.indexOf('};', recStart));
  assert.ok(!rec.includes('password'), 'memberRecord must never carry a password field');
});

console.log('--- Untouched behaviour ---');
check('step 1: Firebase success still mints a session (correct password → allowed)', () => {
  assert.ok(step1.includes("localStorage.setItem('madrasha_active_auth_session'"),
    'Firebase success path must still mint a session');
  assert.ok(step1.includes('signInWithEmailAndPassword(auth, trimmedEmail, password)'),
    'step 1 must still try Firebase Auth first');
});
check('owner Firebase-failure early return still present', () => {
  assert.ok(step1.includes('if (isOwnerAccount)'), 'owner early return must stay');
  assert.ok(step1.includes('auth/user-not-found'), 'owner user-not-found message must stay');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:login-password-check'], 'tsx scripts/verify-login-password-check.ts',
    'npm run test:login-password-check must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: login password check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
