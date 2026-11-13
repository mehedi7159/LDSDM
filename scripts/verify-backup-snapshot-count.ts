/**
 * Backup snapshot count — self-check (12 Nov 2026, base commit fba1bb8).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-backup-snapshot-count.ts
 * (or npm run test:backup-snapshot-count).
 *
 * Bug: backup snapshots (7 versions, 9–11 Nov) all showed 174 students
 * while the Diagnostics live count was 173.
 *
 * Root cause: every snapshot path counts through
 * extractSystemCounts() (services/multiStorePersistence.ts) — local
 * vault (saveToIndexedDbVault), cloud_snapshots
 * (saveCloudSnapshotToFirestore), Firestore authoritative snapshot
 * (fetchFirestoreAuthoritativeSnapshot → Drive incremental sync +
 * download), Drive full backup (uploadBackupToGoogleDrive) and the
 * downloaded full backup — and it counted payload.students.length
 * raw, with no trash exclusion. Diagnostics, by contrast, shows
 * AppContext state, which applyRemoteData() filters first:
 * students whose id appears in trashBin (t.id or t.data.id) are
 * removed before setStudents. So a student deleted to trash but
 * still present in the stored students array was counted in every
 * snapshot (174) while live showed 173.
 *
 * Fix: extractSystemCounts() excludes trashed students (and, by the
 * same applyRemoteData rule, trashed teachers) — the single choke
 * point, so all snapshot/backup paths agree with Diagnostics.
 * No backup/restore behaviour, no data deletion, no rules change.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { extractSystemCounts }: any = await import('../services/multiStorePersistence');

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

const student = (id: string) => ({ id, name: `Student ${id}`, status: 'Active' });
const teacher = (id: string) => ({ id, name: `Teacher ${id}` });
const trashEntry = (trashId: string, dataId: string, type = 'student') =>
  ({ id: trashId, type, data: { id: dataId }, deletedAt: '2026-11-11' });

function payload(over: Record<string, any>): any {
  return {
    students: [], classes: [], subjects: [], exams: [], marks: [],
    remarks: [], transactions: [], feeStructures: [], teachers: [],
    academicYears: [], trashBin: [], ...over,
  };
}

console.log('--- Snapshot count excludes trashed students (the 174 vs 173 bug) ---');

check('live case: 174 stored students, 1 in trash → snapshot counts 173', () => {
  const students = Array.from({ length: 174 }, (_, i) => student(`s${i + 1}`));
  const counts = extractSystemCounts(payload({
    students,
    trashBin: [trashEntry('trash-1', 's174')],
  }));
  assert.strictEqual(counts.students, 173, 'trashed student must not be counted');
});

check('trashed student matched by trash entry data.id', () => {
  const counts = extractSystemCounts(payload({
    students: [student('s1'), student('s2'), student('s3')],
    trashBin: [trashEntry('trash-1', 's3')],
  }));
  assert.strictEqual(counts.students, 2);
});

check('trashed student matched by trash entry id (same rule as applyRemoteData)', () => {
  const counts = extractSystemCounts(payload({
    students: [student('s1'), student('s2')],
    trashBin: [{ id: 's2', type: 'student', data: { id: 'something-else' }, deletedAt: '' }],
  }));
  assert.strictEqual(counts.students, 1);
});

check('trashed teacher excluded from teachers count (same rule as applyRemoteData)', () => {
  const counts = extractSystemCounts(payload({
    teachers: [teacher('t1'), teacher('t2')],
    trashBin: [trashEntry('trash-9', 't2', 'teacher')],
  }));
  assert.strictEqual(counts.teachers, 1);
});

console.log('--- No trash → counts unchanged ---');

check('no trashBin key at all → raw lengths', () => {
  const p = payload({ students: [student('s1'), student('s2')] });
  delete p.trashBin;
  const counts = extractSystemCounts(p);
  assert.strictEqual(counts.students, 2);
});

check('empty trashBin → raw lengths', () => {
  const counts = extractSystemCounts(payload({
    students: [student('s1'), student('s2')],
    teachers: [teacher('t1')],
  }));
  assert.strictEqual(counts.students, 2);
  assert.strictEqual(counts.teachers, 1);
});

check('non-student trash entries do not change the student count', () => {
  const counts = extractSystemCounts(payload({
    students: [student('s1'), student('s2')],
    trashBin: [trashEntry('trash-1', 'sub1', 'subject'), trashEntry('trash-2', 't1', 'teacher')],
  }));
  assert.strictEqual(counts.students, 2);
});

check('other counts and trashBin count are untouched', () => {
  const counts = extractSystemCounts(payload({
    students: [student('s1'), student('s2')],
    marks: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
    trashBin: [trashEntry('trash-1', 's2')],
  }));
  assert.strictEqual(counts.students, 1);
  assert.strictEqual(counts.marks, 3);
  assert.strictEqual(counts.trashBin, 1, 'trashBin itself is still counted in full');
});

console.log('--- Source check ---');

check('extractSystemCounts reads payload.trashBin', () => {
  const src = readSource('services/multiStorePersistence.ts');
  const start = src.indexOf('export function extractSystemCounts');
  assert.ok(start > -1, 'extractSystemCounts must exist');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.ok(body.includes('trashedIds'), 'student count must filter by the trashed-ids set (same rule as applyRemoteData)');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:backup-snapshot-count'], 'tsx scripts/verify-backup-snapshot-count.ts', 'npm run test:backup-snapshot-count must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: backup snapshot count self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
