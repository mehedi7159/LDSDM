/**
 * Production Exam, Exam-Subject Schedule & Marks Validation Engine
 * Enforces mark boundaries, component sanity, absent consistency, and finalization constraints.
 * Works for BOTH School and Madrasah.
 */

import {
  Exam,
  ExamSubjectAssignment,
  MarkRecord,
  Subject,
  ClassSubjectAssignment,
  SchoolClass,
  Section,
  AcademicYear,
  AcademicValidationResult
} from '../types';
import { Student } from '../types/student';

const VALID_EXAM_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'MARKS_ENTRY', 'FINALIZED', 'ARCHIVED']);
const VALID_MARK_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'LOCKED', 'FINALIZED']);

/**
 * Validates Exam Configuration
 */
export function validateExam(
  data: Partial<Exam>,
  existingExams: Exam[] = [],
  academicYears: AcademicYear[] = [],
  classes: SchoolClass[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'পরীক্ষার নাম আবশ্যক (Exam name is required)';
  } else if (data.name.trim().length > 100) {
    errors.name = 'পরীক্ষার নাম ১০০ অক্ষরের বেশি হতে পারবে না (Name must be under 100 characters)';
  } else {
    // Duplicate check within same academic year
    const normalizedName = data.name.trim().toLowerCase();
    const academicYear = data.academicYear || '';
    const isDuplicate = existingExams.some(
      e => e.name.trim().toLowerCase() === normalizedName &&
           (e.academicYear || '') === academicYear &&
           e.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.name = 'এই শিক্ষাবর্ষে একই নামের পরীক্ষা ইতিমধ্যে বিদ্যমান (Duplicate exam name for this academic year)';
    }
  }

  // 2. Academic Year validation
  if (!data.academicYear || data.academicYear.trim().length === 0) {
    errors.academicYear = 'শিক্ষাবর্ষ আবশ্যক (Academic year is required)';
  } else if (academicYears.length > 0) {
    const yearExists = academicYears.some(
      y => y.id === data.academicYearId || y.name === data.academicYear || y.id === data.academicYear
    );
    if (!yearExists) {
      errors.academicYear = 'নির্দিষ্ট শিক্ষাবর্ষটি খুঁজে পাওয়া যায়নি (Academic year not found)';
    }
  }

  // 3. Category validation
  if (!data.category || data.category.trim().length === 0) {
    errors.category = 'পরীক্ষার ক্যাটাগরি আবশ্যক (Exam category is required)';
  }

  // 4. Status validation
  if (data.status && !VALID_EXAM_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ পরীক্ষার স্ট্যাটাস (Invalid exam status)';
  }

  // 5. Date validation (if provided)
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate).getTime();
    const end = new Date(data.endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && start > end) {
      errors.dates = 'পরীক্ষা শুরুর তারিখ শেষ তারিখের পূর্বে হতে হবে (Start date cannot be after end date)';
    }
  }

  // 6. Contribution percentages: the weighted parts must sum to ≤ 100.
  // Above that, getConsolidatedMark clamps the current exam's weight to
  // 0 while contributor weights stay unnormalized — the current exam's
  // marks would silently stop counting. (Latent: no contributions UI
  // exists in the app today; this guards the data path at save time.)
  if (data.contributions && data.contributions.length > 0) {
    let contributionSum = 0;
    for (const c of data.contributions) {
      if (typeof c.percentage !== 'number' || isNaN(c.percentage) || c.percentage < 0 || c.percentage > 100) {
        errors.contributions = 'প্রতিটি অবদানের শতাংশ ০ থেকে ১০০ এর মধ্যে হতে হবে (Each contribution percentage must be 0-100)';
        break;
      }
      contributionSum += c.percentage;
    }
    if (!errors.contributions && contributionSum > 100) {
      errors.contributions = `অবদানের মোট শতাংশ ${contributionSum} — ১০০ এর বেশি হতে পারবে না (Contribution percentages must sum to 100 or less, got ${contributionSum})`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Exam Subject Assignment
 */
export function validateExamSubjectAssignment(
  data: Partial<ExamSubjectAssignment>,
  existingAssignments: ExamSubjectAssignment[] = [],
  exams: Exam[] = [],
  subjects: Subject[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = [],
  classSubjectAssignments: ClassSubjectAssignment[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Exam validation
  if (!data.examId || data.examId.trim().length === 0) {
    errors.examId = 'পরীক্ষা নির্বাচন আবশ্যক (Exam is required)';
  } else {
    const exam = exams.find(e => e.id === data.examId);
    if (!exam) {
      errors.examId = 'নির্দিষ্ট পরীক্ষা খুঁজে পাওয়া যায়নি (Exam not found)';
    } else if (exam.status === 'FINALIZED') {
      errors.examId = 'চূড়ান্তকৃত পরীক্ষায় নতুন বিষয় যুক্ত করা যাবে না (Cannot modify finalized exam)';
    } else if (exam.status === 'ARCHIVED') {
      errors.examId = 'আর্কাইভকৃত পরীক্ষায় বিষয় যুক্ত করা যাবে না (Cannot modify archived exam)';
    }
  }

  // 2. Class validation
  if (!data.classId || data.classId.trim().length === 0) {
    errors.classId = 'শ্রেণী নির্বাচন আবশ্যক (Class is required)';
  } else {
    const targetClass = classes.find(c => c.id === data.classId || c.name === data.classId);
    if (!targetClass) {
      errors.classId = 'নির্দিষ্ট শ্রেণী খুঁজে পাওয়া যায়নি (Class not found)';
    } else if (targetClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে পরীক্ষা নির্ধারণ করা যাবে না (Cannot schedule for inactive class)';
    }
  }

  // 3. Subject validation
  if (!data.subjectId || data.subjectId.trim().length === 0) {
    errors.subjectId = 'বিষয় নির্বাচন আবশ্যক (Subject is required)';
  } else {
    const subject = subjects.find(s => s.id === data.subjectId);
    if (!subject) {
      errors.subjectId = 'নির্দিষ্ট বিষয় খুঁজে পাওয়া যায়নি (Subject not found)';
    } else if (subject.status === 'INACTIVE') {
      errors.subjectId = 'নিষ্ক্রিয় বিষয় পরীক্ষায় নির্ধারণ করা যাবে না (Cannot schedule inactive subject)';
    } else {
      // Check if subject is assigned to this class
      if (classSubjectAssignments.length > 0 && data.classId) {
        const isAssignedToClass = classSubjectAssignments.some(
          csa => csa.subjectId === data.subjectId &&
                 (csa.classId === data.classId || csa.classId === data.classId) &&
                 csa.status === 'ACTIVE'
        );
        if (!isAssignedToClass && subject.classLevel !== data.classId) {
          errors.subjectNotAssigned = 'বিষয়টি নির্বাচিত শ্রেণীর পাঠ্যক্রমে নির্ধারিত নয় (Subject is not assigned to this class)';
        }
      }
    }
  }

  // 4. Duplicate assignment prevention (Exam + Class + Subject + Section)
  if (data.examId && data.classId && data.subjectId) {
    const targetSec = data.sectionId || '';
    const isDuplicate = existingAssignments.some(
      a => a.examId === data.examId &&
           a.classId === data.classId &&
           a.subjectId === data.subjectId &&
           (a.sectionId || '') === targetSec &&
           a.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.duplicateAssignment = 'এই পরীক্ষা ও শ্রেণীতে বিষয়টি ইতিমধ্যে নির্ধারিত রয়েছে (Subject already scheduled in this exam)';
    }
  }

  // 5. Mark boundaries
  const fullMarks = data.fullMarks !== undefined ? Number(data.fullMarks) : 100;
  const passMarks = data.passMarks !== undefined ? Number(data.passMarks) : 33;

  if (isNaN(fullMarks) || fullMarks < 1 || fullMarks > 1000) {
    errors.fullMarks = 'পূর্ণমান ১ থেকে ১০০০ এর মধ্যে হতে হবে (Full marks must be between 1 and 1000)';
  }

  if (isNaN(passMarks) || passMarks < 0 || passMarks > fullMarks) {
    errors.passMarks = 'পাস মার্ক ০ থেকে পূর্ণমানের মধ্যে হতে হবে (Pass marks must be between 0 and full marks)';
  }

  // Component breakdowns check
  if (data.cqFullMarks !== undefined && (data.cqFullMarks < 0 || data.cqFullMarks > fullMarks)) {
    errors.cqFullMarks = 'CQ পূর্ণমান সঠিক নয় (Invalid CQ full marks)';
  }
  if (data.mcqFullMarks !== undefined && (data.mcqFullMarks < 0 || data.mcqFullMarks > fullMarks)) {
    errors.mcqFullMarks = 'MCQ পূর্ণমান সঠিক নয় (Invalid MCQ full marks)';
  }
  if (data.practicalFullMarks !== undefined && (data.practicalFullMarks < 0 || data.practicalFullMarks > fullMarks)) {
    errors.practicalFullMarks = 'ব্যবহারিক পূর্ণমান সঠিক নয় (Invalid practical full marks)';
  }

  // Component sum: same rule as subjects — present components must add
  // up to full marks (CQ 70 + MCQ 30 + Practical 25 = 125 vs 100 is
  // not a valid schedule).
  const hasComponents = data.cqFullMarks !== undefined || data.mcqFullMarks !== undefined || data.practicalFullMarks !== undefined;
  if (hasComponents) {
    const componentSum = (data.cqFullMarks ?? 0) + (data.mcqFullMarks ?? 0) + (data.practicalFullMarks ?? 0);
    if (componentSum !== fullMarks) {
      errors.componentSum = `উপাদানগুলোর যোগফল ${componentSum}, কিন্তু পূর্ণমান ${fullMarks} (CQ ${data.cqFullMarks ?? 0} + MCQ ${data.mcqFullMarks ?? 0} + ব্যবহারিক ${data.practicalFullMarks ?? 0}) — যোগফল পূর্ণমানের সমান হতে হবে (Component marks must sum to full marks: ${componentSum} ≠ ${fullMarks})`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Individual Student Mark Record
 */
export function validateMarkRecord(
  mark: Partial<MarkRecord>,
  subject?: Subject,
  examSubject?: ExamSubjectAssignment,
  exam?: Exam
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Mandatory IDs
  if (!mark.studentId || mark.studentId.trim().length === 0) {
    errors.studentId = 'শিক্ষার্থীর আইডি আবশ্যক (Student ID is required)';
  }
  if (!mark.subjectId || mark.subjectId.trim().length === 0) {
    errors.subjectId = 'বিষয় আবশ্যক (Subject is required)';
  }
  if (!mark.examId || mark.examId.trim().length === 0) {
    errors.examId = 'পরীক্ষা আবশ্যক (Exam is required)';
  }

  // 2. Exam Finalized / Locked check
  if (exam && (exam.status === 'FINALIZED' || exam.status === 'ARCHIVED')) {
    errors.examLocked = 'পরীক্ষাটি চূড়ান্ত বা আর্কাইভকৃত, নম্বর পরিবর্তন করা যাবে না (Exam is finalized/locked)';
  }

  if (mark.status === 'LOCKED' || mark.status === 'FINALIZED') {
    errors.markLocked = 'এই নম্বরটি লক করা রয়েছে (Mark record is locked)';
  }

  // 3. Absent Logic & Sanity
  if (mark.isAbsent) {
    // If student is marked absent, CQ/MCQ/Practical obtained marks must be zero/empty to prevent contradictions
    if (mark.obtainedCQ && Number(mark.obtainedCQ) > 0) {
      errors.absentContradiction = 'অনুপস্থিত শিক্ষার্থীর প্রাপ্ত নম্বর থাকতে পারবে না (Absent student cannot have obtained marks)';
    }
    if (mark.obtainedMCQ && Number(mark.obtainedMCQ) > 0) {
      errors.absentContradiction = 'অনুপস্থিত শিক্ষার্থীর প্রাপ্ত নম্বর থাকতে পারবে না (Absent student cannot have obtained marks)';
    }
    if (mark.obtainedPractical && Number(mark.obtainedPractical) > 0) {
      errors.absentContradiction = 'অনুপস্থিত শিক্ষার্থীর প্রাপ্ত নম্বর থাকতে পারবে না (Absent student cannot have obtained marks)';
    }
    if (mark.obtained && Number(mark.obtained) > 0) {
      errors.absentContradiction = 'অনুপস্থিত শিক্ষার্থীর প্রাপ্ত নম্বর থাকতে পারবে না (Absent student cannot have obtained marks)';
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // 4. Mark Component Boundaries
  const fullMarks = examSubject?.fullMarks ?? subject?.fullMarks ?? mark.total ?? mark.fullMarks ?? 100;

  // CQ Check
  const maxCQ = examSubject?.cqFullMarks ?? subject?.cqMarks;
  if (maxCQ !== undefined && maxCQ > 0 && mark.obtainedCQ !== undefined && mark.obtainedCQ !== null) {
    const numCQ = Number(mark.obtainedCQ);
    if (isNaN(numCQ) || numCQ < 0 || numCQ > maxCQ) {
      errors.obtainedCQ = `CQ নম্বর ০ থেকে ${maxCQ} এর মধ্যে হতে হবে (CQ must be 0-${maxCQ})`;
    }
  }

  // MCQ Check
  const maxMCQ = examSubject?.mcqFullMarks ?? subject?.mcqMarks;
  if (maxMCQ !== undefined && maxMCQ > 0 && mark.obtainedMCQ !== undefined && mark.obtainedMCQ !== null) {
    const numMCQ = Number(mark.obtainedMCQ);
    if (isNaN(numMCQ) || numMCQ < 0 || numMCQ > maxMCQ) {
      errors.obtainedMCQ = `MCQ নম্বর ০ থেকে ${maxMCQ} এর মধ্যে হতে হবে (MCQ must be 0-${maxMCQ})`;
    }
  }

  // Practical Check
  const maxPractical = examSubject?.practicalFullMarks ?? subject?.practicalMarks;
  if (maxPractical !== undefined && maxPractical > 0 && mark.obtainedPractical !== undefined && mark.obtainedPractical !== null) {
    const numPractical = Number(mark.obtainedPractical);
    if (isNaN(numPractical) || numPractical < 0 || numPractical > maxPractical) {
      errors.obtainedPractical = `ব্যবহারিক নম্বর ০ থেকে ${maxPractical} এর মধ্যে হতে হবে (Practical must be 0-${maxPractical})`;
    }
  }

  // Total Obtained Check
  if (mark.obtained !== undefined && mark.obtained !== null) {
    const numObtained = Number(mark.obtained);
    if (isNaN(numObtained) || numObtained < 0 || numObtained > fullMarks) {
      errors.obtained = `মোট নম্বর ০ থেকে ${fullMarks} এর মধ্যে হতে হবে (Total obtained must be 0-${fullMarks})`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Bulk Marks List
 */
export function validateBulkMarks(
  marks: Partial<MarkRecord>[],
  subject?: Subject,
  examSubject?: ExamSubjectAssignment,
  exam?: Exam
): { isValid: boolean; rowErrors: Record<number, Record<string, string>> } {
  const rowErrors: Record<number, Record<string, string>> = {};

  marks.forEach((m, idx) => {
    const validation = validateMarkRecord(m, subject, examSubject, exam);
    if (!validation.isValid) {
      rowErrors[idx] = validation.errors;
    }
  });

  return {
    isValid: Object.keys(rowErrors).length === 0,
    rowErrors
  };
}

/**
 * Validates Exam Finalization Pre-conditions
 */
export function validateExamFinalization(
  exam: Exam,
  examSubjects: ExamSubjectAssignment[],
  marks: MarkRecord[],
  students: Student[],
  subjects: Subject[] = []
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  if (!exam) {
    errors.exam = 'নির্দিষ্ট পরীক্ষা পাওয়া যায়নি (Exam not found)';
    return { isValid: false, errors };
  }

  if (exam.status === 'FINALIZED') {
    errors.alreadyFinalized = 'পরীক্ষাটি ইতিমধ্যে চূড়ান্তকৃত (Exam is already finalized)';
    return { isValid: false, errors };
  }

  if (examSubjects.length === 0) {
    errors.noSubjects = 'পরীক্ষায় কোনো বিষয় নির্ধারিত নেই, চূড়ান্ত করা যাবে না (No subjects scheduled for this exam)';
  }

  // Check impossible mark values in the exam
  const examMarks = marks.filter(m => m.examId === exam.id);
  const hasNegative = examMarks.some(m => !m.isAbsent && m.obtained < 0);
  if (hasNegative) {
    errors.negativeMarks = 'পরীক্ষার নম্বরে ঋণাত্মক মান রয়েছে, সংশোধন করুন (Negative mark values detected)';
  }

  // Total/component excess against the ASSIGNMENT's full marks (the
  // exam's copy), falling back to the stored record value only when
  // there is no assignment — a stored fullMarks of 100 must not hide
  // an 80 against an assignment full of 70.
  const assignmentBySubject = new Map(examSubjects.map(es => [es.subjectId, es]));
  const hasExcessive = examMarks.some(m => {
    if (m.isAbsent) return false;
    const es = assignmentBySubject.get(m.subjectId);
    if (m.obtained > (es?.fullMarks ?? m.fullMarks ?? 100)) return true;
    if (m.obtainedCQ !== undefined && es?.cqFullMarks !== undefined && m.obtainedCQ > es.cqFullMarks) return true;
    if (m.obtainedMCQ !== undefined && es?.mcqFullMarks !== undefined && m.obtainedMCQ > es.mcqFullMarks) return true;
    if (m.obtainedPractical !== undefined && es?.practicalFullMarks !== undefined && m.obtainedPractical > es.practicalFullMarks) return true;
    return false;
  });
  if (hasExcessive) {
    errors.excessiveMarks = 'পূর্ণমানের চেয়ে বেশি প্রাপ্ত নম্বর পাওয়া গেছে (Marks exceeding full marks detected)';
  }

  // Absent students must not carry obtained marks.
  const hasAbsentContradiction = examMarks.some(m => m.isAbsent && (
    (m.obtained || 0) > 0 || (m.obtainedCQ || 0) > 0 || (m.obtainedMCQ || 0) > 0 || (m.obtainedPractical || 0) > 0
  ));
  if (hasAbsentContradiction) {
    errors.absentContradiction = 'অনুপস্থিত শিক্ষার্থীর প্রাপ্ত নম্বর রয়েছে, সংশোধন করুন (Absent student has obtained marks)';
  }

  // Completeness: every active student in the exam's classes needs a
  // mark for every scheduled subject that applies to their group.
  // Missing entries block finalization — a half-marked exam must not
  // be finalized by accident.
  const classIds = new Set(examSubjects.map(es => es.classId));
  const scopedStudents = students.filter(s =>
    s.status === 'Active' && !s.isFormer &&
    (classIds.has(s.classLevel) || (s.classId !== undefined && classIds.has(s.classId)))
  );
  const subjectById = new Map(subjects.map(s => [s.id, s]));
  let unmarkedPairs = 0;
  const unmarkedStudentIds = new Set<string>();
  for (const st of scopedStudents) {
    for (const es of examSubjects) {
      const sub = subjectById.get(es.subjectId);
      if (sub && sub.group && sub.group !== 'All' && sub.group !== st.group) continue;
      const hasMark = examMarks.some(m => m.studentId === st.id && m.subjectId === es.subjectId);
      if (!hasMark) {
        unmarkedPairs++;
        unmarkedStudentIds.add(st.id);
      }
    }
  }
  if (unmarkedPairs > 0) {
    errors.incompleteMarks = `${unmarkedStudentIds.size} জন শিক্ষার্থীর মোট ${unmarkedPairs}টি বিষয়ে নম্বর বাকি রয়েছে — চূড়ান্ত করার আগে নম্বর দিন (Marks missing for ${unmarkedStudentIds.size} student(s) across ${unmarkedPairs} subject entries)`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
