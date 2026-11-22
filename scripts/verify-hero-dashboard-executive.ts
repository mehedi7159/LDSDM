/**
 * Hero banners — Dashboard + Executive — light professional pattern
 * (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06 + 18:14 follow-up — NO page may be
 * missed): every page hero looks AI-generated, colours/backgrounds look
 * bad. The shared pattern is pinned in branch fix/hero-shared-pattern
 * (PageHeader 'brand' = flat LIGHT hero: white / dark slate-900 card,
 * dark title, muted subtitle, teal icon chip from theme tokens; footer
 * wrapped with its own light divider). That branch merges FIRST.
 *
 * Fix (this branch, call-site classes ONLY): update the hero/footer/
 * children classes in DashboardDailyOverview.tsx and
 * ExecutiveInstitutionalDashboard.tsx so they read correctly on the
 * light hero — glass tiles/pills become flat light tiles/pills with a
 * dark: pairing, rainbow value colours become slate/semantic, the white
 * button becomes the solid brand token. Titles, subtitles, numbers,
 * handlers and every data expression stay byte-identical; the native
 * <option> classes (bg-slate-900 text-white) stay — native dropdown.
 *
 * 22 Nov 2026 update (Dashboard unify): the session/exam selectors
 * moved OUT of the Dashboard hero into the Dashboard's academic
 * section ('একাডেমিক চিত্র'), next to the cards they filter, and a
 * class selector joined them. The checks below follow them there —
 * the hero keeps only the live badge. Copy, option classes and
 * handlers are byte-identical; only the location changed.
 *
 * Scope of every check: the PageHeader block only (from `<PageHeader`
 * to `</PageHeader>` in each file), so the rest of the page — which is
 * already light — cannot trip or mask a check.
 *
 * Run: npx tsx scripts/verify-hero-dashboard-executive.ts
 *      (or npm run test:hero-dashboard-executive).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const readSource = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

/** The hero block: from the opening <PageHeader to its closing tag. */
function heroBlock(src: string, file: string): string {
  const start = src.indexOf('<PageHeader');
  assert.ok(start >= 0, `${file}: no <PageHeader found`);
  const end = src.indexOf('</PageHeader>', start);
  assert.ok(end >= 0, `${file}: no </PageHeader> found`);
  return src.slice(start, end + '</PageHeader>'.length);
}

const dashboard = readSource('components/DashboardDailyOverview.tsx');
const executive = readSource('components/ExecutiveInstitutionalDashboard.tsx');
const dashPage = readSource('components/Dashboard.tsx');
const dashHero = heroBlock(dashboard, 'DashboardDailyOverview.tsx');
const execHero = heroBlock(executive, 'ExecutiveInstitutionalDashboard.tsx');

/** The Dashboard academic section: from its header to MadrasaReports. */
function academicSection(src: string): string {
  const start = src.indexOf('একাডেমিক চিত্র');
  assert.ok(start >= 0, 'Dashboard.tsx: no একাডেমিক চিত্র section found');
  const end = src.indexOf('<MadrasaReports />', start);
  assert.ok(end >= 0, 'Dashboard.tsx: no <MadrasaReports /> found');
  return src.slice(start, end);
}
const dashAcademic = academicSection(dashPage);

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

const GLASS = /bg-white\/(10|5)|border-white\//;
// Rainbow = light-mode value colours only; dark: variants (e.g. the
// pinned pill's dark:text-emerald-300) are the correct dark pairing.
const RAINBOW = /(?<!dark:)text-(cyan|amber|rose|indigo|emerald)-300/;
const BLUR = /backdrop-blur/;

// --- Dashboard hero: glass / rainbow / blur gone ---
check('Dashboard hero: no glass bg/border (bg-white/10, bg-white/5, border-white/)', () => {
  assert.ok(!GLASS.test(dashHero), `still has glass class: ${dashHero.match(GLASS)?.[0]}`);
});
check('Dashboard hero: no rainbow value colours (text-*-300)', () => {
  assert.ok(!RAINBOW.test(dashHero), `still has rainbow class: ${dashHero.match(RAINBOW)?.[0]}`);
});
check('Dashboard hero: no backdrop-blur', () => {
  assert.ok(!BLUR.test(dashHero), 'still has backdrop-blur');
});
check('Dashboard hero: footer grid has no own dark divider (pt-5 mt-5 border-t border-white/15)', () => {
  assert.ok(!dashHero.includes('border-t border-white/15'), 'footer still carries its own dark divider');
  assert.ok(!dashHero.includes('pt-5 mt-5 border-t'), 'footer still carries pt-5 mt-5 border-t');
});

// --- Executive hero: glass / rainbow / blur gone ---
check('Executive hero: no glass bg/border (bg-white/10, bg-white/5, border-white/)', () => {
  assert.ok(!GLASS.test(execHero), `still has glass class: ${execHero.match(GLASS)?.[0]}`);
});
check('Executive hero: no rainbow value colours (text-*-300)', () => {
  assert.ok(!RAINBOW.test(execHero), `still has rainbow class: ${execHero.match(RAINBOW)?.[0]}`);
});
check('Executive hero: no backdrop-blur', () => {
  assert.ok(!BLUR.test(execHero), 'still has backdrop-blur');
});

// --- Dashboard hero: light replacements present ---
check('Dashboard hero: quick-action tiles are flat light tiles with teal hover border', () => {
  assert.ok(dashHero.includes('bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-500'), 'light quick-action tile class missing');
  assert.ok(dashHero.includes('text-slate-700 dark:text-slate-200'), 'light tile text class missing');
});
check('Dashboard hero: "সিস্টেম সক্রিয়" pill is light emerald', () => {
  for (const frag of ['bg-emerald-50 dark:bg-emerald-500/10', 'text-emerald-700 dark:text-emerald-300', 'border border-emerald-200 dark:border-emerald-500/30']) {
    assert.ok(dashHero.includes(frag), `light emerald pill fragment missing: ${frag}`);
  }
});
check('Dashboard hero: no selector pills anymore (moved to academic section)', () => {
  assert.ok(!dashHero.includes("'সেশন:'"), 'session selector still in the hero');
  assert.ok(!dashHero.includes("'পরীক্ষা:'"), 'exam selector still in the hero');
  assert.ok(!dashHero.includes('value={selectedAcademicYear}'), 'session <select> still in the hero');
  assert.ok(!dashHero.includes("value={selectedExamId || ''}"), 'exam <select> still in the hero');
});
check('Academic section: session/exam/class selector pills are light', () => {
  const pills = dashAcademic.match(/bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/g);
  assert.ok(pills && pills.length >= 3, `expected 3 light selector pills, found ${pills?.length ?? 0}`);
  const texts = dashAcademic.match(/text-slate-700 dark:text-slate-200/g);
  assert.ok(texts && texts.length >= 3, `expected selector pill text in 3 pills, found ${texts?.length ?? 0}`);
});

// --- Executive hero: light replacements present ---
check('Executive hero: exam switcher is a light pill with teal icon', () => {
  assert.ok(execHero.includes('bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'), 'light exam switcher pill missing');
  assert.ok(execHero.includes('text-teal-600 dark:text-teal-400'), 'teal switcher icon missing');
});
check('Executive hero: report button is the solid brand token', () => {
  assert.ok(execHero.includes("backgroundColor: 'var(--color-brand)'"), 'brand solid button style missing');
  assert.ok(execHero.includes('text-white font-black'), 'brand button white text missing');
});

// --- Unchanged: titles, subtitles, copy, data expressions ---
check('Dashboard hero: title/subtitle expressions unchanged', () => {
  assert.ok(dashHero.includes("schoolProfile.nameBn || schoolProfile.name || (isBn ? 'মাদ্রাসা ম্যানেজমেন্ট সিস্টেম' : 'Madrasah Management')"), 'title expression changed');
  assert.ok(dashHero.includes('formattedToday'), 'subtitle date expression changed');
});
check('Dashboard hero: quick-action data + handlers unchanged', () => {
  assert.ok(dashHero.includes('heroActions.map((act)'), 'heroActions data expression changed');
  assert.ok(dashHero.includes('onNavigate(act.id)'), 'quick-action handler changed');
  assert.ok(dashHero.includes("'সিস্টেম সক্রিয়'"), '"সিস্টেম সক্রিয়" copy changed');
});
check('Academic section: selector copy unchanged (সেশন / পরীক্ষা / শ্রেণি)', () => {
  assert.ok(dashAcademic.includes("'সেশন:'"), '"সেশন:" copy changed');
  assert.ok(dashAcademic.includes("'পরীক্ষা:'"), '"পরীক্ষা:" copy changed');
  assert.ok(dashAcademic.includes("'শ্রেণি:'"), '"শ্রেণি:" copy missing');
  assert.ok(dashAcademic.includes("'সকল সেশন'"), '"সকল সেশন" copy changed');
  assert.ok(dashAcademic.includes("'সকল শ্রেণি'"), '"সকল শ্রেণি" copy missing');
});
check('Executive hero: title/subtitle/copy/handlers unchanged', () => {
  assert.ok(execHero.includes("schoolProfile?.name || 'মাদ্রাসা ম্যানেজমেন্ট'"), 'title expression changed');
  assert.ok(execHero.includes("'সক্রিয় পরীক্ষা'"), '"সক্রিয় পরীক্ষা" copy changed');
  assert.ok(execHero.includes("'গ্রাফিক্যাল রিপোর্ট'"), '"গ্রাফিক্যাল রিপোর্ট" copy changed');
  assert.ok(execHero.includes("onNavigate('academic_reports')"), 'report button handler changed');
  assert.ok(execHero.includes('selectedExamId'), 'exam switcher binding changed');
});
check('Both heroes: native <option> dropdown classes stay dark (bg-slate-900 text-white)', () => {
  assert.ok(dashAcademic.includes('bg-slate-900 text-white'), 'Dashboard academic <option> classes changed');
  assert.ok(execHero.includes('bg-slate-900 text-white'), 'Executive <option> classes changed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
