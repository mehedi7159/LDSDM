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
  ChevronLeft, 
  Calendar, 
  Clock, 
  Award, 
  CreditCard, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Shield, 
  GraduationCap, 
  ArrowLeft,
  X,
  Phone,
  Layers,
  Search,
  MessageSquare,
  Copy,
  Check,
  RefreshCw,
  Send,
  Save,
  Filter,
  DollarSign
} from 'lucide-react';

interface MobileRoleAppViewProps {
  onLogout?: () => void;
  renderModuleContent?: (moduleKey: string) => React.ReactNode;
}

export const MobileRoleAppView: React.FC<MobileRoleAppViewProps> = ({ onLogout, renderModuleContent }) => {
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
    activeTab
  } = useApp();

  // 1. Determine current active role
  const userRole = useMemo<'teacher' | 'cashier' | 'parent' | 'staff'>(() => {
    const roleId = currentMember?.roleId || currentUser?.role || '';
    if (roleId === 'role_accountant' || roleId === 'accountant') return 'cashier';
    if (roleId === 'role_guardian' || roleId === 'guardian' || roleId === 'parent') return 'parent';
    if (roleId === 'role_staff' || roleId === 'staff') return 'staff';
    return 'teacher'; // Default role for standard instructors
  }, [currentMember, currentUser]);

  // Active Mobile View Sub-Tab
  const [activeBottomNav, setActiveBottomNav] = useState<'home' | 'action1' | 'action2' | 'action3'>('home');
  const [activeSubModule, setActiveSubModule] = useState<string | null>(null);
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

  // 2. Class Scope Isolation for Teacher
  // "je class teacher se sudu tar class er student der ke dekte parbe"
  const teacherClasses = useMemo(() => {
    const assigned = currentMember?.assignedClasses || currentUser?.assignedClasses || [];
    if (assigned.length > 0) return assigned;
    // Fallback to first available class if not yet assigned
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

  // Students isolated to the selected assigned class
  const classStudents = useMemo(() => {
    if (userRole === 'teacher') {
      return students.filter(s => s.status === 'Active' && !s.isFormer && s.classLevel === selectedClass);
    }
    return students.filter(s => s.status === 'Active' && !s.isFormer);
  }, [students, selectedClass, userRole]);

  // Dues Summary for the teacher's class ("oi class a kar koto taka baki ase ta jana jabe")
  const classDuesSummary = useMemo(() => {
    return calculateClassDuesSummary(classStudents, feeStructures, transactions);
  }, [classStudents, feeStructures, transactions]);

  // 3. Daily Attendance Local State for Today / Selected Date
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [studentAttendanceMap, setStudentAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

  // Load existing saved attendance for attendanceDate and selectedClass
  useEffect(() => {
    const savedRecords = dailyAttendanceService.getRecordsByDateAndClass(attendanceDate, selectedClass);
    const map: Record<string, AttendanceStatus> = {};
    savedRecords.forEach(r => {
      map[r.studentId] = r.status;
    });
    setStudentAttendanceMap(map);
  }, [attendanceDate, selectedClass]);

  // Calculate live attendance stats for current class
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

    return { total, present, absent, late, leave, attended, rate };
  }, [classStudents, studentAttendanceMap]);

  // Mark all students present in one click
  const handleMarkAllPresent = () => {
    const nextMap: Record<string, AttendanceStatus> = { ...studentAttendanceMap };
    classStudents.forEach(st => {
      nextMap[st.id] = 'PRESENT';
    });
    setStudentAttendanceMap(nextMap);
  };

  // Toggle or set individual student attendance
  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Save attendance batch
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

  // 4. Marks Entry Local State for Teacher
  const activeExams = useMemo(() => exams.filter(e => !e.isFinalized), [exams]);
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

  // 5. Date & Greeting helper
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

    return {
      greeting: greet,
      fullDateText: `• ${greet} • ${day}, ${dateNum} ${month} ${year}`
    };
  }, [language]);

  // 6. Dynamic Non-Demo Role KPI Stats
  const roleStats = useMemo(() => {
    if (userRole === 'teacher') {
      return {
        stat1Value: toBn(teacherClasses.length) + 'টি',
        stat1Label: 'আমার ক্লাস',
        stat2Value: toBn(classStudents.length) + ' জন',
        stat2Label: 'শ্রেণির শিক্ষার্থী',
        stat3Value: '৳' + toBn(classDuesSummary.totalDue.toLocaleString()),
        stat3Label: 'মোট বকেয়া ফি',
        nextTaskTime: 'আজকের কাজ',
        nextTaskDesc: `${selectedClass} — দৈনিক হাজিরা গ্রহণ ও বকেয়া ফি পর্যবেক্ষণ`
      };
    } else if (userRole === 'cashier') {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayIncome = transactions
        .filter(t => t.type === 'INCOME' && (t.date?.startsWith(todayStr)))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      
      const todayReceipts = transactions.filter(t => t.type === 'INCOME' && t.date?.startsWith(todayStr)).length;

      return {
        stat1Value: '৳' + toBn(todayIncome.toLocaleString()),
        stat1Label: 'আজকের আদায়',
        stat2Value: toBn(todayReceipts) + 'টি',
        stat2Label: 'মোট রসিদ',
        stat3Value: toBn(students.length) + ' জন',
        stat3Label: 'মোট ছাত্র',
        nextTaskTime: 'ক্যাশিয়ার ডেস্ক',
        nextTaskDesc: 'চলতি মাসের বেতন আদায় ও ফি রসিদ তৈরি'
      };
    } else if (userRole === 'parent') {
      return {
        stat1Value: attendanceStats.rate > 0 ? `${toBn(attendanceStats.rate)}%` : 'নিয়মিত',
        stat1Label: 'হাজিরা রেকর্ড',
        stat2Value: exams.length > 0 ? (exams[0].name || 'পরীক্ষা') : 'সাময়িক',
        stat2Label: 'চলমান পরীক্ষা',
        stat3Value: '৳' + toBn(classDuesSummary.totalDue > 0 ? classDuesSummary.totalDue.toLocaleString() : '০'),
        stat3Label: 'বকেয়া ফি',
        nextTaskTime: 'অভিভাবক ডায়েরি',
        nextTaskDesc: 'সন্তানের লেখাপড়া ও মাদরাসা নোটিশ'
      };
    } else { // Staff
      return {
        stat1Value: toBn(students.filter(s => s.status === 'Active').length) + ' জন',
        stat1Label: 'মোট শিক্ষার্থী',
        stat2Value: toBn(classes.length) + 'টি',
        stat2Label: 'মোট শ্রেণি',
        stat3Value: toBn(notices.length) + 'টি',
        stat3Label: 'সক্রিয় নোটিশ',
        nextTaskTime: 'অফিস প্রশাসন',
        nextTaskDesc: 'শিক্ষার্থী তথ্য যাচাই ও সনদপত্র প্রিন্ট'
      };
    }
  }, [userRole, teacherClasses, classStudents, classDuesSummary, transactions, students, exams, notices, selectedClass, attendanceStats]);

  // Role Badges
  const roleBadges = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        'শ্রেণি শিক্ষক / ওস্তাদ',
        selectedClass,
        `${toBn(classStudents.length)} জন শিক্ষার্থী`
      ];
    }
    if (userRole === 'cashier') return ['হিসাবরক্ষক / ক্যাশিয়ার', 'ফি ও ক্যাশ শাখা', 'রসিদ ইনচার্জ'];
    if (userRole === 'parent') return ['অভিভাবক পোর্টাল', 'সন্তানের তথ্য'];
    return ['অফিস স্টাফ', 'ভর্তি ও প্রশাসন', 'সার্টিফিকেট শাখা'];
  }, [userRole, selectedClass, classStudents]);

  // Quick Action List Items per Role
  const roleActions = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        {
          id: 'attendance',
          title: 'দৈনিক হাজিরা গ্রহণ',
          subtitle: `${selectedClass}-এর উপস্থিতি নিন — এক ক্লিকে সবাই প্রেজেন্ট`,
          icon: CheckSquare,
          moduleKey: 'teacher_attendance'
        },
        {
          id: 'students_dues',
          title: 'আমার ক্লাসের শিক্ষার্থী ও বকেয়া ফি',
          subtitle: 'ছাত্র তালিকা, অভিভাবকের মোবাইল ও কার কত টাকা বাকি আছে',
          icon: Users,
          moduleKey: 'teacher_students_dues'
        },
        {
          id: 'marks',
          title: 'পরীক্ষার নম্বর এন্ট্রি',
          subtitle: `${selectedClass}-এর বিষয়ভিত্তিক মার্কস এন্ট্রি ও জিপিএ তৈরি`,
          icon: PenTool,
          moduleKey: 'teacher_marks'
        },
        {
          id: 'notices',
          title: 'মাদরাসা নোটিশ বোর্ড',
          subtitle: 'জরুরি সার্কুলার ও প্রাতিষ্ঠানিক নির্দেশনা',
          icon: Bell,
          moduleKey: 'teacher_notices'
        }
      ];
    } else if (userRole === 'cashier') {
      return [
        {
          id: 'finance_collect',
          title: 'ফি আদায় ও রসিদ',
          subtitle: 'বেতন, ভর্তি ফি ও বকেয়া সংগ্রহ করে রসিদ প্রিন্ট করুন',
          icon: Wallet,
          moduleKey: 'finance'
        },
        {
          id: 'finance_expense',
          title: 'দৈনিক খরচ এন্ট্রি',
          subtitle: 'মাদরাসার প্রতিদিনের ব্যয়ের ভাউচার হিসাব যুক্ত করুন',
          icon: Receipt,
          moduleKey: 'finance'
        },
        {
          id: 'students',
          title: 'ছাত্র তালিকা ও বকেয়া খতিয়ান',
          subtitle: 'সকল ক্লাসের বকেয়া শিক্ষার্থী ও গার্ডিয়ানের মোবাইল',
          icon: Users,
          moduleKey: 'students'
        },
        {
          id: 'finance_reports',
          title: 'আর্থিক বিবরণী ও রিপোর্ট',
          subtitle: 'দৈনিক ও মাসিক মোট ক্যাশ জমার রিপোর্ট',
          icon: FileSpreadsheet,
          moduleKey: 'finance_reports'
        }
      ];
    } else if (userRole === 'parent') {
      return [
        {
          id: 'results',
          title: 'পরীক্ষার ফলাফল ও মার্কশিট',
          subtitle: 'সন্তানের অর্জিত জিপিএ, গ্রেড ও বিষয়ভিত্তিক নম্বর',
          icon: Award,
          moduleKey: 'results'
        },
        {
          id: 'attendance',
          title: 'দৈনিক উপস্থিতি ট্র্যাকার',
          subtitle: 'প্রতিদিনের ক্লাসে উপস্থিত ও ছুটির রেকর্ড',
          icon: CheckSquare,
          moduleKey: 'attendance'
        },
        {
          id: 'finance',
          title: 'বেতন ও ফি বিবরণী',
          subtitle: 'পরিশোধিত ফি এবং বর্তমান বকেয়া খতিয়ান',
          icon: Wallet,
          moduleKey: 'finance'
        },
        {
          id: 'notices',
          title: 'মাদরাসার নোটিশ ও ডায়রি',
          subtitle: 'ছুটির ঘোষণা ও গুরুত্বপূর্ণ প্রাতিষ্ঠানিক নোটিশ',
          icon: Bell,
          moduleKey: 'notice_board'
        }
      ];
    } else { // Staff
      return [
        {
          id: 'students',
          title: 'নতুন শিক্ষার্থী ভর্তি ও তালিকা',
          subtitle: 'ছাত্র-ছাত্রী ভর্তি ফরম, এন্ট্রি ও তথ্য আপডেট',
          icon: Users,
          moduleKey: 'students'
        },
        {
          id: 'id_cards',
          title: 'আইডি কার্ড ও সনদপত্র',
          subtitle: 'আইডি কার্ড, প্রশংসাপত্র ও প্রত্যয়নপত্র তৈরি',
          icon: CreditCard,
          moduleKey: 'student_id_cards'
        },
        {
          id: 'attendance',
          title: 'হাজিরা শিট ও রেজিস্টার',
          subtitle: 'দৈনিক হাজিরা এন্ট্রি ও প্রিন্ট কপি',
          icon: CheckSquare,
          moduleKey: 'attendance'
        },
        {
          id: 'notices',
          title: 'নোটিশ বোর্ড ম্যানেজমেন্ট',
          subtitle: 'নোটিশ ও সার্কুলার ড্রাফট এবং প্রকাশ',
          icon: Bell,
          moduleKey: 'notice_board'
        }
      ];
    }
  }, [userRole, selectedClass]);

  // Bottom Nav items per Role
  const bottomNavItems = useMemo(() => {
    if (userRole === 'teacher') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'হাজিরা', icon: CheckSquare, targetModule: 'teacher_attendance' },
        { id: 'action2', label: 'বকেয়া ফি', icon: DollarSign, targetModule: 'teacher_students_dues' },
        { id: 'action3', label: 'নম্বর', icon: PenTool, targetModule: 'teacher_marks' }
      ];
    } else if (userRole === 'cashier') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ফি আদায়', icon: Wallet, targetModule: 'finance' },
        { id: 'action2', label: 'খতিয়ান', icon: Receipt, targetModule: 'finance_reports' },
        { id: 'action3', label: 'ছাত্র', icon: Users, targetModule: 'students' }
      ];
    } else if (userRole === 'parent') {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ফলাফল', icon: Award, targetModule: 'results' },
        { id: 'action2', label: 'হাজিরা', icon: CheckSquare, targetModule: 'attendance' },
        { id: 'action3', label: 'ফি', icon: Wallet, targetModule: 'finance' }
      ];
    } else {
      return [
        { id: 'home', label: 'হোম', icon: Home, targetModule: null },
        { id: 'action1', label: 'ছাত্র', icon: Users, targetModule: 'students' },
        { id: 'action2', label: 'আইডি', icon: CreditCard, targetModule: 'student_id_cards' },
        { id: 'action3', label: 'নোটিশ', icon: Bell, targetModule: 'notice_board' }
      ];
    }
  }, [userRole]);

  const handleOpenModule = (moduleKey: string) => {
    setActiveSubModule(moduleKey);
  };

  const handleBottomNavClick = (nav: typeof bottomNavItems[0]) => {
    setActiveBottomNav(nav.id as any);
    if (nav.targetModule) {
      handleOpenModule(nav.targetModule);
    } else {
      setActiveSubModule(null);
    }
  };

  const initialLetter = (authUser?.displayName || authUser?.email || 'উ')[0].toUpperCase();

  const roleTitleBengali = {
    teacher: 'শ্রেণি শিক্ষক ড্যাশবোর্ড',
    cashier: 'হিসাবরক্ষক ড্যাশবোর্ড',
    parent: 'অভিভাবক পোর্টাল',
    staff: 'অফিস স্টাফ পোর্টাল'
  }[userRole];

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

  // -------------------------------------------------------------
  // RENDER DEDICATED NATIVE MOBILE SUB-MODULES
  // -------------------------------------------------------------
  if (activeSubModule) {
    return (
      <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans pb-24 mobile-role-app-container no-horizontal-scroll">
        {/* Sticky Mobile Header */}
        <header className="sticky top-0 z-40 bg-[#1a1a1a] border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-md">
          <button
            onClick={() => {
              setActiveSubModule(null);
              setActiveBottomNav('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold cursor-pointer transition-all active:scale-95"
          >
            <ArrowLeft size={16} />
            <span>হোমে ফিরুন</span>
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-amber-400 truncate max-w-[170px]">
              {selectedClass} • {userRole === 'teacher' ? 'ক্লাস শিক্ষক' : roleTitleBengali}
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs border border-amber-500/30">
            {initialLetter}
          </div>
        </header>

        {/* Global Save Feedback Alert */}
        {saveSuccessNotice && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}

        <main className="flex-1 p-3.5 space-y-4 overflow-y-auto">

          {/* ============================================================== */}
          {/* TEACHER SUB-MODULE 1: DAILY ATTENDANCE ("toi class er attendance dakte parbe") */}
          {/* ============================================================== */}
          {activeSubModule === 'teacher_attendance' && (
            <div className="space-y-4">
              {/* Header card with Class Switcher & Date Selector */}
              <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={18} className="text-amber-400" />
                    <h2 className="text-sm font-bold text-white">দৈনিক উপস্থিতি গ্রহণ</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                    {selectedClass}
                  </span>
                </div>

                {/* If multiple classes assigned, provide quick toggle buttons */}
                {teacherClasses.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {teacherClasses.map(clsName => (
                      <button
                        key={clsName}
                        onClick={() => setSelectedClass(clsName)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          selectedClass === clsName
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {clsName}
                      </button>
                    ))}
                  </div>
                )}

                {/* Date Picker & Fast Action */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 flex items-center gap-2 bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={e => setAttendanceDate(e.target.value)}
                      className="bg-transparent text-white font-mono text-xs focus:outline-hidden w-full"
                    />
                  </div>

                  <button
                    onClick={handleMarkAllPresent}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={14} />
                    <span>সবাই উপস্থিত</span>
                  </button>
                </div>

                {/* Live Real-Time Attendance KPI Row */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 text-center">
                  <div className="bg-[#121212] p-2 rounded-xl">
                    <span className="text-xs font-bold text-slate-400 block">মোট</span>
                    <span className="text-sm font-black text-white">{toBn(attendanceStats.total)}</span>
                  </div>
                  <div className="bg-[#121212] p-2 rounded-xl">
                    <span className="text-xs font-bold text-emerald-400 block">উপস্থিত</span>
                    <span className="text-sm font-black text-emerald-400">{toBn(attendanceStats.present)}</span>
                  </div>
                  <div className="bg-[#121212] p-2 rounded-xl">
                    <span className="text-xs font-bold text-rose-400 block">অনুপস্থিত</span>
                    <span className="text-sm font-black text-rose-400">{toBn(attendanceStats.absent)}</span>
                  </div>
                  <div className="bg-[#121212] p-2 rounded-xl">
                    <span className="text-xs font-bold text-amber-400 block">উপস্থিত হার</span>
                    <span className="text-sm font-black text-amber-400">{toBn(attendanceStats.rate)}%</span>
                  </div>
                </div>
              </div>

              {/* Student Roster List for Attendance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-400">
                    শিক্ষার্থী তালিকা ({toBn(classStudents.length)} জন)
                  </span>
                  <span className="text-[11px] text-slate-400">ট্যাপ করে স্ট্যাটাস পরিবর্তন করুন</span>
                </div>

                {classStudents.length === 0 ? (
                  <div className="p-8 text-center bg-[#1e1e1e] rounded-2xl border border-white/5 space-y-2">
                    <Users size={32} className="mx-auto text-slate-600" />
                    <p className="text-xs text-slate-400 font-medium">
                      {selectedClass}-এ কোনো শিক্ষার্থী পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  classStudents.map(st => {
                    const currentStatus: AttendanceStatus = studentAttendanceMap[st.id] || 'PRESENT';
                    return (
                      <div
                        key={st.id}
                        className="p-3 rounded-2xl bg-[#1e1e1e] border border-white/5 flex flex-col gap-2.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-white/5 text-amber-400 font-bold flex items-center justify-center text-xs border border-white/10 font-mono">
                              {toBn(st.roll || st.rollNumber || '—')}
                            </span>
                            <div>
                              <h3 className="text-xs font-bold text-white">
                                {st.nameBn || st.name}
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                পিতা: {st.fatherNameBn || st.fatherName || 'উল্লেখ নেই'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Status Tag */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            currentStatus === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                            currentStatus === 'ABSENT' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                            currentStatus === 'LATE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                            'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}>
                            {currentStatus === 'PRESENT' ? 'উপস্থিত' : currentStatus === 'ABSENT' ? 'অনুপস্থিত' : currentStatus === 'LATE' ? 'দেরি' : 'ছুটি'}
                          </span>
                        </div>

                        {/* 4-way Status Selector Touch Buttons */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(st.id, 'PRESENT')}
                            className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-sm scale-[1.02]'
                                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            উপস্থিত
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(st.id, 'ABSENT')}
                            className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-sm scale-[1.02]'
                                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            অনুপস্থিত
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(st.id, 'LATE')}
                            className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'LATE'
                                ? 'bg-amber-600 text-white shadow-sm scale-[1.02]'
                                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            দেরিতে
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStudentStatus(st.id, 'LEAVE')}
                            className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                              currentStatus === 'LEAVE'
                                ? 'bg-blue-600 text-white shadow-sm scale-[1.02]'
                                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            ছুটি
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Sticky Save Action Bar */}
              {classStudents.length > 0 && (
                <div className="pt-2 sticky bottom-20 z-30">
                  <button
                    onClick={handleSaveAttendance}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={18} />
                    <span>আজকের হাজিরা সংরক্ষণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TEACHER SUB-MODULE 2: STUDENTS & DUES ("oi class a kar koto taka baki ase ta jana jabe") */}
          {/* ============================================================== */}
          {activeSubModule === 'teacher_students_dues' && (
            <div className="space-y-4">
              {/* Financial & Census Header Card */}
              <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-amber-400" />
                    <h2 className="text-sm font-bold text-white">আমার শ্রেণির বকেয়া ও ফি খতিয়ান</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                    {selectedClass}
                  </span>
                </div>

                {/* Multiple Class Switcher */}
                {teacherClasses.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {teacherClasses.map(clsName => (
                      <button
                        key={clsName}
                        onClick={() => setSelectedClass(clsName)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          selectedClass === clsName
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {clsName}
                      </button>
                    ))}
                  </div>
                )}

                {/* 4 Financial KPI Stat Cards */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div className="bg-[#121212] p-2.5 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 font-medium block">মোট শিক্ষার্থী</span>
                    <span className="text-base font-black text-white">{toBn(classDuesSummary.totalStudents)} জন</span>
                  </div>

                  <div className="bg-[#121212] p-2.5 rounded-xl border border-rose-500/20 bg-rose-950/15">
                    <span className="text-[11px] text-rose-300 font-medium block">মোট বকেয়া ফি</span>
                    <span className="text-base font-black text-rose-400">৳{toBn(classDuesSummary.totalDue.toLocaleString())}</span>
                  </div>

                  <div className="bg-[#121212] p-2.5 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 font-medium block">বকেয়া রয়েছে</span>
                    <span className="text-sm font-bold text-rose-400">{toBn(classDuesSummary.dueStudentsCount)} জন</span>
                  </div>

                  <div className="bg-[#121212] p-2.5 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 font-medium block">পরিশোধিত</span>
                    <span className="text-sm font-bold text-emerald-400">{toBn(classDuesSummary.paidStudentsCount)} জন</span>
                  </div>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={duesSearchQuery}
                    onChange={e => setDuesSearchQuery(e.target.value)}
                    placeholder="রোল, নাম বা অভিভাবকের মোবাইল দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-3 py-2.5 bg-[#1e1e1e] border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setDuesFilterMode('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      duesFilterMode === 'ALL'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#1e1e1e] text-slate-400 border border-white/5'
                    }`}
                  >
                    সকল শিক্ষার্থী ({toBn(classDuesSummary.totalStudents)})
                  </button>
                  <button
                    onClick={() => setDuesFilterMode('DUE_ONLY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      duesFilterMode === 'DUE_ONLY'
                        ? 'bg-rose-500 text-white'
                        : 'bg-[#1e1e1e] text-rose-400 border border-white/5'
                    }`}
                  >
                    শুধু বকেয়া ({toBn(classDuesSummary.dueStudentsCount)})
                  </button>
                  <button
                    onClick={() => setDuesFilterMode('PAID_ONLY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      duesFilterMode === 'PAID_ONLY'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1e1e1e] text-emerald-400 border border-white/5'
                    }`}
                  >
                    পরিশোধিত ({toBn(classDuesSummary.paidStudentsCount)})
                  </button>
                </div>
              </div>

              {/* Student Cards with Dues Status & Quick Reminder SMS Action */}
              <div className="space-y-2.5">
                {filteredDuesProfiles.length === 0 ? (
                  <div className="p-8 text-center bg-[#1e1e1e] rounded-2xl border border-white/5 space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                    <p className="text-xs text-slate-300 font-medium">
                      কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  filteredDuesProfiles.map(p => {
                    const st = p.student;
                    const hasDue = p.dueThisMonth > 0;
                    const phone = st.guardianPhone;

                    return (
                      <div
                        key={st.id}
                        className={`p-3.5 rounded-2xl bg-[#1e1e1e] border ${
                          hasDue ? 'border-rose-950/50 hover:border-rose-700/50' : 'border-white/5'
                        } flex flex-col gap-2.5 shadow-sm transition-all`}
                      >
                        {/* Student Name & Roll Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-xl bg-white/5 text-amber-400 font-black flex items-center justify-center text-xs border border-white/10 font-mono shrink-0">
                              {toBn(st.roll || st.rollNumber || '—')}
                            </span>
                            <div>
                              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{st.nameBn || st.name}</span>
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                পিতা: {st.fatherNameBn || st.fatherName || 'অভিভাবক'}
                              </p>
                            </div>
                          </div>

                          {/* Fee Status Badge */}
                          <div className="text-right shrink-0">
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl border ${
                              hasDue 
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {hasDue ? `বকেয়া: ৳${toBn(p.dueThisMonth.toLocaleString())}` : 'পরিশোধিত ✓'}
                            </span>
                          </div>
                        </div>

                        {/* Fee Breakdown Details */}
                        <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[#121212] text-[11px] border border-white/5">
                          <div>
                            <span className="text-slate-400">মাসিক ধার্য ফি: </span>
                            <span className="text-white font-mono font-bold">
                              ৳{toBn(p.monthlyExpected.toLocaleString())}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400">পরিশোধিত ফি: </span>
                            <span className="text-emerald-400 font-mono font-bold">
                              ৳{toBn(p.paidThisMonth.toLocaleString())}
                            </span>
                          </div>
                        </div>

                        {/* Guardian Phone & Direct Contact / Reminder Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <Phone size={13} className="text-amber-400" />
                            <span className="font-mono text-[11px]">
                              {phone ? toBn(phone) : 'ফোন নম্বর নেই'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Phone size={11} />
                                <span>কল</span>
                              </a>
                            )}

                            {hasDue && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleCopySms(p)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer"
                                >
                                  {copiedStudentId === st.id ? (
                                    <>
                                      <Check size={11} className="text-emerald-400" />
                                      <span className="text-emerald-400">কপি হয়েছে</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} />
                                      <span>তাগাদা কপি</span>
                                    </>
                                  )}
                                </button>

                                {phone && (
                                  <a
                                    href={`sms:${phone}?body=${encodeURIComponent(
                                      getDueReminderMessage(
                                        st.nameBn || st.name,
                                        p.classLevel,
                                        p.dueThisMonth,
                                        schoolProfile.nameBn || schoolProfile.name
                                      )
                                    )}`}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                  >
                                    <Send size={11} />
                                    <span>এসএমএস</span>
                                  </a>
                                )}
                              </>
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

          {/* ============================================================== */}
          {/* TEACHER SUB-MODULE 3: MARKS ENTRY */}
          {/* ============================================================== */}
          {activeSubModule === 'teacher_marks' && (
            <div className="space-y-4">
              <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool size={18} className="text-amber-400" />
                    <h2 className="text-sm font-bold text-white">পরীক্ষার বিষয়ভিত্তিক নম্বর এন্ট্রি</h2>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                    {selectedClass}
                  </span>
                </div>

                {/* Exam & Subject Selectors */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">পরীক্ষা</label>
                    <select
                      value={selectedExamId}
                      onChange={e => setSelectedExamId(e.target.value)}
                      className="w-full bg-[#121212] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden"
                    >
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">বিষয়</label>
                    <select
                      value={selectedSubjectId}
                      onChange={e => setSelectedSubjectId(e.target.value)}
                      className="w-full bg-[#121212] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden"
                    >
                      {classSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.nameBn || s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Student Marks List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-400">
                    শিক্ষার্থী তালিকা ({toBn(classStudents.length)} জন)
                  </span>
                  <span className="text-[11px] text-slate-400">পূর্ণমান: ১০০</span>
                </div>

                {classStudents.map(st => {
                  const currentVal = marksInputMap[st.id] ?? '';
                  const numVal = Number(currentVal);
                  const grade = currentVal !== '' 
                    ? (numVal >= 80 ? 'A+' : numVal >= 70 ? 'A' : numVal >= 60 ? 'A-' : numVal >= 50 ? 'B' : numVal >= 40 ? 'C' : numVal >= 33 ? 'D' : 'F') 
                    : '—';

                  return (
                    <div
                      key={st.id}
                      className="p-3 rounded-2xl bg-[#1e1e1e] border border-white/5 flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-8 h-8 rounded-xl bg-white/5 text-amber-400 font-bold flex items-center justify-center text-xs border border-white/10 font-mono shrink-0">
                          {toBn(st.roll || st.rollNumber || '—')}
                        </span>
                        <div className="overflow-hidden">
                          <h3 className="text-xs font-bold text-white truncate">
                            {st.nameBn || st.name}
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            গ্রেড: <strong className={grade === 'F' ? 'text-rose-400' : 'text-emerald-400'}>{grade}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={currentVal}
                          onChange={e => {
                            const val = e.target.value;
                            setMarksInputMap(prev => ({ ...prev, [st.id]: val }));
                          }}
                          placeholder="নম্বর"
                          className="w-16 py-1.5 px-2 bg-[#121212] border border-white/15 rounded-xl text-center text-xs font-mono font-bold text-white focus:outline-hidden focus:border-amber-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save Marks Button */}
              {classStudents.length > 0 && (
                <div className="pt-2 sticky bottom-20 z-30">
                  <button
                    onClick={handleSaveMarks}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={18} />
                    <span>নম্বর সংরক্ষণ করুন</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TEACHER SUB-MODULE 4: NOTICES */}
          {/* ============================================================== */}
          {activeSubModule === 'teacher_notices' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Bell size={18} className="text-amber-400" />
                <h2 className="text-sm font-bold text-white">মাদরাসা নোটিশ ও সার্কুলার</h2>
              </div>

              {notices.length === 0 ? (
                <div className="p-8 text-center bg-[#1e1e1e] rounded-2xl border border-white/5 space-y-2">
                  <Bell size={32} className="mx-auto text-slate-600" />
                  <p className="text-xs text-slate-400 font-medium">কোনো সক্রিয় নোটিশ নেই।</p>
                </div>
              ) : (
                notices.map(notice => (
                  <div
                    key={notice.id}
                    className="p-4 rounded-2xl bg-[#1e1e1e] border border-white/5 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">
                        {notice.category || 'সাধারণ নোটিশ'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {toBn(notice.publishDate || notice.date || '')}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white">
                      {notice.title}
                    </h3>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {notice.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* FALLBACK / PASSTHROUGH FOR OTHER ROLES (Cashier, Parent, Staff) */}
          {/* ============================================================== */}
          {!['teacher_attendance', 'teacher_students_dues', 'teacher_marks', 'teacher_notices'].includes(activeSubModule) && (
            <div className="w-full max-w-full overflow-x-hidden space-y-3">
              {renderModuleContent ? renderModuleContent(activeSubModule) : null}
            </div>
          )}
        </main>

        {/* Fixed Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#181818]/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl">
          {bottomNavItems.map(item => {
            const Icon = item.icon;
            const isActive = (item.id === 'home' && !activeSubModule) || (item.targetModule === activeSubModule);
            return (
              <button
                key={item.id}
                onClick={() => handleBottomNavClick(item)}
                className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all relative ${
                  isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-amber-400 scale-110' : 'text-slate-400'} />
                <span className="text-[11px] mt-1 font-medium">{item.label}</span>
                {isActive && (
                  <span className="w-4 h-0.5 bg-amber-400 rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MOBILE NATIVE HOME DASHBOARD VIEW (Matching video screenshot layout)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#121212] text-slate-100 flex flex-col font-sans pb-24 selection:bg-amber-500/30 mobile-role-app-container no-horizontal-scroll">
      
      {/* 1. Top Native App Header */}
      <header className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-md px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-slate-300">
            <ChevronLeft size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-white tracking-tight">
                {roleTitleBengali}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                {toBn(schoolProfile.academicYear || new Date().getFullYear().toString())}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px]">
              {authUser?.displayName || currentMember?.displayName || currentUser?.name || schoolProfile.nameBn || schoolProfile.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-2xl bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white relative cursor-pointer active:scale-95"
          >
            <Bell size={18} />
            {notices.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          <div className="w-10 h-10 rounded-2xl bg-[#e5a01d] text-[#121212] font-extrabold flex items-center justify-center text-base shadow-sm">
            {initialLetter}
          </div>
        </div>
      </header>

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed inset-x-4 top-16 z-50 p-4 rounded-2xl bg-[#1e1e1e] border border-white/10 shadow-2xl text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-amber-400">মাদরাসা নোটিফিকেশন</span>
            <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          {notices.slice(0, 3).map(n => (
            <div key={n.id} className="p-2 rounded-xl bg-white/5 text-slate-300">
              <span className="font-bold text-white block mb-0.5">{n.title}</span>
              <p className="text-[11px] text-slate-400 line-clamp-2">{n.content}</p>
            </div>
          ))}
          {notices.length === 0 && (
            <div className="p-2 rounded-xl bg-white/5 text-slate-400 text-center">
              কোনো নতুন নোটিফিকেশন নেই।
            </div>
          )}
        </div>
      )}

      {/* Main App Content Body */}
      <main className="p-4 space-y-4">

        {/* 2. Hero Greeting Card (Warm Gold matching video) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#e5a01d] via-[#e59b15] to-[#d68a0a] text-[#1a1205] p-5 rounded-[1.8rem] shadow-lg space-y-3">
          <div className="text-xs font-semibold text-[#3d2703] flex items-center gap-1.5">
            <span>{todayGreeting.fullDateText}</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-[#4d3205] block truncate">
              {schoolProfile.nameBn || schoolProfile.name}
            </span>
            <h2 className="text-2xl font-black text-[#1a1002] tracking-tight mt-0.5">
              {authUser?.displayName || currentMember?.displayName || currentUser?.name || 'শিক্ষক মহোদয়'}
            </h2>
          </div>

          {/* Role Badges Capsule Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {roleBadges.map((badge, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 rounded-full bg-[#1a1205]/15 text-[#1a1002] border border-[#1a1205]/20 text-xs font-bold"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* 3. 3-Column Quick KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono">{roleStats.stat1Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">{roleStats.stat1Label}</span>
          </div>
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono">{roleStats.stat2Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">{roleStats.stat2Label}</span>
          </div>
          <div className="bg-[#1e1e1e] border border-white/5 p-3.5 rounded-2xl text-center flex flex-col justify-center shadow-sm">
            <span className="text-lg font-black text-white font-mono truncate">{roleStats.stat3Value}</span>
            <span className="text-[11px] text-slate-400 mt-0.5 font-medium truncate">{roleStats.stat3Label}</span>
          </div>
        </div>

        {/* 4. Next Task / Upcoming Action Banner */}
        <div className="bg-[#1a1a1a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-[#262626] text-amber-400 flex items-center justify-center shrink-0 border border-white/5">
            <Calendar size={20} />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400">
                {roleStats.nextTaskTime}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">
              {roleStats.nextTaskDesc}
            </p>
          </div>
        </div>

        {/* 5. Quick Actions Section ("দ্রুত কার্যাবলি") */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-base font-bold text-white tracking-tight">
                দ্রুত কার্যাবলি
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">দায়িত্ব অনুযায়ী</span>
          </div>

          <div className="space-y-2.5">
            {roleActions.map(act => {
              const Icon = act.icon;
              return (
                <div
                  key={act.id}
                  onClick={() => handleOpenModule(act.moduleKey)}
                  className="bg-[#1e1e1e] hover:bg-[#252525] border border-white/5 p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <div className="w-11 h-11 rounded-2xl bg-[#2a2a2a] text-amber-400 flex items-center justify-center shrink-0 border border-white/5 group-hover:bg-amber-500 group-hover:text-[#121212] transition-colors">
                      <Icon size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {act.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Quick Logout & Switch Account Button */}
        <div className="pt-4 text-center">
          <button
            onClick={() => (onLogout ? onLogout() : logoutAdmin())}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <LogOut size={14} />
            <span>লগআউট / একাউন্ট পরিবর্তন</span>
          </button>
        </div>

      </main>

      {/* 7. Fixed Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#181818]/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeBottomNav === item.id && !activeSubModule;
          return (
            <button
              key={item.id}
              onClick={() => handleBottomNavClick(item)}
              className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all relative ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-amber-400 scale-110' : 'text-slate-400'} />
              <span className="text-[11px] mt-1 font-medium">{item.label}</span>
              {isActive && (
                <span className="w-4 h-0.5 bg-amber-400 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Connectivity & Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
};
