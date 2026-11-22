/**
 * Exams & Results hub hero — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06): every hero banner looks
 * AI-generated, colours/backgrounds bad; redesign to professional grade,
 * never AI-looking. The shared flat-LIGHT 'brand' pattern lives in
 * branch fix/hero-shared-pattern (PageHeader tone="brand": white /
 * dark slate-900 card, dark title, muted subtitle, teal icon chip;
 * footer wrapped with its own light divider). That branch merges FIRST,
 * then this one — so this file only swaps the hand-rolled dark hero
 * block for <PageHeader tone="brand"> and restyles its buttons/tiles
 * to the light map. Title, subtitle/copy, handlers and KPI data stay
 * byte-identical (only the 🏆 emoji character is removed; Trophy
 * becomes the PageHeader icon prop).
 *
 * Scope: components/examination/ExamResultsManager.tsx hero block only
 * (from the "Top Banner Header" comment to the "Sub-Tabs Navigation
 * Bar" comment). ExamManager.tsx / MarksEntry.tsx already use the
 * plain PageHeader — untouched. Result/marksheet files untouched.
 *
 * Run: npx tsx scripts/verify-hero-exams.ts
 *      (or npm run test:hero-exams).
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

const src = readSource('components/examination/ExamResultsManager.tsx');

// --- Hero slice (stable markers: the banner comment survives the swap) ---
const heroStart = src.indexOf('{/* Top Banner Header');
const heroEnd = src.indexOf('{/* Sub-Tabs Navigation Bar */}');
assert.ok(heroStart >= 0, 'hero start marker (Top Banner Header comment) missing');
assert.ok(heroEnd > heroStart, 'hero end marker (Sub-Tabs Navigation Bar comment) missing');
const hero = src.slice(heroStart, heroEnd);

// --- RED: the old dark hand-rolled hero must be gone ---
check('no dark hero block (bg-slate-900) in the hero area', () => {
  assert.ok(!hero.includes('bg-slate-900'), 'hero still has the dark bg-slate-900 block');
});
check('no glass classes (bg-white/10, bg-white/5, border-white/, backdrop-blur) in the hero area', () => {
  for (const c of ['bg-white/10', 'bg-white/5', 'border-white/', 'backdrop-blur']) {
    assert.ok(!hero.includes(c), `hero still has glass class ${c}`);
  }
});
check('no rainbow dark-glass colours in the hero area', () => {
  // Token-aware on purpose: the light map KEEPS these hues as dark-mode
  // variants (dark:text-indigo-300, dark:text-white, …) — only the
  // standalone light-mode token is banned.
  const tokenPresent = (cls: string) =>
    new RegExp(`(?:^|[\\s"'])${cls.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=[\\s"'])`).test(hero);
  const banned = [
    'text-indigo-300', 'text-emerald-300', 'text-amber-300', 'text-cyan-300',
    'text-rose-300', 'text-indigo-200', 'text-cyan-400', 'text-rose-400',
    'bg-indigo-600/40', 'bg-indigo-600/60', 'bg-emerald-600/30', 'bg-emerald-600/50',
    'text-white',
  ];
  for (const c of banned) {
    assert.ok(!tokenPresent(c), `hero still has rainbow/dark colour ${c}`);
  }
});
check('no emoji in the hero title (🏆 removed; Trophy is the PageHeader icon)', () => {
  assert.ok(!hero.includes('🏆'), 'hero still has the 🏆 emoji');
  assert.ok(!hero.includes('Ambient Glow'), 'empty Ambient Glow comment must go with the old block');
});
check('old dark footer divider stripped (PageHeader wraps the footer with its own light divider)', () => {
  assert.ok(!hero.includes('border-white/10'), 'hero still has the dark footer divider border-white/10');
});

// --- GREEN: the new shared light pattern is used ---
check('PageHeader tone="brand" with Trophy icon is used', () => {
  assert.ok(src.includes('<PageHeader'), 'file must use <PageHeader>');
  assert.ok(src.includes('tone="brand"'), 'PageHeader must use tone="brand"');
  assert.ok(src.includes('icon={Trophy}'), 'PageHeader must get icon={Trophy}');
  assert.ok(src.includes("import { PageHeader } from '../ui/PageHeader'"), 'PageHeader must be imported from ../ui/PageHeader');
});
check('Trophy is imported from lucide-react', () => {
  assert.ok(/Trophy/.test(src), 'Trophy must be imported');
  const imp = src.slice(0, src.indexOf("from 'lucide-react'"));
  assert.ok(imp.includes('Trophy'), 'Trophy must be in the lucide-react import');
});
check('hero uses the light tile map (slate-50 tiles, slate labels)', () => {
  assert.ok(hero.includes('bg-slate-50 dark:bg-slate-800/60'), 'KPI tiles must use the light map bg-slate-50 dark:bg-slate-800/60');
  assert.ok(hero.includes('text-slate-500 dark:text-slate-400'), 'tile labels must use text-slate-500 dark:text-slate-400');
  assert.ok(hero.includes('border-slate-200/80 dark:border-slate-700'), 'tiles/buttons must use the light border');
});
check('hero keeps print:hidden (PageHeader className)', () => {
  assert.ok(hero.includes('print:hidden'), 'hero must keep print:hidden');
});

// --- Unchanged: title/copy, handlers, KPI data ---
check('title strings unchanged (same Bengali + English)', () => {
  assert.ok(src.includes('পরীক্ষা, নম্বর মূল্যায়ন ও ডিজিটাল ফলাফল কেন্দ্র'), 'Bengali title must stay byte-identical');
  assert.ok(src.includes('Examination & Results Hub'), 'English title must stay byte-identical');
});
check('button handlers unchanged (marks / tabulation / web_results)', () => {
  for (const h of ["setActiveTab('marks')", "setActiveTab('tabulation')", "setActiveTab('web_results')"]) {
    assert.strictEqual((src.match(new RegExp(h.replace(/[()']/g, '\\$&'), 'g')) || []).length, 1, `${h} must appear exactly once`);
  }
});
check('button labels unchanged', () => {
  for (const l of ['নম্বর এন্ট্রি', 'Marks Entry', 'ট্যাবুলেশন শিট', 'Tabulation Sheet', 'অনলাইন রেজাল্ট', 'Web Results']) {
    assert.ok(src.includes(l), `button label "${l}" must stay`);
  }
});
check('KPI data wiring unchanged (same kpis fields, same formatNumber calls)', () => {
  for (const k of ['kpis.totalExamsCount', 'kpis.totalMarksEntries', 'kpis.evaluatedStudentsCount', 'kpis.passRate', 'kpis.gpa5Count', 'kpis.activeExamName']) {
    assert.ok(src.includes(k), `${k} must stay`);
  }
});
check('ExamManager / MarksEntry sub-tabs untouched (still rendered below the hero)', () => {
  assert.ok(src.includes('<ExamManager />'), '<ExamManager /> must stay');
  assert.ok(src.includes('<MarksEntry'), '<MarksEntry /> must stay');
});
check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:hero-exams'], 'tsx scripts/verify-hero-exams.ts',
    'npm run test:hero-exams must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: hero-exams self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
