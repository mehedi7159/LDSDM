import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Home, 
  GraduationCap, 
  Download, 
  Printer, 
  Filter, 
  Search, 
  PieChart as PieIcon, 
  BarChart3, 
  Droplets,
  Calendar,
  Layers,
  ArrowUpDown
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

export const StudentReportView: React.FC = () => {
  const { students = [], classes = [], schoolProfile, language, t } = useApp();
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedResidential, setSelectedResidential] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toBanglaDigits = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const banglaNums: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return str.split('').map(char => banglaNums[char] || char).join('');
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return (students || []).filter(s => {
      if (!s) return false;
      if (selectedClass !== 'all' && s.class !== selectedClass) return false;
      if (selectedResidential !== 'all') {
        const isRes = s.isResidential ? 'residential' : 'non_residential';
        if (isRes !== selectedResidential) return false;
      }
      if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchId = (s.studentId || '').toLowerCase().includes(q);
        const matchRoll = String(s.roll || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchRoll) return false;
      }
      return true;
    });
  }, [students, selectedClass, selectedResidential, selectedStatus, searchQuery]);

  // Aggregate stats
  const safeStudents = students || [];
  const totalCount = safeStudents.length;
  const activeCount = safeStudents.filter(s => s.status === 'active').length;
  const inactiveCount = totalCount - activeCount;
  const residentialCount = safeStudents.filter(s => s.isResidential).length;
  const nonResidentialCount = totalCount - residentialCount;

  // Class distribution chart data
  const classDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    (students || []).forEach(s => {
      if (s?.class) {
        counts[s.class] = (counts[s.class] || 0) + 1;
      }
    });
    return (classes || []).map(c => ({
      name: language === 'bn' ? (c.nameBn || c.name) : c.name,
      count: counts[c.name] || 0
    }));
  }, [students, classes, language]);

  // Residential breakdown pie chart
  const residentialData = [
    { name: language === 'bn' ? 'আবাসিক' : 'Residential', value: residentialCount, color: '#4f46e5' },
    { name: language === 'bn' ? 'অনাবাসিক' : 'Non-Residential', value: nonResidentialCount, color: '#06b6d4' }
  ];

  // Blood group breakdown
  const bloodGroups = useMemo(() => {
    const map: Record<string, number> = {};
    (students || []).forEach(s => {
      if (s?.bloodGroup) {
        map[s.bloodGroup] = (map[s.bloodGroup] || 0) + 1;
      }
    });
    return Object.entries(map).map(([bg, count]) => ({ bg, count }));
  }, [students]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Student ID', 'Roll', 'Name', 'Class', 'Status', 'Residential', 'Guardian Phone', 'Blood Group'];
    const rows = filteredStudents.map(s => [
      s.studentId,
      s.roll,
      `"${s.name}"`,
      `"${s.class}"`,
      s.status,
      s.isResidential ? 'Residential' : 'Non-Residential',
      s.guardianPhone || '',
      s.bloodGroup || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">
            <Users size={16} />
            <span>{language === 'bn' ? 'শিক্ষার্থী অ্যানালিটিক্স ও ডেমোগ্রাফিকস' : 'Student Analytics & Demographics'}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            {language === 'bn' ? 'শিক্ষার্থী রিপোর্ট ও পরিসংখ্যান' : 'Student Comprehensive Report'}
          </h1>
          <p className="text-xs text-blue-100/80 mt-1 max-w-xl">
            {language === 'bn'
              ? 'সকল ক্লাসের শিক্ষার্থীদের সামগ্রিক পরিসংখ্যান, আবাসিক/অনাবাসিক অনুপাত এবং বিস্তারিত তালিকা।'
              : 'Detailed breakdown of student enrollments, residential distributions, and demographic metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-xs"
          >
            <Download size={15} />
            <span>{language === 'bn' ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/20"
          >
            <Printer size={15} />
            <span>{language === 'bn' ? 'রিপোর্ট প্রিন্ট' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{toBanglaDigits(totalCount)}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{language === 'bn' ? 'সর্বমোট নথিভুক্ত' : 'Total Enrolled'}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{toBanglaDigits(activeCount)}</h3>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">
              {toBanglaDigits(totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(0) : 0)}% {language === 'bn' ? 'সক্রিয় হার' : 'active rate'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'আবাসিক ছাত্র' : 'Residential'}</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{toBanglaDigits(residentialCount)}</h3>
            <p className="text-[10px] text-indigo-600/80 mt-0.5">
              {toBanglaDigits(totalCount > 0 ? ((residentialCount / totalCount) * 100).toFixed(0) : 0)}% {language === 'bn' ? 'আবাসিক' : 'residential'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Home size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{language === 'bn' ? 'অনাবাসিক ছাত্র' : 'Non-Residential'}</p>
            <h3 className="text-2xl font-black text-cyan-600 mt-1">{toBanglaDigits(nonResidentialCount)}</h3>
            <p className="text-[10px] text-cyan-600/80 mt-0.5">
              {toBanglaDigits(totalCount > 0 ? ((nonResidentialCount / totalCount) * 100).toFixed(0) : 0)}% {language === 'bn' ? 'অনাবাসিক' : 'day-scholar'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <GraduationCap size={24} />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Class distribution */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-600" />
                <span>{language === 'bn' ? 'শ্রেণিভিত্তিক শিক্ষার্থী সংখ্যা' : 'Students per Class'}</span>
              </h3>
              <p className="text-xs text-slate-400">{language === 'bn' ? 'প্রতিটি শ্রেণিতে শিক্ষার্থী বন্টন' : 'Class-wise student distribution'}</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} name={language === 'bn' ? 'শিক্ষার্থী' : 'Students'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Residential Donut */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-1">
              <PieIcon size={18} className="text-cyan-600" />
              <span>{language === 'bn' ? 'আবাসিক অনুপাত' : 'Residential Ratio'}</span>
            </h3>
            <p className="text-xs text-slate-400">{language === 'bn' ? 'আবাসিক ও ডে-স্কলার ভাগ' : 'Hostel vs Day scholars'}</p>
          </div>
          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={residentialData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {residentialData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {bloodGroups.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[10px]">
              <span className="font-bold text-slate-500 shrink-0"><Droplets size={12} className="inline text-rose-500 mr-1" />ব্লাড গ্রুপ:</span>
              {bloodGroups.map(bg => (
                <span key={bg.bg} className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">
                  {bg.bg}: {toBanglaDigits(bg.count)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'bn' ? 'নাম, রোল বা আইডি দিয়ে খুঁজুন...' : 'Search by name, roll, ID...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সকল শ্রেণি' : 'All Classes'}</option>
            {classes.map(c => (
              <option key={c.id} value={c.name}>{language === 'bn' ? (c.nameBn || c.name) : c.name}</option>
            ))}
          </select>

          <select
            value={selectedResidential}
            onChange={(e) => setSelectedResidential(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সকল ধরন (আবাসিক/অনাবাসিক)' : 'All Types'}</option>
            <option value="residential">{language === 'bn' ? 'আবাসিক' : 'Residential'}</option>
            <option value="non_residential">{language === 'bn' ? 'অনাবাসিক' : 'Non-Residential'}</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">{language === 'bn' ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
            <option value="active">{language === 'bn' ? 'সক্রিয়' : 'Active'}</option>
            <option value="inactive">{language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'}</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500">
          {language === 'bn' ? 'ফিল্টারকৃত:' : 'Showing:'} <span className="text-indigo-600 font-extrabold">{toBanglaDigits(filteredStudents.length)}</span> {language === 'bn' ? 'জন' : 'students'}
        </div>
      </div>

      {/* Printable Comprehensive Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Printable Header */}
        <div className="p-6 border-b border-slate-100 hidden print:block text-center">
          <h2 className="text-xl font-black text-slate-900">{schoolProfile.nameBn || schoolProfile.name}</h2>
          <p className="text-xs text-slate-600">{schoolProfile.address}</p>
          <h3 className="text-sm font-bold text-slate-800 mt-2 underline">
            {language === 'bn' ? 'শিক্ষার্থী তালিকা ও সাধারণ বিবরণী' : 'Student Enrollment Report'}
          </h3>
          <p className="text-[10px] text-slate-500">
            {language === 'bn' ? 'তারিখ:' : 'Date:'} {new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">{language === 'bn' ? 'আইডি' : 'Student ID'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'নাম' : 'Student Name'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'শ্রেণি' : 'Class'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'রোল' : 'Roll'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'ধরন' : 'Type'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'অভিভাবকের ফোন' : 'Guardian Contact'}</th>
                <th className="py-3 px-4">{language === 'bn' ? 'রক্তের গ্রুপ' : 'Blood'}</th>
                <th className="py-3 px-4 text-center">{language === 'bn' ? 'অবস্থা' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {language === 'bn' ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{toBanglaDigits(idx + 1)}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{s.studentId}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{s.name}</span>
                      {s.fatherName && <span className="text-[10px] text-slate-400">{s.fatherName}</span>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-indigo-700">{s.class}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{toBanglaDigits(s.roll)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.isResidential ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.isResidential ? (language === 'bn' ? 'আবাসিক' : 'Residential') : (language === 'bn' ? 'অনাবাসিক' : 'Day')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.guardianPhone || '-'}</td>
                    <td className="py-3 px-4 font-bold text-rose-600">{s.bloodGroup || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.status === 'active' ? (language === 'bn' ? 'সক্রিয়' : 'Active') : (language === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive')}
                      </span>
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
