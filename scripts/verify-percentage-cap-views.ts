/**
 * verify-percentage-cap-views.ts — proof for fix/master-percentage-cap-views.
 *
 * Bug: SubjectPerformanceAnalytics and StudentPerformanceCard computed
 * obtained/fullMarks*100 with no cap, so stored over-full marks showed
 * as >100% (a 120/100 mark displayed 120%). The fix caps the per-mark
 * percentage at 100 in both views (display-only), plus the same cap on
 * the profile card's exam-overall percentage, which had the same
 * defect. The real fix is stopping over-full marks at entry (fixes 1-2)
 * plus repairing stored ones — this only stops the display lying.
 *
 * The percentages are computed inline in the components, so the script
 * proves the cap is present at each computation site and no uncapped
 * form remains.
 *
 * Run: npx tsx scripts/verify-percentage-cap-views.ts
 */
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const analytics = read('components/SubjectPerformanceAnalytics.tsx');
check('analytics percentage capped at 100',
  analytics.includes('Math.min(100, (obtained / fullMarks) * 100)'));
check('analytics has no uncapped percentage left',
  !analytics.includes('const percentage = (obtained / fullMarks) * 100;'));

const card = read('components/StudentPerformanceCard.tsx');
check('profile per-mark percent capped at 100',
  card.includes('Math.min(100, Math.round((obtained / (sub.fullMarks || 100)) * 100))'));
check('profile has no uncapped per-mark percent left',
  !card.includes('const percent = Math.round((obtained / (sub.fullMarks || 100)) * 100);'));
check('profile exam-overall percentage capped at 100',
  card.includes('Math.min(100, (gpaResult.totalMarks / fullMarksPossible) * 100)'));
check('profile has no uncapped overall percentage left',
  !card.includes('const marksPercentage = fullMarksPossible > 0 ? (gpaResult.totalMarks / fullMarksPossible) * 100 : 0;'));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
