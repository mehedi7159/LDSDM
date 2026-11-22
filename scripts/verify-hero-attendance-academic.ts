/**
 * Hero banners — Attendance + Academic — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06 + 18:14): every page's hero banner
 * looks AI-generated at first glance and the colours/backgrounds look
 * bad; NO page may be missed. The shared 'brand' tone was restyled to
 * the flat LIGHT pattern in branch fix/hero-shared-pattern (merges
 * FIRST); this branch converts the two remaining hand-rolled dark
 * blocks (bg-slate-900 + glass KPI tiles + rainbow values + emoji
 * titles) to <PageHeader tone="brand"> with light KPI tiles/buttons.
 *
 * What must NOT change here: titles/subtitles/copy strings (only the
 * emoji characters are removed), KPI value expressions and their
 * recorded-only conditional logic, button handlers, tab rows, or any
 * data/numbers/definitions. No result/marksheet, rules, auth or login
 * file is touched.
 *
 * Run: npx tsx scripts/verify-hero-attendance-academic.ts
 *      (or npm run test:hero-attendance-academic).
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

const att = readSource('components/attendance/AttendanceManager.tsx');
const aca = readSource('components/academic/AcademicManager.tsx');

/** The hero area: after the change it is the <PageHeader>…</PageHeader>
 *  block; before it, the hand-rolled dark block up to the tab row. */
function heroSlice(src: string): string {
  const phStart = src.indexOf('<PageHeader');
  if (phStart >= 0) {
    const phEnd = src.indexOf('</PageHeader>', phStart);
    assert.ok(phEnd > phStart, 'PageHeader closing tag found');
    return src.slice(phStart, phEnd + '</PageHeader>'.length);
  }
  const darkStart = src.indexOf('<div className="bg-slate-900');
  assert.ok(darkStart >= 0, 'hand-rolled dark hero block found');
  const tabsIdx = src.indexOf('Sub-Navigation Tabs', darkStart);
  assert.ok(tabsIdx > darkStart, 'tab row found after hero block');
  return src.slice(darkStart, tabsIdx);
}

const attHero = heroSlice(att);
const acaHero = heroSlice(aca);
const EMOJI = /[🀀-🿿😀-🫏☀-➿]/u;

check('Attendance: no dark bg-slate-900 hero block', () => {
  assert.ok(!attHero.includes('bg-slate-900'), 'Attendance hero must not contain bg-slate-900');
});

check('Academic: no dark bg-slate-900 hero block', () => {
  assert.ok(!acaHero.includes('bg-slate-900'), 'Academic hero must not contain bg-slate-900');
});

check('Hero areas have no glass classes (bg-white/5, bg-white/10, border-white/, backdrop-blur)', () => {
  for (const [name, hero] of [['Attendance', attHero], ['Academic', acaHero]] as const) {
    for (const bad of ['bg-white/5', 'bg-white/10', 'border-white/', 'backdrop-blur']) {
      assert.ok(!hero.includes(bad), `${name} hero must not contain ${bad}`);
    }
  }
});

check('Hero areas have no rainbow value colours', () => {
  for (const [name, hero] of [['Attendance', attHero], ['Academic', acaHero]] as const) {
    // dark: pairings (dark:text-emerald-400, dark:text-emerald-300 on the
    // light emerald button, …) are the light map's dark-mode half, not
    // rainbow: strip them and check the light-mode classes only.
    const lightOnly = hero.replace(/dark:text-[a-z]+(-\d+)?/g, '');
    for (const bad of ['text-cyan-300', 'text-amber-300', 'text-rose-300', 'text-indigo-300', 'text-emerald-300', 'text-teal-200', 'text-teal-300', 'text-emerald-200']) {
      assert.ok(!lightOnly.includes(bad), `${name} hero must not contain ${bad}`);
    }
    // Bare text-white is out; dark:text-white (dark-mode pairing) is fine.
    assert.ok(!/text-white/.test(lightOnly), `${name} hero must not contain bare text-white`);
  }
});

check('Hero titles have no emoji', () => {
  assert.ok(!EMOJI.test(attHero), 'Attendance hero must not contain emoji');
  assert.ok(!EMOJI.test(acaHero), 'Academic hero must not contain emoji');
});

check('Both files use <PageHeader tone="brand">', () => {
  assert.ok(att.includes('<PageHeader'), 'AttendanceManager uses PageHeader');
  assert.ok(att.includes('tone="brand"'), 'AttendanceManager uses tone="brand"');
  assert.ok(aca.includes('<PageHeader'), 'AcademicManager uses PageHeader');
  assert.ok(aca.includes('tone="brand"'), 'AcademicManager uses tone="brand"');
  assert.ok(att.includes("from '../ui/PageHeader'") || att.includes("from '../../components/ui/PageHeader'") || att.includes('ui/PageHeader'), 'AttendanceManager imports PageHeader');
  assert.ok(aca.includes('ui/PageHeader'), 'AcademicManager imports PageHeader');
});

check('Hero icons: Attendance CalendarDays, Academic BookOpen', () => {
  assert.ok(attHero.includes('icon={CalendarDays}'), 'Attendance hero passes icon={CalendarDays}');
  assert.ok(att.includes('CalendarDays'), 'AttendanceManager imports CalendarDays');
  assert.ok(acaHero.includes('icon={BookOpen}'), 'Academic hero passes icon={BookOpen}');
  assert.ok(aca.includes('BookOpen'), 'AcademicManager imports BookOpen');
});

check('Titles unchanged (same Bengali/English strings)', () => {
  for (const s of ['ডিজিটাল হাজিরা ও অটোমেশন কেন্দ্র', 'Digital Attendance & Automation Hub']) {
    assert.ok(att.includes(s), `Attendance title still contains ${s}`);
  }
  for (const s of ['একাডেমিক ব্যবস্থাপনা ও কারিকুলাম সিস্টেম', 'Academic & Curriculum Management']) {
    assert.ok(aca.includes(s), `Academic title still contains ${s}`);
  }
});

check('KPI value expressions unchanged', () => {
  for (const expr of ['kpis.studentRate', 'kpis.presentRecorded', 'kpis.absentRecorded', 'kpis.staffRate', 'kpis.totalEnrolled', 'kpis.pendingStudents', 'kpis.totalTeachers', 'হাজিরা নেওয়া হয়নি']) {
    assert.ok(att.includes(expr), `Attendance still contains ${expr}`);
  }
  for (const expr of ['kpis.totalSubjects', 'kpis.coreSubjects', 'kpis.electiveSubjects', 'kpis.totalClasses', 'kpis.totalTeachers', 'kpis.weeklyPeriods', 'kpis.syllabusRate', 'kpis.holidayDays']) {
    assert.ok(aca.includes(expr), `Academic still contains ${expr}`);
  }
});

check('Button handlers unchanged', () => {
  assert.ok(att.includes('setIsBulkModalOpen(true)'), 'Attendance bulk-import handler intact');
  assert.ok(att.includes("setActiveTab('sync')"), 'Attendance sync handler intact');
  assert.ok(aca.includes("setActiveTab('routine')"), 'Academic routine handler intact');
  assert.ok(aca.includes("setActiveTab('calendar')"), 'Academic calendar handler intact');
});

check('KPI tiles use the light map (slate-50 + dark slate-800/60, slate labels)', () => {
  for (const [name, hero] of [['Attendance', attHero], ['Academic', acaHero]] as const) {
    assert.ok(hero.includes('bg-slate-50 dark:bg-slate-800/60'), `${name} tiles use the light tile surface`);
    assert.ok(hero.includes('text-slate-500 dark:text-slate-400'), `${name} tile labels are muted slate`);
    assert.ok(hero.includes('text-slate-900 dark:text-white'), `${name} tile values are dark slate`);
  }
});

check('Hero buttons use light classes, no glass', () => {
  for (const [name, hero] of [['Attendance', attHero], ['Academic', acaHero]] as const) {
    assert.ok(hero.includes('bg-white dark:bg-slate-800'), `${name} hero buttons are light`);
    assert.ok(hero.includes('text-teal-600 dark:text-teal-400'), `${name} hero button icon is teal-600`);
  }
  assert.ok(attHero.includes('bg-emerald-50 dark:bg-emerald-500/10'), 'Attendance sync button is light emerald');
  assert.ok(acaHero.includes('bg-emerald-50 dark:bg-emerald-500/10'), 'Academic calendar button is light emerald');
});

check('Semantic KPI colours only (emerald/rose/amber 600 + dark 400)', () => {
  assert.ok(attHero.includes('text-emerald-600 dark:text-emerald-400'), 'Attendance rate value is emerald-600');
  assert.ok(attHero.includes('text-rose-600 dark:text-rose-400'), 'Attendance absentee value is rose-600');
  assert.ok(attHero.includes('text-amber-600 dark:text-amber-400'), 'Attendance not-taken state is amber-600');
  assert.ok(acaHero.includes('text-emerald-600 dark:text-emerald-400'), 'Academic syllabus value is emerald-600');
  assert.ok(acaHero.includes('text-rose-600 dark:text-rose-400'), 'Academic holiday value is rose-600');
});

check('Academic: empty "Islamic & Academic Ambient Accents" comment deleted', () => {
  assert.ok(!aca.includes('Islamic & Academic Ambient Accents'), 'dead ambient-accents comment is gone');
});

check('Hero areas have no gradient and no old footer divider', () => {
  for (const [name, hero] of [['Attendance', attHero], ['Academic', acaHero]] as const) {
    assert.ok(!hero.includes('gradient'), `${name} hero must not contain gradient`);
    assert.ok(!hero.includes('border-white/10'), `${name} hero must not keep the old white divider`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
