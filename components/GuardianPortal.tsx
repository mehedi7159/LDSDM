import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, 
  Award, 
  Calendar, 
  Wallet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  Download, 
  Printer, 
  QrCode, 
  Sparkles, 
  Phone, 
  User, 
  Clock, 
  Check, 
  X,
  CreditCard
} from 'lucide-react';
import { calculateTotalGPA, calculateGrade, formatBanglaNumber, toBengali } from '../services/utils';
import { classNamesMatch } from '../services/classNames';
import { resolveGuardianChildren } from '../services/guardianScope';
import { calculateStudentAttendanceForExamFromRecords } from '../services/dailyAttendanceService';
import { calculateTotalDues, localMonthStr, academicYearFallbackStartMonth } from '../services/studentDuesService';
import { VerifiedResultModal } from './VerifiedResultModal';

type GuardianPortalTab = 'results' | 'attendance' | 'fees';

/**
 * sessionStorage bridge: the mobile parent home writes the tab the
 * guardian tapped (results / attendance / fees) before opening this
 * portal through the module passthrough, so the portal opens on the
 * right tab. Read once, then cleared.
 */
const PORTAL_TAB_HINT_KEY = 'ldsdm_guardian_portal_tab';
function readPortalTabHint(): GuardianPortalTab {
  try {
    const v = sessionStorage.getItem(PORTAL_TAB_HINT_KEY);
    sessionStorage.removeItem(PORTAL_TAB_HINT_KEY);
    if (v === 'attendance' || v === 'fees' || v === 'results') return v;
  } catch { /* storage unavailable — default below */ }
  return 'results';
}

export const GuardianPortal: React.FC = () => {
  const {
    currentUser,
    currentMember,
    authUser,
    schoolProfile,
    students,
    subjects,
    exams,
    marks,
    transactions,
    feeStructures,
    feeTypes = [],
    academicYears = [],
    dailyStudentAttendance = [],
    pinGuardianStudentId,
    logoutUser,
    language
  } = useApp();

  const [activeTab, setActiveTab] = useState<GuardianPortalTab>(() => readPortalTabHint());
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
  const [showQrModal, setShowQrModal] = useState(false);

  // The guardian's OWN child(ren) — the single linkage in
  // services/guardianScope.ts (account studentId, then guardian
  // phone/email matches; siblings included). An unlinked account
  // resolves to an EMPTY set and gets the no-link state below — the
  // old `students[0]` "demo" fallback (which showed a stranger's
  // child as the guardian's own) is gone. A guardian PIN session
  // (L7) has no account at all: its children are exactly the PIN
  // student — never the email/phone linkage, never a fallback.
  const children = useMemo(() => {
    if (pinGuardianStudentId) {
      return students.filter(s => s.id === pinGuardianStudentId);
    }
    return resolveGuardianChildren(currentUser, students, {
      phones: [currentMember?.phone],
      emails: [currentMember?.email, authUser?.email]
    });
  }, [pinGuardianStudentId, currentUser, currentMember, authUser, students]);

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const linkedStudent = useMemo(() => {
    if (children.length === 0) return null;
    return children.find(c => c.id === selectedChildId) || children[0];
  }, [children, selectedChildId]);

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Calculate results for the student
  const resultData = useMemo(() => {
    if (!linkedStudent || !selectedExam) return null;
    const studentSubjects = subjects.filter(s => classNamesMatch(s.classLevel, linkedStudent.classLevel));
    const studentMarks = marks.filter(m => m.studentId === linkedStudent.id && m.examId === selectedExam.id);
    const gpaSummary = calculateTotalGPA(studentSubjects, marks, linkedStudent.id, selectedExam.id, linkedStudent.group, exams);

    return {
      subjects: studentSubjects,
      marks: studentMarks,
      gpaSummary
    };
  }, [linkedStudent, selectedExam, subjects, marks, exams]);

  // Fee summary for the selected child — the canonical dues service
  // (the same figures the office and the mobile app show), replacing
  // the old ad-hoc "monthly tuition x 10 months, default 800" estimate.
  // The tab used to show the current month only (dueThisMonth); the
  // shared total (finished months only, with its month count) is shown
  // beside it, so the guardian sees the same figure as the office
  // (21 Nov 2026 audit: portal said one month, office said the
  // total). The current month's fee is shown in its own card as
  // "চলতি মাসের ফি" — it is not dues yet (a month's fee becomes due
  // only after that month ends). The month is the shared local month,
  // not UTC.
  const feeSummary = useMemo(() => {
    if (!linkedStudent) return { paid: 0, due: 0, totalDue: 0, dueMonthCount: 0, monthlyExpected: 0, transactions: [] as typeof transactions };
    const studentTx = transactions.filter(t => t.studentId === linkedStudent.id || (t.studentCode && t.studentCode === linkedStudent.studentId));
    const month = localMonthStr();
    const summary = calculateTotalDues(
      [linkedStudent], feeStructures, transactions, month, feeTypes,
      academicYearFallbackStartMonth(academicYears, month));
    const entry = summary.entries[0];
    return {
      paid: entry?.profile.totalPaidLifetime ?? 0,
      due: entry?.profile.dueThisMonth ?? 0,
      totalDue: entry?.totalDue ?? 0,
      dueMonthCount: entry?.dueMonthCount ?? 0,
      monthlyExpected: entry?.profile.monthlyExpected ?? 0,
      transactions: studentTx
    };
  }, [linkedStudent, transactions, feeStructures, feeTypes, academicYears]);

  // Attendance for the selected child — RECORDED days only (the
  // honest-zero rule): figures come from the daily attendance records
  // for this student; a child with no records gets the no-record
  // state, never an invented rate (the old tab hard-coded
  // 220 days / 212 present / 96.4% for every guardian).
  // Master audit F6: computed from the REACTIVE context array, not
  // the service singleton — the singleton never re-renders this memo,
  // so the tab went stale after cloud hydration.
  const attendanceSummary = useMemo(() => {
    if (!linkedStudent) return null;
    return calculateStudentAttendanceForExamFromRecords(dailyStudentAttendance, linkedStudent.id);
  }, [linkedStudent, dailyStudentAttendance]);

  // Unlinked guardian account: an honest empty state — NEVER another
  // student's data and never the full directory as a fallback.
  if (!linkedStudent) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] flex items-center justify-center p-4">
 <div className="bg-white dark:bg-[#161c2e] p-6 rounded-3xl text-center max-w-sm w-full space-y-3">
          <AlertCircle size={36} className="text-amber-500 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            {language === 'en'
              ? 'No student linked yet — please contact the office'
              : 'কোনো শিক্ষার্থী যুক্ত করা হয়নি — অফিসে যোগাযোগ করুন'}
          </h3>
          <button onClick={logoutUser} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">লগআউট</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] flex flex-col font-bangla pb-20 md:pb-6">
      {/* Top Mobile-First App Header */}
      <header className="bg-emerald-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 flex items-center justify-center font-bold text-sm">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  {linkedStudent.nameBn || linkedStudent.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  অভিভাবক পোর্টাল
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                রোল: {formatBanglaNumber(linkedStudent.roll)} | শ্রেণি: {linkedStudent.classLevel}
              </p>
            </div>
          </div>

          <button
            onClick={logoutUser}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-900/60 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-2 flex border-t border-emerald-800/60 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'results' 
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/40' 
                : 'border-transparent text-emerald-200/70 hover:text-white'
            }`}
          >
            <GraduationCap size={15} />
            <span>ফলাফল ও মার্কশিট</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'attendance' 
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/40' 
                : 'border-transparent text-emerald-200/70 hover:text-white'
            }`}
          >
            <Calendar size={15} />
            <span>হাজিরা রিপোর্ট</span>
          </button>

          <button
            onClick={() => setActiveTab('fees')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'fees' 
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/40' 
                : 'border-transparent text-emerald-200/70 hover:text-white'
            }`}
          >
            <Wallet size={15} />
            <span>বেতন ও হিসাব</span>
          </button>
        </div>
      </header>

      {/* Main App Body */}
      <main className="max-w-4xl w-full mx-auto px-4 py-5 flex-1 space-y-5">

        {/* Child switcher — guardians with more than one child at the
            madrasa pick which child's data is shown. Every tab below
            is scoped to the selected child only. */}
        {children.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{language === 'en' ? 'My children:' : 'আমার সন্তান:'}</span>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                  linkedStudent.id === child.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-[#161c2e] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-400'
                }`}
              >
                {child.nameBn || child.name} • {child.classLevel}
              </button>
            ))}
          </div>
        )}

        {/* Tab 1: Results */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {/* Exam selector filter */}
 <div className="bg-white dark:bg-[#161c2e] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">পরীক্ষা নির্বাচন:</span>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#161c2e] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.nameBn || ex.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQrModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode size={14} />
                  <span>ভেরিফিকেশন QR</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>প্রিন্ট</span>
                </button>
              </div>
            </div>

            {/* Performance Snapshot Card */}
            {resultData && (
 <div className="bg-white dark:bg-[#161c2e] rounded-3xl border border-slate-200/90 dark:border-white/10 overflow-hidden">
                <div className="bg-emerald-800 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">অ্যাকাডেমিক মূল্যায়ন</span>
                    <h3 className="text-xl font-black">{selectedExam?.nameBn || selectedExam?.name}</h3>
                    <p className="text-xs text-emerald-100/90 mt-0.5">মোট প্রাপ্ত নম্বর: {formatBanglaNumber(resultData.gpaSummary.totalMarks)}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl text-center border border-white/20 min-w-[90px]">
                      <span className="text-[10px] font-bold block text-emerald-200">লেটার গ্রেড</span>
                      <span className="text-3xl font-black font-mono">{resultData.gpaSummary.grade}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl text-center border border-white/20 min-w-[90px]">
                      <span className="text-[10px] font-bold block text-emerald-200">জিপিএ (GPA)</span>
                      <span className="text-3xl font-black font-mono">{resultData.gpaSummary.gpa.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Subject-wise Marks Table */}
                <div className="p-4 sm:p-6">
                  <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-bold">
                        <tr>
                          <th className="p-3">বিষয়</th>
                          <th className="p-3 text-center">পূর্ণমান</th>
                          <th className="p-3 text-center">CQ</th>
                          <th className="p-3 text-center">MCQ/মৌখিক</th>
                          <th className="p-3 text-center">মোট নম্বর</th>
                          <th className="p-3 text-center">গ্রেড</th>
                          <th className="p-3 text-center">পয়েন্ট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                        {resultData.subjects.map(sub => {
                          const mark = marks.find(m => m.studentId === linkedStudent.id && m.subjectId === sub.id && m.examId === selectedExam.id);
                          const obtained = mark?.obtained ?? 0;
                          const { grade, gpa } = calculateGrade(obtained, sub.fullMarks || 100);

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                              <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                                {sub.nameBn || sub.name} {sub.isOptional ? '(৪র্থ বিষয়)' : ''}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">{formatBanglaNumber(sub.fullMarks || 100)}</td>
                              <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">{mark?.obtainedCQ !== undefined ? formatBanglaNumber(mark.obtainedCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">{mark?.obtainedMCQ !== undefined ? formatBanglaNumber(mark.obtainedMCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{mark?.isAbsent ? 'অনুপস্থিত' : formatBanglaNumber(obtained)}</td>
                              <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                  grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                                  grade === 'F' ? 'bg-rose-100 text-rose-800' :
                                  'bg-blue-50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300'
                                }`}>
                                  {grade}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-200">{gpa.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Attendance — recorded days only */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {attendanceSummary && attendanceSummary.workingDays > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="bg-white dark:bg-[#161c2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">রেকর্ডকৃত দিন</span>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.workingDays)} দিন</span>
                  </div>
 <div className="bg-white dark:bg-[#161c2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">উপস্থিত</span>
                    <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.totalPresent)} দিন</span>
                  </div>
 <div className="bg-white dark:bg-[#161c2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 block">অনুপস্থিত</span>
                    <span className="text-3xl font-black text-rose-700 dark:text-rose-400 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.totalAbsent)} দিন</span>
                  </div>
 <div className="bg-white dark:bg-[#161c2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">উপস্থিতির হার</span>
                    <span className="text-4xl font-black text-blue-700 dark:text-blue-400 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.attendancePercentage)}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {language === 'en'
                    ? 'Calculated from recorded attendance days only.'
                    : 'হিসাবটি শুধু রেকর্ডকৃত হাজিরার দিনের ভিত্তিতে।'}
                </p>
              </>
            ) : (
 <div className="bg-white dark:bg-[#161c2e] rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 text-center space-y-2">
                <AlertCircle size={28} className="text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {language === 'en' ? 'No attendance records yet' : 'এখনো কোনো হাজিরার রেকর্ড নেই'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Fees */}
        {activeTab === 'fees' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-5 rounded-3xl">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">মোট পরিশোধিত বেতন ও ফি</span>
                <span className="text-3xl font-black text-emerald-900 dark:text-emerald-200 font-mono mt-1 block">
                  ৳ {formatBanglaNumber(feeSummary.paid)}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 block">চলতি শিক্ষাবর্ষের আদায়</span>
              </div>

              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-5 rounded-3xl">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">চলতি মাসের ফি (যদি থাকে)</span>
                <span className="text-3xl font-black text-amber-900 dark:text-amber-200 font-mono mt-1 block">
                  ৳ {formatBanglaNumber(feeSummary.due)}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 block">নিয়মিত বেতন পরিশোধে সহযোগিতা করুন</span>
              </div>

              {/* Shared total — the same figure the office sees (finished
                  months only), with its month count. */}
              <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-5 rounded-3xl sm:col-span-2">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">মোট বকেয়া</span>
                <span className="text-3xl font-black text-rose-900 dark:text-rose-200 font-mono mt-1 block">
                  ৳ {formatBanglaNumber(feeSummary.totalDue)}
                </span>
                <span className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 block">{feeSummary.dueMonthCount > 0 ? `${formatBanglaNumber(feeSummary.dueMonthCount)} মাসের বকেয়া` : 'কোনো বকেয়া নেই'}</span>
              </div>
            </div>

            {/* Transactions History */}
 <div className="bg-white dark:bg-[#161c2e] rounded-3xl p-5 border border-slate-200/80 dark:border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">মানি রিসিট ও জমার ইতিহাস</h4>
              {feeSummary.transactions.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">এখনো কোনো ফি জমার ট্রানজেকশন নেই।</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/10 text-xs">
                  {feeSummary.transactions.map(t => (
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{t.categoryName || 'মাসিক ছাত্র বেতন'}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">রিসিট নং: {t.voucherNo} | তারিখ: {t.date}</span>
                      </div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">৳ {formatBanglaNumber(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* QR Modal */}
      {showQrModal && linkedStudent && selectedExam && (
        <VerifiedResultModal
          student={linkedStudent}
          exam={selectedExam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
