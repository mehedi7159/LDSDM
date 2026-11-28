import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { summarizeStudentRecords, summarizeStaffRecords } from '../../services/dailyAttendanceService';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { 
  Calendar,
  CalendarDays,
  UserCheck, 
  Users, 
  UserX, 
  Briefcase, 
  FileSpreadsheet, 
  Sparkles, 
  BarChart3, 
  Phone, 
  Printer, 
  Download, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Send
} from 'lucide-react';

import { DailyAttendanceHub } from './DailyAttendanceHub';
import { MonthlyAttendanceRegisterSheet } from './MonthlyAttendanceRegisterSheet';
import { AttendanceReportView } from '../AttendanceReportView';
import { BulkAttendanceImportModal } from '../BulkAttendanceImportModal';
import { AccessRestrictedView } from '../AccessRestrictedView';

export type AttendanceSubTab = 
  | 'students'
  | 'staff'
  | 'absentees'
  | 'register'
  | 'sync'
  | 'reports';

interface AttendanceManagerProps {
  initialSubTab?: AttendanceSubTab;
  onNavigateTab?: (tab: string) => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  initialSubTab = 'students',
  onNavigateTab
}) => {
  const {
    students = [],
    classes = [],
    teachers = [],
    exams = [],
    dailyStudentAttendance = [],
    dailyStaffAttendance = [],
    hasPermission,
    language
  } = useApp();
  const isBn = language === 'bn';

  // Master audit F1: staff attendance is admin-only (principal's
  // 25-Oct-2026 rule). The Staff tab is hidden without the separate
  // 'staff.attendance.manage' key — a teacher's student-attendance
  // grant can never open it.
  const canManageStaffAttendance = hasPermission('staff.attendance.manage');

  const [activeTab, setActiveTab] = useState<AttendanceSubTab>(initialSubTab);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // KPI Stats for the selected date — RECORDED DATA ONLY.
  // Standing rule (owner directive): a figure may only be derived from
  // attendance actually recorded for that date. A previous version
  // invented a "realistic baseline" when nothing was logged yet
  // (present = 92% of enrolment, rate = 95, faculty = 100%), which is
  // exactly the fabrication the owner flagged. Now: rates are computed
  // over recorded entries only and are null until at least one record
  // exists; the header then shows the "not taken yet" state plus how
  // many students/staff are still pending.
  // 24 Oct 2026 visibility fix: KPIs read the REACTIVE context arrays
  // (same recorded-only semantics). The old service-singleton reads sat
  // in this memo keyed only on students/teachers/selectedDate, so an
  // already-open admin session never recomputed them when cloud records
  // arrived via hydration.
  const kpis = useMemo(() => {
    const totalEnrolled = students.filter(s => s.status === 'Active' && !s.isFormer).length;
    const summary = summarizeStudentRecords(dailyStudentAttendance, selectedDate);
    const recordedStudents = summary.totalStudents;
    const presentRecorded = summary.presentCount + summary.lateCount;
    const absentRecorded = summary.absentCount;
    const studentRate = recordedStudents > 0
      ? Math.round((presentRecorded / recordedStudents) * 100)
      : null;

    // Staff attendance for date (recorded entries only)
    const staffSummary = summarizeStaffRecords(dailyStaffAttendance, selectedDate);
    const staffRecorded = staffSummary.total;
    const staffPresentRecorded = staffSummary.present;
    const staffRate = staffRecorded > 0
      ? Math.round((staffPresentRecorded / staffRecorded) * 100)
      : null;

    return {
      totalEnrolled,
      recordedStudents,
      presentRecorded,
      absentRecorded,
      studentRate,
      pendingStudents: Math.max(0, totalEnrolled - recordedStudents),
      staffRecorded,
      staffPresentRecorded,
      staffRate,
      totalTeachers: teachers.length
    };
  }, [students, teachers, selectedDate, dailyStudentAttendance, dailyStaffAttendance]);

  // Sub-navigation tabs
  const tabs: { id: AttendanceSubTab; labelBn: string; labelEn: string; icon: any }[] = [
    { id: 'students', labelBn: 'শিক্ষার্থী', labelEn: 'Students', icon: UserCheck },
    { id: 'staff', labelBn: 'স্টাফ', labelEn: 'Staff', icon: Briefcase },
    { id: 'absentees', labelBn: 'অনুপস্থিত', labelEn: 'Absentees', icon: Phone },
    { id: 'register', labelBn: 'রেজিস্টার', labelEn: 'Register', icon: FileSpreadsheet },
    { id: 'sync', labelBn: 'সিঙ্ক', labelEn: 'Sync', icon: Sparkles },
    { id: 'reports', labelBn: 'রিপোর্ট', labelEn: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI Metrics Strip — recorded data only; every digit goes
          through formatNumber(..., language) so bn mode shows Bangla
          digits (incl. percentages and the date) and en mode Latin. */}
      <PageHeader
        tone="brand"
        icon={CalendarDays}
        title={isBn ? 'ডিজিটাল হাজিরা ও অটোমেশন কেন্দ্র' : 'Digital Attendance & Automation Hub'}
        footer={(
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'আজকের শিক্ষার্থী হাজিরা' : 'Attendance Rate'}</div>
              {kpis.studentRate !== null ? (
                <>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-bangla">{formatNumber(kpis.studentRate, language)}%</div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                    {isBn
                      ? `${formatNumber(kpis.presentRecorded, language)} জন উপস্থিত • রেকর্ড ${formatNumber(kpis.recordedStudents, language)}/${formatNumber(kpis.totalEnrolled, language)}`
                      : `${formatNumber(kpis.presentRecorded, language)} present • recorded ${formatNumber(kpis.recordedStudents, language)}/${formatNumber(kpis.totalEnrolled, language)}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}</div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                    {isBn
                      ? `${formatNumber(kpis.pendingStudents, language)} জন শিক্ষার্থীর হাজিরা বাকি`
                      : `${formatNumber(kpis.pendingStudents, language)} students pending`}
                  </div>
                </>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'আজকের অনুপস্থিত' : 'Absentees Today'}</div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 font-bangla">
                {kpis.recordedStudents > 0
                  ? (isBn ? `${formatNumber(kpis.absentRecorded, language)} জন` : formatNumber(kpis.absentRecorded, language))
                  : '—'}
              </div>
              {kpis.recordedStudents > 0 && kpis.pendingStudents > 0 && (
                <div className="text-[10px] text-slate-400 font-medium">
                  {isBn ? `আরও ${formatNumber(kpis.pendingStudents, language)} জনের হাজিরা বাকি` : `${formatNumber(kpis.pendingStudents, language)} more pending`}
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'শিক্ষক ও কর্মী উপস্থিতি' : 'Faculty Attendance'}</div>
              {kpis.staffRate !== null ? (
                <>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-bangla">{formatNumber(kpis.staffRate, language)}%</div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                    {isBn
                      ? `${formatNumber(kpis.staffPresentRecorded, language)} জন উপস্থিত • রেকর্ড ${formatNumber(kpis.staffRecorded, language)}/${formatNumber(kpis.totalTeachers, language)}`
                      : `${formatNumber(kpis.staffPresentRecorded, language)} present • recorded ${formatNumber(kpis.staffRecorded, language)}/${formatNumber(kpis.totalTeachers, language)}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}</div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                    {isBn
                      ? `মোট ${formatNumber(kpis.totalTeachers, language)} জন শিক্ষক`
                      : `${formatNumber(kpis.totalTeachers, language)} teachers in total`}
                  </div>
                </>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'মোট সক্রিয় ছাত্র' : 'Active Students'}</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5 font-bangla">{formatNumber(kpis.totalEnrolled, language)}{isBn ? ' জন' : ''}</div>
              <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">{formatNumber(classes.length, language)}{isBn ? ' টি শ্রেণি' : ' classes'}</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'পরীক্ষার টার্ম সিঙ্ক' : 'Exam Sync'}</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{isBn ? 'সক্রিয়' : 'Active'}</div>
              <div className="text-[10px] text-slate-400 font-medium">{formatNumber(exams.length, language)}{isBn ? ' টি পরীক্ষা' : ' exams'}</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{isBn ? 'তারিখ' : 'Date'}</div>
              <div className="text-xs font-black text-slate-900 dark:text-white mt-1 font-bangla">{formatNumber(formatSafeDate(selectedDate, isBn), language)}</div>
            </div>
          </div>
        )}
      >
        <button
          type="button"
          onClick={() => setIsBulkModalOpen(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Upload size={14} className="text-teal-600 dark:text-teal-400" />
          <span>{isBn ? 'বাল্ক এক্সেল ইমপোর্ট' : 'Bulk Import'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={14} />
          <span>{isBn ? 'মার্কশিটে অটো সিঙ্ক' : 'Auto Sync'}</span>
        </button>
      </PageHeader>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-2xl p-1.5 gap-1">
        {tabs.filter(t => t.id !== 'staff' || canManageStaffAttendance).map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={15} />
              <span>{isBn ? t.labelBn : t.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Active Sub-Module Content */}
      <div>
        {activeTab === 'students' && (
          <DailyAttendanceHub initialMode="students" hideTopSwitcher={true} onNavigateTab={onNavigateTab} />
        )}

        {activeTab === 'staff' && (
          canManageStaffAttendance
            ? <DailyAttendanceHub initialMode="staff" hideTopSwitcher={true} onNavigateTab={onNavigateTab} />
            : <AccessRestrictedView moduleName={isBn ? 'শিক্ষক-কর্মচারীর উপস্থিতি' : 'Staff Attendance'} onGoToResults={() => setActiveTab('students')} />
        )}

        {activeTab === 'absentees' && (
          <DailyAttendanceHub initialMode="absentees" hideTopSwitcher={true} onNavigateTab={onNavigateTab} />
        )}

        {activeTab === 'register' && (
          <MonthlyAttendanceRegisterSheet />
        )}

        {activeTab === 'sync' && (
          <DailyAttendanceHub initialMode="sync_exam" hideTopSwitcher={true} onNavigateTab={onNavigateTab} />
        )}

        {activeTab === 'reports' && (
          <AttendanceReportView />
        )}
      </div>

      {/* Bulk Attendance Import Modal */}
      {isBulkModalOpen && (
        <BulkAttendanceImportModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          selectedClass={classes[0]?.name || '১ম শ্রেণি'}
          selectedExamId={exams[0]?.id || ''}
        />
      )}
    </div>
  );
};
