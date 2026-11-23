// হাজিরা রিপোর্ট — today's attendance by class (22 Nov 2026).
// Present/absent ONLY: a LATE record counts as উপস্থিত (the same rule
// as calculateStudentAttendanceForExamFromRecords — LATE is a present
// day, never a separate column here), LEAVE counts as অনুপস্থিত. A
// class with no record today does NOT show 0 — it says
// "হাজিরা নেওয়া হয়নি" (AGENTS.md: unrecorded data shows as "—" /
// "হাজিরা নেওয়া হয়নি", never an invented 0).
import React, { useMemo } from 'react';
import { UserCheck } from 'lucide-react';
import { SectionCard } from './ui/SectionCard';
import type { DailyStudentAttendanceRecord } from '../services/dailyAttendanceService';
import { classNamesMatch } from '../services/classNames';
import type { SchoolClass, Student } from '../types';
import type { Language } from '../services/translations';

const toBn = (num: number | string, language: Language) => {
  const str = String(num);
  if (language !== 'bn') return str;
  return str.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
};

interface Props {
  records: DailyStudentAttendanceRecord[];
  students: Student[];
  classes: SchoolClass[];
  language: Language;
}

export const DashboardAttendanceReport: React.FC<Props> = ({ records, students, classes, language }) => {
  const isBn = language === 'bn';
  const todayStr = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const today = (records || []).filter(r => r && r.date === todayStr);
    return (classes || [])
      .filter(c => c && c.status !== 'INACTIVE')
      .filter(c => (students || []).some(s => s && s.status === 'Active' && !s.isFormer && classNamesMatch(s.classLevel, c.name)))
      .map(c => {
        const day = today.filter(r => classNamesMatch(r.classLevel, c.name));
        return {
          className: isBn ? (c.nameBn || c.name) : c.name,
          taken: day.length > 0,
          present: day.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length,
          absent: day.filter(r => r.status === 'ABSENT' || r.status === 'LEAVE').length
        };
      });
  }, [records, students, classes, todayStr, isBn]);

  const recorded = rows.filter(r => r.taken);
  const totalPresent = recorded.reduce((s, r) => s + r.present, 0);
  const totalAbsent = recorded.reduce((s, r) => s + r.absent, 0);
  const total = totalPresent + totalAbsent;

  return (
    <SectionCard
      title={isBn ? 'হাজিরা রিপোর্ট' : 'Attendance Report'}
      subtitle={isBn ? `আজকের হাজিরা (${toBn(todayStr, language)})` : `Today's attendance (${todayStr})`}
      icon={UserCheck}
      iconTone="teal"
      bodyClassName="space-y-2"
      action={
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          {total > 0
            ? `${isBn ? 'উপস্থিত' : 'Present'} ${toBn(totalPresent, language)} / ${toBn(total, language)}`
            : '—'}
        </span>
      }
    >
      {rows.length === 0 && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-2">
          {isBn ? 'কোনো শ্রেণির হাজিরা নেওয়া হয়নি।' : 'No attendance taken for any class yet.'}
        </p>
      )}
      {rows.map(r => (
        <div key={r.className} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <span className="font-bold text-slate-900 dark:text-white truncate">{r.className}</span>
          {r.taken ? (
            <span className="flex items-center gap-3 shrink-0">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">{isBn ? 'উপস্থিত' : 'Present'} {toBn(r.present, language)}</span>
              <span className="font-bold text-rose-600 dark:text-rose-300">{isBn ? 'অনুপস্থিত' : 'Absent'} {toBn(r.absent, language)}</span>
            </span>
          ) : (
            <span className="font-semibold text-slate-400 shrink-0">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken'}</span>
          )}
        </div>
      ))}
    </SectionCard>
  );
};
