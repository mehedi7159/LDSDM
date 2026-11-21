/**
 * Remove dead auth code — self-check (22 Nov 2026).
 *
 * Problem: four auth functions live in context/AppContext.tsx with no
 * callers (verified by repo-wide grep on main 105f70c) — public
 * sign-up UI was removed 31 Oct 2026 and the demo-login button is
 * gone, but the functions still exist and can be re-wired by
 * accident. The worst of them, signUpUser, creates a status 'active'
 * account with NO password at all; signUpWithEmail writes a
 * PLAINTEXT password into the member doc and hands out a local
 * session. Dead auth code is a live risk, so it goes:
 *   signUpUser, signUpWithEmail, signUpWithGoogle, loginAsDemoRole
 * plus their context interface entries and provider exports.
 *
 * services/googleSignupRules.ts is trimmed to what live code still
 * uses: GOOGLE_PASSWORD_LOGIN_DENIED (signInWithEmail + the portal
 * login deny paths), isGoogleOnlyAccount (approval + login gates)
 * and approvalPasswordFor (Step-1 guard, tested by
 * scripts/verify-step1-password-removal.ts). The signup-only
 * helpers (buildGoogleSignupMember, GOOGLE_SIGNUP_EXISTING_MEMBER,
 * mapRequestedRoleToRoleId, googlePopupErrorMessage) go with the
 * sign-up functions, and the stale comment claiming
 * scripts/verify-google-signup.ts exists is fixed (no such file).
 *
 * Static checks (repo's established verify-script pattern) + tsc +
 * build. Live behaviour is unchanged for every real login path.
 *
 * Run: npx tsx scripts/verify-login-remove-dead-auth-code.ts
 *      (or npm run test:login-remove-dead-auth-code).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Strip line + block comments so doc mentions don't count. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

const appContext = stripComments(readSource('context/AppContext.tsx'));
const rules = readSource('services/googleSignupRules.ts');

console.log('--- Dead auth functions are gone from AppContext ---');
for (const name of ['signUpUser', 'signUpWithEmail', 'signUpWithGoogle', 'loginAsDemoRole']) {
  check(`${name} has no code reference left in context/AppContext.tsx`, () => {
    assert.ok(!appContext.includes(name), `${name} still appears in context/AppContext.tsx`);
  });
}
check('no demo-role config survives (demoConfigs was loginAsDemoRole-only)', () => {
  assert.ok(!appContext.includes('demoConfigs'), 'demoConfigs still appears in context/AppContext.tsx');
});
check('no plaintext-password write survives in a sign-up path', () => {
  assert.ok(!readSource('context/AppContext.tsx').includes('securely stored for login validation'),
    'plaintext password write (memberData.password) still present');
});

console.log('--- googleSignupRules.ts is trimmed to live use ---');
for (const name of ['buildGoogleSignupMember', 'GOOGLE_SIGNUP_EXISTING_MEMBER', 'mapRequestedRoleToRoleId', 'googlePopupErrorMessage']) {
  check(`${name} is gone from services/googleSignupRules.ts`, () => {
    assert.ok(!rules.includes(name), `${name} still appears in services/googleSignupRules.ts`);
  });
}
check('kept: GOOGLE_PASSWORD_LOGIN_DENIED (live login deny paths use it)', () => {
  assert.ok(rules.includes('export const GOOGLE_PASSWORD_LOGIN_DENIED'), 'GOOGLE_PASSWORD_LOGIN_DENIED must stay exported');
  assert.ok(appContext.includes('GOOGLE_PASSWORD_LOGIN_DENIED'), 'AppContext must still use GOOGLE_PASSWORD_LOGIN_DENIED');
});
check('kept: isGoogleOnlyAccount (approval + login gates use it)', () => {
  assert.ok(rules.includes('export function isGoogleOnlyAccount'), 'isGoogleOnlyAccount must stay exported');
  assert.ok(appContext.includes('isGoogleOnlyAccount('), 'AppContext must still call isGoogleOnlyAccount');
});
check('kept: approvalPasswordFor (Step-1 guard, tested by verify-step1-password-removal)', () => {
  assert.ok(rules.includes('export function approvalPasswordFor'), 'approvalPasswordFor must stay exported');
});
check('stale comment fixed: no claim that scripts/verify-google-signup.ts exists', () => {
  assert.ok(!rules.includes('verify-google-signup'), 'googleSignupRules must not claim verify-google-signup.ts exists');
});
check('stale comment fixed: no claim that AppContext imports the rules for signUpWithGoogle', () => {
  assert.ok(!rules.includes('signUpWithGoogle'), 'googleSignupRules must not mention signUpWithGoogle');
});

console.log('--- Live login paths are untouched ---');
check('signInWithEmail still exists (the L1-fixed login path)', () => {
  assert.ok(appContext.includes('const signInWithEmail = async'), 'signInWithEmail must stay');
});
check('loginWithGoogle still exists', () => {
  assert.ok(appContext.includes('const loginWithGoogle = async'), 'loginWithGoogle must stay');
});
check('resetPassword still exists', () => {
  assert.ok(appContext.includes('const resetPassword = async'), 'resetPassword must stay');
});
check('approveMember still exists', () => {
  assert.ok(appContext.includes('const approveMember = async'), 'approveMember must stay');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:login-remove-dead-auth-code'], 'tsx scripts/verify-login-remove-dead-auth-code.ts',
    'npm run test:login-remove-dead-auth-code must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: remove-dead-auth-code self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
