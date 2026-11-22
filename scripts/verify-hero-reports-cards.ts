/**
 * Hero banners — Reports + ID-card pages — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06 + 18:14): every page's hero banner
 * looks AI-generated and the colours/backgrounds look bad; NO page may
 * be missed. The shared PageHeader 'brand' tone is being restyled to a
 * flat LIGHT hero on branch fix/hero-shared-pattern (merges FIRST).
 * These three pages still hand-roll their own dark hero blocks instead
 * of using the house component.
 *
 * Fix (this branch): replace the three hand-rolled dark hero blocks
 * with <PageHeader tone="brand"> and restyle their inner classes to
 * light (glass buttons -> light bordered buttons, solid light buttons
 * -> solid brand-token buttons, rainbow eyebrow/subtitle text -> muted
 * slate via the PageHeader props). Titles, subtitles, copy, numbers
 * and handlers stay byte-identical — only classes/structure change.
 *
 * Deliberately untouched: AdminReportView's white "Security Status Box",
 * StudentIDCardGenerator's ID-card / admit / testimonial PRINT preview
 * layouts, and every KPI card below the heroes.
 *
 * Run: npx tsx scripts/verify-hero-reports-cards.ts
 *      (or npm run test:hero-reports-cards).
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

const FILES = [
  'components/StudentReportView.tsx',
  'components/AdminReportView.tsx',
  'components/StudentIDCardGenerator.tsx',
] as const;
const src: Record<string, string> = {};
for (const f of FILES) src[f] = readSource(f);

// Hero slice: from the banner comment to the next section comment.
function heroSlice(file: string, startMarker: string, endMarker: string): string {
  const s = src[file];
  const start = s.indexOf(startMarker);
  assert.ok(start >= 0, `${file} still has its ${startMarker} marker`);
  const end = s.indexOf(endMarker, start);
  assert.ok(end > start, `${file} still has its ${endMarker} marker after the hero`);
  return s.slice(start, end);
}

const heroes: Record<string, string> = {
  'components/StudentReportView.tsx': heroSlice(
    'components/StudentReportView.tsx', '{/* Header Banner */}', '{/* KPI Stats Cards */}'),
  'components/AdminReportView.tsx': heroSlice(
    'components/AdminReportView.tsx', '{/* Header Banner */}', '{/* KPI Stats Cards */}'),
  'components/StudentIDCardGenerator.tsx': heroSlice(
    'components/StudentIDCardGenerator.tsx', '{/* Banner */}', '{/* Toolbar Filters */}'),
};

check('no dark hand-rolled hero block remains in any of the three files', () => {
  for (const f of FILES) {
    assert.ok(!src[f].includes('bg-slate-900 rounded-3xl p-6 text-white'),
      `${f} still has the dark slate hero block`);
    assert.ok(!src[f].includes('bg-teal-800 rounded-3xl p-6 text-white'),
      `${f} still has the dark teal hero block`);
  }
});

check('no glass-on-dark classes in any hero area', () => {
  for (const [f, hero] of Object.entries(heroes)) {
    for (const bad of ['bg-white/10', 'bg-white/5', 'bg-white/20', 'border-white/', 'backdrop-blur']) {
      assert.ok(!hero.includes(bad), `${f} hero must not contain ${bad}`);
    }
  }
});

check('no rainbow colours in any hero area', () => {
  for (const [f, hero] of Object.entries(heroes)) {
    for (const bad of [
      'text-cyan-300', 'text-amber-300', 'text-rose-300', 'text-indigo-300',
      'text-emerald-300', 'text-indigo-100', 'text-amber-400', 'text-blue-900',
      'border-indigo-500/20', 'bg-teal-600', 'bg-teal-700', 'bg-teal-800',
    ]) {
      assert.ok(!hero.includes(bad), `${f} hero must not contain ${bad}`);
    }
  }
});

check('all three files use <PageHeader tone="brand">', () => {
  for (const f of FILES) {
    assert.ok(src[f].includes("from './ui/PageHeader'"),
      `${f} must import PageHeader from ./ui/PageHeader`);
    assert.ok(src[f].includes('<PageHeader'), `${f} must render <PageHeader>`);
    assert.ok(src[f].includes('tone="brand"'), `${f} must use tone="brand"`);
  }
});

check('hero titles unchanged (same strings present)', () => {
  assert.ok(src['components/StudentReportView.tsx'].includes('শিক্ষার্থী রিপোর্ট ও পরিসংখ্যান'), 'student report BN title');
  assert.ok(src['components/StudentReportView.tsx'].includes('Student Comprehensive Report'), 'student report EN title');
  assert.ok(src['components/AdminReportView.tsx'].includes('প্রশাসনিক রিপোর্ট ও সিস্টেম বিবরণী'), 'admin report BN title');
  assert.ok(src['components/AdminReportView.tsx'].includes('Administrative & System Report'), 'admin report EN title');
  assert.ok(src['components/StudentIDCardGenerator.tsx'].includes('আইডি কার্ড, প্রবেশপত্র ও প্রশংসাপত্র'), 'ID card BN title');
  assert.ok(src['components/StudentIDCardGenerator.tsx'].includes('ID Cards, Admit Cards & Testimonials'), 'ID card EN title');
});

check('ID-card eyebrow + subtitle copy unchanged', () => {
  const s = src['components/StudentIDCardGenerator.tsx'];
  assert.ok(s.includes('ডকুমেন্ট ও কার্ড জেনারেটর'), 'ID card BN eyebrow');
  assert.ok(s.includes('Student Cards & Documents'), 'ID card EN eyebrow');
  assert.ok(s.includes('এক ক্লিকেই শিক্ষার্থীদের ডিজিটাল আইডি কার্ড, পরীক্ষার প্রবেশপত্র বা প্রত্যয়নপত্র তৈরি ও প্রিন্ট করুন।'), 'ID card BN subtitle');
  assert.ok(s.includes('Instantly generate and print official student ID cards, exam admit cards, and character certificates.'), 'ID card EN subtitle');
});

check('hero buttons kept their handlers, restyled to light / brand token', () => {
  assert.ok(src['components/StudentReportView.tsx'].includes('onClick={handleExportCSV}'), 'CSV export handler kept');
  assert.ok(src['components/StudentReportView.tsx'].includes('onClick={handlePrint}'), 'student report print handler kept');
  assert.ok(src['components/AdminReportView.tsx'].includes('onClick={handlePrint}'), 'admin report print handler kept');
  assert.ok(src['components/StudentIDCardGenerator.tsx'].includes('onClick={handlePrint}'), 'ID card print handler kept');
  // Solid primary buttons use the brand token, not a hardcoded colour.
  for (const [f, hero] of Object.entries(heroes)) {
    assert.ok(hero.includes("backgroundColor: 'var(--color-brand)'"),
      `${f} hero solid button must use var(--color-brand)`);
  }
});

check('no emoji in any hero area', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const [f, hero] of Object.entries(heroes)) {
    assert.ok(!emoji.test(hero), `${f} hero must not contain emoji`);
  }
});

check('AdminReportView Security Status Box untouched (white card)', () => {
  const s = src['components/AdminReportView.tsx'];
  assert.ok(s.includes('{/* Security Status Box */}'), 'security box marker present');
  assert.ok(s.includes('সিস্টেম ও সিকিউরিটি কনফিগারেশন চেকলিস্ট'), 'security box BN heading present');
  assert.ok(s.includes('System Governance & Security Matrix'), 'security box EN heading present');
});

check('ID-card / admit / testimonial PRINT preview markup untouched', () => {
  const s = src['components/StudentIDCardGenerator.tsx'];
  assert.ok(s.includes('<h2 className="text-lg font-black text-slate-900 uppercase">{schoolProfile.name}</h2>'),
    'ID-card preview school-name h2 present');
  assert.ok(s.includes('<h1 className="text-2xl font-black text-slate-900 tracking-tight">{schoolProfile.name}</h1>'),
    'testimonial preview school-name h1 present');
  assert.ok(s.includes('bg-teal-800 text-white p-3.5 text-center relative border-b-2 border-amber-400'),
    'ID-card preview teal header strip present');
});

check('KPI cards below the heroes untouched', () => {
  assert.ok(src['components/StudentReportView.tsx'].includes('মোট শিক্ষার্থী'), 'student KPI label present');
  assert.ok(src['components/AdminReportView.tsx'].includes('সিস্টেম ইউজার'), 'admin KPI label present');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
