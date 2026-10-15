/**
 * Student Validation Engine
 * Reusable validation logic for UI forms and Service Layer
 */

import type { Student, StudentValidationResult } from '../types/student';

const VALID_STATUSES = new Set([
  'active',
  'inactive',
  'transferred',
  'graduated',
  'dropped',
  'archived',
  'Active',
  'Inactive',
  'Former'
]);

// Phone regex: Supports BD local (01XXXXXXXXX), international (+8801XXXXXXXXX) and standard 10-15 digit formats
const PHONE_REGEX = /^(?:\+?\d{1,4}[ -]?)?(?:\(?\d{2,4}\)?[ -]?)?\d{6,12}$/;

// Standard RFC 5322 compatible lightweight email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStudent(
  data: Partial<Student>, 
  options?: { isNewRegistration?: boolean }
): StudentValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation (mandatory)
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'শিক্ষার্থীর নাম আবশ্যক (Student name is required)';
  } else if (data.name.trim().length > 150) {
    errors.name = 'নাম ১৫০ অক্ষরের বেশি হতে পারবে না (Name must be under 150 characters)';
  }

  // 2. Class Level / Class ID validation
  const hasClass = (data.classLevel && data.classLevel.trim().length > 0) || (data.classId && data.classId.trim().length > 0);
  if (options?.isNewRegistration && !hasClass) {
    errors.classLevel = 'ক্লাস নির্বাচন আবশ্যক (Class selection is required)';
  }

  // 3. Status validation (if provided)
  if (data.status && !VALID_STATUSES.has(data.status)) {
    errors.status = 'অবৈধ স্ট্যাটাস (Invalid student lifecycle status)';
  }

  // 4. Student ID / Code validation (safe string length)
  if (data.id && typeof data.id === 'string' && data.id.length > 100) {
    errors.id = 'আইডি ১০০ অক্ষরের বেশি হতে পারবে না (ID exceeds length limit)';
  }

  if (data.studentId && typeof data.studentId === 'string' && data.studentId.length > 50) {
    errors.studentId = 'স্টুডেন্ট আইডি ৫০ অক্ষরের বেশি হতে পারবে না (Student ID exceeds 50 characters)';
  }

  if (data.admissionNumber && typeof data.admissionNumber === 'string' && data.admissionNumber.length > 50) {
    errors.admissionNumber = 'ভর্তি নম্বর ৫০ অক্ষরের বেশি হতে পারবে না (Admission number exceeds 50 characters)';
  }

  // 5. Guardian Contact validation (optional, but validated if provided)
  if (data.guardianPhone && data.guardianPhone.trim().length > 0) {
    const cleanedPhone = data.guardianPhone.trim().replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanedPhone) || cleanedPhone.length < 10 || cleanedPhone.length > 16) {
      errors.guardianPhone = 'সঠিক ফোন নম্বর প্রদান করুন (Invalid guardian phone number)';
    }
  }

  if (data.guardianEmail && data.guardianEmail.trim().length > 0) {
    if (!EMAIL_REGEX.test(data.guardianEmail.trim())) {
      errors.guardianEmail = 'সঠিক ইমেইল ঠিকানা প্রদান করুন (Invalid guardian email address)';
    }
  }

  // 6. Safe text lengths
  if (data.fatherName && data.fatherName.length > 150) {
    errors.fatherName = 'পিতার নাম ১৫০ অক্ষরের বেশি হতে পারবে না';
  }
  if (data.motherName && data.motherName.length > 150) {
    errors.motherName = 'মাতার নাম ১৫০ অক্ষরের বেশি হতে পারবে না';
  }
  if (data.guardianName && data.guardianName.length > 150) {
    errors.guardianName = 'অভিভাবকের নাম ১৫০ অক্ষরের বেশি হতে পারবে না';
  }
  if (data.address && data.address.length > 300) {
    errors.address = 'ঠিকানা ৩০০ অক্ষরের বেশি হতে পারবে না';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
