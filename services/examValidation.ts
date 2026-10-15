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
  students: Student[]
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

  const hasExcessive = examMarks.some(m => !m.isAbsent && m.fullMarks && m.obtained > m.fullMarks);
  if (hasExcessive) {
    errors.excessiveMarks = 'পূর্ণমানের চেয়ে বেশি প্রাপ্ত নম্বর পাওয়া গেছে (Marks exceeding full marks detected)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
