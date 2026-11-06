/**
 * Phase 1 (sync hardening, 4 Nov 2026) — PAYLOAD queue.
 *
 * Replaces the kind-only queue (`ldsdm_pending_cloud_confirms` in
 * cloudConfirm.ts) for every NEW confirm failure. The kind-only queue was
 * the Sadia mechanism: it stored only the KIND ('staff'), so a retry
 * re-read the CURRENT local list — which the next server snapshot had
 * already overwritten without Sadia — and "succeeded" while her record
 * was permanently lost.
 *
 * A payload-queue entry carries the RECORDS themselves (the delta that
 * failed to land), so a retry sends the STORED payload, never current
 * state, and a snapshot arriving in between cannot wipe it: snapshot
 * application (applyRemoteData) merges queued payloads back over the
 * incoming snapshot for their ids.
 *
 * Queue entries are DELTAS, not full lists, because every writer is
 * union-based: replaying a delta is idempotent and keeps entries small
 * even for big fields like marks.
 *
 * Ops:
 *  - 'upsert': one field + delta records (or a scalar value for
 *    schoolProfile / markEntryEnabled).
 *  - 'delete': one or more field removals (named ids) + trash entries
 *    to append, in the same logical write.
 *  - 'trashOp': trash-bin operations — named trash ids to remove +
 *    records to upsert back into their lists (restore), or neither
 *    (permanent-delete / empty).
 *
 * Storage: localStorage only (no firebase import — this module must
 * stay importable from cloudConfirm without a cycle). The legacy
 * kind-only key is left untouched here; AppContext drains it once
 * (migration) and new failures never write it.
 */

export type PendingPayloadOp = 'upsert' | 'delete' | 'trashOp';

export interface PendingFieldRemoval {
  field: string;
  ids: string[];
}

export interface PendingPayloadItem {
  id: string;
  op: PendingPayloadOp;
  /** Upsert only: the main_store field this delta belongs to. */
  field?: string;
  /** Upsert only: delta records (must carry the field's key). */
  records?: Record<string, any>[];
  /** Upsert only, scalar fields (schoolProfile, markEntryEnabled): the value. */
  scalarValue?: unknown;
  hasScalar?: boolean;
  /** Delete only: named removals, possibly across several fields. */
  removals?: PendingFieldRemoval[];
  /** Delete only: trash entries to append in the same write. */
  trashEntries?: Record<string, any>[];
  /** TrashOp only: trash ids to remove. */
  removeTrashIds?: string[];
  /** TrashOp only: records to upsert back, keyed by field. */
  upserts?: Record<string, Record<string, any>[]>;
  createdAt: string;
  updatedBy?: string;
}

export const PENDING_PAYLOADS_KEY = 'ldsdm_pending_cloud_payloads';

/**
 * The stable key for a record in a field. Every array field in
 * main_store carries `id` EXCEPT remarks (composite studentId+examId)
 * and feeStructures (keyed by classLevel — see cloudConfirm's
 * fee-structure writer; ids there are unreliable duplicates).
 */
export function fieldKeyFn(field: string): (r: Record<string, any>) => string {
  if (field === 'remarks') {
    return (r) => (r && r.studentId && r.examId ? `${r.studentId}__${r.examId}` : '');
  }
  if (field === 'feeStructures') {
    return (r) => (r && r.classLevel ? String(r.classLevel) : '');
  }
  return (r) => (r && r.id ? String(r.id) : '');
}

export function recordKey(field: string, record: Record<string, any>): string {
  return fieldKeyFn(field)(record);
}

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(PENDING_PAYLOADS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function readPendingPayloads(): PendingPayloadItem[] {
  const parsed = readRaw();
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (i): i is PendingPayloadItem =>
      !!i && typeof i === 'object' && typeof (i as any).id === 'string' && typeof (i as any).op === 'string'
  );
}

function writePendingPayloads(items: PendingPayloadItem[]): void {
  try {
    localStorage.setItem(PENDING_PAYLOADS_KEY, JSON.stringify(items));
  } catch {}
}

function newEntryId(): string {
  return `pp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function mergeByKey(
  existing: Record<string, any>[],
  incoming: Record<string, any>[],
  keyFn: (r: Record<string, any>) => string
): Record<string, any>[] {
  const map = new Map<string, Record<string, any>>();
  (existing || []).forEach((r) => {
    const k = keyFn(r);
    if (k) map.set(k, r);
  });
  (incoming || []).forEach((r) => {
    const k = keyFn(r);
    if (k) map.set(k, r);
  });
  return Array.from(map.values());
}

/**
 * Queue a payload. Same-field+op upserts merge (so a field never holds
 * two competing deltas); delete/trashOp entries merge by ids. Returns
 * the stored entry.
 */
export function queuePendingPayload(
  item: Omit<PendingPayloadItem, 'id' | 'createdAt'>
): PendingPayloadItem {
  const items = readPendingPayloads();
  if (item.op === 'upsert' && item.field) {
    const existing = items.find((i) => i.op === 'upsert' && i.field === item.field);
    if (existing) {
      if (item.hasScalar) {
        existing.scalarValue = item.scalarValue;
        existing.hasScalar = true;
      } else if (item.records) {
        existing.records = mergeByKey(existing.records || [], item.records, fieldKeyFn(item.field));
      }
      existing.createdAt = new Date().toISOString();
      if (item.updatedBy) existing.updatedBy = item.updatedBy;
      writePendingPayloads(items);
      return existing;
    }
  }
  if (item.op === 'delete' && item.removals) {
    const existing = items.find((i) => i.op === 'delete');
    if (existing) {
      const byField = new Map<string, Set<string>>();
      (existing.removals || []).forEach((r) => byField.set(r.field, new Set(r.ids)));
      (item.removals || []).forEach((r) => {
        const set = byField.get(r.field) || new Set<string>();
        r.ids.forEach((id) => set.add(id));
        byField.set(r.field, set);
      });
      existing.removals = Array.from(byField.entries()).map(([field, set]) => ({
        field,
        ids: Array.from(set),
      }));
      if (item.trashEntries) {
        existing.trashEntries = mergeByKey(existing.trashEntries || [], item.trashEntries, (r) => (r.id ? String(r.id) : ''));
      }
      existing.createdAt = new Date().toISOString();
      writePendingPayloads(items);
      return existing;
    }
  }
  if (item.op === 'trashOp') {
    const existing = items.find((i) => i.op === 'trashOp');
    if (existing) {
      const ids = new Set([...(existing.removeTrashIds || []), ...(item.removeTrashIds || [])]);
      existing.removeTrashIds = Array.from(ids);
      const upserts: Record<string, Record<string, any>[]> = { ...(existing.upserts || {}) };
      for (const [field, recs] of Object.entries(item.upserts || {})) {
        upserts[field] = mergeByKey(upserts[field] || [], recs, fieldKeyFn(field));
      }
      existing.upserts = upserts;
      existing.createdAt = new Date().toISOString();
      writePendingPayloads(items);
      return existing;
    }
  }
  const entry: PendingPayloadItem = {
    ...item,
    id: newEntryId(),
    createdAt: new Date().toISOString(),
  };
  items.unshift(entry);
  writePendingPayloads(items);
  return entry;
}

export function clearPendingPayload(id: string): void {
  writePendingPayloads(readPendingPayloads().filter((i) => i.id !== id));
}

/** Drop queued coverage for one field (used after a confirm).
 *  Upsert items for the field are dropped outright. For multi-field
 *  delete/trashOp items, ONLY that field's part is stripped — the
 *  item survives until every field it covers is confirmed, so a
 *  joint teachers+users delete is never lost by a teachers-only
 *  confirm. */
export function clearPendingPayloadsForField(field: string): void {
  const next: PendingPayloadItem[] = [];
  for (const item of readPendingPayloads()) {
    if (item.op === 'upsert') {
      if (item.field !== field) next.push(item);
      continue;
    }
    if (item.op === 'delete') {
      const removals = (item.removals || []).filter((r) => r.field !== field);
      const trashLeft = field === 'trashBin' ? [] : item.trashEntries || [];
      if (removals.length > 0 || trashLeft.length > 0) {
        next.push({ ...item, removals, trashEntries: trashLeft });
      }
      continue;
    }
    if (item.op === 'trashOp') {
      if (field === 'trashBin') {
        const upserts = { ...(item.upserts || {}) };
        if (Object.keys(upserts).length > 0) next.push({ ...item, removeTrashIds: [], upserts });
      } else {
        const upserts = { ...(item.upserts || {}) };
        delete upserts[field];
        const removeLeft = item.removeTrashIds || [];
        if (Object.keys(upserts).length > 0 || removeLeft.length > 0) {
          next.push({ ...item, upserts });
        }
      }
      continue;
    }
    next.push(item);
  }
  writePendingPayloads(next);
}

/**
 * After a successful write covering these keys, drop them from the
 * queued deltas for the field; entries left empty are removed.
 */
export function removePendingPayloadRecords(field: string, keys: string[]): void {
  const keySet = new Set(keys);
  const keyFn = fieldKeyFn(field);
  const items = readPendingPayloads();
  const next: PendingPayloadItem[] = [];
  for (const item of items) {
    if (item.op === 'upsert' && item.field === field && item.records) {
      const remaining = item.records.filter((r) => !keySet.has(keyFn(r)));
      if (remaining.length > 0 || item.hasScalar) {
        next.push({ ...item, records: remaining });
      }
      continue;
    }
    next.push(item);
  }
  writePendingPayloads(next);
}

/** All keys the queue currently covers for one field (badging + diff-skip). */
export function queuedKeysForField(field: string, items?: PendingPayloadItem[]): Set<string> {
  const list = items || readPendingPayloads();
  const out = new Set<string>();
  const keyFn = fieldKeyFn(field);
  for (const item of list) {
    if (item.op === 'upsert' && item.field === field) {
      (item.records || []).forEach((r) => {
        const k = keyFn(r);
        if (k) out.add(k);
      });
      if (item.hasScalar) out.add('__scalar__');
    } else if (item.op === 'delete') {
      (item.removals || []).forEach((r) => {
        if (r.field === field) r.ids.forEach((id) => out.add(id));
      });
      if (field === 'trashBin') {
        (item.trashEntries || []).forEach((t) => {
          if (t.id) out.add(String(t.id));
        });
      }
    } else if (item.op === 'trashOp') {
      if (field === 'trashBin') {
        (item.removeTrashIds || []).forEach((id) => out.add(id));
      } else if (item.upserts && item.upserts[field]) {
        item.upserts[field].forEach((r) => {
          const k = keyFn(r);
          if (k) out.add(k);
        });
      }
    }
  }
  return out;
}

export function hasQueuedUpsertForField(field: string, items?: PendingPayloadItem[]): boolean {
  const list = items || readPendingPayloads();
  return list.some((i) => i.op === 'upsert' && i.field === field);
}

/**
 * Apply every queued item touching `field` over a snapshot list, and
 * return the merged list. Used by applyRemoteData so a server snapshot
 * can never wipe an unconfirmed record (the Sadia fix, snapshot side).
 * Upserts win on key conflict; deletes re-filter their ids; trash
 * entries are re-appended if the snapshot dropped them.
 */
export function mergeQueuedIntoList<T extends Record<string, any>>(
  list: T[],
  field: string,
  items?: PendingPayloadItem[]
): T[] {
  const queue = items || readPendingPayloads();
  const keyFn = fieldKeyFn(field) as (r: any) => string;
  let out: T[] = Array.isArray(list) ? [...list] : [];
  for (const item of queue) {
    if (item.op === 'upsert' && item.field === field && item.records) {
      const map = new Map<string, T>();
      out.forEach((r) => {
        const k = keyFn(r);
        if (k) map.set(k, r);
      });
      item.records.forEach((r) => {
        const k = keyFn(r);
        if (k) map.set(k, r as T);
      });
      // Records without a key cannot be merged safely — they stay
      // out (the writer's id assertion rejects them loudly at write).
      out = Array.from(map.values());
    } else if (item.op === 'delete') {
      (item.removals || []).forEach((removal) => {
        if (removal.field === field) {
          const ids = new Set(removal.ids);
          out = out.filter((r) => !ids.has(keyFn(r)));
        }
      });
      if (field === 'trashBin' && item.trashEntries) {
        const map = new Map<string, T>();
        out.forEach((r) => {
          if ((r as any).id) map.set(String((r as any).id), r);
        });
        item.trashEntries.forEach((t) => {
          if (t.id) map.set(String(t.id), t as T);
        });
        out = Array.from(map.values());
      }
    } else if (item.op === 'trashOp') {
      if (field === 'trashBin') {
        const ids = new Set(item.removeTrashIds || []);
        out = out.filter((r) => !(r as any).id || !ids.has(String((r as any).id)));
      } else if (item.upserts && item.upserts[field]) {
        const map = new Map<string, T>();
        out.forEach((r) => {
          const k = keyFn(r);
          if (k) map.set(k, r);
        });
        item.upserts[field].forEach((r) => {
          const k = keyFn(r);
          if (k) map.set(k, r as T);
        });
        out = Array.from(map.values());
      }
    }
  }
  return out;
}

/**
 * Prune pending queue entries that have already arrived in cloud data.
 * If a record queued for upsert is already present in remote data, it has landed,
 * so we remove it from the pending queue. This clears badges and unconfirmed flags
 * across all tabs automatically as soon as cloud data is received.
 */
export function pruneQueueAgainstRemoteData(data: Record<string, any>): boolean {
  if (!data || typeof data !== 'object') return false;
  const items = readPendingPayloads();
  if (items.length === 0) return false;
  let changed = false;
  const next: PendingPayloadItem[] = [];

  // Trashed IDs present in remote trashBin
  const remoteTrashBin = Array.isArray(data.trashBin) ? data.trashBin : [];
  const trashedIds = new Set<string>();
  remoteTrashBin.forEach((t: any) => {
    if (t?.data?.id) trashedIds.add(String(t.data.id));
    if (t?.id) trashedIds.add(String(t.id));
  });

  for (const item of items) {
    if (item.op === 'upsert' && item.field && data[item.field]) {
      const remoteList = Array.isArray(data[item.field]) ? data[item.field] : [];
      const keyFn = fieldKeyFn(item.field);
      const remoteKeys = new Set(remoteList.map((r: any) => keyFn(r)).filter(Boolean));

      if (item.hasScalar) {
        if (JSON.stringify(data[item.field]) === JSON.stringify(item.scalarValue)) {
          changed = true;
          continue; // completely landed
        }
      } else if (item.records) {
        // A record is resolved if it either landed in cloud OR is in trashBin (deleted)
        const remaining = item.records.filter((r) => {
          const k = keyFn(r);
          if (!k) return false;
          if (remoteKeys.has(k) || trashedIds.has(k)) {
            changed = true;
            return false;
          }
          return true;
        });

        if (remaining.length !== item.records.length) {
          changed = true;
          if (remaining.length > 0) {
            next.push({ ...item, records: remaining });
            continue;
          } else {
            continue; // all records in this payload landed or were trashed
          }
        }
      }
    } else if (item.op === 'delete' && item.removals) {
      // Check if removals have already taken effect in remote data
      let allRemovalsConfirmed = true;
      for (const removal of item.removals) {
        if (data[removal.field] && Array.isArray(data[removal.field])) {
          const keyFn = fieldKeyFn(removal.field);
          const presentIds = new Set(data[removal.field].map((r: any) => keyFn(r)));
          const stillPresent = removal.ids.some((id) => presentIds.has(id));
          if (stillPresent) {
            allRemovalsConfirmed = false;
            break;
          }
        }
      }
      if (allRemovalsConfirmed) {
        changed = true;
        continue;
      }
    }
    next.push(item);
  }

  if (changed) {
    writePendingPayloads(next);
  }
  return changed;
}
