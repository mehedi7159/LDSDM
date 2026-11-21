/**
 * verify-rc-trash-restore-paired.ts — scripted proof for the RC fix
 * to the paired trash restore (13 Nov 2026 live audit, §M).
 *
 * Live failure: restoring the trashed TEST teacher brought the staff
 * record back but its login stayed in the bin as a separate item and
 * had to be restored on its own — and the bin held three copies of
 * the same teacher.
 *
 * Root causes (both in services/trashRestore.ts):
 *  (1) findPairedTrashItem used `.find`, so it returned ONE partner —
 *      but one person can hold SEVERAL 'user' bin items. The cloud
 *      writers are union-only, so addTeacher replacing a same-email
 *      login locally never removes the superseded record from cloud
 *      `users` (it returns on the next snapshot), and deleteTeacher's
 *      id-OR-email match trashes every one of them.
 *  (2) Every delete mints fresh trash ids, so re-trashing a record
 *      stacked duplicate bin items for it — nothing deduped by
 *      (type, data.id).
 *
 * Rule under test:
 *  - planTrashRestore restores the clicked item, every stacked copy
 *    of the same record, and EVERY partner (same data id or email),
 *    in one plan; a clash on any part still blocks all of it.
 *  - dedupeTrashEntries drops a trash entry whose (type, data.id)
 *    is already in the bin, and deleteTeacher/deleteAppUser use it.
 *
 * Run: npx tsx scripts/verify-rc-trash-restore-paired.ts
 * (or npm run test:rc-trash-restore-paired)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTrashRestore, findPairedTrashItems, dedupeTrashEntries } from '../services/trashRestore';
import type { TrashItem } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const binItem = (id: string, type: TrashItem['type'], data: any): TrashItem =>
  ({ id, type, data, deletedAt: '2026-11-13' } as TrashItem);
const teacher = { id: 'tch_mw1', name: 'Test Teacher', employeeCode: 'MDR-T004', email: 'test.teacher.audit@example.com' };
// Live shape: the current login (same id as the teacher) AND a
// superseded same-email login (different id, e.g. an old signup
// record the union-only cloud writers never removed).
const userCurrent = { id: 'tch_mw1', name: 'Test Teacher', email: 'test.teacher.audit@example.com' };
const userStale = { id: 'usr_9x', name: 'Test Teacher', email: 'test.teacher.audit@example.com' };
const emptyLive = { students: [], teachers: [], users: [], subjects: [], exams: [], classes: [], sections: [], transactions: [], notices: [] };

// (1) Teacher restore pulls EVERY login partner, not just the first.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', userCurrent), binItem('b3', 'user', userStale)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(1) teacher + both logins restore together', plan.toRestore.length, 3);
  check('(1) paired flag', plan.paired === true);
  check('(1) no clash', plan.clash === null);
  check('(1) no login left behind', plan.toRestore.filter(t => t.type === 'user').length === 2);
}

// (2) Same-id partner still pairs (regression: the original fix).
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', { ...userCurrent, email: 'other@example.com' })];
  eq('(2) same-id pair restores both', planTrashRestore(bin, bin[0], emptyLive).toRestore.length, 2);
}

// (3) Stacked duplicate teacher items restore in one click.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b4', 'teacher', teacher), binItem('b2', 'user', userCurrent)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(3) both teacher copies + login restore together', plan.toRestore.length, 3);
  eq('(3) each trash id once', new Set(plan.toRestore.map(t => t.id)).size, 3);
}

// (4) A clash on ANY partner still blocks everything.
{
  const live = { ...emptyLive, users: [{ id: 'usr_live', email: 'test.teacher.audit@example.com' }] };
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', userCurrent), binItem('b3', 'user', userStale)];
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(4) clash blocks all', plan.toRestore.length, 0);
  check('(4) clash message names the identifier', (plan.clash || '').includes('কোন রেকর্ডটি এই পরিচয় রাখবে'));
}

// (5) Lone teacher restores alone (regression).
{
  const bin = [binItem('b1', 'teacher', teacher)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(5) lone teacher restores alone', plan.toRestore.length, 1);
  eq('(5) not paired', plan.paired, false);
}

// (6) findPairedTrashItems returns all partners.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', userCurrent), binItem('b3', 'user', userStale)];
  eq('(6) plural finder returns both logins', findPairedTrashItems(bin, bin[0]).length, 2);
}

// (7) dedupeTrashEntries drops bin duplicates by (type, data.id).
{
  const existing = [binItem('old1', 'teacher', teacher), binItem('old2', 'user', userCurrent)];
  const incoming = [
    binItem('n1', 'teacher', teacher),
    binItem('n2', 'user', userCurrent),
    binItem('n3', 'user', userStale),
    binItem('n4', 'user', userStale),
  ];
  const kept = dedupeTrashEntries(existing, incoming);
  eq('(7) only the unseen login survives', kept.length, 1);
  eq('(7) kept entry is the stale login', kept[0]?.id, 'n3');
}

// (8) Wiring: both staff delete paths dedupe before writing the bin.
{
  const ctx = readSource('context/AppContext.tsx');
  check('(8) deleteTeacher dedupes trash entries', ctx.includes('dedupeTrashEntries(trashBin, ['));
  const occurrences = ctx.split('dedupeTrashEntries(trashBin, [').length - 1;
  eq('(8) dedupe used in both delete paths', occurrences, 2);
  check('(8) planner uses the plural finder', readSource('services/trashRestore.ts').includes('findPairedTrashItems(trashBin, entry)'));
}

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
