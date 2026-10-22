import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { dailyAttendanceService, DailyStudentAttendanceRecord, AttendanceStatus } from '../services/dailyAttendanceService';
import { calculateClassDuesSummary, calculateSingleStudentDue, getDueReminderMessage, StudentDueProfile } from '../services/studentDuesService';
import { Student, MarkRecord, Exam, Subject } from '../types';
import {
  Home,
  CheckSquare,
  PenTool,
  Users,
  Wallet,
  Receipt,
  FileSpreadsheet,
  Bell,
  ChevronRight,
  Calendar,
  Award,
  CreditCard,
  LogOut,
  CheckCircle2,
  FileText,
  GraduationCap,
  ArrowLeft,
  X,
  Phone,
  Search,
  MessageCircle,
  Copy,
  Check,
  Send,
  Save,
  DollarSign,
  User,
  TrendingUp,
  ClipboardList,
  Sparkles
} from 'lucide-react';

/**
 * StaffMobileApp — Tutor App-style premium mobile experience for staff roles
 * (teacher / accountant-cashier / office staff / guardian).
 *
 * Design tokens copied from the Tutor App:
 *  page #f4f6fb · card #ffffff · ink #1e2433 · line #e8ecf4
 *  accent violet #8b5cf6 → #7c3aed · soft violet #ede9fe
 *  success #10b981 · warning #f59e0b · danger #ef4444 · info #3b82f6
 *  dark: page #0e1220 · card #161c2e
 *
 * Data logic (role detection, class-teacher scoping, dues, attendance,
 * marks) is ported from the previous MobileRoleAppView so behaviour and
 * saved data stay identical — only the presentation is new.
 */

interface StaffMobileAppProps {
  onLogout?: () => void;
  renderModuleContent?: (moduleKey: string) => React.ReactNode;
}

const cardCls = 'bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/5 rounded-[24px] shadow-[0_2px_12px_rgba(30,36,51,0.05)]';
const softBg = 'bg-[#f4f6fb] dark:bg-white/5';

export const StaffMobileApp: React.FC<StaffMobileAppProps> = ({ onLogout, renderModuleContent }) => {
  const {
    authUser,
    currentMember,
    currentUser,
    schoolProfile,
    students = [],
    classes = [],
    subjects = [],
    marks = [],
    exams = [],
    transactions = [],
    feeStructures = [],
    notices = [],
    bulkUpdateMarks,
    language,
    logoutAdmin,
    setActiveTab,
  } = useApp();

  // 1. Determine current active role
  const userRole = useMemo<'teacher' | 'cashier' | 'parent' | 'staff'>(() => {
    const roleId = currentMember?.roleId || currentUser?.role || '';
    if (roleId === 'role_accountant' || roleId === 'accountant') return 'cashier';
    if (roleId === 'role_guardian' || roleId === 'guardian' || roleId === 'parent') return 'parent';
    if (roleId === 'role_staff' || roleId === 'staff') return 'staff';
    return 'teacher'; // Default role for standard instructors
  }, [currentMember, currentUser]);

  const [activeBottomNav, setActiveBottomNav] = useState<string>('home');
  const [activeSubModule, setActiveSubModule] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Helper for Bengali number formatting
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      '.': '.'
    };
    return str.split('').map(c => banglaNums[c] || c).join('');
  };

  // 2. Class Scope Isolation for Teacher — only the classes they are assigned to
  const teacherClasses = useMemo(() => {
    const assigned = currentMember?.assignedClasses || currentUser?.assignedClasses || [];
    if (assigned.length > 0) return assigned;
    return classes.length > 0 ? [classes[0].name] : ['Class 1'];
  }, [currentMember, currentUser, classes]);

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    return teacherClasses[0] || (classes[0]?.name || 'Class 1');
  });

  useEffect(() => {
    if (teacherClasses.length > 0 && !teacherClasses.includes(selectedClass)) {
      setSelectedClass(teacherClasses[0]);
    }
  }, [teacherClasses, selectedClass]);

  // Students isolated to the selected assigned class (teacher) / all active (others)
  const classStudents = useMemo(() => {
    if (userRole === 'teacher') {
      return students.filter(s => s.status === 'Active' && !s.isFormer && s.classLevel === selectedClass);
    }
    return students.filter(s => s.status === 'Active' && !s.isFormer);
  }, [students, selectedClass, userRole]);

  // Dues Summary for the teacher's class
  const classDuesSummary = useMemo(() => {
    return calculateClassDuesSummary(classStudents, feeStructures, transactions);
  }, [classStudents, feeStructures, transactions]);

  // All-students dues (accountant)
  const allDuesSummary = useMemo(() => {
    if (userRole === 'teacher') return classDuesSummary;
    const active = students.filter(s => s.status === 'Active' && !s.isFormer);
    return calculateClassDuesSummary(active, feeStructures, transactions);
  }, [userRole, classDuesSummary, students, feeStructures, transactions]);

  // 3. Daily Attendance state
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [studentAttendanceMap, setStudentAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    const savedRecords = dailyAttendanceService.getRecordsByDateAndClass(attendanceDate, selectedClass);
    const map: Record<string, AttendanceStatus> = {};
    savedRecords.forEach(r => {
      map[r.studentId] = r.status;
    });
    setStudentAttendanceMap(map);
  }, [attendanceDate, selectedClass]);

  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    const total = classStudents.length;

    classStudents.forEach(st => {
      const status = studentAttendanceMap[st.id] || studentAttendanceMap[st.studentId || ''];
      if (status === 'PRESENT') present++;
      else if (status === 'ABSENT') absent++;
      else if (status === 'LATE') late++;
      else if (status === 'LEAVE') leave++;
    });

    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const takenCount = present + absent + late + leave;

    return { total, present, absent, late, leave, attended, rate, takenCount };
  }, [classStudents, studentAttendanceMap]);

  const handleMarkAllPresent = () => {
    const nextMap: Record<string, AttendanceStatus> = { ...studentAttendanceMap };
    classStudents.forEach(st => {
      nextMap[st.id] = 'PRESENT';
    });
    setStudentAttendanceMap(nextMap);
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveAttendance = () => {
    const records: DailyStudentAttendanceRecord[] = classStudents.map(st => {
      const status = studentAttendanceMap[st.id] || 'PRESENT';
      return {
        id: `${attendanceDate}_${st.id}`,
        date: attendanceDate,
        studentId: st.id,
        studentName: st.nameBn || st.name,
        roll: st.roll || st.rollNumber || '',
        classLevel: st.classLevel,
        status,
        updatedAt: new Date().toISOString()
      };
    });

    dailyAttendanceService.batchSaveStudentAttendance(records);
    setSaveSuccessNotice('✓ হাজিরা সফলভাবে সংরক্ষিত হয়েছে!');
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  // 4. Marks Entry state (teacher)
  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const classSubjects = useMemo(() => {
    return subjects.filter(sub => sub.classLevel === selectedClass || sub.classId === selectedClass);
  }, [subjects, selectedClass]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => classSubjects[0]?.id || '');

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  const [marksInputMap, setMarksInputMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedExamId || !selectedSubjectId) return;
    const initialMap: Record<string, string> = {};
    classStudents.forEach(st => {
      const existing = marks.find(m => m.studentId === st.id && m.subjectId === selectedSubjectId && m.examId === selectedExamId);
      if (existing) {
        initialMap[st.id] = String(existing.obtained ?? (existing as any).marksObtained ?? '');
      }
    });
    setMarksInputMap(initialMap);
  }, [selectedExamId, selectedSubjectId, classStudents, marks]);

  const handleSaveMarks = () => {
    if (!selectedExamId || !selectedSubjectId) return;
    const markRecordsToUpdate: (Omit<MarkRecord, 'id'> & { id?: string })[] = [];

    classStudents.forEach(st => {
      const val = marksInputMap[st.id];
      if (val !== undefined && val !== '') {
        const numVal = Math.min(100, Math.max(0, Number(val) || 0));
        const existing = marks.find(m => m.studentId === st.id && m.subjectId === selectedSubjectId && m.examId === selectedExamId);
        markRecordsToUpdate.push({
          id: existing?.id,
          studentId: st.id,
          subjectId: selectedSubjectId,
          examId: selectedExamId,
          obtained: numVal,
          total: 100,
          grade: numVal >= 80 ? 'A+' : numVal >= 70 ? 'A' : numVal >= 60 ? 'A-' : numVal >= 50 ? 'B' : numVal >= 40 ? 'C' : numVal >= 33 ? 'D' : 'F',
          gradePoint: numVal >= 80 ? 5 : numVal >= 70 ? 4 : numVal >= 60 ? 3.5 : numVal >= 50 ? 3 : numVal >= 40 ? 2 : numVal >= 33 ? 1 : 0
        });
      }
    });

    if (markRecordsToUpdate.length > 0) {
      bulkUpdateMarks(markRecordsToUpdate);
      setSaveSuccessNotice('✓ নম্বর সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    }
  };

  // 5. Greeting helper
  const todayGreeting = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = 'শুভ দিন';
    if (hour < 12) greet = 'শুভ সকাল';
    else if (hour < 16) greet = 'শুভ দুপুর';
    else if (hour < 19) greet = 'শুভ বিকেল';
    else greet = 'শুভ রাত্রি';

    const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const monthNames = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

    const day = dayNames[now.getDay()];
    const dateNum = toBn(now.getDate());
    const month = monthNames[now.getMonth()];
    const year = toBn(now.getFullYear());

    return { greeting: greet, fullDateText: `${day}, ${dateNum} ${month} ${year}` };
  }, [language]);

  // Cashier figures
  const cashierFigures = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todays = transactions.filter(t => t.type === 'INCOME' && (t.date?.startsWith(todayStr)));
    const todayIncome = todays.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const recent = [...transactions]
      .filter(t => t.type === 'INCOME')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 5);
    return { todayIncome, todayReceipts: todays.length, recent };
  }, [transactions]);

  // 6. Role KPI stats
  const roleStats = useMemo(() => {
    if (userRole === 'teacher') {
      return {
        stat1Value: toBn(teacherClasses.length) + 'টি', stat1Label: 'আমার ক্লাস', stat1Icon: GraduationCap, stat1Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat2Value: toBn(classStudents.length) + ' জন', stat2Label: 'শ্রেণির শিক্ষার্থী', stat2Icon: Users, stat2Cls: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300',
        stat3Value: '৳' + toBn(classDuesSummary.totalDue.toLocaleString()), stat3Label: 'শ্রেণির বকেয়া', stat3Icon: Wallet, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'আজকের কাজ',
        nextTaskDesc: `${selectedClass} — দৈনিক হাজিরা গ্রহণ ও বকেয়া ফি পর্যবেক্ষণ`
      };
    } else if (userRole === 'cashier') {
      return {
        stat1Value: '৳' + toBn(cashierFigures.todayIncome.toLocaleString()), stat1Label: 'আজকের আদায়', stat1Icon: Wallet, stat1Cls: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300',
        stat2Value: toBn(cashierFigures.todayReceipts) + 'টি', stat2Label: 'আজকের রসিদ', stat2Icon: Receipt, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat3Value: '৳' + toBn(allDuesSummary.totalDue.toLocaleString()), stat3Label: 'মোট বকেয়া', stat3Icon: TrendingUp, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'ক্যাশিয়ার ডেস্ক',
        nextTaskDesc: 'চলতি মাসের বেতন আদায় ও ফি রসিদ তৈরি'
      };
    } else if (userRole === 'parent') {
      return {
        stat1Value: attendanceStats.rate > 0 ? `${toBn(attendanceStats.rate)}%` : 'নিয়মিত', stat1Label: 'হাজিরা রেকর্ড', stat1Icon: CheckSquare, stat1Cls: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300',
        stat2Value: exams.length > 0 ? (exams[0].name || 'পরীক্ষা') : 'সাময়িক', stat2Label: 'চলমান পরীক্ষা', stat2Icon: Award, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
        stat3Value: '৳' + toBn(classDuesSummary.totalDue.toLocaleString()), stat3Label: 'বকেয়া ফি', stat3Icon: Wallet, stat3Cls: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300',
        nextTaskTime: 'অভিভাবক ডায়েরি',
        nextTaskDesc: 'সন্তানের লেখাপড়া ও মাদরাসা নোটিশ'
      };
    }
    return {
      stat1Value: toBn(students.filter(s => s.status === 'Active').length) + ' জন', stat1Label: 'মোট শিক্ষার্থী', stat1Icon: Users, stat1Cls: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300',
      stat2Value: toBn(classes.length) + 'টি', stat2Label: 'মোট শ্রেণি', stat2Icon: GraduationCap, stat2Cls: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300',
      stat3Value: toBn(notices.length) + 'টি', stat3Label: 'সক্রিয় নোটিশ', stat3Icon: Bell, stat3Cls: 'bg-[#fef3c7] text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300',
      nextTaskTime: 'অফিস প্রশাসন',
      nextTaskDesc: 'শিক্ষার্থী তথ্য যাচাই ও সনদপত্র প্রিন্ট'
    };
  }, [userRole, teacherClasses, classStudents, classDuesSummary, allDuesSummary, cashierFigures, students, exams, notices, selectedClass, attendanceStats]);

  const roleBadges = useMemo(() => {
    if (userRole === 'teacher') {
      return ['শ্রেণি শিক্ষক', selectedClass, `${toBn(classStudents.length)} জন শিক্ষার্থী`];
    }
    if (userRole === 'cashier') return ['হিসাবরক্ষক / ক্যাশিয়ার', 'ফি ও ক্যাশ শাখা', 'রসিদ ইনচার্জ'];
    if (userRole === 'parent') return ['অভিভাবক পোর্টাল', 'সন্তানের তথ্য'];
    return ['অফিস স্টাফ', 'ভর্তি ও প্রশাসন', 'সার্টিফিকেট শাখা'];
  }, [userRole, selectedClass, classStudents]);

  const roleTitleBengali: Record<string, string> = {
    teacher: 'শিক্ষক পোর্টাল',
    cashier: 'হিসাবরক্ষক পোর্টাল',
    parent: 'অভিভাবক পোর্টাল',
    staff: 'অফিস স্টাফ পোর্টাল'
  };

  // Quick Actions per Role
  const roleActions = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        { id: 'attendance', title: 'দৈনিক হাজিরা গ্রহণ', subtitle: `${selectedClass}-এর উপস্থিতি নিন — এক ক্লিকে সবাই উপস্থিত`, icon: CheckSquare, moduleKey: 'teacher_attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'students_dues', title: 'আমার ক্লাসের ছাত্র ও বকেয়া', subtitle: 'ছাত্র তালিকা, অভিভাবকের মোবাইল ও কার কত বাকি', icon: Users, moduleKey: 'teacher_students_dues', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' },
        { id: 'marks', title: 'পরীক্ষার নম্বর এন্ট্রি', subtitle: `${selectedClass}-এর বিষয়ভিত্তিক নম্বর এন্ট্রি`, icon: PenTool, moduleKey: 'teacher_marks', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'notices', title: 'মাদরাসা নোটিশ বোর্ড', subtitle: 'জরুরি সার্কুলার ও প্রাতিষ্ঠানিক নির্দেশনা', icon: Bell, moduleKey: 'teacher_notices', chip: 'bg-[#fef3c7] text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300' }
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'finance_collect', title: 'ফি আদায় ও রসিদ', subtitle: 'বেতন, ভর্তি ফি ও বকেয়া সংগ্রহ করে রসিদ দিন', icon: Wallet, moduleKey: 'finance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance_expense', title: 'দৈনিক খরচ এন্ট্রি', subtitle: 'মাদরাসার প্রতিদিনের ব্যয়ের ভাউচার যুক্ত করুন', icon: Receipt, moduleKey: 'finance', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'students', title: 'ছাত্র তালিকা ও বকেয়া খতিয়ান', subtitle: 'সকল ক্লাসের বকেয়া ও অভিভাবকের মোবাইল', icon: Users, moduleKey: 'students', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' },
        { id: 'finance_reports', title: 'আর্থিক রিপোর্ট', subtitle: 'দৈনিক ও মাসিক ক্যাশ জমার বিবরণী', icon: FileSpreadsheet, moduleKey: 'finance_reports', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' }
      ];
    } else if (userRole === 'parent') {
      return [
        { id: 'results', title: 'পরীক্ষার ফলাফল ও মার্কশিট', subtitle: 'সন্তানের জিপিএ, গ্রেড ও বিষয়ভিত্তিক নম্বর', icon: Award, moduleKey: 'results', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
        { id: 'attendance', title: 'দৈনিক উপস্থিতি ট্র্যাকার', subtitle: 'প্রতিদিনের উপস্থিতি ও ছুটির রেকর্ড', icon: CheckSquare, moduleKey: 'attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
        { id: 'finance', title: 'বেতন ও ফি বিবরণী', subtitle: 'পরিশোধিত ফি এবং বর্তমান বকেয়া', icon: Wallet, moduleKey: 'finance', chip: 'bg-[#fee2e2] text-[#dc2626] dark:bg-rose-500/15 dark:text-rose-300' },
        { id: 'notices', title: 'মাদরাসার নোটিশ ও ডায়রি', subtitle: 'ছুটির ঘোষণা ও গুরুত্বপূর্ণ নোটিশ', icon: Bell, moduleKey: 'notice_board', chip: 'bg-[#fef3c7] text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300' }
      ];
    }
    return [
      { id: 'students', title: 'নতুন শিক্ষার্থী ভর্তি ও তালিকা', subtitle: 'ভর্তি ফরম, এন্ট্রি ও তথ্য আপডেট', icon: Users, moduleKey: 'students', chip: 'bg-[#dbeafe] text-[#2563eb] dark:bg-blue-500/15 dark:text-blue-300' },
      { id: 'id_cards', title: 'আইডি কার্ড ও সনদপত্র', subtitle: 'আইডি কার্ড, প্রশংসাপত্র ও প্রত্যয়নপত্র তৈরি', icon: CreditCard, moduleKey: 'student_id_cards', chip: 'bg-[#ede9fe] text-[#6d28d9] dark:bg-violet-500/15 dark:text-violet-300' },
      { id: 'attendance', title: 'হাজিরা শিট ও রেজিস্টার', subtitle: 'দৈনিক হাজিরা এন্ট্রি ও প্রিন্ট কপি', icon: CheckSquare, moduleKey: 'attendance', chip: 'bg-[#d1fae5] text-[#059669] dark:bg-emerald-500/15 dark:text-emerald-300' },
      { id: 'notices', title: 'নোটিশ বোর্ড ম্যানেজমেন্ট', subtitle: 'নোটিশ ও সার্কুলার প্রকাশ', icon: Bell, moduleKey: 'notice_board', chip: 'bg-[#fef3c7] text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300' }
    ];
  }, [userRole, selectedClass]);

  // Bottom Nav items per Role (+ Profile)
  const bottomNavItems = useMemo(() => {
    const profile = { id: 'profile', label: 'প্রোফাইল', icon: User, targetModule: null as string | null };
    if (userRole === 'teacher') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'হাজিরা', icon: CheckSquare, targetModule: 'teacher_attendance' as string | null },
        { id: 'action2', label: 'বকেয়া', icon: DollarSign, targetModule: 'teacher_students_dues' as string | null },
        { id: 'action3', label: 'নম্বর', icon: PenTool, targetModule: 'teacher_marks' as string | null },
        profile
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'ফি আদায়', icon: Wallet, targetModule: 'finance' as string | null },
        { id: 'action2', label: 'রিপোর্ট', icon: FileSpreadsheet, targetModule: 'finance_reports' as string | null },
        { id: 'action3', label: 'ছাত্র', icon: Users, targetModule: 'students' as string | null },
        profile
      ];
    } else if (userRole === 'parent') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
        { id: 'action1', label: 'ফলাফল', icon: Award, targetModule: 'results' as string | null },
        { id: 'action2', label: 'হাজিরা', icon: CheckSquare, targetModule: 'attendance' as string | null },
        { id: 'action3', label: 'ফি', icon: Wallet, targetModule: 'finance' as string | null },
        profile
      ];
    }
    return [
      { id: 'home', label: 'হোম', icon: Home, targetModule: null as string | null },
      { id: 'action1', label: 'ছাত্র', icon: Users, targetModule: 'students' as string | null },
      { id: 'action2', label: 'আইডি কার্ড', icon: CreditCard, targetModule: 'student_id_cards' as string | null },
      { id: 'action3', label: 'নোটিশ', icon: Bell, targetModule: 'notice_board' as string | null },
      profile
    ];
  }, [userRole]);

  const NATIVE_MODULES = ['teacher_attendance', 'teacher_students_dues', 'teacher_marks', 'teacher_notices'];

  const handleOpenModule = (moduleKey: string) => {
    // For shared desktop modules, switch the app tab first so the
    // passthrough renders the right module (the old view missed this).
    if (!NATIVE_MODULES.includes(moduleKey) && setActiveTab) {
      setActiveTab(moduleKey as any);
    }
    setShowProfile(false);
    setActiveSubModule(moduleKey);
  };

  const handleBottomNavClick = (nav: typeof bottomNavItems[0]) => {
    setActiveBottomNav(nav.id);
    if (nav.id === 'profile') {
      setActiveSubModule(null);
      setShowProfile(true);
      return;
    }
    setShowProfile(false);
    if (nav.targetModule) {
      handleOpenModule(nav.targetModule);
    } else {
      setActiveSubModule(null);
    }
  };

  const goHome = () => {
    setActiveSubModule(null);
    setShowProfile(false);
    setActiveBottomNav('home');
  };

  const displayName = authUser?.displayName || currentMember?.displayName || currentUser?.name || 'সম্মানিত ব্যবহারকারী';
  const initialLetter = (displayName || 'উ')[0].toUpperCase();

  // Search & Filter state for Students & Dues module
  const [duesSearchQuery, setDuesSearchQuery] = useState('');
  const [duesFilterMode, setDuesFilterMode] = useState<'ALL' | 'DUE_ONLY' | 'PAID_ONLY'>('ALL');

  const filteredDuesProfiles = useMemo(() => {
    return classDuesSummary.profiles.filter(p => {
      if (duesFilterMode === 'DUE_ONLY' && p.dueThisMonth <= 0) return false;
      if (duesFilterMode === 'PAID_ONLY' && p.dueThisMonth > 0) return false;

      if (!duesSearchQuery.trim()) return true;
      const q = duesSearchQuery.toLowerCase().trim();
      const st = p.student;
      return (
        (st.name && st.name.toLowerCase().includes(q)) ||
        (st.nameBn && st.nameBn.includes(q)) ||
        (st.roll && String(st.roll).includes(q)) ||
        (st.rollNumber && String(st.rollNumber).includes(q)) ||
        (st.guardianPhone && String(st.guardianPhone).includes(q))
      );
    });
  }, [classDuesSummary, duesSearchQuery, duesFilterMode]);

  // Copy SMS text handler
  const handleCopySms = (profile: StudentDueProfile) => {
    const text = getDueReminderMessage(
      profile.student.nameBn || profile.student.name,
      profile.classLevel,
      profile.dueThisMonth,
      schoolProfile.nameBn || schoolProfile.name
    );
    navigator.clipboard.writeText(text);
    setCopiedStudentId(profile.student.id);
    setTimeout(() => setCopiedStudentId(null), 2500);
  };

  const whatsappLink = (profile: StudentDueProfile) => {
    const phone = String(profile.student.guardianPhone || '').replace(/[^0-9]/g, '');
    if (!phone) return null;
    const intl = phone.startsWith('880') ? phone : '880' + phone.replace(/^0/, '');
    const text = getDueReminderMessage(
      profile.student.nameBn || profile.student.name,
      profile.classLevel,
      profile.dueThisMonth,
      schoolProfile.nameBn || schoolProfile.name
    );
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  // -------------------------------------------------------------
  // Shared chrome
  // -------------------------------------------------------------
  const BottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-t border-[#e8ecf4] dark:border-white/5 shadow-[0_-4px_24px_rgba(30,36,51,0.06)]">
      <div className="grid grid-cols-5 h-[68px] px-1">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const isActive =
            (item.id === 'home' && !activeSubModule && !showProfile) ||
            (item.id === 'profile' && showProfile) ||
            (item.targetModule !== null && item.targetModule === activeSubModule);
          return (
            <button
              key={item.id}
              onClick={() => handleBottomNavClick(item)}
              className="relative flex flex-col items-center justify-center gap-1 min-h-[56px] cursor-pointer"
            >
              <Icon size={21} className={isActive ? 'text-[#7c3aed] dark:text-violet-300' : 'text-[#8a93a8] dark:text-slate-500'} />
              <span className={`text-[11px] leading-none ${isActive ? 'font-bold text-[#7c3aed] dark:text-violet-300' : 'font-medium text-[#8a93a8] dark:text-slate-500'}`}>
                {item.label}
              </span>
              <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-[#7c3aed] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );

  const successToast = saveSuccessNotice && (
    <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-[#065f46] dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
      <CheckCircle2 size={16} className="text-[#059669] shrink-0" />
      <span>{saveSuccessNotice}</span>
    </div>
  );

  const classSwitcher = teacherClasses.length > 1 && (
    <div className="flex flex-wrap gap-1.5">
      {teacherClasses.map(clsName => (
        <button
          key={clsName}
          onClick={() => setSelectedClass(clsName)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            selectedClass === clsName
              ? 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white shadow-md shadow-violet-500/25'
              : 'bg-[#f4f6fb] dark:bg-white/5 text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
          }`}
        >
          {clsName}
        </button>
      ))}
    </div>
  );

  // -------------------------------------------------------------
  // SUB-MODULE SCREENS
  // -------------------------------------------------------------
  if (activeSubModule) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
        {/* Sticky header */}
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-b border-[#e8ecf4] dark:border-white/5 px-4 py-3 flex items-center justify-between">
          <button
            onClick={goHome}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[#1e2433] dark:text-slate-200 text-xs font-bold cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft size={15} />
            <span>হোম</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-[#1e2433] dark:text-white truncate max-w-[180px]">
              {userRole === 'teacher' ? selectedClass : roleTitleBengali[userRole]}
            </span>
            <span className="text-[10px] text-[#8a93a8]">{schoolProfile.nameBn || schoolProfile.name}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/25">
            {initialLetter}
          </div>
        </header>

        {successToast}

        <main className="flex-1 p-4 space-y-4">

          {/* ============ TEACHER: DAILY ATTENDANCE ============ */}
          {activeSubModule === 'teacher_attendance' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                      <CheckSquare size={17} />
                    </span>
                    <h2 className="text-sm font-bold">দৈনিক হাজিরা গ্রহণ</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 font-bold">
                    {selectedClass}
                  </span>
                </div>

                {classSwitcher}

                <div className="flex items-center gap-2">
                  <div className={`flex-1 flex items-center gap-2 ${softBg} border border-[#e8ecf4] dark:border-white/10 rounded-2xl px-3 py-2.5`}>
                    <Calendar size={15} className="text-[#8a93a8]" />
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={e => setAttendanceDate(e.target.value)}
                      className="bg-transparent text-xs font-semibold focus:outline-none w-full dark:[color-scheme:dark]"
                    />
                  </div>
                  <button
                    onClick={handleMarkAllPresent}
                    className="px-3.5 py-2.5 rounded-2xl bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>সবাই উপস্থিত</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  <div className={`${softBg} p-2.5 rounded-2xl`}>
                    <span className="text-[11px] font-semibold text-[#5b6478] dark:text-slate-400 block">মোট</span>
                    <span className="text-base font-black">{toBn(attendanceStats.total)}</span>
                  </div>
                  <div className="bg-[#d1fae5] dark:bg-emerald-500/10 p-2.5 rounded-2xl">
                    <span className="text-[11px] font-semibold text-[#059669] block">উপস্থিত</span>
                    <span className="text-base font-black text-[#059669] dark:text-emerald-300">{toBn(attendanceStats.present)}</span>
                  </div>
                  <div className="bg-[#fee2e2] dark:bg-rose-500/10 p-2.5 rounded-2xl">
                    <span className="text-[11px] font-semibold text-[#dc2626] block">অনুপস্থিত</span>
                    <span className="text-base font-black text-[#dc2626] dark:text-rose-300">{toBn(attendanceStats.absent)}</span>
                  </div>
                  <div className="bg-[#fef3c7] dark:bg-amber-500/10 p-2.5 rounded-2xl">
                    <span className="text-[11px] font-semibold text-[#d97706] block">হার</span>
                    <span className="text-base font-black text-[#d97706] dark:text-amber-300">{toBn(attendanceStats.rate)}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#5b6478] dark:text-slate-400">শিক্ষার্থী ({toBn(classStudents.length)} জন)</span>
                  <span className="text-[11px] text-[#8a93a8]">বাটনে ট্যাপ করে হাজিরা দিন</span>
                </div>

                {classStudents.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <Users size={32} className="mx-auto text-[#c3c9d9]" />
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">{selectedClass}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
                  </div>
                ) : (
                  classStudents.map(st => {
                    const currentStatus: AttendanceStatus = (studentAttendanceMap[st.id] as AttendanceStatus) || 'PRESENT';
                    const stBtn = (status: AttendanceStatus, label: string, activeCls: string) => (
                      <button
                        type="button"
                        onClick={() => handleSetStudentStatus(st.id, status)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentStatus === status ? activeCls : 'bg-[#f4f6fb] dark:bg-white/5 text-[#8a93a8] dark:text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                    return (
                      <div key={st.id} className={`${cardCls} p-3.5 flex flex-col gap-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                              {(st.nameBn || st.name || 'শ').charAt(0)}
                            </span>
                            <div>
                              <h3 className="text-[13px] font-bold leading-tight">{st.nameBn || st.name}</h3>
                              <p className="text-[11px] text-[#8a93a8]">রোল: {toBn(st.roll || st.rollNumber || '—')} • পিতা: {st.fatherNameBn || st.fatherName || '—'}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                            currentStatus === 'PRESENT' ? 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300' :
                            currentStatus === 'ABSENT' ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300' :
                            currentStatus === 'LATE' ? 'bg-[#fef3c7] text-[#92400e] dark:bg-amber-500/15 dark:text-amber-300' :
                            'bg-[#dbeafe] text-[#1e40af] dark:bg-blue-500/15 dark:text-blue-300'
                          }`}>
                            {currentStatus === 'PRESENT' ? 'উপস্থিত' : currentStatus === 'ABSENT' ? 'অনুপস্থিত' : currentStatus === 'LATE' ? 'দেরি' : 'ছুটি'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {stBtn('PRESENT', 'উপস্থিত', 'bg-[#10b981] text-white shadow-md shadow-emerald-500/25')}
                          {stBtn('ABSENT', 'অনুপস্থিত', 'bg-[#ef4444] text-white shadow-md shadow-rose-500/25')}
                          {stBtn('LATE', 'দেরি', 'bg-[#f59e0b] text-white shadow-md shadow-amber-500/25')}
                          {stBtn('LEAVE', 'ছুটি', 'bg-[#3b82f6] text-white shadow-md shadow-blue-500/25')}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {classStudents.length > 0 && (
                <div className="sticky bottom-[84px] z-30 pt-1">
                  <button
                    onClick={handleSaveAttendance}
                    className="w-full py-3.5 px-4 rounded-[20px] bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={17} />
                    <span>হাজিরা সংরক্ষণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ TEACHER: STUDENTS & DUES ============ */}
          {activeSubModule === 'teacher_students_dues' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#fee2e2] dark:bg-rose-500/15 text-[#dc2626] dark:text-rose-300 flex items-center justify-center">
                      <DollarSign size={17} />
                    </span>
                    <h2 className="text-sm font-bold">শ্রেণির বকেয়া খতিয়ান</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 font-bold">{selectedClass}</span>
                </div>

                {classSwitcher}

                <div className="grid grid-cols-2 gap-2">
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">মোট শিক্ষার্থী</span>
                    <span className="text-lg font-black">{toBn(classDuesSummary.totalStudents)} জন</span>
                  </div>
                  <div className="bg-[#fee2e2] dark:bg-rose-500/10 p-3 rounded-2xl">
                    <span className="text-[11px] text-[#dc2626] font-medium block">মোট বকেয়া ফি</span>
                    <span className="text-lg font-black text-[#dc2626] dark:text-rose-300">৳{toBn(classDuesSummary.totalDue.toLocaleString())}</span>
                  </div>
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">বকেয়া রয়েছে</span>
                    <span className="text-sm font-bold text-[#dc2626] dark:text-rose-300">{toBn(classDuesSummary.dueStudentsCount)} জন</span>
                  </div>
                  <div className={`${softBg} p-3 rounded-2xl`}>
                    <span className="text-[11px] text-[#5b6478] dark:text-slate-400 font-medium block">পরিশোধিত</span>
                    <span className="text-sm font-bold text-[#059669] dark:text-emerald-300">{toBn(classDuesSummary.paidStudentsCount)} জন</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a93a8]" />
                  <input
                    type="text"
                    value={duesSearchQuery}
                    onChange={e => setDuesSearchQuery(e.target.value)}
                    placeholder="রোল, নাম বা মোবাইল দিয়ে খুঁজুন..."
                    className="w-full pl-10 pr-3 py-3 bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-xs font-medium placeholder:text-[#8a93a8] focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {([
                    ['ALL', `সবাই (${toBn(classDuesSummary.totalStudents)})`],
                    ['DUE_ONLY', `শুধু বকেয়া (${toBn(classDuesSummary.dueStudentsCount)})`],
                    ['PAID_ONLY', `পরিশোধিত (${toBn(classDuesSummary.paidStudentsCount)})`]
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setDuesFilterMode(mode)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        duesFilterMode === mode
                          ? 'bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white shadow-md shadow-violet-500/25'
                          : 'bg-white dark:bg-[#161c2e] text-[#5b6478] dark:text-slate-300 border border-[#e8ecf4] dark:border-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredDuesProfiles.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center space-y-2`}>
                    <CheckCircle2 size={32} className="mx-auto text-[#10b981]" />
                    <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</p>
                  </div>
                ) : (
                  filteredDuesProfiles.map(p => {
                    const st = p.student;
                    const hasDue = p.dueThisMonth > 0;
                    const phone = st.guardianPhone;
                    const wa = hasDue ? whatsappLink(p) : null;
                    return (
                      <div key={st.id} className={`${cardCls} p-4 flex flex-col gap-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                              {(st.nameBn || st.name || 'শ').charAt(0)}
                            </span>
                            <div>
                              <h3 className="text-[13px] font-bold leading-tight">{st.nameBn || st.name}</h3>
                              <p className="text-[11px] text-[#8a93a8]">রোল: {toBn(st.roll || st.rollNumber || '—')} • পিতা: {st.fatherNameBn || st.fatherName || '—'}</p>
                            </div>
                          </div>
                          <span className={`text-[11px] font-black px-2.5 py-1.5 rounded-xl shrink-0 ${
                            hasDue ? 'bg-[#fee2e2] text-[#991b1b] dark:bg-rose-500/15 dark:text-rose-300' : 'bg-[#d1fae5] text-[#065f46] dark:bg-emerald-500/15 dark:text-emerald-300'
                          }`}>
                            {hasDue ? `বকেয়া ৳${toBn(p.dueThisMonth.toLocaleString())}` : 'পরিশোধিত ✓'}
                          </span>
                        </div>

                        <div className={`grid grid-cols-2 gap-2 p-2.5 rounded-2xl ${softBg} text-[11px]`}>
                          <div>
                            <span className="text-[#8a93a8]">মাসিক ধার্য: </span>
                            <span className="font-bold">৳{toBn(p.monthlyExpected.toLocaleString())}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[#8a93a8]">পরিশোধিত: </span>
                            <span className="font-bold text-[#059669] dark:text-emerald-300">৳{toBn(p.paidThisMonth.toLocaleString())}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-[#5b6478] dark:text-slate-300 min-w-0">
                            <Phone size={13} className="text-[#7c3aed] shrink-0" />
                            <span className="font-semibold text-[11px] truncate">{phone ? toBn(phone) : 'ফোন নম্বর নেই'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {phone && (
                              <a href={`tel:${phone}`} className="px-2.5 py-1.5 rounded-xl bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 text-[11px] font-bold flex items-center gap-1">
                                <Phone size={11} /> কল
                              </a>
                            )}
                            {hasDue && wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-xl bg-[#10b981] text-white text-[11px] font-bold flex items-center gap-1 shadow-md shadow-emerald-500/25">
                                <MessageCircle size={11} /> WhatsApp
                              </a>
                            )}
                            {hasDue && (
                              <button
                                type="button"
                                onClick={() => handleCopySms(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                {copiedStudentId === st.id ? (<><Check size={11} /> কপি হয়েছে</>) : (<><Copy size={11} /> তাগাদা</>)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ============ TEACHER: MARKS ENTRY ============ */}
          {activeSubModule === 'teacher_marks' && (
            <div className="space-y-4">
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 flex items-center justify-center">
                      <PenTool size={17} />
                    </span>
                    <h2 className="text-sm font-bold">নম্বর এন্ট্রি</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 font-bold">{selectedClass}</span>
                </div>

                {classSwitcher}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1">পরীক্ষা</label>
                    <select
                      value={selectedExamId}
                      onChange={e => setSelectedExamId(e.target.value)}
                      className={`w-full ${softBg} border border-[#e8ecf4] dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 dark:[color-scheme:dark]`}
                    >
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#8a93a8] font-semibold block mb-1">বিষয়</label>
                    <select
                      value={selectedSubjectId}
                      onChange={e => setSelectedSubjectId(e.target.value)}
                      className={`w-full ${softBg} border border-[#e8ecf4] dark:border-white/10 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 dark:[color-scheme:dark]`}
                    >
                      {classSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.nameBn || s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#5b6478] dark:text-slate-400">শিক্ষার্থী ({toBn(classStudents.length)} জন)</span>
                  <span className="text-[11px] text-[#8a93a8]">পূর্ণমান: {toBn(100)}</span>
                </div>

                {classStudents.map(st => {
                  const currentVal = marksInputMap[st.id] ?? '';
                  const numVal = Number(currentVal);
                  const grade = currentVal !== ''
                    ? (numVal >= 80 ? 'A+' : numVal >= 70 ? 'A' : numVal >= 60 ? 'A-' : numVal >= 50 ? 'B' : numVal >= 40 ? 'C' : numVal >= 33 ? 'D' : 'F')
                    : '—';
                  return (
                    <div key={st.id} className={`${cardCls} p-3.5 flex items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-bold flex items-center justify-center text-sm shadow-md shadow-violet-500/20 shrink-0">
                          {(st.nameBn || st.name || 'শ').charAt(0)}
                        </span>
                        <div className="overflow-hidden">
                          <h3 className="text-[13px] font-bold truncate">{st.nameBn || st.name}</h3>
                          <span className="text-[11px] text-[#8a93a8]">
                            রোল {toBn(st.roll || st.rollNumber || '—')} • গ্রেড: <strong className={grade === 'F' ? 'text-[#dc2626]' : 'text-[#059669]'}>{grade}</strong>
                          </span>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        inputMode="numeric"
                        value={currentVal}
                        onChange={e => setMarksInputMap(prev => ({ ...prev, [st.id]: e.target.value }))}
                        placeholder="০"
                        className="w-[72px] py-2.5 px-2 bg-[#f4f6fb] dark:bg-white/5 border border-[#e8ecf4] dark:border-white/10 rounded-2xl text-center text-sm font-black focus:outline-none focus:ring-2 focus:ring-violet-400 shrink-0"
                      />
                    </div>
                  );
                })}
              </div>

              {classStudents.length > 0 && (
                <div className="sticky bottom-[84px] z-30 pt-1">
                  <button
                    onClick={handleSaveMarks}
                    className="w-full py-3.5 px-4 rounded-[20px] bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-violet-500/30 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={17} />
                    <span>নম্বর সংরক্ষণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ NOTICES ============ */}
          {activeSubModule === 'teacher_notices' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Bell size={17} className="text-[#7c3aed]" />
                <h2 className="text-sm font-bold">মাদরাসা নোটিশ ও সার্কুলার</h2>
              </div>
              {notices.length === 0 ? (
                <div className={`${cardCls} p-8 text-center space-y-2`}>
                  <Bell size={32} className="mx-auto text-[#c3c9d9]" />
                  <p className="text-xs text-[#5b6478] dark:text-slate-400 font-medium">কোনো সক্রিয় নোটিশ নেই।</p>
                </div>
              ) : (
                notices.map(notice => (
                  <div key={notice.id} className={`${cardCls} p-4 space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-1 rounded-full bg-[#fef3c7] dark:bg-amber-500/15 text-[#92400e] dark:text-amber-300 font-bold">
                        {notice.category || 'সাধারণ নোটিশ'}
                      </span>
                      <span className="text-[11px] text-[#8a93a8]">{toBn(notice.publishDate || (notice as any).date || '')}</span>
                    </div>
                    <h3 className="text-[13px] font-bold">{notice.title}</h3>
                    <p className="text-xs text-[#5b6478] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ============ PASSTHROUGH (shared desktop modules) ============ */}
          {!NATIVE_MODULES.includes(activeSubModule) && (
            <div className="w-full max-w-full overflow-x-hidden space-y-3">
              {renderModuleContent ? renderModuleContent(activeSubModule) : null}
            </div>
          )}
        </main>

        {BottomNav}
      </div>
    );
  }

  // -------------------------------------------------------------
  // PROFILE SCREEN
  // -------------------------------------------------------------
  if (showProfile) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#161c2e]/95 backdrop-blur-xl border-b border-[#e8ecf4] dark:border-white/5 px-4 py-3.5">
          <h1 className="text-base font-black">আমার প্রোফাইল</h1>
        </header>

        <main className="p-4 space-y-4">
          <div className={`${cardCls} p-5 flex flex-col items-center text-center space-y-3`}>
            <div className="w-20 h-20 rounded-[26px] bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-black flex items-center justify-center text-3xl shadow-xl shadow-violet-500/30">
              {initialLetter}
            </div>
            <div>
              <h2 className="text-lg font-black leading-tight">{displayName}</h2>
              <p className="text-xs text-[#8a93a8] mt-0.5">{authUser?.email || currentMember?.email || currentUser?.email || ''}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {roleBadges.map((badge, idx) => (
                <span key={idx} className="px-3 py-1 rounded-full bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 text-[11px] font-bold">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">প্রতিষ্ঠান</span>
              <span className="font-bold text-right">{schoolProfile.nameBn || schoolProfile.name}</span>
            </div>
            <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">দায়িত্ব</span>
              <span className="font-bold">{roleTitleBengali[userRole]}</span>
            </div>
            {userRole === 'teacher' && (
              <>
                <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
                <div className="flex items-start justify-between text-xs gap-3">
                  <span className="text-[#8a93a8] font-semibold shrink-0">আমার ক্লাস</span>
                  <span className="font-bold text-right">{teacherClasses.join(', ')}</span>
                </div>
              </>
            )}
            <div className="h-px bg-[#e8ecf4] dark:bg-white/5" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8a93a8] font-semibold">শিক্ষাবর্ষ</span>
              <span className="font-bold">{toBn(schoolProfile.academicYear || String(new Date().getFullYear()))}</span>
            </div>
          </div>

          <div className={`${cardCls} p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-[#ede9fe] dark:bg-violet-500/15 text-[#6d28d9] dark:text-violet-300 flex items-center justify-center">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-xs font-bold">অ্যাপ ইনস্টল করুন</p>
                <p className="text-[11px] text-[#8a93a8]">হোম স্ক্রিনে যোগ করে দ্রুত খুলুন</p>
              </div>
            </div>
            <PWAInstallButton />
          </div>

          <button
            onClick={() => (onLogout ? onLogout() : logoutAdmin())}
            className="w-full py-3.5 rounded-[20px] bg-[#fee2e2] dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-[#dc2626] dark:text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>লগআউট / একাউন্ট পরিবর্তন</span>
          </button>
        </main>

        {BottomNav}
        <OfflineIndicator />
      </div>
    );
  }

  // -------------------------------------------------------------
  // HOME DASHBOARD
  // -------------------------------------------------------------
  const StatCard = ({ value, label, Icon, cls }: { value: string; label: string; Icon: any; cls: string }) => (
    <div className={`${cardCls} p-3.5 flex flex-col items-center text-center gap-1.5`}>
      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center ${cls}`}>
        <Icon size={17} />
      </span>
      <span className="text-[15px] font-black leading-none truncate max-w-full">{value}</span>
      <span className="text-[10px] text-[#8a93a8] font-semibold leading-none">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] text-[#1e2433] dark:text-slate-100 flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f4f6fb]/90 dark:bg-[#0e1220]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-[16px] bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white font-black flex items-center justify-center text-lg shadow-lg shadow-violet-500/25 shrink-0">
            {initialLetter}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#8a93a8] font-semibold">{todayGreeting.greeting} 👋</p>
            <h1 className="text-[15px] font-black truncate leading-tight">{displayName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-2xl bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 flex items-center justify-center text-[#5b6478] dark:text-slate-300 relative cursor-pointer active:scale-95 transition-all"
          >
            <Bell size={17} />
            {notices.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#ef4444]" />}
          </button>
        </div>
      </header>

      {/* Notifications drawer */}
      {showNotifications && (
        <div className={`fixed inset-x-4 top-16 z-50 p-4 ${cardCls} text-xs space-y-2`}>
          <div className="flex items-center justify-between border-b border-[#e8ecf4] dark:border-white/5 pb-2">
            <span className="font-bold text-[#6d28d9] dark:text-violet-300">মাদরাসা নোটিফিকেশন</span>
            <button onClick={() => setShowNotifications(false)} className="text-[#8a93a8] cursor-pointer"><X size={15} /></button>
          </div>
          {notices.slice(0, 3).map(n => (
            <div key={n.id} className={`p-2.5 rounded-2xl ${softBg}`}>
              <span className="font-bold block mb-0.5">{n.title}</span>
              <p className="text-[11px] text-[#5b6478] dark:text-slate-400 line-clamp-2">{n.content}</p>
            </div>
          ))}
          {notices.length === 0 && (
            <div className={`p-2.5 rounded-2xl ${softBg} text-[#8a93a8] text-center`}>কোনো নতুন নোটিফিকেশন নেই।</div>
          )}
        </div>
      )}

      <main className="p-4 space-y-4">
        {/* Hero card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#6d28d9] text-white p-5 rounded-[28px] shadow-xl shadow-violet-500/25 space-y-3">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-100 relative">
            <Calendar size={12} />
            <span>{todayGreeting.fullDateText}</span>
          </div>
          <div className="relative">
            <span className="text-[11px] font-semibold text-violet-200 block truncate">{schoolProfile.nameBn || schoolProfile.name}</span>
            <h2 className="text-[22px] font-black tracking-tight mt-0.5 leading-snug">{roleTitleBengali[userRole]}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 relative">
            {roleBadges.map((badge, idx) => (
              <span key={idx} className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-bold">
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard value={roleStats.stat1Value} label={roleStats.stat1Label} Icon={roleStats.stat1Icon} cls={roleStats.stat1Cls} />
          <StatCard value={roleStats.stat2Value} label={roleStats.stat2Label} Icon={roleStats.stat2Icon} cls={roleStats.stat2Cls} />
          <StatCard value={roleStats.stat3Value} label={roleStats.stat3Label} Icon={roleStats.stat3Icon} cls={roleStats.stat3Cls} />
        </div>

        {/* Teacher: today's attendance progress */}
        {userRole === 'teacher' && (
          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center">
                  <ClipboardList size={17} />
                </span>
                <div>
                  <h3 className="text-[13px] font-bold leading-tight">আজকের হাজিরা — {selectedClass}</h3>
                  <p className="text-[11px] text-[#8a93a8]">{toBn(attendanceStats.takenCount)}/{toBn(attendanceStats.total)} জনের হাজিরা নেওয়া হয়েছে</p>
                </div>
              </div>
              <span className="text-lg font-black text-[#059669] dark:text-emerald-300">{toBn(attendanceStats.rate)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[#f4f6fb] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981] transition-all" style={{ width: `${attendanceStats.total > 0 ? (attendanceStats.takenCount / attendanceStats.total) * 100 : 0}%` }} />
            </div>
            <button
              onClick={() => handleOpenModule('teacher_attendance')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white text-xs font-bold shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              হাজিরা নিতে যান
            </button>
          </div>
        )}

        {/* Cashier: recent collections */}
        {userRole === 'cashier' && cashierFigures.recent.length > 0 && (
          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold">সাম্প্রতিক আদায়</h3>
              <button onClick={() => handleOpenModule('finance_reports')} className="text-[11px] font-bold text-[#7c3aed] dark:text-violet-300 cursor-pointer">সব রিপোর্ট</button>
            </div>
            <div className="space-y-2">
              {cashierFigures.recent.map(t => (
                <div key={t.id} className={`flex items-center justify-between p-3 rounded-2xl ${softBg}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-2xl bg-[#d1fae5] dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Receipt size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{(t as any).studentName || (t as any).description || (t as any).category || 'ফি আদায়'}</p>
                      <p className="text-[10px] text-[#8a93a8]">{toBn(String(t.date || '').slice(0, 10))}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#059669] dark:text-emerald-300 shrink-0">+৳{toBn(Number(t.amount || 0).toLocaleString())}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next task banner */}
        <div className={`${cardCls} p-4 flex items-center gap-3.5`}>
          <div className="w-11 h-11 rounded-2xl bg-[#fef3c7] dark:bg-amber-500/15 text-[#d97706] dark:text-amber-300 flex items-center justify-center shrink-0">
            <FileText size={19} />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold text-[#d97706] dark:text-amber-300">{roleStats.nextTaskTime}</span>
            <p className="text-xs font-semibold mt-0.5 truncate">{roleStats.nextTaskDesc}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] rounded-full" />
              <h3 className="text-[15px] font-black tracking-tight">দ্রুত কার্যাবলি</h3>
            </div>
            <span className="text-[11px] text-[#8a93a8] font-semibold">দায়িত্ব অনুযায়ী</span>
          </div>

          <div className="space-y-2.5">
            {roleActions.map(act => {
              const Icon = act.icon;
              return (
                <div
                  key={act.id}
                  onClick={() => handleOpenModule(act.moduleKey)}
                  className={`${cardCls} p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all`}
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${act.chip}`}>
                      <Icon size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-[13px] font-bold truncate">{act.title}</h4>
                      <p className="text-[11px] text-[#8a93a8] truncate mt-0.5">{act.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-[#c3c9d9] shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 text-center">
          <button
            onClick={() => (onLogout ? onLogout() : logoutAdmin())}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-[#161c2e] border border-[#e8ecf4] dark:border-white/10 text-[#dc2626] dark:text-rose-300 text-xs font-bold cursor-pointer active:scale-95 transition-all"
          >
            <LogOut size={14} />
            <span>লগআউট / একাউন্ট পরিবর্তন</span>
          </button>
        </div>
      </main>

      {BottomNav}
      <OfflineIndicator />
    </div>
  );
};
