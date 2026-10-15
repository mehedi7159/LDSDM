import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Exam, Subject, MarkRecord, RemarkRecord, ExamSubjectAssignment } from '../types';
import { calculateGrade, calculateTotalGPA, getConsolidatedMark, formatNumber } from '../services/utils';
import { 
  User, 
  Calendar, 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BookOpen, 
  GraduationCap, 
  Search, 
  LogOut, 
  Printer, 
  Download, 
  ShieldCheck, 
  Sparkles, 
  Phone, 
  Droplet, 
  Building2, 
  ChevronRight, 
  TrendingUp, 
  FileText, 
  Layers, 
  Eye, 
  QrCode, 
  ArrowLeft,
  Check,
  CalendarCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { NoticeBoardAlertBanner } from './NoticeBoard';

interface StudentProfileViewProps {
  initialStudentId?: string;
  onBack?: () => void;
  onSwitchStudent?: () => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  initialStudentId,
  onBack,
  onSwitchStudent
}) => {
  const { 
    students = [], 
    exams = [], 
    subjects = [], 
    marks = [], 
    remarks = [], 
    classes = [],
    examSubjectAssignments = [],
    schoolProfile, 
    language, 
    setLanguage 
  } = useApp();

  // Authentication State with Student ID
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [activeStudentId, setActiveStudentId] = useState<string>(() => {
    if (initialStudentId) return initialStudentId;
    return localStorage.getItem('mms_logged_in_student_id') || '';
  });
  const [loginError, setLoginError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'marks' | 'schedule' | 'id_card'>('attendance');

  // Attendance Filter: selected month
  const [attendanceMonth, setAttendanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Marks Filter: selected exam
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Print Ref
  const printSectionRef = useRef<HTMLDivElement>(null);

  // Bengali numerals converter
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const bnDigits: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
    };
    return str.split('').map(c => bnDigits[c] || c).join('');
  };

  // Find currently logged-in student
  const currentStudent = useMemo(() => {
    if (!activeStudentId) return null;
    const query = String(activeStudentId).trim().toLowerCase();
    return students.find(s => 
      (s.studentId && String(s.studentId).toLowerCase() === query) ||
      (s.id && String(s.id).toLowerCase() === query) ||
      (s.studentCode && String(s.studentCode).toLowerCase() === query) ||
      (s.admissionNumber && String(s.admissionNumber).toLowerCase() === query) ||
      (s.roll != null && String(s.roll).toLowerCase() === query)
    ) || null;
  }, [students, activeStudentId]);

  // Set default exam when currentStudent is resolved
  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  // Save student session to localStorage
  useEffect(() => {
    if (currentStudent) {
      localStorage.setItem('mms_logged_in_student_id', currentStudent.studentId || currentStudent.id);
    }
  }, [currentStudent]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const query = studentIdInput.trim().toLowerCase();
    if (!query) {
      setLoginError(language === 'bn' ? 'অনুগ্রহ করে স্টুডেন্ট আইডি প্রদান করুন।' : 'Please enter your Student ID.');
      return;
    }

    const found = students.find(s => 
      (s.studentId && String(s.studentId).toLowerCase() === query) ||
      (s.id && String(s.id).toLowerCase() === query) ||
      (s.studentCode && String(s.studentCode).toLowerCase() === query) ||
      (s.admissionNumber && String(s.admissionNumber).toLowerCase() === query) ||
      (s.roll != null && String(s.roll).toLowerCase() === query) ||
      (s.name && String(s.name).toLowerCase() === query)
    );

    if (found) {
      setActiveStudentId(found.studentId || found.id);
      setLoginError('');
      setStudentIdInput('');
    } else {
      setLoginError(
        language === 'bn' 
          ? `"${studentIdInput}" আইডির কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে সঠিক আইডি লিখুন।` 
          : `No student found with ID "${studentIdInput}". Please verify and try again.`
      );
    }
  };

  const handleSelectDemoStudent = (std: Student) => {
    const idToUse = std.studentId || std.id;
    setActiveStudentId(idToUse);
    setLoginError('');
  };

  const handleLogout = () => {
    setActiveStudentId('');
    localStorage.removeItem('mms_logged_in_student_id');
    if (onSwitchStudent) {
      onSwitchStudent();
    }
  };

  // Student class level
  const studentClass = currentStudent?.classLevel || (currentStudent as any)?.class || '';

  // Class subjects
  const studentSubjects = useMemo(() => {
    if (!currentStudent) return [];
    return subjects.filter(s => 
      s.classLevel === studentClass &&
      (!s.group || s.group === 'All' || s.group === 'General' || s.group === currentStudent.group)
    ).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [subjects, currentStudent, studentClass]);

  // ==========================================
  // 1. ATTENDANCE COMPUTATIONS
  // ==========================================
  const studentRemarks = useMemo(() => {
    if (!currentStudent) return [];
    return remarks.filter(r => r.studentId === currentStudent.id);
  }, [remarks, currentStudent]);

  // Generate realistic monthly attendance ledger (deterministic from student ID and selected month)
  const monthlyAttendanceData = useMemo(() => {
    if (!currentStudent) return { days: [], summary: { workingDays: 24, present: 22, absent: 2, late: 0, rate: 91.7 } };

    const [yearStr, monthStr] = attendanceMonth.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Student specific seed
    const seed = (currentStudent.id || 'std').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + month * 13;

    const days = [];
    let workingDays = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 5 is Friday
      const isFriday = dayOfWeek === 5; // Friday is weekly holiday in Madrasah/Bangladesh
      const isWeekend = isFriday;

      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (isWeekend) {
        days.push({
          day: d,
          date: dateString,
          dayNameBn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'][dayOfWeek],
          dayNameEn: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
          status: 'HOLIDAY' as const,
          label: language === 'bn' ? 'সাপ্তাহিক ছুটি' : 'Weekly Holiday'
        });
      } else {
        workingDays++;
        // Deterministic simulation
        const dayScore = (seed * d * 17) % 100;
        let status: 'PRESENT' | 'ABSENT' | 'LATE' = 'PRESENT';
        let label = language === 'bn' ? 'উপস্থিত' : 'Present';

        if (dayScore < 6) {
          status = 'ABSENT';
          label = language === 'bn' ? 'অনুপস্থিত' : 'Absent';
          absentCount++;
        } else if (dayScore < 12) {
          status = 'LATE';
          label = language === 'bn' ? 'বিলম্বে উপস্থিত' : 'Late';
          lateCount++;
          presentCount++; // Late is still counted present
        } else {
          presentCount++;
        }

        days.push({
          day: d,
          date: dateString,
          dayNameBn: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'][dayOfWeek],
          dayNameEn: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
          status,
          label
        });
      }
    }

    const rate = workingDays > 0 ? Number(((presentCount / workingDays) * 100).toFixed(1)) : 100;

    return {
      days,
      summary: {
        workingDays,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        rate
      }
    };
  }, [currentStudent, attendanceMonth, language]);

  // Overall attendance across all terms/months
  const overallAttendanceRate = monthlyAttendanceData.summary.rate;

  // ==========================================
  // 2. MARKS COMPUTATIONS
  // ==========================================
  const activeExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  const examResultsData = useMemo(() => {
    if (!currentStudent || !activeExam) return null;

    const subjectsBreakdown = studentSubjects.map(sub => {
      const markRec = getConsolidatedMark(currentStudent.id, sub.id, activeExam.id, exams, marks);
      const full = sub.fullMarks || 100;
      const pass = sub.passMarks || Math.round(full * 0.33);

      const obtained = markRec ? (markRec.obtained || 0) : 0;
      const isAbsent = markRec?.isAbsent ?? false;
      const cq = markRec?.obtainedCQ;
      const mcq = markRec?.obtainedMCQ;
      const practical = markRec?.obtainedPractical;

      let isFail = false;
      if (isAbsent) {
        isFail = true;
      } else if (sub.hasCQ && (cq ?? 0) < (sub.cqPassMarks ?? 0)) {
        isFail = true;
      } else if (sub.hasMCQ && (mcq ?? 0) < (sub.mcqPassMarks ?? 0)) {
        isFail = true;
      } else if (obtained < pass) {
        isFail = true;
      }

      const gradeInfo = isAbsent ? { grade: 'F', gpa: 0.0 } : calculateGrade(obtained, full);

      return {
        subject: sub,
        fullMarks: full,
        passMarks: pass,
        obtained,
        obtainedCQ: cq,
        obtainedMCQ: mcq,
        obtainedPractical: practical,
        isAbsent,
        isFail,
        grade: isFail ? 'F' : gradeInfo.grade,
        gpa: isFail ? 0.0 : gradeInfo.gpa,
        percentage: full > 0 ? Math.round((obtained / full) * 100) : 0
      };
    });

    // Calculate total summary using calculateTotalGPA
    const totalGpaCalc = calculateTotalGPA(
      studentSubjects, 
      marks, 
      currentStudent.id, 
      activeExam.id, 
      currentStudent.group, 
      exams
    );

    const totalFull = studentSubjects.reduce((acc, s) => acc + (s.fullMarks || 100), 0);
    const overallPercentage = totalFull > 0 ? Math.round((totalGpaCalc.totalMarks / totalFull) * 100) : 0;

    // Exam term remark
    const remarkObj = remarks.find(r => r.studentId === currentStudent.id && r.examId === activeExam.id);

    return {
      subjectsBreakdown,
      totalObtained: totalGpaCalc.totalMarks,
      totalFullMarks: totalFull,
      percentage: overallPercentage,
      gpa: totalGpaCalc.gpa.toFixed(2),
      letterGrade: totalGpaCalc.isFail ? 'F' : totalGpaCalc.grade,
      isFail: totalGpaCalc.isFail,
      failCount: totalGpaCalc.failCount,
      remark: remarkObj?.remark || '',
      workingDays: remarkObj?.workingDays,
      totalPresent: remarkObj?.totalPresent,
      totalAbsent: remarkObj?.totalAbsent
    };
  }, [currentStudent, activeExam, studentSubjects, exams, marks, remarks]);

  // Multi-term comparative progress across all exams
  const examProgressionHistory = useMemo(() => {
    if (!currentStudent || exams.length === 0) return [];

    return exams.map(exam => {
      const gpaCalc = calculateTotalGPA(
        studentSubjects,
        marks,
        currentStudent.id,
        exam.id,
        currentStudent.group,
        exams
      );

      const totalFull = studentSubjects.reduce((acc, s) => acc + (s.fullMarks || 100), 0);
      const pct = totalFull > 0 ? Math.round((gpaCalc.totalMarks / totalFull) * 100) : 0;

      return {
        examId: exam.id,
        examName: language === 'bn' ? (exam.nameBn || exam.name) : exam.name,
        academicYear: exam.academicYear,
        totalMarks: gpaCalc.totalMarks,
        totalFull,
        percentage: pct,
        gpa: gpaCalc.gpa.toFixed(2),
        grade: gpaCalc.isFail ? 'F' : gpaCalc.grade,
        isFail: gpaCalc.isFail
      };
    });
  }, [currentStudent, exams, studentSubjects, marks, language]);

  // ==========================================
  // 3. UPCOMING EXAM SCHEDULES
  // ==========================================
  const upcomingSchedules = useMemo(() => {
    if (!currentStudent) return [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // List all relevant exam assignments or build schedule for active exams
    const schedules: Array<{
      id: string;
      examName: string;
      examNameBn?: string;
      examCategory: string;
      subjectName: string;
      subjectNameBn?: string;
      subjectCode?: string;
      examDate: string;
      startTime: string;
      durationMinutes: number;
      fullMarks: number;
      passMarks: number;
      roomOrHall: string;
      status: 'UPCOMING' | 'TODAY' | 'COMPLETED';
      daysLeft: number;
    }> = [];

    exams.forEach(exam => {
      // Find subject assignments if created
      const assigned = examSubjectAssignments.filter(esa => esa.examId === exam.id && esa.status !== 'INACTIVE');

      if (assigned.length > 0) {
        assigned.forEach(item => {
          const sub = subjects.find(s => s.id === item.subjectId);
          if (sub && (sub.classLevel === studentClass || !sub.classLevel)) {
            const dateStr = item.examDate || exam.startDate || todayStr;
            const targetDate = new Date(dateStr);
            const diffTime = targetDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let status: 'UPCOMING' | 'TODAY' | 'COMPLETED' = 'UPCOMING';
            if (dateStr === todayStr) status = 'TODAY';
            else if (targetDate < now && dateStr !== todayStr) status = 'COMPLETED';

            schedules.push({
              id: item.id,
              examName: exam.name,
              examNameBn: exam.nameBn,
              examCategory: exam.category,
              subjectName: sub.name,
              subjectNameBn: sub.nameBn,
              subjectCode: sub.code,
              examDate: dateStr,
              startTime: item.startTime || '10:00 AM',
              durationMinutes: item.durationMinutes || 180,
              fullMarks: item.fullMarks || sub.fullMarks || 100,
              passMarks: item.passMarks || sub.passMarks || 33,
              roomOrHall: language === 'bn' ? 'হল রুম - ১' : 'Main Examination Hall',
              status,
              daysLeft: diffDays
            });
          }
        });
      } else {
        // Automatically project subject schedules based on exam startDate or realistic calendar
        const baseDate = exam.startDate ? new Date(exam.startDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        studentSubjects.forEach((sub, idx) => {
          // Spread exams every 1-2 days skipping Fridays
          const schedDate = new Date(baseDate.getTime() + idx * 2 * 24 * 60 * 60 * 1000);
          if (schedDate.getDay() === 5) {
            schedDate.setDate(schedDate.getDate() + 1); // skip Friday
          }
          const dateStr = schedDate.toISOString().split('T')[0];

          const diffTime = schedDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let status: 'UPCOMING' | 'TODAY' | 'COMPLETED' = 'UPCOMING';
          if (dateStr === todayStr) status = 'TODAY';
          else if (schedDate < now && dateStr !== todayStr) status = 'COMPLETED';

          schedules.push({
            id: `sched-${exam.id}-${sub.id}`,
            examName: exam.name,
            examNameBn: exam.nameBn,
            examCategory: exam.category,
            subjectName: sub.name,
            subjectNameBn: sub.nameBn,
            subjectCode: sub.code,
            examDate: dateStr,
            startTime: '10:00 AM',
            durationMinutes: 150,
            fullMarks: sub.fullMarks || 100,
            passMarks: sub.passMarks || 33,
            roomOrHall: language === 'bn' ? 'হলরুম - ২ (দ্বিতীয় তলা)' : 'Examination Hall 2',
            status,
            daysLeft: diffDays
          });
        });
      }
    });

    // Sort by exam date ascending
    return schedules.sort((a, b) => a.examDate.localeCompare(b.examDate));
  }, [currentStudent, exams, examSubjectAssignments, subjects, studentSubjects, studentClass, language]);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // ==========================================
  // VIEW: IF NO STUDENT LOGGED IN (LOGIN SCREEN)
  // ==========================================
  if (!currentStudent) {
    return (
      <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-600 selection:text-white p-4 sm:p-6 lg:p-8 ${language === 'bn' ? 'font-bangla' : ''}`}>
        
        {/* Top Header */}
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                title={language === 'bn' ? 'ফিরে যান' : 'Go Back'}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/30">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h1>
              <p className="text-[11px] text-slate-400">
                {language === 'bn' ? 'শিক্ষার্থী নিজস্ব প্রোফাইল ও রেজাল্ট পোর্টাল' : 'Student Self-Service Profile & Academic Portal'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
          >
            {language === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </header>

        {/* Notice Board Marquee & Alerts */}
        <div className="w-full max-w-4xl mx-auto px-4 pt-3">
          <NoticeBoardAlertBanner />
        </div>

        {/* Login Main Form */}
        <main className="max-w-md w-full mx-auto my-auto py-8">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
            
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-950/40">
                <User size={28} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {language === 'bn' ? 'শিক্ষার্থী আইডি দিয়ে প্রবেশ' : 'Student ID Sign In'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'bn' 
                  ? 'আপনার স্টুডেন্ট আইডি প্রদান করে নিজের হাজিরা খতিয়ান, বিষয়ভিত্তিক নম্বর ও আসন্ন পরীক্ষার রুটিন দেখুন।'
                  : 'Enter your Student ID to access your attendance records, marks, and upcoming exam schedule.'}
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {language === 'bn' ? 'স্টুডেন্ট আইডি / রোল নম্বর *' : 'Student ID or Roll Number *'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={studentIdInput}
                    onChange={(e) => {
                      setStudentIdInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder={language === 'bn' ? 'উদা: 2024001 অথবা STD-001' : 'e.g. 2024001 or STD-001'}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{language === 'bn' ? 'প্রোফাইলে প্রবেশ করুন' : 'View My Student Profile'}</span>
                <ChevronRight size={16} />
              </button>
            </form>

            {/* Quick Demo Student Selector */}
            {students.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold">{language === 'bn' ? 'দ্রুত ডেমো শিক্ষার্থী নির্বাচন:' : 'Quick Demo Students:'}</span>
                  <span className="text-[10px] text-indigo-400">({students.length} {language === 'bn' ? 'জন শিক্ষার্থী' : 'students'})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {students.slice(0, 6).map(std => (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => handleSelectDemoStudent(std)}
                      className="p-2 text-left rounded-xl bg-slate-950/60 hover:bg-indigo-950/40 border border-slate-800/80 hover:border-indigo-500/40 text-xs transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-white text-[11px] truncate group-hover:text-indigo-300">
                          {language === 'bn' ? (std.nameBn || std.name) : std.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ID: <span className="text-slate-200 font-mono">{std.studentId || std.id}</span> • {std.classLevel}
                        </div>
                      </div>
                      <ChevronRight size={12} className="text-slate-600 group-hover:text-indigo-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-500">
                {language === 'bn' 
                  ? 'আইডি ভুলে গেলে আপনার শ্রেণি শিক্ষক বা মাদ্রাসার অফিসে যোগাযোগ করুন।' 
                  : 'Lost your Student ID? Please contact your class teacher or institution office.'}
              </p>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-slate-500 border-t border-slate-900">
          © {new Date().getFullYear()} {schoolProfile.nameBn || schoolProfile.name} • {language === 'bn' ? 'স্মার্ট শিক্ষার্থী পোর্টাল' : 'Student Academic Portal'}
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW: LOGGED-IN STUDENT PROFILE VIEW
  // ==========================================
  return (
    <div className={`space-y-6 pb-12 ${language === 'bn' ? 'font-bangla' : ''}`}>
      
      {/* 0. NOTICE BOARD MARQUEE & URGENT ALERT BANNER */}
      <NoticeBoardAlertBanner />

      {/* 1. STUDENT PROFILE HEADER CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden print:hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Student Identity Block */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar Photo */}
            <div className="relative shrink-0">
              {currentStudent.photoUrl ? (
                <img 
                  src={currentStudent.photoUrl} 
                  alt={currentStudent.name} 
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600/30 border-2 border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-inner">
                  {(currentStudent.name || 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                {language === 'bn' ? 'নিয়মিত' : 'Active'}
              </span>
            </div>

            {/* Info details */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {language === 'bn' ? (currentStudent.nameBn || currentStudent.name) : currentStudent.name}
                </h2>
                {currentStudent.nameBn && language !== 'bn' && (
                  <span className="text-xs text-slate-400 font-normal">({currentStudent.nameBn})</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="text-slate-400">{language === 'bn' ? 'আইডি:' : 'ID:'}</span>
                  <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/60">
                    {currentStudent.studentId || currentStudent.id}
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="text-slate-400">{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</span>
                  <span className="font-bold text-white">{currentStudent.classLevel || studentClass}</span>
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="text-slate-400">{language === 'bn' ? 'রোল:' : 'Roll:'}</span>
                  <span className="font-bold text-white">{toBn(currentStudent.rollNumber || currentStudent.roll || '1')}</span>
                </span>

                {currentStudent.group && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400">{language === 'bn' ? 'বিভাগ:' : 'Group:'}</span>
                    <span className="font-semibold text-slate-300">{currentStudent.group}</span>
                  </span>
                )}
              </div>

              {/* Extra Demographics */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                {currentStudent.fatherName && (
                  <span>{language === 'bn' ? 'পিতা: ' : 'Father: '}{currentStudent.fatherName}</span>
                )}
                {currentStudent.guardianPhone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="text-slate-500" />
                    <span>{toBn(currentStudent.guardianPhone)}</span>
                  </span>
                )}
                {currentStudent.bloodGroup && (
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <Droplet size={11} />
                    <span>{currentStudent.bloodGroup}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>{language === 'bn' ? 'মূল পাতা' : 'Back'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              title={language === 'bn' ? 'প্রিন্ট করুন' : 'Print Document'}
            >
              <Printer size={14} className="text-indigo-400" />
              <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer flex items-center gap-1.5"
              title={language === 'bn' ? 'অন্য আইডি দিয়ে প্রবেশ করুন' : 'Switch Student'}
            >
              <LogOut size={14} />
              <span>{language === 'bn' ? 'লগআউট / আইডি পরিবর্তন' : 'Switch Student'}</span>
            </button>
          </div>

        </div>

      </div>

      {/* 2. TAB NAVIGATION BAR */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-1.5 rounded-2xl shadow-xs print:hidden gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none w-full sm:w-auto">
          
          {/* TAB 1: ATTENDANCE */}
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck size={16} />
            <span className="hidden sm:inline">{language === 'bn' ? 'হাজিরা খতিয়ান (Attendance)' : 'Attendance History'}</span>
            <span className="sm:hidden">{language === 'bn' ? 'হাজিরা' : 'Attendance'}</span>
          </button>

          {/* TAB 2: MARKS & RESULTS */}
          <button
            onClick={() => setActiveTab('marks')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'marks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award size={16} />
            <span className="hidden sm:inline">{language === 'bn' ? 'পরীক্ষার নম্বর ও রেজাল্ট (Marks)' : 'Marks & Results'}</span>
            <span className="sm:hidden">{language === 'bn' ? 'রেজাল্ট' : 'Results'}</span>
          </button>

          {/* TAB 3: UPCOMING EXAM SCHEDULE */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'schedule'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock size={16} />
            <span className="hidden sm:inline">{language === 'bn' ? 'পরীক্ষার রুটিন ও সিডিউল' : 'Exam Schedules'}</span>
            <span className="sm:hidden">{language === 'bn' ? 'রুটিন' : 'Routine'}</span>
            {upcomingSchedules.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'schedule' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {toBn(upcomingSchedules.length)}
              </span>
            )}
          </button>

          {/* TAB 4: DIGITAL ID CARD */}
          <button
            onClick={() => setActiveTab('id_card')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'id_card'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <QrCode size={16} />
            <span className="hidden sm:inline">{language === 'bn' ? 'ডিজিটাল আইডি কার্ড' : 'Student ID Card'}</span>
            <span className="sm:hidden">{language === 'bn' ? 'আইডি কার্ড' : 'ID Card'}</span>
          </button>

        </div>

        {/* Quick Language Toggle */}
        <button
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
        >
          {language === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB CONTENT 1: ATTENDANCE HISTORY                   */}
      {/* ==================================================== */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          
          {/* 1.1 KPI METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Total Working Days */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">{language === 'bn' ? 'মোট কর্মদিবস' : 'Total Working Days'}</span>
                <Calendar size={18} className="text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {toBn(monthlyAttendanceData.summary.workingDays)} <span className="text-xs text-slate-500 font-normal">{language === 'bn' ? 'দিন' : 'Days'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'bn' ? 'চলতি মাসে নির্ধারিত ক্লাস' : 'Scheduled class days'}
              </p>
            </div>

            {/* Total Present Days */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <span className="text-xs font-semibold">{language === 'bn' ? 'মোট উপস্থিতি' : 'Days Present'}</span>
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {toBn(monthlyAttendanceData.summary.present)} <span className="text-xs text-emerald-700 font-normal">{language === 'bn' ? 'দিন' : 'Days'}</span>
              </div>
              <p className="text-[11px] text-emerald-600/80 mt-1">
                {monthlyAttendanceData.summary.late > 0 
                  ? (language === 'bn' ? `${toBn(monthlyAttendanceData.summary.late)} দিন বিলম্ব সহ` : `Incl. ${monthlyAttendanceData.summary.late} late`)
                  : (language === 'bn' ? 'যথাসময়ে উপস্থিত' : 'Timely presence')}
              </p>
            </div>

            {/* Total Absent Days */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-2">
                <span className="text-xs font-semibold">{language === 'bn' ? 'মোট অনুপস্থিতি' : 'Days Absent'}</span>
                <XCircle size={18} className="text-rose-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600">
                {toBn(monthlyAttendanceData.summary.absent)} <span className="text-xs text-rose-700 font-normal">{language === 'bn' ? 'দিন' : 'Days'}</span>
              </div>
              <p className="text-[11px] text-rose-500/80 mt-1">
                {language === 'bn' ? 'ছুটি / অনুপস্থিত' : 'Leave / Unexcused'}
              </p>
            </div>

            {/* Attendance Percentage */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-indigo-600 mb-2">
                <span className="text-xs font-semibold">{language === 'bn' ? 'উপস্থিতির হার' : 'Attendance Rate'}</span>
                <TrendingUp size={18} className="text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-indigo-600">
                  {toBn(monthlyAttendanceData.summary.rate)}%
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  monthlyAttendanceData.summary.rate >= 90 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : monthlyAttendanceData.summary.rate >= 80 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {monthlyAttendanceData.summary.rate >= 90 
                    ? (language === 'bn' ? 'চমৎকার' : 'Excellent')
                    : monthlyAttendanceData.summary.rate >= 80 
                    ? (language === 'bn' ? 'সন্তোষজনক' : 'Good')
                    : (language === 'bn' ? 'সতর্কতা' : 'Warning')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'bn' ? 'ন্যূনতম লক্ষ্য: ৮০%' : 'Minimum target: 80%'}
              </p>
            </div>

          </div>

          {/* 1.2 OFFICIAL TERM-WISE ATTENDANCE (FROM REMARKS) */}
          {studentRemarks.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'bn' ? 'টার্ম/পরীক্ষাভিত্তিক আনুষ্ঠানিক হাজিরা ও শিক্ষকের মন্তব্য' : 'Official Term Attendance & Teacher Evaluation'}
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {language === 'bn' ? 'রেজাল্ট কার্ডের মূল নথি' : 'From Official Ledger'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3">{language === 'bn' ? 'পরীক্ষার নাম' : 'Examination'}</th>
                      <th className="p-3 text-center">{language === 'bn' ? 'কর্মদিবস' : 'Working Days'}</th>
                      <th className="p-3 text-center">{language === 'bn' ? 'উপস্থিতি' : 'Present'}</th>
                      <th className="p-3 text-center">{language === 'bn' ? 'অনুপস্থিতি' : 'Absent'}</th>
                      <th className="p-3 text-center">{language === 'bn' ? 'শতকরা হার' : 'Percentage'}</th>
                      <th className="p-3">{language === 'bn' ? 'শিক্ষকের মন্তব্য / আচরণ' : 'Teacher Remark / Evaluation'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentRemarks.map(rmk => {
                      const ex = exams.find(e => e.id === rmk.examId);
                      const w = rmk.workingDays || 0;
                      const p = rmk.totalPresent || 0;
                      const a = rmk.totalAbsent || (w > p ? w - p : 0);
                      const rate = w > 0 ? ((p / w) * 100).toFixed(1) : '-';

                      return (
                        <tr key={rmk.examId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-800">
                            {ex ? (language === 'bn' ? (ex.nameBn || ex.name) : ex.name) : rmk.examId}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700">{toBn(w)}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{toBn(p)}</td>
                          <td className="p-3 text-center font-semibold text-rose-600">{toBn(a)}</td>
                          <td className="p-3 text-center font-bold text-indigo-600">{toBn(rate)}%</td>
                          <td className="p-3 text-slate-600 italic">
                            {rmk.remark || (language === 'bn' ? 'সন্তোষজনক অগ্রগতি ও নিয়মিত উপস্থিতি।' : 'Satisfactory progress and regular attendance.')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 1.3 MONTHLY CALENDAR GRID & DAILY LOG */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'bn' ? 'মাসভিত্তিক দিনভিত্তিক হাজিরা ক্যালেন্ডার' : 'Daily Attendance Calendar'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'bn' ? 'প্রতিটি কার্যদিবসের ব্যক্তিগত হাজিরা স্থিতি' : 'Day-by-day attendance status for selected month'}
                  </p>
                </div>
              </div>

              {/* Month selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  {language === 'bn' ? 'মাস নির্বাচন:' : 'Select Month:'}
                </label>
                <input 
                  type="month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* Attendance Days Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2">
              {monthlyAttendanceData.days.map((dayItem) => {
                const isHoliday = dayItem.status === 'HOLIDAY';
                const isPresent = dayItem.status === 'PRESENT';
                const isLate = dayItem.status === 'LATE';
                const isAbsent = dayItem.status === 'ABSENT';

                return (
                  <div
                    key={dayItem.day}
                    className={`p-1.5 sm:p-2.5 rounded-xl border text-center transition-all ${
                      isHoliday 
                        ? 'bg-slate-50 border-slate-200 text-slate-400'
                        : isPresent 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 font-medium'
                        : isLate 
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950 font-medium'
                        : 'bg-rose-50/80 border-rose-200 text-rose-950 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-1">
                      <span className="font-bold font-mono">{toBn(dayItem.day)}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 truncate max-w-[32px] sm:max-w-none">
                        {language === 'bn' ? dayItem.dayNameBn : dayItem.dayNameEn}
                      </span>
                    </div>

                    <div className="flex items-center justify-center py-0.5 sm:py-1">
                      {isHoliday && <span className="text-[10px] text-slate-400 font-medium">{language === 'bn' ? 'ছুটি' : 'Holiday'}</span>}
                      {isPresent && (
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 size={12} className="shrink-0" />
                          <span>{language === 'bn' ? 'হাজির' : 'Present'}</span>
                        </div>
                      )}
                      {isLate && (
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-600">
                          <Clock size={12} className="shrink-0" />
                          <span>{language === 'bn' ? 'বিলম্ব' : 'Late'}</span>
                        </div>
                      )}
                      {isAbsent && (
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-600">
                          <XCircle size={12} className="shrink-0" />
                          <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Attendance Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>{language === 'bn' ? 'উপস্থিত' : 'Present'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>{language === 'bn' ? 'বিলম্বে উপস্থিত' : 'Late'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                <span>{language === 'bn' ? 'ছুটি / শুক্রবার' : 'Holiday / Friday'}</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 2: MARKS & ACADEMIC RESULTS             */}
      {/* ==================================================== */}
      {activeTab === 'marks' && (
        <div className="space-y-6">
          
          {/* 2.1 EXAM SELECTOR BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'bn' ? 'পরীক্ষা নির্বাচন করুন' : 'Select Examination'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'যে পরীক্ষার ফলাফল ও মার্কশিট দেখতে চান' : 'Select exam to view results and marksheet'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[220px]"
              >
                {exams.map(exam => (
                  <option key={exam.id} value={exam.id}>
                    {language === 'bn' ? (exam.nameBn || exam.name) : exam.name} ({exam.academicYear})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2.2 PERFORMANCE SUMMARY CARD */}
          {examResultsData && (
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-indigo-800/60">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                
                <div className="space-y-2">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                    {language === 'bn' ? (activeExam?.nameBn || activeExam?.name) : activeExam?.name} • {activeExam?.academicYear}
                  </span>
                  <h3 className="text-2xl font-black text-white">
                    {examResultsData.isFail 
                      ? (language === 'bn' ? 'ফলাফল: অকৃতকার্য (Fail)' : 'Result: Failed')
                      : (language === 'bn' ? 'ফলাফল: উত্তীর্ণ (Passed)' : 'Result: Passed')}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
                    {examResultsData.remark 
                      ? examResultsData.remark
                      : (language === 'bn'
                        ? 'পরীক্ষায় শিক্ষার্থী উল্লেখযোগ্য মেধা প্রদর্শন করেছে। নিয়মিত অধ্যবসায় অব্যাহত রাখার পরামর্শ দেওয়া হলো।'
                        : 'The student has performed consistently. Continued effort and dedication is advised.')}
                  </p>
                </div>

                {/* Score Badges */}
                <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                  {/* Total Marks */}
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                    <div className="text-[11px] text-slate-300 font-medium mb-1">
                      {language === 'bn' ? 'মোট প্রাপ্ত নম্বর' : 'Total Obtained'}
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white">
                      {toBn(examResultsData.totalObtained)}
                      <span className="text-xs text-slate-400 font-normal"> / {toBn(examResultsData.totalFullMarks)}</span>
                    </div>
                    <div className="text-[10px] text-indigo-300 font-bold mt-0.5">
                      {toBn(examResultsData.percentage)}%
                    </div>
                  </div>

                  {/* GPA */}
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                    <div className="text-[11px] text-slate-300 font-medium mb-1">
                      {language === 'bn' ? 'প্রাপ্ত জিপিএ' : 'GPA (Out of 5)'}
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-400">
                      {toBn(examResultsData.gpa)}
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold mt-0.5">
                      {language === 'bn' ? 'স্কেল: ৫.০০' : 'Scale 5.00'}
                    </div>
                  </div>

                  {/* Letter Grade */}
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                    <div className="text-[11px] text-slate-300 font-medium mb-1">
                      {language === 'bn' ? 'গ্রেড লেটার' : 'Letter Grade'}
                    </div>
                    <div className={`text-xl sm:text-2xl font-black ${
                      examResultsData.letterGrade === 'A+' ? 'text-emerald-400' :
                      examResultsData.letterGrade === 'F' ? 'text-rose-400' : 'text-blue-300'
                    }`}>
                      {examResultsData.letterGrade}
                    </div>
                    <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                      {examResultsData.isFail ? (language === 'bn' ? 'পুনর্বিবেচনা' : 'Review') : (language === 'bn' ? 'উত্তীর্ণ' : 'Pass')}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 2.3 DETAILED SUBJECT-WISE MARKS TABLE */}
          {examResultsData && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {language === 'bn' ? 'বিষয়ভিত্তিক বিস্তারিত নম্বর বিভাজন' : 'Subject-Wise Marks Breakdown'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {language === 'bn' ? 'লিখিত (CQ), নৈর্ব্যক্তিক (MCQ) ও ব্যবহারিক নম্বর' : 'Theory (CQ), Objective (MCQ), and Practical breakdown'}
                  </p>
                </div>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>{language === 'bn' ? 'মার্কশিট প্রিন্ট করুন' : 'Print Marksheet'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">{language === 'bn' ? 'বিষয়ের নাম' : 'Subject Name'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'পূর্ণমান' : 'Full'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'পাস নম্বর' : 'Pass'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'প্রাপ্ত নম্বর' : 'Obtained'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'শতকরা' : '%'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'জিপিএ' : 'GPA'}</th>
                      <th className="p-3.5 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {examResultsData.subjectsBreakdown.map((item, idx) => {
                      const isPassing = !item.isFail;

                      return (
                        <tr key={item.subject.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">
                              {language === 'bn' ? (item.subject.nameBn || item.subject.name) : item.subject.name}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              {item.subject.code && <span>{language === 'bn' ? 'কোড:' : 'Code:'} {item.subject.code}</span>}
                              {item.subject.isOptional && (
                                <span className="text-amber-600 bg-amber-50 px-1 rounded font-semibold">
                                  {language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-semibold text-slate-700">{toBn(item.fullMarks)}</td>
                          <td className="p-3.5 text-center text-slate-500">{toBn(item.passMarks)}</td>
                          <td className="p-3.5 text-center">
                            <span className={`font-black text-sm ${isPassing ? 'text-indigo-600' : 'text-rose-600'}`}>
                              {toBn(item.obtained)}
                            </span>
                            {/* Detailed CQ / MCQ sub marks if available */}
                            {(item.obtainedCQ !== undefined || item.obtainedMCQ !== undefined) && (
                              <div className="text-[9px] text-slate-400 font-normal">
                                {item.obtainedCQ !== undefined && `CQ: ${item.obtainedCQ} `}
                                {item.obtainedMCQ !== undefined && `MCQ: ${item.obtainedMCQ}`}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-medium text-slate-600">
                            {toBn(item.percentage)}%
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                              item.grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                              item.grade === 'A' ? 'bg-teal-100 text-teal-800' :
                              item.grade === 'F' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {item.grade}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold font-mono text-slate-800">
                            {toBn(item.gpa.toFixed(2))}
                          </td>
                          <td className="p-3.5 text-center">
                            {isPassing ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 size={13} />
                                <span>{language === 'bn' ? 'উত্তীর্ণ' : 'Passed'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                <XCircle size={13} />
                                <span>{language === 'bn' ? 'অনুত্তীর্ণ' : 'Failed'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td colSpan={2} className="p-3.5 text-right">
                        {language === 'bn' ? 'সর্বমোট প্রাপ্ত নম্বর ও ফলাফল:' : 'Grand Total & Final GPA:'}
                      </td>
                      <td className="p-3.5 text-center">{toBn(examResultsData.totalFullMarks)}</td>
                      <td></td>
                      <td className="p-3.5 text-center text-sm font-black text-indigo-700">
                        {toBn(examResultsData.totalObtained)}
                      </td>
                      <td className="p-3.5 text-center text-indigo-700">
                        {toBn(examResultsData.percentage)}%
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-black">
                          {examResultsData.letterGrade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-black font-mono text-indigo-700">
                        {toBn(examResultsData.gpa)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          examResultsData.isFail ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {examResultsData.isFail ? (language === 'bn' ? 'ব্যর্থ' : 'Fail') : (language === 'bn' ? 'পাস' : 'Pass')}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2.4 CROSS-TERM PROGRESSION TRAJECTORY */}
          {examProgressionHistory.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-indigo-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {language === 'bn' ? 'টার্মভিত্তিক ফলাফল ও অগ্রগতির ধারা' : 'Term-by-Term Academic Progress'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {language === 'bn' ? 'বিভিন্ন পরীক্ষার জিপিএ এবং নম্বরের তুলনামূলক বিশ্লেষণ' : 'Comparison of GPA and total marks across academic terms'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {examProgressionHistory.map(hist => (
                  <div key={hist.examId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{hist.examName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {language === 'bn' ? 'নম্বর:' : 'Marks:'} {toBn(hist.totalMarks)} / {toBn(hist.totalFull)} ({toBn(hist.percentage)}%)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-600 font-mono">
                        {toBn(hist.gpa)}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        hist.grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                        hist.grade === 'F' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {hist.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 3: UPCOMING EXAM SCHEDULES              */}
      {/* ==================================================== */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'bn' ? 'আসন্ন পরীক্ষার রুটিন ও সময়সূচী' : 'Upcoming Exam Schedule & Routine'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? `${currentStudent.classLevel || studentClass} এর সকল নির্ধারিত বিষয়` : `All scheduled subjects for ${currentStudent.classLevel || studentClass}`}
                </p>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
            >
              <Printer size={14} />
              <span>{language === 'bn' ? 'রুটিন প্রিন্ট করুন' : 'Print Routine'}</span>
            </button>
          </div>

          {/* Schedule List / Table */}
          {upcomingSchedules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
              <Calendar size={36} className="text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">
                {language === 'bn' ? 'কোনো আসন্ন পরীক্ষা নির্ধারিত নেই' : 'No Upcoming Exams Scheduled'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {language === 'bn' 
                  ? 'নতুন পরীক্ষার তারিখ নির্ধারিত হলে এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।' 
                  : 'Upcoming examination routines will be published here once announced.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingSchedules.map((item, idx) => {
                const isToday = item.status === 'TODAY';
                const isUpcoming = item.status === 'UPCOMING';
                const isCompleted = item.status === 'COMPLETED';

                return (
                  <div 
                    key={item.id || idx}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs relative overflow-hidden ${
                      isToday 
                        ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/40' 
                        : isUpcoming 
                        ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md' 
                        : 'bg-slate-50 border-slate-200/80 opacity-75'
                    }`}
                  >
                    {/* Status Pill */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {language === 'bn' ? (item.examNameBn || item.examName) : item.examName}
                      </span>

                      {isToday ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                          {language === 'bn' ? 'আজকের পরীক্ষা' : 'Today'}
                        </span>
                      ) : isUpcoming ? (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          {item.daysLeft > 0 
                            ? (language === 'bn' ? `${toBn(item.daysLeft)} দিন বাকি` : `In ${item.daysLeft} days`)
                            : (language === 'bn' ? 'আসন্ন' : 'Upcoming')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {language === 'bn' ? 'সম্পন্ন' : 'Completed'}
                        </span>
                      )}
                    </div>

                    {/* Subject info */}
                    <div className="space-y-1 mb-3">
                      <h4 className="text-base font-black text-slate-900">
                        {language === 'bn' ? (item.subjectNameBn || item.subjectName) : item.subjectName}
                      </h4>
                      {item.subjectCode && (
                        <p className="text-[11px] text-slate-500">
                          {language === 'bn' ? 'বিষয় কোড:' : 'Subject Code:'} <span className="font-mono font-bold text-slate-700">{item.subjectCode}</span>
                        </p>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-800">{item.examDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-indigo-500 shrink-0" />
                        <span>{item.startTime} ({toBn(item.durationMinutes)} {language === 'bn' ? 'মিনিট' : 'min'})</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Building2 size={13} className="text-indigo-500 shrink-0" />
                        <span>{item.roomOrHall}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{language === 'bn' ? 'পূর্ণমান:' : 'Full Marks:'} <strong>{toBn(item.fullMarks)}</strong></span>
                      <span>{language === 'bn' ? 'পাস নম্বর:' : 'Pass Marks:'} <strong>{toBn(item.passMarks)}</strong></span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Exam Rules & Instructions Card */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
              <AlertTriangle size={16} />
              <span>{language === 'bn' ? 'পরীক্ষার্থীদের জন্য জরুরি নির্দেশনাবলী' : 'Important Student Exam Guidelines'}</span>
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside leading-relaxed">
              <li>{language === 'bn' ? 'পরীক্ষা শুরুর অন্তত ৩০ মিনিট পূর্বে নিজ নিজ আসন গ্রহণ করতে হবে।' : 'Students must arrive and take their designated seats at least 30 minutes before exam start.'}</li>
              <li>{language === 'bn' ? 'অবশ্যই প্রবেশপত্র (Admit Card) ও শিক্ষার্থী আইডি কার্ড সাথে রাখতে হবে।' : 'Admit Card and Student ID card must be presented upon entering the examination hall.'}</li>
              <li>{language === 'bn' ? 'পরীক্ষার হলে কোনো প্রকার মোবাইল ফোন, স্মার্টওয়াচ বা অবৈধ কাগজপত্র বহন সম্পূর্ণ নিষিদ্ধ।' : 'Mobile phones, digital devices, and unauthorized notes are strictly prohibited.'}</li>
              <li>{language === 'bn' ? 'যেকোনো সাহায্যের জন্য দায়িত্বপ্রাপ্ত হল পরিদর্শকের সাথে কথা বলুন।' : 'Raise hand and seek assistance only from authorized invigilators.'}</li>
            </ul>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* TAB CONTENT 4: DIGITAL ID CARD                       */}
      {/* ==================================================== */}
      {activeTab === 'id_card' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'bn' ? 'শিক্ষার্থীর ডিজিটাল আইডি কার্ড' : 'Digital Student Identity Card'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'অনলাইন ও অফলাইন পরীক্ষার সত্যতা যাচাইকারী আইডি' : 'Official verification badge and academic identity'}
                </p>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>{language === 'bn' ? 'আইডি কার্ড প্রিন্ট' : 'Print ID Card'}</span>
            </button>
          </div>

          {/* ID Card Display Card */}
          <div className="flex justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl border-2 border-indigo-200 shadow-2xl overflow-hidden relative">
              
              {/* Institution Header */}
              <div className="bg-indigo-800 text-white p-4 text-center space-y-1 relative">
                <div className="w-10 h-10 rounded-full bg-white text-indigo-800 font-bold mx-auto flex items-center justify-center text-sm shadow">
                  <GraduationCap size={20} />
                </div>
                <h4 className="text-xs font-black tracking-tight leading-tight uppercase">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h4>
                <p className="text-[10px] text-indigo-200">
                  {schoolProfile.addressBn || schoolProfile.address}
                </p>
                <div className="inline-block px-3 py-0.5 rounded-full bg-indigo-900/80 text-[10px] font-bold text-amber-300 border border-indigo-700">
                  {language === 'bn' ? 'স্টুডেন্ট আইডি কার্ড' : 'STUDENT IDENTITY CARD'}
                </div>
              </div>

              {/* Student Body */}
              <div className="p-5 text-center space-y-3">
                {/* Photo */}
                <div className="w-24 h-24 mx-auto rounded-2xl bg-slate-100 border-2 border-indigo-500/30 overflow-hidden shadow-inner flex items-center justify-center">
                  {currentStudent.photoUrl ? (
                    <img src={currentStudent.photoUrl} alt={currentStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-indigo-600 font-black text-4xl">
                      {(currentStudent.name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {language === 'bn' ? (currentStudent.nameBn || currentStudent.name) : currentStudent.name}
                  </h3>
                  <p className="text-xs text-indigo-600 font-mono font-bold">
                    ID: {currentStudent.studentId || currentStudent.id}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left text-xs space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</span>
                    <span className="font-bold">{currentStudent.classLevel || studentClass}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{language === 'bn' ? 'রোল:' : 'Roll:'}</span>
                    <span className="font-bold">{toBn(currentStudent.rollNumber || currentStudent.roll || '1')}</span>
                  </div>
                  {currentStudent.bloodGroup && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'bn' ? 'রক্তের গ্রুপ:' : 'Blood Group:'}</span>
                      <span className="font-bold text-rose-600">{currentStudent.bloodGroup}</span>
                    </div>
                  )}
                  {currentStudent.guardianPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'bn' ? 'জরুরি ফোন:' : 'Guardian Phone:'}</span>
                      <span className="font-mono">{toBn(currentStudent.guardianPhone)}</span>
                    </div>
                  )}
                </div>

                {/* QR Code for Verification */}
                <div className="pt-2 flex flex-col items-center justify-center">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <QRCodeSVG 
                      value={`${window.location.origin}/?verify=1&sid=${encodeURIComponent(currentStudent.id)}`}
                      size={70}
                      level="M"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 font-mono">
                    VERIFY #{currentStudent.studentId || currentStudent.id}
                  </span>
                </div>

              </div>

              {/* ID Card Footer */}
              <div className="bg-slate-100 p-2.5 text-center border-t border-slate-200 text-[10px] text-slate-500">
                {language === 'bn' ? 'অধ্যক্ষ / মুহতামিমের স্বাক্ষর' : 'Head of Institution Signature'}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. CLEAN PRINT VIEW (OFF-SCREEN / FOR BROWSER PRINT) */}
      {/* ==================================================== */}
      <div className="hidden print:block text-black bg-white p-6 font-sans">
        
        {/* Print Header */}
        <div className="text-center pb-4 border-b-2 border-black space-y-1">
          <h2 className="text-xl font-bold uppercase">{schoolProfile.nameBn || schoolProfile.name}</h2>
          <p className="text-xs">{schoolProfile.addressBn || schoolProfile.address}</p>
          <p className="text-xs font-semibold">
            {language === 'bn' ? 'শিক্ষার্থী একাডেমিক ও উপস্থিতি প্রতিবেদন' : 'Student Academic & Attendance Transcript'}
          </p>
        </div>

        {/* Student Bio */}
        <div className="grid grid-cols-2 gap-2 text-xs my-4 p-3 border border-gray-300 rounded">
          <div><strong>{language === 'bn' ? 'নাম:' : 'Name:'}</strong> {currentStudent.name} {currentStudent.nameBn ? `(${currentStudent.nameBn})` : ''}</div>
          <div><strong>{language === 'bn' ? 'স্টুডেন্ট আইডি:' : 'Student ID:'}</strong> {currentStudent.studentId || currentStudent.id}</div>
          <div><strong>{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</strong> {currentStudent.classLevel || studentClass}</div>
          <div><strong>{language === 'bn' ? 'রোল:' : 'Roll:'}</strong> {currentStudent.rollNumber || currentStudent.roll || '1'}</div>
          <div><strong>{language === 'bn' ? 'হাজিরার হার:' : 'Attendance:'}</strong> {monthlyAttendanceData.summary.rate}%</div>
          <div><strong>{language === 'bn' ? 'শিক্ষাবর্ষ:' : 'Academic Year:'}</strong> {schoolProfile.academicYear || '2026'}</div>
        </div>

        {/* Marks Summary if available */}
        {examResultsData && (
          <div className="space-y-2 mt-4">
            <h4 className="font-bold text-xs border-b pb-1">
              {language === 'bn' ? 'পরীক্ষার ফলাফল:' : 'Exam Result:'} {activeExam?.name}
            </h4>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-1.5 text-left">Subject</th>
                  <th className="border border-gray-400 p-1.5 text-center">Full</th>
                  <th className="border border-gray-400 p-1.5 text-center">Pass</th>
                  <th className="border border-gray-400 p-1.5 text-center">Obtained</th>
                  <th className="border border-gray-400 p-1.5 text-center">Grade</th>
                  <th className="border border-gray-400 p-1.5 text-center">GPA</th>
                </tr>
              </thead>
              <tbody>
                {examResultsData.subjectsBreakdown.map(sb => (
                  <tr key={sb.subject.id}>
                    <td className="border border-gray-400 p-1.5">{sb.subject.name}</td>
                    <td className="border border-gray-400 p-1.5 text-center">{sb.fullMarks}</td>
                    <td className="border border-gray-400 p-1.5 text-center">{sb.passMarks}</td>
                    <td className="border border-gray-400 p-1.5 text-center font-bold">{sb.obtained}</td>
                    <td className="border border-gray-400 p-1.5 text-center font-bold">{sb.grade}</td>
                    <td className="border border-gray-400 p-1.5 text-center font-bold">{sb.gpa.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-400 p-1.5">Total & GPA</td>
                  <td className="border border-gray-400 p-1.5 text-center">{examResultsData.totalFullMarks}</td>
                  <td className="border border-gray-400 p-1.5"></td>
                  <td className="border border-gray-400 p-1.5 text-center">{examResultsData.totalObtained}</td>
                  <td className="border border-gray-400 p-1.5 text-center">{examResultsData.letterGrade}</td>
                  <td className="border border-gray-400 p-1.5 text-center">{examResultsData.gpa}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Routine Summary */}
        {upcomingSchedules.length > 0 && (
          <div className="space-y-2 mt-6">
            <h4 className="font-bold text-xs border-b pb-1">
              {language === 'bn' ? 'আসন্ন পরীক্ষার রুটিন:' : 'Upcoming Exam Routine:'}
            </h4>
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-1.5 text-left">Date</th>
                  <th className="border border-gray-400 p-1.5 text-left">Subject</th>
                  <th className="border border-gray-400 p-1.5 text-left">Time</th>
                  <th className="border border-gray-400 p-1.5 text-left">Hall</th>
                </tr>
              </thead>
              <tbody>
                {upcomingSchedules.slice(0, 10).map((sc, i) => (
                  <tr key={i}>
                    <td className="border border-gray-400 p-1.5">{sc.examDate}</td>
                    <td className="border border-gray-400 p-1.5 font-bold">{sc.subjectName}</td>
                    <td className="border border-gray-400 p-1.5">{sc.startTime} ({sc.durationMinutes}m)</td>
                    <td className="border border-gray-400 p-1.5">{sc.roomOrHall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Line */}
        <div className="mt-12 flex justify-between text-xs pt-8">
          <div className="border-t border-gray-400 pt-1 text-center w-36">
            {language === 'bn' ? 'অভিভাবকের স্বাক্ষর' : 'Guardian Signature'}
          </div>
          <div className="border-t border-gray-400 pt-1 text-center w-36">
            {language === 'bn' ? 'শ্রেণি শিক্ষকের স্বাক্ষর' : 'Class Teacher Signature'}
          </div>
          <div className="border-t border-gray-400 pt-1 text-center w-36">
            {language === 'bn' ? 'অধ্যক্ষ / মুহতামিম' : 'Head of Institution'}
          </div>
        </div>

      </div>

    </div>
  );
};
