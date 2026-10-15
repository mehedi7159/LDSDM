/**
 * Academic Core & Subject Validation Engine
 * Validates Subjects, Teachers, Class-Subject Assignments, Teacher-Subject Assignments, and Class-Teacher Assignments.
 * Works for BOTH School and Madrasah institutions.
 */

import {
  Subject,
  AcademicTeacher,
  ClassSubjectAssignment,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
  SchoolClass,
  Section,
  AcademicYear,
  AcademicValidationResult
} from '../types';

const VALID_ENTITY_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const VALID_TEACHER_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

/**
 * Validates Subject Definition
 */
export function validateSubject(
  data: Partial<Subject>,
  existingSubjects: Subject[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'বিষয়ের নাম আবশ্যক (Subject name is required)';
  } else if (data.name.trim().length > 100) {
    errors.name = 'বিষয়ের নাম ১০০ অক্ষরের বেশি হতে পারবে না (Subject name must be under 100 characters)';
  } else {
    // Duplicate check for name within the same class/academic cycle
    const normalizedName = data.name.trim().toLowerCase();
    const classLevel = data.classLevel || '';
    const isDuplicate = existingSubjects.some(
      s => s.name.trim().toLowerCase() === normalizedName &&
           (s.classLevel || '') === classLevel &&
           s.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.name = 'এই শ্রেণীতে একই নামের বিষয় ইতিমধ্যে বিদ্যমান (Duplicate subject name for this class)';
    }
  }

  // 2. Subject Code duplicate check (if code provided)
  if (data.code && typeof data.code === 'string' && data.code.trim().length > 0) {
    const normalizedCode = data.code.trim().toUpperCase();
    const isCodeDuplicate = existingSubjects.some(
      s => s.code && s.code.trim().toUpperCase() === normalizedCode && s.id !== (editingId || '')
    );
    if (isCodeDuplicate) {
      errors.code = 'এই বিষয় কোড ইতিমধ্যে ব্যবহৃত হয়েছে (Subject code already exists)';
    }
  }

  // 3. Mark boundaries validation
  const fullMarks = data.fullMarks !== undefined ? Number(data.fullMarks) : 100;
  const passMarks = data.passMarks !== undefined ? Number(data.passMarks) : 33;

  if (isNaN(fullMarks) || fullMarks < 1 || fullMarks > 1000) {
    errors.fullMarks = 'পূর্ণমান ১ থেকে ১০০০ এর মধ্যে হতে হবে (Full marks must be between 1 and 1000)';
  }

  if (isNaN(passMarks) || passMarks < 0 || passMarks > fullMarks) {
    errors.passMarks = 'পাস মার্ক ০ থেকে পূর্ণমানের মধ্যে হতে হবে (Pass marks must be between 0 and full marks)';
  }

  // 4. CQ / Theory validation
  if (data.hasCQ) {
    const cq = Number(data.cqMarks || 0);
    const cqPass = Number(data.cqPassMarks || 0);
    if (cq <= 0 || cq > fullMarks) {
      errors.cqMarks = 'সঠিক CQ নম্বর নির্ধারণ করুন (Invalid CQ marks)';
    }
    if (cqPass < 0 || cqPass > cq) {
      errors.cqPassMarks = 'CQ পাস মার্ক CQ নম্বরের বেশি হতে পারবে না (CQ pass marks cannot exceed CQ full marks)';
    }
  }

  // 5. MCQ validation
  if (data.hasMCQ) {
    const mcq = Number(data.mcqMarks || 0);
    const mcqPass = Number(data.mcqPassMarks || 0);
    if (mcq <= 0 || mcq > fullMarks) {
      errors.mcqMarks = 'সঠিক MCQ নম্বর নির্ধারণ করুন (Invalid MCQ marks)';
    }
    if (mcqPass < 0 || mcqPass > mcq) {
      errors.mcqPassMarks = 'MCQ পাস মার্ক MCQ নম্বরের বেশি হতে পারবে না (MCQ pass marks cannot exceed MCQ full marks)';
    }
  }

  // 6. Practical validation
  if (data.hasPractical) {
    const practical = Number(data.practicalMarks || 0);
    const practicalPass = Number(data.practicalPassMarks || 0);
    if (practical <= 0 || practical > fullMarks) {
      errors.practicalMarks = 'সঠিক ব্যবহারিক নম্বর নির্ধারণ করুন (Invalid practical marks)';
    }
    if (practicalPass < 0 || practicalPass > practical) {
      errors.practicalPassMarks = 'ব্যবহারিক পাস মার্ক ব্যবহারিক নম্বরের বেশি হতে পারবে না (Practical pass marks cannot exceed practical marks)';
    }
  }

  // 7. Status validation
  if (data.status && !VALID_ENTITY_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ বিষয় স্ট্যাটাস (Invalid subject status)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Class-Subject Assignment
 */
export function validateClassSubjectAssignment(
  data: Partial<ClassSubjectAssignment>,
  existingAssignments: ClassSubjectAssignment[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  subjects: Subject[] = [],
  academicYears: AcademicYear[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Subject exists and is active
  if (!data.subjectId || data.subjectId.trim().length === 0) {
    errors.subjectId = 'বিষয় নির্বাচন আবশ্যক (Subject is required)';
  } else {
    const subject = subjects.find(s => s.id === data.subjectId);
    if (!subject) {
      errors.subjectId = 'নির্দিষ্ট বিষয় খুঁজে পাওয়া যায়নি (Subject not found)';
    } else if (subject.status === 'INACTIVE') {
      errors.subjectId = 'নিষ্ক্রিয় বিষয় নির্ধারণ করা যাবে না (Cannot assign inactive subject)';
    }
  }

  // 2. Class exists and is active
  if (!data.classId || data.classId.trim().length === 0) {
    errors.classId = 'শ্রেণী নির্বাচন আবশ্যক (Class is required)';
  } else {
    const targetClass = classes.find(c => c.id === data.classId || c.name === data.classId);
    if (!targetClass) {
      errors.classId = 'নির্দিষ্ট শ্রেণী খুঁজে পাওয়া যায়নি (Class not found)';
    } else if (targetClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে বিষয় নির্ধারণ করা যাবে না (Cannot assign to inactive class)';
    } else if (data.academicYearId && targetClass.academicYearId && targetClass.academicYearId !== data.academicYearId) {
      errors.academicYearMismatch = 'শ্রেণীর শিক্ষাবর্ষ ও অ্যাসাইনমেন্টের শিক্ষাবর্ষ মিল নেই (Academic year mismatch with class)';
    }
  }

  // 3. Academic Year exists
  if (!data.academicYearId || data.academicYearId.trim().length === 0) {
    errors.academicYearId = 'শিক্ষাবর্ষ আবশ্যক (Academic year is required)';
  } else if (academicYears.length > 0) {
    const year = academicYears.find(y => y.id === data.academicYearId || y.name === data.academicYearId);
    if (!year) {
      errors.academicYearId = 'নির্দিষ্ট শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি (Academic year not found)';
    }
  }

  // 4. Section validation (if section-specific)
  if (data.sectionId && data.sectionId.trim().length > 0) {
    const section = sections.find(s => s.id === data.sectionId);
    if (!section) {
      errors.sectionId = 'নির্দিষ্ট শাখা খুঁজে পাওয়া যায়নি (Section not found)';
    } else {
      if (section.status === 'INACTIVE') {
        errors.sectionId = 'নিষ্ক্রিয় শাখায় বিষয় নির্ধারণ করা যাবে না (Cannot assign to inactive section)';
      }
      if (data.classId && section.classId !== data.classId) {
        const cls = classes.find(c => c.id === data.classId || c.name === data.classId);
        if (!cls || (section.classId !== cls.id && section.classId !== cls.name)) {
          errors.sectionClassMismatch = 'শাখাটি নির্বাচিত শ্রেণীর অন্তর্ভুক্ত নয় (Section does not belong to class)';
        }
      }
    }
  }

  // 5. Duplicate Assignment Prevention
  if (data.subjectId && data.classId && data.academicYearId) {
    const targetSec = data.sectionId || '';
    const isDuplicate = existingAssignments.some(
      a => a.subjectId === data.subjectId &&
           a.classId === data.classId &&
           a.academicYearId === data.academicYearId &&
           (a.sectionId || '') === targetSec &&
           a.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.duplicateAssignment = 'এই শ্রেণীতে/শাখায় বিষয়টি ইতিমধ্যে নির্ধারিত রয়েছে (Subject is already assigned to this class/section)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Academic Teacher / Staff
 */
export function validateAcademicTeacher(
  data: Partial<AcademicTeacher>,
  existingTeachers: AcademicTeacher[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'শিক্ষকের নাম আবশ্যক (Teacher name is required)';
  } else if (data.name.trim().length > 100) {
    errors.name = 'শিক্ষকের নাম ১০০ অক্ষরের বেশি হতে পারবে না (Name must be under 100 characters)';
  }

  // 2. Employee Code uniqueness (if provided)
  if (data.employeeCode && typeof data.employeeCode === 'string' && data.employeeCode.trim().length > 0) {
    const code = data.employeeCode.trim().toUpperCase();
    const isDuplicate = existingTeachers.some(
      t => t.employeeCode && t.employeeCode.trim().toUpperCase() === code && t.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.employeeCode = 'এই শিক্ষক কোড ইতিমধ্যে ব্যবহৃত হয়েছে (Employee code already in use)';
    }
  }

  // 3. Email validation (if provided)
  if (data.email && typeof data.email === 'string' && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.email = 'সঠিক ইমেইল ঠিকানা দিন (Invalid email address)';
    }
  }

  // 4. Status validation
  if (data.status && !VALID_TEACHER_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ শিক্ষক স্ট্যাটাস (Invalid teacher status)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Teacher-Subject Assignment
 */
export function validateTeacherSubjectAssignment(
  data: Partial<TeacherSubjectAssignment>,
  existingAssignments: TeacherSubjectAssignment[] = [],
  teachers: AcademicTeacher[] = [],
  subjects: Subject[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Teacher exists and is active
  if (!data.teacherId || data.teacherId.trim().length === 0) {
    errors.teacherId = 'শিক্ষক নির্বাচন আবশ্যক (Teacher is required)';
  } else {
    const teacher = teachers.find(t => t.id === data.teacherId);
    if (!teacher) {
      errors.teacherId = 'নির্দিষ্ট শিক্ষক খুঁজে পাওয়া যায়নি (Teacher not found)';
    } else if (teacher.status === 'INACTIVE') {
      errors.teacherId = 'নিষ্ক্রিয় শিক্ষককে দায়িত্ব নির্ধারণ করা যাবে না (Cannot assign inactive teacher)';
    }
  }

  // 2. Subject exists and is active
  if (!data.subjectId || data.subjectId.trim().length === 0) {
    errors.subjectId = 'বিষয় নির্বাচন আবশ্যক (Subject is required)';
  } else {
    const subject = subjects.find(s => s.id === data.subjectId);
    if (!subject) {
      errors.subjectId = 'নির্দিষ্ট বিষয় খুঁজে পাওয়া যায়নি (Subject not found)';
    } else if (subject.status === 'INACTIVE') {
      errors.subjectId = 'নিষ্ক্রিয় বিষয় নির্ধারণ করা যাবে না (Cannot assign inactive subject)';
    }
  }

  // 3. Class exists and is active
  if (!data.classId || data.classId.trim().length === 0) {
    errors.classId = 'শ্রেণী নির্বাচন আবশ্যক (Class is required)';
  } else {
    const targetClass = classes.find(c => c.id === data.classId || c.name === data.classId);
    if (!targetClass) {
      errors.classId = 'নির্দিষ্ট শ্রেণী খুঁজে পাওয়া যায়নি (Class not found)';
    } else if (targetClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে দায়িত্ব নির্ধারণ করা যাবে না (Cannot assign to inactive class)';
    }
  }

  // 4. Academic Year exists
  if (!data.academicYearId || data.academicYearId.trim().length === 0) {
    errors.academicYearId = 'শিক্ষাবর্ষ আবশ্যক (Academic year is required)';
  } else if (academicYears.length > 0) {
    const year = academicYears.find(y => y.id === data.academicYearId || y.name === data.academicYearId);
    if (!year) {
      errors.academicYearId = 'নির্দিষ্ট শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি (Academic year not found)';
    }
  }

  // 5. Section validation (if provided)
  if (data.sectionId && data.sectionId.trim().length > 0) {
    const section = sections.find(s => s.id === data.sectionId);
    if (!section) {
      errors.sectionId = 'নির্দিষ্ট শাখা খুঁজে পাওয়া যায়নি (Section not found)';
    } else if (section.status === 'INACTIVE') {
      errors.sectionId = 'নিষ্ক্রিয় শাখা নির্বাচন করা যাবে না (Cannot assign to inactive section)';
    }
  }

  // 6. Duplicate Assignment Prevention (same teacher, subject, class, section, academicYear)
  if (data.teacherId && data.subjectId && data.classId && data.academicYearId) {
    const targetSec = data.sectionId || '';
    const isDuplicate = existingAssignments.some(
      a => a.teacherId === data.teacherId &&
           a.subjectId === data.subjectId &&
           a.classId === data.classId &&
           a.academicYearId === data.academicYearId &&
           (a.sectionId || '') === targetSec &&
           a.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.duplicate = 'এই শিক্ষক ইতিমধ্যে এই শ্রেণী ও বিষয়ে দায়িত্বপ্রাপ্ত (Teacher already assigned to this subject/class)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Class Teacher / Section Teacher Assignment
 */
export function validateClassTeacherAssignment(
  data: Partial<ClassTeacherAssignment>,
  existingAssignments: ClassTeacherAssignment[] = [],
  teachers: AcademicTeacher[] = [],
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Teacher validation
  if (!data.teacherId || data.teacherId.trim().length === 0) {
    errors.teacherId = 'শিক্ষক নির্বাচন আবশ্যক (Teacher is required)';
  } else {
    const teacher = teachers.find(t => t.id === data.teacherId);
    if (!teacher) {
      errors.teacherId = 'নির্দিষ্ট শিক্ষক খুঁজে পাওয়া যায়নি (Teacher not found)';
    } else if (teacher.status === 'INACTIVE') {
      errors.teacherId = 'নিষ্ক্রিয় শিক্ষককে শ্রেণী শিক্ষক হিসেবে নির্ধারণ করা যাবে না (Cannot assign inactive teacher as class teacher)';
    }
  }

  // 2. Class validation
  if (!data.classId || data.classId.trim().length === 0) {
    errors.classId = 'শ্রেণী নির্বাচন আবশ্যক (Class is required)';
  } else {
    const targetClass = classes.find(c => c.id === data.classId || c.name === data.classId);
    if (!targetClass) {
      errors.classId = 'নির্দিষ্ট শ্রেণী খুঁজে পাওয়া যায়নি (Class not found)';
    } else if (targetClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে শ্রেণী শিক্ষক নির্ধারণ করা যাবে না (Cannot assign to inactive class)';
    }
  }

  // 3. Academic Year validation
  if (!data.academicYearId || data.academicYearId.trim().length === 0) {
    errors.academicYearId = 'শিক্ষাবর্ষ আবশ্যক (Academic year is required)';
  }

  // 4. Section validation for SECTION_TEACHER
  if (data.type === 'SECTION_TEACHER') {
    if (!data.sectionId || data.sectionId.trim().length === 0) {
      errors.sectionId = 'শাখা শিক্ষক নির্ধারণে শাখা নির্বাচন আবশ্যক (Section is required for section teacher)';
    } else {
      const section = sections.find(s => s.id === data.sectionId);
      if (!section) {
        errors.sectionId = 'নির্দিষ্ট শাখা খুঁজে পাওয়া যায়নি (Section not found)';
      }
    }
  }

  // 5. Conflict Protection: Single Class Teacher per Class & Academic Year
  if (data.type === 'CLASS_TEACHER' && data.classId && data.academicYearId) {
    const conflict = existingAssignments.find(
      a => a.type === 'CLASS_TEACHER' &&
           a.classId === data.classId &&
           a.academicYearId === data.academicYearId &&
           a.status === 'ACTIVE' &&
           a.id !== (editingId || '')
    );
    if (conflict) {
      errors.classTeacherConflict = 'এই শ্রেণীতে ইতিমধ্যে একজন প্রধান শ্রেণী শিক্ষক নির্ধারিত রয়েছেন (A class teacher is already assigned to this class)';
    }
  }

  // 6. Conflict Protection: Single Section Teacher per Section & Academic Year
  if (data.type === 'SECTION_TEACHER' && data.classId && data.sectionId && data.academicYearId) {
    const conflict = existingAssignments.find(
      a => a.type === 'SECTION_TEACHER' &&
           a.classId === data.classId &&
           a.sectionId === data.sectionId &&
           a.academicYearId === data.academicYearId &&
           a.status === 'ACTIVE' &&
           a.id !== (editingId || '')
    );
    if (conflict) {
      errors.sectionTeacherConflict = 'এই শাখায় ইতিমধ্যে একজন শাখা শিক্ষক নির্ধারিত রয়েছেন (A section teacher is already assigned to this section)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
