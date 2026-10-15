import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Award, 
  Layers, 
  PenTool, 
  FileSpreadsheet, 
  Printer, 
  Globe, 
  QrCode, 
  MessageSquare, 
  BarChart3, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Users, 
  BookOpen, 
  Filter, 
  Search, 
  Eye, 
  ShieldCheck, 
  TrendingUp, 
  Calendar,
  AlertCircle,
  HelpCircle,
  Phone,
  Send,
  Copy,
  ExternalLink,
  ChevronRight,
  FileText
} from 'lucide-react';
import { formatNumber, calculateTotalGPA, calculateGrade } from '../../services/utils';
import { ExamManager } from '../ExamManager';
import { MarksEntry } from '../MarksEntry';
import { BlankMarksheetView } from '../BlankMarksheetView';
import { ResultGenerator } from '../ResultView';
import { ClassResultView } from '../ClassResultView';
import { WebResultView } from '../WebResultView';
import { ResultSmsNotificationModal } from '../ResultSmsNotificationModal';
import { Button } from '../ui/Button';

export type ExamSubTab = 
  | 'setup' 
  | 'marks' 
  | 'blank_sheet' 
  | 'cards' 
  | 'tabulation' 
  | 'web_results' 
  | 'sms' 
  | 'analytics';

interface ExamResultsManagerProps {
  initialSubTab?: ExamSubTab;
  onNavigateTab?: (tab: string) => void;
}

export const ExamResultsManager: React.FC<ExamResultsManagerProps> = ({
  initialSubTab = 'setup',
  onNavigateTab
}) => {
  const { 
    exams = [], 
    classes = [], 
    subjects = [], 
    students = [], 
    marks = [], 
    schoolProfile, 
    language, 
    t, 
    hasPermission, 
    isOwnerAdmin, 
    isAdmin, 
    isSuperAdmin 
  } = useApp();

  const isBn = language === 'bn';
  const [activeTab, setActiveTab] = useState<ExamSubTab>(initialSubTab);

  // Tabulation Sheet exam and class selector
  const [tabulationExamId, setTabulationExamId] = useState<string>(() => exams[0]?.id || '');
  const [tabulationClass, setTabulationClass] = useState<string>(() => classes[0]?.name || '');

  // SMS Modal State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsExamId, setSmsExamId] = useState<string>(() => exams[0]?.id || '');
  const [smsClass, setSmsClass] = useState<string>(() => classes[0]?.name || '');
  const [smsCopiedNotice, setSmsCopiedNotice] = useState<string | null>(null);

  // Analytics filter state
  const [analyticsExamId, setAnalyticsExamId] = useState<string>(() => exams[0]?.id || '');
  const [analyticsClass, setAnalyticsClass] = useState<string>('ALL');

  // Real-time KPI Calculations for Step 6
  const kpis = useMemo(() => {
    const totalExamsCount = exams.length;
    const activeExam = exams.find(e => e.status === 'SCHEDULED' || e.status === 'MARKS_ENTRY') || exams[0];
    const totalMarksEntries = marks.length;

    // Calculate pass rate and GPA 5 count in active exam
    if (!activeExam) {
      return {
        totalExamsCount,
        activeExamName: isBn ? 'কোনো সক্রিয় পরীক্ষা নেই' : 'No active exam',
        totalMarksEntries,
        passRate: '0.0',
        gpa5Count: 0,
        evaluatedStudentsCount: 0
      };
    }

    const activeExamMarks = marks.filter(m => m.examId === activeExam.id);
    const activeStudentIds = Array.from(new Set(activeExamMarks.map(m => m.studentId)));
    
    let passCount = 0;
    let gpa5 = 0;

    activeStudentIds.forEach(stId => {
      const student = students.find(s => s.id === stId);
      if (!student) return;
      const classSubjects = subjects.filter(s => s.classLevel === student.classLevel);
      const res = calculateTotalGPA(classSubjects, marks, student.id, activeExam.id, student.group, exams);
      if (!res.isFail) {
        passCount++;
        if (res.gpa >= 5.0) gpa5++;
      }
    });

    const evaluatedStudentsCount = activeStudentIds.length;
    const passRate = evaluatedStudentsCount > 0 
      ? ((passCount / evaluatedStudentsCount) * 100).toFixed(1) 
      : '100.0';

    return {
      totalExamsCount,
      activeExamName: isBn ? (activeExam.nameBn || activeExam.name) : activeExam.name,
      totalMarksEntries,
      passRate,
      gpa5Count: gpa5,
      evaluatedStudentsCount
    };
  }, [exams, marks, students, subjects, isBn]);

  // Tab definitions
  const tabs = [
    { 
      id: 'setup' as ExamSubTab, 
      labelBn: '১. পরীক্ষা ও টার্ম সেটআপ', 
      labelEn: '1. Exams Setup', 
      icon: Layers, 
      badge: 'Admin' 
    },
    { 
      id: 'marks' as ExamSubTab, 
      labelBn: '২. নম্বর এন্ট্রি ও মূল্যায়ন', 
      labelEn: '2. Marks Entry', 
      icon: PenTool,
      badge: kpis.totalMarksEntries > 0 ? `${formatNumber(kpis.totalMarksEntries, 'bn')}` : undefined 
    },
    { 
      id: 'blank_sheet' as ExamSubTab, 
      labelBn: '৩. ব্লাঙ্ক মার্কশিট প্রিন্ট', 
      labelEn: '3. Blank Marksheets', 
      icon: Printer, 
      badge: 'Print' 
    },
    { 
      id: 'cards' as ExamSubTab, 
      labelBn: '৪. একক ফলাফল ও মার্কশিট', 
      labelEn: '4. Individual Cards', 
      icon: Award 
    },
    { 
      id: 'tabulation' as ExamSubTab, 
      labelBn: '৫. মেধাতালিকা ও ট্যাবুলেশন', 
      labelEn: '5. Tabulation Sheet', 
      icon: FileSpreadsheet, 
      badge: 'Merit' 
    },
    { 
      id: 'web_results' as ExamSubTab, 
      labelBn: '৬. অনলাইন রেজাল্ট পোর্টাল', 
      labelEn: '6. Web Results & QR', 
      icon: Globe, 
      badge: 'QR' 
    },
    { 
      id: 'sms' as ExamSubTab, 
      labelBn: '৭. ফলাফল SMS অ্যালার্ট', 
      labelEn: '7. Result SMS', 
      icon: MessageSquare, 
      badge: 'SMS' 
    },
    { 
      id: 'analytics' as ExamSubTab, 
      labelBn: '৮. ফলাফল অ্যানালিটিক্স', 
      labelEn: '8. Exam Analytics', 
      icon: BarChart3, 
      badge: 'Report' 
    },
  ];

  // Helper for SMS bulk copy
  const handleCopyPhoneNumbers = (phoneList: string[]) => {
    const valid = phoneList.filter(Boolean);
    if (valid.length === 0) return;
    navigator.clipboard.writeText(valid.join(', '));
    setSmsCopiedNotice(isBn ? `${valid.length} টি ফোন নম্বর কপি করা হয়েছে` : `${valid.length} numbers copied`);
    setTimeout(() => setSmsCopiedNotice(null), 3000);
  };

  // Selected exam objects
  const selectedTabulationExam = exams.find(e => e.id === tabulationExamId) || exams[0];
  const selectedSmsExam = exams.find(e => e.id === smsExamId) || exams[0];

  // Students for SMS list in selected class
  const smsClassStudents = useMemo(() => {
    if (!smsClass) return [];
    return students
      .filter(s => s.classLevel === smsClass && s.status === 'Active' && !s.isFormer)
      .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [students, smsClass]);

  // Analytics students calculation
  const analyticsData = useMemo(() => {
    const examObj = exams.find(e => e.id === analyticsExamId) || exams[0];
    if (!examObj) return { classBreakdown: [], topAchievers: [], gpaDistribution: {} };

    const classBreakdown = classes.map(cls => {
      const clsStudents = students.filter(s => s.classLevel === cls.name && s.status === 'Active' && !s.isFormer);
      const clsSubjects = subjects.filter(s => s.classLevel === cls.name);
      
      let pass = 0;
      let fail = 0;
      let gpa5 = 0;
      let totalMarksAccum = 0;

      clsStudents.forEach(st => {
        const res = calculateTotalGPA(clsSubjects, marks, st.id, examObj.id, st.group, exams);
        if (res.isFail) {
          fail++;
        } else {
          pass++;
          if (res.gpa >= 5.0) gpa5++;
        }
        totalMarksAccum += res.totalMarks;
      });

      const total = clsStudents.length;
      const rate = total > 0 ? ((pass / total) * 100).toFixed(1) : '0.0';
      const avgMarks = total > 0 ? (totalMarksAccum / total).toFixed(1) : '0';

      return {
        className: cls.name,
        total,
        pass,
        fail,
        gpa5,
        passRate: parseFloat(rate),
        avgMarks
      };
    });

    // Top Achievers across all classes or selected class
    const eligibleStudents = students.filter(s => {
      const matchClass = analyticsClass === 'ALL' || s.classLevel === analyticsClass;
      return matchClass && s.status === 'Active' && !s.isFormer;
    });

    const studentRanks = eligibleStudents.map(st => {
      const stSubjects = subjects.filter(s => s.classLevel === st.classLevel);
      const res = calculateTotalGPA(stSubjects, marks, st.id, examObj.id, st.group, exams);
      return {
        student: st,
        res
      };
    }).filter(item => !item.res.isFail)
      .sort((a, b) => {
        if (b.res.gpa !== a.res.gpa) return b.res.gpa - a.res.gpa;
        return b.res.totalMarks - a.res.totalMarks;
      })
      .slice(0, 10);

    return {
      classBreakdown,
      topAchievers: studentRanks
    };
  }, [exams, analyticsExamId, analyticsClass, classes, students, subjects, marks]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header: Step 6 • Exams & Results Suite */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden print:hidden">
        {/* Ambient Glow */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-violet-500/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 font-black text-xs uppercase tracking-wider mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{isBn ? 'ধাপ ৬ • পরীক্ষা ও ফলাফল ব্যবস্থাপনা হাব' : 'Step 6 • Exams & Results Suite'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>🏆</span>
              <span>{isBn ? 'পরীক্ষা, নম্বর মূল্যায়ন ও ডিজিটাল ফলাফল কেন্দ্র' : 'Examination & Results Hub'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              {isBn 
                ? 'টার্ম ও পরীক্ষা শিডিউল, শিক্ষক নম্বর এন্ট্রি, ব্লাঙ্ক মার্কশিট প্রিন্ট, স্বয়ংক্রিয় গ্রেডিং ও জিপিএ, প্রাতিষ্ঠানিক মেধাতালিকা ও কিউআর ভেরিফাইড সনদ।'
                : 'Comprehensive exam terms setup, continuous marks evaluation, blank marksheets, automated GPA calculation, merit tabulation, and QR-authenticated report cards.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('marks')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
            >
              <PenTool size={14} className="text-indigo-300" />
              <span>{isBn ? 'নম্বর এন্ট্রি' : 'Marks Entry'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tabulation')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              <span>{isBn ? 'ট্যাবুলেশন শিট' : 'Tabulation Sheet'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('web_results')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode size={14} />
              <span>{isBn ? 'অনলাইন রেজাল্ট' : 'Web Results'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মোট পরীক্ষা ও টার্ম' : 'Total Exams'}</div>
            <div className="text-xl font-black text-white mt-0.5">{formatNumber(kpis.totalExamsCount, 'bn')} টি</div>
            <div className="text-[10px] text-indigo-300 font-medium truncate">{kpis.activeExamName}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'মূল্যায়নকৃত নম্বর' : 'Recorded Marks'}</div>
            <div className="text-xl font-black text-indigo-300 mt-0.5">{formatNumber(kpis.totalMarksEntries, 'bn')} টি</div>
            <div className="text-[10px] text-slate-400 font-medium">{formatNumber(kpis.evaluatedStudentsCount, 'bn')} জন শিক্ষার্থী</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'প্রাতিষ্ঠানিক পাশের হার' : 'Avg Pass Rate'}</div>
            <div className="text-xl font-black text-emerald-300 mt-0.5">{kpis.passRate}%</div>
            <div className="text-[10px] text-emerald-400/90 font-medium">{isBn ? 'চলমান পরীক্ষায়' : 'Current Exam'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'জিপিএ ৫.০০ (মুমতাজ)' : 'GPA 5.0 (A+)'}</div>
            <div className="text-xl font-black text-amber-300 mt-0.5">{formatNumber(kpis.gpa5Count, 'bn')} জন</div>
            <div className="text-[10px] text-amber-200/90 font-medium">{isBn ? 'গোল্ডেন / সর্বোচ্চ গ্রেড' : 'Highest Grade'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'কিউআর ভেরিফিকেশন' : 'QR Verification'}</div>
            <div className="text-xl font-black text-cyan-300 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck size={18} className="text-cyan-400" />
              <span>{isBn ? 'সক্রিয়' : 'Active'}</span>
            </div>
            <div className="text-[10px] text-cyan-300/80 font-medium">{isBn ? 'জালিয়াতি মুক্ত কিউআর' : 'Anti-Tamper Hash'}</div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3 border border-white/10 backdrop-blur-2xs">
            <div className="text-[11px] text-slate-300 font-semibold">{isBn ? 'ফলাফল SMS সিস্টেম' : 'SMS Alert'}</div>
            <div className="text-xl font-black text-rose-300 mt-0.5 flex items-center gap-1.5">
              <MessageSquare size={18} className="text-rose-400" />
              <span>{isBn ? 'রেডি' : 'Ready'}</span>
            </div>
            <div className="text-[10px] text-rose-200/80 font-medium">{isBn ? 'বাংলা এসএমএস টেমপ্লেট' : 'Bangla SMS Support'}</div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto print:hidden">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area based on Active Sub-Tab */}
      <div className="transition-all duration-200">
        {/* 1. Exam & Terms Setup */}
        {activeTab === 'setup' && (
          <div className="space-y-4">
            <ExamManager />
          </div>
        )}

        {/* 2. Marks Entry & Evaluation */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            <MarksEntry onNavigate={(tab) => onNavigateTab ? onNavigateTab(tab) : undefined} />
          </div>
        )}

        {/* 3. Blank Marksheets for Teachers */}
        {activeTab === 'blank_sheet' && (
          <div className="space-y-4">
            <BlankMarksheetView />
          </div>
        )}

        {/* 4. Individual Marksheets / Grade Cards */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            <ResultGenerator />
          </div>
        )}

        {/* 5. Class Merit Tabulation Sheet */}
        {activeTab === 'tabulation' && (
          <div className="space-y-4">
            {/* Tabulation Top Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'পরীক্ষা নির্বাচন:' : 'Select Exam:'}</label>
                  <select 
                    className="border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={(e) => setTabulationExamId(e.target.value)}
                    value={tabulationExamId}
                  >
                    <option value="">{t('selectExam')}</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{isBn ? (e.nameBn || e.name) : e.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'শ্রেণি নির্বাচন:' : 'Select Class:'}</label>
                  <select 
                    className="border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold min-w-[150px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={tabulationClass}
                    onChange={(e) => setTabulationClass(e.target.value)}
                  >
                    {classes.map(c => <option key={c.id} value={c.name}>{isBn ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={15} />
                  <span>{isBn ? 'ট্যাবুলেশন শিট প্রিন্ট' : 'Print Tabulation'}</span>
                </button>
              </div>
            </div>

            {/* Tabulation Sheet Content */}
            {selectedTabulationExam ? (
              <div id="tabulation-sheet" className="print-container">
                <ClassResultView exam={selectedTabulationExam} classLevel={tabulationClass} />
              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
                <FileSpreadsheet size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="font-semibold text-sm">{isBn ? 'দয়া করে একটি পরীক্ষা ও শ্রেণি নির্বাচন করুন' : 'Please select an exam and class'}</p>
              </div>
            )}
          </div>
        )}

        {/* 6. Online Result Search & Public QR Verification */}
        {activeTab === 'web_results' && (
          <div className="space-y-4">
            <WebResultView />
          </div>
        )}

        {/* 7. Result SMS Broadcast Hub */}
        {activeTab === 'sms' && (
          <div className="space-y-5">
            {/* SMS Hub Control Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare size={18} className="text-rose-500" />
                    <span>{isBn ? 'অভিভাবকদের ফলাফল SMS প্রেরণ কনসোল' : 'Parent Result SMS Dispatch Console'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {isBn 
                      ? 'শিক্ষার্থীর প্রাপ্ত মোট নম্বর, জিপিএ, প্রাপ্ত গ্রেড ও মেধা অবস্থান সহ অভিভাবকদের সরাসরি মোবাইল মেসেজ পাঠান।'
                      : 'Dispatch individualized student marks, GPA, overall letter grade, and merit rank directly to guardian phone numbers.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyPhoneNumbers(smsClassStudents.map(s => s.guardianPhone || ''))}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} />
                    <span>{isBn ? 'সকল নম্বর কপি' : 'Copy All Numbers'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSmsModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Send size={14} />
                    <span>{isBn ? 'এসএমএস মডাল খুলুন' : 'Open SMS Sender'}</span>
                  </button>
                </div>
              </div>

              {smsCopiedNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>{smsCopiedNotice}</span>
                </div>
              )}

              {/* Class & Exam selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'পরীক্ষা নির্বাচন:' : 'Exam:'}</label>
                  <select 
                    className="w-full border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                    onChange={(e) => setSmsExamId(e.target.value)}
                    value={smsExamId}
                  >
                    {exams.map(e => <option key={e.id} value={e.id}>{isBn ? (e.nameBn || e.name) : e.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'শ্রেণি নির্বাচন:' : 'Class:'}</label>
                  <select 
                    className="w-full border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={smsClass}
                    onChange={(e) => setSmsClass(e.target.value)}
                  >
                    {classes.map(c => <option key={c.id} value={c.name}>{isBn ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                  </select>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold">{isBn ? 'শ্রেণিতে মোট শিক্ষার্থী' : 'Total Students'}</span>
                    <div className="text-base font-bold text-slate-800">{formatNumber(smsClassStudents.length, 'bn')} জন</div>
                  </div>
                  <Users size={20} className="text-slate-400" />
                </div>
              </div>
            </div>

            {/* SMS Student Directory & Preview Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isBn ? `${smsClass} শ্রেণির শিক্ষার্থীদের ফলাফল ও এসএমএস স্ট্যাটাস` : `Student Result & SMS List for ${smsClass}`}
                </h4>
                <span className="text-xs text-slate-500">
                  {isBn ? 'এক ক্লিকে এসএমএস ড্রাফট ও ফোন নম্বর ডায়াল' : 'One click to dial or compose SMS'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">{isBn ? 'রোল' : 'Roll'}</th>
                      <th className="py-3 px-4">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                      <th className="py-3 px-4">{isBn ? 'অভিভাবকের মোবাইল' : 'Guardian Mobile'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'মোট নম্বর' : 'Total Marks'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'জিপিএ' : 'GPA'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'গ্রেড' : 'Grade'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {smsClassStudents.map(student => {
                      const classSubjects = subjects.filter(s => s.classLevel === student.classLevel);
                      const res = calculateTotalGPA(classSubjects, marks, student.id, smsExamId, student.group, exams);
                      const phone = student.guardianPhone || '';
                      
                      // Bangla SMS text preview for student
                      const smsBody = `${schoolProfile.nameBn || schoolProfile.name}: ${student.nameBn || student.name}-এর ${selectedSmsExam?.nameBn || selectedSmsExam?.name || 'পরীক্ষা'} ফলাফল: মোট নম্বর: ${res.totalMarks}, GPA: ${res.gpa.toFixed(2)}, গ্রেড: ${res.grade}${res.isFail ? ' (অনুত্তীর্ণ)' : ' (উত্তীর্ণ)'}। বিস্তারিত দেখতে ভিজিট করুন।`;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-700">{formatNumber(student.roll, 'bn')}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{isBn ? (student.nameBn || student.name) : student.name}</div>
                            <div className="text-[10px] text-slate-400">ID: {student.studentId || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-4">
                            {phone ? (
                              <span className="font-mono text-slate-700 font-semibold">{phone}</span>
                            ) : (
                              <span className="text-amber-500 text-[11px] font-semibold">{isBn ? 'নম্বর নেই' : 'No Phone'}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {formatNumber(res.totalMarks, 'bn')}
                          </td>
                          <td className="py-3 px-4 text-center font-black">
                            <span className={res.isFail ? 'text-rose-600' : 'text-emerald-600'}>
                              {res.gpa.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              res.isFail 
                                ? 'bg-rose-100 text-rose-700' 
                                : res.grade === 'A+' 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {res.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {phone && (
                                <>
                                  <a
                                    href={`tel:${phone}`}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                    title={isBn ? 'কল করুন' : 'Call'}
                                  >
                                    <Phone size={13} />
                                  </a>
                                  <a
                                    href={`sms:${phone}?body=${encodeURIComponent(smsBody)}`}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                    title={isBn ? 'সরাসরি এসএমএস পাঠান' : 'Direct SMS'}
                                  >
                                    <Send size={13} />
                                  </a>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(smsBody);
                                  setSmsCopiedNotice(isBn ? `${student.name}-এর এসএমএস টেক্সট কপি করা হয়েছে` : `SMS text copied for ${student.name}`);
                                  setTimeout(() => setSmsCopiedNotice(null), 3000);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                title={isBn ? 'এসএমএস টেক্সট কপি করুন' : 'Copy Text'}
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dedicated Modal for SMS Dispatches */}
            {selectedSmsExam && (
              <ResultSmsNotificationModal 
                isOpen={isSmsModalOpen} 
                onClose={() => setIsSmsModalOpen(false)} 
                exam={selectedSmsExam} 
                classLevel={smsClass} 
              />
            )}
          </div>
        )}

        {/* 8. Exam Performance Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* Analytics Filter Strip */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'বিশ্লেষণ পরীক্ষা:' : 'Analysis Exam:'}</label>
                  <select 
                    className="border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={(e) => setAnalyticsExamId(e.target.value)}
                    value={analyticsExamId}
                  >
                    {exams.map(e => <option key={e.id} value={e.id}>{isBn ? (e.nameBn || e.name) : e.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{isBn ? 'শ্রেণি ফিল্টার:' : 'Class Filter:'}</label>
                  <select 
                    className="border border-slate-200 rounded-xl p-2 bg-white text-slate-800 text-xs font-semibold min-w-[150px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={analyticsClass}
                    onChange={(e) => setAnalyticsClass(e.target.value)}
                  >
                    <option value="ALL">{isBn ? 'সকল শ্রেণি (All Classes)' : 'All Classes'}</option>
                    {classes.map(c => <option key={c.id} value={c.name}>{isBn ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium">
                  {isBn ? 'স্বয়ংক্রিয়ভাবে সংরক্ষিত নম্বর থেকে সংকলিত' : 'Compiled live from verified mark records'}
                </span>
              </div>
            </div>

            {/* Class Pass Rate Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyticsData.classBreakdown.map((clsItem) => (
                <div key={clsItem.className} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-slate-900">{clsItem.className}</h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      clsItem.passRate >= 80 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : clsItem.passRate >= 60 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {clsItem.passRate}% {isBn ? 'পাশের হার' : 'Pass'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${clsItem.passRate}%` }} 
                    />
                    <div 
                      className="bg-rose-400 h-full transition-all duration-500" 
                      style={{ width: `${100 - clsItem.passRate}%` }} 
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold">{isBn ? 'মোট শিক্ষার্থী' : 'Total'}</div>
                      <div className="text-sm font-black text-slate-700">{formatNumber(clsItem.total, 'bn')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold">{isBn ? 'উত্তীর্ণ' : 'Passed'}</div>
                      <div className="text-sm font-black text-emerald-600">{formatNumber(clsItem.pass, 'bn')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold">{isBn ? 'মুমতাজ (A+)' : 'GPA 5'}</div>
                      <div className="text-sm font-black text-amber-600">{formatNumber(clsItem.gpa5, 'bn')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top 10 Achievers Leaderboard */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    🏆
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {isBn ? 'শীর্ষ ১০ মেধাবী শিক্ষার্থী (Top 10 Achievers Leaderboard)' : 'Top 10 Achievers Leaderboard'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isBn ? 'জিপিএ ও মোট নম্বরের ভিত্তিতে সর্বোচ্চ মেধানুক্রম' : 'Ranked by highest GPA and cumulative marks'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">{isBn ? 'মেধাক্রম' : 'Rank'}</th>
                      <th className="py-3 px-4">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                      <th className="py-3 px-4">{isBn ? 'শ্রেণি' : 'Class'}</th>
                      <th className="py-3 px-4">{isBn ? 'রোল' : 'Roll'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'প্রাপ্ত মোট নম্বর' : 'Total Marks'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'জিপিএ' : 'GPA'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'গ্রেড' : 'Grade'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analyticsData.topAchievers.map((item, index) => (
                      <tr key={item.student.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4 font-black">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                            index === 0 
                              ? 'bg-amber-500 text-white font-black shadow-xs' 
                              : index === 1 
                                ? 'bg-slate-300 text-slate-800 font-black' 
                                : index === 2 
                                  ? 'bg-amber-700 text-white font-black' 
                                  : 'bg-slate-100 text-slate-600'
                          }`}>
                            {formatNumber(index + 1, 'bn')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{isBn ? (item.student.nameBn || item.student.name) : item.student.name}</div>
                          <div className="text-[10px] text-slate-400">ID: {item.student.studentId || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">{item.student.classLevel}</td>
                        <td className="py-3 px-4 font-bold text-slate-600">{formatNumber(item.student.roll, 'bn')}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {formatNumber(item.res.totalMarks, 'bn')}
                        </td>
                        <td className="py-3 px-4 text-center font-black text-emerald-600">
                          {item.res.gpa.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {item.res.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {analyticsData.topAchievers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                          {isBn ? 'এই পরীক্ষার জন্য এখনও ফলাফল বা নম্বর পাওয়া যায়নি।' : 'No verified marks found for this exam.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
