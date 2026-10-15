/**
 * Academic Validation Engine
 * Validates Academic Years, Classes, Sections, and Student Placements.
 * Works for BOTH School and Madrasah.
 */

import { AcademicYear, Section, SchoolClass, AcademicValidationResult, StudentPlacementParams } from '../types';
import { Student } from '../types/student';

const VALID_YEAR_STATUSES = new Set(['UPCOMING', 'ACTIVE', 'CLOSED']);
const VALID_ENTITY_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates Academic Year Data
 */
export function validateAcademicYear(
  data: Partial<AcademicYear>,
  existingYears: AcademicYear[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'শিক্ষাবর্ষের নাম আবশ্যক (Academic year name is required)';
  } else if (data.name.trim().length > 50) {
    errors.name = 'শিক্ষাবর্ষের নাম ৫০ অক্ষরের বেশি হতে পারবে না (Name must be under 50 characters)';
  } else {
    // Duplicate check within institution
    const normalizedName = data.name.trim().toLowerCase();
    const isDuplicate = existingYears.some(
      y => y.name.trim().toLowerCase() === normalizedName && y.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.name = 'এই নামের শিক্ষাবর্ষ ইতিমধ্যে বিদ্যমান (Academic year with this name already exists)';
    }
  }

  // 2. Status validation
  if (data.status && !VALID_YEAR_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ শিক্ষাবর্ষ স্ট্যাটাস (Invalid academic year status)';
  }

  // 3. Date range validation
  if (data.startDate && !DATE_REGEX.test(data.startDate)) {
    errors.startDate = 'সঠিক শুরুর তারিখ দিন (YYYY-MM-DD) (Invalid start date)';
  }
  if (data.endDate && !DATE_REGEX.test(data.endDate)) {
    errors.endDate = 'সঠিক সমাপ্তির তারিখ দিন (YYYY-MM-DD) (Invalid end date)';
  }
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.dateRange = 'শুরুর তারিখ অবশ্যই সমাপ্তির তারিখের পূর্বে হতে হবে (Start date must be before end date)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Class Configuration
 */
export function validateClassConfig(
  data: Partial<SchoolClass>,
  existingClasses: SchoolClass[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'শ্রেণীর নাম আবশ্যক (Class name is required)';
  } else if (data.name.trim().length > 100) {
    errors.name = 'শ্রেণীর নাম ১০০ অক্ষরের বেশি হতে পারবে না (Class name must be under 100 characters)';
  } else {
    // Duplicate check within same academicYearId / institution
    const normalizedName = data.name.trim().toLowerCase();
    const targetYearId = data.academicYearId || '';
    const isDuplicate = existingClasses.some(
      c => c.name.trim().toLowerCase() === normalizedName && 
           (c.academicYearId || '') === targetYearId &&
           c.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.name = 'এই শিক্ষাবর্ষে একই নামের শ্রেণী ইতিমধ্যে রয়েছে (Duplicate class in the same academic year)';
    }
  }

  // 2. Order validation
  if (data.order !== undefined && (typeof data.order !== 'number' || isNaN(data.order) || data.order < 0)) {
    errors.order = 'ক্রম অবশ্যই সঠিক ধনাত্মক সংখ্যা হতে হবে (Order must be a valid positive number)';
  }

  // 3. Status validation
  if (data.status && !VALID_ENTITY_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ শ্রেণী স্ট্যাটাস (Invalid class status)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Section Configuration
 */
export function validateSectionConfig(
  data: Partial<Section>,
  existingSections: Section[] = [],
  existingClasses: SchoolClass[] = [],
  editingId?: string
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'শাখার নাম আবশ্যক (Section name is required)';
  } else if (data.name.trim().length > 50) {
    errors.name = 'শাখার নাম ৫০ অক্ষরের বেশি হতে পারবে না (Section name must be under 50 characters)';
  }

  // 2. Class ID validation
  if (!data.classId || typeof data.classId !== 'string' || data.classId.trim().length === 0) {
    errors.classId = 'শ্রেণী নির্বাচন আবশ্যক (Class is required for section)';
  } else {
    const parentClass = existingClasses.find(c => c.id === data.classId || c.name === data.classId);
    if (!parentClass) {
      errors.classId = 'নির্বাচিত শ্রেণী খুঁজে পাওয়া যায়নি (Selected class does not exist)';
    } else if (parentClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে নতুন শাখা যোগ করা যাবে না (Cannot add section to inactive class)';
    }
  }

  // 3. Duplicate section check within same class and academicYearId
  if (data.name && data.classId) {
    const normalizedName = data.name.trim().toLowerCase();
    const targetClassId = data.classId;
    const targetYearId = data.academicYearId || '';
    const isDuplicate = existingSections.some(
      s => s.name.trim().toLowerCase() === normalizedName &&
           (s.classId === targetClassId || s.classId === targetClassId) &&
           (s.academicYearId || '') === targetYearId &&
           s.id !== (editingId || '')
    );
    if (isDuplicate) {
      errors.name = 'এই শ্রেণীতে একই নামের শাখা ইতিমধ্যে বিদ্যমান (Duplicate section name for this class)';
    }
  }

  // 4. Capacity validation (if provided)
  if (data.capacity !== undefined && data.capacity !== null) {
    if (typeof data.capacity !== 'number' || isNaN(data.capacity) || data.capacity < 1 || data.capacity > 1000) {
      errors.capacity = 'ধারণক্ষমতা ১ থেকে ১০০০ এর মধ্যে হতে হবে (Capacity must be between 1 and 1000)';
    }
  }

  // 5. Status validation
  if (data.status && !VALID_ENTITY_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ শাখা স্ট্যাটাস (Invalid section status)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates Student Academic Placement
 * Ensures consistency among academicYearId, classId, and sectionId.
 */
export function validateStudentAcademicPlacement(
  params: StudentPlacementParams,
  classes: SchoolClass[] = [],
  sections: Section[] = [],
  academicYears: AcademicYear[] = []
): AcademicValidationResult {
  const errors: Record<string, string> = {};

  const { classId, sectionId, academicYearId } = params;

  // 1. Class Validation
  if (!classId || classId.trim().length === 0) {
    errors.classId = 'শ্রেণী আবশ্যক (Class selection is required)';
  } else {
    const targetClass = classes.find(c => c.id === classId || c.name === classId);
    if (!targetClass) {
      errors.classId = 'নির্দিষ্ট শ্রেণী খুঁজে পাওয়া যায়নি (Class not found)';
    } else if (targetClass.status === 'INACTIVE') {
      errors.classId = 'নিষ্ক্রিয় শ্রেণীতে শিক্ষার্থী নির্ধারণ করা যাবে না (Cannot place student in inactive class)';
    } else if (academicYearId && targetClass.academicYearId && targetClass.academicYearId !== academicYearId) {
      errors.classYearMismatch = 'শ্রেণীর শিক্ষাবর্ষ ও শিক্ষার্থীর শিক্ষাবর্ষ মিল নেই (Class year does not match student academic year)';
    }
  }

  // 2. Section Validation (if provided)
  if (sectionId && sectionId.trim().length > 0) {
    const targetSection = sections.find(s => s.id === sectionId);
    if (!targetSection) {
      errors.sectionId = 'নির্দিষ্ট শাখা খুঁজে পাওয়া যায়নি (Section not found)';
    } else {
      if (targetSection.status === 'INACTIVE') {
        errors.sectionId = 'নিষ্ক্রিয় শাখায় শিক্ষার্থী নির্ধারণ করা যাবে না (Cannot place student in inactive section)';
      }
      if (classId && targetSection.classId !== classId) {
        // Also check if targetSection.classId matches class name
        const matchedClass = classes.find(c => c.id === targetSection.classId || c.name === targetSection.classId);
        if (!matchedClass || (matchedClass.id !== classId && matchedClass.name !== classId)) {
          errors.sectionClassMismatch = 'নির্বাচিত শাখাটি এই শ্রেণীর অন্তর্ভুক্ত নয় (Section does not belong to the selected class)';
        }
      }
      if (academicYearId && targetSection.academicYearId && targetSection.academicYearId !== academicYearId) {
        errors.sectionYearMismatch = 'শাখার শিক্ষাবর্ষ ও শিক্ষার্থীর শিক্ষাবর্ষ মিল নেই (Section year does not match student academic year)';
      }
    }
  }

  // 3. Academic Year Validation (if provided)
  if (academicYearId && academicYearId.trim().length > 0 && academicYears.length > 0) {
    const targetYear = academicYears.find(y => y.id === academicYearId || y.name === academicYearId);
    if (!targetYear) {
      errors.academicYearId = 'নির্দিষ্ট শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি (Academic year not found)';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
