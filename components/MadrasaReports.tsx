import React, { useMemo } from 'react';
import {
  CalendarCheck2, Banknote, Receipt, CalendarOff, Wallet, Scale,
  Users, GraduationCap, Phone, MessageCircle, ClipboardList, TrendingUp, BarChart3
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { summarizeStudentRecords, summarizeStaffRecords } from '../services/dailyAttendanceService';
import { calculateClassDuesSummary } from '../services/studentDuesService';
import { calculateTotalGPA, formatNumber } from '../services/utils';

/**
 * MadrasaReports — the Dashboard Overview's report center.
 *
 * Owner directive (24 Oct 2026): at one glance the principal should see
 * (1) how the madrasa is doing TODAY and (2) how this MONTH is going.
 * Every figure here is computed live from real records — attendance is
 * recorded-only (a day with no attendance taken shows "not taken",
 * never an invented percentage), money comes from the transaction
 * ledger, dues from the canonical dues service, results from recorded
 * marks. No estimates, no placeholders.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY_LABELS_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SectionHead: React.FC<{ icon: React.ElementType; title: string; right?: string }> = ({ icon: Icon, title, right }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
      <Icon size={16} />
    </span>
    <h3 className="font-black text-slate-900 dark:text-white text-base flex-1">{title}</h3>
    {right && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{right}</span>}
  </div>
);

const StatCard: React.FC<{
  icon: React.ElementType; iconCls: string; label: string; value: string; sub?: string;
}> = ({ icon: Icon, iconCls, label, value, sub }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
    <div className="flex items-center gap-2 mb-2">
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
        <Icon size={16} />
      </span>
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
    </div>
    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{value}</div>
    {sub && <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">{sub}</div>}
  </div>
);

export const MadrasaReports: React.FC = () => {
  const {
    students = [], subjects = [], marks = [], exams = [],
    transactions = [], feeStructures = [], staffLeaves = [],
    dailyStudentAttendance = [], dailyStaffAttendance = [],
    language = 'bn'
  } = useApp();
  const isBn = language === 'bn';
  const num = (v: number) => formatNumber(Math.round(v), isBn ? 'bn' : 'en');
  const money = (v: number) => `৳ ${num(v)}`;

  const now = new Date();
  const todayIso = isoDay(now);
  const monthPrefix = todayIso.slice(0, 7);

  const activeStudents = useMemo(
    () => (students || []).filter(s => String(s.status || 'ACTIVE').toUpperCase() !== 'INACTIVE'),
    [students]
  );

  // ---------- TODAY ----------
  // 24 Oct 2026 visibility fix: attendance reads the REACTIVE context
  // arrays (not the service singleton). The old singleton reads sat in
  // useMemos keyed only on todayIso, so an already-open admin session
  // never recomputed them when cloud records arrived.
  const todayAtt = useMemo(
    () => summarizeStudentRecords(dailyStudentAttendance, todayIso),
    [dailyStudentAttendance, todayIso]
  );
  const todayTx = useMemo(() => {
    const todays = (transactions || []).filter(t => t.date === todayIso);
    return {
      income: todays.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0),
      incomeCount: todays.filter(t => t.type === 'INCOME').length,
      expense: todays.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0)
    };
  }, [transactions, todayIso]);
  const leavesToday = useMemo(
    () => (staffLeaves || []).filter(l => l.status === 'APPROVED' && l.startDate <= todayIso && l.endDate >= todayIso),
    [staffLeaves, todayIso]
  );
  const staffAttToday = useMemo(() => {
    const s = summarizeStaffRecords(dailyStaffAttendance, todayIso);
    if (s.total === 0) return null;
    return { recorded: s.total, pct: Math.round((s.present / s.total) * 100) };
  }, [dailyStaffAttendance, todayIso]);
  const last7 = useMemo(() => {
    const days: Array<{ label: string; amount: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = isoDay(d);
      const amount = (transactions || [])
        .filter(t => t.type === 'INCOME' && t.date === iso)
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      days.push({ label: (isBn ? DAY_LABELS_BN : DAY_LABELS_EN)[d.getDay()], amount, isToday: i === 0 });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, todayIso, isBn]);
  const last7Max = Math.max(1, ...last7.map(d => d.amount));

  // ---------- THIS MONTH ----------
  const duesSummary = useMemo(
    () => calculateClassDuesSummary(activeStudents, feeStructures, transactions),
    [activeStudents, feeStructures, transactions]
  );
  const monthTx = useMemo(() => {
    const m = (transactions || []).filter(t => String(t.date || '').startsWith(monthPrefix));
    return {
      income: m.filter(t => t.type === 'INCOME').reduce((s, t) => s + (Number(t.amount) || 0), 0),
      expense: m.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (Number(t.amount) || 0), 0),
      salary: m.filter(t => t.type === 'EXPENSE' && /salary|বেতন/i.test(String(t.category || ''))).reduce((s, t) => s + (Number(t.amount) || 0), 0)
    };
  }, [transactions, monthPrefix]);
  const monthAtt = useMemo(() => {
    const pcts: number[] = [];
    for (let day = 1; day <= now.getDate(); day++) {
      const s = summarizeStudentRecords(dailyStudentAttendance, isoDay(new Date(now.getFullYear(), now.getMonth(), day)));
      if (s.totalStudents > 0) pcts.push(s.attendancePercentage);
    }
    return {
      days: pcts.length,
      avg: pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyStudentAttendance, todayIso]);
  const newAdmissions = useMemo(
    () => activeStudents.filter(s =>
      String(s.admissionDate || '').startsWith(monthPrefix) ||
      String(s.createdAt || '').startsWith(monthPrefix)
    ).length,
    [activeStudents, monthPrefix]
  );
  const collectionPct = duesSummary.totalExpected > 0
    ? Math.min(100, Math.round((duesSummary.totalPaid / duesSummary.totalExpected) * 100))
    : 0;

  // ---------- LISTS ----------
  const classCounts = useMemo(() => {
    const map = new Map<string, number>();
    activeStudents.forEach(s => map.set(s.classLevel, (map.get(s.classLevel) || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [activeStudents]);
  const classMax = Math.max(1, ...classCounts.map(c => c.count));

  const topDues = useMemo(
    () => [...(duesSummary.profiles || [])]
      .filter(p => (p.dueThisMonth || 0) > 0)
      .sort((a, b) => b.dueThisMonth - a.dueThisMonth)
      .slice(0, 5),
    [duesSummary]
  );

  const latestExamSummary = useMemo(() => {
    try {
      const exam = exams.length > 0 ? exams[exams.length - 1] : null;
      if (!exam) return null;
      const rows = activeStudents
        .filter(st => marks.some(m => m.studentId === st.id && m.examId === exam.id))
        .map(st => calculateTotalGPA(
          subjects.filter(s => s.classLevel === st.classLevel),
          marks, st.id, exam.id, st.group, exams
        ));
      if (rows.length === 0) return { exam, appeared: 0, passRate: 0, avgGpa: 0 };
      const passed = rows.filter(r => !r.isFail).length;
      return {
        exam,
        appeared: rows.length,
        passRate: Math.round((passed / rows.length) * 100),
        avgGpa: rows.reduce((s, r) => s + (r.gpa || 0), 0) / rows.length
      };
    } catch {
      return null;
    }
  }, [exams, marks, subjects, activeStudents]);

  // ---------- CLASS COMPARISONS ----------
  const classLevels = useMemo(
    () => [...new Set(activeStudents.map(s => s.classLevel).filter(Boolean))],
    [activeStudents]
  );
  const classAttendanceMonth = useMemo(() => {
    return classLevels.map(cls => {
      let recorded = 0;
      let present = 0;
      for (let day = 1; day <= now.getDate(); day++) {
        const s = summarizeStudentRecords(dailyStudentAttendance, isoDay(new Date(now.getFullYear(), now.getMonth(), day)), cls);
        recorded += s.totalStudents;
        present += s.presentCount + s.lateCount;
      }
      return { name: cls, recorded, pct: recorded > 0 ? Math.round((present / recorded) * 100) : null };
    }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLevels, dailyStudentAttendance, todayIso]);
  const classResults = useMemo(() => {
    try {
      const exam = exams.length > 0 ? exams[exams.length - 1] : null;
      if (!exam) return [];
      return classLevels.map(cls => {
        const clsStudents = activeStudents.filter(s => s.classLevel === cls);
        const appeared = clsStudents.filter(st => marks.some(m => m.studentId === st.id && m.examId === exam.id));
        if (appeared.length === 0) return { name: cls, appeared: 0, passRate: null as number | null };
        const clsSubjects = subjects.filter(s => s.classLevel === cls);
        const passed = appeared.filter(st => !calculateTotalGPA(clsSubjects, marks, st.id, exam.id, st.group, exams).isFail).length;
        return { name: cls, appeared: appeared.length, passRate: Math.round((passed / appeared.length) * 100) };
      }).sort((a, b) => (b.passRate ?? -1) - (a.passRate ?? -1));
    } catch {
      return [];
    }
  }, [classLevels, activeStudents, exams, marks, subjects]);
  const classDues = useMemo(() => {
    return classLevels.map(cls => {
      const summary = calculateClassDuesSummary(activeStudents.filter(s => s.classLevel === cls), feeStructures, transactions);
      return { name: cls, totalDue: summary.totalDue, dueCount: summary.dueStudentsCount };
    }).sort((a, b) => b.totalDue - a.totalDue);
  }, [classLevels, activeStudents, feeStructures, transactions]);
  const classDueMax = Math.max(1, ...classDues.map(c => c.totalDue));

  const dateLabel = now.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const monthLabel = now.toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* ================= TODAY ================= */}
      <section>
        <SectionHead icon={CalendarCheck2} title={isBn ? 'আজকের প্রতিবেদন' : "Today's Report"} right={dateLabel} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={CalendarCheck2}
            iconCls="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300"
            label={isBn ? 'ছাত্র হাজিরা' : 'Student Attendance'}
            value={todayAtt.totalStudents > 0 ? `${num(todayAtt.attendancePercentage)}%` : (isBn ? 'নেওয়া হয়নি' : 'Not taken')}
            sub={todayAtt.totalStudents > 0
              ? (isBn
                ? `উপস্থিত ${num(todayAtt.presentCount + todayAtt.lateCount)} · অনুপস্থিত ${num(todayAtt.absentCount)} · মোট রেকর্ড ${num(todayAtt.totalStudents)}`
                : `Present ${num(todayAtt.presentCount + todayAtt.lateCount)} · Absent ${num(todayAtt.absentCount)} · Recorded ${num(todayAtt.totalStudents)}`)
              : (isBn ? 'আজ এখনো কোনো ক্লাসের হাজিরা রেকর্ড হয়নি' : 'No class attendance recorded yet today')}
          />
          <StatCard
            icon={Banknote}
            iconCls="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300"
            label={isBn ? 'আজকের আদায়' : "Today's Collection"}
            value={money(todayTx.income)}
            sub={isBn ? `${num(todayTx.incomeCount)}টি লেনদেন` : `${num(todayTx.incomeCount)} transactions`}
          />
          <StatCard
            icon={Receipt}
            iconCls="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300"
            label={isBn ? 'আজকের খরচ' : "Today's Expense"}
            value={money(todayTx.expense)}
            sub={isBn ? `আজকের নিট ${money(todayTx.income - todayTx.expense)}` : `Net today ${money(todayTx.income - todayTx.expense)}`}
          />
          <StatCard
            icon={CalendarOff}
            iconCls="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300"
            label={isBn ? 'আজ ছুটিতে শিক্ষক' : 'Teachers on Leave Today'}
            value={`${num(leavesToday.length)} ${isBn ? 'জন' : ''}`}
            sub={[
              leavesToday.length > 0 ? leavesToday.map(l => l.teacherName).slice(0, 2).join(', ') : (isBn ? 'আজ কেউ ছুটিতে নেই' : 'Nobody is on leave today'),
              staffAttToday ? (isBn ? `শিক্ষক হাজিরা ${num(staffAttToday.pct)}%` : `Staff attendance ${num(staffAttToday.pct)}%`) : ''
            ].filter(Boolean).join(' · ')}
          />
        </div>

        {/* Last 7 days collection */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs mt-3">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-indigo-600 dark:text-indigo-300" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{isBn ? 'গত ৭ দিনের আদায়' : 'Collection — Last 7 Days'}</h4>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 h-32">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {d.amount > 0 ? num(d.amount) : '—'}
                </span>
                <div className="w-full max-w-12 flex items-end h-20">
                  <div
                    className={`w-full rounded-t-xl ${d.isToday ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-900'}`}
                    style={{ height: `${Math.max(4, Math.round((d.amount / last7Max) * 100))}%` }}
                  />
                </div>
                <span className={`text-[11px] font-bold ${d.isToday ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THIS MONTH ================= */}
      <section>
        <SectionHead icon={ClipboardList} title={isBn ? 'এই মাসের প্রতিবেদন' : "This Month's Report"} right={monthLabel} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Fee collection progress */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                <Wallet size={16} />
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isBn ? 'ফি আদায়ের অগ্রগতি' : 'Fee Collection'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{num(collectionPct)}%</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {money(duesSummary.totalPaid)} / {money(duesSummary.totalExpected)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${collectionPct}%` }} />
            </div>
            <div className="flex justify-between mt-3 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'মোট বকেয়া' : 'Total Due'}</span>
              <span className="font-black text-rose-600 dark:text-rose-300">{money(duesSummary.totalDue)}</span>
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'বকেয়াদার শিক্ষার্থী' : 'Students with Dues'}</span>
              <span className="font-black text-slate-900 dark:text-white">{num(duesSummary.dueStudentsCount)} {isBn ? 'জন' : ''}</span>
            </div>
          </div>

          {/* Income vs expense */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                <Scale size={16} />
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isBn ? 'মাসের আয়–ব্যয়' : 'Monthly Income – Expense'}</span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{isBn ? 'আয়' : 'Income'}</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-300">{money(monthTx.income)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(3, Math.round((monthTx.income / Math.max(1, monthTx.income, monthTx.expense)) * 100))}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{isBn ? 'খরচ' : 'Expense'}</span>
                  <span className="font-black text-rose-600 dark:text-rose-300">{money(monthTx.expense)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.max(3, Math.round((monthTx.expense / Math.max(1, monthTx.income, monthTx.expense)) * 100))}%` }} />
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{isBn ? 'নিট' : 'Net'}</span>
                <span className={`font-black ${monthTx.income - monthTx.expense >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                  {money(monthTx.income - monthTx.expense)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{isBn ? 'এর মধ্যে বেতন খরচ' : 'Of which salary'}</span>
                <span className="font-bold text-slate-900 dark:text-white">{money(monthTx.salary)}</span>
              </div>
            </div>
          </div>

          {/* Attendance + admissions */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                  <CalendarCheck2 size={16} />
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isBn ? 'মাসের গড় উপস্থিতি' : 'Monthly Avg. Attendance'}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {monthAtt.days > 0 ? `${num(monthAtt.avg)}%` : '—'}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {monthAtt.days > 0
                  ? (isBn ? `${num(monthAtt.days)} দিনের রেকর্ড থেকে` : `From ${num(monthAtt.days)} recorded days`)
                  : (isBn ? 'এই মাসে এখনো হাজিরা রেকর্ড হয়নি' : 'No attendance recorded this month')}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <Users size={16} />
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isBn ? 'এই মাসে নতুন ভর্তি' : 'New Admissions This Month'}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{num(newAdmissions)} {isBn ? 'জন' : ''}</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? `মোট শিক্ষার্থী ${num(activeStudents.length)} জন` : `${num(activeStudents.length)} students in total`}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= LISTS ================= */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Students by class */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-indigo-600 dark:text-indigo-300" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{isBn ? 'ক্লাসভিত্তিক শিক্ষার্থী' : 'Students by Class'}</h4>
            </div>
            <div className="space-y-2.5">
              {classCounts.map(c => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((c.count / classMax) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right font-black text-slate-900 dark:text-white">{num(c.count)}</span>
                </div>
              ))}
              {classCounts.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'কোনো শিক্ষার্থী নেই' : 'No students yet'}</p>
              )}
            </div>
          </div>

          {/* Top dues */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={16} className="text-rose-500" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{isBn ? 'সর্বোচ্চ বকেয়া' : 'Highest Dues'}</h4>
            </div>
            <div className="space-y-2">
              {topDues.map(p => {
                const phone = String(p.student.guardianPhone || '').replace(/[^0-9]/g, '');
                const waPhone = phone.startsWith('0') ? `880${phone.slice(1)}` : phone;
                return (
                  <div key={p.student.id} className="flex items-center gap-2 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{isBn ? p.student.nameBn || p.student.name : p.student.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.student.classLevel} · {isBn ? 'রোল' : 'Roll'} {num(Number(p.student.roll) || 0)}</div>
                    </div>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-300 shrink-0">{money(p.dueThisMonth)}</span>
                    {phone && (
                      <span className="flex gap-1 shrink-0">
                        <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center" aria-label="WhatsApp">
                          <MessageCircle size={13} />
                        </a>
                        <a href={`tel:+${waPhone}`} className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center" aria-label="Call">
                          <Phone size={13} />
                        </a>
                      </span>
                    )}
                  </div>
                );
              })}
              {topDues.length === 0 && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 py-4 text-center">
                  {isBn ? 'কারো বকেয়া নেই' : 'No dues outstanding'}
                </p>
              )}
            </div>
          </div>

          {/* Latest exam */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap size={16} className="text-violet-600 dark:text-violet-300" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{isBn ? 'সাম্প্রতিক পরীক্ষার ফলাফল' : 'Latest Exam Result'}</h4>
            </div>
            {latestExamSummary ? (
              <div className="space-y-3">
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {isBn ? latestExamSummary.exam.nameBn || latestExamSummary.exam.name : latestExamSummary.exam.name}
                </div>
                {latestExamSummary.appeared > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-base font-black text-slate-900 dark:text-white">{num(latestExamSummary.appeared)}</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isBn ? 'নম্বর এন্ট্রি' : 'Appeared'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                        <div className="text-base font-black text-emerald-600 dark:text-emerald-300">{num(latestExamSummary.passRate)}%</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isBn ? 'পাসের হার' : 'Pass Rate'}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-violet-50 dark:bg-violet-950/40">
                        <div className="text-base font-black text-violet-600 dark:text-violet-300">{num(Math.round(latestExamSummary.avgGpa * 100) / 100)}</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{isBn ? 'গড় GPA' : 'Avg GPA'}</div>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${latestExamSummary.passRate}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'এই পরীক্ষার কোনো নম্বর এখনো এন্ট্রি হয়নি' : 'No marks entered for this exam yet'}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'কোনো পরীক্ষা তৈরি হয়নি' : 'No exams created yet'}</p>
            )}
          </div>
        </div>
      </section>

      {/* ================= CLASS COMPARISONS ================= */}
      <section>
        <SectionHead icon={BarChart3} title={isBn ? 'ক্লাসভিত্তিক তুলনা' : 'Class Comparisons'} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Attendance by class — this month */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{isBn ? 'হাজিরা — এই মাসে' : 'Attendance — This Month'}</h4>
            <div className="space-y-2.5">
              {classAttendanceMonth.map(c => (
                <div key={c.name} className="flex items-center gap-2 text-xs min-h-[22px]">
                  <span className="w-16 sm:w-20 shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate" title={c.name}>{c.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${c.pct === null ? '' : c.pct >= 85 ? 'bg-emerald-500' : c.pct >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${c.pct ?? 0}%` }} />
                  </div>
                  <span className="shrink-0 min-w-[64px] text-right font-black text-slate-900 dark:text-white whitespace-nowrap text-[11px] sm:text-xs">
                    {c.pct === null ? (isBn ? 'রেকর্ড নেই' : 'No record') : `${num(c.pct)}%`}
                  </span>
                </div>
              ))}
              {classAttendanceMonth.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'কোনো ক্লাস নেই' : 'No classes yet'}</p>
              )}
            </div>
          </div>

          {/* Results by class — latest exam */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{isBn ? 'ফলাফল — সাম্প্রতিক পরীক্ষা' : 'Results — Latest Exam'}</h4>
            <div className="space-y-2.5">
              {classResults.map(c => (
                <div key={c.name} className="flex items-center gap-2 text-xs min-h-[22px]">
                  <span className="w-16 sm:w-20 shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate" title={c.name}>{c.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${c.passRate === null ? '' : c.passRate >= 80 ? 'bg-emerald-500' : c.passRate >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${c.passRate ?? 0}%` }} />
                  </div>
                  <span className="shrink-0 min-w-[64px] text-right font-black text-slate-900 dark:text-white whitespace-nowrap text-[11px] sm:text-xs">
                    {c.passRate === null ? (isBn ? 'নম্বর নেই' : 'No marks') : `${num(c.passRate)}%`}
                  </span>
                </div>
              ))}
              {classResults.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'কোনো পরীক্ষা নেই' : 'No exams yet'}</p>
              )}
            </div>
          </div>

          {/* Dues by class */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">{isBn ? 'বকেয়া — ক্লাসভিত্তিক' : 'Dues — By Class'}</h4>
            <div className="space-y-2.5">
              {classDues.map(c => (
                <div key={c.name} className="flex items-center gap-2 text-xs min-h-[22px]">
                  <span className="w-16 sm:w-20 shrink-0 font-bold text-slate-700 dark:text-slate-200 truncate" title={c.name}>{c.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.round((c.totalDue / classDueMax) * 100)}%` }} />
                  </div>
                  <span className="shrink-0 min-w-[64px] text-right font-black text-slate-900 dark:text-white whitespace-nowrap text-[11px] sm:text-xs">{money(c.totalDue)}</span>
                </div>
              ))}
              {classDues.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'কোনো ক্লাস নেই' : 'No classes yet'}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Report center live-check marker (24 Oct 2026): figures are live records only.
