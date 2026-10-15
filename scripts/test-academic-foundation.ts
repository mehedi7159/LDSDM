import { 
  buildCreateAcademicYearPayload,
  buildUpdateAcademicYearPayload,
  setCurrentAcademicYear,
  closeAcademicYear,
  generateAcademicYearId
} from '../services/academicYearService';
import {
  buildCreateClassPayload,
  buildUpdateClassPayload,
  buildArchiveClassPayload,
  checkClassDependencies,
  generateClassId
} from '../services/classService';
import {
  buildCreateSectionPayload,
  buildUpdateSectionPayload,
  buildArchiveSectionPayload,
  checkSectionDependencies,
  generateSectionId
} from '../services/sectionService';
import {
  validateAcademicYear,
  validateClassConfig,
  validateSectionConfig,
  validateStudentAcademicPlacement
} from '../services/academicValidation';
import type { AcademicYear, Section, SchoolClass, Subject } from '../types';
import type { Student } from '../types/student';

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
console.log('🧪 PHASE 1 — PRODUCTION ACADEMIC FOUNDATION TEST SUITE');
console.log('🧪 Academic Year + Class + Section + Student Placement');
console.log('🧪 ========================================================\n');

// -------------------------------------------------------------
// TEST SUITE 1: ACADEMIC YEAR MODEL & LIFECYCLE
// -------------------------------------------------------------
console.log('--- 1. Academic Year Model & Validation ---');

// 1.1 Creation with stable ID
const { academicYear: year2026 } = buildCreateAcademicYearPayload(
  {
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    isCurrent: true
  },
  'inst_madrasah_primary',
  { uid: 'admin_123', email: 'admin@school.edu' },
  []
);

assert(
  !!year2026 && !!year2026.id && year2026.name === '2026' && year2026.isCurrent === true && year2026.status === 'ACTIVE',
  '1.1 Academic year creation produces valid stable ID and active status'
);

// 1.2 Duplicate academic year name rejection
const valDuplicateYear = validateAcademicYear(
  { name: '2026' },
  [year2026!]
);
assert(
  !valDuplicateYear.isValid && !!valDuplicateYear.errors.name,
  '1.2 Duplicate academic year name is rejected'
);

// 1.3 Invalid date range rejection
const valInvalidDates = validateAcademicYear(
  { name: '2027', startDate: '2027-12-31', endDate: '2027-01-01' },
  [year2026!]
);
assert(
  !valInvalidDates.isValid && !!valInvalidDates.errors.dateRange,
  '1.3 Academic year with startDate > endDate is rejected'
);

// 1.4 Single Current Academic Year Guarantee
const { academicYear: year2027 } = buildCreateAcademicYearPayload(
  { name: '2027', status: 'UPCOMING', isCurrent: false },
  'inst_madrasah_primary',
  undefined,
  [year2026!]
);

const yearList = [year2026!, year2027!];
const { updatedYears, targetYear } = setCurrentAcademicYear(yearList, year2027!.id);
const activeYearsCount = updatedYears.filter(y => y.isCurrent).length;

assert(
  activeYearsCount === 1 && targetYear?.id === year2027!.id && updatedYears.find(y => y.id === year2026!.id)?.isCurrent === false,
  '1.4 Setting new current academic year deactivates other years (Single Active Guarantee)'
);

// 1.5 Safe Closing (Non-destructive)
const closed2026 = closeAcademicYear(year2026!);
assert(
  closed2026.status === 'CLOSED' && closed2026.isCurrent === false && closed2026.id === year2026!.id,
  '1.5 Closing academic year changes status to CLOSED without destroying historical ID'
);


// -------------------------------------------------------------
// TEST SUITE 2: CLASS MODEL & LIFECYCLE
// -------------------------------------------------------------
console.log('\n--- 2. Class Model & Validation ---');

// 2.1 Class creation for School
const { schoolClass: class7 } = buildCreateClassPayload(
  {
    name: 'Class 7',
    nameBn: 'সপ্তম শ্রেণী',
    displayName: 'Class 7 (General)',
    order: 7,
    academicYearId: year2026!.id,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  { uid: 'admin_123', email: 'admin@school.edu' },
  []
);

assert(
  !!class7 && !!class7.id && class7.name === 'Class 7' && class7.order === 7 && class7.status === 'ACTIVE',
  '2.1 Standard school class is created with immutable ID and order'
);

// 2.2 Class creation for Madrasah (Dakhil / Alim / Hifz)
const { schoolClass: dakhil9 } = buildCreateClassPayload(
  {
    name: 'Dakhil 9',
    nameBn: 'দাখিল ৯ম',
    order: 9,
    academicYearId: year2026!.id,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  [class7!]
);

assert(
  !!dakhil9 && dakhil9.name === 'Dakhil 9' && dakhil9.order === 9,
  '2.2 Madrasah class (Dakhil 9) created seamlessly under generic class model'
);

// 2.3 Duplicate class rejection within same academic year
const valDuplicateClass = validateClassConfig(
  { name: 'Class 7', academicYearId: year2026!.id },
  [class7!]
);
assert(
  !valDuplicateClass.isValid && !!valDuplicateClass.errors.name,
  '2.3 Duplicate class name in the same academic year is rejected'
);

// 2.4 Same class name permitted across different academic years
const valSameClassDifferentYear = validateClassConfig(
  { name: 'Class 7', academicYearId: year2027!.id },
  [class7!]
);
assert(
  valSameClassDifferentYear.isValid,
  '2.4 Same class name is allowed in different academic years (e.g. Class 7 in 2026 vs 2027)'
);

// 2.5 Safe Archiving of Class
const archivedClass7 = buildArchiveClassPayload(class7!);
assert(
  archivedClass7.status === 'INACTIVE' && archivedClass7.id === class7!.id,
  '2.5 Class archiving sets status to INACTIVE without hard-deleting the record'
);

// 2.6 Class Dependency Inspection
const sampleStudents: Student[] = [
  {
    id: 'std_001',
    studentCode: 'STD001',
    admissionNumber: 'ADM-2026-01',
    name: 'Rahim Uddin',
    classLevel: class7!.id,
    classId: class7!.id,
    academicYearId: year2026!.id,
    status: 'active'
  }
];
const sampleSubjects: Subject[] = [
  {
    id: 'sub_001',
    name: 'Mathematics',
    classLevel: class7!.id,
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    order: 1
  }
];

const depCheckClass = checkClassDependencies(class7!.id, sampleStudents, sampleSubjects, []);
assert(
  depCheckClass.hasDependencies === true && depCheckClass.studentCount === 1 && depCheckClass.subjectCount === 1,
  '2.6 Class dependency detector correctly detects enrolled students and assigned subjects'
);


// -------------------------------------------------------------
// TEST SUITE 3: SECTION MODEL & LIFECYCLE
// -------------------------------------------------------------
console.log('\n--- 3. Section Model & Validation ---');

// 3.1 Section creation
const { section: sectionA } = buildCreateSectionPayload(
  {
    name: 'Section A',
    classId: class7!.id,
    academicYearId: year2026!.id,
    capacity: 40,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  { uid: 'admin_123', email: 'admin@school.edu' },
  [],
  [class7!]
);

assert(
  !!sectionA && !!sectionA.id && sectionA.name === 'Section A' && sectionA.classId === class7!.id && sectionA.capacity === 40,
  '3.1 Section creation binds correctly to parent class and academic year'
);

// 3.2 Duplicate section rejection in same class & year
const valDuplicateSection = validateSectionConfig(
  { name: 'Section A', classId: class7!.id, academicYearId: year2026!.id },
  [sectionA!],
  [class7!]
);
assert(
  !valDuplicateSection.isValid && !!valDuplicateSection.errors.name,
  '3.2 Duplicate section name within the same class & academic year is rejected'
);

// 3.3 Reject section on non-existent or inactive class
const valSectionInactiveClass = validateSectionConfig(
  { name: 'Section B', classId: archivedClass7.id },
  [sectionA!],
  [archivedClass7]
);
assert(
  !valSectionInactiveClass.isValid && !!valSectionInactiveClass.errors.classId,
  '3.3 Creating a section on an INACTIVE class is rejected'
);

// 3.4 Section dependency inspection
const sampleStudentsWithSection: Student[] = [
  {
    id: 'std_001',
    studentCode: 'STD001',
    admissionNumber: 'ADM-2026-01',
    name: 'Rahim Uddin',
    classLevel: class7!.id,
    classId: class7!.id,
    sectionId: sectionA!.id,
    academicYearId: year2026!.id,
    status: 'active'
  }
];
const depCheckSection = checkSectionDependencies(sectionA!.id, sampleStudentsWithSection);
assert(
  depCheckSection.hasDependencies === true && depCheckSection.studentCount === 1,
  '3.4 Section dependency detector correctly reports enrolled students'
);


// -------------------------------------------------------------
// TEST SUITE 4: STUDENT ACADEMIC PLACEMENT
// -------------------------------------------------------------
console.log('\n--- 4. Student Academic Placement Validation ---');

const allClasses = [class7!, dakhil9!];
const allSections = [sectionA!];
const allYears = [year2026!, year2027!];

// 4.1 Valid placement
const validPlacement = validateStudentAcademicPlacement(
  {
    studentId: 'std_001',
    classId: class7!.id,
    sectionId: sectionA!.id,
    academicYearId: year2026!.id
  },
  allClasses,
  allSections,
  allYears
);
assert(
  validPlacement.isValid,
  '4.1 Valid student placement (matching class, section, and academic year) succeeds'
);

// 4.2 Cross-year placement mismatch rejection
const mismatchClassYearPlacement = validateStudentAcademicPlacement(
  {
    studentId: 'std_001',
    classId: class7!.id, // belongs to 2026
    academicYearId: year2027!.id // mismatching 2027
  },
  allClasses,
  allSections,
  allYears
);
assert(
  !mismatchClassYearPlacement.isValid && !!mismatchClassYearPlacement.errors.classYearMismatch,
  '4.2 Cross-year placement mismatch (class from 2026 placed into 2027) is rejected'
);

// 4.3 Section class mismatch rejection
const { section: sectionDakhilA } = buildCreateSectionPayload(
  {
    name: 'Section Alpha',
    classId: dakhil9!.id,
    academicYearId: year2026!.id,
    status: 'ACTIVE'
  },
  'inst_madrasah_primary',
  undefined,
  allSections,
  allClasses
);

const mismatchSectionClassPlacement = validateStudentAcademicPlacement(
  {
    studentId: 'std_001',
    classId: class7!.id,
    sectionId: sectionDakhilA!.id, // belongs to Dakhil 9, not Class 7
    academicYearId: year2026!.id
  },
  allClasses,
  [sectionA!, sectionDakhilA!],
  allYears
);
assert(
  !mismatchSectionClassPlacement.isValid && !!mismatchSectionClassPlacement.errors.sectionClassMismatch,
  '4.3 Section class mismatch (assigning a Dakhil 9 section to Class 7 student) is rejected'
);

// 4.4 Inactive class placement rejection
const placementInactiveClass = validateStudentAcademicPlacement(
  {
    studentId: 'std_001',
    classId: archivedClass7.id,
    academicYearId: year2026!.id
  },
  [archivedClass7],
  allSections,
  allYears
);
assert(
  !placementInactiveClass.isValid && !!placementInactiveClass.errors.classId,
  '4.4 Placing a student into an INACTIVE class is rejected'
);


// -------------------------------------------------------------
// TEST SUITE 5: MADRASAH & SCHOOL TERMINOLOGY FLEXIBILITY
// -------------------------------------------------------------
console.log('\n--- 5. School + Madrasah Compatibility ---');

const mixedInstitutionClasses = [
  'Play', 'Nursery', 'KG', 'Class 1', 'Class 5', 'Class 10',
  'Hifz 1st Year', 'Hifz 2nd Year', 'Dakhil 9', 'Dakhil 10', 'Alim 1st Year', 'Fazil'
];

let allMixedValid = true;
mixedInstitutionClasses.forEach((name, idx) => {
  const result = buildCreateClassPayload(
    { name, order: idx + 1, academicYearId: year2026!.id },
    'inst_madrasah_primary',
    undefined,
    []
  );
  if (!result.schoolClass || result.schoolClass.name !== name) {
    allMixedValid = false;
  }
});

assert(
  allMixedValid,
  '5.1 Generic class foundation seamlessly supports both standard K-12 school classes and Madrasah branches (Hifz, Dakhil, Alim, Fazil)'
);

// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log('\n========================================================');
console.log(`📊 TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log('========================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL ACADEMIC FOUNDATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
