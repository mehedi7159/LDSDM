import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp, 
  TrendingDown,
  Award, 
  AlertCircle, 
  Calendar, 
  Sparkles,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart as PieIcon,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  Layers,
  Clock,
  ChevronRight,
  HelpCircle,
  FileText,
  AlertTriangle,
  X,
  ExternalLink,
  ShieldAlert,
  ListChecks,
  Activity,
  Check,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { calculateTotalGPA } from '../services/utils';
import { SubjectPerformanceAnalytics } from './SubjectPerformanceAnalytics';
import { StudentPerformanceCard } from './StudentPerformanceCard';

export const Dashboard = () => {
  const { students, subjects, marks, exams, remarks, classes, t, language, seedDemoMadrashaData } = useApp();
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [activeSectionTab, setActiveSectionTab] = useState<'overview' | 'student' | 'subjects' | 'merit'>('overview');
  const [meritSearchQuery, setMeritSearchQuery] = useState<string>('');
  const [showAtRiskModal, setShowAtRiskModal] = useState<boolean>(false);
  const [atRiskFilter, setAtRiskFilter] = useState<'all' | 'multi' | 'single'>('all');
  const [selectedStudentForTrajectory, setSelectedStudentForTrajectory] = useState<string | null>(null);

  useEffect(() => {
    if (exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams]);

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

  // Compute all metrics and chart datasets reactively
  const {
    totalStudentsCount,
    activeStudentsCount,
    totalSubjectsCount,
    marksCount,
    statusData,
    classAverages,
    groupAverages,
    attendanceData,
    gradeData,
    chartData,
    topStudents,
    passRate,
    overallAverageGpa,
    aPlusCount,
    topPerformingClass,
    strugglingClass,
    totalAppearedCount,
    totalEvaluatedCount,
    atRiskStudents,
    criticalFailCount,
    singleFailCount,
    subjectSummaryList,
    lowestSubjects,
    highestSubjects,
    gradeTiers
  } = useMemo(() => {
    let passed = 0;
    let failed = 0;
    const classAvgs: Record<string, { totalGpa: number, count: number }> = {};
    const groupAvgs: Record<string, { totalGpa: number, count: number }> = {};
    const attData: Record<string, { present: number, absent: number }> = {};
    const gradeCounts: Record<string, number> = { 'A+': 0, 'A': 0, 'A-': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    const classParticipation: Record<string, { total: number, appeared: number }> = {};
    const groupParticipation: Record<string, { total: number, appeared: number }> = {};
    const studentPerformanceList: Array<{ 
      id: string; 
      name: string; 
      nameBn?: string; 
      roll?: string; 
      studentId: string; 
      gpa: number; 
      grade: string; 
      isFail: boolean; 
      group?: string; 
      classLevel: string;
      totalMarks: number; 
      failCount: number 
    }> = [];

    const runningStudents = students.filter(s => !s.isFormer && s.status !== 'Former');
    const filteredStudents = selectedClass === 'All' 
      ? runningStudents 
      : runningStudents.filter(s => s.classLevel === selectedClass);

    const activeFilteredStudents = filteredStudents.filter(s => s.status === 'Active');

    const filteredSubjectsCount = selectedClass === 'All' 
      ? subjects.length 
      : subjects.filter(s => s.classLevel === selectedClass).length;

    const filteredMarksCount = marks.filter(m => {
      if (selectedExamId && selectedExamId !== 'All' && m.examId !== selectedExamId) return false;
      const student = students.find(s => s.id === m.studentId);
      if (!student) return false;
      if (selectedClass !== 'All' && student.classLevel !== selectedClass) return false;
      return true;
    }).length;

    // Initialize participation maps
    students.forEach(student => {
      if (student.status !== 'Active' || student.isFormer) return;
      if (selectedClass !== 'All' && student.classLevel !== selectedClass) return;

      if (selectedClass === 'All') {
        if (!classParticipation[student.classLevel]) {
          classParticipation[student.classLevel] = { total: 0, appeared: 0 };
        }
        classParticipation[student.classLevel].total++;
      } else {
        const groupKey = student.group || 'General';
        if (!groupParticipation[groupKey]) {
          groupParticipation[groupKey] = { total: 0, appeared: 0 };
        }
        groupParticipation[groupKey].total++;
      }
    });

    if (selectedExamId) {
      students.forEach(student => {
        if (student.status !== 'Active' || student.isFormer) return;
        if (selectedClass !== 'All' && student.classLevel !== selectedClass) return;

        const hasMarks = selectedExamId === 'All'
          ? marks.some(m => m.studentId === student.id)
          : marks.some(m => m.studentId === student.id && m.examId === selectedExamId);
        if (!hasMarks) return;

        if (selectedClass === 'All') {
          if (classParticipation[student.classLevel]) {
            classParticipation[student.classLevel].appeared++;
          }
        } else {
          const groupKey = student.group || 'General';
          if (groupParticipation[groupKey]) {
            groupParticipation[groupKey].appeared++;
          }
        }

        const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
        const subjectsAssignedToThisExam = selectedExamId === 'All'
          ? classSubjectsInThisClass
          : classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(selectedExamId));
        const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

        const classStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active' && !student.isFormer);
        const classStudentIds = classStudents.map(s => s.id);
        const enteredSubjectIds = new Set(
          marks
            .filter(m => (selectedExamId === 'All' || m.examId === selectedExamId) && classStudentIds.includes(m.studentId))
            .map(m => m.subjectId)
        );

        const classSubjects = classSubjectsInThisClass.filter(s => {
          const matchesGroup = !s.group || s.group === 'All' || s.group === student.group;
          if (!matchesGroup) return false;

          const isAssigned = selectedExamId === 'All' ? true : (anySubjectAssignedToThisExam ? (s.examIds && s.examIds.includes(selectedExamId)) : true);
          if (!isAssigned) return false;

          if (enteredSubjectIds.size > 0) {
            return enteredSubjectIds.has(s.id);
          }
          return true;
        });

        if (classSubjects.length === 0) return;

        const effectiveExamForGpa = selectedExamId === 'All' ? (exams[0]?.id || '') : selectedExamId;
        const stats = calculateTotalGPA(classSubjects, marks, student.id, effectiveExamForGpa, student.group, exams);
        
        if (stats.isFail) {
          failed++;
        } else {
          passed++;
        }

        if (gradeCounts[stats.grade] !== undefined) {
          gradeCounts[stats.grade]++;
        }

        studentPerformanceList.push({
          id: student.id,
          name: student.name,
          nameBn: student.nameBn,
          roll: student.roll,
          studentId: student.studentId,
          gpa: stats.gpa,
          grade: stats.grade,
          isFail: stats.isFail,
          group: student.group,
          classLevel: student.classLevel,
          totalMarks: stats.totalMarks,
          failCount: stats.failCount,
        });

        if (!classAvgs[student.classLevel]) {
          classAvgs[student.classLevel] = { totalGpa: 0, count: 0 };
        }
        classAvgs[student.classLevel].totalGpa += stats.gpa;
        classAvgs[student.classLevel].count++;

        const groupKey = student.group || 'General';
        if (!groupAvgs[groupKey]) {
          groupAvgs[groupKey] = { totalGpa: 0, count: 0 };
        }
        groupAvgs[groupKey].totalGpa += stats.gpa;
        groupAvgs[groupKey].count++;

        const remark = remarks.find(r => r.studentId === student.id && (selectedExamId === 'All' || r.examId === selectedExamId));
        if (remark && (remark.totalPresent || remark.totalAbsent)) {
          if (selectedClass === 'All') {
            if (!attData[student.classLevel]) {
              attData[student.classLevel] = { present: 0, absent: 0 };
            }
            attData[student.classLevel].present += (remark.totalPresent || 0);
            attData[student.classLevel].absent += (remark.totalAbsent || 0);
          } else {
            const key = groupKey;
            if (!attData[key]) {
              attData[key] = { present: 0, absent: 0 };
            }
            attData[key].present += (remark.totalPresent || 0);
            attData[key].absent += (remark.totalAbsent || 0);
          }
        }
      });
    }

    const sortedClassNames = [...classes]
      .sort((a, b) => a.order - b.order)
      .map(c => c.name);

    const totalEvaluated = passed + failed;
    const sData = [
      { 
        name: language === 'bn' ? 'উত্তীর্ণ' : 'Passed', 
        value: passed,
        total: totalEvaluated,
        percentage: totalEvaluated > 0 ? Number(((passed / totalEvaluated) * 100).toFixed(1)) : 0,
        type: 'passed'
      },
      { 
        name: language === 'bn' ? 'অকৃতকার্য' : 'Failed', 
        value: failed,
        total: totalEvaluated,
        percentage: totalEvaluated > 0 ? Number(((failed / totalEvaluated) * 100).toFixed(1)) : 0,
        type: 'failed'
      },
    ].filter(d => d.value > 0);

    const calculatedPassRate = totalEvaluated > 0 ? Math.round((passed / totalEvaluated) * 1000) / 10 : 0;

    const cAvgs = sortedClassNames
      .filter(name => classAvgs[name] !== undefined)
      .map(name => {
        const count = classAvgs[name].count;
        const avgGpa = count > 0 ? Number((classAvgs[name].totalGpa / count).toFixed(2)) : 0;
        return {
          rawName: name,
          name: getClassNameDisplay(name),
          average: avgGpa,
          count,
          percentageEquivalent: Number(((avgGpa / 5.0) * 100).toFixed(1))
        };
      });

    let topClassItem = cAvgs.length > 0 ? [...cAvgs].sort((a, b) => b.average - a.average)[0] : null;
    let strugglingClassItem = cAvgs.length > 1 ? [...cAvgs].sort((a, b) => a.average - b.average)[0] : null;

    const totalGpaSum = studentPerformanceList.reduce((sum, s) => sum + s.gpa, 0);
    const overallAvgGpa = studentPerformanceList.length > 0 
      ? Number((totalGpaSum / studentPerformanceList.length).toFixed(2)) 
      : 0;

    const gAvgs = ['General', 'Science']
      .filter(g => groupAvgs[g] !== undefined)
      .map(g => {
        const count = groupAvgs[g].count;
        const avgGpa = count > 0 ? Number((groupAvgs[g].totalGpa / count).toFixed(2)) : 0;
        return {
          name: language === 'bn' ? (t(g.toLowerCase() as any) || g) : g,
          average: avgGpa,
          count,
          percentageEquivalent: Number(((avgGpa / 5.0) * 100).toFixed(1))
        };
      });

    let aData = [];
    if (selectedClass === 'All') {
      aData = sortedClassNames
        .filter(name => attData[name] !== undefined)
        .map(name => {
          const pres = attData[name].present;
          const abs = attData[name].absent;
          const totalDays = pres + abs;
          return {
            name: getClassNameDisplay(name),
            Present: pres,
            Absent: abs,
            totalDays,
            presentPercent: totalDays > 0 ? Number(((pres / totalDays) * 100).toFixed(1)) : 0,
            absentPercent: totalDays > 0 ? Number(((abs / totalDays) * 100).toFixed(1)) : 0
          };
        });
    } else {
      aData = ['General', 'Science']
        .filter(g => attData[g] !== undefined)
        .map(g => {
          const pres = attData[g].present;
          const abs = attData[g].absent;
          const totalDays = pres + abs;
          return {
            name: language === 'bn' ? (t(g.toLowerCase() as any) || g) : g,
            Present: pres,
            Absent: abs,
            totalDays,
            presentPercent: totalDays > 0 ? Number(((pres / totalDays) * 100).toFixed(1)) : 0,
            absentPercent: totalDays > 0 ? Number(((abs / totalDays) * 100).toFixed(1)) : 0
          };
        });
    }

    const totalGraded = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
    const gradePointLabels: Record<string, string> = {
      'A+': '5.00', 'A': '4.00', 'A-': '3.50', 'B': '3.00', 'C': '2.00', 'D': '1.00', 'F': '0.00'
    };
    const gData = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F']
      .map(grade => {
        const count = gradeCounts[grade] || 0;
        return {
          grade,
          point: gradePointLabels[grade] || '0.00',
          students: count,
          percentage: totalGraded > 0 ? Number(((count / totalGraded) * 100).toFixed(1)) : 0,
          totalGraded
        };
      })
      .filter(d => d.students > 0);

    let pData = [];
    let totAppeared = 0;
    if (selectedClass === 'All') {
      pData = sortedClassNames
        .filter(name => classParticipation[name] !== undefined)
        .map(name => {
          const tot = classParticipation[name].total;
          const app = classParticipation[name].appeared;
          const abs = Math.max(0, tot - app);
          totAppeared += app;
          return {
            name: getClassNameDisplay(name),
            Total: tot,
            Appeared: app,
            Absent: abs,
            appearedPercent: tot > 0 ? Number(((app / tot) * 100).toFixed(1)) : 0,
            absentPercent: tot > 0 ? Number(((abs / tot) * 100).toFixed(1)) : 0
          };
        });
    } else {
      pData = ['General', 'Science']
        .filter(g => groupParticipation[g] !== undefined)
        .map(g => {
          const tot = groupParticipation[g].total;
          const app = groupParticipation[g].appeared;
          const abs = Math.max(0, tot - app);
          totAppeared += app;
          return {
            name: language === 'bn' ? (t(g.toLowerCase() as any) || g) : g,
            Total: tot,
            Appeared: app,
            Absent: abs,
            appearedPercent: tot > 0 ? Number(((app / tot) * 100).toFixed(1)) : 0,
            absentPercent: tot > 0 ? Number(((abs / tot) * 100).toFixed(1)) : 0
          };
        });
    }

    const sortedPerformers = studentPerformanceList
      .sort((a, b) => {
        if (a.isFail && !b.isFail) return 1;
        if (!a.isFail && b.isFail) return -1;
        if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
          const rollA = parseInt(a.roll || '999', 10);
          const rollB = parseInt(b.roll || '999', 10);
          return rollA - rollB;
        }
        if (b.gpa !== a.gpa) return b.gpa - a.gpa;
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        const rollA = parseInt(a.roll || '999', 10);
        const rollB = parseInt(b.roll || '999', 10);
        return rollA - rollB;
      });

    // Compute detailed at-risk students for actionable decision making
    const atRiskList = sortedPerformers
      .filter(s => s.isFail || s.failCount > 0)
      .map(s => {
        const studentMarks = marks.filter(m => 
          m.studentId === s.id && 
          (selectedExamId === 'All' || m.examId === selectedExamId)
        );
        const failedSubjectDetails: Array<{ name: string; marks: number; fullMarks: number }> = [];
        studentMarks.forEach(m => {
          const subj = subjects.find(sub => sub.id === m.subjectId);
          if (subj) {
            const passMark = subj.passMarks ?? 33;
            if ((m.obtained ?? 0) < passMark || m.isAbsent) {
              failedSubjectDetails.push({
                name: language === 'bn' ? (subj.nameBn || subj.name) : subj.name,
                marks: m.isAbsent ? 0 : (m.obtained ?? 0),
                fullMarks: subj.fullMarks || 100
              });
            }
          }
        });
        return {
          ...s,
          student: s,
          failedSubjectNames: failedSubjectDetails
        };
      })
      .sort((a, b) => b.failCount - a.failCount);

    const critFailCount = atRiskList.filter(s => s.failCount >= 2).length;
    const singleFailCount = atRiskList.filter(s => s.failCount === 1).length;

    // Compute subject pass rates for actionable curriculum insights
    const relevantSubjects = selectedClass === 'All' 
      ? subjects 
      : subjects.filter(s => s.classLevel === selectedClass);

    const subList = relevantSubjects.map(subj => {
      const subjMarks = marks.filter(m => {
        if (m.subjectId !== subj.id) return false;
        if (selectedExamId !== 'All' && selectedExamId && m.examId !== selectedExamId) return false;
        const student = students.find(s => s.id === m.studentId);
        if (!student || student.status !== 'Active' || student.isFormer) return false;
        if (selectedClass !== 'All' && student.classLevel !== selectedClass) return false;
        return true;
      });

      const totalAppeared = subjMarks.length;
      if (totalAppeared === 0) {
        return {
          id: subj.id,
          name: language === 'bn' ? (subj.nameBn || subj.name) : subj.name,
          classLevel: subj.classLevel,
          totalAppeared: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          avgMarks: 0,
          fullMarks: subj.fullMarks || 100
        };
      }

      const passMark = subj.passMarks ?? 33;
      let passed = 0;
      let totalScore = 0;

      subjMarks.forEach(m => {
        const score = m.obtained ?? 0;
        totalScore += score;
        if (score >= passMark && !m.isAbsent) {
          passed++;
        }
      });

      const avgScore = Number((totalScore / totalAppeared).toFixed(1));
      const passPercentage = Number(((passed / totalAppeared) * 100).toFixed(1));

      return {
        id: subj.id,
        name: language === 'bn' ? (subj.nameBn || subj.name) : subj.name,
        classLevel: subj.classLevel,
        totalAppeared,
        passCount: passed,
        failCount: totalAppeared - passed,
        passRate: passPercentage,
        avgMarks: avgScore,
        fullMarks: subj.fullMarks || 100
      };
    }).filter(s => s.totalAppeared > 0);

    const sortedByPassRate = [...subList].sort((a, b) => a.passRate - b.passRate);
    const lowestSubjects = sortedByPassRate.slice(0, 2);
    const highestSubjects = [...subList].sort((a, b) => b.passRate - a.passRate).slice(0, 3);

    // Compute macro grade quality tiers for simple executive review
    const topCount = (gradeCounts['A+'] || 0) + (gradeCounts['A'] || 0);
    const midCount = (gradeCounts['A-'] || 0) + (gradeCounts['B'] || 0);
    const lowCount = (gradeCounts['C'] || 0) + (gradeCounts['D'] || 0);
    const failCount = gradeCounts['F'] || 0;

    const gradeTiers = {
      top: {
        count: topCount,
        percent: totalEvaluated > 0 ? Math.round((topCount / totalEvaluated) * 100) : 0
      },
      mid: {
        count: midCount,
        percent: totalEvaluated > 0 ? Math.round((midCount / totalEvaluated) * 100) : 0
      },
      low: {
        count: lowCount,
        percent: totalEvaluated > 0 ? Math.round((lowCount / totalEvaluated) * 100) : 0
      },
      fail: {
        count: failCount,
        percent: totalEvaluated > 0 ? Math.round((failCount / totalEvaluated) * 100) : 0
      }
    };

    return {
      totalStudentsCount: filteredStudents.length,
      activeStudentsCount: activeFilteredStudents.length,
      totalSubjectsCount: filteredSubjectsCount,
      marksCount: filteredMarksCount,
      statusData: sData,
      classAverages: cAvgs,
      groupAverages: gAvgs,
      attendanceData: aData,
      gradeData: gData,
      chartData: pData,
      topStudents: sortedPerformers,
      passRate: calculatedPassRate,
      overallAverageGpa: overallAvgGpa,
      aPlusCount: gradeCounts['A+'] || 0,
      topPerformingClass: topClassItem,
      strugglingClass: strugglingClassItem,
      totalAppearedCount: totAppeared,
      totalEvaluatedCount: totalEvaluated,
      atRiskStudents: atRiskList,
      criticalFailCount: critFailCount,
      singleFailCount: singleFailCount,
      subjectSummaryList: subList,
      lowestSubjects,
      highestSubjects,
      gradeTiers
    };
  }, [students, subjects, marks, remarks, classes, selectedExamId, selectedClass, language, t, exams]);

  // Filter top performers based on search query
  const filteredTopStudents = useMemo(() => {
    if (!meritSearchQuery.trim()) return topStudents.slice(0, 10);
    const q = meritSearchQuery.toLowerCase().trim();
    return topStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.nameBn && s.nameBn.includes(q)) || 
      s.studentId.toLowerCase().includes(q) ||
      (s.roll && s.roll.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [topStudents, meritSearchQuery]);

  const selectedExamObj = exams.find(e => e.id === selectedExamId);

  return (
    <div id="madrasha-executive-dashboard" className="space-y-6">
      
      {/* 1. Sleek Command Header & Global Filtering Ribbon */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {language === 'bn' ? 'অ্যাকাডেমিক ড্যাশবোর্ড ও কর্মক্ষমতা বিশ্লেষণ' : 'Academic Dashboard & Performance Analysis'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-normal">
                {language === 'bn' 
                  ? 'মাদ্রাসার ফলাফল সূচক, শিক্ষার্থী ট্র্যাকিং, বিষয়ভিত্তিক শক্তি-দুর্বলতা এবং মেধা তালিকা।'
                  : 'Institutional health metrics, student trajectory, subject diagnosis, and merit standings.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Exam Selector + Class Selector + Quick Demo Data */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Exam Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-500">{t('exam')}:</span>
            <select
              id="dashboard-exam-selector"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              aria-label={t('exam')}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">{language === 'bn' ? 'সকল পরীক্ষা' : 'All Exams'}</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>
              ))}
            </select>
          </div>

          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-500">{language === 'bn' ? 'শ্রেণী:' : 'Class:'}</span>
            <select
              id="dashboard-class-filter"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label={language === 'bn' ? 'শ্রেণী' : 'Class'}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
            >
              <option value="All">{language === 'bn' ? 'সকল শ্রেণী' : 'All Classes'}</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{language === 'bn' ? (c.nameBn || c.name) : c.name}</option>
              ))}
            </select>
          </div>

          {/* Seed Demo Data Button when empty */}
          {marks.length === 0 && (
            <button
              id="dashboard-seed-demo-btn"
              type="button"
              onClick={() => seedDemoMadrashaData()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'নমুনা ডেটা লোড করুন' : 'Load Demo Data'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Executive Quick Focus Switcher (Optimal, Minimal Tab Navigation) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl text-xs font-bold text-slate-600">
          <button
            id="tab-btn-overview"
            onClick={() => setActiveSectionTab('overview')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeSectionTab === 'overview' 
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'সার্বিক ড্যাশবোর্ড' : 'Executive Overview'}
          </button>
          <button
            id="tab-btn-student"
            onClick={() => setActiveSectionTab('student')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeSectionTab === 'student' 
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'শিক্ষার্থীর অগ্রগতি' : 'Student Trajectory'}
          </button>
          <button
            id="tab-btn-subjects"
            onClick={() => setActiveSectionTab('subjects')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeSectionTab === 'subjects' 
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'বিষয়ভিত্তিক ডায়াগনোসিস' : 'Subject Analytics'}
          </button>
          <button
            id="tab-btn-merit"
            onClick={() => setActiveSectionTab('merit')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeSectionTab === 'merit' 
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'bn' ? 'মেধা তালিকা' : 'Merit List'}
          </button>
        </div>

        {/* Live Filter Info Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{language === 'bn' ? 'নির্বাচিত ফিল্টার:' : 'Active View:'}</span>
          <span className="font-bold text-slate-800">
            {selectedExamObj ? (language === 'bn' ? selectedExamObj.nameBn || selectedExamObj.name : selectedExamObj.name) : (language === 'bn' ? 'সকল পরীক্ষা' : 'All Exams')}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-indigo-700">{getClassNameDisplay(selectedClass)}</span>
        </div>
      </div>

      {/* 3. Executive KPI Metric Ribbon (4 Key Usable Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Enrolled & Appeared Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              {language === 'bn' ? 'শিক্ষার্থী ও অংশগ্রহণ' : 'Students & Appeared'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {language === 'bn' ? 'অ্যাক্টিভ' : 'Active'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
              {toBanglaDigits(totalEvaluatedCount)}
              <span className="text-xs font-normal text-slate-400 ml-1">/ {toBanglaDigits(totalStudentsCount)}</span>
            </div>
            <span className="text-xs font-bold text-blue-700 font-mono">
              {totalStudentsCount > 0 ? toBanglaDigits(Math.round((totalEvaluatedCount / totalStudentsCount) * 100)) : 0}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>{language === 'bn' ? 'মোট মূল্যায়িত শিক্ষার্থী:' : 'Evaluated in exam:'}</span>
            <span className="font-bold text-slate-800">{toBanglaDigits(totalEvaluatedCount)} {language === 'bn' ? 'জন' : ''}</span>
          </div>
        </div>

        {/* KPI 2: Pass Rate & Academic Health */}
        <div className={`p-5 rounded-2xl border shadow-2xs space-y-2 transition-all ${
          passRate >= 80 ? 'bg-emerald-50/30 border-emerald-200/80' :
          passRate >= 60 ? 'bg-amber-50/30 border-amber-200/80' :
          'bg-rose-50/30 border-rose-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              passRate >= 80 ? 'text-emerald-700' : passRate >= 60 ? 'text-amber-700' : 'text-rose-700'
            }`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {language === 'bn' ? 'প্রতিষ্ঠানের পাসের হার' : 'Madrasha Pass Rate'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              passRate >= 85 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
              passRate >= 70 ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-rose-100 text-rose-800 border-rose-200'
            }`}>
              {passRate >= 85 ? (language === 'bn' ? 'উৎকৃষ্ট' : 'Excellent') :
               passRate >= 70 ? (language === 'bn' ? 'সন্তোষজনক' : 'Good') :
               (language === 'bn' ? 'সতর্কতা' : 'Needs Care')}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
              {toBanglaDigits(passRate)}%
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {statusData.find(d => d.type === 'failed')?.value ? (
                <span className="text-rose-600 font-bold">
                  {toBanglaDigits(statusData.find(d => d.type === 'failed')!.value)} {language === 'bn' ? 'জন ফেল' : 'fails'}
                </span>
              ) : (
                <span className="text-emerald-700 font-bold">{language === 'bn' ? 'শতভাগ পাস' : '100% Pass'}</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-200/60 pt-1.5">
            <span>{language === 'bn' ? 'পাসকৃত শিক্ষার্থী:' : 'Total Passed:'}</span>
            <span className="font-bold text-emerald-800 font-mono">
              {toBanglaDigits(statusData.find(d => d.type === 'passed')?.value || 0)} {language === 'bn' ? 'জন' : ''}
            </span>
          </div>
        </div>

        {/* KPI 3: Average Institution GPA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
              {language === 'bn' ? 'গড় প্রাতিষ্ঠানিক জিপিএ' : 'Overall Average GPA'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {language === 'bn' ? 'স্কেল ৫.০০' : 'Scale 5.0'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono tracking-tight">
              {toBanglaDigits(overallAverageGpa.toFixed(2))}
              <span className="text-xs font-normal text-slate-400 ml-1">/ ৫.০০</span>
            </div>
            <span className="text-xs font-bold text-slate-600 font-mono">
              {toBanglaDigits(Math.round((overallAverageGpa / 5.0) * 100))}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5 truncate">
            <span>{language === 'bn' ? 'শীর্ষ শ্রেণী:' : 'Top Class:'}</span>
            <span className="font-bold text-slate-800 truncate ml-1">
              {topPerformingClass ? `${topPerformingClass.name} (${toBanglaDigits(topPerformingClass.average)})` : '—'}
            </span>
          </div>
        </div>

        {/* KPI 4: Academic Excellence (A+ Achievers) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              {language === 'bn' ? 'জিপিএ ৫.০০ (A+) অর্জন' : 'GPA 5.0 (A+) Achievers'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              {language === 'bn' ? 'কৃতিত্ব' : 'Excellence'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
              {toBanglaDigits(aPlusCount)}
              <span className="text-xs font-normal text-slate-400 ml-1">{language === 'bn' ? 'জন' : 'students'}</span>
            </div>
            <span className="text-xs font-bold text-amber-700 font-mono">
              {totalEvaluatedCount > 0 ? toBanglaDigits(Math.round((aPlusCount / totalEvaluatedCount) * 100)) : 0}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>{language === 'bn' ? 'মোট পাঠ্য বিষয়:' : 'Total Subjects:'}</span>
            <span className="font-bold text-slate-800">{toBanglaDigits(totalSubjectsCount)} {language === 'bn' ? 'টি' : ''}</span>
          </div>
        </div>

      </div>

      {/* When no marks exist */}
      {statusData.length === 0 && (
        <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200/80 shadow-xs text-center max-w-xl mx-auto space-y-4 my-6">
          <div className="mx-auto h-14 w-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {language === 'bn' ? 'ফলাফল তথ্য প্রয়োজন' : 'No Results Recorded Yet'}
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            {language === 'bn'
              ? 'বর্তমান ফিল্টারের অধীনে কোনো পরীক্ষার নম্বর অ্যান্ট্রি করা হয়নি। নিচে ক্লিক করে ডেমো ডেটা লোড করুন যাতে পূর্ণাঙ্গ অ্যানালাইসিস দেখতে পারেন।'
              : 'No marks found for this evaluation filter. Click below to load demo madrasha records.'}
          </p>
          <button
            type="button"
            onClick={() => seedDemoMadrashaData()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            <Sparkles size={16} />
            {language === 'bn' ? 'নমুনা ডেটা লোড করে বিশ্লেষণ দেখুন' : 'Load Sample Data'}
          </button>
        </div>
      )}

      {/* 4. Actionable Executive Decision Center (সিদ্ধান্ত গ্রহণ ও আশু পদক্ষেপ প্যানেল) */}
      {statusData.length > 0 && activeSectionTab === 'overview' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                </span>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  {language === 'bn' ? 'কার্যকর সিদ্ধান্ত ও তাৎক্ষণিক পদক্ষেপ প্যানেল' : 'Executive Action & Decision Insights'}
                </h2>
              </div>
              <p className="text-xs text-slate-300">
                {language === 'bn' 
                  ? 'প্রাতিষ্ঠানিক ফলাফল বিশ্লেষণ করে আশু করণীয় এবং দুর্বলতা নিরসনে সুপারিশ' 
                  : 'Actionable intervention points generated from evaluation data'}
              </p>
            </div>
            
            {atRiskStudents.length > 0 && (
              <button
                id="btn-view-at-risk-modal"
                type="button"
                onClick={() => setShowAtRiskModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer self-start sm:self-auto shrink-0"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  {language === 'bn' 
                    ? `ঝুঁকিপূর্ণ ${toBanglaDigits(atRiskStudents.length)} শিক্ষার্থীর তালিকা দেখুন` 
                    : `View ${atRiskStudents.length} At-Risk Students`}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Action 1: At-Risk Students */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {language === 'bn' ? 'ঝুঁকিপূর্ণ শিক্ষার্থী ও স্পেশাল কেয়ার' : 'At-Risk Student Alerts'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${atRiskStudents.length > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}`}>
                  {atRiskStudents.length > 0 ? `${toBanglaDigits(atRiskStudents.length)} ${language === 'bn' ? 'জন' : ''}` : (language === 'bn' ? 'ঝুঁকিমুক্ত' : 'Zero Fails')}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {atRiskStudents.length > 0 ? (
                  language === 'bn' ? (
                    <>
                      মোট <strong>{toBanglaDigits(atRiskStudents.length)} জন</strong> শিক্ষার্থী অকৃতকার্য। এর মধ্যে <strong>{toBanglaDigits(criticalFailCount)} জন</strong> একাধিক বিষয়ে এবং <strong>{toBanglaDigits(singleFailCount)} জন</strong> ১টি বিষয়ে ফেল করেছে।
                    </>
                  ) : (
                    <>
                      <strong>{atRiskStudents.length} students</strong> fell below pass marks. <strong>{criticalFailCount} students</strong> failed in multiple subjects.
                    </>
                  )
                ) : (
                  language === 'bn' 
                    ? 'মাশাআল্লাহ! বর্তমান পরীক্ষায় কোনো শিক্ষার্থী অকৃতকার্য হয়নি। সার্বিক ফলাফল অত্যন্ত সন্তোষজনক।'
                    : 'All evaluated students have passed successfully in this examination.'
                )}
              </p>
              <div className="text-[11px] text-amber-300/90 font-medium pt-1 border-t border-white/10 flex items-center gap-1">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>
                  {atRiskStudents.length > 0
                    ? (language === 'bn' ? 'পদক্ষেপ: দুর্বল শিক্ষার্থীদের তালিকা অনুযায়ী স্পেশাল কোচিং ও অভিভাবক বৈঠক আহ্বান।' : 'Action: Arrange remedial coaching & guardian meeting.')
                    : (language === 'bn' ? 'পদক্ষেপ: ধারাবাহিক মান রক্ষায় নিয়মিত ক্লাস টেস্ট অব্যাহত রাখুন।' : 'Action: Maintain current teaching standard.')}
                </span>
              </div>
            </div>

            {/* Action 2: Challenging Subjects */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {language === 'bn' ? 'চ্যালেঞ্জিং বিষয় ও বিশেষ রিভিশন' : 'Curriculum Bottlenecks'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {language === 'bn' ? 'ফোকাস এরিয়া' : 'Focus Area'}
                </span>
              </div>
              <div className="text-xs text-slate-200 leading-relaxed space-y-1">
                {lowestSubjects.length > 0 ? (
                  lowestSubjects.map((sub, idx) => (
                    <div key={sub.id} className="flex items-center justify-between text-xs">
                      <span className="truncate">{idx + 1}. {sub.name}</span>
                      <span className="font-mono font-bold text-amber-300 shrink-0 ml-2">
                        {toBanglaDigits(sub.passRate)}% {language === 'bn' ? 'পাস' : 'Pass'} (গড় {toBanglaDigits(sub.avgMarks)})
                      </span>
                    </div>
                  ))
                ) : (
                  <span>{language === 'bn' ? 'সকল বিষয়ে সন্তোষজনক ফলাফল পরিলক্ষিত হয়েছে।' : 'Healthy scores across subjects.'}</span>
                )}
              </div>
              <div className="text-[11px] text-amber-300/90 font-medium pt-1 border-t border-white/10 flex items-center gap-1">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'পদক্ষেপ: দুর্বল বিষয়ের শিক্ষকদের সাথে জরুরি পর্যালোচনা ও অতিরিক্ত ক্লাস টেস্ট।'
                    : 'Action: Schedule subject revisions with responsible teachers.'}
                </span>
              </div>
            </div>

            {/* Action 3: Class Academic Benchmark Target */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {language === 'bn' ? 'শ্রেণীভিত্তিক অগ্রগতি ও তদারকি' : 'Cohort Gap & Target'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {language === 'bn' ? 'মানদণ্ড' : 'Target'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {topPerformingClass && strugglingClass && topPerformingClass.name !== strugglingClass.name ? (
                  language === 'bn' ? (
                    <>
                      <strong>{topPerformingClass.name}</strong> সর্বোচ্চ GPA ({toBanglaDigits(topPerformingClass.average)}) পেয়ে শীর্ষে; কিন্তু <strong>{strugglingClass.name}</strong>-এর গড় GPA ({toBanglaDigits(strugglingClass.average)}) অপেক্ষাকৃত কম।
                    </>
                  ) : (
                    <>
                      <strong>{topPerformingClass.name}</strong> leads with GPA {topPerformingClass.average}; <strong>{strugglingClass.name}</strong> (GPA {strugglingClass.average}) requires academic guidance.
                    </>
                  )
                ) : (
                  language === 'bn' 
                    ? 'সকল শ্রেণীর পারফরম্যান্সে সমতা রয়েছে। সার্বিক প্রাতিষ্ঠানিক মান ইতিবাচক।'
                    : 'Consistent academic benchmark across cohorts.'
                )}
              </p>
              <div className="text-[11px] text-indigo-300 font-medium pt-1 border-t border-white/10 flex items-center gap-1">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'পদক্ষেপ: পিছিয়ে থাকা শ্রেণীর শিক্ষার্থীদের জন্য আলাদা ক্লাসরুম মনিটরিং।'
                    : 'Action: Increase classroom observation in lagging cohorts.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Core Optimized Analytics (2x2 Compact Grid - Easy to Understand & Decision-Oriented) */}
      {activeSectionTab === 'overview' && statusData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Card 1: Pass/Fail Health & Rate (Optimal & Compact) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-emerald-600" />
                  {language === 'bn' ? 'ফলাফল সাফল্য ও পাসের অনুপাত' : 'Pass vs. Fail Performance Health'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'উত্তীর্ণ ও অকৃতকার্য শিক্ষার্থীর আনুপাতিক চিত্র' : 'Pass rate and academic risk breakdown'}
                </p>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full font-mono ${
                passRate >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {toBanglaDigits(passRate)}% {language === 'bn' ? 'পাস' : 'Pass'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              {/* Compact Donut */}
              <div className="h-36 w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={56}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell 
                          key={`status-cell-${index}`} 
                          fill={entry.type === 'passed' ? '#10b981' : '#f43f5e'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any, item: any) => [
                        `${toBanglaDigits(value)} ${language === 'bn' ? 'জন' : 'students'} (${toBanglaDigits(item.payload.percent)}%)`,
                        item.payload.name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-slate-900 font-mono leading-none">
                    {toBanglaDigits(passRate)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    {language === 'bn' ? 'পাস রেট' : 'Pass Rate'}
                  </span>
                </div>
              </div>

              {/* Side Progress Meters */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {language === 'bn' ? 'কৃতকার্য শিক্ষার্থী' : 'Passed Students'}
                    </span>
                    <span className="font-mono font-black text-emerald-900">
                      {toBanglaDigits(statusData.find(d => d.type === 'passed')?.value || 0)} {language === 'bn' ? 'জন' : ''} ({toBanglaDigits(statusData.find(d => d.type === 'passed')?.percent || 0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${statusData.find(d => d.type === 'passed')?.percent || 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-800 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      {language === 'bn' ? 'অকৃতকার্য শিক্ষার্থী' : 'At-Risk / Failed'}
                    </span>
                    <span className="font-mono font-black text-rose-900">
                      {toBanglaDigits(statusData.find(d => d.type === 'failed')?.value || 0)} {language === 'bn' ? 'জন' : ''} ({toBanglaDigits(statusData.find(d => d.type === 'failed')?.percent || 0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-rose-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${statusData.find(d => d.type === 'failed')?.percent || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 flex items-center justify-between">
              <span>
                {language === 'bn'
                  ? `মোট মূল্যায়িত ${toBanglaDigits(totalEvaluatedCount)} জনের মধ্যে ${toBanglaDigits(statusData.find(d => d.type === 'passed')?.value || 0)} জন সফলভাবে পাস করেছে।`
                  : `Out of ${totalEvaluatedCount} evaluated, ${statusData.find(d => d.type === 'passed')?.value || 0} students achieved pass mark.`}
              </span>
              {atRiskStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAtRiskModal(true)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer ml-2 shrink-0"
                >
                  {language === 'bn' ? 'ফেল তালিকা →' : 'Fail list →'}
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Grade Quality & Tiers (Simplified, Scannable & Actionable) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  {language === 'bn' ? 'মেধা মান ও গ্রেড কোয়ালিটি' : 'Grade Quality & Tiers'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'উচ্চ মেধা, স্ট্যান্ডার্ড ও উন্নয়নমুখী মেধার অনুপাত' : 'Distribution across achievement tiers'}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                {toBanglaDigits(aPlusCount)} {language === 'bn' ? 'জন A+' : 'A+ Students'}
              </span>
            </div>

            {/* 4 Macro Tiers for Immediate Understanding */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                <div className="text-[11px] font-bold text-emerald-800 truncate">
                  {language === 'bn' ? 'উচ্চ মেধা (A+, A)' : 'Top (A+, A)'}
                </div>
                <div className="text-lg font-black text-emerald-900 font-mono">
                  {toBanglaDigits(gradeTiers.top.count)} <span className="text-xs font-normal text-emerald-700">({toBanglaDigits(gradeTiers.top.percent)}%)</span>
                </div>
                <div className="w-full bg-emerald-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${gradeTiers.top.percent}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                <div className="text-[11px] font-bold text-blue-800 truncate">
                  {language === 'bn' ? 'স্ট্যান্ডার্ড (A-, B)' : 'Mid (A-, B)'}
                </div>
                <div className="text-lg font-black text-blue-900 font-mono">
                  {toBanglaDigits(gradeTiers.mid.count)} <span className="text-xs font-normal text-blue-700">({toBanglaDigits(gradeTiers.mid.percent)}%)</span>
                </div>
                <div className="w-full bg-blue-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${gradeTiers.mid.percent}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 space-y-1">
                <div className="text-[11px] font-bold text-amber-800 truncate">
                  {language === 'bn' ? 'উন্নয়নমুখী (C, D)' : 'Low (C, D)'}
                </div>
                <div className="text-lg font-black text-amber-900 font-mono">
                  {toBanglaDigits(gradeTiers.low.count)} <span className="text-xs font-normal text-amber-700">({toBanglaDigits(gradeTiers.low.percent)}%)</span>
                </div>
                <div className="w-full bg-amber-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${gradeTiers.low.percent}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1">
                <div className="text-[11px] font-bold text-rose-800 truncate">
                  {language === 'bn' ? 'অকৃতকার্য (F)' : 'Fail (F)'}
                </div>
                <div className="text-lg font-black text-rose-900 font-mono">
                  {toBanglaDigits(gradeTiers.fail.count)} <span className="text-xs font-normal text-rose-700">({toBanglaDigits(gradeTiers.fail.percent)}%)</span>
                </div>
                <div className="w-full bg-rose-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${gradeTiers.fail.percent}%` }} />
                </div>
              </div>
            </div>

            {/* Granular Micro Bar Chart */}
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="grade" fontSize={10} tickLine={false} axisLine={false} stroke="#64748b" />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#64748b" tickFormatter={(v) => toBanglaDigits(v)} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: any, name: any, item: any) => [
                      `${toBanglaDigits(value)} ${language === 'bn' ? 'জন' : 'students'} (${toBanglaDigits(item.payload.percentage)}%)`,
                      `Grade ${item.payload.grade}`
                    ]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24}>
                    {gradeData.map((entry, index) => {
                      let color = '#3b82f6';
                      if (entry.grade === 'A+') color = '#10b981';
                      else if (entry.grade === 'A') color = '#059669';
                      else if (entry.grade === 'A-') color = '#0284c7';
                      else if (entry.grade === 'B') color = '#6366f1';
                      else if (entry.grade === 'C') color = '#f59e0b';
                      else if (entry.grade === 'D') color = '#ea580c';
                      else if (entry.grade === 'F') color = '#ef4444';
                      return <Cell key={`mini-grade-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Class Academic Benchmark (Optimal Height & Focused) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                  {language === 'bn' ? 'শ্রেণীভিত্তিক তুলনামূলক পারফরম্যান্স' : 'Class Academic Benchmarking'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'শ্রেণীসমূহের গড় জিপিএ (GPA) তুলনা' : 'Average GPA across classes (Scale 5.0)'}
                </p>
              </div>
              {topPerformingClass && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {language === 'bn' ? 'শীর্ষ:' : 'Top:'} {topPerformingClass.name}
                </span>
              )}
            </div>

            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedClass === 'All' ? classAverages : groupAverages} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} stroke="#64748b" />
                  <YAxis domain={[0, 5]} fontSize={10} tickLine={false} axisLine={false} stroke="#64748b" tickFormatter={(v) => toBanglaDigits(v)} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(val: any, name: any, item: any) => [
                      `GPA ${toBanglaDigits(val)} (${toBanglaDigits(item.payload.percentageEquivalent)}%) - ${toBanglaDigits(item.payload.count)} ${language === 'bn' ? 'জন' : 'students'}`,
                      item.payload.name
                    ]}
                  />
                  <Bar dataKey="average" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={26}>
                    {(selectedClass === 'All' ? classAverages : groupAverages).map((entry, index) => {
                      const isTop = topPerformingClass && entry.name === topPerformingClass.name;
                      return <Cell key={`bar-ca-${index}`} fill={isTop ? '#4338ca' : '#818cf8'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Strategic Comparison Callout */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-indigo-600 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {language === 'bn' ? 'শীর্ষ শ্রেণী' : 'Top Cohort'}
                </span>
                <div className="font-extrabold text-indigo-950 truncate">
                  {topPerformingClass ? `${topPerformingClass.name} (GPA ${toBanglaDigits(topPerformingClass.average)})` : '—'}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-amber-500" />
                  {language === 'bn' ? 'উন্নয়নমুখী শ্রেণী' : 'Needs Support'}
                </span>
                <div className="font-extrabold text-slate-800 truncate">
                  {strugglingClass ? `${strugglingClass.name} (GPA ${toBanglaDigits(strugglingClass.average)})` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Subject Performance & Pass Rates (Clean, High-Utility List) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  {language === 'bn' ? 'বিষয়ভিত্তিক সাফল্য ও পাসের হার' : 'Subject Pass Rates & Marks'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'bn' ? 'কোন বিষয়ে পাসের হার কেমন ও গড় নম্বর' : 'Subject-wise pass percentage & average scores'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSectionTab('subjects')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
              >
                <span>{language === 'bn' ? 'পূর্ণাঙ্গ বিশ্লেষণ' : 'Full view'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {subjectSummaryList.length > 0 ? (
                subjectSummaryList.slice(0, 5).map((subj) => {
                  const isHigh = subj.passRate >= 80;
                  const isLow = subj.passRate < 60;
                  return (
                    <div key={subj.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-bold text-slate-900 truncate">
                          {subj.name}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {language === 'bn' ? 'গড়:' : 'Avg:'} <strong className="font-mono text-slate-800">{toBanglaDigits(subj.avgMarks)}</strong>/{toBanglaDigits(subj.fullMarks)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                            isHigh ? 'bg-emerald-100 text-emerald-800' :
                            isLow ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {toBanglaDigits(subj.passRate)}% {language === 'bn' ? 'পাস' : 'Pass'}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${subj.passRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  {language === 'bn' ? 'কোনো বিষয় পাওয়া যায়নি' : 'No subjects available'}
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{language === 'bn' ? 'মোট মূল্যায়িত বিষয়:' : 'Evaluated subjects:'} <strong>{toBanglaDigits(subjectSummaryList.length)} {language === 'bn' ? 'টি' : ''}</strong></span>
              <button
                type="button"
                onClick={() => setActiveSectionTab('subjects')}
                className="font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                {language === 'bn' ? 'দুর্বল ও সবল বিষয় দেখুন →' : 'View subject diagnosis →'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 6. Top 5 Merit Roll Snapshot (In Overview) with Direct Link to Full Merit */}
      {activeSectionTab === 'overview' && topStudents.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="text-amber-500 h-4 w-4" />
                {language === 'bn' ? 'শীর্ষ ৫ মেধা তালিকা (Top 5 Merit Snapshot)' : 'Top 5 Merit Performers'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'সর্বোচ্চ জিপিএ ও মোট প্রাপ্ত নম্বরের ভিত্তিতে শীর্ষ ৫ শিক্ষার্থী' : 'Students with highest GPA & composite scores'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveSectionTab('merit')}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer self-start sm:self-auto"
            >
              <span>{language === 'bn' ? 'সম্পূর্ণ মেধা তালিকা দেখুন' : 'View Full Merit Roll'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                  <th className="py-2.5 px-3">{language === 'bn' ? 'স্থান' : 'Rank'}</th>
                  <th className="py-2.5 px-3">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                  <th className="py-2.5 px-3">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                  <th className="py-2.5 px-3">{language === 'bn' ? 'শ্রেণী' : 'Class'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'bn' ? 'মোট নম্বর' : 'Total Marks'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}</th>
                  <th className="py-2.5 px-3 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                  <th className="py-2.5 px-3 text-center">{language === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {topStudents.slice(0, 5).map((performer, index) => (
                  <tr key={performer.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-bold">
                      <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-black ${
                        index === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        index === 1 ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                        index === 2 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {toBanglaDigits(index + 1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {performer.roll ? toBanglaDigits(performer.roll) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {language === 'bn' ? (performer.nameBn || performer.name) : performer.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {getClassNameDisplay(performer.classLevel)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                      {toBanglaDigits(performer.totalMarks)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700">
                      {toBanglaDigits(performer.gpa.toFixed(2))}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {performer.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForTrajectory(performer.id);
                          setActiveSectionTab('student');
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer hover:underline"
                      >
                        {language === 'bn' ? 'প্রগ্রেস →' : 'Progress →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Deep-Dive Navigation Cards (In Overview) */}
      {activeSectionTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={() => setActiveSectionTab('student')}
            className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-indigo-100/40 border border-indigo-200/80 hover:border-indigo-300 transition-all cursor-pointer space-y-2 group shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-white text-indigo-700 shadow-2xs group-hover:scale-105 transition-transform">
                <Users className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>{language === 'bn' ? 'অ্যানালাইসিস ওপেন করুন' : 'Open Analytics'}</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
            <h4 className="text-sm font-bold text-indigo-950">
              {language === 'bn' ? 'শিক্ষার্থী পারফরম্যান্স ও ট্রাজেক্টরি কার্ড' : 'Student Performance & Trajectory'}
            </h4>
            <p className="text-xs text-indigo-900/70 leading-relaxed">
              {language === 'bn'
                ? 'নির্দিষ্ট শিক্ষার্থীর সকল পরীক্ষার ফলাফল, উন্নতি/অবনতি সূচক এবং বিষয়ভিত্তিক দুর্বলতা বা সবলতার বিস্তারিত বিশ্লেষণ।'
                : 'Deep-dive into individual student exams, upward/downward trends, and subject diagnosis.'}
            </p>
          </div>

          <div 
            onClick={() => setActiveSectionTab('subjects')}
            className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer space-y-2 group shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-white text-slate-700 shadow-2xs group-hover:scale-105 transition-transform">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>{language === 'bn' ? 'বিষয় তালিকা দেখুন' : 'View Subjects'}</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {language === 'bn' ? 'বিষয়ভিত্তিক অ্যানালাইসিস ও শিক্ষণ ঘাটতি' : 'Subject Diagnostics & Learning Gaps'}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? 'মাদ্রাসার সকল বিষয়ের বিস্তারিত পাস হার, ধারাবাহিক দুর্বল বিষয় এবং গ্রেড বণ্টন পরীক্ষা করে প্রয়োজনীয় পদক্ষেপ নিন।'
                : 'Examine pass percentage, recurring subject bottlenecks, and score distributions across subjects.'}
            </p>
          </div>
        </div>
      )}

      {/* 5. Student Performance & Progress Analysis Card (Core User Request Component) */}
      {(activeSectionTab === 'all' || activeSectionTab === 'student') && (
        <div className="w-full">
          <StudentPerformanceCard 
            initialClass={selectedClass} 
            initialStudentId={selectedStudentForTrajectory || undefined}
          />
        </div>
      )}

      {/* 6. Subject Performance Analytics Presentation (Repeatedly Strong vs Repeatedly Weak Subjects) */}
      {(activeSectionTab === 'all' || activeSectionTab === 'subjects') && (
        <div className="w-full">
          <SubjectPerformanceAnalytics
            subjects={subjects}
            students={students}
            marks={marks}
            exams={exams}
            classes={classes}
            selectedExamId={selectedExamId}
            selectedClass={selectedClass}
            language={language}
            t={t}
            toBanglaDigits={toBanglaDigits}
            getClassNameDisplay={getClassNameDisplay}
          />
        </div>
      )}

      {/* 7. Top Performing Students Table / Merit Roll Card */}
      {(activeSectionTab === 'all' || activeSectionTab === 'merit') && topStudents.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="text-amber-500 h-5 w-5" />
                {selectedClass === 'All' 
                  ? (language === 'bn' ? 'মাদ্রাসার পূর্ণাঙ্গ মেধা তালিকা (Full Merit Roll)' : 'Top Performing Students (Madrashah Merit Roll)')
                  : (language === 'bn' ? `${getClassNameDisplay(selectedClass)} এর মেধা তালিকা` : `Top Students - ${getClassNameDisplay(selectedClass)}`)}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'পরীক্ষায় প্রাপ্ত সর্বোচ্চ জিপিএ ও নম্বরের ভিত্তিতে মেধা ক্রমানুসার' : 'Merit ranking based on highest GPA and total marks'}
              </p>
            </div>

            {/* Quick Merit Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'bn' ? 'মেধাতালিকায় খুঁজুন...' : 'Search rank list...'}
                value={meritSearchQuery}
                onChange={(e) => setMeritSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                  <th className="py-3 px-3.5">{language === 'bn' ? 'স্থান' : 'Rank'}</th>
                  <th className="py-3 px-3.5">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                  <th className="py-3 px-3.5">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                  <th className="py-3 px-3.5">{language === 'bn' ? 'আইডি' : 'Student ID'}</th>
                  {selectedClass === 'All' && <th className="py-3 px-3.5">{language === 'bn' ? 'শ্রেণী' : 'Class'}</th>}
                  <th className="py-3 px-3.5 text-right">{language === 'bn' ? 'মোট নম্বর' : 'Total Marks'}</th>
                  <th className="py-3 px-3.5 text-right">{language === 'bn' ? 'জিপিএ (GPA)' : 'GPA'}</th>
                  <th className="py-3 px-3.5 text-center">{language === 'bn' ? 'গ্রেড' : 'Grade'}</th>
                  <th className="py-3 px-3.5 text-center">{language === 'bn' ? 'বিশ্লেষণ' : 'Analysis'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTopStudents.map((performer, index) => (
                  <tr key={performer.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 font-bold">
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black ${
                        index === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        index === 1 ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                        index === 2 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {toBanglaDigits(index + 1)}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                      {performer.roll ? toBanglaDigits(performer.roll) : '—'}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">
                      {language === 'bn' ? (performer.nameBn || performer.name) : performer.name}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-500 text-[11px]">
                      {toBanglaDigits(performer.studentId || performer.id || '—')}
                    </td>
                    {selectedClass === 'All' && (
                      <td className="py-3 px-3.5 text-slate-700">
                        {getClassNameDisplay(performer.classLevel)}
                      </td>
                    )}
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                      {toBanglaDigits(performer.totalMarks)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-black text-indigo-700">
                      {toBanglaDigits(performer.gpa.toFixed(2))}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        performer.grade === 'A+' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        performer.grade === 'A' || performer.grade === 'A-' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        performer.grade === 'F' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {performer.grade}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForTrajectory(performer.id);
                          setActiveSectionTab('student');
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer hover:underline"
                      >
                        {language === 'bn' ? 'প্রগ্রেস কার্ড →' : 'View Card →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. At-Risk Students Action Modal (তাৎক্ষণিক দুর্বল শিক্ষার্থী তালিকা ও অ্যাকশন প্ল্যান) */}
      {showAtRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    {language === 'bn' ? 'ঝুঁকিপূর্ণ শিক্ষার্থীদের তালিকা ও আশু করণীয়' : 'At-Risk & Struggling Students Intervention List'}
                  </h3>
                  <p className="text-xs text-rose-200/80">
                    {language === 'bn' 
                      ? `বর্তমান মূল্যায়নে অকৃতকার্য মোট ${toBanglaDigits(atRiskStudents.length)} জন শিক্ষার্থী` 
                      : `${atRiskStudents.length} students who did not meet pass requirements`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAtRiskModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: List of Students */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {atRiskStudents.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  {language === 'bn' ? 'কোনো অকৃতকার্য শিক্ষার্থী নেই। মাশাআল্লাহ!' : 'No at-risk students found.'}
                </div>
              ) : (
                atRiskStudents.map((s: any) => {
                  const studentObj = s.student || s;
                  const sId = s.id || studentObj.id;
                  const sName = language === 'bn' 
                    ? (studentObj.nameBn || studentObj.name || s.nameBn || s.name || '') 
                    : (studentObj.name || s.name || '');
                  const sRoll = studentObj.roll || s.roll || '—';
                  const sClass = studentObj.classLevel || s.classLevel || '';
                  const sTotalMarks = s.totalMarks ?? studentObj.totalMarks ?? 0;
                  const sFailCount = s.failCount ?? studentObj.failCount ?? 0;

                  return (
                    <div 
                      key={sId}
                      className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50/70 transition space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{sName}</span>
                            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                              {language === 'bn' ? 'রোল:' : 'Roll:'} {toBanglaDigits(sRoll)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {language === 'bn' ? 'শ্রেণী:' : 'Class:'} <strong className="text-slate-700">{getClassNameDisplay(sClass)}</strong> • {language === 'bn' ? 'মোট প্রাপ্ত নম্বর:' : 'Total Marks:'} <strong className="font-mono text-slate-800">{toBanglaDigits(sTotalMarks)}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            {toBanglaDigits(sFailCount)} {language === 'bn' ? 'বিষয়ে ফেল' : 'failed subjects'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAtRiskModal(false);
                              setSelectedStudentForTrajectory(sId);
                              setActiveSectionTab('student');
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <span>{language === 'bn' ? 'পূর্ণাঙ্গ অ্যানালাইসিস' : 'Analytics'}</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Failed Subjects Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-200/50 text-xs">
                        <span className="text-[11px] font-bold text-rose-800">
                          {language === 'bn' ? 'ফেলকৃত বিষয়সমূহ:' : 'Failed in:'}
                        </span>
                        {(s.failedSubjectNames || []).map((subj: any, idx: number) => {
                          const isObj = typeof subj === 'object' && subj !== null;
                          const name = isObj ? subj.name : subj;
                          const marksVal = isObj ? subj.marks : null;
                          const fullMarksVal = isObj ? subj.fullMarks : null;

                          return (
                            <span 
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 text-[11px] font-semibold"
                            >
                              <span>{name}</span>
                              {marksVal !== null && fullMarksVal !== null && (
                                <span className="font-mono font-bold text-rose-900">
                                  ({toBanglaDigits(marksVal)}/{toBanglaDigits(fullMarksVal)})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer: Guidance */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-600 text-center sm:text-left">
                {language === 'bn'
                  ? 'উপদেশ: ফেলকৃত বিষয়ের শিক্ষকদের সাথে বিষয়ভিত্তিক রিভিশন ও অভিভাবকের সাথে কাউন্সিলিং নিশ্চিত করুন।'
                  : 'Intervention: Assign subject-specific remedial sessions & arrange guardian consultation.'}
              </span>
              <button
                type="button"
                onClick={() => setShowAtRiskModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
