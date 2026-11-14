/**
 * verify-pwa-reload-button.ts — scripted proof that a deployed update can
 * actually reach a returning user, through a SMALL RELOAD BUTTON instead
 * of the full update banner (services worker 'prompt' flow).
 *
 * History: PR #22 restored the update banner (components/ui/
 * PwaUpdatePrompt.tsx) that commit e654bcc had gutted to `return null`.
 * On 14 Nov 2026 the principal asked for the banner to be replaced by
 * a small reload button in the top banner instead — same job: tapping it
 * applies the waiting update (SKIP_WAITING) and reloads onto the new
 * version. This script SUPERSEDES scripts/verify-pwa-update-banner.ts
 * (deleted with this change): it keeps that script's mount / boot-half /
 * no-force-reload checks, and replaces its banner-form checks with
 * reload-button checks.
 *
 * Checks:
 *   (1) The component really renders a reload button (not `return null`,
 *       not the old banner card): it watches the waiting worker (flag +
 *       registration + event), shows a small top-placed reload button
 *       (RotateCw icon, Bangla aria-label), and applies the update with
 *       SKIP_WAITING (plus the stamped-reload fallback). No "নতুন সংস্করণ
 *       এসেছে" heading, no "আপডেট করুন" text button, no dismiss control.
 *   (2) App.tsx imports and mounts it at the App root.
 *   (3) index.tsx still announces a waiting worker (flag + event) and
 *       reloads once on controllerchange — the other half of the loop.
 *   (4) vite.config still uses registerType 'prompt' (no autoUpdate /
 *       skipWaiting / clientsClaim — a deploy must never force-reload).
 *
 * A service worker cannot run under tsx, so these are source checks —
 * the same pattern the other verify scripts use for UI wiring — plus
 * `tsc` + `vite build` proving the component compiles and the button
 * strings land in the built bundle.
 *
 * Run: npx tsx scripts/verify-pwa-reload-button.ts
 * (or npm run test:pwa-reload-button).
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

const button = readSource('components/ui/PwaUpdatePrompt.tsx');
const app = readSource('App.tsx');
const boot = readSource('index.tsx');
const vite = readSource('vite.config.ts');
const pkg = JSON.parse(readSource('package.json'));

// (1) The component really renders a small reload button, not the old banner
check('(1) reload button is not a null stub', !/export function PwaUpdatePrompt\(\) \{\s*return null;\s*\}/.test(button), 'PwaUpdatePrompt still returns null');
check('(1) button watches the update-ready flag', button.includes('__ldsdmUpdateReady'), 'must read the flag set by index.tsx');
check('(1) button checks the waiting worker', button.includes('reg?.waiting') || button.includes('registration.waiting'), 'must check reg.waiting on mount');
check('(1) button listens for the update-ready event', button.includes("addEventListener('ldsdm:update-ready'"), 'must listen for ldsdm:update-ready');
check('(1) button is a small reload (refresh) icon button', button.includes('RotateCw'), 'must render a RotateCw reload icon');
check('(1) button sits at the top', /fixed top-\d/.test(button), 'must be fixed at the top of the screen');
check('(1) button has a Bangla accessible label', button.includes('নতুন সংস্করণ লোড করুন') || button.includes('রিলোড করুন'), 'must label the button in Bangla');
check('(1) button applies the update via SKIP_WAITING', button.includes("postMessage({ type: 'SKIP_WAITING' })"), 'must post SKIP_WAITING to the waiting worker');
check('(1) old banner heading is gone', !button.includes('নতুন সংস্করণ এসেছে'), 'the full banner heading must be replaced by the button');
check('(1) old update text button is gone', !button.includes('আপডেট করুন'), 'the "আপডেট করুন" text button must be replaced by the reload button');
check('(1) old dismiss control is gone', !button.includes('setVisible(false)'), 'no dismiss control — the small button stays until tapped');

// (2) Mounted at the App root
check('(2) App.tsx imports PwaUpdatePrompt', app.includes("import { PwaUpdatePrompt } from './components/ui/PwaUpdatePrompt'"), 'App.tsx must import the component');
check('(2) App.tsx mounts PwaUpdatePrompt', app.includes('<PwaUpdatePrompt />'), 'App.tsx must render <PwaUpdatePrompt />');
check('(2) mounted next to ToastContainer at the root', /<PwaUpdatePrompt \/>\s*<ToastContainer \/>/.test(app), 'component must sit next to ToastContainer at the App root');

// (3) The boot half of the loop is intact
check('(3) index.tsx sets the update-ready flag', boot.includes('__ldsdmUpdateReady = true'), 'index.tsx must set the flag');
check('(3) index.tsx dispatches the update-ready event', boot.includes("new CustomEvent('ldsdm:update-ready')"), 'index.tsx must dispatch the event');
check('(3) index.tsx reloads once on controllerchange', boot.includes("addEventListener('controllerchange'"), 'index.tsx must reload when the new worker takes control');

// (4) The no-force-reload policy still holds
check("(4) registerType is still 'prompt'", vite.includes("registerType: 'prompt'"), 'must stay prompt, never autoUpdate');
check('(4) no skipWaiting in the PWA config', !/skipWaiting\s*:\s*true/.test(vite), 'skipWaiting would force-reload open sessions');
check('(4) no clientsClaim in the PWA config', !/clientsClaim\s*:\s*true/.test(vite), 'clientsClaim would force-reload open sessions');

check('(5) package.json exposes the verify script',
  pkg.scripts['test:pwa-reload-button'] === 'tsx scripts/verify-pwa-reload-button.ts', 'npm run test:pwa-reload-button must run this script');

console.log(failures === 0 ? '\nALL PWA-RELOAD-BUTTON CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
