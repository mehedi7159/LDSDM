import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatNumber } from '../../services/utils';
import { dailyAttendanceService, AttendanceStatus } from '../../services/dailyAttendanceService';
import { Button } from '../ui/Button';
import { 
  Calendar, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const MonthlyAttendanceRegisterSheet: React.FC = () => {
  const { classes = [], students = [], schoolProfile, language } = useApp();
  const isBn = language === 'bn';
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '১ম শ্রেণি');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-12
  const [searchQuery, setSearchQuery] = useState<string>('');
  // ভিউ — টেবিল (আগের মতো, প্রিন্টের অফিশিয়াল রূপ) + কার্ড (মোবাইল শিটের ধাঁচে)।
  const [registerView, setRegisterView] = useState<'table' | 'cards'>('table');

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Days array: [{ day: 1, dateStr: '2026-10-01', dayNameBn: 'বৃহস্পতি', isFriday: false }]
  const daysArray = useMemo(() => {
    const dayNamesBn = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri
      const isFriday = dayOfWeek === 5;
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({
        day: d,
        dateStr,
        dayOfWeek,
        dayNameBn: dayNamesBn[dayOfWeek],
        isFriday
      });
    }
    return arr;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Enrolled students in class
  const classStudents = useMemo(() => {
    return students
      .filter(s => (s.classLevel === selectedClass || s.classId === selectedClass) && !s.isFormer && s.status !== 'Former')
      .sort((a, b) => (Number(a.roll || a.rollNumber || '0') || 0) - (Number(b.roll || b.rollNumber || '0') || 0));
  }, [students, selectedClass]);

  // Filtered by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.nameBn && s.nameBn.includes(q)) ||
      (s.studentId && s.studentId.toLowerCase().includes(q)) ||
      (s.roll && String(s.roll).includes(q))
    );
  }, [classStudents, searchQuery]);

  // Pre-load all attendance logs for the month from dailyAttendanceService
  const monthlyDataMap = useMemo(() => {
    // studentId -> { dateStr: status }
    const map: Record<string, Record<string, AttendanceStatus>> = {};
    classStudents.forEach(st => {
      map[st.id] = {};
    });

    daysArray.forEach(d => {
      if (d.isFriday) return; // Friday off
      const dayRecords = dailyAttendanceService.getRecordsByDateAndClass(d.dateStr, selectedClass);
      dayRecords.forEach(r => {
        if (!map[r.studentId]) map[r.studentId] = {};
        map[r.studentId][d.dateStr] = r.status;
      });
    });

    return map;
  }, [classStudents, daysArray, selectedClass]);

  // Total official working days (non-Fridays)
  const totalWorkingDays = useMemo(() => {
    return daysArray.filter(d => !d.isFriday).length;
  }, [daysArray]);

  // Compute student stats — RECORDED DAYS ONLY (owner rule).
  // A previous version defaulted every unlogged day to PRESENT
  // (`|| 'PRESENT'; // default present if not logged`), so the printed
  // register showed near-perfect attendance for months where attendance
  // was never taken. Now an unlogged day counts for nothing: it renders
  // blank, and the rate is computed over recorded days only (null when
  // the student has no records at all that month).
  const getStudentStats = (studentId: string) => {
    const studentLog = monthlyDataMap[studentId] || {};
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let recordedDays = 0;

    daysArray.forEach(d => {
      if (d.isFriday) return;
      const st = studentLog[d.dateStr];
      if (!st) return; // not recorded — never counted as present
      recordedDays++;
      if (st === 'PRESENT') presentCount++;
      else if (st === 'ABSENT') absentCount++;
      else if (st === 'LATE') { lateCount++; presentCount++; }
      else if (st === 'LEAVE') leaveCount++;
    });

    const totalPresent = presentCount;
    const rate = recordedDays > 0 ? Math.round((totalPresent / recordedDays) * 100) : null;

    return {
      workingDays: recordedDays,
      recordedDays,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      rate
    };
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = `\uFEFF${schoolProfile?.name || 'মাদ্রাসা'} - মাসিক হাজিরা শিট\n`;
    csv += `শ্রেণি: ${selectedClass}, মাস: ${monthNamesBn[selectedMonth - 1]} ${selectedYear}\n\n`;
    
    // Header
    csv += 'রোল,শিক্ষার্থীর নাম,আইডি,';
    daysArray.forEach(d => {
      csv += `${d.day} (${d.dayNameBn}),`;
    });
    csv += 'মোট কর্মদিবস,মোট উপস্থিত,অনুপস্থিত,বিলম্ব,ছুটি,শতাংশ\n';

    // Rows
    filteredStudents.forEach(st => {
      const stats = getStudentStats(st.id);
      csv += `"${st.roll || ''}","${st.nameBn || st.name}","${st.studentId || ''}",`;
      daysArray.forEach(d => {
        if (d.isFriday) {
          csv += 'ছুটি,';
        } else {
          const s = (monthlyDataMap[st.id] && monthlyDataMap[st.id][d.dateStr]) || '-';
          csv += `${s},`;
        }
      });
      csv += `${stats.workingDays},${stats.presentCount},${stats.absentCount},${stats.lateCount},${stats.leaveCount},${stats.rate !== null ? `${stats.rate}%` : '-'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-attendance-${selectedClass}-${selectedYear}-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#161c2e] p-5 rounded-2xl border border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-xs uppercase tracking-wider mb-1">
            <FileSpreadsheet size={16} />
            <span>{isBn ? 'মাসিক প্রাতিষ্ঠানিক হাজিরা রেজিস্টার' : 'Monthly Attendance Register & Ledger'}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            {isBn ? 'মাসিক হাজিরা শিট ও রেজিস্টার' : 'Monthly Attendance Sheet'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isBn 
              ? '১ থেকে ৩১ তারিখের পূর্ণাঙ্গ গ্রিড রেজিস্টার, সাপ্তাহিক ছুটি সমন্বয় এবং অফিশিয়াল প্রিন্ট শিট।'
              : 'Full 1-31 days attendance ledger with Friday holidays and printable official A4 landscape view.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300"
          >
            <Download size={14} />
            <span>{isBn ? 'CSV এক্সপোর্ট' : 'Export'}</span>
          </Button>

          <Button
            onClick={handlePrint}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট রেজিস্টার' : 'Print Register'}</span>
          </Button>
        </div>
      </div>

      {/* Filter and Month Navigation Toolbar */}
      <div className="bg-slate-50 dark:bg-[#161c2e] border border-slate-200 dark:border-white/10 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{isBn ? 'শ্রেণি:' : 'Class:'}</span>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center gap-1 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-600 dark:text-slate-300"
              title="পূর্ববর্তী মাস"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2 min-w-[120px] text-center">
              {isBn ? `${monthNamesBn[selectedMonth - 1]} ${formatNumber(selectedYear, language)}` : `${selectedMonth}/${selectedYear}`}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-600 dark:text-slate-300"
              title="পরবর্তী মাস"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-white dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10">
            {isBn ? `মোট কর্মদিবস: ${formatNumber(totalWorkingDays, language)} দিন` : `Working days: ${totalWorkingDays}`}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ভিউ সুইচ — টেবিলের পাশাপাশি কার্ড ভিউ (তাঁর সিদ্ধান্ত, §৬-৪) */}
          <div className="flex rounded-full p-1 gap-1 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 print:hidden">
            {([
              { key: 'table' as const, label: isBn ? 'টেবিল' : 'Table' },
              { key: 'cards' as const, label: isBn ? 'কার্ড' : 'Cards' },
            ]).map(opt => {
              const active = registerView === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRegisterView(opt.key)}
                  className={`text-[12px] px-3 py-1.5 rounded-full transition-colors cursor-pointer ${active ? 'bg-white dark:bg-[#161c2e] text-teal-800 dark:text-teal-300 font-bold shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 font-medium'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={isBn ? 'নাম বা রোল খুঁজুন...' : 'Search student...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500"
          />
          </div>
        </div>
      </div>

      {/* Legend Strip */}
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400 flex-wrap bg-white dark:bg-[#161c2e] p-3 rounded-xl border border-slate-200 dark:border-white/10">
        <span className="text-slate-400 dark:text-slate-500 font-bold">{isBn ? 'নির্দেশিকা:' : 'Legend:'}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">P</span>
          <span>{isBn ? 'উপস্থিত' : 'Present'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-center font-bold text-[10px]">A</span>
          <span>{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-[10px]">L</span>
          <span>{isBn ? 'বিলম্ব' : 'Late'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-500/15 border border-blue-300 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">Lf</span>
          <span>{isBn ? 'ছুটি' : 'Leave'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-[10px]">F</span>
          <span>{isBn ? 'শুক্রবার (ছুটি)' : 'Friday'}</span>
        </span>
      </div>

      {/* Printable Ledger Table */}
      <div ref={printRef} className="bg-white dark:bg-[#161c2e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/5 print:bg-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm">
              {schoolProfile?.name || (isBn ? 'মাদ্রাসা ব্যবস্থাপনা সিস্টেম' : 'Madrasah Management')} • {isBn ? `শ্রেণি: ${selectedClass}` : `Class: ${selectedClass}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn 
                ? `মাসিক হাজিরা রেজিস্টার: ${monthNamesBn[selectedMonth - 1]} ${formatNumber(selectedYear, language)} • মোট ছাত্র: ${formatNumber(filteredStudents.length, language)} জন`
                : `Register: ${selectedMonth}/${selectedYear}`}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono hidden print:block">
            {new Date().toLocaleDateString('bn-BD')}
          </div>
        </div>

        {/* Big Ledger Grid Table — কার্ড ভিউতে স্ক্রিনে লুকানো, প্রিন্টে টেবিলই ছাপা হয় */}
        <div className={registerView === 'cards' ? 'overflow-x-auto hidden print:block print:overflow-visible' : 'overflow-x-auto'}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-white/5 text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider border-b border-slate-300 dark:border-white/10">
                <th className="py-2 px-2 text-center w-12 border-r border-slate-200 dark:border-white/10 bg-slate-200/50 dark:bg-white/5">রোল</th>
                <th className="py-2 px-2.5 min-w-[130px] border-r border-slate-200 dark:border-white/10 sticky left-0 bg-slate-100 dark:bg-[#161c2e] z-10 shadow-2xs">
                  {isBn ? 'নাম' : 'Name'}
                </th>
                {daysArray.map(d => (
                  <th 
                    key={d.day} 
                    className={`py-1.5 px-1 text-center w-7 border-r border-slate-200 dark:border-white/5 ${
                      d.isFriday ? 'bg-rose-100/60 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 font-black' : ''
                    }`}
                  >
                    <div className="font-mono text-[11px]">{d.day}</div>
                    <div className="text-[9px] font-medium opacity-80">{d.dayNameBn}</div>
                  </th>
                ))}
                <th className="py-2 px-2 text-center w-12 border-l border-r border-slate-200 dark:border-white/10 bg-slate-200/50 dark:bg-white/5">উপস্থিত</th>
                <th className="py-2 px-2 text-center w-12 border-r border-slate-200 dark:border-white/10 bg-slate-200/50 dark:bg-white/5">অনুপস্থিত</th>
                <th className="py-2 px-2 text-center w-14 bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 font-black">হার %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const stats = getStudentStats(student.id);
                  const isLow = stats.rate !== null && stats.rate < 80;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-white/5 bg-slate-50/40 dark:bg-white/5">
                        {student.roll || student.rollNumber || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-white border-r border-slate-200 dark:border-white/5 sticky left-0 bg-white dark:bg-[#161c2e] z-10 truncate max-w-[150px] shadow-2xs" title={student.nameBn || student.name}>
                        {student.nameBn || student.name}
                      </td>

                      {/* Day Cells */}
                      {daysArray.map(d => {
                        if (d.isFriday) {
                          return (
                            <td key={d.day} className="py-1 px-1 text-center border-r border-slate-200 dark:border-white/5 bg-slate-100/70 dark:bg-white/5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                              F
                            </td>
                          );
                        }

                        const status = (monthlyDataMap[student.id] && monthlyDataMap[student.id][d.dateStr]) || null;

                        // Unrecorded day: blank cell — never a fabricated 'P'.
                        if (!status) {
                          return (
                            <td key={d.day} className="py-1 px-0.5 text-center border-r border-slate-200 dark:border-white/5 text-[10px] font-mono text-slate-300 dark:text-slate-600">
                              –
                            </td>
                          );
                        }

                        let badgeClass = 'text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50/60 dark:bg-emerald-500/15';
                        let symbol = 'P';
                        if (status === 'ABSENT') {
                          badgeClass = 'text-rose-700 dark:text-rose-300 font-black bg-rose-100/80 dark:bg-rose-500/15';
                          symbol = 'A';
                        } else if (status === 'LATE') {
                          badgeClass = 'text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/15';
                          symbol = 'L';
                        } else if (status === 'LEAVE') {
                          badgeClass = 'text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-500/15';
                          symbol = 'Lf';
                        }

                        return (
                          <td key={d.day} className={`py-1 px-0.5 text-center border-r border-slate-200 dark:border-white/5 text-[10px] font-mono ${badgeClass}`}>
                            {symbol}
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 border-l border-r border-slate-200 dark:border-white/5 bg-emerald-50/30 dark:bg-emerald-500/10">
                        {formatNumber(stats.presentCount, language)}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-rose-700 dark:text-rose-300 border-r border-slate-200 dark:border-white/5 bg-rose-50/30 dark:bg-rose-500/10">
                        {formatNumber(stats.absentCount, language)}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-mono font-black ${
                        isLow ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                      }`}>
                        {stats.rate !== null ? `${formatNumber(stats.rate, language)}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Cards ভিউ — মোবাইল শিটের কার্ডের ধাঁচে (টেবিলের পাশাপাশি);
            সংখ্যা টেবিলের getStudentStats-এরই (নতুন হিসাব নয়); প্রিন্টে লুকানো। */}
        {registerView === 'cards' && (
          <div className="p-4 print:hidden">
            {filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredStudents.map(student => {
                  const stats = getStudentStats(student.id);
                  const studentLog = monthlyDataMap[student.id] || {};
                  const displayName = student.nameBn || student.name || '';
                  return (
                    <div key={student.id} className="rounded-2xl p-4 bg-white dark:bg-[#161c2e] border border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300">
                          {displayName.trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[14px] truncate text-slate-800 dark:text-white">{displayName}</p>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400">
                            {isBn ? `রোল ${student.roll || student.rollNumber || '—'}` : `Roll ${student.roll || student.rollNumber || '—'}`} • {formatNumber(stats.presentCount, language)}/{formatNumber(stats.recordedDays, language)} • {stats.rate !== null ? `${formatNumber(stats.rate, language)}%` : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          ✓ {formatNumber(stats.presentCount, language)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300">
                          {isBn ? 'দে' : 'L'} {formatNumber(stats.lateCount, language)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          ✗ {formatNumber(stats.absentCount, language)}
                        </span>
                        {stats.leaveCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
                            {isBn ? 'ছুটি' : 'Leave'} {formatNumber(stats.leaveCount, language)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-1 mt-3">
                        {daysArray.map(d => {
                          if (d.isFriday) {
                            return (
                              <div key={d.day} className="h-[38px] rounded-lg flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <span className="text-[12px] font-bold leading-none">{formatNumber(d.day, language)}</span>
                                <span className="text-[10px] font-bold leading-none mt-0.5">F</span>
                              </div>
                            );
                          }
                          const status = studentLog[d.dateStr] || null;
                          if (!status) {
                            return (
                              <div key={d.day} className="h-[38px] rounded-lg flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                <span className="text-[12px] font-bold leading-none">{formatNumber(d.day, language)}</span>
                                <span className="text-[10px] font-bold leading-none mt-0.5">–</span>
                              </div>
                            );
                          }
                          const cellCls = status === 'PRESENT'
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : status === 'ABSENT'
                              ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : status === 'LATE'
                                ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300';
                          const sym = status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : status === 'LATE' ? 'L' : 'Lf';
                          return (
                            <div key={d.day} className={`h-[38px] rounded-lg flex flex-col items-center justify-center ${cellCls}`}>
                              <span className="text-[12px] font-bold leading-none">{formatNumber(d.day, language)}</span>
                              <span className="text-[10px] font-bold leading-none mt-0.5">{sym}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ledger Footer */}
        <div className="p-3 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            {isBn ? 'স্বাক্ষর: শ্রেণি শিক্ষক ____________________   অধ্যক্ষ / সুপারিনটেনডেন্ট ____________________' : 'Signatures: Class Teacher & Principal'}
          </span>
          <span className="font-mono text-slate-400 dark:text-slate-500">
            Official Monthly Register • v4.0
          </span>
        </div>
      </div>
    </div>
  );
};
