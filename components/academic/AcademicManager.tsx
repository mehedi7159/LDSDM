import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatNumber } from '../../services/utils';
import { academicScheduleService } from '../../services/academicScheduleService';
import { Button } from '../ui/Button';
import { 
  BookOpen, 
  Layers, 
  UserCheck, 
  Clock, 
  FileText, 
  Calendar, 
  BarChart3, 
  Sparkles, 
  Printer, 
  GraduationCap,
  Users,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';

import { SubjectManager } from '../SubjectManager';
import { ClassSectionSetupView } from './ClassSectionSetupView';
import { ClassRoutineBuilder } from './ClassRoutineBuilder';
import { SyllabusPlannerView } from './SyllabusPlannerView';
import { AcademicCalendarView } from './AcademicCalendarView';
import { SubjectPerformanceAnalytics } from '../SubjectPerformanceAnalytics';

export type AcademicSubTab = 
  | 'curriculum'
  | 'classes'
  | 'teachers'
  | 'routine'
  | 'syllabus'
  | 'calendar'
  | 'analytics';

interface AcademicManagerProps {
  initialSubTab?: AcademicSubTab;
  onNavigateTab?: (tab: string) => void;
}

export const AcademicManager: React.FC<AcademicManagerProps> = ({ 
  initialSubTab = 'curriculum',
  onNavigateTab 
}) => {
  const { 
    subjects = [], 
    classes = [], 
    teachers = [], 
    students = [], 
    exams = [], 
    marks = [],
    language 
  } = useApp();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<AcademicSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Dynamic KPI Stats
  const kpis = useMemo(() => {
    const totalSubjects = subjects.filter(s => s.status !== 'INACTIVE').length;
    const coreSubjects = subjects.filter(s => !s.isOptional && s.status !== 'INACTIVE').length;
    const electiveSubjects = subjects.filter(s => s.isOptional && s.status !== 'INACTIVE').length;
    const totalClasses = classes.length;
    const totalTeachers = teachers.length;

    // Routine periods
    const routines = academicScheduleService.getRoutines();
    const weeklyPeriods = routines.length;

    // Syllabus completion
    const syllabi = academicScheduleService.getSyllabusItems();
    const totalSyllabusPeriods = syllabi.reduce((acc, s) => acc + (s.totalPeriods || 0), 0);
    const completedSyllabusPeriods = syllabi.reduce((acc, s) => acc + (s.completedPeriods || 0), 0);
    const syllabusRate = totalSyllabusPeriods > 0 
      ? Math.round((completedSyllabusPeriods / totalSyllabusPeriods) * 100) 
      : 0;

    // Holidays
    const calEvents = academicScheduleService.getCalendarEvents();
    const holidays = calEvents.filter(e => e.isHoliday);
    const holidayDays = holidays.reduce((acc, h) => acc + (h.totalDays || 1), 0);

    return {
      totalSubjects,
      coreSubjects,
      electiveSubjects,
      totalClasses,
      totalTeachers,
      weeklyPeriods,
      syllabusRate,
      holidayDays
    };
  }, [subjects, classes, teachers]);

  // Sub-navigation tab definitions
  const tabs: { id: AcademicSubTab; labelBn: string; labelEn: string; icon: any; badge?: string }[] = [
    { id: 'curriculum', labelBn: '১. বিষয় ও কারিকুলাম', labelEn: '1. Subjects & Curriculum', icon: BookOpen },
    { id: 'classes', labelBn: '২. শ্রেণি, শাখা ও শ্রেণি শিক্ষক', labelEn: '2. Classes & Sections', icon: Layers },
    { id: 'teachers', labelBn: '৩. শিক্ষক ও বিষয় বণ্টন', labelEn: '3. Teacher Assignment', icon: UserCheck },
    { id: 'routine', labelBn: '৪. ক্লাস রুটিন ও সময়সূচি', labelEn: '4. Class Routine', icon: Clock, badge: 'Live' },
    { id: 'syllabus', labelBn: '৫. সিলেবাস ও পাঠ পরিকল্পনা', labelEn: '5. Syllabus & Lesson Plan', icon: FileText },
    { id: 'calendar', labelBn: '৬. একাডেমিক ক্যালেন্ডার ও ছুটি', labelEn: '6. Academic Calendar', icon: Calendar },
    { id: 'analytics', labelBn: '৭. একাডেমিক অ্যানালিটিক্স', labelEn: '7. Academic Analytics', icon: BarChart3, badge: 'Report' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Academic Hub Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
        {/* Islamic & Academic Ambient Accents */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-teal-300 font-black text-xs uppercase tracking-wider mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{isBn ? 'ধাপ ৩ • একাডেমিক ব্যবস্থাপনা হাব' : 'Step 3 • Academic Management Hub'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>📚</span>
              <span>{isBn ? 'একাডেমিক ব্যবস্থাপনা ও কারিকুলাম সিস্টেম' : 'Academic & Curriculum Management'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              {isBn 
                ? 'কারিকুলাম ও বিষয় বণ্টন, শ্রেণি ও শাখা সমন্বয়, শিক্ষক দায়িত্ব, সাপ্তাহিক ক্লাস রুটিন, সিলেবাস পরিকল্পনা ও বাৎসরিক ক্যালেন্ডার।'
                : 'Comprehensive curriculum design, class and section setup, teacher workloads, weekly routines, syllabus tracking and holiday calendar.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('routine')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <Clock size={14} className="text-teal-300" />
              <span>{isBn ? 'রুটিন ভিউ' : 'Timetable'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar size={14} />
              <span>{isBn ? 'ছুটির দিনপঞ্জি' : 'Calendar'}</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মোট সক্রিয় বিষয়' : 'Subjects'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.totalSubjects, 'bn')} টি</div>
            <div className="text-[10px] text-teal-300 font-medium">{formatNumber(kpis.coreSubjects, 'bn')} আবশ্যক • {formatNumber(kpis.electiveSubjects, 'bn')} ঐচ্ছিক</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'শ্রেণি ও জামাত' : 'Classes'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.totalClasses, 'bn')} টি</div>
            <div className="text-[10px] text-teal-300 font-medium">{formatNumber(students.length, 'bn')} শিক্ষার্থী</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'পাঠদানকারী শিক্ষক' : 'Faculty'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.totalTeachers, 'bn')} জন</div>
            <div className="text-[10px] text-teal-300 font-medium">{isBn ? 'সকল বিষয় বণ্টনকৃত' : 'Active faculty'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'সাপ্তাহিক পিরিয়ড' : 'Weekly Periods'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.weeklyPeriods, 'bn')} টি</div>
            <div className="text-[10px] text-teal-300 font-medium">{isBn ? 'শনি - বৃহস্পতি' : 'Sat - Thu'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'সিলেবাস অগ্রগতি' : 'Syllabus'}</div>
            <div className="text-xl font-black text-emerald-300 mt-0.5">{formatNumber(kpis.syllabusRate, 'bn')}%</div>
            <div className="text-[10px] text-slate-400 font-medium">{isBn ? 'পাঠ পরিকল্পনা সম্পন্ন' : 'Completed'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'বাৎসরিক মোট ছুটি' : 'Holidays'}</div>
            <div className="text-xl font-black text-rose-300 mt-0.5">{formatNumber(kpis.holidayDays, 'bn')} দিন</div>
            <div className="text-[10px] text-slate-400 font-medium">{isBn ? 'ইসলামিক ও জাতীয়' : 'Annual off days'}</div>
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

      {/* Sub-Tab Content Rendering */}
      <div>
        {activeTab === 'curriculum' && (
          <SubjectManager initialTab="directory" />
        )}

        {activeTab === 'classes' && (
          <ClassSectionSetupView />
        )}

        {activeTab === 'teachers' && (
          <SubjectManager initialTab="teacher_assignment" />
        )}

        {activeTab === 'routine' && (
          <ClassRoutineBuilder />
        )}

        {activeTab === 'syllabus' && (
          <SyllabusPlannerView />
        )}

        {activeTab === 'calendar' && (
          <AcademicCalendarView />
        )}

        {activeTab === 'analytics' && (
          <SubjectPerformanceAnalytics
            subjects={subjects}
            students={students}
            marks={marks}
            exams={exams}
            classes={classes}
            language={language}
          />
        )}
      </div>
    </div>
  );
};
