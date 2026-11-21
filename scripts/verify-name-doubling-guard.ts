/**
 * verify-name-doubling-guard.ts — scripted proof for the Bangla-only
 * name/subject doubling bug (morning audits 18–19 Nov 2026).
 *
 * Symptom: the portal merit list showed "মোঃ নাজিম মোঃ নাজিম", the
 * single-student result header showed name + (nameBn), the subject list
 * showed "বাংলা বাংলা", and the ID card showed the name twice — but
 * only for Bangla names. English-named students showed once.
 *
 * Root cause: WebResultView.tsx and StudentIDCardGenerator.tsx render
 * the primary name and then the Bengali name (nameBn) without checking
 * whether they are the same string. For Bangla-named students the two
 * fields hold the same text, so it prints twice. ResultView.tsx already
 * has the safe pattern (lines ~740/1295/1807): show the second name
 * only if `name.trim() !== nameBn.trim()`.
 *
 * Checks:
 *   (1) WebResultView merit cell: nameBn only when different from name.
 *   (2) WebResultView single-student card header: same guard.
 *   (3) WebResultView subject list: subject nameBn only when different.
 *   (4) StudentIDCardGenerator: nameBn only when different from name.
 *   (5) StudentProfileModal (same unguarded pattern, found by grep):
 *       same guard.
 *   (6) Guard logic on the audit's own examples (incl. English names).
 *   (7) No calculation/layout change: marks, GPA, totals, merit order
 *       rendering still present; BlankMarksheetView.tsx untouched.
 *   (8) ResultView.tsx precedent guards still intact.
 *
 * NOTE: WebResultView.tsx is a PROTECTED file — the 12 Nov filter-only
 * exception does NOT cover this. This fix is built under the principal's
 * 20 Nov auto-fix instruction; it is a display-only guard (no marks,
 * GPA, order, calculation or PDF change).
 *
 * Run: npx tsx scripts/verify-name-doubling-guard.ts
 * (or npm run test:name-doubling-guard).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const resultView = readSource('components/ResultView.tsx');
const blankMarksheet = readSource('components/BlankMarksheetView.tsx');
const pkg = JSON.parse(readSource('package.json'));

// The guard, exactly as ResultView.tsx already writes it:
//   X.name && X.nameBn && X.name.trim() !== X.nameBn.trim() && ( ... {X.nameBn} ... )
const guarded = (src: string, obj: string) =>
  new RegExp(
    `${obj.replace(/\./g, '\\.')}\\.name && ${obj.replace(/\./g, '\\.')}\\.nameBn && ${obj.replace(/\./g, '\\.')}\\.name\\.trim\\(\\) !== ${obj.replace(/\./g, '\\.')}\\.nameBn\\.trim\\(\\) && [\\(<]`
  ).test(src);

// (1) Merit cell — Portal → Result Live → Play merit ("মোঃ নাজিম মোঃ নাজিম")
check('(1) merit cell guards nameBn', guarded(webResult, 'item.student'),
  'WebResultView merit cell must show nameBn only when it differs from name');

// (2) Single-student result card header
check('(2) result card header guards nameBn', guarded(webResult, 'activeStudentResult.student'),
  'WebResultView card header must show nameBn only when it differs from name');

// (3) Subject list ("বাংলা বাংলা")
check('(3) subject list guards nameBn', guarded(webResult, 'row.subject'),
  'WebResultView subject rows must show nameBn only when it differs from name');

// (4) ID card — name twice (top + bottom)
check('(4) ID card guards nameBn', guarded(idCard, 'student'),
  'StudentIDCardGenerator must show nameBn only when it differs from name');

// (5) Student profile modal — same unguarded pattern found by grep
check('(5) profile modal guards nameBn', guarded(profileModal, 'student'),
  'StudentProfileModal must show nameBn only when it differs from name');

// No unguarded nameBn display left in the two touched display files:
// every `{...nameBn && (` that renders a name must carry the trim guard.
const unguardedNameBn = (src: string) => {
  const hits = src.match(/\{[^}\n]*\.nameBn && [\(<]/g) || [];
  return hits.filter(h => !/\.trim\(\) !==/.test(h));
};
check('(1-4) no unguarded nameBn display remains in WebResultView',
  unguardedNameBn(webResult).length === 0,
  `unguarded: ${unguardedNameBn(webResult).join(' | ')}`);
check('(1-4) no unguarded nameBn display remains in StudentIDCardGenerator',
  unguardedNameBn(idCard).length === 0,
  `unguarded: ${unguardedNameBn(idCard).join(' | ')}`);

// (6) Guard logic on the audit's own examples (the rule the code applies).
const showSecondName = (name: string | undefined, nameBn: string | undefined) =>
  !!name && !!nameBn && name.trim() !== nameBn.trim();
check('(6) identical Bangla names hide the second name',
  showSecondName('মোঃ নাজিম', 'মোঃ নাজিম') === false, 'মোঃ নাজিম / মোঃ নাজিম must show once');
check('(6) identical Bangla subject hides the second name',
  showSecondName('বাংলা', 'বাংলা') === false, 'বাংলা / বাংলা must show once');
check('(6) different names still show both',
  showSecondName('Md. Nazim', 'মোঃ নাজিম') === true, 'different names must both show');
check('(6) English-named student (no nameBn) shows once',
  showSecondName('John Smith', undefined) === false, 'no nameBn means nothing extra to show');
check('(6) trailing-space duplicate hides the second name',
  showSecondName('মোঃ নাজিম ', 'মোঃ নাজিম') === false, 'trim must catch whitespace-only differences');

// (7) Display-only: calculations, totals, GPA and merit order untouched.
check('(7) merit total marks still rendered', webResult.includes('toBanglaDigits(item.totalMarks)'), 'totalMarks rendering must stay');
check('(7) merit GPA still rendered', webResult.includes('toBanglaDigits(item.gpa.toFixed(2))'), 'GPA rendering must stay');
check('(7) subject obtained marks still rendered', webResult.includes('toBanglaDigits(row.obtained)'), 'obtained marks rendering must stay');
check('(7) BlankMarksheetView.tsx untouched (no guard added there)',
  !/\.trim\(\) !==/.test(blankMarksheet), 'BlankMarksheetView has no such bug and must not be touched');

// (8) ResultView.tsx precedent guards still intact.
check('(8) ResultView precedent guard still present',
  (resultView.match(/\.name\.trim\(\) !== .*\.nameBn\.trim\(\)/g) || []).length >= 3,
  'ResultView school-name guards must stay');

check('(9) package.json exposes the verify script',
  pkg.scripts['test:name-doubling-guard'] === 'tsx scripts/verify-name-doubling-guard.ts',
  'npm run test:name-doubling-guard must run this script');

console.log(failures === 0 ? '\nALL NAME-DOUBLING-GUARD CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
