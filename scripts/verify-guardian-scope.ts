/**
 * verify-guardian-scope.ts — scripted proof for the guardian scoping
 * (guardians see ONLY their own child(ren)).
 *
 * Part 1 runs the REAL linkage (services/guardianScope.ts) over
 * fixture students/accounts:
 *   (a) an account linked by studentId resolves exactly that child;
 *   (b) a guardian-phone link resolves both children of the family,
 *       across the local (017…) and international (+88017…) formats;
 *   (b2) a guardian-email link resolves the matching child;
 *   (c) an unlinked guardian resolves the EMPTY set;
 *   (d) session-shape helpers: guardian-only vs multi-role vs
 *       non-guardian.
 * Part 2 asserts the code paths that consume the linkage:
 *   - GuardianPortal has no `students[0]` fallback, no fabricated
 *     attendance figures, and renders the no-link state copy;
 *   - App.tsx routes guardian sessions to GuardianPortal (office
 *     manager kept for staff) and gates guardian-only sessions;
 *   - Layout restricts the guardian-only menu to portal + notices;
 *   - StaffMobileApp points the parent home at the portal and uses
 *     the scoped children for its stats.
 *
 * Run: npx tsx scripts/verify-guardian-scope.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveGuardianChildren,
  isGuardianOnlySession,
  hasGuardianRole,
  canonicalPhone
} from '../services/guardianScope';
import type { Student } from '../types/student';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};
const ids = (list: Student[]) => list.map(s => s.id).sort();

// --- Fixtures ---------------------------------------------------------
const students = [
  { id: 'std_1', studentId: 'STD-101', name: 'Child One', classLevel: 'Class 5', roll: '3', guardianPhone: '01711111111', status: 'Active' },
  { id: 'std_2', studentId: 'STD-102', name: 'Child Two', classLevel: 'Class 7', roll: '5', guardianPhone: '+8801711111111', status: 'Active' },
  { id: 'std_3', studentId: 'STD-103', name: 'Unrelated Child', classLevel: 'Class 5', roll: '9', guardianPhone: '01822222222', status: 'Active' },
  { id: 'std_4', studentId: 'STD-104', name: 'Email Child', classLevel: 'Class 6', roll: '1', guardianEmail: 'b@example.com', status: 'Active' }
] as unknown as Student[];

// --- Part 1: the real linkage -----------------------------------------
// (a) explicit studentId link resolves exactly that child, even with
// an unrelated phone on the account.
const a = resolveGuardianChildren({ studentId: 'STD-101', phone: '01999999999' }, students);
check('(a) studentId link -> exactly [std_1]', JSON.stringify(ids(a)) === JSON.stringify(['std_1']));

// (a2) the internal id also links.
const a2 = resolveGuardianChildren({ studentId: 'std_3' }, students);
check('(a2) internal-id link -> exactly [std_3]', JSON.stringify(ids(a2)) === JSON.stringify(['std_3']));

// (b) phone link: both siblings (local + international formats on
// the student records; the account may carry either format too).
const b = resolveGuardianChildren({ phone: '01711111111' }, students);
check('(b) phone link -> [std_1, std_2] (two children)', JSON.stringify(ids(b)) === JSON.stringify(['std_1', 'std_2']));
const bIntl = resolveGuardianChildren({ phone: '+880 1711-111111' }, students);
check('(b-intl) account phone in +880 format -> same two children', JSON.stringify(ids(bIntl)) === JSON.stringify(['std_1', 'std_2']));

// (b2) email link.
const b2 = resolveGuardianChildren({ email: 'B@Example.com' }, students);
check('(b2) email link (case-insensitive) -> [std_4]', JSON.stringify(ids(b2)) === JSON.stringify(['std_4']));

// Extra contact sources (member doc / auth record) also link.
const b3 = resolveGuardianChildren({ phone: '' }, students, { phones: ['01711111111'] });
check('(b3) member-doc phone as extra source -> [std_1, std_2]', JSON.stringify(ids(b3)) === JSON.stringify(['std_1', 'std_2']));

// (c) unlinked guardian -> EMPTY set (the portal renders the
// no-link state; never a fallback student).
const c = resolveGuardianChildren({ phone: '01633333333', email: 'nobody@example.com' }, students);
check('(c) unlinked guardian -> []', c.length === 0);
const cNull = resolveGuardianChildren(null, students);
check('(c2) no account -> []', cNull.length === 0);

// (d) session shapes.
check('(d) isGuardianOnlySession([guardian]) === true', isGuardianOnlySession(['guardian']) === true);
check('(d) isGuardianOnlySession([guardian, teacher]) === false (multi-role keeps union)', isGuardianOnlySession(['guardian', 'teacher']) === false);
check('(d) isGuardianOnlySession([teacher]) === false', isGuardianOnlySession(['teacher']) === false);
check('(d) hasGuardianRole([guardian, teacher]) === true', hasGuardianRole(['guardian', 'teacher']) === true);
check('(d) hasGuardianRole([teacher]) === false (non-guardian unscoped)', hasGuardianRole(['teacher']) === false);
check('(d) canonicalPhone folds +880 to trunk 0', canonicalPhone('+8801711111111') === '01711111111');

// --- Part 2: consuming code paths ---------------------------------------
const portalSrc = fs.readFileSync(path.join(ROOT, 'components/GuardianPortal.tsx'), 'utf8');
check('GuardianPortal resolves children via guardianScope', portalSrc.includes('resolveGuardianChildren'));
check(
  'GuardianPortal has NO students[0] fallback (code pattern)',
  !/students\[0\]\s*\|\||=\s*students\[0\]|return students\[0\]/.test(portalSrc)
);
check('GuardianPortal has NO fabricated attendance figures', !portalSrc.includes('২২০ দিন') && !portalSrc.includes('৯৬.৪%'));
check(
  'GuardianPortal renders the no-link state copy (bn + en)',
  portalSrc.includes('কোনো শিক্ষার্থী যুক্ত করা হয়নি — অফিসে যোগাযোগ করুন') &&
  portalSrc.includes('No student linked yet — please contact the office')
);
check('GuardianPortal attendance is recorded-only (dailyAttendanceService)', portalSrc.includes('calculateStudentAttendanceForExam'));
check('GuardianPortal dues come from the canonical dues service', portalSrc.includes('calculateSingleStudentDue'));

const appSrc = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
check('App.tsx gate has the guardian-only block', appSrc.includes('isGuardianOnlySession'));
const portalCase = appSrc.slice(appSrc.indexOf("case 'guardian_portal':"));
check(
  'App.tsx guardian_portal renders GuardianPortal for guardians, office manager otherwise',
  portalCase.includes('<GuardianPortal />') && portalCase.includes('PortalsServicesManager')
);

const layoutSrc = fs.readFileSync(path.join(ROOT, 'components/Layout.tsx'), 'utf8');
check(
  'Layout guardian-only menu = portal + notice board',
  layoutSrc.includes("item.id === 'guardian_portal' || item.id === 'notice_board'")
);

const mobileSrc = fs.readFileSync(path.join(ROOT, 'components/StaffMobileApp.tsx'), 'utf8');
check('StaffMobileApp resolves guardianChildren via guardianScope', mobileSrc.includes('resolveGuardianChildren'));
check("StaffMobileApp parent quick actions target 'guardian_portal'", mobileSrc.includes("moduleKey: 'guardian_portal'"));
check("StaffMobileApp parent bottom nav targets 'guardian_portal'", mobileSrc.includes("targetModule: 'guardian_portal'"));
check('StaffMobileApp parent stats use scoped dues (guardianDuesTotal)', mobileSrc.includes('guardianDuesTotal'));
check(
  'StaffMobileApp parent home renders the no-link state copy',
  mobileSrc.includes('কোনো শিক্ষার্থী যুক্ত করা হয়নি — অফিসে যোগাযোগ করুন') &&
  mobileSrc.includes('No student linked yet — please contact the office')
);

console.log('');
if (failures > 0) {
  console.log(`RESULT: ${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('RESULT: ALL GUARDIAN-SCOPE CHECKS PASS');
