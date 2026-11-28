import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Printer, 
  QrCode, 
  User, 
  XCircle
} from 'lucide-react';
import { calculateTotalGPA, calculateGrade, formatBanglaNumber, toBengali } from '../services/utils';
import { classNamesMatch } from '../services/classNames';
import { resolveGuardianChildren } from '../services/guardianScope';
import { calculateStudentAttendanceForExamFromRecords } from '../services/dailyAttendanceService';
import { calculateTotalDues, localMonthStr, academicYearFallbackStartMonth } from '../services/studentDuesService';
import { VerifiedResultModal } from './VerifiedResultModal';
import { PageHeader, StatCard, EmptyState } from './ui';

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

/** Grade badge tone — A+ emerald, F rose, everything else brand (Job 3 G8:
    the old blue-50 fallback is gone). Shared by the table and the mobile
    stacked cards so the two never drift apart. */
const gradeBadgeTone = (grade: string) =>
  grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
  grade === 'F' ? 'bg-rose-100 text-rose-800' :
  'bg-[var(--color-brand-light)] text-[var(--color-brand)]';

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

  // The tab is set by the mobile bottom nav / home tiles through the
  // sessionStorage hint above (a remount reads it); nothing inside the
  // portal switches tabs any more (Job 3 G4).
  const [activeTab] = useState<GuardianPortalTab>(() => readPortalTabHint());
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

  // Job 3 G2 — a missing mark record must NEVER render as 0 / F.
  // The GPA engine (services/utils.ts, shared with ResultView and the
  // marksheet) counts an unmarked subject as obtained 0, so its GPA
  // and grade are meaningless until every core subject is marked.
  // Rendering-only fix here — the engine is untouched: the hero shows
  // '—' until all core subjects have a mark record, 'আংশিক' while
  // some are still pending. A real record (obtained 0, or absent)
  // still shows its real grade — only a MISSING record shows '—'.
  // Core subjects mirror the engine: non-optional, group-filtered.
  const coreSubjects = useMemo(() => {
    if (!resultData || !linkedStudent) return [];
    return resultData.subjects.filter(s =>
      !s.isOptional && (!s.group || s.group === 'All' || s.group === linkedStudent.group));
  }, [resultData, linkedStudent]);
  const hasAnyMark = (resultData?.marks.length ?? 0) > 0;
  const markedCoreCount = useMemo(() => {
    if (!resultData) return 0;
    return coreSubjects.filter(s => resultData.marks.some(m => m.subjectId === s.id)).length;
  }, [resultData, coreSubjects]);
  const marksComplete = coreSubjects.length > 0 && markedCoreCount === coreSubjects.length;

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

  // U5 — monthly attendance calendar (V3 ledger reuse, read-only):
  // the guardian sees only their OWN child's records (linkedStudent),
  // day by day, exactly as the staff profile ledger shows them —
  // Friday = weekly holiday, a working day with no record =
  // 'নথিভুক্ত নয়', never invented. Summary follows the service's
  // canonical monthly definition (recorded non-Friday days only).
  const [guardianAttendanceMonth, setGuardianAttendanceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const guardianMonthlyAttendance = useMemo(() => {
    const empty = {
      days: [] as Array<{ day: number; date: string; dayNameBn: string; dayNameEn: string; status: 'HOLIDAY' | 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'NOT_RECORDED'; label: string }>,
      summary: { workingDays: 0, present: 0, absent: 0, late: 0, leave: 0, rate: 0, scheduledDays: 0, isPartial: false },
    };
    if (!linkedStudent) return empty;

    // This student's records, newest first (same as the profile
    // ledger) — newest record wins per date.
    const myRecords = dailyStudentAttendance
      .filter(r =>
        r.studentId === linkedStudent.id ||
        (linkedStudent.studentId && r.studentId === linkedStudent.studentId))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const [yearStr, monthStr] = guardianAttendanceMonth.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthRecByDate = new Map<string, string>();
    for (const r of myRecords) {
      if (!r.date || !r.date.startsWith(monthPrefix)) continue;
      if (!monthRecByDate.has(r.date)) monthRecByDate.set(r.date, r.status);
    }

    const dayNamesBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const statusLabel = (status: string) =>
      status === 'PRESENT' ? (language === 'bn' ? 'উপস্থিত' : 'Present')
      : status === 'ABSENT' ? (language === 'bn' ? 'অনুপস্থিত' : 'Absent')
      : status === 'LATE' ? (language === 'bn' ? 'বিলম্বে উপস্থিত' : 'Late')
      : status === 'LEAVE' ? (language === 'bn' ? 'ছুটিতে' : 'Leave')
      : (language === 'bn' ? 'নথিভুক্ত নয়' : 'Not recorded');

    const days: typeof empty.days = [];
    let scheduledDays = 0;
    let workingDays = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 5 is Friday
      const isFriday = dayOfWeek === 5; // Friday is weekly holiday in Madrasah/Bangladesh
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const base = {
        day: d,
        date: dateString,
        dayNameBn: dayNamesBn[dayOfWeek],
        dayNameEn: dayNamesEn[dayOfWeek],
      };
      if (isFriday) {
        days.push({ ...base, status: 'HOLIDAY' as const, label: language === 'bn' ? 'সাপ্তাহিক ছুটি' : 'Weekly Holiday' });
        continue;
      }
      scheduledDays++;
      const rec = monthRecByDate.get(dateString);
      if (!rec || (rec !== 'PRESENT' && rec !== 'ABSENT' && rec !== 'LATE' && rec !== 'LEAVE')) {
        days.push({ ...base, status: 'NOT_RECORDED' as const, label: statusLabel('NOT_RECORDED') });
        continue;
      }
      workingDays++;
      if (rec === 'PRESENT') presentCount++;
      else if (rec === 'ABSENT') absentCount++;
      else if (rec === 'LATE') { lateCount++; presentCount++; } // Late is still counted present
      else if (rec === 'LEAVE') leaveCount++;
      days.push({ ...base, status: rec as 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE', label: statusLabel(rec) });
    }

    const rate = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;

    return {
      days,
      summary: {
        workingDays,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        leave: leaveCount,
        rate,
        scheduledDays,
        isPartial: workingDays < scheduledDays,
      },
    };
  }, [linkedStudent, guardianAttendanceMonth, language, dailyStudentAttendance]);

  // Unlinked guardian account: an honest empty state — NEVER another
  // student's data and never the full directory as a fallback.
  if (!linkedStudent) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] flex items-center justify-center p-4 font-bangla">
        <EmptyState
          icon={AlertCircle}
          title={language === 'en' ? 'No student linked yet' : 'কোনো শিক্ষার্থী যুক্ত করা হয়নি'}
          description={language === 'en'
            ? 'Please contact the madrasa office to link your child to this account.'
            : 'আপনার সন্তানকে এই অ্যাকাউন্টের সঙ্গে যুক্ত করতে অফিসে যোগাযোগ করুন।'}
          actionLabel="লগআউট"
          onAction={logoutUser}
          actionIcon={LogOut}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] dark:bg-[#0e1220] flex flex-col font-bangla pb-20 md:pb-6">
      {/* Header — shared PageHeader, brand tone (Job 3 G1/G9). The old
          dark emerald header is gone. Tab switching lives on the
          mobile bottom nav (Job 3 G4): the portal's own sticky tab row
          is removed — the bottom nav is the only switcher, and the
          parent home / bottom nav re-opens the portal on the tapped
          tab through the sessionStorage hint (remount per open). */}
      <div className="max-w-4xl w-full mx-auto px-4 pt-5">
        <PageHeader
          tone="brand"
          icon={User}
          eyebrow="অভিভাবক পোর্টাল"
          title={linkedStudent.nameBn || linkedStudent.name}
          subtitle={`রোল: ${formatBanglaNumber(linkedStudent.roll)} | শ্রেণি: ${linkedStudent.classLevel}`}
        >
          <button
            onClick={logoutUser}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut size={13} />
            <span>লগআউট</span>
          </button>
        </PageHeader>
      </div>

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
            {exams.length === 0 && (
              <EmptyState
                icon={Calendar}
                title={language === 'en' ? 'No exams yet' : 'এখনো কোনো পরীক্ষা নেই'}
                description={language === 'en' ? 'Results will appear here once an exam is scheduled.' : 'পরীক্ষা নির্ধারিত হলে এখানে ফলাফল দেখা যাবে।'}
              />
            )}
            {exams.length > 0 && (
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
            </div>)}

            {/* Performance Snapshot Card — light card + shared StatCards
                (Job 3 G1/G9). G2: grade / GPA / total show '—' until
                every core subject is marked; 'আংশিক' while pending. */}
            {resultData && (
 <div className="bg-white dark:bg-[#161c2e] rounded-3xl border border-slate-200/90 dark:border-white/10 overflow-hidden">
                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{selectedExam?.nameBn || selectedExam?.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">মোট প্রাপ্ত নম্বর: {marksComplete ? formatBanglaNumber(resultData.gpaSummary.totalMarks) : '—'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      label="লেটার গ্রেড"
                      value={marksComplete ? resultData.gpaSummary.grade : '—'}
                      badge={!hasAnyMark ? undefined : !marksComplete ? 'আংশিক' : undefined}
                    />
                    <StatCard
                      label="জিপিএ (GPA)"
                      value={marksComplete ? resultData.gpaSummary.gpa.toFixed(2) : '—'}
                      badge={!hasAnyMark ? undefined : !marksComplete ? 'আংশিক' : undefined}
                    />
                  </div>

                  {(!hasAnyMark || !marksComplete) && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      {!hasAnyMark
                        ? 'এই পরীক্ষার মার্ক এখনো দেওয়া হয়নি।'
                        : `${formatBanglaNumber(coreSubjects.length - markedCoreCount)} বিষয়ের মার্ক এখনো বাকি — GPA চূড়ান্ত নয়।`}
                    </p>
                  )}
                </div>

                {/* Subject-wise Marks Table — desktop/tablet only (Job 3 G5:
                    the table scrolls sideways on a phone, so mobile gets
                    one stacked card per subject below instead). */}
                <div className="p-4 sm:p-6">
                  <div className="hidden sm:block overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl">
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
                          // Job 3 G2: no mark record → '—', never 0 / F.
                          // A real record (obtained 0, or absent) keeps
                          // its real grade.
                          const hasMark = !!mark;
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
                              <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{mark?.isAbsent ? 'অনুপস্থিত' : hasMark ? formatBanglaNumber(obtained) : '—'}</td>
                              <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${gradeBadgeTone(hasMark ? grade : '')}`}>
                                  {hasMark ? grade : '—'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-200">{hasMark ? gpa.toFixed(2) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: one stacked card per subject (Job 3 G5).
                      Same '—' rule as the table (G2) — a missing mark
                      record never shows 0 / F. */}
                  <div className="sm:hidden space-y-2">
                    {resultData.subjects.map(sub => {
                      const mark = marks.find(m => m.studentId === linkedStudent.id && m.subjectId === sub.id && m.examId === selectedExam.id);
                      const hasMark = !!mark;
                      const { grade, gpa } = calculateGrade(mark?.obtained ?? 0, sub.fullMarks || 100);
                      return (
                        <div key={sub.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {sub.nameBn || sub.name} {sub.isOptional ? '(৪র্থ বিষয়)' : ''}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${gradeBadgeTone(hasMark ? grade : '')}`}>
                              {hasMark ? grade : '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">পূর্ণমান</span>
                              <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{formatBanglaNumber(sub.fullMarks || 100)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">প্রাপ্ত</span>
                              <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{mark?.isAbsent ? 'অনুপস্থিত' : hasMark ? formatBanglaNumber(mark.obtained) : '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">পয়েন্ট</span>
                              <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{hasMark ? gpa.toFixed(2) : '—'}</span>
                            </div>
                          </div>
                          {(mark?.obtainedCQ !== undefined || mark?.obtainedMCQ !== undefined) && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {mark?.obtainedCQ !== undefined ? `CQ ${formatBanglaNumber(mark.obtainedCQ)}` : ''}
                              {mark?.obtainedCQ !== undefined && mark?.obtainedMCQ !== undefined ? ' • ' : ''}
                              {mark?.obtainedMCQ !== undefined ? `MCQ/মৌখিক ${formatBanglaNumber(mark.obtainedMCQ)}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Attendance — recorded days only (Job 3 G9: shared StatCards). */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {attendanceSummary && attendanceSummary.workingDays > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="উপস্থিতির হার" value={attendanceSummary.attendancePercentage} suffix="%" />
                  <StatCard label="রেকর্ডকৃত দিন" value={attendanceSummary.workingDays} suffix=" দিন" />
                  <StatCard label="উপস্থিত" value={attendanceSummary.totalPresent} suffix=" দিন" />
                  <StatCard label="অনুপস্থিত" value={attendanceSummary.totalAbsent} suffix=" দিন" />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {language === 'en'
                    ? 'Calculated from recorded attendance days only.'
                    : 'হিসাবটি শুধু রেকর্ডকৃত হাজিরার দিনের ভিত্তিতে।'}
                </p>

                {/* U5 — monthly attendance calendar (V3 ledger reuse,
                    read-only): the same day-by-day view the staff
                    profile shows — Friday is the weekly holiday, a
                    working day with no record shows 'নথিভুক্ত নয়'.
                    Only this child's records, never another student's. */}
                <div className="bg-white dark:bg-[#161c2e] rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-[var(--color-brand)]" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {language === 'bn' ? 'মাসভিত্তিক হাজিরা ক্যালেন্ডার' : 'Monthly Attendance Calendar'}
                      </h3>
                      {guardianMonthlyAttendance.summary.isPartial && guardianMonthlyAttendance.summary.workingDays > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 shrink-0">
                          {language === 'bn' ? 'আংশিক' : 'Partial'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {language === 'bn' ? 'মাস নির্বাচন:' : 'Select Month:'}
                      </label>
                      <input
                        type="month"
                        value={guardianAttendanceMonth}
                        onChange={(e) => setGuardianAttendanceMonth(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ring)] bg-white dark:bg-[#161c2e]"
                      />
                    </div>
                  </div>

                  {guardianMonthlyAttendance.summary.isPartial && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {guardianMonthlyAttendance.summary.workingDays === 0
                        ? (language === 'bn' ? 'এই মাসে এখনো কোনো হাজিরা নথিভুক্ত হয়নি।' : 'No attendance recorded yet this month.')
                        : (language === 'bn'
                          ? `এই মাসে ${formatBanglaNumber(guardianMonthlyAttendance.summary.scheduledDays)} কর্মদিবসের মধ্যে ${formatBanglaNumber(guardianMonthlyAttendance.summary.workingDays)} দিন নথিভুক্ত হয়েছে — বাকি দিনগুলো 'নথিভুক্ত নয়' হিসেবে দেখাচ্ছে।`
                          : `${guardianMonthlyAttendance.summary.workingDays} of ${guardianMonthlyAttendance.summary.scheduledDays} working days recorded this month — the rest show as 'Not recorded'.`)}
                    </p>
                  )}

                  {guardianMonthlyAttendance.summary.workingDays === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{language === 'bn' ? 'এই মাসে এখনো কোনো হাজিরা নথিভুক্ত হয়নি।' : 'No attendance recorded yet this month.'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{language === 'bn' ? 'শ্রেণি শিক্ষক হাজিরা নিলে এখানে দেখা যাবে।' : 'It will appear here once the class teacher takes attendance.'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2">
                      {guardianMonthlyAttendance.days.map((dayItem) => {
                        const isHoliday = dayItem.status === 'HOLIDAY';
                        const isPresent = dayItem.status === 'PRESENT';
                        const isLate = dayItem.status === 'LATE';
                        const isAbsent = dayItem.status === 'ABSENT';
                        const isLeave = dayItem.status === 'LEAVE';
                        const isNotRecorded = dayItem.status === 'NOT_RECORDED';
                        return (
                          <div
                            key={dayItem.day}
                            className={`p-1.5 sm:p-2.5 min-h-[54px] rounded-xl border text-center transition-all ${
                              isHoliday
                                ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'
                                : isPresent
                                ? 'bg-emerald-50/80 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-300 font-medium'
                                : isLate
                                ? 'bg-amber-50/80 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-amber-300 font-medium'
                                : isLeave
                                ? 'bg-sky-50/80 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30 text-sky-950 dark:text-sky-300 font-medium'
                                : isNotRecorded
                                ? 'bg-slate-50 dark:bg-white/5 border-dashed border-slate-300 dark:border-white/20 text-slate-400 dark:text-slate-500'
                                : 'bg-rose-50/80 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-950 dark:text-rose-300 font-medium'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold font-mono">{formatBanglaNumber(dayItem.day)}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[44px] sm:max-w-none">
                                {language === 'bn' ? dayItem.dayNameBn : dayItem.dayNameEn}
                              </span>
                            </div>
                            <div className="flex items-center justify-center py-0.5 sm:py-1">
                              {isHoliday && <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{language === 'bn' ? 'ছুটি' : 'Holiday'}</span>}
                              {isPresent && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={12} className="shrink-0" />
                                  <span>{language === 'bn' ? 'হাজির' : 'Present'}</span>
                                </div>
                              )}
                              {isLate && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  <Clock size={12} className="shrink-0" />
                                  <span>{language === 'bn' ? 'বিলম্ব' : 'Late'}</span>
                                </div>
                              )}
                              {isAbsent && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                  <XCircle size={12} className="shrink-0" />
                                  <span>{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</span>
                                </div>
                              )}
                              {isLeave && (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                                  <span>{language === 'bn' ? 'ছুটিতে' : 'Leave'}</span>
                                </div>
                              )}
                              {isNotRecorded && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{language === 'bn' ? 'নথিভুক্ত নয়' : 'Not recorded'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-100 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
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
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                      <span>{language === 'bn' ? 'ছুটিতে' : 'Leave'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-200 border border-dashed border-slate-400"></span>
                      <span>{language === 'bn' ? 'নথিভুক্ত নয়' : 'Not recorded'}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Calendar}
                title={language === 'en' ? 'No attendance records yet' : 'এখনো কোনো হাজিরার রেকর্ড নেই'}
                description={language === 'en'
                  ? 'Recorded attendance days will appear here.'
                  : 'রেকর্ডকৃত হাজিরার দিন এলে এখানে দেখা যাবে।'}
              />
            )}
          </div>
        )}

        {/* Tab 3: Fees — ONE hero: the total due (Job 3 G3). The old
            "চলতি শিক্ষাবর্ষের আদায়" sublabel was wrong: the paid
            figure is the lifetime total, so it now says so honestly
            ("সর্বমোট পরিশোধিত"). The current month's fee shows only
            when it is > 0; otherwise the card says it is not due yet. */}
        {activeTab === 'fees' && (
          <div className="space-y-4">
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-5 rounded-3xl">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">মোট বকেয়া</span>
              <span className="text-4xl font-black text-rose-900 dark:text-rose-200 font-mono mt-1 block">
                ৳ {formatBanglaNumber(feeSummary.totalDue)}
              </span>
              <span className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 block">{feeSummary.dueMonthCount > 0 ? `${formatBanglaNumber(feeSummary.dueMonthCount)} মাসের বকেয়া` : 'কোনো বকেয়া নেই'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="সর্বমোট পরিশোধিত" value={feeSummary.paid} prefix="৳ " />
              <StatCard
                label="চলতি মাসের ফি"
                value={feeSummary.due > 0 ? feeSummary.due : '—'}
                prefix={feeSummary.due > 0 ? '৳ ' : ''}
                badge={feeSummary.due > 0 ? undefined : 'এখনো বকেয়া হয়নি'}
              />
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
