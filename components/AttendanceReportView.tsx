import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  BarChart3,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { dailyAttendanceService } from '../services/dailyAttendanceService';

export const AttendanceReportView: React.FC = () => {
  const { students = [], classes = [], schoolProfile, language, t } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || 'Play');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const classStudents = useMemo(() => {
    return (students || [])
      .filter(s => s && (s.classLevel === selectedClass || (s as any).class === selectedClass) && !s.isFormer && s.status !== 'Former')
      .sort((a, b) => (Number(a.roll || a.rollNumber || '0') || 0) - (Number(b.roll || b.rollNumber || '0') || 0));
  }, [students, selectedClass]);

  // Monthly attendance statistics — REAL recorded data only.
  // A previous version FABRICATED these numbers from a hash of the
  // student ID (fixed 24 working days, absent = hash % 5, ...), so the
  // report, its KPIs, its charts and its CSV export showed invented
  // attendance for every student. The figures now come from
  // dailyAttendanceService.getStudentMonthlySummary for the selected
  // month: "total days" is the number of days that student actually has
  // a record for, and a student with no records gets a null percentage
  // (rendered as '—'), never an invented rate.
  const monthlyStats = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    return classStudents.map(s => {
      const sum = dailyAttendanceService.getStudentMonthlySummary(s.id, year, month);
      const hasRecords = sum.workingDays > 0;
      return {
        student: s,
        totalWorkingDays: sum.workingDays, // recorded days for this student
        presentDays: sum.presentDays,
        absentDays: sum.absentDays + sum.leaveDays,
        lateDays: sum.lateDays,
        hasRecords,
        attendancePercentage: hasRecords ? sum.percentage : null,
        isAtRisk: hasRecords && sum.percentage < 80
      };
    });
  }, [classStudents, selectedMonth]);

  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return monthlyStats;
    const q = searchQuery.toLowerCase();
    return monthlyStats.filter(item => 
      (item.student.name && item.student.name.toLowerCase().includes(q)) ||
      (item.student.nameBn && item.student.nameBn.includes(q)) ||
      (item.student.studentId && item.student.studentId.toLowerCase().includes(q)) ||
      (item.student.roll && String(item.student.roll).includes(q)) ||
      (item.student.rollNumber && String(item.student.rollNumber).includes(q))
    );
  }, [monthlyStats, searchQuery]);

  // Class overall attendance rate — averaged over students who HAVE
  // records only; null when nobody in the class has any record that
  // month (the KPI card then shows the no-records state, not 0% or an
  // invented average).
  const classAvgRate = useMemo(() => {
    const recorded = monthlyStats.filter(m => m.hasRecords && m.attendancePercentage !== null);
    if (recorded.length === 0) return null;
    const total = recorded.reduce((sum, item) => sum + (item.attendancePercentage || 0), 0);
    return (total / recorded.length).toFixed(1);
  }, [monthlyStats]);

  const atRiskCount = monthlyStats.filter(m => m.isAtRisk).length;
  const goodCount = monthlyStats.filter(m => m.hasRecords && !m.isAtRisk).length;

  const attendanceDistribution = [
    { name: language === 'bn' ? 'সন্তোষজনক (≥৮০%)' : 'Regular (≥80%)', value: goodCount, color: '#10b981' },
    { name: language === 'bn' ? 'অনুপস্থিতির ঝুঁকি (<৮০%)' : 'At Risk (<80%)', value: atRiskCount, color: '#ef4444' }
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Student ID', 'Roll', 'Name', 'Class', 'Total Working Days', 'Present Days', 'Absent Days', 'Late Days', 'Attendance %'];
    const rows = filteredStats.map(item => [
      item.student.studentId,
      item.student.roll,
      `"${item.student.name}"`,
      `"${selectedClass}"`,
      item.totalWorkingDays,
      item.presentDays,
      item.absentDays,
      item.lateDays,
      item.attendancePercentage !== null ? `${item.attendancePercentage}%` : 'Not recorded'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_report_${selectedClass}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'হাজিরা রিপোর্ট ও মাসিক বিবরণী' : 'Monthly Attendance Reports'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white/10 dark:bg-slate-900/10 hover:bg-white/20 dark:hover:bg-slate-900/20 text-white text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-xs"
          >
            <Download size={15} />
            <span>{language === 'bn' ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/20"
          >
            <Printer size={15} />
            <span>{language === 'bn' ? 'মাসিক শিট প্রিন্ট' : 'Print Sheet'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{language === 'bn' ? 'গড় উপস্থিতি হার' : 'Avg Attendance Rate'}</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{classAvgRate !== null ? `${toBanglaDigits(classAvgRate)}%` : '—'}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{classAvgRate !== null ? `${selectedClass} শ্রেণির গড়` : (language === 'bn' ? 'এই মাসে কোনো হাজিরা রেকর্ড নেই' : 'No attendance recorded this month')}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{language === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{toBanglaDigits(classStudents.length)}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{language === 'bn' ? 'নিয়মিত শিক্ষার্থী' : 'Regular Students'}</p>
            <h3 className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">{toBanglaDigits(goodCount)}</h3>
            <p className="text-[10px] text-teal-600/80 dark:text-teal-400 mt-0.5">≥ ৮০% উপস্থিতি</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{language === 'bn' ? 'অনুপস্থিতির ঝুঁকিতে' : 'Irregular / At Risk'}</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{toBanglaDigits(atRiskCount)}</h3>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5">&lt; ৮০% উপস্থিতি</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Selection Row */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{language === 'bn' ? 'শ্রেণি:' : 'Class:'}</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{language === 'bn' ? (c.nameBn || c.name) : c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{language === 'bn' ? 'মাস:' : 'Month:'}</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'শিক্ষার্থী খুঁজুন...' : 'Search student...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/50/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {language === 'bn' ? 'মোট কর্মদিবস:' : 'Working Days:'} <span className="text-slate-900 dark:text-white font-mono font-black">{toBanglaDigits(24)}</span> {language === 'bn' ? 'দিন' : 'days'}
        </div>
      </div>

      {/* Attendance Sheet Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Printable Header */}
        <div className="p-6 border-b border-slate-100 hidden print:block text-center">
          <h2 className="text-xl font-black text-slate-900">{schoolProfile.nameBn || schoolProfile.name}</h2>
          <p className="text-xs text-slate-600">{schoolProfile.address}</p>
          <h3 className="text-sm font-bold text-slate-800 mt-2 underline">
            মাসিক শিক্ষার্থী হাজিরা বিবরণী - {selectedClass} ({selectedMonth})
          </h3>
          <p className="text-[10px] text-slate-500">
            {language === 'bn' ? 'রিপোর্ট তৈরির তারিখ:' : 'Date:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">{language === 'bn' ? 'আইডি' : 'Student ID'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'কর্মদিবস' : 'Total Days'}</th>
                <th className="py-3 px-4 text-center text-emerald-700 dark:text-emerald-400">{language === 'bn' ? 'উপস্থিত' : 'Present'}</th>
                <th className="py-3 px-4 text-center text-rose-700 dark:text-rose-400">{language === 'bn' ? 'অনুপস্থিত' : 'Absent'}</th>
                <th className="py-3 px-4 text-center text-amber-700 dark:text-amber-400">{language === 'bn' ? 'বিলম্বে' : 'Late'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'উপস্থিতি %' : 'Percentage'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'রেগুলারিটি' : 'Regularity'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    {language === 'bn' ? 'এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                  </td>
                </tr>
              ) : (
                filteredStats.map((item, idx) => (
                  <tr key={item.student.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400 dark:text-slate-500">{toBanglaDigits(idx + 1)}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-200">{item.student.studentId}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-100">{toBanglaDigits(item.student.roll)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{item.student.name}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-300">{toBanglaDigits(item.totalWorkingDays)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/50/30">{toBanglaDigits(item.presentDays)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/50/30">{toBanglaDigits(item.absentDays)}</td>
                    <td className="py-3 px-4 text-center font-mono text-amber-600 dark:text-amber-400">{toBanglaDigits(item.lateDays)}</td>
                    <td className="py-3 px-4 text-center font-mono font-extrabold text-slate-900 dark:text-white">
                      {item.attendancePercentage !== null ? `${toBanglaDigits(item.attendancePercentage)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!item.hasRecords ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {language === 'bn' ? 'রেকর্ড নেই' : 'No record'}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          !item.isAtRisk ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {!item.isAtRisk ? (language === 'bn' ? 'নিয়মিত' : 'Good') : (language === 'bn' ? 'অনিয়মিত' : 'At Risk')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
