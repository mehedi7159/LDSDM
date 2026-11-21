/**
 * verify-name-doubling-v2.ts — scripted proof for the name-doubling fix, v2.
 *
 * Root cause (proved against the real 20 Nov 2026 full-system backup,
 * 173 students / 109 subjects — NOT a guess):
 * - STORED DATA carries the duplicate: 143/173 students and 108/109
 *   subjects store name and nameBn as the IDENTICAL Bangla string
 *   (teachers typed the Bangla name into both form fields, e.g.
 *   'মোঃ নাজিম' / 'মোঃ নাজিম', 'বাংলা' / 'বাংলা'). The `name` field
 *   itself is never doubled. 20 students have no nameBn at all and
 *   already render fine — every view falls back to `name`.
 * - RENDER: any site printing `name` + `nameBn` side by side shows it
 *   twice. v1 (PR #29) guarded 5 sites with a bare `trim()` compare.
 *   That misses near-duplicates trim() cannot see — the backup has one:
 *   'সুমাইয়া আক্তার [2]' vs 'সুমাইয়া আক্তার  [2]' (double space
 *   inside) — and it missed 2 sites entirely (StudentManager card
 *   altName, StudentProfileView bio line).
 * - v2 fixes it at the source, twice over:
 *   (a) ONE shared predicate, services/displayNames.ts `showSecondName`
 *       (NFC + collapse-all-whitespace compare), used at EVERY site
 *       that prints name + nameBn — no site keeps its own ad-hoc check.
 *       10 sites: WebResultView x3, StudentIDCardGenerator, 
 *       StudentProfileModal, StudentManager x2 (card altName + desktop
 *       table row), StudentProfileView x2 (English header + bio line),
 *       ClassPromotionModal (English mode).
 *   (b) WRITE side: the create/update payload builders no longer store
 *       a redundant nameBn (equal-after-normalize => undefined). New
 *       records stop carrying the duplicate; existing stored records
 *       are NOT rewritten or migrated.
 *
 * Checks:
 *   (1) Helper logic on the audit's real examples (incl. the
 *       double-space case v1 missed) + genuinely-different names.
 *   (2) All 10 render sites use showSecondName; no ad-hoc trim guard
 *       and no unguarded nameBn display remain in the touched files.
 *   (3) Builders drop a redundant nameBn, keep a genuinely different one.
 *   (4) Display-only: marks, GPA, totals, merit order rendering still
 *       present; BlankMarksheetView.tsx and ResultView.tsx untouched.
 *
 * NOTE: WebResultView.tsx is a PROTECTED file — the 12 Nov filter-only
 * exception does NOT cover this. This change is display-only (no marks,
 * GPA, order, calculation or PDF change), built under the principal's
 * 20 Nov auto-fix instruction. FLAG in the report.
 * StudentProfileView.tsx bio line is inside the transcript view — same
 * display-only flag.
 *
 * Run: npx tsx scripts/verify-name-doubling-v2.ts
 * (or npm run test:name-doubling-v2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { showSecondName } from '../services/displayNames';
import { buildCreateStudentPayload, buildUpdateStudentPayload } from '../services/studentService';
import { buildCreateSubjectPayload, buildUpdateSubjectPayload } from '../services/academicCoreService';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const webResult = readSource('components/WebResultView.tsx');
const idCard = readSource('components/StudentIDCardGenerator.tsx');
const profileModal = readSource('components/StudentProfileModal.tsx');
const studentManager = readSource('components/StudentManager.tsx');
const profileView = readSource('components/StudentProfileView.tsx');
const promotionModal = readSource('components/ClassPromotionModal.tsx');
const blankMarksheet = readSource('components/BlankMarksheetView.tsx');
const resultView = readSource('components/ResultView.tsx');
const displayNames = readSource('services/displayNames.ts');
const studentService = readSource('services/studentService.ts');
const academicCore = readSource('services/academicCoreService.ts');
const pkg = JSON.parse(readSource('package.json'));

// ---- (1) Helper logic on the real backup examples -------------------------
check('(1) identical Bangla student names hide the second name',
  showSecondName('মোঃ নাজিম', 'মোঃ নাজিম') === false, 'মোঃ নাজিম / মোঃ নাজিম must show once');
check('(1) identical Bangla student names hide the second name (Mim)',
  showSecondName('মোছাঃ মিম', 'মোছাঃ মিম') === false, 'মোছাঃ মিম / মোছাঃ মিম must show once');
check('(1) identical Bangla subject names hide the second name',
  showSecondName('বাংলা', 'বাংলা') === false, 'বাংলা / বাংলা must show once');
check('(1) identical Bangla subject names hide the second name (Math)',
  showSecondName('গণিত', 'গণিত') === false, 'গণিত / গণিত must show once');
// The case v1's trim() guard MISSED (real backup record): the two fields
// differ only by a double space INSIDE the string.
check('(1) double-space-inside duplicate hides the second name (v1 miss)',
  showSecondName('সুমাইয়া আক্তার [2]', 'সুমাইয়া আক্তার  [2]') === false,
  'internal whitespace-only difference must hide the second name');
check('(1) non-breaking-space duplicate hides the second name',
  showSecondName('মোঃ নাজিম', 'মোঃ নাজিম') === false, 'NBSP difference must hide the second name');
check('(1) trailing-space duplicate hides the second name',
  showSecondName('মোঃ নাজিম ', 'মোঃ নাজিম') === false, 'trim must catch whitespace-only differences');
check('(1) different names still show both (English name + Bangla nameBn)',
  showSecondName('Md. Nazim', 'মোঃ নাজিম') === true, 'different names must both show');
check('(1) different names still show both (real backup pair)',
  showSecondName('Mst. Tanisha Afrin Tisha', 'মোছাঃ তানিশা আফরিন তিশা') === true,
  'English/Bangla pair must both show');
check('(1) genuinely longer nameBn still shows',
  showSecondName('মোঃ আবরার', 'মোঃ আবরার হোসেন') === true, 'longer nameBn is real extra info');
check('(1) English-named student (no nameBn) shows once',
  showSecondName('John Smith', undefined) === false, 'no nameBn means nothing extra to show');
check('(1) empty nameBn shows once',
  showSecondName('মোঃ নাজিম', '') === false, 'empty nameBn means nothing extra to show');

// ---- (2) Every render site uses the one shared predicate -----------------
const usesHelper = (src: string, snippet: string) => src.includes(snippet);
check('(2) merit cell uses showSecondName',
  usesHelper(webResult, 'showSecondName(item.student.name, item.student.nameBn)'),
  'WebResultView merit cell must use showSecondName');
check('(2) result card header uses showSecondName',
  usesHelper(webResult, 'showSecondName(activeStudentResult.student.name, activeStudentResult.student.nameBn)'),
  'WebResultView card header must use showSecondName');
check('(2) subject list uses showSecondName',
  usesHelper(webResult, 'showSecondName(row.subject.name, row.subject.nameBn)'),
  'WebResultView subject rows must use showSecondName');
check('(2) ID card uses showSecondName',
  usesHelper(idCard, 'showSecondName(student.name, student.nameBn)'),
  'StudentIDCardGenerator must use showSecondName');
check('(2) profile modal uses showSecondName',
  usesHelper(profileModal, 'showSecondName(student.name, student.nameBn)'),
  'StudentProfileModal must use showSecondName');
check('(2) student card altName uses showSecondName (v1 miss)',
  usesHelper(studentManager, 'showSecondName(student.name, student.nameBn)'),
  'StudentManager StudentCard altName must use showSecondName');
check('(2) student table row (English mode) uses showSecondName (v1 miss)',
  studentManager.includes("language !== 'bn' && showSecondName(student.name, student.nameBn)"),
  'StudentManager desktop row must use showSecondName in English mode');
check('(2) profile header (English mode) uses showSecondName (v1 miss)',
  profileView.includes("language !== 'bn' && showSecondName(currentStudent.name, currentStudent.nameBn)"),
  'StudentProfileView header must use showSecondName in English mode');
check('(2) profile bio line uses showSecondName (v1 miss)',
  usesHelper(profileView, 'showSecondName(currentStudent.name, currentStudent.nameBn)'),
  'StudentProfileView bio line must use showSecondName');
check('(2) promotion modal (English mode) uses showSecondName (v1 miss)',
  promotionModal.includes("language !== 'bn' && showSecondName(item.student.name, item.student.nameBn)"),
  'ClassPromotionModal must use showSecondName in English mode');

// No site keeps its own ad-hoc trim comparison for name/nameBn.
const adhocGuard = (src: string) => (src.match(/\.name\.trim\(\) !== .*\.nameBn\.trim\(\)/g) || []).length;
check('(2) no ad-hoc trim guard left in WebResultView', adhocGuard(webResult) === 0,
  'inline trim() !== nameBn.trim() must be replaced by showSecondName');
check('(2) no ad-hoc trim guard left in StudentIDCardGenerator', adhocGuard(idCard) === 0,
  'inline trim() !== nameBn.trim() must be replaced by showSecondName');
check('(2) no ad-hoc trim guard left in StudentProfileModal', adhocGuard(profileModal) === 0,
  'inline trim() !== nameBn.trim() must be replaced by showSecondName');

// No unguarded nameBn display remains in the touched display files.
const unguardedNameBn = (src: string) => {
  const hits = src.match(/\{[^}\n]*\.nameBn && [\(<]/g) || [];
  return hits.filter(h => !/showSecondName/.test(h));
};
check('(2) no unguarded nameBn display remains in WebResultView',
  unguardedNameBn(webResult).length === 0,
  `unguarded: ${unguardedNameBn(webResult).join(' | ')}`);
check('(2) no unguarded nameBn display remains in StudentIDCardGenerator',
  unguardedNameBn(idCard).length === 0,
  `unguarded: ${unguardedNameBn(idCard).join(' | ')}`);
check('(2) no unguarded nameBn display remains in StudentProfileModal',
  unguardedNameBn(profileModal).length === 0,
  `unguarded: ${unguardedNameBn(profileModal).join(' | ')}`);
// The profile bio line printed nameBn inside a template string, not a
// `{x.nameBn && (` guard — assert the old unguarded form is gone.
check('(2) profile bio no longer prints raw (nameBn)',
  !profileView.includes("`(${currentStudent.nameBn})`"),
  'StudentProfileView bio must not print nameBn unconditionally');

// The helper itself normalizes (NFC + collapse whitespace), not bare trim.
check('(2) helper normalizes instead of bare trim',
  displayNames.includes('normalize') && displayNames.includes('replace(/\\s+/g'),
  'services/displayNames.ts must collapse internal whitespace');

// ---- (3) Write side: builders stop storing the redundant copy ------------
const baseStudent: any = { name: 'মোঃ নাজিম', classLevel: 'Play', status: 'Active' };
const createdDup = buildCreateStudentPayload({ ...baseStudent, nameBn: 'মোঃ নাজিম' });
check('(3) create student drops identical nameBn',
  !createdDup.error && createdDup.student.nameBn === undefined,
  `create must not store nameBn identical to name (got ${JSON.stringify(createdDup.student?.nameBn)} / ${createdDup.error || ''})`);
const createdWs = buildCreateStudentPayload({ ...baseStudent, nameBn: 'মোঃ  নাজিম' });
check('(3) create student drops whitespace-only-different nameBn',
  !createdWs.error && createdWs.student.nameBn === undefined,
  'double-space nameBn must not be stored');
const createdDiff = buildCreateStudentPayload({ name: 'Md. Nazim', classLevel: 'Play', status: 'Active', nameBn: 'মোঃ নাজিম' });
check('(3) create student keeps a genuinely different nameBn',
  !createdDiff.error && createdDiff.student.nameBn === 'মোঃ নাজিম',
  'different nameBn must still be stored');
const createdNone = buildCreateStudentPayload({ ...baseStudent });
check('(3) create student without nameBn still works',
  !createdNone.error && createdNone.student.nameBn === undefined, 'blank nameBn must stay blank');

const existing: any = { id: 'std-test-1', name: 'মোঃ নাজিম', nameBn: 'মোঃ নাজিম', classLevel: 'Play', status: 'Active' };
const updatedDup = buildUpdateStudentPayload(existing, { nameBn: 'মোঃ নাজিম' });
check('(3) update student drops identical nameBn',
  !updatedDup.error && updatedDup.student.nameBn === undefined,
  'update must not store nameBn identical to name');
const updatedDiff = buildUpdateStudentPayload(existing, { nameBn: 'মোঃ নাজিম হোসেন' });
check('(3) update student keeps a genuinely different nameBn',
  !updatedDiff.error && updatedDiff.student.nameBn === 'মোঃ নাজিম হোসেন',
  'different nameBn must still be stored on update');

const createdSub = buildCreateSubjectPayload({ name: 'বাংলা', nameBn: 'বাংলা', classLevel: 'Play' } as any);
check('(3) create subject drops identical nameBn',
  !createdSub.error && createdSub.subject!.nameBn === undefined,
  `create subject must not store nameBn identical to name (got ${JSON.stringify(createdSub.subject?.nameBn)} / ${createdSub.error || ''})`);
const createdSubDiff = buildCreateSubjectPayload({ name: 'Bangla', nameBn: 'বাংলা', classLevel: 'Play' } as any);
check('(3) create subject keeps a genuinely different nameBn',
  !createdSubDiff.error && createdSubDiff.subject!.nameBn === 'বাংলা',
  'different subject nameBn must still be stored');
const existingSub: any = { id: 'sub-test-1', name: 'গণিত', nameBn: 'গণিত', classLevel: 'Play', fullMarks: 100, passMarks: 33 };
const updatedSub = buildUpdateSubjectPayload(existingSub, { nameBn: 'গণিত' });
check('(3) update subject drops identical nameBn',
  !updatedSub.error && updatedSub.subject.nameBn === undefined,
  'update subject must not store nameBn identical to name');

// Builders must call the shared helper (one rule, not a second copy).
check('(3) student builder uses the shared helper',
  studentService.includes('showSecondName') || studentService.includes('isSameName'),
  'services/studentService.ts must reuse displayNames, not re-implement the compare');
check('(3) subject builder uses the shared helper',
  academicCore.includes('showSecondName') || academicCore.includes('isSameName'),
  'services/academicCoreService.ts must reuse displayNames, not re-implement the compare');

// ---- (4) Display-only: calculations, totals, GPA, order untouched --------
check('(4) merit total marks still rendered', webResult.includes('toBanglaDigits(item.totalMarks)'), 'totalMarks rendering must stay');
check('(4) merit GPA still rendered', webResult.includes('toBanglaDigits(item.gpa.toFixed(2))'), 'GPA rendering must stay');
check('(4) subject obtained marks still rendered', webResult.includes('toBanglaDigits(row.obtained)'), 'obtained marks rendering must stay');
check('(4) merit rank still rendered', webResult.includes('item.rank'), 'rank rendering must stay');
check('(4) BlankMarksheetView.tsx untouched (no helper, no guard)',
  !blankMarksheet.includes('showSecondName') && !/\.trim\(\) !==/.test(blankMarksheet),
  'BlankMarksheetView must not be touched');
check('(4) ResultView.tsx untouched by this fix (no helper added)',
  !resultView.includes('showSecondName'),
  'ResultView must not be touched by this fix');
check('(4) package.json exposes the verify script',
  pkg.scripts['test:name-doubling-v2'] === 'tsx scripts/verify-name-doubling-v2.ts',
  'npm run test:name-doubling-v2 must run this script');

console.log(failures === 0 ? '\nALL NAME-DOUBLING-V2 CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
