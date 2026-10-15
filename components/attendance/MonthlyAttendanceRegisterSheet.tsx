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

  // Compute student stats
  const getStudentStats = (studentId: string) => {
    const studentLog = monthlyDataMap[studentId] || {};
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;

    daysArray.forEach(d => {
      if (d.isFriday) return;
      const st = studentLog[d.dateStr] || 'PRESENT'; // default present if not logged
      if (st === 'PRESENT') presentCount++;
      else if (st === 'ABSENT') absentCount++;
      else if (st === 'LATE') { lateCount++; presentCount++; }
      else if (st === 'LEAVE') leaveCount++;
    });

    const totalPresent = presentCount;
    const rate = totalWorkingDays > 0 ? Math.round((totalPresent / totalWorkingDays) * 100) : 100;

    return {
      workingDays: totalWorkingDays,
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
          const s = (monthlyDataMap[st.id] && monthlyDataMap[st.id][d.dateStr]) || 'P';
          csv += `${s},`;
        }
      });
      csv += `${stats.workingDays},${stats.presentCount},${stats.absentCount},${stats.lateCount},${stats.leaveCount},${stats.rate}%\n`;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider mb-1">
            <FileSpreadsheet size={16} />
            <span>{isBn ? 'মাসিক প্রাতিষ্ঠানিক হাজিরা রেজিস্টার' : 'Monthly Attendance Register & Ledger'}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isBn ? 'মাসিক হাজিরা শিট ও রেজিস্টার' : 'Monthly Attendance Sheet'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
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
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট রেজিস্টার' : 'Print Register'}</span>
          </Button>
        </div>
      </div>

      {/* Filter and Month Navigation Toolbar */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{isBn ? 'শ্রেণি:' : 'Class:'}</span>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 shadow-2xs"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="পূর্ববর্তী মাস"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-800 px-2 min-w-[120px] text-center">
              {isBn ? `${monthNamesBn[selectedMonth - 1]} ${formatNumber(selectedYear, 'bn')}` : `${selectedMonth}/${selectedYear}`}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="পরবর্তী মাস"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="text-xs text-slate-500 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {isBn ? `মোট কর্মদিবস: ${formatNumber(totalWorkingDays, 'bn')} দিন` : `Working days: ${totalWorkingDays}`}
          </div>
        </div>

        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isBn ? 'নাম বা রোল খুঁজুন...' : 'Search student...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Legend Strip */}
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-slate-400 font-bold">{isBn ? 'নির্দেশিকা:' : 'Legend:'}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-[10px]">P</span>
          <span>{isBn ? 'উপস্থিত' : 'Present'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-rose-100 border border-rose-300 text-rose-800 flex items-center justify-center font-bold text-[10px]">A</span>
          <span>{isBn ? 'অনুপস্থিত' : 'Absent'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-[10px]">L</span>
          <span>{isBn ? 'বিলম্ব' : 'Late'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-indigo-100 border border-indigo-300 text-indigo-800 flex items-center justify-center font-bold text-[10px]">Lf</span>
          <span>{isBn ? 'ছুটি' : 'Leave'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 text-slate-600 flex items-center justify-center font-bold text-[10px]">F</span>
          <span>{isBn ? 'শুক্রবার (ছুটি)' : 'Friday'}</span>
        </span>
      </div>

      {/* Printable Ledger Table */}
      <div ref={printRef} className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 print:bg-white flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 text-sm">
              {schoolProfile?.name || (isBn ? 'মাদ্রাসা ব্যবস্থাপনা সিস্টেম' : 'Madrasah Management')} • {isBn ? `শ্রেণি: ${selectedClass}` : `Class: ${selectedClass}`}
            </h3>
            <p className="text-xs text-slate-500">
              {isBn 
                ? `মাসিক হাজিরা রেজিস্টার: ${monthNamesBn[selectedMonth - 1]} ${formatNumber(selectedYear, 'bn')} • মোট ছাত্র: ${formatNumber(filteredStudents.length, 'bn')} জন`
                : `Register: ${selectedMonth}/${selectedYear}`}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 font-mono hidden print:block">
            {new Date().toLocaleDateString('bn-BD')}
          </div>
        </div>

        {/* Big Ledger Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-300">
                <th className="py-2 px-2 text-center w-12 border-r border-slate-200 bg-slate-200/50">রোল</th>
                <th className="py-2 px-2.5 min-w-[130px] border-r border-slate-200 sticky left-0 bg-slate-100 z-10 shadow-2xs">
                  {isBn ? 'নাম' : 'Name'}
                </th>
                {daysArray.map(d => (
                  <th 
                    key={d.day} 
                    className={`py-1.5 px-1 text-center w-7 border-r border-slate-200 ${
                      d.isFriday ? 'bg-rose-100/60 text-rose-800 font-black' : ''
                    }`}
                  >
                    <div className="font-mono text-[11px]">{d.day}</div>
                    <div className="text-[9px] font-medium opacity-80">{d.dayNameBn}</div>
                  </th>
                ))}
                <th className="py-2 px-2 text-center w-12 border-l border-r border-slate-200 bg-slate-200/50">উপস্থিত</th>
                <th className="py-2 px-2 text-center w-12 border-r border-slate-200 bg-slate-200/50">অনুপস্থিত</th>
                <th className="py-2 px-2 text-center w-14 bg-emerald-100/70 text-emerald-900 font-black">হার %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 5} className="py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p>{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students found.'}</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const stats = getStudentStats(student.id);
                  const isLow = stats.rate < 80;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700 border-r border-slate-200 bg-slate-50/40">
                        {student.roll || student.rollNumber || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 font-bold text-slate-800 border-r border-slate-200 sticky left-0 bg-white z-10 truncate max-w-[150px] shadow-2xs" title={student.nameBn || student.name}>
                        {student.nameBn || student.name}
                      </td>

                      {/* Day Cells */}
                      {daysArray.map(d => {
                        if (d.isFriday) {
                          return (
                            <td key={d.day} className="py-1 px-1 text-center border-r border-slate-200 bg-slate-100/70 text-slate-400 font-mono text-[10px]">
                              F
                            </td>
                          );
                        }

                        const status = (monthlyDataMap[student.id] && monthlyDataMap[student.id][d.dateStr]) || 'PRESENT';

                        let badgeClass = 'text-emerald-700 font-bold bg-emerald-50/60';
                        let symbol = 'P';
                        if (status === 'ABSENT') {
                          badgeClass = 'text-rose-700 font-black bg-rose-100/80';
                          symbol = 'A';
                        } else if (status === 'LATE') {
                          badgeClass = 'text-amber-800 font-bold bg-amber-50';
                          symbol = 'L';
                        } else if (status === 'LEAVE') {
                          badgeClass = 'text-indigo-700 font-bold bg-indigo-50';
                          symbol = 'Lf';
                        }

                        return (
                          <td key={d.day} className={`py-1 px-0.5 text-center border-r border-slate-200 text-[10px] font-mono ${badgeClass}`}>
                            {symbol}
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-emerald-700 border-l border-r border-slate-200 bg-emerald-50/30">
                        {formatNumber(stats.presentCount, 'bn')}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-rose-700 border-r border-slate-200 bg-rose-50/30">
                        {formatNumber(stats.absentCount, 'bn')}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-mono font-black ${
                        isLow ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {stats.rate}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            {isBn ? 'স্বাক্ষর: শ্রেণি শিক্ষক ____________________   অধ্যক্ষ / মুহতামিম ____________________' : 'Signatures: Class Teacher & Principal'}
          </span>
          <span className="font-mono text-slate-400">
            Official Monthly Register • v4.0
          </span>
        </div>
      </div>
    </div>
  );
};
