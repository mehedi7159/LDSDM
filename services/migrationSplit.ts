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
 * / startClassesFeeds / startAcademicFeeds / startFeesFeeds / startRemarksFeed / startPromotionHistoryFeed / startLeavesFeed).
 */
import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { noticesCollectionRef, scheduleCollectionRef, classesCollectionRef, academicCollectionRef, feesCollectionRef, remarksCollectionRef, promotionHistoryCollectionRef, staffLeavesCollectionRef, stripUndefinedRecord, type ScheduleSplitField, type ClassesSplitField, type AcademicSplitField, type FeesSplitField } from './cloudConfirm';
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
 * Returns counts. Throws on Firestore failure so the caller can retry.
 */
export async function migrateFieldToCollection(field: ScheduleSplitField | ClassesSplitField | AcademicSplitField | FeesSplitField | 'remarks' | 'promotionHistory' | 'staffLeaves', records: any[]): Promise<{ written: number; skipped: number }> {
  const isFeesField = field === 'feeTypes' || field === 'feeStructures';
  const { docs, skipped } = field === 'remarks' ? remarksBackfillPlan(records) : isFeesField ? feesBackfillPlan(field as FeesSplitField, records) : scheduleBackfillPlan(records);
  if (docs.length > 0) {
    // Same id assertion as every confirmed writer — a bad record fails
    // the backfill loudly instead of being silently dropped.
    assertUpsertRecords(field, docs as any, fieldKeyFn(field), field === 'remarks' ? 'studentId+examId' : 'id');
  }
  const col = field === 'staffLeaves' ? staffLeavesCollectionRef()
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
    const batch = writeBatch(db);
    for (const r of docs.slice(i, i + 500)) {
      if (field === 'remarks') {
        // Remarks have no id field — doc id is studentId__examId.
        batch.set(doc(col, keyFn(r)), stripUndefinedRecord(r), { merge: true });
      } else {
        batch.set(doc(col, String(fieldKeyFn(field)(r))), stripUndefinedRecord(r), { merge: true });
      }
    }
    await batch.commit();
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
