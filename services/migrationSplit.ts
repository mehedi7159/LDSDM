/**
 * Database split — one-time backfills (Job 1: notices, 10 Nov 2026;
 * Job 2: classRoutines + syllabusItems + calendarEvents, 21 Nov 2026;
 * Job 3: classes + sections + academicYears, 21 Nov 2026;
 * Job 4: subjects + exams + examSubjectAssignments +
 * classSubjectAssignments + teacherSubjectAssignments +
 * classTeacherAssignments, 21 Nov 2026).
 * Job 5: feeTypes + feeStructures, 21 Nov 2026).
 * Job 6: remarks, 21 Nov 2026).
 * Job 7: promotionHistory, 21 Nov 2026).
 * Job 8: staffLeaves, 21 Nov 2026).
 * Job 10: transactions, 21 Nov 2026).
 * Job 11: marks, 21 Nov 2026).
 * Job 12: students, 21 Nov 2026).
 * Job 13: trashBin, 21 Nov 2026).
 * Job 14: schoolProfile + markEntryEnabled -> settings/main, 21 Nov 2026).
 * Job 9: dailyStudentAttendance + dailyStaffAttendance, 21 Nov 2026).
 *
 * Each migrate*ToCollection copies one main_store field into its new
 * collection under institutions/<CANONICAL_PRIMARY_INSTITUTION_ID>/.
 * Backfills copy records as-is (demo records included — applyRemoteData
 * filters them on read, same as before) and are idempotent: setDoc
 * merge by record id, so a second run writes the same docs. Records
 * without an id can never be keyed, so they are skipped and counted,
 * never written. Writes go in 500-doc batches (Firestore limit).
 *
 * A backfill never deletes anything and never touches Firestore rules.
 * It only runs when the new collection is empty and main_store still
 * holds the records (see AppContext startNoticesFeed / startScheduleFeeds
 * / startClassesFeeds / startAcademicFeeds / startFeesFeeds / startRemarksFeed / startPromotionHistoryFeed / startLeavesFeed / startTransactionsFeed / startMarksFeed / startStudentsFeed / startTrashFeed / startSettingsFeed / startAttendanceFeeds).
 *
 * Job 14 is the exception to the per-record shape: settings/main is a
 * SINGLE document holding two scalar fields, so its backfill writes
 * one merge doc (only the fields actually present — a missing
 * markEntryEnabled is never invented, keeping the default-open rule).
 */
import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { noticesCollectionRef, scheduleCollectionRef, classesCollectionRef, academicCollectionRef, feesCollectionRef, remarksCollectionRef, promotionHistoryCollectionRef, staffLeavesCollectionRef, transactionsCollectionRef, marksCollectionRef, studentsCollectionRef, trashCollectionRef, writeSettingsToCollection, attendanceCollectionRef, stripUndefinedRecord, type ScheduleSplitField, type ClassesSplitField, type AcademicSplitField, type FeesSplitField, type AttendanceSplitField } from './cloudConfirm';
import { assertUpsertRecords } from './mainStoreWrite';
import { fieldKeyFn } from './payloadQueue';
import type { NoticeItem, RemarkRecord } from '../types';

/**
 * Pure plan step: which docs a notices backfill would write. Dedupe by
 * id (first copy wins), skip id-less records. Testable without Firestore.
 */
export function noticesBackfillPlan(records: NoticeItem[]): { docs: NoticeItem[]; skipped: number } {
  const seen = new Set<string>();
  const docs: NoticeItem[] = [];
  let skipped = 0;
  for (const r of records || []) {
    const id = r && (r as any).id ? String((r as any).id) : '';
    if (!id || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    docs.push(r);
  }
  return { docs, skipped };
}

/**
 * One-time backfill: copy main_store notices into the new collection.
 * Returns counts. Throws on Firestore failure so the caller can retry.
 */
export async function migrateNoticesToCollection(records: NoticeItem[]): Promise<{ written: number; skipped: number }> {
  const { docs, skipped } = noticesBackfillPlan(records);
  if (docs.length > 0) {
    // Same id assertion as every confirmed writer — a bad record fails
    // the backfill loudly instead of being silently dropped.
    assertUpsertRecords('notices', docs as any, fieldKeyFn('notices'));
  }
  const col = noticesCollectionRef();
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const n of docs.slice(i, i + 500)) {
      batch.set(doc(col, String(n.id)), stripUndefinedRecord(n), { merge: true });
    }
    await batch.commit();
  }
  return { written: docs.length, skipped };
}

/**
 * Job 2 — pure plan step for one schedule field (classRoutines,
 * syllabusItems or calendarEvents): which docs a backfill would write.
 * Dedupe by id (first copy wins), skip id-less records. Testable
 * without Firestore. Counts are RAW: docs + skipped always equals the
 * main_store array length, so the plan's count check (array length =
 * new collection doc count) holds whenever ids are distinct.
 * Job 8 reuses this same plan step for staffLeaves — it keys on id
 * exactly the same way, so no second copy of the logic is needed.
 */
export function scheduleBackfillPlan(records: any[]): { docs: any[]; skipped: number } {
  const seen = new Set<string>();
  const docs: any[] = [];
  let skipped = 0;
  for (const r of records || []) {
    const id = r && (r as any).id ? String((r as any).id) : '';
    if (!id || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    docs.push(r);
  }
  return { docs, skipped };
}

/**
 * Job 6 — pure plan step for remarks: which docs a backfill would
 * write. RemarkRecord has NO id field — the key is studentId__examId
 * (fieldKeyFn('remarks')). Dedupe by that key (first copy wins), skip
 * records missing studentId or examId. Testable without Firestore.
 * Counts are RAW: docs + skipped always equals the main_store array
 * length, so the plan's count check (array length = new collection
 * doc count) holds whenever keys are distinct.
 */
export function remarksBackfillPlan(records: RemarkRecord[]): { docs: RemarkRecord[]; skipped: number } {
  const seen = new Set<string>();
  const docs: RemarkRecord[] = [];
  let skipped = 0;
  const keyFn = fieldKeyFn('remarks');
  for (const r of records || []) {
    const key = r ? keyFn(r as any) : '';
    if (!key || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    docs.push(r);
  }
  return { docs, skipped };
}

/**
 * Job 2 — one-time backfill for one schedule field: copy main_store
 * records into the field's new collection (doc id = record id).
 * Job 3 reuses it for classes, sections and academicYears, and Job 4
 * reuses it for subjects, exams and the four assignment lists — the
 * plan step (scheduleBackfillPlan) and the batching are field-agnostic.
 * Job 5 reuses it for feeTypes + feeStructures — the doc id is the
 * field key (id for feeTypes, classLevel for feeStructures), so the
 * plan step dedupes by that key instead of by id.
 * Job 6 reuses it for 'remarks' (same shape, one field — doc id =
 * studentId__examId instead of an id field).
 * Job 7 reuses it for 'promotionHistory' (same shape, one field).
 * Job 8 extends it to staffLeaves: same idempotent batch copy, only
 * the collection differs.
 * Job 10 extends it to transactions: same idempotent batch copy,
 * only the collection differs.
 * Job 11 reuses it for 'marks' (same shape, one field — the biggest
 * 2,601 records = 6 batches of 500).
 * Job 12 reuses it for 'students' (same shape, one field, doc id =
 * Student.id).
 * Job 13 reuses it for 'trashBin' (same shape — doc id = TrashItem.id).
 * Job 9 extends it to both attendance fields: same idempotent batch
 * copy, only the collection and the doc-id rule differ — attendance
 * docs are keyed by attendanceRecordKey (the record id, or the
 * derived date_id form when a record carries no id). Returns counts.
 * Throws on Firestore failure so the caller can retry.
 */
export async function migrateFieldToCollection(field: ScheduleSplitField | ClassesSplitField | AcademicSplitField | FeesSplitField | AttendanceSplitField | 'remarks' | 'promotionHistory' | 'staffLeaves' | 'transactions' | 'marks' | 'students' | 'trashBin', records: any[]): Promise<{ written: number; skipped: number }> {
  const isFeesField = field === 'feeTypes' || field === 'feeStructures';
  const isAttendance = field === 'dailyStudentAttendance' || field === 'dailyStaffAttendance';
  const { docs, skipped } = isAttendance ? attendanceBackfillPlan(records, field) : field === 'remarks' ? remarksBackfillPlan(records) : isFeesField ? feesBackfillPlan(field as FeesSplitField, records) : scheduleBackfillPlan(records);
  if (docs.length > 0) {
    // Same id assertion as every confirmed writer — a bad record fails
    // the backfill loudly instead of being silently dropped. The
    // attendance plan stamps every doc with an id first, so the
    // id-based fieldKeyFn holds for both legs.
    assertUpsertRecords(field, docs as any, fieldKeyFn(field), field === 'remarks' ? 'studentId+examId' : 'id');
  }
  const col = isAttendance ? attendanceCollectionRef(field)
    : field === 'trashBin' ? trashCollectionRef()
    : field === 'students' ? studentsCollectionRef()
    : field === 'marks' ? marksCollectionRef()
    : field === 'staffLeaves' ? staffLeavesCollectionRef()
    : field === 'transactions' ? transactionsCollectionRef()
    : field === 'promotionHistory' ? promotionHistoryCollectionRef()
    : field === 'remarks' ? remarksCollectionRef()
    : isFeesField ? feesCollectionRef(field as FeesSplitField)
    : (field === 'classes' || field === 'sections' || field === 'academicYears')
      ? classesCollectionRef(field as ClassesSplitField)
      : (field === 'subjects' || field === 'exams' || field === 'examSubjectAssignments' || field === 'classSubjectAssignments' || field === 'teacherSubjectAssignments' || field === 'classTeacherAssignments')
        ? academicCollectionRef(field as AcademicSplitField)
        : scheduleCollectionRef(field as ScheduleSplitField);
  const keyFn = fieldKeyFn(field);
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    // Job 11: one failed batch is retried alone (up to 3 attempts,
    // fresh batch each time) — the other batches are already
    // committed, so a retry never replays the whole backfill.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        for (const r of chunk) {
          if (field === 'remarks') {
            // Remarks have no id field — doc id is studentId__examId.
            batch.set(doc(col, keyFn(r)), stripUndefinedRecord(r), { merge: true });
          } else {
            batch.set(doc(col, String(fieldKeyFn(field)(r))), stripUndefinedRecord(r), { merge: true });
          }
        }
        await batch.commit();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
  }
  return { written: docs.length, skipped };
}

/**
 * Job 5 — pure plan step for one fees field (feeTypes or
 * feeStructures): which docs a backfill would write. Dedupe by the
 * field key (id for feeTypes, classLevel for feeStructures — first
 * copy wins), skip key-less records. Testable without Firestore.
 * Counts are RAW: docs + skipped always equals the main_store array
 * length, so the plan's count check (array length = new collection
 * doc count) holds whenever keys are distinct.
 */
export function feesBackfillPlan(field: FeesSplitField, records: any[]): { docs: any[]; skipped: number } {
  const keyFn = fieldKeyFn(field);
  const seen = new Set<string>();
  const docs: any[] = [];
  let skipped = 0;
  for (const r of records || []) {
    const key = r ? keyFn(r) : '';
    if (!key || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    docs.push(r);
  }
  return { docs, skipped };
}

/**
 * Job 13 — completeness gate for the trash collection: the collection
 * is the read source ONLY when it holds exactly the confirmed
 * main_store trash entries — every confirmed id present AND no extra
 * doc. Extra docs are orphans left by a non-super-admin restore /
 * permanent-delete (Rules: deleteDoc is super-admin-only, so the
 * principal's trash-doc delete fails and the doc stays). A subset
 * check (Jobs 1/2/7) would take over with the orphan still hiding
 * the restored record; exact equality falls back to main_store, so
 * the restored record stays visible. Pure — unit-tested in
 * scripts/verify-job13-trash-split.ts.
 */
export function trashCollectionComplete(confirmedTrash: any[], collectionDocs: any[]): boolean {
  const idOf = (r: any) => (r && r.id ? String(r.id) : '');
  const knownIds = new Set((confirmedTrash || []).map(idOf).filter(Boolean));
  const colIds = new Set((collectionDocs || []).map(idOf).filter(Boolean));
  if (knownIds.size !== colIds.size) return false;
  for (const id of knownIds) if (!colIds.has(id)) return false;
  return true;
}

/**
 * Job 14 — pure plan step for the settings doc: which fields a
 * backfill would write into settings/main. Only fields actually
 * present in main_store are copied, as-is — a missing
 * markEntryEnabled stays missing (default open), a missing profile
 * stays missing. Testable without Firestore.
 */
export function settingsBackfillPlan(profile?: any, markEntryEnabled?: unknown): { patch: { schoolProfile?: Record<string, any>; markEntryEnabled?: boolean } } {
  const patch: { schoolProfile?: Record<string, any>; markEntryEnabled?: boolean } = {};
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) patch.schoolProfile = profile;
  if (typeof markEntryEnabled === 'boolean') patch.markEntryEnabled = markEntryEnabled;
  return { patch };
}

/**
 * Job 14 — one-time backfill: copy the confirmed main_store
 * schoolProfile / markEntryEnabled into settings/main (doc id =
 * "main", setDoc merge — a second run writes the same doc, and a
 * field written once is never wiped by a later run that lacks it).
 * Returns what was written. Throws on Firestore failure so the
 * caller can retry.
 */
export async function migrateSettingsToCollection(profile?: any, markEntryEnabled?: unknown): Promise<{ written: boolean; fields: string[] }> {
  const { patch } = settingsBackfillPlan(profile, markEntryEnabled);
  const fields = Object.keys(patch);
  if (fields.length === 0) return { written: false, fields: [] };
  await writeSettingsToCollection(patch);
  return { written: true, fields };
}

/**
 * Job 9 — the stable key of one attendance record. The record id
 * when it has one; otherwise the date_id form the plan specifies
 * (`2026-11-07_ST-12` / `2026-11-07_MDR-T003`) — the same key the
 * attendance service merges on. '' when the record cannot be keyed
 * at all (no date or no person).
 */
export function attendanceRecordKey(r: any): string {
  if (!r) return '';
  if (r.id) return String(r.id);
  const person = r.studentId || r.staffId;
  if (r.date && person) return `${r.date}_${person}`;
  return '';
}

/**
 * Job 9 — pure plan step for one attendance field: which docs a
 * backfill would write. Dedupe by attendanceRecordKey (first copy
 * wins); a record without an id is stamped with its derived date_id
 * key, so it still becomes one doc. Skip only records that cannot
 * be keyed at all. Testable without Firestore. Counts are RAW:
 * docs + skipped always equals the main_store array length, so the
 * plan's count check (array length = new collection doc count) holds
 * whenever records are keyable. Records copy as-is — no date
 * filtering (a Friday-dated record, if one exists, is copied too;
 * the holiday rule lives in the register display, not the backfill).
 */
export function attendanceBackfillPlan(records: any[], field: AttendanceSplitField): { docs: any[]; skipped: number } {
  const seen = new Set<string>();
  const docs: any[] = [];
  let skipped = 0;
  for (const r of records || []) {
    const key = attendanceRecordKey(r);
    if (!key || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    docs.push(r && (r as any).id ? r : { ...r, id: key });
  }
  return { docs, skipped };
}
