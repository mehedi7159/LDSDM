/**
 * Admin-controlled mark-entry gate (Nov 2026 emergency).
 * ======================================================
 * Effective permission = global switch AND per-exam toggle:
 *   - global `markEntryEnabled === false` closes every exam, for every role.
 *   - an exam's `markEntryAllowed === false` closes that exam only.
 * Missing flags = ALLOWED: existing exams (no flag yet) stay open and
 * newly created exams default to allowed. Nothing closes by itself —
 * the admin closes explicitly from Exam Management.
 *
 * This is a client-side gate (no server layer exists): it hides the
 * entry forms and refuses saves through the guarded marks path. An old
 * bundle still showing the old form cannot be stopped from here until
 * it refreshes — but it also cannot save through the guarded path.
 */
import type { Exam } from '../types';

export function isMarkEntryAllowedForExam(
  exam: Exam | null | undefined,
  markEntryEnabled: boolean | undefined
): boolean {
  if (markEntryEnabled === false) return false;
  if (exam && exam.markEntryAllowed === false) return false;
  return true;
}
