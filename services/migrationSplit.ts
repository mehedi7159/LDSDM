/**
 * Database split — one-time backfills (Job 1: notices, 10 Nov 2026;
 * Job 2: classRoutines + syllabusItems + calendarEvents, 21 Nov 2026).
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
 * holds the records (see AppContext startNoticesFeed / startScheduleFeeds).
 */
import { doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { noticesCollectionRef, scheduleCollectionRef, stripUndefinedRecord, type ScheduleSplitField } from './cloudConfirm';
import { assertUpsertRecords } from './mainStoreWrite';
import { fieldKeyFn } from './payloadQueue';
import type { NoticeItem } from '../types';

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
 * Job 2 — one-time backfill for one schedule field: copy main_store
 * records into the field's new collection (doc id = record id).
 * Returns counts. Throws on Firestore failure so the caller can retry.
 */
export async function migrateFieldToCollection(field: ScheduleSplitField, records: any[]): Promise<{ written: number; skipped: number }> {
  const { docs, skipped } = scheduleBackfillPlan(records);
  if (docs.length > 0) {
    // Same id assertion as every confirmed writer — a bad record fails
    // the backfill loudly instead of being silently dropped.
    assertUpsertRecords(field, docs as any, fieldKeyFn(field));
  }
  const col = scheduleCollectionRef(field);
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const r of docs.slice(i, i + 500)) {
      batch.set(doc(col, String(r.id)), stripUndefinedRecord(r), { merge: true });
    }
    await batch.commit();
  }
  return { written: docs.length, skipped };
}
