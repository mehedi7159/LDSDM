/**
 * Main-Store Payload Builder (Phase 6 extraction)
 * ===============================================
 * Pure-move extraction from context/AppContext.tsx. The Firestore
 * `institution/main_store` document payload was previously assembled as an
 * identical inline object literal in two places (the debounced auto-sync
 * effect and forcePushToCloud). Both call sites now build it through this
 * single function, passing their own `updatedBy` value — each call site
 * keeps its exact historical fallback chain, so the written document is
 * byte-for-byte what it was before the extraction. `updatedAt` is stamped
 * here at build time, exactly as the inline literals did.
 *
 * The slice fields are intentionally typed as `any`: this is a pure
 * pass-through assembly of AppContext state slices (the same values, in
 * the same field order, that were previously inlined), and the payload is
 * written to Firestore as an untyped document.
 */
export interface MainStoreSlices {
  schoolProfile: any;
  students: any;
  subjects: any;
  teachers: any;
  classSubjectAssignments: any;
  teacherSubjectAssignments: any;
  classTeacherAssignments: any;
  exams: any;
  examSubjectAssignments: any;
  marks: any;
  remarks: any;
  classes: any;
  academicYears: any;
  sections: any;
  transactions: any;
  feeStructures: any;
  feeTypes: any;
  trashBin: any;
  promotionHistory: any;
  users: any;
  notices: any;
  staffLeaves: any;
  dailyStudentAttendance: any;
  dailyStaffAttendance: any;
  classRoutines: any;
  syllabusItems: any;
  calendarEvents: any;
}

export function buildMainStorePayload(slices: MainStoreSlices, updatedBy: string) {
  return {
    schoolProfile: slices.schoolProfile,
    students: slices.students,
    subjects: slices.subjects,
    teachers: slices.teachers,
    classSubjectAssignments: slices.classSubjectAssignments,
    teacherSubjectAssignments: slices.teacherSubjectAssignments,
    classTeacherAssignments: slices.classTeacherAssignments,
    exams: slices.exams,
    examSubjectAssignments: slices.examSubjectAssignments,
    marks: slices.marks,
    remarks: slices.remarks,
    classes: slices.classes,
    academicYears: slices.academicYears,
    sections: slices.sections,
    transactions: slices.transactions,
    feeStructures: slices.feeStructures,
    feeTypes: slices.feeTypes,
    trashBin: slices.trashBin,
    promotionHistory: slices.promotionHistory,
    users: slices.users,
    notices: slices.notices,
    staffLeaves: slices.staffLeaves,
    dailyStudentAttendance: slices.dailyStudentAttendance,
    dailyStaffAttendance: slices.dailyStaffAttendance,
    classRoutines: slices.classRoutines,
    syllabusItems: slices.syllabusItems,
    calendarEvents: slices.calendarEvents,
    updatedBy,
    updatedAt: new Date().toISOString()
  };
}
