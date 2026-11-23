/**
 * Topbar profile menu — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:00): the topbar profile button does
 * nothing on click. In components/Layout.tsx the user-identity chip
 * (avatar initial + display name) is a plain <div> — no onClick, no
 * button — so nobody can tell at a glance whether they are signed in
 * as a teacher, admin or principal.
 *
 * Fix (smallest complete version): the chip becomes a button that
 * toggles a small dropdown panel under it showing ONLY the signed-in
 * user's own info — name, role (BIG teal badge, the point of the
 * job), staff code (when the person has a linked teacher record),
 * email, phone. Second click closes it; outside click closes it;
 * Escape closes it; navigating closes it. Info plus one action: the
 * logout button at the bottom of the panel (moved inside 23 Nov 2026
 * on Sagor's word — the topbar next to the chip holds no open logout
 * button any more). No settings links, no other action. No auth/login
 * change, no data change, no result/marksheet file touched.
 *
 * Reuse (house rule): the role label comes from the existing
 * roleLabelBn() in services/staffRole.ts (the same labels the staff
 * directory cards and filters already use: অধ্যক্ষ, শিক্ষক,
 * হিসাবরক্ষক, সুপার অ্যাডমিন, …) fed by the primaryRoleKey Layout
 * already computes; the staff-code lookup is a tiny pure helper in
 * services/staffCode.ts (same file as nextEmployeeCode); the
 * outside-click + Escape pattern is copied from
 * components/ui/RailFlyoutMenu.tsx.
 *
 * Run: npx tsx scripts/verify-topbar-profile-menu.ts
 *      (or npm run test:topbar-profile-menu).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleLabelBn } from '../services/staffRole';
// Dynamic import on purpose: before the fix this helper does not exist
// yet, and a static import would crash the whole script instead of
// reporting RED check by check.
let findLinkedEmployeeCode: any = null;
try {
  ({ findLinkedEmployeeCode } = await import('../services/staffCode'));
} catch { /* stays null until the fix lands */ }

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
const staffCode = readSource('services/staffCode.ts');

// --- Panel block slice (between the open-state render and its end marker) ---
// Tolerant on purpose: before the fix there is no panel, so the slice is
// empty and the panel checks fail one by one (RED) instead of throwing.
const panelStart = layout.indexOf('{isProfileMenuOpen && (');
const panelEndMarker = panelStart >= 0
  ? layout.indexOf('/* topbar-profile-menu: end */', panelStart)
  : -1;
const panel = panelStart >= 0 && panelEndMarker > panelStart
  ? layout.slice(panelStart, panelEndMarker)
  : '';

console.log('--- role labels (runtime) ---');
check('principal shows as অধ্যক্ষ', () => {
  assert.strictEqual(roleLabelBn('principal'), 'অধ্যক্ষ');
});
check('super_admin shows as সুপার অ্যাডমিন', () => {
  assert.strictEqual(roleLabelBn('super_admin'), 'সুপার অ্যাডমিন');
});
check('teacher shows as শিক্ষক', () => {
  assert.strictEqual(roleLabelBn('teacher'), 'শিক্ষক');
});
check('accountant shows as হিসাবরক্ষক', () => {
  assert.strictEqual(roleLabelBn('accountant'), 'হিসাবরক্ষক');
});
check('staff shows as অফিস স্টাফ', () => {
  assert.strictEqual(roleLabelBn('staff'), 'অফিস স্টাফ');
});
check('guardian shows as অভিভাবক', () => {
  assert.strictEqual(roleLabelBn('guardian'), 'অভিভাবক');
});
check('unknown role falls back to স্টাফ (house fallback, no invented label)', () => {
  assert.strictEqual(roleLabelBn('whatever'), 'স্টাফ');
  assert.strictEqual(roleLabelBn(null), 'স্টাফ');
});

console.log('--- staff-code lookup (runtime) ---');
const teachers = [
  { id: 'tch_1', userId: 'uid-1', email: 'principal@x.com', phone: '01700011112', employeeCode: 'MDR-T001' },
  { id: 'tch_2', email: 'mashiyatreaction@gmail.com', phone: '01799782357', employeeCode: 'MDR-T003' },
  { id: 'tch_3', email: 'nocode@x.com', phone: '01700000000' },
];
check('findLinkedEmployeeCode is exported (helper must exist)', () => {
  assert.strictEqual(typeof findLinkedEmployeeCode, 'function', 'services/staffCode.ts must export findLinkedEmployeeCode');
});
check('matches by userId first', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: 'uid-1', email: 'other@x.com', phone: '' }),
    'MDR-T001'
  );
});
check('matches by login-account id', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: 'tch_2', email: '', phone: '' }),
    'MDR-T003'
  );
});
check('matches by email', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: '', email: 'MASHIYATREACTION@GMAIL.COM', phone: '' }),
    'MDR-T003'
  );
});
check('matches by phone', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: '', email: '', phone: '01700011112' }),
    'MDR-T001'
  );
});
check('no match returns undefined (owner has no staff code)', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: 'uid-owner', email: 'mehedihasansagor26@gmail.com', phone: '' }),
    undefined
  );
});
check('a match without a code falls through to the next criterion', () => {
  assert.strictEqual(
    findLinkedEmployeeCode(teachers, { id: 'tch_3', email: 'mashiyatreaction@gmail.com', phone: '' }),
    'MDR-T003'
  );
});

console.log('--- Layout wiring (static) ---');
check('panel renders conditionally on the open state', () => {
  assert.ok(layout.includes('{isProfileMenuOpen && ('), 'Layout must render the panel when open');
  assert.ok(layout.includes('/* topbar-profile-menu: end */'), 'panel block must end with its marker');
});
check('identity chip is a button with a toggle handler (not a dead div)', () => {
  assert.ok(layout.includes('const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)'),
    'Layout must hold isProfileMenuOpen state');
  assert.ok(layout.includes('onClick={() => setIsProfileMenuOpen(v => !v)}'),
    'identity button must toggle the menu on click');
  assert.ok(layout.includes('aria-expanded={isProfileMenuOpen}'),
    'identity button must expose aria-expanded');
});
check('role badge uses the signed-in user\'s real role, not a hardcoded label', () => {
  assert.ok(layout.includes("import { roleLabelBn } from '../services/staffRole'"),
    'Layout must import the existing roleLabelBn');
  assert.ok(panel.includes('roleLabelBn(primaryRoleKey)'),
    'panel must render roleLabelBn(primaryRoleKey)');
});
check('panel shows name, email and phone of the signed-in user', () => {
  assert.ok(panel.includes('profileName'), 'panel must show the signed-in name');
  assert.ok(panel.includes('profileEmail'), 'panel must show the signed-in email');
  assert.ok(panel.includes('profilePhone'), 'panel must show the signed-in phone');
});
check('staff code comes from the linked teacher record (employeeCode)', () => {
  assert.ok(staffCode.includes('export function findLinkedEmployeeCode'),
    'services/staffCode.ts must export findLinkedEmployeeCode');
  assert.ok(layout.includes('findLinkedEmployeeCode('),
    'Layout must call findLinkedEmployeeCode for the signed-in person');
  assert.ok(panel.includes('profileStaffCode'), 'panel must show the linked staff code');
  assert.ok(panel.includes('স্টাফ কোড'), 'panel must label the staff code row');
});
check('panel shows phone as — when unrecorded (no invented figure)', () => {
  assert.ok(panel.includes("|| '—'") || panel.includes('|| "—"'),
    'missing phone must render as —');
});
check('second click closes: toggle, not set-true', () => {
  assert.ok(!layout.includes('onClick={() => setIsProfileMenuOpen(true)}'),
    'the button must toggle, never only open');
});
check('outside click closes the menu (RailFlyoutMenu pattern)', () => {
  assert.ok(layout.includes('profileMenuRef'), 'Layout must hold a ref on the menu wrapper');
  assert.ok(layout.includes("document.addEventListener('mousedown'"),
    'Layout must listen for outside mousedown');
  assert.ok(layout.includes('profileMenuRef.current?.contains(') || layout.includes('profileMenuRef.current.contains('),
    'outside handler must ignore taps inside the menu');
});
check('Escape closes the menu', () => {
  assert.ok(layout.includes("e.key === 'Escape'") && layout.includes('setIsProfileMenuOpen(false)'),
    'Escape must close the profile menu');
});
check('navigating to another tab closes the menu', () => {
  const tabEffect = layout.indexOf('}, [activeTab]);');
  assert.ok(tabEffect >= 0, 'Layout must have an activeTab effect');
  assert.ok(layout.slice(Math.max(0, tabEffect - 200), tabEffect).includes('setIsProfileMenuOpen(false)'),
    'the activeTab effect must close the profile menu');
});
check('panel holds only the logout action (no navigation, no settings link)', () => {
  assert.ok(panel.includes('logoutAdmin()'), 'panel must hold the logout button');
  assert.ok(!panel.includes('handleTabClick'), 'panel must not navigate anywhere');
  assert.ok(!panel.includes('setActiveTab'), 'panel must not change tabs');
  assert.ok(!panel.includes('settings'), 'panel must not link to settings');
});
check('panel reads only the signed-in person (no other-users list)', () => {
  assert.ok(!panel.includes('users.'), 'panel must not read the users list');
  assert.ok(!panel.includes('.map('), 'panel must not render a list of people');
});
check('the logout button lives inside the panel (no standalone topbar button)', () => {
  const logoutCount = (layout.match(/logoutAdmin/g) || []).length;
  assert.strictEqual(logoutCount, 2, `logoutAdmin must appear exactly twice (destructure + panel button), found ${logoutCount}`);
  assert.ok(panel.includes('logoutAdmin()'), 'the logout call must be inside the panel');
});
check('auth/login logic untouched', () => {
  assert.ok(!layout.includes('signInWithEmail'), 'Layout must not touch sign-in logic');
  assert.ok(layout.includes('logoutAdmin()'), 'existing logout call must stay');
});
check('no result/marksheet file touched by this job', () => {
  const protectedFiles = ['components/BlankMarksheetView.tsx', 'components/WebResultView.tsx', 'components/ClassResultView.tsx'];
  for (const f of protectedFiles) {
    assert.ok(!readSource(f).includes('isProfileMenuOpen'), `${f} must be untouched`);
  }
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:topbar-profile-menu'], 'tsx scripts/verify-topbar-profile-menu.ts',
    'npm run test:topbar-profile-menu must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: topbar-profile-menu self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
