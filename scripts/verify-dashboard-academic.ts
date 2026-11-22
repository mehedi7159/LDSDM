/**
 * verify-dashboard-academic.ts — scripted proof for the Dashboard
 * academic section + filter placement (22 Nov 2026, principal's word).
 *
 * Before: the Dashboard's academic cards (class grid, grade
 * distribution, pass/fail pie, top merit, at-risk) were scattered at
 * the bottom of the page after the report tiles, and the filters that
 * drive them (session + exam selectors) sat far away in the hero —
 * while the class filter (`selectedClass`, default 'All') had no UI
 * control at all: its setter was never called, so it was dead state.
 *
 * After: ONE academic section ("একাডেমিক চিত্র") holds all five
 * academic cards, with all three filters in its header, next to the
 * content they filter: session, exam, and class. The class filter
 * wires the existing `selectedClass` state (default 'All' — current
 * behaviour unchanged) to a real select fed by the existing `classes`
 * list; the class grid shows only the chosen class when one is picked.
 * The session/exam selects move verbatim out of the hero into the
 * section header — same state, same handlers, same options.
 *
 * What must NOT change: every figure's definition (pass rate D3 (ক),
 * dues, grade tiers), every handler, the hero look, the tasks block,
 * MadrasaReports, the report tiles. No new data, no invented values.
 *
 * Checks:
 *   (1) Hero has no filter selects anymore.
 *   (2) Academic section header exists in the Dashboard.
 *   (3) All three filter selects live in the academic section.
 *   (4) Class select options come from the existing classes list.
 *   (5) Class grid shows only the chosen class when filtered.
 *   (6) All five academic cards sit inside the academic section.
 *   (7) Page order: tasks, then academic section, then MadrasaReports.
 *   (8) Hero still present; no selector props passed to it.
 *   (9) No new filter state invented (selectedClass default still 'All').
 *   (10) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-dashboard-academic.ts
 * (or npm run test:dashboard-academic).
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

const dashboard = readSource('components/Dashboard.tsx');
const overview = readSource('components/DashboardDailyOverview.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) Hero has no filter selects anymore.
check('(1) no session select in the hero',
  !overview.includes("value={selectedAcademicYear}"),
  'the session <select> must leave DashboardDailyOverview');
check('(1) no exam select in the hero',
  !overview.includes("value={selectedExamId || ''}"),
  'the exam <select> must leave DashboardDailyOverview');
check('(1) hero no longer takes selector props',
  !/onSelectAcademicYear|onSelectExamId/.test(overview),
  'selector props must be gone from DashboardDailyOverview');

// (2) Academic section header exists.
check("(2) academic section header exists",
  dashboard.includes('একাডেমিক চিত্র'),
  'Dashboard must have an "একাডেমিক চিত্র" section header');

// (3) All three filter selects live in the academic section.
const sectionAt = dashboard.indexOf('একাডেমিক চিত্র');
const sessionSelect = dashboard.indexOf('value={selectedAcademicYear}');
const examSelect = dashboard.indexOf("value={selectedExamId || ''}");
const classSelect = dashboard.indexOf('value={selectedClass}');
check('(3) session select sits in the academic section',
  sessionSelect > 0 && sessionSelect > sectionAt,
  'session select must be after the academic section header');
check('(3) exam select sits in the academic section',
  examSelect > 0 && examSelect > sectionAt,
  'exam select must be after the academic section header');
check('(3) class select sits in the academic section',
  classSelect > 0 && classSelect > sectionAt,
  'class select must be after the academic section header');
check('(3) class select calls the existing setter',
  /onChange=\{\(e\) => setSelectedClass\(e\.target\.value\)\}/.test(dashboard),
  'class select must call setSelectedClass');

// (4) Class select options come from the existing classes list.
check('(4) class options come from classes',
  /\(classes \|\| \[\]\)\.map\(|classes\.map\(/.test(dashboard.slice(classSelect, classSelect + 800)),
  'class select options must come from the classes list');
check("(4) class select has an 'All' option",
  dashboard.slice(classSelect, classSelect + 800).includes('value="All"'),
  "class select must offer 'All' (current behaviour)");

// (5) Class grid shows only the chosen class when filtered.
check('(5) class grid receives class-filtered cards',
  /classCards=\{selectedClass === 'All' \? classCards : classCards\.filter\(/.test(dashboard),
  'ClassGrid must get filtered cards when a class is picked');

// (6) All five academic cards sit inside the academic section
// (after its header, before MadrasaReports).
const reportsAt = dashboard.indexOf('<MadrasaReports />');
for (const [name, marker] of [
  ['class grid', '<ClassGrid classCards='],
  ['grade chart', 'গ্রেডভিত্তিক ফলাফল বিন্যাস'],
  ['pass/fail pie', 'পাস বনাম ফেল অনুপাত'],
  ['top merit', 'শীর্ষ মেধা তালিকা (টপ ৫)'],
  ['at-risk panel', 'বিশেষ যত্ন প্রয়োজন (ঝুঁকিপূর্ণ)'],
] as const) {
  const at = dashboard.indexOf(marker);
  check(`(6) ${name} sits inside the academic section`,
    at > sectionAt && at < reportsAt,
    `${name} must be between the academic header and MadrasaReports`);
}

// (7) Page order: tasks, then academic section, then MadrasaReports,
// then the report tiles.
const tasksAt = dashboard.indexOf("title={language === 'bn' ? 'আজকের করণীয়'");
const tilesAt = dashboard.indexOf("title={language === 'bn' ? 'প্রতিবেদন'");
check('(7) tasks come before the academic section',
  tasksAt > 0 && tasksAt < sectionAt,
  'আজকের করণীয় must come before the academic section');
check('(7) academic section comes before MadrasaReports',
  sectionAt > 0 && sectionAt < reportsAt,
  'academic section must come before MadrasaReports');
check('(7) MadrasaReports comes before the report tiles',
  reportsAt > 0 && reportsAt < tilesAt,
  'MadrasaReports must come before the report tiles');

// (8) Hero still present; no selector props passed to it.
check('(8) hero still rendered',
  dashboard.includes('<DashboardDailyOverview') && dashboard.includes('section="hero"'),
  'hero must still render');
check('(8) no selector props passed to the hero',
  !dashboard.includes('onSelectAcademicYear={') && !dashboard.includes('onSelectExamId={'),
  'Dashboard must not pass selector props to the hero anymore');

// (9) No new filter state invented.
check("(9) selectedClass default still 'All'",
  /const \[selectedClass, setSelectedClass\] = useState<string>\('All'\)/.test(dashboard),
  "selectedClass must still default to 'All'");
check('(9) no new filter state added',
  !/useState<string>\('(All|ALL)'\)/.test(dashboard.replace(/const \[selectedClass, setSelectedClass\] = useState<string>\('All'\)/, '')),
  'no other All/ALL-default filter state may be added');

// (10) package.json exposes this verify script.
check('(10) package.json exposes the verify script',
  pkg.scripts['test:dashboard-academic'] === 'tsx scripts/verify-dashboard-academic.ts',
  'npm run test:dashboard-academic must run this script');

console.log(failures === 0 ? '\nALL DASHBOARD-ACADEMIC CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
