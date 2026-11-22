/**
 * Remove dead phone/email login — self-check (22 Nov 2026).
 *
 * Problem: context/AppContext.tsx still carries loginWithEmailOrPhone,
 * a second login path with the SAME any-password hole L1 closed in
 * signInWithEmail: `if (user.password && user.password !== cleanPass)`
 * only fires when a password is stored, and Staff Hub members have
 * none stored — so a real email/phone + WRONG password logged in via
 * a local session. Unlike signInWithEmail it has NO caller anywhere
 * (verified by repo-wide grep on main ce28105): no UI, no portal, no
 * mobile app calls it. A guard on dead code would keep the risk
 * alive; the function goes entirely, like L2's dead auth code:
 *   the definition, its context interface entry, its provider
 *   export, and the two comments that name it.
 *
 * Static checks (repo's established verify-script pattern) + tsc +
 * build. Live behaviour is unchanged for every real login path.
 *
 * Run: npx tsx scripts/verify-login-remove-dead-emailorphone.ts
 *      (or npm run test:login-remove-dead-emailorphone).
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

/** All .ts/.tsx code files under a dir, recursively. */
function codeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...codeFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const rawAppContext = readSource('context/AppContext.tsx');
const appContext = stripComments(rawAppContext);

console.log('--- loginWithEmailOrPhone is gone from AppContext ---');
check('loginWithEmailOrPhone has no code reference left in context/AppContext.tsx', () => {
  assert.ok(!appContext.includes('loginWithEmailOrPhone'), 'loginWithEmailOrPhone still appears in context/AppContext.tsx');
});
check('no stale comment still names loginWithEmailOrPhone', () => {
  assert.ok(!rawAppContext.includes('loginWithEmailOrPhone'), 'a comment still names loginWithEmailOrPhone');
});
check('the any-password hole pattern is gone from AppContext', () => {
  assert.ok(!appContext.includes('user.password && user.password !== cleanPass'),
    'the skip-when-passwordless check (user.password && user.password !== cleanPass) still present');
});
check('no other code file references loginWithEmailOrPhone', () => {
  const hits: string[] = [];
  for (const dir of ['context', 'components', 'services', 'scripts', 'api', 'server']) {
    if (!fs.existsSync(path.join(repoRoot, dir))) continue;
    for (const f of codeFiles(dir)) {
      if (f === 'context/AppContext.tsx') continue;
      if (f === 'scripts/verify-login-remove-dead-emailorphone.ts') continue; // this script names it in its own checks
      if (stripComments(readSource(f)).includes('loginWithEmailOrPhone')) hits.push(f);
    }
  }
  assert.deepStrictEqual(hits, [], `callers remain: ${hits.join(', ')}`);
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
check('logoutUser still exists (it followed the deleted function)', () => {
  assert.ok(appContext.includes('const logoutUser = async'), 'logoutUser must stay');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:login-remove-dead-emailorphone'], 'tsx scripts/verify-login-remove-dead-emailorphone.ts',
    'npm run test:login-remove-dead-emailorphone must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: remove-dead-emailorphone self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
