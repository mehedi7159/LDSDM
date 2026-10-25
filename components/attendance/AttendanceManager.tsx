import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { summarizeStudentRecords, summarizeStaffRecords } from '../../services/dailyAttendanceService';
import { Button } from '../ui/Button';
import { 
  Calendar, 
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
    language
  } = useApp();
  const isBn = language === 'bn';

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
  const tabs: { id: AttendanceSubTab; labelBn: string; labelEn: string; icon: any; badge?: string }[] = [
    { id: 'students', labelBn: '১. শিক্ষার্থীর দৈনিক উপস্থিতি', labelEn: '1. Daily Students', icon: UserCheck },
    { id: 'staff', labelBn: '২. শিক্ষক ও কর্মচারী উপস্থিতি', labelEn: '2. Staff Attendance', icon: Briefcase },
    { id: 'absentees', labelBn: '৩. অনুপস্থিত তালিকা ও SMS', labelEn: '3. Absentees & SMS', icon: Phone, badge: kpis.absentRecorded > 0 ? formatNumber(kpis.absentRecorded, language) : undefined },
    { id: 'register', labelBn: '৪. মাসিক রেজিস্টার শিট', labelEn: '4. Monthly Register', icon: FileSpreadsheet, badge: 'Print' },
    { id: 'sync', labelBn: '৫. পরীক্ষার মার্কশিটে সিঙ্ক', labelEn: '5. Sync to Marksheet', icon: Sparkles, badge: 'Auto' },
    { id: 'reports', labelBn: '৬. উপস্থিতি অ্যানালিটিক্স', labelEn: '6. Reports & Analytics', icon: BarChart3, badge: 'Report' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>📅</span>
              <span>{isBn ? 'ডিজিটাল হাজিরা ও অটোমেশন কেন্দ্র' : 'Digital Attendance & Automation Hub'}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <Upload size={14} className="text-teal-300" />
              <span>{isBn ? 'বাল্ক এক্সেল ইমপোর্ট' : 'Bulk Import'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{isBn ? 'মার্কশিটে অটো সিঙ্ক' : 'Auto Sync'}</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Strip — recorded data only; every digit goes
            through formatNumber(..., language) so bn mode shows Bangla
            digits (incl. percentages and the date) and en mode Latin. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের শিক্ষার্থী হাজিরা' : 'Attendance Rate'}</div>
            {kpis.studentRate !== null ? (
              <>
                <div className="text-xl font-black text-emerald-300 mt-0.5 font-bangla">{formatNumber(kpis.studentRate, language)}%</div>
                <div className="text-[10px] text-teal-300 font-medium">
                  {isBn
                    ? `${formatNumber(kpis.presentRecorded, language)} জন উপস্থিত • রেকর্ড ${formatNumber(kpis.recordedStudents, language)}/${formatNumber(kpis.totalEnrolled, language)}`
                    : `${formatNumber(kpis.presentRecorded, language)} present • recorded ${formatNumber(kpis.recordedStudents, language)}/${formatNumber(kpis.totalEnrolled, language)}`}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-black text-amber-300 mt-1">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}</div>
                <div className="text-[10px] text-teal-300 font-medium">
                  {isBn
                    ? `${formatNumber(kpis.pendingStudents, language)} জন শিক্ষার্থীর হাজিরা বাকি`
                    : `${formatNumber(kpis.pendingStudents, language)} students pending`}
                </div>
              </>
            )}
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'আজকের অনুপস্থিত' : 'Absentees Today'}</div>
            <div className="text-xl font-black text-rose-300 mt-0.5 font-bangla">
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

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'শিক্ষক ও কর্মী উপস্থিতি' : 'Faculty Attendance'}</div>
            {kpis.staffRate !== null ? (
              <>
                <div className="text-xl font-black text-white mt-0.5 font-bangla">{formatNumber(kpis.staffRate, language)}%</div>
                <div className="text-[10px] text-teal-300 font-medium">
                  {isBn
                    ? `${formatNumber(kpis.staffPresentRecorded, language)} জন উপস্থিত • রেকর্ড ${formatNumber(kpis.staffRecorded, language)}/${formatNumber(kpis.totalTeachers, language)}`
                    : `${formatNumber(kpis.staffPresentRecorded, language)} present • recorded ${formatNumber(kpis.staffRecorded, language)}/${formatNumber(kpis.totalTeachers, language)}`}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-black text-amber-300 mt-1">{isBn ? 'হাজিরা নেওয়া হয়নি' : 'Not taken yet'}</div>
                <div className="text-[10px] text-teal-300 font-medium">
                  {isBn
                    ? `মোট ${formatNumber(kpis.totalTeachers, language)} জন শিক্ষক`
                    : `${formatNumber(kpis.totalTeachers, language)} teachers in total`}
                </div>
              </>
            )}
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মোট সক্রিয় ছাত্র' : 'Active Students'}</div>
            <div className="text-xl font-black text-white mt-0.5 font-bangla">{formatNumber(kpis.totalEnrolled, language)}{isBn ? ' জন' : ''}</div>
            <div className="text-[10px] text-teal-300 font-medium">{formatNumber(classes.length, language)}{isBn ? ' টি শ্রেণি' : ' classes'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'পরীক্ষার টার্ম সিঙ্ক' : 'Exam Sync'}</div>
            <div className="text-xl font-black text-teal-200 mt-0.5">{isBn ? 'সক্রিয়' : 'Active'}</div>
            <div className="text-[10px] text-slate-400 font-medium">{formatNumber(exams.length, language)}{isBn ? ' টি পরীক্ষা' : ' exams'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'তারিখ' : 'Date'}</div>
            <div className="text-xs font-black text-white mt-1 font-bangla">{formatNumber(formatSafeDate(selectedDate, isBn), language)}</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-2xs overflow-x-auto gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={15} />
              <span>{isBn ? t.labelBn : t.labelEn}</span>
              {t.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
                }`}>
                  {t.badge}
                </span>
              )}
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
          <DailyAttendanceHub initialMode="staff" hideTopSwitcher={true} onNavigateTab={onNavigateTab} />
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
