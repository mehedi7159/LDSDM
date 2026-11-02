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
import { resolveGuardianChildren } from '../services/guardianScope';
import { dailyAttendanceService } from '../services/dailyAttendanceService';
import { calculateSingleStudentDue } from '../services/studentDuesService';
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
  // child as the guardian's own) is gone.
  const children = useMemo(() => {
    return resolveGuardianChildren(currentUser, students, {
      phones: [currentMember?.phone],
      emails: [currentMember?.email, authUser?.email]
    });
  }, [currentUser, currentMember, authUser, students]);

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const linkedStudent = useMemo(() => {
    if (children.length === 0) return null;
    return children.find(c => c.id === selectedChildId) || children[0];
  }, [children, selectedChildId]);

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Calculate results for the student
  const resultData = useMemo(() => {
    if (!linkedStudent || !selectedExam) return null;
    const studentSubjects = subjects.filter(s => s.classLevel === linkedStudent.classLevel);
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
  const feeSummary = useMemo(() => {
    if (!linkedStudent) return { paid: 0, due: 0, monthlyExpected: 0, transactions: [] as typeof transactions };
    const studentTx = transactions.filter(t => t.studentId === linkedStudent.id || (t.studentCode && t.studentCode === linkedStudent.studentId));
    const profile = calculateSingleStudentDue(linkedStudent, feeStructures, transactions, undefined, feeTypes);
    return {
      paid: profile.totalPaidLifetime,
      due: profile.dueThisMonth,
      monthlyExpected: profile.monthlyExpected,
      transactions: studentTx
    };
  }, [linkedStudent, transactions, feeStructures]);

  // Attendance for the selected child — RECORDED days only (the
  // honest-zero rule): figures come from the daily attendance records
  // for this student; a child with no records gets the no-record
  // state, never an invented rate (the old tab hard-coded
  // 220 days / 212 present / 96.4% for every guardian).
  const attendanceSummary = useMemo(() => {
    if (!linkedStudent) return null;
    return dailyAttendanceService.calculateStudentAttendanceForExam(linkedStudent.id);
  }, [linkedStudent]);

  // Unlinked guardian account: an honest empty state — NEVER another
  // student's data and never the full directory as a fallback.
  if (!linkedStudent) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-3xl text-center max-w-sm w-full space-y-3 shadow-md">
          <AlertCircle size={36} className="text-amber-500 mx-auto" />
          <h3 className="font-bold text-slate-800">
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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-20 md:pb-6">
      {/* Top Mobile-First App Header */}
      <header className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 flex items-center justify-center font-bold text-sm shadow-inner">
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
            <span className="text-xs font-bold text-slate-500">{language === 'en' ? 'My children:' : 'আমার সন্তান:'}</span>
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                  linkedStudent.id === child.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
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
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">পরীক্ষা নির্বাচন:</span>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.nameBn || ex.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQrModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">অ্যাকাডেমিক মূল্যায়ন</span>
                    <h3 className="text-xl font-black">{selectedExam?.nameBn || selectedExam?.name}</h3>
                    <p className="text-xs text-emerald-100/90 mt-0.5">মোট প্রাপ্ত নম্বর: {formatBanglaNumber(resultData.gpaSummary.totalMarks)}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl text-center border border-white/20 min-w-[90px]">
                      <span className="text-[10px] font-bold block text-emerald-200">লেটার গ্রেড</span>
                      <span className="text-2xl font-black font-mono">{resultData.gpaSummary.grade}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl text-center border border-white/20 min-w-[90px]">
                      <span className="text-[10px] font-bold block text-emerald-200">জিপিএ (GPA)</span>
                      <span className="text-2xl font-black font-mono">{resultData.gpaSummary.gpa.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Subject-wise Marks Table */}
                <div className="p-4 sm:p-6">
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
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
                      <tbody className="divide-y divide-slate-100">
                        {resultData.subjects.map(sub => {
                          const mark = marks.find(m => m.studentId === linkedStudent.id && m.subjectId === sub.id && m.examId === selectedExam.id);
                          const obtained = mark?.obtained ?? 0;
                          const { grade, gpa } = calculateGrade(obtained, sub.fullMarks || 100);

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-800">
                                {sub.nameBn || sub.name} {sub.isOptional ? '(৪র্থ বিষয়)' : ''}
                              </td>
                              <td className="p-3 text-center font-mono text-slate-600">{formatBanglaNumber(sub.fullMarks || 100)}</td>
                              <td className="p-3 text-center font-mono text-slate-600">{mark?.obtainedCQ !== undefined ? formatBanglaNumber(mark.obtainedCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono text-slate-600">{mark?.obtainedMCQ !== undefined ? formatBanglaNumber(mark.obtainedMCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900">{mark?.isAbsent ? 'অনুপস্থিত' : formatBanglaNumber(obtained)}</td>
                              <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                  grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                                  grade === 'F' ? 'bg-rose-100 text-rose-800' :
                                  'bg-blue-50 text-blue-800'
                                }`}>
                                  {grade}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-700">{gpa.toFixed(2)}</td>
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
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-semibold text-slate-400 block">রেকর্ডকৃত দিন</span>
                    <span className="text-2xl font-black text-slate-800 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.workingDays)} দিন</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-semibold text-emerald-600 block">উপস্থিত</span>
                    <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.totalPresent)} দিন</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-semibold text-rose-600 block">অনুপস্থিত</span>
                    <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.totalAbsent)} দিন</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-semibold text-blue-600 block">উপস্থিতির হার</span>
                    <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">{formatBanglaNumber(attendanceSummary.attendancePercentage)}%</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'en'
                    ? 'Calculated from recorded attendance days only.'
                    : 'হিসাবটি শুধু রেকর্ডকৃত হাজিরার দিনের ভিত্তিতে।'}
                </p>
              </>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs text-center space-y-2">
                <AlertCircle size={28} className="text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
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
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl">
                <span className="text-xs font-bold text-emerald-800 block">মোট পরিশোধিত বেতন ও ফি</span>
                <span className="text-3xl font-black text-emerald-900 font-mono mt-1 block">
                  ৳ {formatBanglaNumber(feeSummary.paid)}
                </span>
                <span className="text-[11px] text-emerald-700 mt-1 block">চলতি শিক্ষাবর্ষের আদায়</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl">
                <span className="text-xs font-bold text-amber-800 block">চলতি মাসের বকেয়া (যদি থাকে)</span>
                <span className="text-3xl font-black text-amber-900 font-mono mt-1 block">
                  ৳ {formatBanglaNumber(feeSummary.due)}
                </span>
                <span className="text-[11px] text-amber-700 mt-1 block">নিয়মিত বেতন পরিশোধে সহযোগিতা করুন</span>
              </div>
            </div>

            {/* Transactions History */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="text-sm font-bold text-slate-900">মানি রিসিট ও জমার ইতিহাস</h4>
              {feeSummary.transactions.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">এখনো কোনো ফি জমার ট্রানজেকশন নেই।</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {feeSummary.transactions.map(t => (
                    <div key={t.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 block">{t.categoryName || 'মাসিক ছাত্র বেতন'}</span>
                        <span className="text-[11px] text-slate-400 font-mono">রিসিট নং: {t.voucherNo} | তারিখ: {t.date}</span>
                      </div>
                      <span className="font-bold text-emerald-700 font-mono text-sm">৳ {formatBanglaNumber(t.amount)}</span>
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
