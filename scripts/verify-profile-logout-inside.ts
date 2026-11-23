/**
 * Profile panel logout — self-check (23 Nov 2026).
 *
 * Problem (Sagor, 23 Nov 2026, voice call): the profile button shows
 * his info (email, designation) when pressed, but the logout button
 * sits open right next to the profile button in the topbar. He wants
 * the logout button NOT left open there — bring it INSIDE the profile
 * panel.
 *
 * Fix (smallest complete version): the standalone rose logout button
 * next to the identity chip in components/Layout.tsx is deleted, and
 * a full-width "লগ আউট" button is added at the bottom of the profile
 * panel (separated from the info by a divider). It calls the SAME
 * existing logoutAdmin() handler — no new auth logic, no change to
 * what logout does. The panel's info display (role badge, name, staff
 * code, email, phone) stays exactly as it is. No settings link, no
 * other new action.
 *
 * Scope note: the topbar is one shared header (desktop + mobile).
 * The logout buttons elsewhere are NOT topbar buttons and stay:
 * StaffMobileApp's full-width page-bottom "লগআউট / একাউন্ট পরিবর্তন"
 * buttons, the MobileMoreSheet menu logout, AdminAuthModal's switch-
 * account logout, CloudSyncWidget's Diagnostics logout, and the
 * guardian/student portal logouts.
 *
 * Run: npx tsx scripts/verify-profile-logout-inside.ts
 *      (or npm run test:profile-logout-inside).
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

const layout = readSource('components/Layout.tsx');
const staffMobile = readSource('components/StaffMobileApp.tsx');

// --- Panel block slice (between the open-state render and its end marker) ---
const panelStart = layout.indexOf('{isProfileMenuOpen && (');
const panelEndMarker = panelStart >= 0
  ? layout.indexOf('/* topbar-profile-menu: end */', panelStart)
  : -1;
const panel = panelStart >= 0 && panelEndMarker > panelStart
  ? layout.slice(panelStart, panelEndMarker)
  : '';

// --- Topbar slice: the header row that holds the identity chip. The
// standalone logout button used to sit right after the profile wrapper
// div (after the /* topbar-profile-menu: end */ marker) and before
// </header>. Anything calling logoutAdmin in that stretch is a
// standalone topbar logout.
const headerEnd = layout.indexOf('</header>');
const topbarAfterPanel = panelEndMarker >= 0 && headerEnd > panelEndMarker
  ? layout.slice(panelEndMarker, headerEnd)
  : '';

console.log('--- logout placement (static) ---');
check('no standalone logout button next to the profile chip in the topbar', () => {
  assert.ok(!topbarAfterPanel.includes('logoutAdmin'),
    'no logoutAdmin call may sit in the topbar outside the panel');
  assert.ok(!layout.includes("title={language === 'bn' ? 'লগআউট' : 'Logout'}"),
    'the standalone logout button (title লগআউট) must be gone');
});
check('a logout button lives inside the profile panel', () => {
  assert.ok(panel.includes('logoutAdmin()'), 'panel must call logoutAdmin()');
  assert.ok(panel.includes('লগ আউট'), 'panel button must be labelled লগ আউট');
  assert.ok(panel.includes('<LogOut'), 'panel button must show the logout icon');
});
check('panel logout is at the bottom, separated from the info rows', () => {
  const logoutAt = panel.indexOf('logoutAdmin()');
  const emailAt = panel.indexOf('profileEmail');
  assert.ok(logoutAt > emailAt, 'logout must come after the info rows');
  const beforeLogout = panel.slice(0, logoutAt);
  assert.ok(beforeLogout.includes('border-t'), 'a divider must separate the logout button from the info');
});
check('panel logout calls the existing handler (no new auth logic)', () => {
  assert.ok(layout.includes('logoutAdmin'), 'Layout must still use logoutAdmin from useApp()');
  assert.ok(!layout.includes('signOut('), 'Layout must not call Firebase signOut directly');
  assert.ok(!layout.includes('signInWithEmail'), 'Layout must not touch sign-in logic');
});
check('panel still shows name, role and email as before', () => {
  assert.ok(panel.includes('roleLabelBn(primaryRoleKey)'), 'panel must still show the role badge');
  assert.ok(panel.includes('profileName'), 'panel must still show the signed-in name');
  assert.ok(panel.includes('profileEmail'), 'panel must still show the signed-in email');
  assert.ok(panel.includes('profilePhone'), 'panel must still show the phone');
  assert.ok(panel.includes('profileStaffCode'), 'panel must still show the staff code');
});
check('logoutAdmin is called from exactly one place in Layout (the panel)', () => {
  const count = (layout.match(/logoutAdmin/g) || []).length;
  assert.strictEqual(count, 2, `logoutAdmin must appear exactly twice (destructure + panel button), found ${count}`);
});
check('mobile: the shared topbar has no orphan logout, StaffMobileApp untouched', () => {
  assert.ok(!topbarAfterPanel.includes('logoutAdmin'),
    'mobile uses the same shared header — no logout outside the panel');
  const mobileLogoutCount = (staffMobile.match(/onLogout \? onLogout\(\) : logoutAdmin\(\)/g) || []).length;
  assert.strictEqual(mobileLogoutCount, 2,
    `StaffMobileApp keeps its 2 page-bottom logout buttons, found ${mobileLogoutCount}`);
});
check('no other new action inside the panel (no settings link, no navigation)', () => {
  assert.ok(!panel.includes('handleTabClick'), 'panel must not navigate anywhere');
  assert.ok(!panel.includes('setActiveTab'), 'panel must not change tabs');
  assert.ok(!panel.includes('settings'), 'panel must not link to settings');
});
check('no result/marksheet file touched by this job', () => {
  const protectedFiles = ['components/BlankMarksheetView.tsx', 'components/WebResultView.tsx', 'components/ClassResultView.tsx'];
  for (const f of protectedFiles) {
    assert.ok(!readSource(f).includes('isProfileMenuOpen'), `${f} must be untouched`);
  }
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:profile-logout-inside'], 'tsx scripts/verify-profile-logout-inside.ts',
    'npm run test:profile-logout-inside must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: profile-logout-inside self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
