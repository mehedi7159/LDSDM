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

// ----------------------------------------------------------------------------
// SMS Gateway dispatch — HONEST implementation (Phase 2)
// ----------------------------------------------------------------------------
// There is currently NO working SMS gateway integration in the browser
// build: no provider API is called from here. Earlier UI code simulated a
// dispatch (progress bar, then a 'delivered' log entry and a success
// banner) although no message ever left the device. That behaviour is
// removed. `dispatchSmsViaGateway` is the single code path every SMS send
// action must go through; it reports the truth today and is the one place
// a real provider integration plugs into later (server-side, so gateway
// credentials never ship in the browser bundle).

export const SMS_GATEWAY_CONFIG_KEY = 'madrasha_sms_gateway_config';

export const DEFAULT_SMS_GATEWAY_CONFIG: SmsGatewayConfig = {
  provider: 'direct_device',
  apiKey: '',
  senderId: 'MADRASAH',
  apiUrl: '',
  isEnabled: true,
  autoSendOnPublish: false
};

/** Read the saved gateway configuration (same store the settings UI uses). */
export function getSmsGatewayConfig(): SmsGatewayConfig {
  try {
    const saved = localStorage.getItem(SMS_GATEWAY_CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_SMS_GATEWAY_CONFIG, ...JSON.parse(saved) };
    }
  } catch {}
  return { ...DEFAULT_SMS_GATEWAY_CONFIG };
}

/**
 * A gateway counts as configured only when a real web provider is chosen,
 * the gateway is enabled, and an API key is present (plus an API URL for
 * the custom webhook provider). The built-in 'direct_device' option is NOT
 * a gateway — it hands messages to the phone's own SMS app instead.
 */
export function isSmsGatewayConfigured(config: SmsGatewayConfig): boolean {
  if (!config) return false;
  if (config.provider === 'direct_device') return false;
  if (config.isEnabled === false) return false;
  if (!config.apiKey || !config.apiKey.trim()) return false;
  if (config.provider === 'custom_webhook' && !(config.apiUrl || '').trim()) return false;
  return true;
}

export interface SmsDispatchRecipient {
  phone: string;
  message: string;
}

export interface SmsDispatchResult {
  success: boolean;
  /** Why nothing was sent, when success is false. */
  reason?: 'not_configured' | 'gateway_not_connected';
  dispatchedCount: number;
  messageBn: string;
  messageEn: string;
}

/**
 * The single gateway dispatch entry point.
 *
 * Today this NEVER reports success: without a configured gateway there is
 * nothing to send through, and even with one, real provider dispatch is
 * not wired into the browser build yet (it belongs server-side). Callers
 * must surface the returned message and must not log 'delivered'/'sent'
 * unless a future implementation returns success: true.
 */
export async function dispatchSmsViaGateway(
  config: SmsGatewayConfig,
  recipients: SmsDispatchRecipient[]
): Promise<SmsDispatchResult> {
  const count = (recipients || []).length;

  if (!isSmsGatewayConfigured(config)) {
    return {
      success: false,
      reason: 'not_configured',
      dispatchedCount: 0,
      messageBn: `এসএমএস গেটওয়ে কনফিগার করা নেই — কোনো এসএমএস পাঠানো হয়নি। ওয়েব গেটওয়ে (প্রোভাইডার + API Key) সেট করতে "এসএমএস গেটওয়ে সেটিংস" ট্যাবে যান, অথবা "ডিভাইস এসএমএস অ্যাপ" বোতাম দিয়ে নিজের ফোন থেকে পাঠান।`,
      messageEn: `SMS gateway is not configured — no SMS was sent. Add a web gateway (provider + API key) in the "SMS Gateway Settings" tab, or use the "Open in SMS App" button to send from your own phone.`
    };
  }

  // A gateway IS configured, but real provider dispatch is intentionally
  // not performed from the browser build yet. Be explicit instead of
  // simulating delivery.
  return {
    success: false,
    reason: 'gateway_not_connected',
    dispatchedCount: 0,
    messageBn: `গেটওয়ে সেটিংস সংরক্ষিত আছে, তবে এই সংস্করণে সরাসরি গেটওয়ে প্রেরণ এখনো সংযুক্ত হয়নি — কোনো এসএমএস পাঠানো হয়নি (${count} জন প্রাপক)। আপাতত "ডিভাইস এসএমএস অ্যাপ" দিয়ে পাঠান।`,
    messageEn: `Gateway settings are saved, but direct gateway dispatch is not connected in this build yet — no SMS was sent (${count} recipients). Please use "Open in SMS App" for now.`
  };
}
