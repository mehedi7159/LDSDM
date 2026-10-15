/**
 * Academic Schedule Service
 * Manages Class Routines & Timetables, Syllabus & Lesson Planning,
 * and Annual Academic Calendar & Holidays.
 * Supports persistent LocalStorage with initial realistic Madrasah seed data.
 */

import { ClassRoutineItem, SyllabusItem, AcademicCalendarEvent, DayOfWeek } from '../types/academic';

const ROUTINE_STORAGE_KEY = 'madrasha_academic_routines_v1';
const SYLLABUS_STORAGE_KEY = 'madrasha_academic_syllabus_v1';
const CALENDAR_STORAGE_KEY = 'madrasha_academic_calendar_v1';

export const DAYS_OF_WEEK: { en: DayOfWeek; bn: string; shortBn: string }[] = [
  { en: 'Saturday', bn: 'শনিবার', shortBn: 'শনি' },
  { en: 'Sunday', bn: 'রবিবার', shortBn: 'রবি' },
  { en: 'Monday', bn: 'সোমবার', shortBn: 'সোম' },
  { en: 'Tuesday', bn: 'মঙ্গলবার', shortBn: 'মঙ্গল' },
  { en: 'Wednesday', bn: 'বুধবার', shortBn: 'বুধ' },
  { en: 'Thursday', bn: 'বৃহস্পতিবার', shortBn: 'বৃহস্পতি' },
  { en: 'Friday', bn: 'শুক্রবার (সাপ্তাহিক ছুটি)', shortBn: 'শুক্র' },
];

export const STANDARD_PERIODS = [
  { number: 1, nameBn: '১ম ঘণ্টা', start: '09:00 AM', end: '09:45 AM' },
  { number: 2, nameBn: '২য় ঘণ্টা', start: '09:45 AM', end: '10:30 AM' },
  { number: 3, nameBn: '৩য় ঘণ্টা', start: '10:30 AM', end: '11:15 AM' },
  { number: 4, nameBn: '৪র্থ ঘণ্টা', start: '11:15 AM', end: '12:00 PM' },
  { number: 5, nameBn: 'টিফিন ও যোহরের বিরতি', start: '12:00 PM', end: '01:00 PM', isBreak: true },
  { number: 6, nameBn: '৫ম ঘণ্টা', start: '01:00 PM', end: '01:45 PM' },
  { number: 7, nameBn: '৬ষ্ঠ ঘণ্টা', start: '01:45 PM', end: '02:30 PM' },
  { number: 8, nameBn: '৭ম ঘণ্টা', start: '02:30 PM', end: '03:15 PM' },
];

// Initial Seed Data: Realistic Calendar Events
const INITIAL_CALENDAR_EVENTS: AcademicCalendarEvent[] = [
  {
    id: 'cal_ev_1',
    title: 'New Academic Session Orientation',
    titleBn: 'নতুন শিক্ষাবর্ষের উদ্বোধনী ও ওরিয়েন্টেশন',
    type: 'ACADEMIC_TERM',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    totalDays: 1,
    isHoliday: false,
    description: 'নতুন শিক্ষার্থী ও অভিভাবকদের সাথে দিকনির্দেশনামূলক সমাবেশ'
  },
  {
    id: 'cal_ev_2',
    title: 'Shab-e-Barat Holiday',
    titleBn: 'পবিত্র শবে বরাত',
    type: 'HOLIDAY',
    startDate: '2026-02-14',
    endDate: '2026-02-15',
    totalDays: 2,
    isHoliday: true,
    description: 'পবিত্র শবে বরাত উপলক্ষে সাধারণ ছুটি'
  },
  {
    id: 'cal_ev_3',
    title: 'Holy Ramadan & Eid-ul-Fitr Vacation',
    titleBn: 'পবিত্র মাহে রমজান ও ঈদুল ফিতরের ছুটি',
    type: 'VACATION',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    totalDays: 31,
    isHoliday: true,
    description: 'রমজানুল মোবারক, লাইলাতুল কদর ও ঈদুল ফিতর উপলক্ষে দীর্ঘ অবকাশ'
  },
  {
    id: 'cal_ev_4',
    title: 'First Term Examination 2026',
    titleBn: '১ম সাময়িক পরীক্ষা ২০২৬',
    type: 'EXAM',
    startDate: '2026-04-18',
    endDate: '2026-04-30',
    totalDays: 12,
    isHoliday: false,
    description: 'সকল শ্রেণির ১ম সাময়িক পরীক্ষা গ্রহণ ও খাতা মূল্যায়ন'
  },
  {
    id: 'cal_ev_5',
    title: 'First Term Result Publication & Parents Meeting',
    titleBn: '১ম সাময়িক ফলাফল প্রকাশ ও অভিভাবক সমাবেশ',
    type: 'EVENT',
    startDate: '2026-05-10',
    endDate: '2026-05-10',
    totalDays: 1,
    isHoliday: false,
    description: 'প্রগতিপত্র বিতরণ ও শীর্ষ শিক্ষার্থীদের সম্মাননা প্রদান'
  },
  {
    id: 'cal_ev_6',
    title: 'Holy Eid-ul-Adha Vacation',
    titleBn: 'পবিত্র ঈদুল আযহা ও গ্রীষ্মকালীন ছুটি',
    type: 'HOLIDAY',
    startDate: '2026-05-25',
    endDate: '2026-06-05',
    totalDays: 12,
    isHoliday: true,
    description: 'পবিত্র কুরবানি উপলক্ষে প্রাতিষ্ঠানিক ছুটি'
  },
  {
    id: 'cal_ev_7',
    title: 'Second Term Examination 2026',
    titleBn: '২য় সাময়িক পরীক্ষা ২০২৬',
    type: 'EXAM',
    startDate: '2026-08-15',
    endDate: '2026-08-28',
    totalDays: 14,
    isHoliday: false,
    description: 'অর্ধবার্ষিক / ২য় সাময়িক পরীক্ষা'
  },
  {
    id: 'cal_ev_8',
    title: 'Annual Sports & Qirat/Hifz Competition',
    titleBn: 'বার্ষিক ক্রীড়া, কিরাত ও হিফজ প্রতিযোগিতা',
    type: 'EVENT',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
    totalDays: 3,
    isHoliday: false,
    description: 'হুসনে সাউত, হিফজুল কুরআন ও শরীরচর্চা ক্রীড়া উৎসব'
  },
  {
    id: 'cal_ev_9',
    title: 'Annual Final Examination 2026',
    titleBn: 'বার্ষিক চূড়ান্ত পরীক্ষা ২০২৬',
    type: 'EXAM',
    startDate: '2026-11-20',
    endDate: '2026-12-05',
    totalDays: 16,
    isHoliday: false,
    description: 'শ্রেণি উত্তরণ ও বার্ষিক ফলাফল মূল্যায়ন পরীক্ষা'
  },
  {
    id: 'cal_ev_10',
    title: 'Annual Result Publication & Prize Giving Day',
    titleBn: 'বার্ষিক ফলাফল প্রকাশ ও পুরস্কার বিতরণী অনুষ্ঠান',
    type: 'EVENT',
    startDate: '2026-12-24',
    endDate: '2026-12-24',
    totalDays: 1,
    isHoliday: false,
    description: 'মেধাবী ছাত্র-ছাত্রীদের মেডেল ও সনদ প্রদান এবং নতুন সেশনের ভর্তি শুরু'
  }
];

// Initial Seed Data: Realistic Routines
const INITIAL_ROUTINE_ITEMS: ClassRoutineItem[] = [
  // Class 1 (১ম শ্রেণি) - শনিবার
  {
    id: 'rt_seed_1',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 1,
    periodName: '১ম ঘণ্টা',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    subjectId: 'sub_quran',
    subjectName: 'কুরআন মাজীদ ও তাজবীদ',
    teacherId: 'tch_1',
    teacherName: 'মাওলানা আব্দুর রহমান',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_2',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 2,
    periodName: '২য় ঘণ্টা',
    startTime: '09:45 AM',
    endTime: '10:30 AM',
    subjectId: 'sub_bangla',
    subjectName: 'বাংলা',
    teacherId: 'tch_2',
    teacherName: 'মোঃ রফিকুল ইসলাম',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_3',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 3,
    periodName: '৩য় ঘণ্টা',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    subjectId: 'sub_math',
    subjectName: 'সাধারণ গণিত',
    teacherId: 'tch_3',
    teacherName: 'আহমেদ হাসান',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_4',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 4,
    periodName: '৪র্থ ঘণ্টা',
    startTime: '11:15 AM',
    endTime: '12:00 PM',
    subjectId: 'sub_arabic',
    subjectName: 'আরবি ১ম পত্র',
    teacherId: 'tch_1',
    teacherName: 'মাওলানা আব্দুর রহমান',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_5',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 6,
    periodName: '৫ম ঘণ্টা',
    startTime: '01:00 PM',
    endTime: '01:45 PM',
    subjectId: 'sub_english',
    subjectName: 'ইংরেজি',
    teacherId: 'tch_4',
    teacherName: 'মাহমুদুল হক',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_6',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 7,
    periodName: '৬ষ্ঠ ঘণ্টা',
    startTime: '01:45 PM',
    endTime: '02:30 PM',
    subjectId: 'sub_aqayed',
    subjectName: 'আল-আকাইদ ওয়াল ফিকহ',
    teacherId: 'tch_5',
    teacherName: 'মাওলানা জহিরুল ইসলাম',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },

  // Class 1 (১ম শ্রেণি) - রবিবার
  {
    id: 'rt_seed_7',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Sunday',
    periodNumber: 1,
    periodName: '১ম ঘণ্টা',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    subjectId: 'sub_quran',
    subjectName: 'কুরআন মাজীদ ও তাজবীদ',
    teacherId: 'tch_1',
    teacherName: 'মাওলানা আব্দুর রহমান',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_8',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Sunday',
    periodNumber: 2,
    periodName: '২য় ঘণ্টা',
    startTime: '09:45 AM',
    endTime: '10:30 AM',
    subjectId: 'sub_math',
    subjectName: 'সাধারণ গণিত',
    teacherId: 'tch_3',
    teacherName: 'আহমেদ হাসান',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_9',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Sunday',
    periodNumber: 3,
    periodName: '৩য় ঘণ্টা',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    subjectId: 'sub_bangla',
    subjectName: 'বাংলা',
    teacherId: 'tch_2',
    teacherName: 'মোঃ রফিকুল ইসলাম',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_10',
    classLevel: '১ম শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Sunday',
    periodNumber: 4,
    periodName: '৪র্থ ঘণ্টা',
    startTime: '11:15 AM',
    endTime: '12:00 PM',
    subjectId: 'sub_english',
    subjectName: 'ইংরেজি',
    teacherId: 'tch_4',
    teacherName: 'মাহমুদুল হক',
    roomNumber: '১০১',
    status: 'ACTIVE'
  },

  // Class 2 (২য় শ্রেণি) - শনিবার
  {
    id: 'rt_seed_11',
    classLevel: '২য় শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 1,
    periodName: '১ম ঘণ্টা',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    subjectId: 'sub_bangla',
    subjectName: 'বাংলা',
    teacherId: 'tch_2',
    teacherName: 'মোঃ রফিকুল ইসলাম',
    roomNumber: '১০২',
    status: 'ACTIVE'
  },
  {
    id: 'rt_seed_12',
    classLevel: '২য় শ্রেণি',
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 2,
    periodName: '২য় ঘণ্টা',
    startTime: '09:45 AM',
    endTime: '10:30 AM',
    subjectId: 'sub_quran',
    subjectName: 'কুরআন মাজীদ ও তাজবীদ',
    teacherId: 'tch_5',
    teacherName: 'মাওলানা জহিরুল ইসলাম',
    roomNumber: '১০২',
    status: 'ACTIVE'
  }
];

// Initial Seed Data: Realistic Syllabus Planning
const INITIAL_SYLLABUS_ITEMS: SyllabusItem[] = [
  {
    id: 'syl_1',
    classLevel: '১ম শ্রেণি',
    subjectId: 'sub_quran',
    subjectName: 'কুরআন মাজীদ ও তাজবীদ',
    termName: '১ম সাময়িক',
    chapterNo: 'অধ্যায় ১',
    title: 'হরফ চেনা, নুকতা ও হরকত পরিচয়',
    topics: '২৯টি আরবি হরফের বিশুদ্ধ মাখরাজ উচ্চারণ এবং যবর, যের, পেশের অনুশীলন।',
    totalPeriods: 18,
    completedPeriods: 14,
    status: 'IN_PROGRESS',
    teacherNotes: 'অধিকাংশ শিক্ষার্থীর মাখরাজ পরিষ্কার হচ্ছে, কিছু দুর্বল ছাত্রের অতিরিক্ত মনোযোগ প্রয়োজন।',
    targetDate: '2026-04-10'
  },
  {
    id: 'syl_2',
    classLevel: '১ম শ্রেণি',
    subjectId: 'sub_quran',
    subjectName: 'কুরআন মাজীদ ও তাজবীদ',
    termName: '১ম সাময়িক',
    chapterNo: 'অধ্যায় ২',
    title: 'তানভীন ও জযমের ব্যবহার এবং মাদ্দ-এর কাওয়ায়েদ',
    topics: 'দুই যবর, দুই যের, দুই পেশ ও সাকিন বিশিষ্ট হরফ পড়া।',
    totalPeriods: 14,
    completedPeriods: 8,
    status: 'IN_PROGRESS',
    teacherNotes: 'পরিকল্পনা অনুযায়ী ক্লাস চলছে।',
    targetDate: '2026-04-15'
  },
  {
    id: 'syl_3',
    classLevel: '১ম শ্রেণি',
    subjectId: 'sub_bangla',
    subjectName: 'বাংলা',
    termName: '১ম সাময়িক',
    chapterNo: 'অধ্যায় ১-৩',
    title: 'স্বরবর্ণ, ব্যঞ্জনবর্ণ ও শব্দ গঠন',
    topics: 'স্বরবর্ণ ১১টি, ব্যঞ্জনবর্ণ ৩৯টি ও কারচিহ্ন সহযোগে শব্দ তৈরি।',
    totalPeriods: 20,
    completedPeriods: 20,
    status: 'COMPLETED',
    teacherNotes: 'সম্পূর্ণ পাঠদান ও পুনরাবৃত্তি শেষ।',
    targetDate: '2026-03-25'
  },
  {
    id: 'syl_4',
    classLevel: '১ম শ্রেণি',
    subjectId: 'sub_math',
    subjectName: 'সাধারণ গণিত',
    termName: '১ম সাময়িক',
    chapterNo: 'অধ্যায় ১ ও ২',
    title: '১ থেকে ৫০ পর্যন্ত গণনা ও কথায় লেখা',
    topics: 'অংকে ও কথায় লেখা, ছোট-বড় সংখ্যা নির্ণয় ও সহজ যোগ।',
    totalPeriods: 16,
    completedPeriods: 16,
    status: 'COMPLETED',
    teacherNotes: 'শ্রেণি মূল্যায়ন পরীক্ষা নেওয়া সম্পন্ন হয়েছে।',
    targetDate: '2026-03-28'
  },
  {
    id: 'syl_5',
    classLevel: '২য় শ্রেণি',
    subjectId: 'sub_arabic',
    subjectName: 'আরবি ১ম পত্র (আদ-দুরূস)',
    termName: '১ম সাময়িক',
    chapterNo: 'দারস ১-৪',
    title: 'আত-তারুফ ওয়াল তাহিয়্যাহ (পরিচিতি ও শুভেচ্ছা বিনিময়)',
    topics: 'হাজা ও হাজিহী এর ব্যবহার এবং প্রাত্যহিক বাক্য তৈরি।',
    totalPeriods: 15,
    completedPeriods: 12,
    status: 'IN_PROGRESS',
    teacherNotes: 'ছাত্রদের মৌখিক আরবি কথন অনুশীলন করানো হচ্ছে।',
    targetDate: '2026-04-12'
  }
];

class AcademicScheduleService {
  // -------------------------------------------------------------
  // ROUTINE ENGINE
  // -------------------------------------------------------------
  getRoutines(): ClassRoutineItem[] {
    try {
      const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading routines:', e);
    }
    // Seed initial routines
    this.saveRoutines(INITIAL_ROUTINE_ITEMS);
    return INITIAL_ROUTINE_ITEMS;
  }

  saveRoutines(items: ClassRoutineItem[]): void {
    try {
      localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error saving routines:', e);
    }
  }

  getRoutineByClass(classLevel: string, sectionName?: string): ClassRoutineItem[] {
    const list = this.getRoutines();
    return list.filter(item => {
      const classMatch = item.classLevel === classLevel;
      if (!sectionName || sectionName === 'ALL') return classMatch;
      return classMatch && (!item.sectionName || item.sectionName === sectionName);
    });
  }

  getRoutineByTeacher(teacherId: string): ClassRoutineItem[] {
    const list = this.getRoutines();
    return list.filter(item => item.teacherId === teacherId);
  }

  checkRoutineConflict(
    newItem: Omit<ClassRoutineItem, 'id'>, 
    excludeId?: string
  ): { hasConflict: boolean; message?: string } {
    const list = this.getRoutines();

    for (const r of list) {
      if (excludeId && r.id === excludeId) continue;
      if (r.dayOfWeek !== newItem.dayOfWeek || r.periodNumber !== newItem.periodNumber) continue;

      // 1. Teacher Conflict: Same teacher cannot take two classes in the same period
      if (newItem.teacherId && r.teacherId && newItem.teacherId === r.teacherId) {
        return {
          hasConflict: true,
          message: `শিক্ষক দ্বৈত দ্বন্দ্ব! শিক্ষক "${r.teacherName || 'নির্বাচিত শিক্ষক'}" এই পিরিয়ডে (${r.dayOfWeek}, ${r.periodName || r.periodNumber}) শ্রেণি "${r.classLevel}"-এ ইতিমধ্যে নিয়োজিত আছেন।`
        };
      }

      // 2. Class Conflict: Same class & section cannot have two subjects in the same period
      if (newItem.classLevel === r.classLevel) {
        const secMatch = !newItem.sectionName || !r.sectionName || newItem.sectionName === r.sectionName;
        if (secMatch) {
          return {
            hasConflict: true,
            message: `শ্রেণি রুটিন দ্বন্দ্ব! শ্রেণি "${r.classLevel}" (${r.sectionName || 'সকল শাখা'})-এ এই পিরিয়ডে (${r.periodName || r.periodNumber}) ইতিমধ্যে "${r.subjectName || 'একটি বিষয়'}" নির্ধারিত রয়েছে।`
          };
        }
      }

      // 3. Room Conflict: Same room cannot be used by two classes at the same time
      if (newItem.roomNumber && r.roomNumber && newItem.roomNumber === r.roomNumber) {
        return {
          hasConflict: true,
          message: `কক্ষ দ্বন্দ্ব! রুম নং "${r.roomNumber}" এই পিরিয়ডে শ্রেণি "${r.classLevel}" ব্যবহার করছে।`
        };
      }
    }

    return { hasConflict: false };
  }

  saveRoutineItem(item: ClassRoutineItem): { success: boolean; conflictError?: string } {
    const conflict = this.checkRoutineConflict(item, item.id);
    if (conflict.hasConflict) {
      return { success: false, conflictError: conflict.message };
    }

    const list = this.getRoutines();
    const existingIndex = list.findIndex(r => r.id === item.id);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      list[existingIndex] = { ...item, updatedAt: now };
    } else {
      const newItem: ClassRoutineItem = {
        ...item,
        id: item.id || `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now
      };
      list.push(newItem);
    }

    this.saveRoutines(list);
    return { success: true };
  }

  deleteRoutineItem(id: string): void {
    const list = this.getRoutines().filter(r => r.id !== id);
    this.saveRoutines(list);
  }

  // -------------------------------------------------------------
  // SYLLABUS & LESSON PLANNING
  // -------------------------------------------------------------
  getSyllabusItems(): SyllabusItem[] {
    try {
      const raw = localStorage.getItem(SYLLABUS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading syllabus:', e);
    }
    this.saveSyllabusItems(INITIAL_SYLLABUS_ITEMS);
    return INITIAL_SYLLABUS_ITEMS;
  }

  saveSyllabusItems(items: SyllabusItem[]): void {
    try {
      localStorage.setItem(SYLLABUS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error saving syllabus:', e);
    }
  }

  getSyllabusByClassAndSubject(classLevel: string, subjectId?: string, termName?: string): SyllabusItem[] {
    const list = this.getSyllabusItems();
    return list.filter(item => {
      if (item.classLevel !== classLevel) return false;
      if (subjectId && subjectId !== 'ALL' && item.subjectId !== subjectId) return false;
      if (termName && termName !== 'ALL' && item.termName !== termName) return false;
      return true;
    });
  }

  saveSyllabusItem(item: SyllabusItem): SyllabusItem {
    const list = this.getSyllabusItems();
    const index = list.findIndex(s => s.id === item.id);
    const now = new Date().toISOString();
    let saved: SyllabusItem;

    if (index >= 0) {
      saved = { ...item, updatedAt: now };
      list[index] = saved;
    } else {
      saved = {
        ...item,
        id: item.id || `syl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now
      };
      list.push(saved);
    }

    this.saveSyllabusItems(list);
    return saved;
  }

  updateLessonProgress(id: string, completedPeriods: number, status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'): void {
    const list = this.getSyllabusItems();
    const item = list.find(s => s.id === id);
    if (item) {
      item.completedPeriods = completedPeriods;
      item.status = status;
      item.updatedAt = new Date().toISOString();
      this.saveSyllabusItems(list);
    }
  }

  deleteSyllabusItem(id: string): void {
    const list = this.getSyllabusItems().filter(s => s.id !== id);
    this.saveSyllabusItems(list);
  }

  // -------------------------------------------------------------
  // ACADEMIC CALENDAR & EVENTS
  // -------------------------------------------------------------
  getCalendarEvents(): AcademicCalendarEvent[] {
    try {
      const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading calendar:', e);
    }
    this.saveCalendarEvents(INITIAL_CALENDAR_EVENTS);
    return INITIAL_CALENDAR_EVENTS;
  }

  saveCalendarEvents(events: AcademicCalendarEvent[]): void {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error('Error saving calendar:', e);
    }
  }

  saveCalendarEvent(event: AcademicCalendarEvent): AcademicCalendarEvent {
    const list = this.getCalendarEvents();
    const index = list.findIndex(e => e.id === event.id);
    const now = new Date().toISOString();
    let saved: AcademicCalendarEvent;

    if (index >= 0) {
      saved = { ...event, updatedAt: now };
      list[index] = saved;
    } else {
      saved = {
        ...event,
        id: event.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now
      };
      list.push(saved);
    }

    this.saveCalendarEvents(list);
    return saved;
  }

  deleteCalendarEvent(id: string): void {
    const list = this.getCalendarEvents().filter(e => e.id !== id);
    this.saveCalendarEvents(list);
  }
}

export const academicScheduleService = new AcademicScheduleService();
