/**
 * verify-classname-marks-views.ts — proof for fix/master-classname-marks-views.
 *
 * Bug: exact `s.classLevel === selectedClass` in the marks/results views
 * dropped whole classes when a record stored the Bangla spelling
 * ('শিশু') and the selection held the English one ('Play'), or vice
 * versa. The fix applies the Fix #2 normalizer (services/classNames.ts,
 * copied unchanged from branch fix/blank-marksheet-play) to the lookups
 * in MarksEntry, Dashboard, ResultSmsNotificationModal and WebResultView
 * only. ResultView / ClassResultView filter lines are NOT touched —
 * those need the principal's decision to extend the filter exception.
 *
 * Run: npx tsx scripts/verify-classname-marks-views.ts
 */
import { readFileSync } from 'node:fs';
import { canonicalClassName, classNamesMatch } from '../services/classNames';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// (1) The normalizer itself: Bangla <-> English spellings match.
check("canonical 'শিশু' is Play", canonicalClassName('শিশু') === 'Play');
check("canonical '৬ষ্ঠ শ্রেণী' is Class 6", canonicalClassName('৬ষ্ঠ শ্রেণী') === 'Class 6');
check("canonical '৬ষ্ঠ শ্রেণি' is Class 6", canonicalClassName('৬ষ্ঠ শ্রেণি') === 'Class 6');
check("match 'শিশু' vs 'Play'", classNamesMatch('শিশু', 'Play'));
check("match 'Class 6' vs '৬ষ্ঠ শ্রেণী'", classNamesMatch('Class 6', '৬ষ্ঠ শ্রেণী'));
check("no match 'Play' vs 'Class 1'", !classNamesMatch('Play', 'Class 1'));
check('unknown names pass through unchanged', canonicalClassName('Class 3') === 'Class 3');

// (2) The four views use the normalizer; no exact classLevel === left in them.
const marksEntry = read('components/MarksEntry.tsx');
check('MarksEntry uses classNamesMatch', marksEntry.includes('classNamesMatch'));
check('MarksEntry has no exact classLevel === selectedClass', !marksEntry.includes('classLevel === selectedClass'));

const dashboard = read('components/Dashboard.tsx');
check('Dashboard uses classNamesMatch', dashboard.includes('classNamesMatch'));
for (const pat of ['classLevel === clsName', 'classLevel !== clsName', 'classLevel === selectedClass', 'classLevel === student.classLevel', 'classLevel === cls.name']) {
  check(`Dashboard has no exact '${pat}'`, !dashboard.includes(pat));
}

const sms = read('components/ResultSmsNotificationModal.tsx');
check('SMS modal uses classNamesMatch', sms.includes('classNamesMatch'));
check('SMS modal has no exact classLevel === classLevel', !sms.includes('classLevel === classLevel'));

const web = read('components/WebResultView.tsx');
check('WebResultView uses classNamesMatch', web.includes('classNamesMatch'));
check('WebResultView has no exact classLevel === selectedClass', !web.includes('classLevel === selectedClass'));

// (3) Protected files untouched: no normalizer in ResultView / ClassResultView.
check('ResultView NOT touched', !read('components/ResultView.tsx').includes('classNamesMatch'));
check('ClassResultView NOT touched', !read('components/ClassResultView.tsx').includes('classNamesMatch'));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
