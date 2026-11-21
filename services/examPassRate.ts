import { calcPassRate } from './gradingEngine';
import { calculateTotalGPA } from './utils';
import { classNamesMatch } from './classNames';
import type { Exam, MarkRecord, Student, Subject } from '../types';

/**
 * examPassRate — the ONE pass-rate definition (D3 option (k), 21 Nov 2026).
 *
 * Before this, every page computed its own rate and they disagreed for the
 * same exam: the Dashboard pie counted only students with marks (6/82 =
 * 7.3% First Term), the portal merit list counted every enrolled student
 * (6/12 = 50% Play), Reports used the last exam instead of the selected
 * one, and Executive / analytics fed calculateTotalGPA ALL class subjects
 * while the Dashboard fed only the exam-assigned ones — a missing mark in
 * a passed-in core subject fails the student, so the same students got
 * different pass/fail verdicts (7.3% vs 7.7%).
 *
 * Definition: for the SELECTED exam, evaluated = an Active, non-former
 * student with at least one mark record in that exam (a student who sat
 * the exam and scored 0 in every subject is evaluated, and failed);
 * students with no marks are excluded, not failed; orphan marks (no
 * student record) are excluded; passed = calculateTotalGPA says not a
 * fail, over the exam-assigned subjects for the student's class (all
 * class subjects when nothing is assigned to the exam — the Dashboard's
 * rule); rate is 1 decimal via calcPassRate.
 */
export interface ExamPassRateStudent {
  student: Student;
  totalMarks: number;
  gpa: number;
  grade: string;
  isFail: boolean;
  failCount: number;
}

export interface ExamPassRateResult {
  examId: string;
  evaluated: number;
  passed: number;
  failed: number;
  passRate: number;
  results: ExamPassRateStudent[];
}

export function calcExamPassRate(input: {
  students: Student[];
  marks: MarkRecord[];
  subjects: Subject[];
  exams: Exam[];
  examId: string;
  /** When set, only this class (classNamesMatch). Otherwise all classes. */
  classLevel?: string;
}): ExamPassRateResult {
  const { students, marks, subjects, exams, examId, classLevel } = input;
  if (!examId) {
    return { examId: '', evaluated: 0, passed: 0, failed: 0, passRate: 0, results: [] };
  }

  const evaluatedStudents = (students || []).filter(s =>
    s &&
    s.status === 'Active' &&
    !s.isFormer &&
    (!classLevel || classNamesMatch(s.classLevel, classLevel)) &&
    (marks || []).some(m => m && m.studentId === s.id && m.examId === examId)
  );

  const results: ExamPassRateStudent[] = evaluatedStudents.map(student => {
    const classSubjects = (subjects || []).filter(s => s && classNamesMatch(s.classLevel, student.classLevel));
    const assigned = classSubjects.filter(s => s.examIds && s.examIds.includes(examId));
    const examSubjects = assigned.length > 0 ? assigned : classSubjects;
    // A class with no subjects at all has no exam to evaluate (the
    // Dashboard's old rule: skip when the subject list is empty — with no
    // subjects calculateTotalGPA would call a mark-less student "passed").
    if (examSubjects.length === 0) return null;
    const stats = calculateTotalGPA(examSubjects, marks, student.id, examId, student.group, exams);
    return { student, ...stats };
  }).filter((r): r is ExamPassRateStudent => r !== null);

  const passed = results.filter(r => !r.isFail).length;
  return {
    examId,
    evaluated: results.length,
    passed,
    failed: results.length - passed,
    passRate: calcPassRate(passed, results.length),
    results,
  };
}

/**
 * Resolve which exam the shared selector should show: a stored id wins
 * when that exam still exists; otherwise the first exam of the current
 * academic year (the Dashboard's old default — yearExams[0]); otherwise
 * the first exam; '' when there are no exams.
 */
export function resolveSelectedExamId(
  exams: Exam[],
  storedId?: string | null,
  currentYearName?: string,
): string {
  if (!exams || exams.length === 0) return '';
  if (storedId && exams.some(e => e.id === storedId)) return storedId;
  if (currentYearName) {
    const yearExam = exams.find(e => !e.academicYear || e.academicYear === currentYearName);
    if (yearExam) return yearExam.id;
  }
  return exams[0].id;
}
