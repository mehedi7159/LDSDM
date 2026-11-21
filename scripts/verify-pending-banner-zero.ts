/**
 * Pending-approval banner must not render for 0 pending members — self-check
 * (21 Nov 2026, morning audit observation (a)).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-pending-banner-zero.ts
 *
 * Bug: the dashboard's amber "অনুমোদনের অপেক্ষায় N জন" banner rendered
 * when `pendingMembers.length > 0 || pendingMembersError`. A failed
 * refresh sets pendingMembersError even when the (cache) list is empty,
 * so the banner showed "অনুমোদনের অপেক্ষায় 0 জন — অনুমোদনের তালিকা
 * আপডেট হয়নি — পুরনো তালিকা দেখানো হচ্ছে।" with a Retry button — a
 * banner about nobody, with a retry for a list that has nothing in it.
 *
 * Fix contract (components/Dashboard.tsx, banner gate only):
 *  - The banner renders only when pendingMembers.length > 0. Zero
 *    pending members => no banner, even when the refresh failed (there
 *    is nothing to approve; the HR screen is the authoritative place).
 *  - The stale-list error text + "আবার চেষ্টা করুন" retry stay inside
 *    the banner, so a non-empty stale list still warns and can retry.
 *  - The admin-only gate (isOwnerAdmin / isSuperAdmin / role_principal)
 *    is untouched; no auth/login logic changes.
 *
 * The component is React, so this is covered by source-order assertions
 * (the repo's established grep-proof style).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

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

const dash = readSource('components/Dashboard.tsx');

// The banner block: from the "Pending approvals" comment to <MadrasaReports />.
const start = dash.indexOf('Pending approvals — admin notice card');
assert.ok(start >= 0, 'pending-approvals banner comment not found');
const end = dash.indexOf('<MadrasaReports />', start);
assert.ok(end > start, 'banner block end not found');
const block = dash.slice(start, end);

console.log('--- pending-approval banner gate (components/Dashboard.tsx) ---');

check('banner does NOT render on error alone (no "|| pendingMembersError" in the gate)', () => {
  const gate = block.split('\n').find(l => l.includes('pendingMembers.length > 0') && l.includes('&& ('));
  assert.ok(gate, 'banner gate line not found');
  assert.ok(!gate.includes('pendingMembersError'),
    `gate still shows the banner on error alone: ${gate.trim()}`);
});

check('banner DOES render when pendingMembers.length > 0', () => {
  assert.ok(block.includes('pendingMembers.length > 0'),
    'banner gate lost the pendingMembers.length > 0 condition');
});

check('admin-only gate untouched (owner / super-admin / principal)', () => {
  assert.ok(block.includes("isOwnerAdmin || isSuperAdmin || currentMember?.roleId === 'role_principal'"),
    'admin gate changed');
});

check('stale-list error + Retry stay inside the banner for a non-empty stale list', () => {
  assert.ok(block.includes('{pendingMembersError && ('), 'stale-list error block removed');
  assert.ok(block.includes('আবার চেষ্টা করুন'), 'Retry button label removed');
  assert.ok(block.includes('refreshPendingMembers()'), 'Retry handler removed');
});

check('heading still shows the pending count', () => {
  assert.ok(block.includes('অনুমোদনের অপেক্ষায় ${pendingMembers.length} জন'),
    'banner heading lost the count');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
