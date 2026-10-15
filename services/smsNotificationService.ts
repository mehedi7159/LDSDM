/**
 * Automated SMS Notification Service & Dispatch Engine
 * Supports Student Profile Guardian Contact Integration, Template Interpolation,
 * and Multi-Gateway SMS Dispatch.
 */

import { Student, Exam, SchoolProfile, MarkRecord, Subject } from '../types';
import { calculateTotalGPA, formatNumber } from './utils';

export interface SmsGatewayConfig {
  provider: 'direct_device' | 'greenweb' | 'bulksmsbd' | 'sslwireless' | 'alpha' | 'custom_webhook';
  apiKey?: string;
  senderId?: string;
  apiUrl?: string;
  isEnabled: boolean;
  autoSendOnPublish?: boolean;
}

export interface SmsDispatchLog {
  id: string;
  sentAt: string;
  studentId: string;
  studentName: string;
  classLevel: string;
  recipientPhone: string;
  message: string;
  examName: string;
  gpa: string;
  grade: string;
  status: 'sent' | 'delivered' | 'failed';
  gateway: string;
}

export const DEFAULT_SMS_TEMPLATES = {
  bn: 'সম্মানিত অভিভাবক, আপনার সন্তান {STUDENT_NAME} (রোল: {ROLL})-এর {EXAM_NAME} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। মোট নম্বর: {TOTAL_MARKS}, জিপিএ: {GPA} ({GRADE})। অবস্থান: {POSITION}। - {MADRASAH_NAME}',
  en: 'Dear Guardian, result of {STUDENT_NAME} (Roll: {ROLL}) for {EXAM_NAME} has been published. Total Marks: {TOTAL_MARKS}, GPA: {GPA} ({GRADE}). Position: {POSITION}. - {MADRASAH_NAME}'
};

export const ATTENDANCE_SMS_TEMPLATES = {
  absent_bn: 'সম্মানিত অভিভাবক, আপনার সন্তান {STUDENT_NAME} (রোল: {ROLL}, শ্রেণি: {CLASS}) আজ {DATE} তারিখে মাদ্রাসায় অনুপস্থিত রয়েছে। জরুরি প্রয়োজনে যোগাযোগ করুন। - {MADRASAH_NAME}',
  absent_en: 'Dear Guardian, your child {STUDENT_NAME} (Roll: {ROLL}, Class: {CLASS}) is absent today ({DATE}). Please contact the madrasah. - {MADRASAH_NAME}',
  late_bn: 'সম্মানিত অভিভাবক, আপনার সন্তান {STUDENT_NAME} আজ {DATE} তারিখে বিলম্বে মাদ্রাসায় উপস্থিত হয়েছে ({TIME})। - {MADRASAH_NAME}'
};

export function generateAbsentSmsText(
  student: Student,
  dateStr: string,
  schoolName: string = 'মাদ্রাসা ব্যবস্থাপনা',
  lang: 'bn' | 'en' = 'bn'
): string {
  const template = lang === 'bn' ? ATTENDANCE_SMS_TEMPLATES.absent_bn : ATTENDANCE_SMS_TEMPLATES.absent_en;
  return template
    .replace('{STUDENT_NAME}', student.nameBn || student.name)
    .replace('{ROLL}', student.roll || student.rollNumber || '—')
    .replace('{CLASS}', student.classLevel || '')
    .replace('{DATE}', dateStr)
    .replace('{MADRASAH_NAME}', schoolName);
}

/**
 * Validate Bangladeshi Mobile Phone Number
 */
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^\d+]/g, '');
  
  // Normalize 8801... to 01...
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  return cleaned;
}

export function isValidMobileNumber(phone?: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  // Valid Bangladeshi mobile starts with 013, 014, 015, 016, 017, 018, 019 and is 11 digits
  const bdRegex = /^01[3-9]\d{8}$/;
  return bdRegex.test(normalized);
}

/**
 * Calculate Student Result Metrics for SMS
 */
export function generateStudentResultSmsData(params: {
  student: Student;
  exam: Exam;
  schoolProfile: SchoolProfile;
  subjects: Subject[];
  marks: MarkRecord[];
  allClassStudents?: Student[];
  allClassMarks?: MarkRecord[];
  customTemplate?: string;
  language?: 'bn' | 'en';
}) {
  const { student, exam, schoolProfile, subjects, marks, allClassStudents, customTemplate, language = 'bn' } = params;

  // Calculate student result stats using central grading engine
  const studentStats = calculateTotalGPA(subjects, marks, student.id, exam.id, student.group, [exam]);
  const totalObtained = studentStats.totalMarks;
  const finalGpaStr = studentStats.isFail ? (language === 'bn' ? '০.০০' : '0.00') : studentStats.gpa.toFixed(2);
  const finalGrade = studentStats.isFail ? 'F' : studentStats.grade;

  // Determine Class Position / Merit Rank
  let meritPosition = '-';
  if (allClassStudents && allClassStudents.length > 0) {
    const rankList = allClassStudents.map(s => {
      const stats = calculateTotalGPA(subjects, marks, s.id, exam.id, s.group, [exam]);
      return { 
        id: s.id, 
        total: stats.totalMarks, 
        gpa: stats.isFail ? 0 : stats.gpa, 
        fail: stats.isFail 
      };
    }).sort((a, b) => {
      if (a.fail && !b.fail) return 1;
      if (!a.fail && b.fail) return -1;
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.total - a.total;
    });

    const pos = rankList.findIndex(item => item.id === student.id);
    if (pos >= 0) {
      meritPosition = language === 'bn' ? formatNumber(pos + 1, 'bn') + 'ম' : `${pos + 1}`;
    }
  }

  const template = customTemplate || (language === 'bn' ? DEFAULT_SMS_TEMPLATES.bn : DEFAULT_SMS_TEMPLATES.en);
  const phone = student.guardianPhone || student.metadata?.phone || '';
  const normalizedPhone = normalizePhoneNumber(phone);

  const message = template
    .replace(/{STUDENT_NAME}/g, language === 'bn' ? (student.nameBn || student.name) : student.name)
    .replace(/{ROLL}/g, formatNumber(student.roll || student.rollNumber || '১', language))
    .replace(/{CLASS}/g, student.classLevel)
    .replace(/{EXAM_NAME}/g, language === 'bn' ? (exam.nameBn || exam.name) : exam.name)
    .replace(/{GPA}/g, finalGpaStr)
    .replace(/{GRADE}/g, finalGrade)
    .replace(/{TOTAL_MARKS}/g, formatNumber(totalObtained, language))
    .replace(/{POSITION}/g, meritPosition)
    .replace(/{MADRASAH_NAME}/g, language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name);

  return {
    studentId: student.id,
    studentName: student.name,
    phone: normalizedPhone,
    isValidPhone: isValidMobileNumber(normalizedPhone),
    message,
    gpa: finalGpaStr,
    grade: finalGrade,
    totalObtained,
    meritPosition
  };
}

/**
 * Save SMS Dispatch Record to Local Storage & Audit Log
 */
export function saveSmsDispatchLogs(logs: SmsDispatchLog[]) {
  try {
    const existing = getSmsDispatchLogs();
    const merged = [...logs, ...existing].slice(0, 200); // Keep latest 200 logs
    localStorage.setItem('madrasha_sms_dispatch_logs', JSON.stringify(merged));
  } catch (err) {
    console.warn('Could not save SMS dispatch logs:', err);
  }
}

export function getSmsDispatchLogs(): SmsDispatchLog[] {
  try {
    const saved = localStorage.getItem('madrasha_sms_dispatch_logs');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}
