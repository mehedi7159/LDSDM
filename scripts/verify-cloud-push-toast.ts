/**
 * verify-cloud-push-toast.ts — scripted proof that a manual cloud push no
 * longer claims a backup was made (behaviour-live audit 13 Nov 2026,
 * new problem 9: Diagnostics says "0 cloud snapshot backups").
 *
 * The finding: the app auto-creates LOCAL snapshots, but cloud snapshots
 * (Firestore collection `cloud_snapshots`) are created ONLY by the
 * "Save Cloud Snapshot" button or automatically before a restore — there
 * is no automatic trigger, and nobody ever pressed the button, so the
 * collection is empty and Diagnostics truthfully reads 0. That part is
 * not broken code; making snapshots automatic needs Sagor's decision
 * (frequency, retention, cost), so it is NOT done here.
 *
 * What WAS broken: the manual-push button's success toast said (bn)
 * "সফলভাবে ক্লাউডে সমস্ত ডাটা সংরক্ষিত ও ব্যাকআপ তৈরি হয়েছে!" — a
 * backup was claimed, but forcePushToCloud only diff-pushes the live
 * store (main_store); it never calls saveCloudSnapshotToFirestore, so
 * the snapshots list still read 0 after a "successful backup". That is
 * a false cloud-success claim, against the register's rule that a
 * success message never appears before the cloud has confirmed that
 * exact thing. The fix rewords the toast to claim only the push.
 *
 * Checks:
 *   (1) forcePushToCloud never creates a cloud snapshot (no call to
 *       saveCloudSnapshotToFirestore in AppContext's push path).
 *   (2) The manual-push toast no longer claims a backup/snapshot was
 *       made, in either language.
 *   (3) The genuine snapshot toast (after a real snapshot save) is
 *       untouched, and snapshots are still created only from the
 *       snapshot button and the pre-restore safety path.
 *
 * Run: npx tsx scripts/verify-cloud-push-toast.ts
 * (or npm run test:cloud-push-toast).
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

const widget = readSource('components/CloudSyncWidget.tsx');
const appContext = readSource('context/AppContext.tsx');
const pkg = JSON.parse(readSource('package.json'));

// (1) A manual push does not create a snapshot — read the push path.
const pushStart = appContext.indexOf('const forcePushToCloud = async () => {');
const pushEnd = appContext.indexOf('const rebuildPublicPortalFromCloud', pushStart);
const pushBody = pushStart >= 0 && pushEnd > pushStart ? appContext.slice(pushStart, pushEnd) : '';
check('(1) forcePushToCloud body found', pushBody.length > 0, 'could not locate forcePushToCloud in AppContext');
check('(1) forcePushToCloud never calls saveCloudSnapshotToFirestore',
  pushBody.length > 0 && !pushBody.includes('saveCloudSnapshotToFirestore'),
  'a push that saved a snapshot would make the old toast true');
check('(1) forcePushToCloud does push the live store',
  pushBody.includes('pushDiffToCloud()'), 'the push must still save the live data to the cloud');

// (2) The manual-push toast claims only the push now.
{
  const manualStart = widget.indexOf('const handleManualPush = async () => {');
  const manualEnd = widget.indexOf('const executePullFromCloud', manualStart);
  const manualBody = manualStart >= 0 && manualEnd > manualStart ? widget.slice(manualStart, manualEnd) : '';
  check('(2) manual-push handler found', manualBody.length > 0, 'could not locate handleManualPush');
  check('(2) toast no longer claims a backup was made (bn)',
    manualBody.length > 0 && !manualBody.includes('ব্যাকআপ তৈরি হয়েছে'), 'must not claim ব্যাকআপ তৈরি হয়েছে');
  check('(2) toast no longer claims a snapshot was saved (en)',
    manualBody.length > 0 && !manualBody.includes('saved cloud snapshot'), 'must not claim a cloud snapshot was saved');
  check('(2) toast still confirms the push (bn)',
    manualBody.includes('সফলভাবে ক্লাউডে সমস্ত ডাটা সংরক্ষিত হয়েছে'), 'must still confirm the data reached the cloud');
  check('(2) toast still confirms the push (en)',
    manualBody.includes('Successfully pushed all records to the cloud'), 'must still confirm the data reached the cloud');
}

// (3) The genuine snapshot paths are untouched.
check('(3) snapshot button still saves a real snapshot',
  widget.includes('await saveCloudSnapshotToFirestore(undefined, note, note, adminEmail)'),
  'handleCreateSnapshot must still call saveCloudSnapshotToFirestore');
check('(3) real snapshot success toast is untouched',
  widget.includes('নতুন ক্লাউড স্ন্যাপশট ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে!'),
  'the genuine snapshot toast must stay');
const recovery = readSource('components/LocalDataRecoveryModal.tsx');
check('(3) pre-restore safety snapshot is untouched',
  recovery.includes('saveCloudSnapshotToFirestore(authoritativePayload'),
  'the pre-restore safety snapshot must stay');
check('(3) package.json exposes the verify script',
  pkg.scripts['test:cloud-push-toast'] === 'tsx scripts/verify-cloud-push-toast.ts', 'npm run test:cloud-push-toast must run this script');

console.log(failures === 0 ? '\nALL CLOUD-PUSH-TOAST CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
