/**
 * Blank-marksheet subject lookup, as a pure function (extracted from
 * components/BlankMarksheetView.tsx so scripts/verify-blank-marksheet-play.ts
 * can test it without React). The component calls this; nothing else
 * changes — no grading, totals, PDF, print or layout logic lives here.
 */
import type { Subject } from '../types';
import { classNamesMatch } from './classNames';

/**
 * Subjects to print for the selected class + exam.
 * - Class match is canonicalized (শিশু matches Play, ১ম শ্রেণী matches
 *   Class 1, …), so records stored under either spelling resolve.
 * - Exam filter follows the sibling views (ResultView, MarksEntry,
 *   ClassResultView): it applies ONLY when at least one subject of the
 *   class is assigned to the selected exam; otherwise every class
 *   subject is shown (an unassigned subject applies to all exams).
 */
export function getBlankMarksheetSubjects(
  subjects: Subject[],
  selectedClass: string,
  selectedExamId: string,
): Subject[] {
  const classSubjects = subjects.filter(s => classNamesMatch(s.classLevel, selectedClass));
  const anyAssignedToExam = !!selectedExamId &&
    classSubjects.some(s => s.examIds && s.examIds.includes(selectedExamId));
  return classSubjects
    .filter(s => {
      if (!selectedExamId || !anyAssignedToExam) return true;
      return !!(s.examIds && s.examIds.includes(selectedExamId));
    })
    .sort((a, b) => a.order - b.order);
}
