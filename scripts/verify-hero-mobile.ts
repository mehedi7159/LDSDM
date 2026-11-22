/**
 * Mobile home hero — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06 + 18:14): every page hero looks
 * AI-generated, colours/backgrounds bad — and NO page may be missed,
 * the mobile home hero included. The StaffMobileApp hero is hand-rolled
 * (not PageHeader): one big flat brand-colour block with white text,
 * decorative white circles and glass tiles (bg-white/[0.16]) — the
 * classic AI-dashboard look.
 *
 * Fix (this branch): restyle the hero section ONLY, in place, to the
 * pinned light pattern from fix/hero-shared-pattern (white /
 * dark slate-900 card, slate border, dark title, muted subtitle, teal
 * accents from the theme tokens). No gradient, no glass, no decorative
 * circles, no emoji. Dark mode stays correct (every light surface
 * paired with its dark: class). Greeting strings, role titles, school
 * name, badge texts, role-switcher labels, quick-action labels/ids/
 * handlers stay byte-identical — only classes/structure change.
 * The active role-switcher button keeps white text on the solid brand
 * token (the one bare `text-white` left in the hero).
 *
 * Out of scope: every other `brand-grad` use in this file (flat teal
 * primary buttons/chips elsewhere — fine as-is) and everything outside
 * the hero section.
 *
 * Run: npx tsx scripts/verify-hero-mobile.ts
 *      (or npm run test:hero-mobile).
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

const src = readSource('components/StaffMobileApp.tsx');
const heroStart = src.indexOf('{/* HERO');
assert.ok(heroStart >= 0, 'hero section comment {/* HERO not found');
const heroEnd = src.indexOf('</section>', heroStart);
assert.ok(heroEnd > heroStart, 'hero </section> not found after HERO comment');
const hero = src.slice(heroStart, heroEnd);
const rest = src.slice(0, heroStart) + src.slice(heroEnd);

check('hero shell is a light card (white + dark slate-900, slate border)', () => {
  assert.ok(hero.includes('bg-white dark:bg-slate-900'), 'hero shell has bg-white dark:bg-slate-900');
  assert.ok(hero.includes('border border-slate-200/80 dark:border-slate-800'), 'hero shell has the slate border');
  assert.ok(hero.includes('rounded-3xl'), 'hero keeps rounded-3xl');
});

check('hero has no brand-grad (no solid brand-colour block)', () => {
  assert.ok(!hero.includes('brand-grad'), 'hero must not contain brand-grad');
});

check('hero has no glass classes', () => {
  for (const bad of ['bg-white/[', 'text-white/', 'border-white/', 'backdrop-blur']) {
    assert.ok(!hero.includes(bad), `hero must not contain ${bad}`);
  }
});

check('hero has no decorative absolute circle divs', () => {
  assert.ok(!hero.includes('absolute w-40'), 'first decorative circle must be gone');
  assert.ok(!hero.includes('absolute w-24'), 'second decorative circle must be gone');
  assert.ok(!hero.includes('absolute '), 'hero must not contain any absolute-positioned div');
});

check('hero text is dark/muted, not white-on-dark', () => {
  // The only bare text-white allowed is the active role-switcher button
  // (white text on the solid brand token). dark:text-white is fine.
  const withoutDark = hero.replaceAll('dark:text-white', '');
  const bareWhite = withoutDark.match(/text-white(?![/\w-])/g) || [];
  assert.strictEqual(bareWhite.length, 1, `hero must have exactly 1 bare text-white (active switcher button), found ${bareWhite.length}`);
  assert.ok(hero.includes('text-slate-900 dark:text-white'), 'role title is dark slate / dark-mode white');
  assert.ok(hero.includes('text-slate-500 dark:text-slate-400'), 'greeting / school name / labels are muted slate');
});

check('role badges are teal chips, not glass', () => {
  assert.ok(hero.includes('bg-teal-50 dark:bg-teal-500/10'), 'badge has teal-50 / dark teal-500/10');
  assert.ok(hero.includes('text-teal-700 dark:text-teal-300'), 'badge text is teal-700 / dark teal-300');
});

check('role switcher pill is light, active button is solid brand token', () => {
  assert.ok(hero.includes('bg-slate-100 dark:bg-slate-800'), 'switcher container is slate-100 / dark slate-800');
  assert.ok(hero.includes("backgroundColor: 'var(--color-brand)'"), 'active button uses the brand token');
  assert.ok(hero.includes('text-slate-600 dark:text-slate-300'), 'inactive button is muted slate');
});

check('quick-action tiles are light cards with teal icons', () => {
  assert.ok(hero.includes('bg-slate-50 dark:bg-slate-800/60'), 'tile has slate-50 / dark slate-800/60');
  assert.ok(hero.includes('border border-slate-200/80 dark:border-slate-700'), 'tile has the slate border');
  assert.ok(hero.includes('text-teal-600 dark:text-teal-400'), 'tile icon is teal-600 / dark teal-400');
  assert.ok(hero.includes('text-slate-700 dark:text-slate-200'), 'tile label is slate-700 / dark slate-200');
  assert.ok(hero.includes('min-h-[72px]'), 'tile keeps min-h-[72px] tap target');
});

check('greeting strings, role titles, school name, badges still present', () => {
  for (const s of [
    'todayGreeting.fullDateText',
    'roleTitleBengali[userRole]',
    'schoolProfile.nameBn',
    'roleBadges.map',
    'availableHomes.length > 1',
    "'আজকের সারসংক্ষেপ'",
    "'দ্রুত কাজ'",
  ]) {
    assert.ok(hero.includes(s), `hero must still contain ${s}`);
  }
});

check('quick-action tile count and handlers unchanged', () => {
  assert.ok(hero.includes("roleActions.filter(a => a.id !== 'notices')"), 'tile filter unchanged');
  assert.ok(hero.includes('handleOpenModule(a.moduleKey)'), 'tile handler unchanged');
  assert.ok(hero.includes('setPortalTabHint'), 'guardian portal hint unchanged');
  assert.ok(hero.includes("length === 3 ? 'grid-cols-3' : 'grid-cols-4'"), 'grid-cols logic unchanged');
  assert.ok(hero.includes('setHomeOverride(h); goHome();'), 'role-switcher handler unchanged');
});

check('hero has no gradient and no emoji', () => {
  assert.ok(!hero.toLowerCase().includes('gradient'), 'hero must not mention gradient');
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.ok(!emoji.test(hero), 'hero must not contain emoji');
});

check('other brand-grad uses elsewhere in the file are untouched (40)', () => {
  const count = (rest.match(/brand-grad/g) || []).length;
  assert.strictEqual(count, 40, `expected 40 brand-grad uses outside the hero, found ${count}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
