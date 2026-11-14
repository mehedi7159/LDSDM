/**
 * verify-pwa-update-banner.ts — scripted proof that a deployed update can
 * actually reach a returning user (services worker 'prompt' flow).
 *
 * The bug (behaviour-live audit 13 Nov 2026): 53 fixes were code-live in
 * the deployed bundle, but the audited browser tab still ran pre-fix code
 * — fee totals matched the PRE-Fix-#4 formulas to the taka on live data
 * (dashboard/banner ৳177,800 = old current-month-only total, fee card
 * ৳193,200 = old inline (tuition || 700) total; the shared total on the
 * same live data is ৳1,955,800), and pass rates matched the PRE-Fix-#5
 * denominators. The tab was a saved session running an old build.
 *
 * Root cause: commit e654bcc (31 Oct 2026, "remove AI advisor and unused
 * dashboard modules") gutted components/ui/PwaUpdatePrompt.tsx to
 * `return null` and removed its mount in App.tsx. The 'prompt' update
 * flow (vite.config registerType 'prompt', 29 Oct 2026 — never
 * force-reload) depends on that banner: a new build only downloads into
 * a WAITING service worker, and NOTHING reloads until the user taps
 * "আপডেট করুন" (SKIP_WAITING). With no banner, the waiting worker never
 * takes over — a returning tab keeps the old precached index.html and
 * chunks across reloads, forever. The index.tsx watcher (flag +
 * 'ldsdm:update-ready' event) fires into the void.
 *
 * This fix restores the banner verbatim from a6b83b5 (the commit that
 * introduced the user-tapped update flow) and re-mounts it at the App
 * root, next to ToastContainer, so it shows for every role and tab.
 * It does NOT change the no-force-reload policy: nothing reloads until
 * the user taps update; dismissing ("পরে") only hides it for the session.
 *
 * Checks:
 *   (1) The banner component renders a banner (not `return null`): it
 *       watches the waiting worker (flag + registration + event), shows
 *       "নতুন সংস্করণ এসেছে" with "আপডেট করুন" / "পরে", and applies the
 *       update with SKIP_WAITING (plus the stamped-reload fallback).
 *   (2) App.tsx imports and mounts it at the App root.
 *   (3) index.tsx still announces a waiting worker (flag + event) and
 *       reloads once on controllerchange — the other half of the loop.
 *   (4) vite.config still uses registerType 'prompt' (no autoUpdate /
 *       skipWaiting / clientsClaim — a deploy must never force-reload).
 *
 * A service worker cannot run under tsx, so these are source checks —
 * the same pattern the other verify scripts use for UI wiring — plus
 * `tsc` + `vite build` proving the restored component compiles and the
 * banner strings land in the built bundle.
 *
 * Run: npx tsx scripts/verify-pwa-update-banner.ts
 * (or npm run test:pwa-update-banner).
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

const banner = readSource('components/ui/PwaUpdatePrompt.tsx');
const app = readSource('App.tsx');
const boot = readSource('index.tsx');
const vite = readSource('vite.config.ts');
const pkg = JSON.parse(readSource('package.json'));

// (1) The banner component really renders a banner
check('(1) banner is not a null stub', !/export function PwaUpdatePrompt\(\) \{\s*return null;\s*\}/.test(banner), 'PwaUpdatePrompt still returns null');
check('(1) banner watches the update-ready flag', banner.includes('__ldsdmUpdateReady'), 'must read the flag set by index.tsx');
check('(1) banner checks the waiting worker', banner.includes('reg?.waiting') || banner.includes('registration.waiting'), 'must check reg.waiting on mount');
check('(1) banner listens for the update-ready event', banner.includes("addEventListener('ldsdm:update-ready'"), 'must listen for ldsdm:update-ready');
check('(1) banner shows the new-version heading', banner.includes('নতুন সংস্করণ এসেছে'), 'must show নতুন সংস্করণ এসেছে');
check('(1) banner has the update button', banner.includes('আপডেট করুন'), 'must offer আপডেট করুন');
check('(1) banner applies the update via SKIP_WAITING', banner.includes("postMessage({ type: 'SKIP_WAITING' })"), 'must post SKIP_WAITING to the waiting worker');
check('(1) banner dismiss only hides it for the session', banner.includes('setVisible(false)'), 'dismiss must only hide the banner');

// (2) Mounted at the App root
check('(2) App.tsx imports PwaUpdatePrompt', app.includes("import { PwaUpdatePrompt } from './components/ui/PwaUpdatePrompt'"), 'App.tsx must import the banner');
check('(2) App.tsx mounts PwaUpdatePrompt', app.includes('<PwaUpdatePrompt />'), 'App.tsx must render <PwaUpdatePrompt />');
check('(2) mounted next to ToastContainer at the root', /<PwaUpdatePrompt \/>\s*<ToastContainer \/>/.test(app), 'banner must sit next to ToastContainer at the App root');

// (3) The boot half of the loop is intact
check('(3) index.tsx sets the update-ready flag', boot.includes('__ldsdmUpdateReady = true'), 'index.tsx must set the flag');
check('(3) index.tsx dispatches the update-ready event', boot.includes("new CustomEvent('ldsdm:update-ready')"), 'index.tsx must dispatch the event');
check('(3) index.tsx reloads once on controllerchange', boot.includes("addEventListener('controllerchange'"), 'index.tsx must reload when the new worker takes control');

// (4) The no-force-reload policy still holds
check("(4) registerType is still 'prompt'", vite.includes("registerType: 'prompt'"), 'must stay prompt, never autoUpdate');
check('(4) no skipWaiting in the PWA config', !/skipWaiting\s*:\s*true/.test(vite), 'skipWaiting would force-reload open sessions');
check('(4) no clientsClaim in the PWA config', !/clientsClaim\s*:\s*true/.test(vite), 'clientsClaim would force-reload open sessions');

check('(5) package.json exposes the verify script',
  pkg.scripts['test:pwa-update-banner'] === 'tsx scripts/verify-pwa-update-banner.ts', 'npm run test:pwa-update-banner must run this script');

console.log(failures === 0 ? '\nALL PWA-UPDATE-BANNER CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
