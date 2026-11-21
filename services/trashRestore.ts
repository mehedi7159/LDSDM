/**
 * trashRestore.ts — paired trash restore + duplicate check.
 *
 * Fix master #5: deleteTeacher trashes the teacher record AND the
 * login (user) record as two separate bin items, but restoreFromTrash
 * restored exactly one item — so restoring a teacher left its login
 * in trash (and vice versa) — and it never checked whether a live
 * record already holds the same identifier.
 *
 * planTrashRestore is the single pure plan for one restore click:
 * a teacher restore pulls its bin 'user' partner (same data id or
 * email) and a user restore pulls its bin 'teacher' partner; before
 * restoring anything, every planned item is checked against the
 * live lists (id / employee code / email / studentId) and on a
 * clash NOTHING is restored — the plan carries a message asking
 * which record keeps the identifier.
 */
import type { TrashItem } from '../types';
import { resolveUniqueStudentId } from './studentService';

export interface RestoreLiveLists {
  students?: { id?: string; studentId?: string }[];
  teachers?: { id?: string; employeeCode?: string; email?: string }[];
  users?: { id?: string; email?: string }[];
  subjects?: { id?: string }[];
  exams?: { id?: string }[];
  classes?: { id?: string }[];
  sections?: { id?: string }[];
  transactions?: { id?: string }[];
  notices?: { id?: string }[];
}

export interface TrashRestorePlan {
  toRestore: TrashItem[];
  paired: boolean;
  clash: string | null;
  // A trashed student whose studentId is now held by a DIFFERENT live
  // student (19 Nov 2026: trashed TEST 2026175 is live on real student
  // আ আব্দুল্লাহ) restores with a new free ID instead of duplicating —
  // the live record keeps its ID. The caller applies this studentId to
  // the restored record. Same-`id`-already-live still blocks (clash).
  reassignedStudentId?: { trashId: string; newStudentId: string };
}

const sameEmail = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const sameCode = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// The bin partner of a teacher is its login (user) record and vice
// versa — deleteTeacher trashes both under the same data id or email.
//
// RC (13 Nov 2026 live audit): the old `.find` returned ONE partner,
// but one person can hold SEVERAL 'user' bin items — the cloud
// writers are union-only, so addTeacher replacing a same-email login
// locally never removes the superseded record from cloud `users`
// (it comes back on the next snapshot), and deleteTeacher's
// id-OR-email match trashes every one of them. Restoring the teacher
// then brought back only the first login and left the other(s) in
// the bin. All partners come back now.
export function findPairedTrashItems(trashBin: TrashItem[], item: TrashItem): TrashItem[] {
  const partnerType = item.type === 'teacher' ? 'user' : item.type === 'user' ? 'teacher' : null;
  if (!partnerType) return [];
  const d = item.data || {};
  return trashBin.filter(t =>
    t.id !== item.id &&
    t.type === partnerType &&
    (t.data?.id === d.id || sameEmail(t.data?.email, d.email))
  );
}

export function findPairedTrashItem(trashBin: TrashItem[], item: TrashItem): TrashItem | null {
  return findPairedTrashItems(trashBin, item)[0] || null;
}

// Drop trash entries whose record is already in the bin (same type +
// same data id). Every delete mints fresh trash ids (generateId), so
// without this a re-trashed record stacks duplicate bin items — the
// live audit saw three copies of one teacher.
export function dedupeTrashEntries(
  existingBin: Pick<TrashItem, 'type' | 'data'>[],
  entries: TrashItem[]
): TrashItem[] {
  const seen = new Set(
    (existingBin || []).map(t => `${t.type}:${(t.data as any)?.id ?? ''}`)
  );
  return entries.filter(e => {
    const key = `${e.type}:${(e.data as any)?.id ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const KEEP_ASK = 'কোন রেকর্ডটি এই পরিচয় রাখবে, ঠিক করে তারপর ফিরিয়ে আনুন।';

// First live record holding the same identifier, as a message —
// null when the item can come back safely. A student whose studentId
// is held by a DIFFERENT live student is NOT a clash here: the plan
// reassigns it a new free ID (see planTrashRestore) instead of
// blocking — blocking left the trashed record unrestorable forever
// once its ID was reused by a new enrolment.
function findRestoreClash(item: TrashItem, live: RestoreLiveLists, reassignedTrashId?: string): string | null {
  const d = item.data || {};
  const idIn = (list?: { id?: string }[]) => (list || []).some(x => x.id === d.id);
  switch (item.type) {
    case 'student':
      if (idIn(live.students)) return `এই শিক্ষার্থী ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}`;
      if (item.id !== reassignedTrashId && d.studentId && (live.students || []).some(s => s.studentId === d.studentId))
        return `শিক্ষার্থী আইডি ${d.studentId} ইতিমধ্যে আছে — ${KEEP_ASK}`;
      return null;
    case 'teacher':
      if (idIn(live.teachers)) return `এই শিক্ষক/কর্মী ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}`;
      if (d.employeeCode && (live.teachers || []).some(t => sameCode(t.employeeCode, d.employeeCode)))
        return `কর্মী কোড ${d.employeeCode} ইতিমধ্যে ব্যবহৃত হচ্ছে — ${KEEP_ASK}`;
      if (d.email && (live.teachers || []).some(t => sameEmail(t.email, d.email)))
        return `ইমেইল ${d.email} ইতিমধ্যে অন্য শিক্ষক/কর্মীর সাথে যুক্ত আছে — ${KEEP_ASK}`;
      return null;
    case 'user':
      if (idIn(live.users)) return `এই অ্যাকাউন্ট ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}`;
      if (d.email && (live.users || []).some(u => sameEmail(u.email, d.email)))
        return `ইমেইল ${d.email} ইতিমধ্যে অন্য অ্যাকাউন্টে আছে — ${KEEP_ASK}`;
      return null;
    case 'subject':
      return idIn(live.subjects) ? `এই বিষয়টি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    case 'exam':
      return idIn(live.exams) ? `এই পরীক্ষাটি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    case 'class':
      return idIn(live.classes) ? `এই শ্রেণিটি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    case 'section':
      return idIn(live.sections) ? `এই শাখাটি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    case 'transaction':
      return idIn(live.transactions) ? `এই লেনদেনটি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    case 'notice':
      return idIn(live.notices) ? `এই নোটিশটি ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}` : null;
    default:
      return null;
  }
}

export function planTrashRestore(
  trashBin: TrashItem[],
  item: TrashItem,
  live: RestoreLiveLists
): TrashRestorePlan {
  // Same record, stacked bin copies first (see dedupeTrashEntries —
  // older duplicates predate the dedupe), then every partner of any
  // of them. One trash id restores at most once.
  const seen = new Set<string>([item.id]);
  const toRestore: TrashItem[] = [item];
  for (const t of trashBin) {
    if (t.id !== item.id && t.type === item.type && t.data?.id === item.data?.id && !seen.has(t.id)) {
      seen.add(t.id);
      toRestore.push(t);
    }
  }
  const partners: TrashItem[] = [];
  for (const entry of [...toRestore]) {
    for (const p of findPairedTrashItems(trashBin, entry)) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        partners.push(p);
        toRestore.push(p);
      }
    }
  }
  // Student-ID reassignment (see TrashRestorePlan): a trashed student
  // whose studentId now belongs to another live student gets the next
  // free ID — above live AND other trashed student IDs, so the new ID
  // can never collide with a record that may itself be restored later.
  let reassignedStudentId: TrashRestorePlan['reassignedStudentId'];
  for (const entry of toRestore) {
    if (entry.type !== 'student') continue;
    const d = entry.data || {};
    if (!d.studentId) continue;
    if ((live.students || []).some(s => s.id === d.id)) continue;
    if (!(live.students || []).some(s => s.studentId === d.studentId)) continue;
    const otherTrashedIds = trashBin
      .filter(t => t.id !== entry.id && t.type === 'student')
      .map(t => t.data?.studentId);
    reassignedStudentId = {
      trashId: entry.id,
      newStudentId: resolveUniqueStudentId(
        String(d.studentId),
        (live.students || []).map(s => s.studentId),
        otherTrashedIds
      ),
    };
  }
  // Atomic: a clash on any part blocks all — never restore one side
  // of a teacher/login pair while another part is stuck.
  for (const entry of toRestore) {
    const clash = findRestoreClash(entry, live, reassignedStudentId?.trashId);
    if (clash) return { toRestore: [], paired: false, clash };
  }
  return { toRestore, paired: partners.length > 0, clash: null, reassignedStudentId };
}
