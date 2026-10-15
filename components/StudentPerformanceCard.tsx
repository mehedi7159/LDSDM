import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  UserCheck, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Sparkles, 
  Filter, 
  GraduationCap,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  BarChart3,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  AreaChart, 
  Area 
} from 'recharts';
import { calculateTotalGPA, calculateGrade } from '../services/utils';
import { Student, Exam, Subject, MarkRecord } from '../types';

interface StudentPerformanceCardProps {
  initialClass?: string;
  initialStudentId?: string;
  studentId?: string;
}

export const StudentPerformanceCard: React.FC<StudentPerformanceCardProps> = ({ 
  initialClass = 'All',
  initialStudentId,
  studentId
}) => {
  const { 
    students = [], 
    subjects = [], 
    marks = [], 
    exams = [], 
    remarks = [], 
    classes = [], 
    language = 'bn', 
    t 
  } = useApp();

  const effectiveInitialStudentId = initialStudentId || studentId || '';
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClass);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(effectiveInitialStudentId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'exams' | 'subjects'>('overview');

  // Sync if initialStudentId or studentId changes
  useEffect(() => {
    const targetId = initialStudentId || studentId;
    if (targetId) {
      setSelectedStudentId(targetId);
      const studentObj = (students || []).find(s => s.id === targetId);
      if (studentObj && studentObj.classLevel) {
        setSelectedClassFilter(studentObj.classLevel);
      }
    }
  }, [initialStudentId, studentId, students]);

  // Convert English digits to Bengali numerals if language is Bengali
  const toBanglaDigits = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
      '.': '.'
    };
    return str.split('').map(char => banglaNums[char] || char).join('');
  };

  const getClassNameDisplay = (classLevel: string) => {
    const sClass = classes.find(c => c.name === classLevel);
    if (language === 'bn') {
      if (sClass?.nameBn) return sClass.nameBn;
      const key = `cls_${classLevel.replace(/\s+/g, '')}`;
      return t(key as any) || classLevel;
    }
    return sClass?.name || classLevel;
  };

  // Filter available students based on selected class and search
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status === 'Former') return false;
      const matchesClass = selectedClassFilter === 'All' || s.classLevel === selectedClassFilter;
      if (!matchesClass) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatches = (s.name && s.name.toLowerCase().includes(q)) || (s.nameBn && s.nameBn.includes(q));
      const idMatches = s.studentId && String(s.studentId).toLowerCase().includes(q);
      const rollMatches = s.roll != null && String(s.roll).toLowerCase().includes(q);
      return nameMatches || idMatches || rollMatches;
    }).sort((a, b) => {
      const rollA = parseInt(a.roll || '999', 10);
      const rollB = parseInt(b.roll || '999', 10);
      return rollA - rollB;
    });
  }, [students, selectedClassFilter, searchQuery]);

  // Current selected student fallback
  const currentStudent = useMemo(() => {
    if (selectedStudentId) {
      const found = students.find(s => s.id === selectedStudentId);
      if (found) return found;
    }
    return filteredStudents[0] || students[0] || null;
  }, [students, selectedStudentId, filteredStudents]);

  // Handle previous and next student navigation
  const handleNavigateStudent = (direction: 'prev' | 'next') => {
    if (!currentStudent || filteredStudents.length <= 1) return;
    const currentIndex = filteredStudents.findIndex(s => s.id === currentStudent.id);
    if (currentIndex === -1) {
      setSelectedStudentId(filteredStudents[0].id);
      return;
    }
    let targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0) targetIndex = filteredStudents.length - 1;
    if (targetIndex >= filteredStudents.length) targetIndex = 0;
    setSelectedStudentId(filteredStudents[targetIndex].id);
  };

  // Compute all exam performance records for the current student
  const studentExamRecords = useMemo(() => {
    if (!currentStudent) return [];

    const studentClassSubjects = subjects.filter(
      s => s.classLevel === currentStudent.classLevel && (!s.group || s.group === 'All' || s.group === currentStudent.group)
    );

    // Compute student performance for each exam
    const results = exams.map(exam => {
      // Find all marks for this student and exam
      const studentMarks = marks.filter(m => m.studentId === currentStudent.id && m.examId === exam.id);
      const appearedCount = studentMarks.length;

      // Calculate GPA and marks summary
      const gpaResult = calculateTotalGPA(
        studentClassSubjects,
        marks,
        currentStudent.id,
        exam.id,
        currentStudent.group,
        exams
      );

      // Compute total possible full marks for student's subjects
      const fullMarksPossible = studentClassSubjects.reduce((sum, sub) => sum + (sub.fullMarks || 100), 0);
      const marksPercentage = fullMarksPossible > 0 ? (gpaResult.totalMarks / fullMarksPossible) * 100 : 0;

      // Remark and Attendance
      const remarkRecord = remarks.find(r => r.studentId === currentStudent.id && r.examId === exam.id);

      // Merit position calculation within classmates for this exam
      const classmates = students.filter(s => s.classLevel === currentStudent.classLevel && s.status !== 'Former');
      const classmatesScores = classmates.map(c => {
        const cGpa = calculateTotalGPA(studentClassSubjects, marks, c.id, exam.id, c.group, exams);
        return { studentId: c.id, totalMarks: cGpa.totalMarks, gpa: cGpa.gpa };
      }).sort((a, b) => {
        if (b.gpa !== a.gpa) return b.gpa - a.gpa;
        return b.totalMarks - a.totalMarks;
      });

      const rankIndex = classmatesScores.findIndex(c => c.studentId === currentStudent.id);
      const rank = rankIndex !== -1 ? rankIndex + 1 : null;

      return {
        exam,
        appearedCount,
        hasData: appearedCount > 0,
        totalMarks: gpaResult.totalMarks,
        fullMarksPossible,
        marksPercentage: Math.round(marksPercentage * 10) / 10,
        gpa: gpaResult.gpa,
        grade: gpaResult.grade,
        isFail: gpaResult.isFail,
        failCount: gpaResult.failCount,
        remark: remarkRecord?.remark || '',
        presentDays: remarkRecord?.presentDays,
        absentDays: remarkRecord?.absentDays,
        totalWorkingDays: remarkRecord?.totalWorkingDays,
        rank,
        totalClassmates: classmates.length
      };
    });

    // Filter to exams that actually have mark records or are configured
    return results;
  }, [currentStudent, subjects, marks, exams, remarks, students]);

  // Exams that have actual data for this student
  const activeExamRecords = useMemo(() => {
    return studentExamRecords.filter(r => r.hasData);
  }, [studentExamRecords]);

  // Progression & Trajectory Analysis (Unnoti na Obonoti)
  const trajectoryAnalysis = useMemo(() => {
    if (activeExamRecords.length === 0) {
      return {
        status: 'NO_DATA',
        labelBn: 'কোনো পরীক্ষার তথ্য নেই',
        labelEn: 'No Exam Data',
        color: 'slate',
        deltaGpa: 0,
        deltaPercentage: 0,
        descriptionBn: 'এই শিক্ষার্থীর জন্য এখনও কোনো পরীক্ষার ফলাফল অ্যান্ট্রি করা হয়নি।',
        descriptionEn: 'No exam results have been recorded for this student yet.'
      };
    }

    if (activeExamRecords.length === 1) {
      const rec = activeExamRecords[0];
      const examName = rec.exam?.nameBn || rec.exam?.name || '';
      return {
        status: 'INITIAL',
        labelBn: 'প্রাথমিক মূল্যায়ন (১টি পরীক্ষা)',
        labelEn: 'Initial Evaluation (1 Exam)',
        color: rec.isFail ? 'rose' : 'blue',
        deltaGpa: 0,
        deltaPercentage: 0,
        descriptionBn: `শিক্ষার্থী ${examName}-এ জিপিএ ${toBanglaDigits(rec.gpa.toFixed(2))} (${rec.grade}) অর্জন করেছে। পরবর্তী পরীক্ষার ফলাফলের মাধ্যমে উন্নতির ধারা নিশ্চিত হবে।`,
        descriptionEn: `Student achieved GPA ${rec.gpa.toFixed(2)} (${rec.grade}) in ${rec.exam?.name || ''}. Future exam data will establish trend.`
      };
    }

    // Compare first exam vs latest exam, and immediate previous vs latest
    const firstExam = activeExamRecords[0];
    const latestExam = activeExamRecords[activeExamRecords.length - 1];
    const previousExam = activeExamRecords[activeExamRecords.length - 2];

    const deltaGpa = latestExam.gpa - previousExam.gpa;
    const deltaPercentage = latestExam.marksPercentage - previousExam.marksPercentage;
    const overallGpaDelta = latestExam.gpa - firstExam.gpa;

    if (deltaGpa >= 0.25 || deltaPercentage >= 3.5) {
      const prevName = previousExam?.exam?.nameBn || previousExam?.exam?.name || '';
      const prevNameEn = previousExam?.exam?.name || '';
      return {
        status: 'IMPROVING',
        labelBn: 'ধারাবাহিক উন্নতি হচ্ছে',
        labelEn: 'Continuous Improvement',
        color: 'emerald',
        icon: TrendingUp,
        deltaGpa,
        deltaPercentage,
        descriptionBn: `চমৎকার অগ্রগতি! বিগত পরীক্ষা (${prevName}) হতে সর্বশেষ পরীক্ষায় জিপিএ +${toBanglaDigits(deltaGpa.toFixed(2))} এবং প্রাপ্ত নম্বর +${toBanglaDigits(deltaPercentage.toFixed(1))}% বৃদ্ধি পেয়েছে।`,
        descriptionEn: `Great progress! Compared to the previous exam (${prevNameEn}), GPA improved by +${deltaGpa.toFixed(2)} and overall score increased by +${deltaPercentage.toFixed(1)}%.`
      };
    } else if (deltaGpa <= -0.25 || deltaPercentage <= -3.5 || (latestExam.isFail && !previousExam.isFail)) {
      return {
        status: 'DECLINING',
        labelBn: 'অবনতি হচ্ছে / বিশেষ যত্ন প্রয়োজন',
        labelEn: 'Declining / Needs Attention',
        color: 'rose',
        icon: TrendingDown,
        deltaGpa,
        deltaPercentage,
        descriptionBn: `সতর্কতা! বিগত পরীক্ষার তুলনায় সর্বশেষ পরীক্ষায় জিপিএ ${toBanglaDigits(Math.abs(deltaGpa).toFixed(2))} এবং নম্বর ${toBanglaDigits(Math.abs(deltaPercentage).toFixed(1))}% হ্রাস পেয়েছে। দুর্বল বিষয়গুলোতে বিশেষ পাঠদান প্রয়োজন।`,
        descriptionEn: `Alert! Compared to the previous exam, GPA declined by ${Math.abs(deltaGpa).toFixed(2)} and overall score dropped by ${Math.abs(deltaPercentage).toFixed(1)}%. Remedial focus is required.`
      };
    } else {
      return {
        status: 'STABLE',
        labelBn: 'ফলাফল স্থিতিশীল ও ধারাবাহিক',
        labelEn: 'Stable & Consistent',
        color: 'blue',
        icon: Minus,
        deltaGpa,
        deltaPercentage,
        descriptionBn: `শিক্ষার্থী পূর্ববর্তী পরীক্ষার মতো সন্তোষজনক ধারাবাহিকতা বজায় রেখেছে (জিপিএ পরিবর্তন: ${deltaGpa >= 0 ? '+' : ''}${toBanglaDigits(deltaGpa.toFixed(2))})।`,
        descriptionEn: `Student maintained steady performance across exams (GPA change: ${deltaGpa >= 0 ? '+' : ''}${deltaGpa.toFixed(2)}).`
      };
    }
  }, [activeExamRecords, language]);

  // Subject-wise Detailed Breakdown & Strength/Weakness Analysis
  const subjectPerformanceAnalysis = useMemo(() => {
    if (!currentStudent) return { allSubjects: [], strongSubjects: [], weakSubjects: [], developingSubjects: [] };

    const studentClassSubjects = subjects.filter(
      s => s.classLevel === currentStudent.classLevel && (!s.group || s.group === 'All' || s.group === currentStudent.group)
    );

    const subjectStats = studentClassSubjects.map(sub => {
      // Find marks for this subject across all exams
      const subMarks = activeExamRecords.map(rec => {
        const mark = marks.find(m => m.studentId === currentStudent.id && m.subjectId === sub.id && m.examId === rec.exam.id);
        const obtained = mark ? mark.obtained : 0;
        const percent = Math.round((obtained / (sub.fullMarks || 100)) * 100);
        const { grade, gpa } = calculateGrade(obtained, sub.fullMarks);
        const isPass = obtained >= (sub.passMarks || 33);

        return {
          examId: rec.exam?.id || '',
          examName: rec.exam?.nameBn || rec.exam?.name || '',
          obtained,
          fullMarks: sub.fullMarks,
          percent,
          grade,
          gpa,
          isPass,
          isAbsent: mark?.isAbsent || false
        };
      });

      if (subMarks.length === 0) {
        return {
          subject: sub,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          latestScore: 0,
          trend: 0,
          passRate: 0,
          failCount: 0,
          status: 'UNRATED' as const,
          subMarks: []
        };
      }

      const totalPercentage = subMarks.reduce((acc, m) => acc + m.percent, 0);
      const avgScore = Math.round(totalPercentage / subMarks.length);
      const highestScore = Math.max(...subMarks.map(m => m.percent));
      const lowestScore = Math.min(...subMarks.map(m => m.percent));
      const latestMark = subMarks[subMarks.length - 1];
      const firstMark = subMarks[0];
      const trend = latestMark.percent - firstMark.percent;
      const failCount = subMarks.filter(m => !m.isPass).length;
      const passRate = Math.round(((subMarks.length - failCount) / subMarks.length) * 100);

      // Determine strength classification
      let status: 'STRONG' | 'WEAK' | 'DEVELOPING' = 'DEVELOPING';
      if (avgScore >= 72 && failCount === 0 && latestMark.percent >= 65) {
        status = 'STRONG';
      } else if (avgScore < 45 || failCount > 0 || latestMark.percent < (sub.passMarks || 33) + 5) {
        status = 'WEAK';
      } else {
        status = 'DEVELOPING';
      }

      return {
        subject: sub,
        averageScore: avgScore,
        highestScore,
        lowestScore,
        latestScore: latestMark.percent,
        latestObtained: latestMark.obtained,
        latestGrade: latestMark.grade,
        trend,
        passRate,
        failCount,
        status,
        subMarks
      };
    });

    // Filter into categorized buckets
    const strongSubjects = subjectStats.filter(s => s.status === 'STRONG').sort((a, b) => b.averageScore - a.averageScore);
    const weakSubjects = subjectStats.filter(s => s.status === 'WEAK').sort((a, b) => a.averageScore - b.averageScore);
    const developingSubjects = subjectStats.filter(s => s.status === 'DEVELOPING').sort((a, b) => b.averageScore - a.averageScore);

    return {
      allSubjects: subjectStats,
      strongSubjects,
      weakSubjects,
      developingSubjects
    };
  }, [currentStudent, subjects, marks, activeExamRecords]);

  // Trajectory Chart Data for Recharts
  const chartTrajectoryData = useMemo(() => {
    return activeExamRecords.map(rec => ({
      name: rec.exam?.nameBn || rec.exam?.name || '',
      fullName: rec.exam?.nameBn || rec.exam?.name || '',
      GPA: rec.gpa,
      Percentage: rec.marksPercentage,
      totalMarks: rec.totalMarks,
      fullMarks: rec.fullMarksPossible,
      grade: rec.grade,
      isFail: rec.isFail,
      failCount: rec.failCount,
      rank: rec.rank
    }));
  }, [activeExamRecords]);

  // Overall Lifetime / Multi-Exam Aggregates
  const overallMetrics = useMemo(() => {
    if (activeExamRecords.length === 0) return { avgGpa: 0, avgMarksPercent: 0, totalExams: 0, passCount: 0 };
    const totalGpa = activeExamRecords.reduce((sum, r) => sum + r.gpa, 0);
    const totalPct = activeExamRecords.reduce((sum, r) => sum + r.marksPercentage, 0);
    const passCount = activeExamRecords.filter(r => !r.isFail).length;

    return {
      avgGpa: Math.round((totalGpa / activeExamRecords.length) * 100) / 100,
      avgMarksPercent: Math.round(totalPct / activeExamRecords.length),
      totalExams: activeExamRecords.length,
      passCount,
      failCount: activeExamRecords.length - passCount
    };
  }, [activeExamRecords]);

  return (
    <div id="student-performance-analysis-card" className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden mb-6 transition-all">
      {/* Top Header & Context Banner */}
      <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {language === 'bn' ? 'শিক্ষার্থীর ধারাবাহিক পারফরম্যান্স ও গতিপথ বিশ্লেষণ' : 'Individual Student Performance & Trajectory'}
              </h2>
              <p className="text-xs text-slate-300 font-normal">
                {language === 'bn'
                  ? 'সকল পরীক্ষার ফলাফল, উন্নতির বা অবনতির ধারা (Trajectory), এবং বিষয়ভিত্তিক শক্তি ও দুর্বলতা।'
                  : 'Multi-exam progression tracking, progress vs decline diagnosis, and strengths & weaknesses breakdown.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Class Filter & Quick Search Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 rounded-xl px-3 py-1.5 border border-slate-700">
            <Filter className="h-3.5 w-3.5 text-indigo-300" />
            <select
              id="student-perf-class-filter"
              value={selectedClassFilter}
              onChange={(e) => {
                setSelectedClassFilter(e.target.value);
                setSelectedStudentId(''); // reset to top student in new class
              }}
              aria-label={language === 'bn' ? 'শ্রেণী নির্বাচন' : 'Select Class'}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="All" className="text-slate-800">{language === 'bn' ? 'সকল শ্রেণী' : 'All Classes'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.name} className="text-slate-800">
                  {language === 'bn' ? (c.nameBn || c.name) : c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search Student Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="student-perf-search-input"
              type="text"
              placeholder={language === 'bn' ? 'নাম / রোল / আইডি খুঁজুন...' : 'Search student...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-800/90 text-white placeholder-slate-400 text-xs rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Student Selector Bar & Profile Snapshot */}
      <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
        {/* Student Select Dropdown + Prev/Next Buttons */}
        <div className="flex items-center gap-2 max-w-xl w-full">
          <button
            id="student-perf-prev-btn"
            onClick={() => handleNavigateStudent('prev')}
            disabled={filteredStudents.length <= 1}
            title={language === 'bn' ? 'পূর্ববর্তী শিক্ষার্থী' : 'Previous Student'}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="relative flex-1">
            <select
              id="student-perf-select"
              value={currentStudent?.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              aria-label={language === 'bn' ? 'শিক্ষার্থী নির্বাচন করুন' : 'Select Student'}
              className="w-full pl-3.5 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer truncate"
            >
              {filteredStudents.length === 0 ? (
                <option value="">{language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No student found'}</option>
              ) : (
                filteredStudents.map(std => (
                  <option key={std.id} value={std.id}>
                    {language === 'bn' ? (std.nameBn || std.name) : std.name} • {language === 'bn' ? `রোল ${toBanglaDigits(std.roll || '—')}` : `Roll ${std.roll || '—'}`} • {getClassNameDisplay(std.classLevel)}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            id="student-perf-next-btn"
            onClick={() => handleNavigateStudent('next')}
            disabled={filteredStudents.length <= 1}
            title={language === 'bn' ? 'পরবর্তী শিক্ষার্থী' : 'Next Student'}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Selected Student Meta Badges */}
        {currentStudent && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
              <span className="text-slate-400 font-normal">{language === 'bn' ? 'রোল:' : 'Roll:'}</span>
              <span className="font-mono text-indigo-700">{toBanglaDigits(currentStudent.roll || '—')}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
              <span className="text-slate-400 font-normal">{language === 'bn' ? 'আইডি:' : 'ID:'}</span>
              <span className="font-mono text-slate-800">{toBanglaDigits(currentStudent.studentId || currentStudent.id || '—')}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold shadow-2xs">
              <span className="text-indigo-400 font-normal">{language === 'bn' ? 'শ্রেণী:' : 'Class:'}</span>
              <span>{getClassNameDisplay(currentStudent.classLevel)}</span>
            </span>

            {currentStudent.group && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold shadow-2xs">
                <span>{currentStudent.group}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {!currentStudent ? (
        <div className="p-12 text-center text-slate-400">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-slate-600">
            {language === 'bn' ? 'অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন' : 'Please select a student to view performance details'}
          </p>
        </div>
      ) : (
        <div className="p-5 sm:p-6 space-y-6">
          
          {/* Row 1: KPI Stat Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Evaluated Exams */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {language === 'bn' ? 'মূল্যায়িত পরীক্ষা' : 'Exams Taken'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                {toBanglaDigits(overallMetrics.totalExams)} <span className="text-xs font-normal text-slate-400">{language === 'bn' ? 'টি' : 'exams'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {language === 'bn' ? `পাস: ${toBanglaDigits(overallMetrics.passCount)} | ফেল: ${toBanglaDigits(overallMetrics.failCount)}` : `Pass: ${overallMetrics.passCount} | Fail: ${overallMetrics.failCount}`}
              </div>
            </div>

            {/* KPI 2: Overall Avg GPA */}
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100/80 space-y-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-indigo-500" />
                {language === 'bn' ? 'গড় জিপিএ (সকল পরীক্ষা)' : 'Cumulative GPA'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">
                {toBanglaDigits(overallMetrics.avgGpa.toFixed(2))}
                <span className="text-xs font-normal text-indigo-400 ml-1">/ ৫.০০</span>
              </div>
              <div className="text-[11px] text-indigo-600 font-semibold">
                {language === 'bn' ? `গড় নম্বর: ${toBanglaDigits(overallMetrics.avgMarksPercent)}%` : `Avg Score: ${overallMetrics.avgMarksPercent}%`}
              </div>
            </div>

            {/* KPI 3: Latest Exam Performance */}
            {activeExamRecords.length > 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100/80 space-y-1">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {language === 'bn' ? 'সর্বশেষ পরীক্ষার ফলাফল' : 'Latest Exam Result'}
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
                  {toBanglaDigits(activeExamRecords[activeExamRecords.length - 1].gpa.toFixed(2))}
                  <span className="text-xs font-bold text-emerald-600 ml-1.5 px-2 py-0.5 bg-emerald-100 rounded-full">
                    {activeExamRecords[activeExamRecords.length - 1].grade}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium truncate">
                  {activeExamRecords[activeExamRecords.length - 1]?.exam?.nameBn || activeExamRecords[activeExamRecords.length - 1]?.exam?.name || ''}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'সর্বশেষ পরীক্ষা' : 'Latest Exam'}</div>
                <div className="text-xl font-bold text-slate-400">—</div>
              </div>
            )}

            {/* KPI 4: Trajectory Status Chip */}
            <div className={`p-4 rounded-xl border space-y-1 ${
              trajectoryAnalysis.color === 'emerald' ? 'bg-emerald-50/60 border-emerald-200' :
              trajectoryAnalysis.color === 'rose' ? 'bg-rose-50/60 border-rose-200' :
              'bg-blue-50/60 border-blue-200'
            }`}>
              <div className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                trajectoryAnalysis.color === 'emerald' ? 'text-emerald-700' :
                trajectoryAnalysis.color === 'rose' ? 'text-rose-700' : 'text-blue-700'
              }`}>
                {trajectoryAnalysis.color === 'emerald' ? <TrendingUp className="h-3.5 w-3.5" /> :
                 trajectoryAnalysis.color === 'rose' ? <TrendingDown className="h-3.5 w-3.5" /> :
                 <Minus className="h-3.5 w-3.5" />}
                {language === 'bn' ? 'উন্নতির গতিপথ (Trajectory)' : 'Overall Trajectory'}
              </div>
              <div className={`text-base sm:text-lg font-black leading-tight ${
                trajectoryAnalysis.color === 'emerald' ? 'text-emerald-800' :
                trajectoryAnalysis.color === 'rose' ? 'text-rose-800' : 'text-blue-800'
              }`}>
                {language === 'bn' ? trajectoryAnalysis.labelBn : trajectoryAnalysis.labelEn}
              </div>
              <div className="text-[11px] font-semibold text-slate-600">
                {trajectoryAnalysis.deltaGpa !== 0 ? (
                  <span>
                    {trajectoryAnalysis.deltaGpa > 0 ? '+' : ''}{toBanglaDigits(trajectoryAnalysis.deltaGpa.toFixed(2))} GPA ({trajectoryAnalysis.deltaPercentage > 0 ? '+' : ''}{toBanglaDigits(trajectoryAnalysis.deltaPercentage.toFixed(1))}%)
                  </span>
                ) : (
                  <span>{language === 'bn' ? 'কোনো তারতম্য নেই' : 'Consistent performance'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Trajectory Diagnosis Banner (Unnoti na Obonoti Insight) */}
          <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            trajectoryAnalysis.color === 'emerald' ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-900' :
            trajectoryAnalysis.color === 'rose' ? 'bg-rose-50/40 border-rose-200/80 text-rose-900' :
            'bg-indigo-50/40 border-indigo-200/80 text-indigo-900'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                trajectoryAnalysis.color === 'emerald' ? 'bg-emerald-500 text-white' :
                trajectoryAnalysis.color === 'rose' ? 'bg-rose-500 text-white' :
                'bg-indigo-600 text-white'
              }`}>
                {trajectoryAnalysis.color === 'emerald' ? <TrendingUp className="h-5 w-5" /> :
                 trajectoryAnalysis.color === 'rose' ? <AlertTriangle className="h-5 w-5" /> :
                 <Sparkles className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <span>{language === 'bn' ? 'পারফরম্যান্স পর্যালোচনা ও অভিমত' : 'Performance Diagnosis & Trajectory'}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    trajectoryAnalysis.color === 'emerald' ? 'bg-emerald-100 border-emerald-200 text-emerald-800' :
                    trajectoryAnalysis.color === 'rose' ? 'bg-rose-100 border-rose-200 text-rose-800' :
                    'bg-indigo-100 border-indigo-200 text-indigo-800'
                  }`}>
                    {language === 'bn' ? trajectoryAnalysis.labelBn : trajectoryAnalysis.labelEn}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                  {language === 'bn' ? trajectoryAnalysis.descriptionBn : trajectoryAnalysis.descriptionEn}
                </p>
              </div>
            </div>

            {/* Quick stats delta box */}
            {activeExamRecords.length > 1 && (
              <div className="flex items-center gap-3 shrink-0 bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">{language === 'bn' ? 'জিপিএ পরিবর্তন' : 'GPA Delta'}</div>
                  <div className={`text-sm font-black font-mono ${trajectoryAnalysis.deltaGpa >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {trajectoryAnalysis.deltaGpa >= 0 ? '▲ +' : '▼ '}{toBanglaDigits(trajectoryAnalysis.deltaGpa.toFixed(2))}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">{language === 'bn' ? 'নম্বর পরিবর্তন' : 'Marks Delta'}</div>
                  <div className={`text-sm font-black font-mono ${trajectoryAnalysis.deltaPercentage >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {trajectoryAnalysis.deltaPercentage >= 0 ? '▲ +' : '▼ '}{toBanglaDigits(trajectoryAnalysis.deltaPercentage.toFixed(1))}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Visual Trajectory Trend Chart (Chronological Across All Exams) */}
          {activeExamRecords.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-600" />
                    {language === 'bn' ? 'পরীক্ষাসমূহের ফলাফলের ধারা ও গ্রাফিক্যাল ট্রেন্ড' : 'Exam Performance Progression Graph'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'bn' ? 'সকল পরীক্ষায় প্রাপ্ত জিপিএ ও মোট নম্বরের শতকরার তুলনামূলক চিত্র' : 'Comparative trend of GPA & Total Percentage across all examinations'}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    {language === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {language === 'bn' ? 'শতকরা নম্বর (%)' : 'Score %'}
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTrajectoryData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} stroke="#64748b" />
                    <YAxis yAxisId="left" domain={[0, 5]} fontSize={11} tickLine={false} axisLine={false} stroke="#6366f1" tickFormatter={(v) => toBanglaDigits(v)} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} stroke="#10b981" tickFormatter={(v) => `${toBanglaDigits(v)}%`} />
                    <RechartsTooltip 
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-xs p-3.5 rounded-xl shadow-xl border border-slate-200/80 text-xs space-y-2 min-w-[210px]">
                            <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                              <span>{data.fullName}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${data.isFail ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {data.isFail ? (language === 'bn' ? 'অকৃতকার্য' : 'Fail') : (language === 'bn' ? 'উত্তীর্ণ' : 'Pass')}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-4 text-indigo-700 font-bold">
                                <span>{language === 'bn' ? 'অর্জিত জিপিএ:' : 'GPA:'}</span>
                                <span className="font-mono text-sm font-black">{toBanglaDigits(Number(data.GPA).toFixed(2))} <span className="text-[10px] text-slate-400">({data.grade})</span></span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-emerald-700 font-semibold">
                                <span>{language === 'bn' ? 'মোট অর্জিত নম্বর:' : 'Total Marks:'}</span>
                                <span className="font-mono font-bold">{toBanglaDigits(data.totalMarks)} / {toBanglaDigits(data.fullMarks)} ({toBanglaDigits(data.Percentage)}%)</span>
                              </div>
                              {data.rank && (
                                <div className="flex items-center justify-between gap-4 text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                                  <span>{language === 'bn' ? 'শ্রেণীতে স্থান:' : 'Class Rank:'}</span>
                                  <span className="font-mono font-bold text-amber-700">{toBanglaDigits(data.rank)} তম</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="GPA" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }} activeDot={{ r: 7 }} />
                    <Line yAxisId="right" type="monotone" dataKey="Percentage" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Row 4: Subject Strength vs Weakness Diagnosis (User Request Core) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                {language === 'bn' ? 'বিষয়ভিত্তিক দক্ষতা ও দুর্বলতার পর্যালোচনা' : 'Subject Strengths & Weaknesses Analysis'}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'bn' ? `মোট বিষয়: ${toBanglaDigits(subjectPerformanceAnalysis.allSubjects.length)} টি` : `Total Subjects: ${subjectPerformanceAnalysis.allSubjects.length}`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Strong Subjects Panel */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/70 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500 text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        {language === 'bn' ? 'শক্তিশালী বিষয়সমূহ (Strengths)' : 'Strong Subjects'}
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        {language === 'bn' ? 'উচ্চ নম্বর ও ধারাবাহিক সাফল্য প্রাপ্ত বিষয়' : 'Consistent high marks (≥70%) with no failures'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-black bg-emerald-100 text-emerald-800 rounded-full">
                    {toBanglaDigits(subjectPerformanceAnalysis.strongSubjects.length)} {language === 'bn' ? 'টি' : ''}
                  </span>
                </div>

                {subjectPerformanceAnalysis.strongSubjects.length === 0 ? (
                  <div className="py-6 text-center text-xs text-emerald-600/80 italic">
                    {language === 'bn' ? 'কোনো বিষয় এখনো শক্তিশালী হিসেবে চিহ্নিত হয়নি' : 'No subjects currently classified as strong'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {subjectPerformanceAnalysis.strongSubjects.map(item => (
                      <div key={item.subject.id} className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {language === 'bn' ? (item.subject.nameBn || item.subject.name) : item.subject.name}
                          </div>
                          <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {language === 'bn' ? 'গড়' : 'Avg'}: {toBanglaDigits(item.averageScore)}%
                          </span>
                        </div>
                        {/* Progress visual bar */}
                        <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, item.averageScore)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>{language === 'bn' ? `সর্বশেষ: ${toBanglaDigits(item.latestScore)}% (গ্রেড ${item.latestGrade})` : `Latest: ${item.latestScore}% (${item.latestGrade})`}</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            {item.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {item.trend >= 0 ? `+${toBanglaDigits(item.trend)}%` : `${toBanglaDigits(item.trend)}%`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak / At-Risk Subjects Panel */}
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/40 border border-rose-200/70 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-500 text-white">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-rose-950">
                        {language === 'bn' ? 'দুর্বল বিষয় ও বিশেষ যত্ন প্রয়োজন (Weaknesses)' : 'Subjects Needing Attention'}
                      </h4>
                      <p className="text-[11px] text-rose-700">
                        {language === 'bn' ? 'কম নম্বর বা ফেলের ঝুঁকিযুক্ত বিষয়' : 'Low average score (<50%) or previous failures'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-black bg-rose-100 text-rose-800 rounded-full">
                    {toBanglaDigits(subjectPerformanceAnalysis.weakSubjects.length)} {language === 'bn' ? 'টি' : ''}
                  </span>
                </div>

                {subjectPerformanceAnalysis.weakSubjects.length === 0 ? (
                  <div className="py-6 text-center text-xs text-emerald-700 font-medium">
                    {language === 'bn' ? '🎉 মাশাআল্লাহ! শিক্ষার্থীর কোনো দুর্বল বিষয় চিহ্নিত হয়নি।' : 'Great! Student has no failing or weak subjects.'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {subjectPerformanceAnalysis.weakSubjects.map(item => (
                      <div key={item.subject.id} className="p-3 bg-white rounded-xl border border-rose-100 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            {language === 'bn' ? (item.subject.nameBn || item.subject.name) : item.subject.name}
                          </div>
                          <span className="font-mono text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            {language === 'bn' ? 'গড়' : 'Avg'}: {toBanglaDigits(item.averageScore)}%
                          </span>
                        </div>
                        {/* Progress visual bar */}
                        <div className="w-full bg-rose-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${Math.min(100, item.averageScore)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span className="text-rose-600 font-bold">
                            {item.failCount > 0 
                              ? (language === 'bn' ? `${toBanglaDigits(item.failCount)} বার অকৃতকার্য` : `Failed ${item.failCount} times`)
                              : (language === 'bn' ? 'পাস নম্বরের কাছাকাছি' : 'Near pass threshold')}
                          </span>
                          <span className="text-slate-600 font-medium">
                            {language === 'bn' ? `সর্বশেষ: ${toBanglaDigits(item.latestScore)}%` : `Latest: ${item.latestScore}%`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Row 5: Detailed Exam History Table (সকল পরীক্ষার তথ্য ও সারসংক্ষেপ) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                {language === 'bn' ? 'সকল পরীক্ষার ফলাফল তালিকা' : 'Complete Exam History Records'}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {language === 'bn' ? `মোট পরীক্ষা: ${toBanglaDigits(activeExamRecords.length)} টি` : `Total Records: ${activeExamRecords.length}`}
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-100">
                    <th className="py-3 px-3.5">{language === 'bn' ? 'পরীক্ষার নাম' : 'Examination'}</th>
                    <th className="py-3 px-3.5">{language === 'bn' ? 'শিক্ষাবর্ষ' : 'Year'}</th>
                    <th className="py-3 px-3.5 text-right">{language === 'bn' ? 'মোট নম্বর' : 'Total Marks'}</th>
                    <th className="py-3 px-3.5 text-right">{language === 'bn' ? 'শতকরা (%)' : 'Score %'}</th>
                    <th className="py-3 px-3.5 text-right">{language === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}</th>
                    <th className="py-3 px-3.5 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                    <th className="py-3 px-3.5 text-center">{language === 'bn' ? 'ফলাফল' : 'Status'}</th>
                    <th className="py-3 px-3.5 text-center">{language === 'bn' ? 'শ্রেণীতে স্থান' : 'Merit Rank'}</th>
                    <th className="py-3 px-3.5">{language === 'bn' ? 'উপস্থিতি / মন্তব্য' : 'Attendance & Note'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {studentExamRecords.map((rec) => {
                    const isEvaluated = rec.hasData;
                    return (
                      <tr key={rec.exam?.id || Math.random()} className={`hover:bg-slate-50/80 transition-colors ${!isEvaluated ? 'opacity-50' : ''}`}>
                        <td className="py-3 px-3.5 font-bold text-slate-800">
                          {rec.exam?.nameBn || rec.exam?.name || ''}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">
                          {toBanglaDigits(rec.exam?.academicYear || '')}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                          {isEvaluated ? toBanglaDigits(rec.totalMarks) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">
                          {isEvaluated ? `${toBanglaDigits(rec.marksPercentage)}%` : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-black text-indigo-700">
                          {isEvaluated ? toBanglaDigits(rec.gpa.toFixed(2)) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isEvaluated ? (
                            <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-100">
                              {rec.grade}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isEvaluated ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              rec.isFail ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {rec.isFail ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              {rec.isFail 
                                ? (language === 'bn' ? `অকৃতকার্য (${toBanglaDigits(rec.failCount)})` : `Fail (${rec.failCount})`)
                                : (language === 'bn' ? 'উত্তীর্ণ' : 'Pass')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">{language === 'bn' ? 'অ্যান্ট্রি হয়নি' : 'Not recorded'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center font-bold font-mono text-amber-700">
                          {isEvaluated && rec.rank ? (
                            <span>{toBanglaDigits(rec.rank)} / {toBanglaDigits(rec.totalClassmates)}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3.5 text-slate-500 text-[11px]">
                          {rec.presentDays !== undefined && rec.absentDays !== undefined ? (
                            <span>
                              {language === 'bn' ? `উপস্থিতি: ${toBanglaDigits(rec.presentDays)} দিন, অনুপস্থিতি: ${toBanglaDigits(rec.absentDays)} দিন` : `Pres: ${rec.presentDays}d, Abs: ${rec.absentDays}d`}
                            </span>
                          ) : rec.remark ? (
                            <span>{rec.remark}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 6: Pedagogical Recommendations (শিক্ষার্থীর সার্বিক উন্নতির জন্য পরামর্শ) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>{language === 'bn' ? 'শিক্ষকের জন্য অ্যাকাডেমিক দিকনির্দেশনা ও সুপারিশ' : 'Academic Remedial Recommendations'}</span>
            </div>
            <ul className="text-xs text-amber-950 space-y-1.5 list-disc pl-5 font-normal leading-relaxed">
              {subjectPerformanceAnalysis.weakSubjects.length > 0 ? (
                <li>
                  <strong>{language === 'bn' ? 'বিশেষ যত্ন:' : 'Remedial Care:'}</strong>{' '}
                  {language === 'bn' 
                    ? `শিক্ষার্থী ${subjectPerformanceAnalysis.weakSubjects.map(s => s.subject?.nameBn || s.subject?.name || '').filter(Boolean).join(', ')} বিষয়ে দুর্বলতা প্রদর্শন করছে। সংশ্লিষ্ট বিষয় শিক্ষকদের মাধ্যমে বিশেষ রিভিশন ক্লাস ও দৈনিক বাড়ির কাজের তদারকি জোরদার করা আবশ্যক।`
                    : `Student shows struggle in ${subjectPerformanceAnalysis.weakSubjects.map(s => s.subject?.name || '').filter(Boolean).join(', ')}. Targeted coaching and homework tracking recommended.`}
                </li>
              ) : (
                <li>
                  <strong>{language === 'bn' ? 'প্রশংসা:' : 'Commendation:'}</strong>{' '}
                  {language === 'bn'
                    ? 'শিক্ষার্থী সকল বিষয়ে ইতিবাচক ধারাবাহিকতা প্রদর্শন করছে। চূড়ান্ত পরীক্ষায় সেরা ফলাফলের জন্য এই অধ্যবসায় বজায় রাখা উচিত।'
                    : 'Student is maintaining consistent performance across all subjects. Keep up the good work for final exams.'}
                </li>
              )}
              {subjectPerformanceAnalysis.strongSubjects.length > 0 && (
                <li>
                  <strong>{language === 'bn' ? 'উৎসাহ প্রদান:' : 'Strengths Focus:'}</strong>{' '}
                  {language === 'bn'
                    ? `${subjectPerformanceAnalysis.strongSubjects.map(s => s.subject?.nameBn || s.subject?.name || '').filter(Boolean).slice(0, 3).join(', ')} বিষয়ে শিক্ষার্থী অত্যন্ত মেধাবী; অন্যান্য বিষয়েও সমভাবে মনোযোগ দিলে পূর্ণাঙ্গ জিপিএ ৫.০০ নিশ্চিত হবে।`
                    : `Student excels in ${subjectPerformanceAnalysis.strongSubjects.map(s => s.subject?.name || '').filter(Boolean).slice(0, 3).join(', ')}. Encouraging similar dedication across other subjects will secure top tier GPA.`}
                </li>
              )}
              <li>
                <strong>{language === 'bn' ? 'অভিভাবক সংযোগ:' : 'Guardian Collaboration:'}</strong>{' '}
                {language === 'bn'
                  ? 'উন্নতির ধারা ও বর্তমান পারফরম্যান্স সম্পর্কে অভিভাবককে অবহিত করুন এবং নিয়মিত উপস্থিতি বজায় রাখতে উৎসাহিত করুন।'
                  : 'Share this progress trajectory with guardians and encourage regular attendance.'}
              </li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
};
