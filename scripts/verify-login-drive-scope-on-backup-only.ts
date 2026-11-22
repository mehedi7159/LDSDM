/**
 * Drive scope only at backup time — self-check (22 Nov 2026).
 *
 * Problem (#20): services/firebase.ts adds Google Drive scopes
 * (drive.file + drive.appdata) to the shared googleProvider at
 * module load, so EVERY Google sign-in asks for Drive permission —
 * even for a teacher/guardian who never backs anything up.
 *
 * Fix: login uses a scope-free googleProvider. A separate
 * driveGoogleProvider carries the Drive scopes and is used ONLY by
 * the Drive backup flow (services/googleDriveBackupService.ts
 * ensureGoogleDriveToken). The in-memory token cache records
 * whether the cached token is Drive-scoped, so the background
 * auto-backup never tries a scope-free login token (Drive would
 * 403) and never pops up without a user gesture — it skips until
 * the admin taps "Google Drive ব্যাকআপ চালু করুন" in the Backup
 * Center, which is the one user-initiated Drive permission grant.
 *
 * Static checks (repo's established verify-script pattern) + tsc +
 * build. Live behaviour: Google login asks for no Drive
 * permission; Drive backup works after the one-time connect tap.
 *
 * Run: npx tsx scripts/verify-login-drive-scope-on-backup-only.ts
 *      (or npm run test:login-drive-scope-on-backup-only).
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

const firebase = readSource('services/firebase.ts');
const driveService = readSource('services/googleDriveBackupService.ts');
const appContext = readSource('context/AppContext.tsx');
const backupCenter = readSource('components/DataSecurityBackupCenter.tsx');

console.log('--- Login never asks for Drive permission ---');
check('googleProvider has no Drive scope at module load', () => {
  assert.ok(!firebase.includes('googleProvider.addScope'), 'googleProvider.addScope still present — login still asks for Drive');
});
check('a separate driveGoogleProvider carries the Drive scopes', () => {
  assert.ok(firebase.includes('export const driveGoogleProvider'), 'driveGoogleProvider must be exported from services/firebase.ts');
  assert.ok(firebase.includes("driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file')"), 'driveGoogleProvider must request drive.file');
  assert.ok(firebase.includes("driveGoogleProvider.addScope('https://www.googleapis.com/auth/drive.appdata')"), 'driveGoogleProvider must request drive.appdata');
});
check('loginWithGoogle still uses the scope-free googleProvider', () => {
  assert.ok(appContext.includes('signInWithPopup(auth, googleProvider)'), 'loginWithGoogle must still use googleProvider');
});

console.log('--- Drive token is only obtained at backup time ---');
check('ensureGoogleDriveToken pops up with driveGoogleProvider', () => {
  assert.ok(driveService.includes('signInWithPopup(auth, driveGoogleProvider)'), 'ensureGoogleDriveToken must pop up with driveGoogleProvider');
  assert.ok(!driveService.includes('signInWithPopup(auth, googleProvider)'), 'ensureGoogleDriveToken must NOT use the login provider');
});
check('the token cache records whether the token is Drive-scoped', () => {
  assert.ok(firebase.includes('isCachedGoogleAccessTokenDrive'), 'firebase.ts must export isCachedGoogleAccessTokenDrive');
  assert.ok(firebase.includes('cachedGoogleAccessTokenHasDrive') || firebase.includes('HasDrive'), 'firebase.ts must track Drive provenance of the cached token');
});
check('the background auto-backup skips when no Drive token exists', () => {
  assert.ok(appContext.includes('isCachedGoogleAccessTokenDrive'), 'AppContext auto-backup must gate on the Drive-scoped token');
});
check('the Backup Center has a user-initiated Drive connect action', () => {
  assert.ok(backupCenter.includes('ensureGoogleDriveToken'), 'DataSecurityBackupCenter must call ensureGoogleDriveToken from a user tap');
});

console.log('--- Drive backup still works after connecting ---');
check('uploadBackupToGoogleDrive still routes through ensureGoogleDriveToken', () => {
  assert.ok(driveService.includes('await ensureGoogleDriveToken()'), 'uploadBackupToGoogleDrive must still obtain its token via ensureGoogleDriveToken');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:login-drive-scope-on-backup-only'], 'tsx scripts/verify-login-drive-scope-on-backup-only.ts',
    'npm run test:login-drive-scope-on-backup-only must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: drive-scope-on-backup-only self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
