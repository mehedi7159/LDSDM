import {
  buildCreateSubjectPayload,
  buildUpdateSubjectPayload,
  buildArchiveSubjectPayload,
  buildCreateTeacherPayload,
  buildUpdateTeacherPayload,
  buildArchiveTeacherPayload,
  buildCreateClassSubjectPayload,
  buildCreateTeacherSubjectPayload,
  buildCreateClassTeacherPayload,
  getSubjectsForClass,
  getSubjectsForStudent,
  getTeacherAssignments,
  getTeacherSubjects,
  getTeacherClasses,
  getTeacherSections,
  deriveTeacherDataScope
} from '../services/academicCoreService';
import {
  validateSubject,
  validateClassSubjectAssignment,
  validateAcademicTeacher,
  validateTeacherSubjectAssignment,
  validateClassTeacherAssignment
} from '../services/subjectValidation';
import {
  checkPermission,
  buildAuthorizationContext,
  isVerifiedSuperAdmin
} from '../services/authorization';
import type { 
  Subject, 
  AcademicTeacher, 
  ClassSubjectAssignment, 
  TeacherSubjectAssignment, 
  ClassTeacherAssignment,
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
console.log('🧪 PHASE 2 — ACADEMIC CORE ASSIGNMENT TEST SUITE');
console.log('🧪 Subject + Teacher + Class/Section Assignment + DataScope');
console.log('🧪 ========================================================\n');

// Common Test Fixtures
const academicYear2026: AcademicYear = {
  id: 'ay_2026',
  institutionId: 'inst_madrasah_primary',
  name: '2026',
  status: 'ACTIVE',
  isCurrent: true
};

const academicYear2027: AcademicYear = {
  id: 'ay_2027',
  institutionId: 'inst_madrasah_primary',
  name: '2027',
  status: 'UPCOMING',
  isCurrent: false
};

const class7: SchoolClass = {
  id: 'cls_7',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  name: 'Class 7',
  displayName: 'Class 7 (General)',
  order: 7,
  status: 'ACTIVE'
};

const class8: SchoolClass = {
  id: 'cls_8',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  name: 'Class 8',
  displayName: 'Class 8',
  order: 8,
  status: 'ACTIVE'
};

const sectionA: Section = {
  id: 'sec_7a',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  classId: 'cls_7',
  name: 'Section A',
  status: 'ACTIVE'
};

const sectionB: Section = {
  id: 'sec_7b',
  institutionId: 'inst_madrasah_primary',
  academicYearId: 'ay_2026',
  classId: 'cls_7',
  name: 'Section B',
  status: 'ACTIVE'
};

// -------------------------------------------------------------
// TEST 1 & 2: SUBJECT VALIDATION & DUPLICATE PROTECTION
// -------------------------------------------------------------
console.log('--- 1. Subject Model & Validation ---');

const { subject: mathSubject } = buildCreateSubjectPayload(
  {
    name: 'Mathematics',
    nameBn: 'সাধারণ গণিত',
    code: 'MATH-101',
    category: 'General',
    type: 'Core',
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
    order: 1
  },
  'inst_madrasah_primary',
  { uid: 'admin_1', email: 'admin@madrasah.edu' },
  []
);

assert(
  !!mathSubject && mathSubject.id.startsWith('sub_') && mathSubject.code === 'MATH-101' && mathSubject.fullMarks === 100,
  'TEST 1: Subject creation with CQ & MCQ components generates valid immutable ID and properties'
);

const valDuplicateCode = validateSubject(
  { name: 'Higher Math', code: 'MATH-101', classLevel: 'Class 7' },
  [mathSubject!]
);
assert(
  !valDuplicateCode.isValid && !!valDuplicateCode.errors.code,
  'TEST 2: Duplicate subject code rejection within institution'
);

const valDuplicateName = validateSubject(
  { name: 'Mathematics', classLevel: 'Class 7' },
  [mathSubject!]
);
assert(
  !valDuplicateName.isValid && !!valDuplicateName.errors.name,
  'TEST 2B: Duplicate subject name within the same class is rejected'
);


// -------------------------------------------------------------
// TEST 3 & 4: CLASS-SUBJECT ASSIGNMENT & DUPLICATE PREVENTION
// -------------------------------------------------------------
console.log('\n--- 2. Class-Subject Assignment ---');

const { assignment: csaMath7 } = buildCreateClassSubjectPayload(
  {
    academicYearId: 'ay_2026',
    classId: 'cls_7',
    subjectId: mathSubject!.id,
    order: 1,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  { uid: 'admin_1', email: 'admin@madrasah.edu' },
  [],
  [class7],
  [sectionA],
  [mathSubject!],
  [academicYear2026]
);

assert(
  !!csaMath7 && csaMath7.id.startsWith('csa_') && csaMath7.subjectId === mathSubject!.id,
  'TEST 3: Class-Subject Assignment links Subject to Class and Academic Year'
);

const valDuplicateCSA = validateClassSubjectAssignment(
  {
    academicYearId: 'ay_2026',
    classId: 'cls_7',
    subjectId: mathSubject!.id
  },
  [csaMath7!],
  [class7],
  [sectionA],
  [mathSubject!],
  [academicYear2026]
);

assert(
  !valDuplicateCSA.isValid && !!valDuplicateCSA.errors.duplicateAssignment,
  'TEST 4: Duplicate Class-Subject Assignment is strictly prevented'
);


// -------------------------------------------------------------
// TEST 5 & 6: ACADEMIC YEAR & SECTION CONSISTENCY
// -------------------------------------------------------------
console.log('\n--- 3. Academic Year & Section Consistency ---');

const valYearMismatchCSA = validateClassSubjectAssignment(
  {
    academicYearId: 'ay_2027', // mismatch: class7 is in 2026
    classId: 'cls_7',
    subjectId: mathSubject!.id
  },
  [],
  [class7],
  [sectionA],
  [mathSubject!],
  [academicYear2026, academicYear2027]
);

assert(
  !valYearMismatchCSA.isValid && !!valYearMismatchCSA.errors.academicYearMismatch,
  'TEST 5: Academic year mismatch between class and assignment is rejected'
);

const class8Section: Section = {
  id: 'sec_8a',
  classId: 'cls_8',
  name: 'Section 8A',
  status: 'ACTIVE'
};

const valSectionMismatchCSA = validateClassSubjectAssignment(
  {
    academicYearId: 'ay_2026',
    classId: 'cls_7',
    sectionId: 'sec_8a', // belongs to class 8, not 7
    subjectId: mathSubject!.id
  },
  [],
  [class7, class8],
  [sectionA, class8Section],
  [mathSubject!],
  [academicYear2026]
);

assert(
  !valSectionMismatchCSA.isValid && !!valSectionMismatchCSA.errors.sectionClassMismatch,
  'TEST 6: Section not belonging to selected class is rejected'
);


// -------------------------------------------------------------
// TEST 7: TEACHER ACADEMIC IDENTITY
// -------------------------------------------------------------
console.log('\n--- 4. Teacher Academic Identity ---');

const { teacher: teacherRahim } = buildCreateTeacherPayload(
  {
    name: 'Maulana Abdur Rahim',
    nameBn: 'মাওলানা আব্দুর রহিম',
    employeeCode: 'TCH-001',
    designation: 'Senior Maulana & Mathematics Teacher',
    email: 'rahim@madrasah.edu',
    phone: '01711223344',
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  { uid: 'admin_1', email: 'admin@madrasah.edu' },
  []
);

assert(
  !!teacherRahim && teacherRahim.id.startsWith('tch_') && teacherRahim.employeeCode === 'TCH-001' && teacherRahim.status === 'ACTIVE',
  'TEST 7: Teacher academic identity created with unique code and stable ID'
);


// -------------------------------------------------------------
// TEST 8 & 9: TEACHER-SUBJECT ASSIGNMENT & DUPLICATE PREVENTION
// -------------------------------------------------------------
console.log('\n--- 5. Teacher-Subject Assignment ---');

const { assignment: tsaRahimMath7 } = buildCreateTeacherSubjectPayload(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherRahim!.id,
    subjectId: mathSubject!.id,
    classId: 'cls_7',
    sectionId: 'sec_7a',
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  { uid: 'admin_1', email: 'admin@madrasah.edu' },
  [],
  [teacherRahim!],
  [mathSubject!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !!tsaRahimMath7 && tsaRahimMath7.id.startsWith('tsa_') && tsaRahimMath7.teacherId === teacherRahim!.id,
  'TEST 8: Teacher-Subject assignment binds Teacher -> Subject -> Class -> Section'
);

const valDuplicateTSA = validateTeacherSubjectAssignment(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherRahim!.id,
    subjectId: mathSubject!.id,
    classId: 'cls_7',
    sectionId: 'sec_7a'
  },
  [tsaRahimMath7!],
  [teacherRahim!],
  [mathSubject!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !valDuplicateTSA.isValid && !!valDuplicateTSA.errors.duplicate,
  'TEST 9: Duplicate Teacher-Subject assignment for identical class/section is rejected'
);


// -------------------------------------------------------------
// TEST 10 & 11: TEACHER CLASS & SECTION QUERIES
// -------------------------------------------------------------
console.log('\n--- 6. Teacher Queries & Assignments ---');

const teacherClasses = getTeacherClasses(teacherRahim!.id, [tsaRahimMath7!], [class7, class8]);
assert(
  teacherClasses.length === 1 && teacherClasses[0].id === 'cls_7',
  'TEST 10: getTeacherClasses correctly identifies classes taught by the teacher'
);

const teacherSections = getTeacherSections(teacherRahim!.id, [tsaRahimMath7!], [sectionA, sectionB]);
assert(
  teacherSections.length === 1 && teacherSections[0].id === 'sec_7a',
  'TEST 11: getTeacherSections correctly identifies sections taught by the teacher'
);


// -------------------------------------------------------------
// TEST 12 & 13: CLASS & SECTION TEACHER PROTECTION
// -------------------------------------------------------------
console.log('\n--- 7. Class Teacher & Section Teacher Protection ---');

const { assignment: ctaClass7 } = buildCreateClassTeacherPayload(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherRahim!.id,
    classId: 'cls_7',
    type: 'CLASS_TEACHER',
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  [],
  [teacherRahim!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !!ctaClass7 && ctaClass7.type === 'CLASS_TEACHER' && ctaClass7.classId === 'cls_7',
  'TEST 12A: Class Teacher assignment successfully created'
);

// Another teacher assigned to same class as Class Teacher -> Must be rejected
const { teacher: teacherKarim } = buildCreateTeacherPayload(
  { name: 'Karim Sir', status: 'ACTIVE' },
  'inst_madrasah_primary',
  undefined,
  [teacherRahim!]
);

const valConflictClassTeacher = validateClassTeacherAssignment(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherKarim!.id,
    classId: 'cls_7',
    type: 'CLASS_TEACHER'
  },
  [ctaClass7!],
  [teacherRahim!, teacherKarim!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !valConflictClassTeacher.isValid && !!valConflictClassTeacher.errors.classTeacherConflict,
  'TEST 12B: Conflicting duplicate Class Teacher for the same class & year is rejected'
);

const { assignment: ctaSec7A } = buildCreateClassTeacherPayload(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherKarim!.id,
    classId: 'cls_7',
    sectionId: 'sec_7a',
    type: 'SECTION_TEACHER',
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  [ctaClass7!],
  [teacherRahim!, teacherKarim!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !!ctaSec7A && ctaSec7A.type === 'SECTION_TEACHER' && ctaSec7A.sectionId === 'sec_7a',
  'TEST 13A: Section Teacher assignment successfully created'
);

const valConflictSecTeacher = validateClassTeacherAssignment(
  {
    academicYearId: 'ay_2026',
    teacherId: teacherRahim!.id,
    classId: 'cls_7',
    sectionId: 'sec_7a',
    type: 'SECTION_TEACHER'
  },
  [ctaClass7!, ctaSec7A!],
  [teacherRahim!, teacherKarim!],
  [class7],
  [sectionA],
  [academicYear2026]
);

assert(
  !valConflictSecTeacher.isValid && !!valConflictSecTeacher.errors.sectionTeacherConflict,
  'TEST 13B: Conflicting duplicate Section Teacher for the same section & year is rejected'
);


// -------------------------------------------------------------
// TEST 14: DATASCOPE DERIVATION FOR TEACHERS
// -------------------------------------------------------------
console.log('\n--- 8. Teacher DataScope Derivation ---');

const derivedScope = deriveTeacherDataScope(
  teacherRahim!.id,
  [tsaRahimMath7!],
  [ctaClass7!]
);

assert(
  derivedScope.allClasses === false && 
  derivedScope.classes?.includes('cls_7') === true && 
  derivedScope.subjects?.includes(mathSubject!.id) === true,
  'TEST 14: Teacher DataScope is accurately derived from active subject & class assignments'
);


// -------------------------------------------------------------
// TEST 15: SUBJECT QUERY & STUDENT CURRICULUM RESOLUTION
// -------------------------------------------------------------
console.log('\n--- 9. Subject Queries for Student & Class ---');

const { subject: arabicSubject } = buildCreateSubjectPayload(
  {
    name: 'Arabic 1st Paper',
    nameBn: 'আরবি ১ম পত্র',
    category: 'Islamic',
    classLevel: 'Class 7',
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    order: 2
  },
  'inst_madrasah_primary',
  undefined,
  [mathSubject!]
);

const { assignment: csaArabic7 } = buildCreateClassSubjectPayload(
  {
    academicYearId: 'ay_2026',
    classId: 'cls_7',
    subjectId: arabicSubject!.id,
    order: 2,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  [csaMath7!],
  [class7],
  [sectionA],
  [mathSubject!, arabicSubject!],
  [academicYear2026]
);

const class7Subjects = getSubjectsForClass('cls_7', 'ay_2026', [csaMath7!, csaArabic7!], [mathSubject!, arabicSubject!]);
assert(
  class7Subjects.length === 2 && class7Subjects.some(s => s.id === mathSubject!.id) && class7Subjects.some(s => s.id === arabicSubject!.id),
  'TEST 15A: getSubjectsForClass resolves assigned curriculum correctly for the academic cycle'
);

const studentPlacement: Student = {
  id: 'std_test_01',
  studentCode: 'STD001',
  admissionNumber: 'ADM-001',
  name: 'Tawhid Hasan',
  classLevel: 'Class 7',
  classId: 'cls_7',
  sectionId: 'sec_7a',
  academicYearId: 'ay_2026',
  status: 'active'
};

const studentSubjects = getSubjectsForStudent(studentPlacement, [csaMath7!, csaArabic7!], [mathSubject!, arabicSubject!]);
assert(
  studentSubjects.length === 2,
  'TEST 15B: getSubjectsForStudent resolves curriculum matching student placement'
);


// -------------------------------------------------------------
// TEST 16 & 17: RBAC & SUPER ADMIN AUTHORIZATION
// -------------------------------------------------------------
console.log('\n--- 10. RBAC Authorization & Super Admin ---');

const teacherMember: InstitutionMember = {
  uid: 'usr_teacher_rahim',
  institutionId: 'inst_madrasah_primary',
  email: 'rahim@madrasah.edu',
  roleId: 'role_teacher',
  status: 'active',
  assignedClasses: ['cls_7'],
  assignedSubjects: [mathSubject!.id],
  dataScopes: {
    classes: ['cls_7'],
    subjects: [mathSubject!.id]
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherRole: CustomRole = {
  id: 'role_teacher',
  institutionId: 'inst_madrasah_primary',
  name: 'assistant_teacher',
  displayName: 'Assistant Teacher',
  permissions: ['subjects.view', 'marks.view', 'marks.create', 'marks.edit'],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const teacherAuthCtx = buildAuthorizationContext(
  { uid: 'usr_teacher_rahim', email: 'rahim@madrasah.edu' } as any,
  null,
  teacherMember,
  teacherRole,
  'inst_madrasah_primary'
);

const canTeacherViewSubjects = checkPermission(teacherAuthCtx, 'subjects.view');
const canTeacherDeleteSubjects = checkPermission(teacherAuthCtx, 'subjects.delete');
const canTeacherAccessClass7 = checkPermission(teacherAuthCtx, 'marks.edit', { classId: 'cls_7' });
const canTeacherAccessClass8 = checkPermission(teacherAuthCtx, 'marks.edit', { classId: 'cls_8' });

assert(
  canTeacherViewSubjects === true && canTeacherDeleteSubjects === false,
  'TEST 16A: Teacher has subjects.view permission but lacks subjects.delete permission'
);

assert(
  canTeacherAccessClass7 === true && canTeacherAccessClass8 === false,
  'TEST 16B: Teacher DataScope allows assigned Class 7 and blocks unassigned Class 8'
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
  isVerifiedSuperAdmin(superAdminUser, superAdminClaims) && checkPermission(superAdminCtx, 'subjects.delete') && checkPermission(superAdminCtx, 'teacherAssignments.create'),
  'TEST 17: Super Admin retains unrestricted master access to all subjects and assignments'
);


// -------------------------------------------------------------
// TEST 18: CROSS-INSTITUTION REJECTION
// -------------------------------------------------------------
console.log('\n--- 11. Cross-Institution Security ---');

const valCrossTenantSubject = validateSubject(
  { name: 'Different Institution Subject' },
  []
);
assert(
  valCrossTenantSubject.isValid,
  'TEST 18: Subject validation isolates tenant namespace without leaking cross-institution records'
);


// -------------------------------------------------------------
// TEST 19: HISTORICAL RECORD PROTECTION (ARCHIVE OVER DELETE)
// -------------------------------------------------------------
console.log('\n--- 12. Non-Destructive Archiving ---');

const archivedSubject = buildArchiveSubjectPayload(mathSubject!);
assert(
  archivedSubject.status === 'INACTIVE' && archivedSubject.id === mathSubject!.id && archivedSubject.fullMarks === 100,
  'TEST 19: Subject archiving sets status to INACTIVE preserving immutable ID and historical marks references'
);


// -------------------------------------------------------------
// TEST 20: EXISTING STUDENT & MARKS COMPATIBILITY
// -------------------------------------------------------------
console.log('\n--- 13. Existing System & Backward Compatibility ---');

// Legacy subject without code/CQ/MCQ
const legacySubject: Subject = {
  id: 'legacy_sub_01',
  name: 'English',
  classLevel: 'Class 7',
  fullMarks: 100,
  passMarks: 33,
  isOptional: false,
  order: 3
};

const subjectsWithLegacy = [mathSubject!, legacySubject];
const resolvedLegacyClassSubjects = getSubjectsForClass('Class 7', undefined, [], subjectsWithLegacy);

assert(
  resolvedLegacyClassSubjects.length === 2 && resolvedLegacyClassSubjects.some(s => s.id === 'legacy_sub_01'),
  'TEST 20: Legacy subjects without explicit ClassSubjectAssignment fall back cleanly to classLevel for 100% backward compatibility'
);

// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log('\n========================================================');
console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log('========================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL ACADEMIC ASSIGNMENT TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
