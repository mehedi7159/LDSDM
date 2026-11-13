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
}

const sameEmail = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const sameCode = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// The bin partner of a teacher is its login (user) record and vice
// versa — deleteTeacher trashes both under the same data id or email.
export function findPairedTrashItem(trashBin: TrashItem[], item: TrashItem): TrashItem | null {
  const partnerType = item.type === 'teacher' ? 'user' : item.type === 'user' ? 'teacher' : null;
  if (!partnerType) return null;
  const d = item.data || {};
  return trashBin.find(t =>
    t.id !== item.id &&
    t.type === partnerType &&
    (t.data?.id === d.id || sameEmail(t.data?.email, d.email))
  ) || null;
}

const KEEP_ASK = 'কোন রেকর্ডটি এই পরিচয় রাখবে, ঠিক করে তারপর ফিরিয়ে আনুন।';

// First live record holding the same identifier, as a message —
// null when the item can come back safely.
function findRestoreClash(item: TrashItem, live: RestoreLiveLists): string | null {
  const d = item.data || {};
  const idIn = (list?: { id?: string }[]) => (list || []).some(x => x.id === d.id);
  switch (item.type) {
    case 'student':
      if (idIn(live.students)) return `এই শিক্ষার্থী ইতিমধ্যে আছে (একই আইডি) — ${KEEP_ASK}`;
      if (d.studentId && (live.students || []).some(s => s.studentId === d.studentId))
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
  const paired = findPairedTrashItem(trashBin, item);
  const toRestore = paired ? [item, paired] : [item];
  // Atomic: a clash on either half blocks both — never restore one
  // side of a teacher/login pair while the other half is stuck.
  for (const entry of toRestore) {
    const clash = findRestoreClash(entry, live);
    if (clash) return { toRestore: [], paired: false, clash };
  }
  return { toRestore, paired: !!paired, clash: null };
}
