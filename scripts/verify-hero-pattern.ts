/**
 * Hero banner pattern — self-check (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06): every page's header/hero banner
 * looks AI-generated at first glance and the colours/backgrounds look
 * bad. The shared PageHeader 'brand' tone renders one big solid
 * brand-colour block with white text and glass chips (bg-white/10,
 * backdrop-blur, border-white/15) and the pages stuff rainbow KPI tiles
 * (cyan/amber/rose/indigo text) inside it — the classic AI-dashboard
 * look. Seven more pages hand-roll the same dark block (bg-slate-900)
 * instead of using the house component.
 *
 * Fix (this branch — the shared pattern only): the 'brand' tone becomes
 * a flat LIGHT hero on the same shell as the 'plain' tone (white /
 * dark slate-900 card, slate border, dark title, muted subtitle, teal
 * icon chip from the theme tokens). Same props API (title, subtitle,
 * eyebrow, icon, children, footer) — no call site changes in this
 * branch. The footer keeps its slot but gets a light divider instead
 * of the white/15 line. No gradient, no glass, no white-on-dark text,
 * no emoji. Dark mode stays correct (every light surface is paired
 * with its dark: class, per DESIGN_NOTES rule 1).
 *
 * Out of scope here (later branches): the per-page footer/children
 * classes (glass KPI tiles, rainbow values, glass buttons) and the
 * seven hand-rolled dark blocks — they are restyled page by page
 * after this pattern lands, and merged after it.
 *
 * Run: npx tsx scripts/verify-hero-pattern.ts
 *      (or npm run test:hero-pattern).
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

const header = readSource('components/ui/PageHeader.tsx');
const brandIdx = header.indexOf("if (tone === 'brand')");
assert.ok(brandIdx >= 0, 'PageHeader still has a brand tone branch');
// Brand return block: from the brand branch up to the plain `return (`
// (2-space indent at line start — the brand's own return is indented 4).
const plainReturnIdx = header.indexOf('\n  return (\n', brandIdx);
assert.ok(plainReturnIdx > brandIdx, 'plain-tone return found after brand branch');
const brandBlock = header.slice(brandIdx, plainReturnIdx);

check('brand tone renders a light surface (white + dark slate-900)', () => {
  assert.ok(brandBlock.includes('bg-white'), 'brand shell has bg-white');
  assert.ok(brandBlock.includes('dark:bg-slate-900'), 'brand shell has dark:bg-slate-900');
});

check('brand tone has no solid brand-colour block', () => {
  assert.ok(!brandBlock.includes("backgroundColor: 'var(--color-brand)'"),
    'brand shell must not set backgroundColor to var(--color-brand)');
});

check('brand tone has no glass-on-dark classes', () => {
  for (const bad of ['bg-white/10', 'bg-white/15', 'bg-white/20', 'border-white/', 'text-white/', 'backdrop-blur']) {
    assert.ok(!brandBlock.includes(bad), `brand block must not contain ${bad}`);
  }
});

check('brand tone title/subtitle are dark text, not white', () => {
  // dark:text-white (dark mode only) is fine; bare text-white is not.
  const lightOnly = brandBlock.replaceAll('dark:text-white', '');
  assert.ok(!/text-white(?![/])/.test(lightOnly), 'brand block must not contain bare text-white');
  assert.ok(brandBlock.includes('text-slate-800') || brandBlock.includes('text-slate-900'),
    'brand title uses dark slate text');
});

check('brand tone has no gradient', () => {
  assert.ok(!brandBlock.includes('gradient'), 'brand block must not contain gradient');
});

check('brand tone footer uses a light divider', () => {
  assert.ok(brandBlock.includes('border-slate-200'), 'footer divider is light slate');
  assert.ok(!brandBlock.includes('border-white/15'), 'no white/15 divider');
});

check('PageHeader has no emoji', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.ok(!emoji.test(header), 'PageHeader.tsx must not contain emoji');
});

check('brand tone keeps the same props API', () => {
  for (const prop of ['title', 'subtitle', 'eyebrow', 'icon', 'children', 'footer']) {
    assert.ok(header.includes(prop), `PageHeader still accepts ${prop}`);
  }
  assert.ok(brandBlock.includes('{footer &&'), 'brand tone still renders footer');
  assert.ok(brandBlock.includes('{children &&'), 'brand tone still renders children');
});

check('component doc no longer promises white text / glass controls', () => {
  const doc = header.slice(0, brandIdx);
  assert.ok(!doc.includes('white text'), 'doc must not say white text');
  assert.ok(!doc.includes('glass-style'), 'doc must not say glass-style');
  assert.ok(/light/i.test(doc), 'doc describes the light hero');
});

check('DESIGN_NOTES still calls brand the flat hero', () => {
  const notes = readSource('components/ui/index.ts');
  assert.ok(notes.includes("tone='brand'"), 'DESIGN_NOTES still documents brand tone');
  assert.ok(!notes.includes('dark hero'), 'DESIGN_NOTES must not call brand a dark hero');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
