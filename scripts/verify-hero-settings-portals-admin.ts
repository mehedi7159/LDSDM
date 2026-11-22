/**
 * Hero banners — Settings + Portals + Backup + SuperAdmin (22 Nov 2026).
 *
 * Problem (Sagor, 22 Nov 2026, 18:06 + 18:14 follow-up — NO page missed):
 * every page hero looks AI-generated at first glance; colours/backgrounds
 * look bad. The four hand-rolled dark hero blocks (bg-slate-900,
 * white text, glass KPI tiles, rainbow values) must become the shared
 * flat LIGHT pattern: <PageHeader tone="brand"> (white / dark slate-900
 * card, dark title, muted subtitle, teal icon chip from theme tokens;
 * footer wrapped with a light divider) with the light map applied to
 * the tiles/buttons inside. The pattern branch (fix/hero-shared-pattern)
 * merges FIRST; this branch only converts the four call sites.
 *
 * Scope — exactly these heroes:
 *  1. components/settings/ReportsSettingsManager.tsx — top hero + KPI tiles
 *  2. components/portals/PortalsServicesManager.tsx — master hero (~:645)
 *  3. components/portals/PortalsServicesManager.tsx — Public Result
 *     Simulator sub-hero (~:1299, an h2 section: light card IN PLACE,
 *     NOT a PageHeader)
 *  4. components/DataSecurityBackupCenter.tsx — top header + counters
 *  5. components/SuperAdminAuditPage.tsx — header banner
 *
 * Deliberately NOT touched (checked below): the white Module 1–4 cards
 * in the Backup centre, the white access-denied card in SuperAdmin,
 * the Guardian Portal Header Bar in Portals (~:839). Titles, subtitles,
 * numbers and handlers stay byte-identical — only classes/structure.
 *
 * Known allowlist: bare `text-white` survives ONLY on the solid accent
 * buttons (brand-token Quick Backup in Settings, teal-600 Sync in
 * Backup, brand-token refresh in SuperAdmin) — one each, zero elsewhere.
 *
 * Run: npx tsx scripts/verify-hero-settings-portals-admin.ts
 *      (or npm run test:hero-settings-portals-admin).
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

const settings = readSource('components/settings/ReportsSettingsManager.tsx');
const portals = readSource('components/portals/PortalsServicesManager.tsx');
const backup = readSource('components/DataSecurityBackupCenter.tsx');
const superAdmin = readSource('components/SuperAdminAuditPage.tsx');

// Hero region = from the hero comment to the next section comment.
// (Whole-file checks would false-positive on the untouched white cards
// and on other dark: classes that are correct in dark mode.)
function region(src: string, startAnchor: string, endAnchor: string, label: string): string {
  const start = src.indexOf(startAnchor);
  assert.ok(start >= 0, `${label}: start anchor not found: ${startAnchor}`);
  const end = src.indexOf(endAnchor, start);
  assert.ok(end > start, `${label}: end anchor not found after start: ${endAnchor}`);
  return src.slice(start, end);
}

const settingsHero = region(settings, 'TOP HERO BANNER & INSTITUTIONAL CONTROL BAR', 'UNIFIED SUB-TABS NAVIGATION BAR', 'settings hero');
const portalsHero = region(portals, '1. MASTER HEADER & SUITE HERO', 'SUB-TAB 1: GUARDIAN & STUDENT PORTAL', 'portals hero');
const portalsSubHero = region(portals, 'Public Result Simulator Header', 'Result Search Outcome', 'portals sub-hero');
const backupHero = region(backup, 'Top Header & Reassuring Badges', 'Real-time Status / Notification Alert', 'backup hero');
const superAdminHero = region(superAdmin, 'Header Banner', 'Control Toolbar', 'superadmin hero');
const heroes: Array<[string, string, number]> = [
  // [label, region text, allowed bare text-white count (solid accent buttons only)]
  ['settings hero', settingsHero, 1],
  ['portals hero', portalsHero, 0],
  ['portals sub-hero', portalsSubHero, 0],
  ['backup hero', backupHero, 1],
  ['superadmin hero', superAdminHero, 1],
];

// Bare (light-mode) class check: `dark:`-prefixed twins are correct dark mode.
const bare = (text: string, cls: string) =>
  new RegExp(`(?<!dark:)${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text);
const countBare = (text: string, cls: string) =>
  (text.match(new RegExp(`(?<!dark:)${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) || []).length;

for (const [label, text, allowedWhite] of heroes) {
  check(`${label}: no dark hero block (bare bg-slate-900)`, () => {
    assert.ok(!bare(text, 'bg-slate-900'), `${label} must not contain bare bg-slate-900`);
  });

  check(`${label}: no glass-on-dark classes`, () => {
    for (const bad of ['bg-white/10', 'bg-white/5', 'border-white/', 'backdrop-blur']) {
      assert.ok(!text.includes(bad), `${label} must not contain ${bad}`);
    }
  });

  check(`${label}: no rainbow hero text colours`, () => {
    // Bare light-mode rainbow values; dark: twins (e.g. dark:text-emerald-400)
    // are the correct dark-mode pairing and are allowed.
    for (const bad of [
      'text-cyan-300', 'text-amber-300', 'text-rose-300', 'text-indigo-300',
      'text-purple-300', 'text-blue-300', 'text-teal-200', 'text-teal-300',
      'text-emerald-300', 'text-emerald-400', 'text-indigo-200', 'text-slate-300'
    ]) {
      assert.ok(!bare(text, bad), `${label} must not contain bare ${bad}`);
    }
  });

  check(`${label}: bare text-white only on solid accent button(s)`, () => {
    const n = countBare(text, 'text-white');
    assert.strictEqual(n, allowedWhite, `${label} has ${n} bare text-white, expected ${allowedWhite}`);
  });

  check(`${label}: no gradient, no emoji`, () => {
    assert.ok(!text.includes('gradient'), `${label} must not contain gradient`);
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    assert.ok(!emoji.test(text), `${label} must not contain emoji`);
  });
}

check('PageHeader tone="brand" used in all four files', () => {
  for (const [file, src] of [
    ['ReportsSettingsManager.tsx', settings],
    ['PortalsServicesManager.tsx', portals],
    ['DataSecurityBackupCenter.tsx', backup],
    ['SuperAdminAuditPage.tsx', superAdmin],
  ] as const) {
    assert.ok(src.includes('<PageHeader'), `${file} must use <PageHeader`);
    assert.ok(src.includes('tone="brand"'), `${file} must use tone="brand"`);
    assert.ok(src.includes("from './ui/PageHeader'") || src.includes("from '../ui/PageHeader'") || src.includes("from '../../ui/PageHeader'"),
      `${file} must import PageHeader`);
  }
  // The portals sub-hero is an h2 section, NOT a page title: exactly one
  // PageHeader in PortalsServicesManager (the master hero).
  assert.strictEqual((portals.match(/<PageHeader/g) || []).length, 1,
    'PortalsServicesManager must have exactly one <PageHeader (sub-hero stays a light card)');
  // The sub-hero is a light card, not a dark block.
  assert.ok(portalsSubHero.includes('bg-white'), 'sub-hero must be a light card (bg-white)');
  assert.ok(portalsSubHero.includes('dark:bg-slate-900'), 'sub-hero must pair with dark:bg-slate-900');
});

check('titles unchanged (same strings present)', () => {
  for (const [file, src, titles] of [
    ['ReportsSettingsManager.tsx', settings, ['মাদ্রাসা ব্যবস্থাপনা সিস্টেম', 'Madrasah Management', 'schoolProfile.nameBn']],
    ['PortalsServicesManager.tsx', portals, ['পোর্টাল, এসএমএস ও বিশেষ সেবা কেন্দ্র', 'Portals, SMS & Special Services Hub',
      'পাবলিক রেজাল্ট পোর্টাল ও তাত্ক্ষণিক ভেরিফিকেশন', 'Public Result Search & Instant Verification']],
    ['DataSecurityBackupCenter.tsx', backup, ['ডাটা সুরক্ষা, ব্যাকআপ ও রিস্টোর কেন্দ্র']],
    ['SuperAdminAuditPage.tsx', superAdmin, ['সুপার এডমিন কন্ট্রোল ও অডিট লগ', 'Super Admin Security Audit']],
  ] as const) {
    for (const t of titles) assert.ok(src.includes(t), `${file} must still contain title ${t}`);
  }
});

check('Backup Module 1–4 white cards untouched', () => {
  assert.ok(backup.includes('4 Core Essential Action Modules'), 'module section comment must survive');
  assert.strictEqual(
    (backup.match(/bg-white dark:bg-slate-900 rounded-3xl p-6 border/g) || []).length, 5,
    'all 5 white module cards must survive byte-identical');
});

check('SuperAdmin access-denied white card untouched', () => {
  assert.ok(superAdmin.includes('bg-white rounded-3xl p-8 border border-rose-200'), 'denied card must survive');
  assert.ok(superAdmin.includes('অ্যাক্সেস সংরক্ষিত') && superAdmin.includes('Restricted Access'),
    'denied card copy must survive');
});

check('Portals Guardian Portal Header Bar untouched', () => {
  assert.ok(portals.includes('Guardian Portal Header Bar'), 'guardian header comment must survive');
  assert.ok(portals.includes('bg-teal-700 p-6 text-white'), 'guardian header teal bar must survive');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
