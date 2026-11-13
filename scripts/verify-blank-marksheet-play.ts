/**
 * Blank marksheet — Play shows 0 subjects (11–12 Nov 2026, base fba1bb8).
 *
 * Bug: Exam → Blank marksheet, selecting Play (শিশু) shows 0 subjects,
 * 0 pages, PDF button disabled — though the Academic page shows Play has
 * 5 subjects (Bangla, English, Math, Arabic, Masala) and 12 students.
 * Class 10 works fine (10 subjects, 8 students, 3 pages).
 *
 * Root cause, in components/BlankMarksheetView.tsx only:
 *  1. Class-name mismatch: subjects were filtered by strict
 *     `s.classLevel === selectedClass`, but a class carries both an
 *     English `name` ('Play') and a Bangla `nameBn` ('শিশু'), and
 *     records exist under either spelling. Class 10 only ever appears
 *     under its English name, so it never hit this.
 *  2. Exam filter with no fallback: a subject whose non-empty `examIds`
 *     did not include the selected exam was dropped outright. Every
 *     sibling view (ResultView, MarksEntry, ClassResultView, Dashboard)
 *     applies the examIds filter ONLY when at least one subject of the
 *     class is assigned to that exam, and otherwise shows all class
 *     subjects. BlankMarksheetView was the one view missing that
 *     fallback, so Play subjects assigned to another exam vanished.
 *
 * Fix (lookup only, no grading/total/PDF/print/layout change):
 *  - services/classNames.ts: canonicalClassName / classNamesMatch map
 *    Bangla class names to the English canonical name (শিশু→Play,
 *    ১ম শ্রেণী/১ম শ্রেণি→Class 1, … ১০ম শ্রেণী/১০ম শ্রেণি→Class 10).
 *  - services/blankMarksheetLookup.ts: getBlankMarksheetSubjects —
 *    the same lookup as the component, as a pure function: class-name
 *    match + the sibling views' any-assigned exam fallback, sorted by
 *    order. BlankMarksheetView calls it; the student filter in the
 *    same file uses classNamesMatch.
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-blank-marksheet-play.ts
 * (or npm run test:blank-marksheet-play).
 */
import assert from 'node:assert';

const classNames: any = await import('../services/classNames').catch(() => ({}));
const lookup: any = await import('../services/blankMarksheetLookup').catch(() => ({}));

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

const mkSubject = (id: string, name: string, classLevel: string, examIds: string[] = [], order = 1) => ({
  id, name, classLevel, examIds, fullMarks: 100, passMarks: 33, isOptional: false, order,
});

// Play's 5 real subjects, stored under the Bangla class name (শিশু).
const playSubjectsBn = [
  mkSubject('sub-play-bn', 'Bangla', 'শিশু', [], 1),
  mkSubject('sub-play-en', 'English', 'শিশু', [], 2),
  mkSubject('sub-play-math', 'Math', 'শিশু', [], 3),
  mkSubject('sub-play-ar', 'Arabic', 'শিশু', [], 4),
  mkSubject('sub-play-masala', 'Masala', 'শিশু', [], 5),
];

// Same 5 subjects, stored under the English class name, but assigned to
// a DIFFERENT exam than the one selected in the marksheet view.
const playSubjectsOtherExam = playSubjectsBn.map(s => ({
  ...s, id: `${s.id}-x`, classLevel: 'Play', examIds: ['exam-2nd-term'],
}));

// Class 10's 10 subjects (English name, no exam restriction).
const class10Subjects = Array.from({ length: 10 }, (_, i) =>
  mkSubject(`sub-c10-${i + 1}`, `Subject ${i + 1}`, 'Class 10', [], i + 1));

console.log('--- class-name normalizer (services/classNames.ts) ---');

check('canonicalClassName maps শিশু to Play', () => {
  assert.strictEqual(typeof classNames.canonicalClassName, 'function', 'canonicalClassName must be exported');
  assert.strictEqual(classNames.canonicalClassName('শিশু'), 'Play');
});

check('canonicalClassName maps Bangla numerals (both শ্রেণী/শ্রেণি spellings) to Class N', () => {
  assert.strictEqual(classNames.canonicalClassName('১ম শ্রেণী'), 'Class 1');
  assert.strictEqual(classNames.canonicalClassName('১ম শ্রেণি'), 'Class 1');
  assert.strictEqual(classNames.canonicalClassName('১০ম শ্রেণী'), 'Class 10');
  assert.strictEqual(classNames.canonicalClassName('১০ম শ্রেণি'), 'Class 10');
});

check('canonicalClassName passes English names and unknowns through unchanged', () => {
  assert.strictEqual(classNames.canonicalClassName('Play'), 'Play');
  assert.strictEqual(classNames.canonicalClassName('Class 10'), 'Class 10');
  assert.strictEqual(classNames.canonicalClassName('Nursery'), 'Nursery');
  assert.strictEqual(classNames.canonicalClassName(''), '');
});

check('classNamesMatch matches across Bangla/English spellings and rejects other classes', () => {
  assert.strictEqual(typeof classNames.classNamesMatch, 'function', 'classNamesMatch must be exported');
  assert.strictEqual(classNames.classNamesMatch('শিশু', 'Play'), true);
  assert.strictEqual(classNames.classNamesMatch('Play', 'শিশু'), true);
  assert.strictEqual(classNames.classNamesMatch('১০ম শ্রেণী', 'Class 10'), true);
  assert.strictEqual(classNames.classNamesMatch('Play', 'Class 1'), false);
  assert.strictEqual(classNames.classNamesMatch('Play', ''), false);
});

console.log('--- blank-marksheet subject lookup (services/blankMarksheetLookup.ts) ---');

check('Play resolves to its 5 subjects when stored under শিশু (selected class Play)', () => {
  assert.strictEqual(typeof lookup.getBlankMarksheetSubjects, 'function', 'getBlankMarksheetSubjects must be exported');
  const got = lookup.getBlankMarksheetSubjects(playSubjectsBn, 'Play', 'exam-1st-term');
  assert.strictEqual(got.length, 5, `expected 5 subjects, got ${got.length}`);
  assert.deepStrictEqual(got.map((s: any) => s.name), ['Bangla', 'English', 'Math', 'Arabic', 'Masala']);
});

check('Play resolves to its 5 subjects when the SELECTED class is শিশু and subjects say Play', () => {
  const got = lookup.getBlankMarksheetSubjects(playSubjectsOtherExam.map((s: any) => ({ ...s, examIds: [] })), 'শিশু', 'exam-1st-term');
  assert.strictEqual(got.length, 5, `expected 5 subjects, got ${got.length}`);
});

check('Play subjects assigned to ANOTHER exam still show (no subject assigned to the selected exam → fallback)', () => {
  const got = lookup.getBlankMarksheetSubjects(playSubjectsOtherExam, 'Play', 'exam-1st-term');
  assert.strictEqual(got.length, 5, `expected 5 subjects via fallback, got ${got.length}`);
});

check('Class 10 still resolves to 10 subjects', () => {
  const got = lookup.getBlankMarksheetSubjects(class10Subjects, 'Class 10', 'exam-1st-term');
  assert.strictEqual(got.length, 10, `expected 10 subjects, got ${got.length}`);
});

check('exam filter still applies when the class HAS subjects assigned to the selected exam', () => {
  const mixed = [
    mkSubject('a', 'Assigned', 'Class 10', ['exam-1st-term'], 1),
    mkSubject('b', 'Other exam only', 'Class 10', ['exam-2nd-term'], 2),
    mkSubject('c', 'Unrestricted', 'Class 10', [], 3),
  ];
  const got = lookup.getBlankMarksheetSubjects(mixed, 'Class 10', 'exam-1st-term');
  assert.deepStrictEqual(got.map((s: any) => s.id), ['a']);
});

check('other classes never leak into the result', () => {
  const got = lookup.getBlankMarksheetSubjects([...playSubjectsBn, ...class10Subjects], 'Play', 'exam-1st-term');
  assert.strictEqual(got.length, 5, `expected only the 5 Play subjects, got ${got.length}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
