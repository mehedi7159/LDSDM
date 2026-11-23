/**
 * verify-cloud-sync-root-cause.ts — scripted proof for the cloud-sync
 * root-cause fix (Branch: fix/cloud-sync-root-cause, 23 Nov 2026).
 *
 * Sagor's words: "system theke cloud-e kisu jacche na" — nothing
 * reaches the cloud. Three symptoms on his PC (23 Nov 18:04):
 *   (a) Arafat's staff card carries the amber 'cloud-এ যায়নি' badge;
 *   (b) the dashboard-arrange panel says "এই ডিভাইসে সংরক্ষিত হয়েছে
 *       — ক্লাউডে যায়নি, পরে আবার চেষ্টা হবে";
 *   (c) the approval list banner says "অনুমোদনের তালিকা আপডেট হয়নি".
 *
 * Diagnosis (code-read, main 4d6d06ce):
 *   (b) ROOT CAUSE, code: saveDashboardLayout() catches every failure
 *       and returns 'local' — but NOTHING ever retries it. The panel
 *       promises "পরে আবার চেষ্টা হবে" (will retry later), yet the only
 *       retry was the next manual tap. One failed save stayed local
 *       forever. Fix: retryDashboardLayoutCloudSave() + the panel calls
 *       it on mount (when the cloud load did not come from cloud), on
 *       'online', and on tab-visible — only while the last status is
 *       'local'.
 *   (c) ROOT CAUSE, code: getAllInstitutionMembers() races Firestore
 *       with a 2-SECOND timeout. On any slow/cold connection the read
 *       trips it, cloudOk=false, and the banner false-alarms even when
 *       the cloud is fine. Fix: 10 s for the members list fetch and
 *       the single-member fetch. The onSnapshot listener (no timeout)
 *       still clears the banner when the live feed lands.
 *   (a) NOT a missing retry: the payload queue ALREADY auto-retries on
 *       mount, tab-visible, online and login (AppContext). A badge that
 *       stays means the retry keeps failing ON THAT PC — the exact
 *       error is only visible in that PC's Diagnostics (last retry
 *       error). No code change can force that PC's retry to succeed;
 *       the manual step is in the report. This script therefore checks
 *       that the queue auto-retry wiring is still intact.
 *
 * What must NOT change: no auth/login, no Firestore rules, no
 * result/marksheet files, no data; the Discard button (SettingsPage
 * draft bar) still only resets unsaved preference draft — it never
 * touches the payload queue; the honest 'local' status text stays.
 *
 * Checks:
 *   (1) retryDashboardLayoutCloudSave is exported from the model.
 *   (2) With no local layout it returns 'none' (no Firestore touched).
 *   (3) With a local layout it delegates to saveDashboardLayout.
 *   (4) The arrange panel retries on mount when the cloud load did
 *       not come from cloud.
 *   (5) The panel retries on 'online' + tab-visible while status is
 *       'local'.
 *   (6) The panel still shows the honest 'local' status text.
 *   (7) rbac members fetches use a 10 s timeout (list + single).
 *   (8) The payload-queue auto-retry wiring is intact (mount,
 *       visibilitychange, online, authUser).
 *   (9) The layout save still has the 15 s cloud bound + local
 *       fallback (never a false "saved").
 *   (10) package.json exposes this verify script.
 *
 * Run: npx tsx scripts/verify-cloud-sync-root-cause.ts
 * (or npm run test:cloud-sync-root-cause).
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

// In-memory localStorage stand-in (same as verify-dashboard-layout.ts).
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

const model = await import('../services/dashboardLayout.ts');
const modelSrc = readSource('services/dashboardLayout.ts');
const panelSrc = readSource('components/DashboardArrangePanel.tsx');
const rbacSrc = readSource('services/rbac.ts');
const appContextSrc = readSource('context/AppContext.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) The retry helper exists.
check(
  '(1) retryDashboardLayoutCloudSave is exported',
  typeof (model as any).retryDashboardLayoutCloudSave === 'function'
);

// (2) No local layout -> 'none' (no Firestore touched: nothing is in
// localStorage, so the helper must return before any cloud call).
const retryFn = (model as any).retryDashboardLayoutCloudSave;
const noneResult = typeof retryFn === 'function' ? await retryFn('user-no-layout') : 'missing';
check("(2) retry returns 'none' with no local layout", noneResult === 'none', `got ${noneResult}`);

// (3) With a local layout it delegates to saveDashboardLayout.
check(
  '(3) retry delegates to saveDashboardLayout',
  /export async function retryDashboardLayoutCloudSave[\s\S]*?saveDashboardLayout\(userId, local\)/.test(modelSrc)
);

// (4) The arrange panel retries on mount when the cloud load did not
// come from cloud.
check(
  '(4) panel retries on mount when load source is not cloud',
  /loadDashboardLayout\(userId\)\.then\(\(\{\s*layout:\s*\w+,\s*source\s*\}\)[\s\S]*?source !== 'cloud'[\s\S]*?retryDashboardLayoutCloudSave/.test(panelSrc)
);

// (5) The panel retries on 'online' + tab-visible while status is 'local'.
check(
  "(5) panel retries on 'online'",
  panelSrc.includes("addEventListener('online'") && panelSrc.includes('retryDashboardLayoutCloudSave')
);
check(
  "(5) panel retries on tab-visible",
  panelSrc.includes("addEventListener('visibilitychange'") && panelSrc.includes('retryDashboardLayoutCloudSave')
);
check(
  "(5) background retry only while status is 'local'",
  /saveStatusRef\.current === 'local'/.test(panelSrc)
);

// (6) The honest 'local' status text is unchanged.
check(
  "(6) honest 'local' status text stays",
  panelSrc.includes('এই ডিভাইসে সংরক্ষিত হয়েছে — ক্লাউডে যায়নি, পরে আবার চেষ্টা হবে')
);

// (7) Members fetches use a 10 s timeout (list + single member).
check(
  '(7) members list fetch timeout is 10 s',
  /withTimeout\(getDocs\(membersCol\),\s*10000/.test(rbacSrc),
  'still 2000?'
);
check(
  '(7) single member fetch timeout is 10 s',
  /withTimeout\(getDoc\(memberDocRef\),\s*10000/.test(rbacSrc),
  'still 2000?'
);
check(
  '(7) no 2000 ms members fetch remains',
  !/withTimeout\(getDocs\(membersCol\),\s*2000/.test(rbacSrc) &&
    !/withTimeout\(getDoc\(memberDocRef\),\s*2000/.test(rbacSrc)
);

// (8) Payload-queue auto-retry wiring is intact.
check(
  '(8) retry runs on mount',
  /useEffect\(\(\) => \{\s*\n?\s*retryPendingCloudConfirms\(\);/.test(appContextSrc)
);
check(
  "(8) retry runs on tab-visible",
  appContextSrc.includes("document.addEventListener('visibilitychange', onVisible)")
);
check(
  "(8) retry runs on 'online'",
  appContextSrc.includes("window.addEventListener('online', onOnline)")
);
check(
  '(8) retry runs on login',
  /if \(authUser\) retryPendingCloudConfirms\(\);/.test(appContextSrc)
);

// (9) The layout save still has the 15 s cloud bound + local fallback.
check(
  '(9) layout cloud write still bounded at 15 s',
  /CLOUD_TIMEOUT_MS = 15000/.test(modelSrc)
);
check(
  '(9) layout save still falls back to local on any failure',
  /catch \{\s*\n?\s*\/\/ Layout is already safe locally/.test(modelSrc)
);

// (10) package.json exposes this script.
check(
  '(10) package.json exposes test:cloud-sync-root-cause',
  pkg.scripts?.['test:cloud-sync-root-cause'] === 'tsx scripts/verify-cloud-sync-root-cause.ts'
);

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
