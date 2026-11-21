/**
 * Local-snapshot empty state must not read as "no backups exist" — self-check
 * (21 Nov 2026, morning audit observation (c)).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-local-snapshot-label.ts
 *
 * Bug (wording, not data): the backup center's "স্বয়ংক্রিয় নিরাপত্তা
 * স্ন্যাপশট" list reads ONLY the local IndexedDB vault of THIS browser
 * (getAllIndexedDbSnapshots), while cloud snapshots live separately in
 * Firestore `cloud_snapshots` (shown in Diagnostics > Cloud Sync). On a
 * fresh browser/profile the local vault is empty, so the empty state
 * "এখনও কোনো অটোমেটিক স্ন্যাপশট ইতিহাস নেই।" read as if no snapshots
 * existed at all — while the cloud held 15–16 versions. No data was
 * missing; the label hid where the backups actually are.
 *
 * Fix contract (components/DataSecurityBackupCenter.tsx, copy only):
 *  - The empty state says this list is THIS DEVICE's local vault only,
 *    and that cloud snapshots are separate — visible in Diagnostics >
 *    ক্লাউড সিঙ্ক.
 *  - The count label says "লোকাল স্ন্যাপশট", not bare "স্ন্যাপশট".
 *  - The list source is untouched: still getAllIndexedDbSnapshots()
 *    (local vault); no cloud fetch is added here.
 *
 * The component is React, so this is covered by source assertions (the
 * repo's established grep-proof style).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
// Bengali "য়" can be typed precomposed (U+09DF) or as য + nukta —
// normalize both sides to NFC so string matches are not encoding-fragile.
const n = (s: string) => s.normalize('NFC');

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

const src = n(readSource('components/DataSecurityBackupCenter.tsx'));

// The snapshot-history section: from its heading to the table.
const start = src.indexOf(n('স্বয়ংক্রিয় নিরাপত্তা স্ন্যাপশট ও রোলব্যাক ইতিহাস'));
assert.ok(start >= 0, 'snapshot history section not found');
const section = src.slice(start, start + 6000);

console.log('--- local snapshot history labels (components/DataSecurityBackupCenter.tsx) ---');

check('empty state says this is THIS DEVICE’s local vault only', () => {
  assert.ok(section.includes(n('এই ডিভাইসের লোকাল ভল্টে')),
    'empty state does not say "এই ডিভাইসের লোকাল ভল্টে"');
});

check('empty state points to the separate cloud snapshots (Diagnostics)', () => {
  assert.ok(section.includes(n('ক্লাউড স্ন্যাপশট')) && section.includes('Diagnostics'),
    'empty state does not mention separate cloud snapshots in Diagnostics');
});

check('empty state no longer claims "no snapshot history at all"', () => {
  assert.ok(!section.includes(n('এখনও কোনো অটোমেটিক স্ন্যাপশট ইতিহাস নেই')),
    'old misleading empty text still present');
});

check('count label says "লোকাল স্ন্যাপশট"', () => {
  assert.ok(section.includes(n('টি লোকাল স্ন্যাপশট')),
    'count label does not say "লোকাল স্ন্যাপশট"');
});

check('list source untouched: still the local IndexedDB vault only', () => {
  assert.ok(src.includes('getAllIndexedDbSnapshots()'),
    'local vault loader changed');
  assert.ok(!section.includes('cloud_snapshots') && !section.includes('getCloudSnapshots'),
    'section now reads cloud snapshots (out of scope for this copy fix)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
