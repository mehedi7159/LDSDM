import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Award, 
  Search, 
  Users, 
  User, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  GraduationCap, 
  BarChart3, 
  Sparkles, 
  TrendingUp, 
  Filter,
  Eye,
  Calendar,
  Layers,
  Star,
  Trophy,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { calculateTotalGPA, calculateGrade, getConsolidatedMark, getAutoRemark } from '../services/utils';
import { Exam, SchoolClass, Student, Subject } from '../types';

export const WebResultView: React.FC = () => {
  const { 
    students = [], 
    classes = [], 
    exams = [], 
    subjects = [], 
    marks = [], 
    remarks = [], 
    schoolProfile, 
    language, 
    t,
    setActiveTab 
  } = useApp();

  // Mode: 'student' (single student result card) or 'class' (class-wise merit & results list)
  const [viewMode, setViewMode] = useState<'student' | 'class'>('student');

  // Exam Selection
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    return exams.length > 0 ? exams[0].id : '';
  });

  // Class Selection
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    return classes.length > 0 ? classes[0].name : '';
  });

  // Student Search / Selection
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Class-wise filters
  const [classSearchQuery, setClassSearchQuery] = useState<string>('');
  const [classStatusFilter, setClassStatusFilter] = useState<'all' | 'pass' | 'fail' | 'gpa5'>('all');

  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  // Bengali numerals helper
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

  // Active students in the selected class
  const classStudents = useMemo(() => {
    return (students || [])
      .filter(s => (s.class === selectedClass || s.classLevel === selectedClass) && s.status === 'active' && !s.isFormer)
      .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [students, selectedClass]);

  // Subjects for the selected class & exam
  const classSubjects = useMemo(() => {
    const subsInClass = (subjects || []).filter(s => s.classLevel === selectedClass);
    if (!selectedExam) return subsInClass;
    const subsInExam = subsInClass.filter(s => s.examIds && s.examIds.includes(selectedExam.id));
    return subsInExam.length > 0 ? subsInExam : subsInClass;
  }, [subjects, selectedClass, selectedExam]);

  // Process all students in the class for class-wise view and rankings
  const processedClassResults = useMemo(() => {
    if (!selectedExam) return [];

    const list = classStudents.map(student => {
      const stats = calculateTotalGPA(classSubjects, marks, student.id, selectedExam.id, student.group, exams);
      return {
        student,
        ...stats
      };
    });

    // Sort by Merit: Passed first, then higher GPA, then higher total marks
    list.sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
        if (a.failCount !== b.failCount) return a.failCount - b.failCount;
        return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
    });

    // Assign Rank
    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [classStudents, classSubjects, marks, selectedExam, exams]);

  // Selected student details for Student-wise View
  const activeStudentResult = useMemo(() => {
    if (!selectedStudentId && classStudents.length > 0) {
      const defaultId = classStudents[0].id;
      return processedClassResults.find(r => r.student.id === defaultId) || processedClassResults[0];
    }
    return processedClassResults.find(r => r.student.id === selectedStudentId);
  }, [processedClassResults, selectedStudentId, classStudents]);

  // Detailed subject-wise breakdown for the selected student
  const studentSubjectBreakdown = useMemo(() => {
    if (!activeStudentResult || !selectedExam) return [];
    const student = activeStudentResult.student;

    return classSubjects.map(sub => {
      let markRecord = marks.find(
        m => m.studentId === student.id && m.subjectId === sub.id && m.examId === selectedExam.id
      );

      if (exams) {
        const consolidated = getConsolidatedMark(student.id, sub.id, selectedExam.id, exams, marks);
        if (consolidated) markRecord = consolidated;
      }

      const obtained = markRecord?.obtained ?? 0;
      const isAbsent = markRecord?.isAbsent ?? false;
      const cq = markRecord?.obtainedCQ;
      const mcq = markRecord?.obtainedMCQ;

      let isSubjectFail = false;
      if (isAbsent) {
        isSubjectFail = true;
      } else if (sub.hasCQ && (cq ?? 0) < (sub.cqPassMarks ?? 0)) {
        isSubjectFail = true;
      } else if (sub.hasMCQ && (mcq ?? 0) < (sub.mcqPassMarks ?? 0)) {
        isSubjectFail = true;
      } else if (!sub.hasCQ && !sub.hasMCQ && obtained < sub.passMarks) {
        isSubjectFail = true;
      }

      const { grade, gpa } = calculateGrade(obtained, sub.fullMarks);

      // Calculate class highest in this subject
      const allClassMarksInSub = marks
        .filter(m => m.subjectId === sub.id && m.examId === selectedExam.id)
        .map(m => m.obtained || 0);
      const classHighest = allClassMarksInSub.length > 0 ? Math.max(...allClassMarksInSub) : sub.fullMarks;

      return {
        subject: sub,
        obtained,
        isAbsent,
        cq,
        mcq,
        isFail: isSubjectFail,
        grade: isSubjectFail ? 'F' : grade,
        gpa: isSubjectFail ? 0.0 : gpa,
        classHighest
      };
    });
  }, [activeStudentResult, selectedExam, classSubjects, marks, exams]);

  // Custom or auto remark for selected student
  const studentRemark = useMemo(() => {
    if (!activeStudentResult || !selectedExam) return '';
    const custom = remarks.find(
      r => r.studentId === activeStudentResult.student.id && r.examId === selectedExam.id
    );
    if (custom?.remark) return custom.remark;

    return getAutoRemark(
      activeStudentResult.gpa, 
      activeStudentResult.isFail, 
      activeStudentResult.failCount, 
      language as any
    );
  }, [activeStudentResult, selectedExam, remarks, language]);

  // Overall class statistics
  const classStats = useMemo(() => {
    const total = processedClassResults.length;
    const passed = processedClassResults.filter(r => !r.isFail).length;
    const failed = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
    const gpa5Count = processedClassResults.filter(r => !r.isFail && r.gpa >= 5.0).length;
    const highestMarks = processedClassResults.length > 0 ? processedClassResults[0].totalMarks : 0;

    return { total, passed, failed, passRate, gpa5Count, highestMarks };
  }, [processedClassResults]);

  // Filtered class results for the table
  const filteredClassResults = useMemo(() => {
    return processedClassResults.filter(item => {
      if (classStatusFilter === 'pass' && item.isFail) return false;
      if (classStatusFilter === 'fail' && !item.isFail) return false;
      if (classStatusFilter === 'gpa5' && (item.isFail || item.gpa < 5.0)) return false;

      if (classSearchQuery.trim()) {
        const q = classSearchQuery.toLowerCase();
        const s = item.student;
        const matchName = s.name.toLowerCase().includes(q) || (s.nameBn && s.nameBn.includes(q));
        const matchId = (s.studentId || '').toLowerCase().includes(q);
        const matchRoll = String(s.roll || '').includes(q);
        if (!matchName && !matchId && !matchRoll) return false;
      }
      return true;
    });
  }, [processedClassResults, classStatusFilter, classSearchQuery]);

  // Search filter for single student selector
  const searchedStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return classStudents;
    const q = studentSearchQuery.toLowerCase();
    return classStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.nameBn && s.nameBn.includes(q)) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      String(s.roll || '').includes(q)
    );
  }, [classStudents, studentSearchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 print:hidden select-none">
      {/* Top Universal Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Award size={16} className="text-amber-400" />
            <span>{language === 'bn' ? 'সার্বজনীন ডিজিটাল ফলাফল পোর্টাল' : 'Universal Online Result Portal'}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              {language === 'bn' ? 'সবার জন্য উন্মুক্ত' : 'Public Access'}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'অনলাইন ফলাফল ও মেধা তালিকা' : 'Online Results & Merit Rankings'}
          </h1>
          <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
            {language === 'bn'
              ? 'ওয়েবসাইটের মাধ্যমেই শিক্ষার্থীর বিষয়ভিত্তিক নম্বর, জিপিএ ও মেধা অবস্থান সরাসরি দেখুন।'
              : 'Directly browse interactive digital scorecards and class-wise merit rankings.'}
          </p>
        </div>

        {/* Protection / Web-Only Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-indigo-200">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="font-semibold">{language === 'bn' ? 'সুরক্ষিত ওয়েব ভিউ' : 'Live Digital View'}</span>
        </div>
      </div>

      {/* Primary Selection & View Mode Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Exam & Class Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Calendar size={14} className="text-indigo-600" />
              <span>{language === 'bn' ? 'পরীক্ষা:' : 'Exam:'}</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {language === 'bn' ? (e.nameBn || e.name) : e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <GraduationCap size={14} className="text-indigo-600" />
              <span>{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</span>
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStudentId('');
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>
                  {language === 'bn' ? (c.nameBn || c.name) : c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Toggle: Single Student vs Class-wise */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
          <button
            onClick={() => setViewMode('student')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'student'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User size={15} />
            <span>{language === 'bn' ? 'একক শিক্ষার্থী ভিউ' : 'Student-wise'}</span>
          </button>

          <button
            onClick={() => setViewMode('class')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'class'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={15} />
            <span>{language === 'bn' ? 'শ্রেণিভিত্তিক মেধা তালিকা' : 'Class-wise Merit'}</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: STUDENT-WISE ADVANCED DIGITAL SCORECARD */}
      {viewMode === 'student' && (
        <div className="space-y-6">
          {/* Student Picker Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[260px] relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'শিক্ষার্থীর নাম, রোল বা আইডি দিয়ে ফিল্টার করুন...' : 'Search student by name, roll or ID...'}
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
              <span className="text-xs font-bold text-slate-500 shrink-0">
                {language === 'bn' ? 'শিক্ষার্থী নির্বাচন:' : 'Select:'}
              </span>
              <select
                value={activeStudentResult?.student.id || ''}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-indigo-50/50 font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[260px] truncate"
              >
                {searchedStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    রোল {toBanglaDigits(s.roll)} - {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!activeStudentResult ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 text-slate-400">
              <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-bold">{language === 'bn' ? 'এই শ্রেণিতে কোনো ফলাফল পাওয়া যায়নি' : 'No result found in this class'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Student Header & Quick KPI Badges */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-indigo-500/20 shrink-0">
                      {activeStudentResult.student.name[0]?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-slate-900">{activeStudentResult.student.name}</h2>
                        {activeStudentResult.student.nameBn && (
                          <span className="text-sm font-semibold text-slate-500">({activeStudentResult.student.nameBn})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                        <span>{language === 'bn' ? 'রোল:' : 'Roll:'} <strong className="text-slate-800 font-mono">{toBanglaDigits(activeStudentResult.student.roll)}</strong></span>
                        <span>•</span>
                        <span>{language === 'bn' ? 'আইডি:' : 'ID:'} <strong className="text-slate-800 font-mono">{activeStudentResult.student.studentId}</strong></span>
                        <span>•</span>
                        <span>{language === 'bn' ? 'শ্রেণি:' : 'Class:'} <strong className="text-indigo-600">{selectedClass}</strong></span>
                        {activeStudentResult.student.fatherName && (
                          <>
                            <span>•</span>
                            <span>{language === 'bn' ? 'পিতা:' : 'Father:'} {activeStudentResult.student.fatherName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Class Rank Badge & Profile Link */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => {
                        localStorage.setItem('mms_logged_in_student_id', activeStudentResult.student.studentId || activeStudentResult.student.id);
                        setActiveTab('student_profile');
                      }}
                      className="px-3.5 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200/80 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      title={language === 'bn' ? 'শিক্ষার্থীর হাজিরা, নম্বর ও রুটিন দেখুন' : 'View attendance, marks, and exam routine'}
                    >
                      <GraduationCap size={16} />
                      <span>{language === 'bn' ? 'পূর্ণাঙ্গ প্রোফাইল ও রুটিন' : 'Full Profile & Routine'}</span>
                    </button>

                    <div className="px-4 py-2 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 text-amber-900 flex items-center gap-2 shadow-xs">
                      <Trophy size={20} className="text-amber-600" />
                      <div>
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{language === 'bn' ? 'শ্রেণিতে মেধা স্থান' : 'Class Rank'}</p>
                        <p className="text-lg font-black text-amber-900">
                          #{toBanglaDigits(activeStudentResult.rank)} {language === 'bn' ? 'স্থান' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                  {/* GPA */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'প্রাপ্ত জিপিএ' : 'GPA'}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-3xl font-black ${activeStudentResult.isFail ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {toBanglaDigits(activeStudentResult.gpa.toFixed(2))}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">/ ৫.০০</span>
                    </div>
                  </div>

                  {/* Letter Grade */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'লেটার গ্রেড' : 'Grade'}</span>
                    <div className="mt-2">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-lg font-black border ${
                        activeStudentResult.grade === 'A+' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        activeStudentResult.grade === 'A' || activeStudentResult.grade === 'A-' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        activeStudentResult.grade === 'F' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {activeStudentResult.grade}
                      </span>
                    </div>
                  </div>

                  {/* Total Marks */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'মোট প্রাপ্ত নম্বর' : 'Total Marks'}</span>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-slate-800">
                        {toBanglaDigits(activeStudentResult.totalMarks)}
                      </span>
                    </div>
                  </div>

                  {/* Result Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'ফলাফল স্থিতি' : 'Result Status'}</span>
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                        !activeStudentResult.isFail
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {!activeStudentResult.isFail ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>{language === 'bn' ? 'উত্তীর্ণ (PASSED)' : 'PASSED'}</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} />
                            <span>{language === 'bn' ? `অনুত্তীর্ণ (${toBanglaDigits(activeStudentResult.failCount)} বিষয়ে)` : 'FAILED'}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-600" />
                      <span>{language === 'bn' ? 'বিষয়ভিত্তিক বিস্তারিত নম্বরপত্র' : 'Subject-wise Detailed Marks'}</span>
                    </h3>
                    <p className="text-xs text-slate-400">{language === 'bn' ? 'প্রতিটি বিষয়ের প্রাপ্ত নম্বর, জিপিএ ও গ্রেড বিবরণী' : 'Scores and grade points for all assigned subjects'}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4 text-center">#</th>
                        <th className="py-3 px-4">{language === 'bn' ? 'বিষয়ের নাম' : 'Subject'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'পূর্ণমান' : 'Full'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'লিখিত (CQ)' : 'CQ'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'নৈর্ব্যক্তিক (MCQ)' : 'MCQ'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'প্রাপ্ত নম্বর' : 'Obtained'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'ক্লাস সর্বোচ্চ' : 'Class Highest'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'গ্রেড পয়েন্ট' : 'GPA'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                        <th className="py-3 px-4 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentSubjectBreakdown.map((row, idx) => (
                        <tr key={row.subject.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400">{toBanglaDigits(idx + 1)}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{row.subject.name}</span>
                            {row.subject.nameBn && (
                              <span className="text-[10px] text-slate-400 font-normal">{row.subject.nameBn}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{toBanglaDigits(row.subject.fullMarks)}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{row.cq !== undefined ? toBanglaDigits(row.cq) : '-'}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{row.mcq !== undefined ? toBanglaDigits(row.mcq) : '-'}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                            {row.isAbsent ? (
                              <span className="text-rose-600 font-bold">{language === 'bn' ? 'অনুপস্থিত' : 'ABS'}</span>
                            ) : (
                              toBanglaDigits(row.obtained)
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-indigo-600 font-bold">{toBanglaDigits(row.classHighest)}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{toBanglaDigits(row.gpa.toFixed(2))}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.grade === 'F' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {row.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !row.isFail ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {!row.isFail ? (language === 'bn' ? 'পাস' : 'Pass') : (language === 'bn' ? 'ফেল' : 'Fail')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remark Box */}
              {studentRemark && (
                <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 flex items-start gap-3">
                  <Sparkles size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">{language === 'bn' ? 'শিক্ষকের মূল্যায়ন ও মন্তব্য:' : 'Teacher Evaluation & Remark:'}</h4>
                    <p className="text-xs font-semibold text-indigo-800 mt-1">{studentRemark}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: CLASS-WISE MERIT RANKING & RESULTS LIST */}
      {viewMode === 'class' && (
        <div className="space-y-6">
          {/* Class Overview Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'মোট পরীক্ষার্থী' : 'Total Examinees'}</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{toBanglaDigits(classStats.total)}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{selectedClass} শ্রেণি</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Users size={24} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'পাসের হার' : 'Pass Rate'}</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{toBanglaDigits(classStats.passRate)}%</h3>
                <p className="text-[10px] text-emerald-600/80 mt-0.5">
                  {toBanglaDigits(classStats.passed)} {language === 'bn' ? 'জন উত্তীর্ণ' : 'passed'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'জিপিএ ৫.০০ (A+)' : 'GPA 5.00'}</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{toBanglaDigits(classStats.gpa5Count)}</h3>
                <p className="text-[10px] text-amber-600/80 mt-0.5">{language === 'bn' ? 'সর্বোচ্চ গ্রেড প্রাপ্ত' : 'Top scorers'}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Trophy size={24} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'অনুত্তীর্ণ শিক্ষার্থী' : 'Failed'}</p>
                <h3 className="text-2xl font-black text-rose-600 mt-1">{toBanglaDigits(classStats.failed)}</h3>
                <p className="text-[10px] text-rose-600/80 mt-0.5">{language === 'bn' ? 'পুনঃপরীক্ষার প্রয়োজন' : 'Requires improvement'}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <XCircle size={24} />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[220px] relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'মেধা তালিকায় নাম, রোল বা আইডি খুঁজুন...' : 'Search ranking by name, roll, ID...'}
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setClassStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  classStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'bn' ? 'সবাই' : 'All'}
              </button>
              <button
                onClick={() => setClassStatusFilter('pass')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  classStatusFilter === 'pass' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {language === 'bn' ? 'উত্তীর্ণ' : 'Passed'}
              </button>
              <button
                onClick={() => setClassStatusFilter('gpa5')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  classStatusFilter === 'gpa5' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                GPA 5.00
              </button>
              <button
                onClick={() => setClassStatusFilter('fail')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  classStatusFilter === 'fail' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                {language === 'bn' ? 'অনুত্তীর্ণ' : 'Failed'}
              </button>
            </div>
          </div>

          {/* Class Merit Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'মেধা স্থান' : 'Rank'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'আইডি' : 'Student ID'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                    <th className="py-3 px-4">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'মোট প্রাপ্ত নম্বর' : 'Total Marks'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
                    <th className="py-3 px-4 text-center">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClassResults.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        {language === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}
                      </td>
                    </tr>
                  ) : (
                    filteredClassResults.map((item) => (
                      <tr key={item.student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center">
                          {item.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs shadow-xs border border-amber-300">
                              🥇 1
                            </span>
                          ) : item.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs shadow-xs border border-slate-300">
                              🥈 2
                            </span>
                          ) : item.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-900 font-black text-xs shadow-xs border border-amber-200">
                              🥉 3
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-500">
                              #{toBanglaDigits(item.rank)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-600">{item.student.studentId}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{toBanglaDigits(item.student.roll)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.student.name}
                          {item.student.nameBn && (
                            <span className="text-[10px] text-slate-400 block font-normal">{item.student.nameBn}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-black text-slate-800">{toBanglaDigits(item.totalMarks)}</td>
                        <td className="py-3 px-4 text-center font-mono font-black text-indigo-700">{toBanglaDigits(item.gpa.toFixed(2))}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.grade === 'A+' ? 'bg-amber-100 text-amber-800 font-black' :
                            item.grade === 'F' ? 'bg-rose-100 text-rose-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !item.isFail ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {!item.isFail ? (language === 'bn' ? 'উত্তীর্ণ' : 'Passed') : (language === 'bn' ? `ফেল (${toBanglaDigits(item.failCount)})` : 'Failed')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedStudentId(item.student.id);
                              setViewMode('student');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                            title="বিস্তারিত দেখুন"
                          >
                            <Eye size={12} />
                            <span>{language === 'bn' ? 'বিস্তারিত' : 'View'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
