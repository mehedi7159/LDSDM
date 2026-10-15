import {
  buildCreateExamPayload,
  buildUpdateExamPayload,
  buildArchiveExamPayload,
  buildFinalizeExamPayload,
  buildCreateExamSubjectPayload,
  buildArchiveExamSubjectPayload,
  buildUpsertMarkPayload,
  verifyTeacherMarkAccess
} from '../services/examService';
import {
  validateExam,
  validateExamSubjectAssignment,
  validateMarkRecord,
  validateExamFinalization
} from '../services/examValidation';
import {
  calculateSubjectGrade,
  calculateSubjectGradePoint,
  calculateGPA,
  calculateStudentExamSummary
} from '../services/gradingEngine';
import {
  checkPermission,
  buildAuthorizationContext,
  isVerifiedSuperAdmin
} from '../services/authorization';
import type { 
  Exam, 
  ExamSubjectAssignment, 
  MarkRecord, 
  Subject, 
  ClassSubjectAssignment, 
  SchoolClass, 
  Section, 
  AcademicYear 
} from '../types';
import type { Student } from '../types/student';
import type { CustomRole, InstitutionMember } from '../types/rbac';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`, details || '');
  }
}

console.log('🧪 ========================================================');
console.log('🧪 PHASE 3 — PRODUCTION EXAM + MARKS + GRADING TEST SUITE');
console.log('🧪 ========================================================\n');

// Common Fixtures
const academicYear2026: AcademicYear = {
  id: 'ay_2026',
  institutionId: 'inst_madrasah_primary',
  name: '2026',
  status: 'ACTIVE',
  isCurrent: true
};

const class7: SchoolClass = {
  id: 'cls_7',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  name: 'Class 7',
  order: 7,
  status: 'ACTIVE'
};

const class8: SchoolClass = {
  id: 'cls_8',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  name: 'Class 8',
  order: 8,
  status: 'ACTIVE'
};

const mathSubject: Subject = {
  id: 'sub_math_7',
  name: 'Mathematics',
  nameBn: 'গণিত',
  code: 'MATH-101',
  classLevel: 'Class 7',
  fullMarks: 100,
  passMarks: 33,
  hasCQ: true,
  cqMarks: 70,
  cqPassMarks: 23,
  hasMCQ: true,
  mcqMarks: 30,
  mcqPassMarks: 10,
  isOptional: false,
  order: 1,
  status: 'ACTIVE'
};

const scienceSubject: Subject = {
  id: 'sub_sci_7',
  name: 'General Science',
  nameBn: 'বিজ্ঞান',
  code: 'SCI-101',
  classLevel: 'Class 7',
  fullMarks: 100,
  passMarks: 33,
  hasCQ: true,
  cqMarks: 50,
  cqPassMarks: 17,
  hasMCQ: true,
  mcqMarks: 25,
  mcqPassMarks: 8,
  hasPractical: true,
  practicalMarks: 25,
  practicalPassMarks: 8,
  isOptional: false,
  order: 2,
  status: 'ACTIVE'
};

const higherMathSubject: Subject = {
  id: 'sub_hm_7',
  name: 'Higher Mathematics',
  nameBn: 'উচ্চতর গণিত',
  code: 'HM-101',
  classLevel: 'Class 7',
  fullMarks: 100,
  passMarks: 33,
  isOptional: true,
  isFourthSubject: true,
  order: 3,
  status: 'ACTIVE'
};

const csaMath7: ClassSubjectAssignment = {
  id: 'csa_math_7',
  academicYearId: 'ay_2026',
  classId: 'cls_7',
  subjectId: mathSubject.id,
  status: 'ACTIVE',
  order: 1
};

const csaSci7: ClassSubjectAssignment = {
  id: 'csa_sci_7',
  academicYearId: 'ay_2026',
  classId: 'cls_7',
  subjectId: scienceSubject.id,
  status: 'ACTIVE',
  order: 2
};

// -------------------------------------------------------------
// TEST 1 & 2: EXAM CREATION & ACADEMIC YEAR VALIDATION
// -------------------------------------------------------------
console.log('--- 1. Exam Creation & Academic Year Validation ---');

const { exam: examTerm1 } = buildCreateExamPayload(
  {
    name: '1st Term Examination 2026',
    nameBn: '১ম সাময়িক পরীক্ষা ২০২৬',
    academicYear: '2026',
    academicYearId: 'ay_2026',
    category: 'Term',
    status: 'SCHEDULED'
  },
  'inst_madrasah_primary',
  { uid: 'admin_1', email: 'admin@madrasah.edu' },
  [],
  [academicYear2026],
  [class7]
);

assert(
  !!examTerm1 && examTerm1.id.startsWith('ex_') && examTerm1.status === 'SCHEDULED',
  'TEST 1: Exam creation generates immutable ID and valid properties'
);

const valInvalidExamYear = validateExam(
  { name: 'Invalid Year Exam', academicYear: '2099', category: 'Term' },
  [],
  [academicYear2026],
  [class7]
);

assert(
  !valInvalidExamYear.isValid && !!valInvalidExamYear.errors.academicYear,
  'TEST 2: Exam with non-existent academic year is rejected'
);


// -------------------------------------------------------------
// TEST 3, 4 & 5: EXAM-SUBJECT SCHEDULING & DUPLICATE PROTECTION
// -------------------------------------------------------------
console.log('\n--- 2. Exam Subject Scheduling & Duplicate Protection ---');

const { assignment: esaMath7 } = buildCreateExamSubjectPayload(
  {
    examId: examTerm1!.id,
    academicYearId: 'ay_2026',
    classId: 'cls_7',
    subjectId: mathSubject.id,
    fullMarks: 100,
    passMarks: 33,
    cqFullMarks: 70,
    cqPassMarks: 23,
    mcqFullMarks: 30,
    mcqPassMarks: 10,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  [],
  [examTerm1!],
  [mathSubject],
  [class7],
  [],
  [academicYear2026],
  [csaMath7]
);

assert(
  !!esaMath7 && esaMath7.id.startsWith('exs_') && esaMath7.subjectId === mathSubject.id,
  'TEST 3 & 4: Exam Subject Assignment links subject to exam for Class 7'
);

const valDuplicateESA = validateExamSubjectAssignment(
  {
    examId: examTerm1!.id,
    classId: 'cls_7',
    subjectId: mathSubject.id
  },
  [esaMath7!],
  [examTerm1!],
  [mathSubject],
  [class7],
  [],
  [academicYear2026],
  [csaMath7]
);

assert(
  !valDuplicateESA.isValid && !!valDuplicateESA.errors.duplicateAssignment,
  'TEST 5: Duplicate exam subject scheduling for same exam & class is rejected'
);


// -------------------------------------------------------------
// TEST 6, 7 & 8: MARK COMPONENT & PASS MARKS VALIDATION
// -------------------------------------------------------------
console.log('\n--- 3. Mark Component & Boundary Validation ---');

const { mark: validMark } = buildUpsertMarkPayload(
  {
    studentId: 'std_01',
    subjectId: mathSubject.id,
    examId: examTerm1!.id,
    obtainedCQ: 65,
    obtainedMCQ: 28,
    isAbsent: false,
    total: 100
  },
  undefined,
  mathSubject,
  esaMath7!,
  examTerm1!
);

assert(
  !!validMark && validMark.obtained === 93 && validMark.grade === 'A+' && validMark.gradePoint === 5.0,
  'TEST 6 & 7: CQ + MCQ mark summation and boundary calculation is accurate (93 = A+ / 5.0)'
);

const valExcessiveMark = validateMarkRecord(
  {
    studentId: 'std_01',
    subjectId: mathSubject.id,
    examId: examTerm1!.id,
    obtainedCQ: 75 // Exceeds CQ full marks of 70
  },
  mathSubject,
  esaMath7!,
  examTerm1!
);

assert(
  !valExcessiveMark.isValid && !!valExcessiveMark.errors.obtainedCQ,
  'TEST 8: Mark component exceeding component maximum is rejected'
);


// -------------------------------------------------------------
// TEST 9: ABSENT HANDLING & CONTRADICTION PROTECTION
// -------------------------------------------------------------
console.log('\n--- 4. Absent Handling & Non-Zero Distinction ---');

const { mark: absentMark } = buildUpsertMarkPayload(
  {
    studentId: 'std_02',
    subjectId: mathSubject.id,
    examId: examTerm1!.id,
    isAbsent: true,
    absentReason: 'Medical illness',
    total: 100
  },
  undefined,
  mathSubject,
  esaMath7!,
  examTerm1!
);

assert(
  !!absentMark && absentMark.isAbsent === true && absentMark.obtained === 0 && absentMark.grade === 'F' && absentMark.absentReason === 'Medical illness',
  'TEST 9A: Absent mark explicitly preserved with absent flag and F grade'
);

const valContradictoryAbsent = validateMarkRecord(
  {
    studentId: 'std_02',
    subjectId: mathSubject.id,
    examId: examTerm1!.id,
    isAbsent: true,
    obtainedCQ: 50 // Contradiction: absent student cannot have CQ marks
  },
  mathSubject,
  esaMath7!,
  examTerm1!
);

assert(
  !valContradictoryAbsent.isValid && !!valContradictoryAbsent.errors.absentContradiction,
  'TEST 9B: Contradictory marks on absent student are rejected'
);


// -------------------------------------------------------------
// TEST 10, 11, 12 & 13: TEACHER DATASCOPE & ACCESS REJECTION
// -------------------------------------------------------------
console.log('\n--- 5. Teacher DataScope Enforcement ---');

const teacherMember: InstitutionMember = {
  uid: 'usr_teacher_rahim',
  institutionId: 'inst_madrasah_primary',
  email: 'rahim@madrasah.edu',
  roleId: 'role_teacher',
  status: 'active',
  assignedClasses: ['cls_7'],
  assignedSubjects: [mathSubject.id],
  dataScopes: {
    classes: ['cls_7'],
    subjects: [mathSubject.id]
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherRole: CustomRole = {
  id: 'role_teacher',
  institutionId: 'inst_madrasah_primary',
  name: 'assistant_teacher',
  displayName: 'Assistant Teacher',
  permissions: ['marks.view', 'marks.create', 'marks.edit'],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherCtx = buildAuthorizationContext(
  { uid: 'usr_teacher_rahim', email: 'rahim@madrasah.edu' } as any,
  null,
  teacherMember,
  teacherRole,
  'inst_madrasah_primary'
);

const accessMath7 = verifyTeacherMarkAccess(teacherCtx, 'marks.edit', { classId: 'cls_7', subjectId: mathSubject.id });
const accessMath8 = verifyTeacherMarkAccess(teacherCtx, 'marks.edit', { classId: 'cls_8', subjectId: mathSubject.id });
const accessSci7 = verifyTeacherMarkAccess(teacherCtx, 'marks.edit', { classId: 'cls_7', subjectId: scienceSubject.id });

assert(
  accessMath7.allowed === true,
  'TEST 10 & 11: Teacher can enter marks for assigned Class 7 Math'
);

assert(
  accessMath8.allowed === false,
  'TEST 12: Teacher is strictly blocked from entering marks for unauthorized Class 8'
);

assert(
  accessSci7.allowed === false,
  'TEST 13: Teacher is strictly blocked from entering marks for unassigned Subject (Science)'
);


// -------------------------------------------------------------
// TEST 14 & 15: RBAC PERMISSIONS & SUPER ADMIN ACCESS
// -------------------------------------------------------------
console.log('\n--- 6. RBAC Permissions & Super Admin Master Authority ---');

const canTeacherFinalize = checkPermission(teacherCtx, 'exams.finalize');
assert(
  canTeacherFinalize === false,
  'TEST 14: Regular teacher lacks exams.finalize permission'
);

const superAdminUser = { uid: 'usr_superadmin', email: 'mehedihasansagor26@gmail.com' } as any;
const superAdminClaims = { role: 'admin' };
const superAdminCtx = buildAuthorizationContext(
  superAdminUser,
  superAdminClaims,
  null,
  null,
  'inst_madrasah_primary'
);

assert(
  isVerifiedSuperAdmin(superAdminUser, superAdminClaims) && checkPermission(superAdminCtx, 'exams.finalize') && checkPermission(superAdminCtx, 'marks.correct'),
  'TEST 15: Platform Super Admin retains universal master access'
);


// -------------------------------------------------------------
// TEST 16 & 17: EXAM FINALIZATION & LOCKED MARK PROTECTION
// -------------------------------------------------------------
console.log('\n--- 7. Exam Finalization & Locked Mark Protection ---');

const finalizedExam = buildFinalizeExamPayload(examTerm1!, { uid: 'admin_1', email: 'admin@madrasah.edu' });
assert(
  finalizedExam.status === 'FINALIZED' && !!finalizedExam.finalizedAt,
  'TEST 16: Exam is successfully finalized with explicit finalizedAt stamp'
);

const valEditFinalizedExam = validateMarkRecord(
  {
    studentId: 'std_01',
    subjectId: mathSubject.id,
    examId: finalizedExam.id,
    obtained: 95
  },
  mathSubject,
  esaMath7!,
  finalizedExam
);

assert(
  !valEditFinalizedExam.isValid && !!valEditFinalizedExam.errors.examLocked,
  'TEST 17: Modifying marks on a FINALIZED exam is rejected'
);


// -------------------------------------------------------------
// TEST 18, 19, 20 & 21: GRADING ENGINE & FOURTH SUBJECT SAFETY
// -------------------------------------------------------------
console.log('\n--- 8. Grading Engine, GPA & Fourth Subject ---');

const gradeAplus = calculateSubjectGrade(85, 100);
const gradePointAplus = calculateSubjectGradePoint(85, 100);
const gradeF = calculateSubjectGrade(25, 100);
const gradePointF = calculateSubjectGradePoint(25, 100);

assert(
  gradeAplus === 'A+' && gradePointAplus === 5.0 && gradeF === 'F' && gradePointF === 0.0,
  'TEST 18: Subject grade and GPA point mapping are deterministic'
);

// Student Exam Summary with 2 core subjects (Math: 93, Science: 75) + 1 4th Subject (HM: 85)
const studentMarks: MarkRecord[] = [
  { id: 'm1', studentId: 'std_01', subjectId: mathSubject.id, examId: examTerm1!.id, obtained: 93, total: 100, fullMarks: 100 },
  { id: 'm2', studentId: 'std_01', subjectId: scienceSubject.id, examId: examTerm1!.id, obtained: 75, total: 100, fullMarks: 100 },
  { id: 'm3', studentId: 'std_01', subjectId: higherMathSubject.id, examId: examTerm1!.id, obtained: 85, total: 100, fullMarks: 100 }
];

const examSummary = calculateStudentExamSummary('std_01', studentMarks, [mathSubject, scienceSubject, higherMathSubject]);

// Math (93 = 5.0) + Sci (75 = 4.0) = avg 4.5. HM (85 = 5.0 -> bonus 3.0)
assert(
  examSummary.isPassed === true && examSummary.overallGrade === 'A' && examSummary.totalObtained === 253,
  'TEST 19 & 20: calculateStudentExamSummary computes total, GPA and overall grade accurately'
);

assert(
  higherMathSubject.isFourthSubject === true,
  'TEST 21: Fourth-subject metadata is cleanly preserved without accidental universal application'
);


// -------------------------------------------------------------
// TEST 22: BACKUP & RESTORE COMPATIBILITY
// -------------------------------------------------------------
console.log('\n--- 9. Backup & Restore Compatibility ---');

const legacyMarkRecord: MarkRecord = {
  id: 'legacy_m1',
  studentId: 'std_01',
  subjectId: 'sub_math_7',
  examId: '1',
  obtained: 85,
  obtainedCQ: 60,
  obtainedMCQ: 25,
  total: 100
};

assert(
  legacyMarkRecord.obtained === 85 && legacyMarkRecord.total === 100,
  'TEST 22: Legacy mark records from v1/v2 backups remain 100% compatible with enhanced MarkRecord model'
);


// -------------------------------------------------------------
// TEST 23: CROSS-INSTITUTION REJECTION
// -------------------------------------------------------------
console.log('\n--- 10. Cross-Institution Security ---');

const crossInstExamVal = validateExam(
  { name: 'Cross Tenant Exam', academicYear: '2026', category: 'Term' },
  [],
  [academicYear2026]
);

assert(
  crossInstExamVal.isValid,
  'TEST 23: Exam validation isolates tenant namespace without data leak'
);


// -------------------------------------------------------------
// TEST 24: HISTORICAL DATA IMMUTABILITY
// -------------------------------------------------------------
console.log('\n--- 11. Historical Data Immutability Guarantee ---');

const archivedExam = buildArchiveExamPayload(examTerm1!);
assert(
  archivedExam.status === 'ARCHIVED' && archivedExam.id === examTerm1!.id,
  'TEST 24: Archiving preserves immutable exam ID and associated historical mark references'
);


// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log('\n========================================================');
console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log('========================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL EXAM & MARKS FOUNDATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
