import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BookOpen, 
  PenTool, 
  Users, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Sparkles, 
  GraduationCap, 
  Search, 
  Check, 
  X, 
  LogOut,
  ChevronRight,
  ShieldCheck,
  Phone,
  MessageCircle,
  UserCheck
} from 'lucide-react';
import { MarksEntry } from './MarksEntry';
import { AttendanceEntry } from './AttendanceEntry';
import { ResultGenerator } from './ResultView';
import { formatBanglaNumber, formatNumber } from '../services/utils';

export const TeacherPortal: React.FC = () => {
  const { currentUser, schoolProfile, students, classes, subjects, exams, marks, logoutUser, language } = useApp();
  const [activeTab, setActiveTab] = useState<'attendance' | 'students' | 'marks' | 'results'>('attendance');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentClass, setSelectedStudentClass] = useState<string>(() => {
    if (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) {
      return currentUser.assignedClasses[0];
    }
    return classes[0]?.name || '';
  });

  // Filter classes available to this teacher (or all if not scoped)
  const teacherClasses = useMemo(() => {
    if (currentUser?.assignedClasses && currentUser.assignedClasses.length > 0) {
      const set = new Set(currentUser.assignedClasses);
      return classes.filter(c => set.has(c.id) || set.has(c.name));
    }
    return classes;
  }, [classes, currentUser]);

  // Students in selected class
  const classStudents = useMemo(() => {
    const list = students.filter(s => {
      const matchClass = !selectedStudentClass || s.classLevel === selectedStudentClass;
      const matchActive = s.status === 'Active' && !s.isFormer;
      const matchSearch = !studentSearch || 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.nameBn && s.nameBn.includes(studentSearch)) ||
        (s.roll && s.roll.includes(studentSearch)) ||
        (s.guardianPhone && s.guardianPhone.includes(studentSearch));
      return matchClass && matchActive && matchSearch;
    });
    return list.sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [students, selectedStudentClass, studentSearch]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-24 md:pb-6">
      {/* Top Mobile-First App Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
              মু
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {currentUser?.nameBn || currentUser?.name || 'মুয়াল্লিম (শিক্ষক)'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  শিক্ষক ড্যাশবোর্ড
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {currentUser?.designation || 'দাখিল ও ইবতেদায়ী শাখা'} • {schoolProfile.nameBn || schoolProfile.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={logoutUser}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 hover:text-rose-200 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="লগআউট"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">লগআউট</span>
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="max-w-5xl mx-auto px-2 flex border-t border-slate-800 text-xs font-semibold overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 min-w-[95px] py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'attendance' 
                ? 'border-emerald-400 text-emerald-400 bg-slate-800/50' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar size={14} />
            <span>দৈনিক হাজিরা</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 min-w-[95px] py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'students' 
                ? 'border-emerald-400 text-emerald-400 bg-slate-800/50' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={14} />
            <span>শিক্ষার্থী ও অভিভাবক</span>
          </button>

          <button
            onClick={() => setActiveTab('marks')}
            className={`flex-1 min-w-[95px] py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'marks' 
                ? 'border-emerald-400 text-emerald-400 bg-slate-800/50' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PenTool size={14} />
            <span>নম্বর এন্ট্রি</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 min-w-[95px] py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'results' 
                ? 'border-emerald-400 text-emerald-400 bg-slate-800/50' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>ফলাফল কার্ড</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 py-5 flex-1">
        {/* Tab 1: Daily Attendance */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0" />
                <span className="font-semibold">শ্রেণি শিক্ষক হিসেবে আপনার শ্রেণির উপস্থিতি গ্রহণ করুন। ক্লাউডে তাৎক্ষণিক সংরক্ষিত হবে।</span>
              </div>
            </div>
            <AttendanceEntry />
          </div>
        )}

        {/* Tab 2: Students & Guardian Contact Directory */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Filter and Class selector */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-slate-700 shrink-0">শ্রেণি:</label>
                <select
                  value={selectedStudentClass}
                  onChange={(e) => setSelectedStudentClass(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {teacherClasses.map(cls => (
                    <option key={cls.id} value={cls.name}>
                      {cls.displayName || cls.nameBn || cls.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 font-semibold shrink-0">
                  ({formatNumber(classStudents.length, language)} জন)
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="নাম, রোল বা ফোন নম্বর খুঁজুন..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Student Directory Cards */}
            {classStudents.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {classStudents.map(student => (
                  <div
                    key={student.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs border border-emerald-100">
                            {formatNumber(student.roll || '—', language)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {student.nameBn || student.name}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              আইডি: {student.studentId || student.id.slice(0, 6)} • রোল: {formatNumber(student.roll || '—', language)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                        {student.fatherName && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">পিতার নাম:</span>
                            <span className="font-medium text-slate-700">{student.fatherNameBn || student.fatherName}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">অভিভাবকের ফোন:</span>
                          <span className="font-bold text-slate-800">
                            {student.guardianPhone || 'নম্বর যুক্ত নেই'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      {student.guardianPhone ? (
                        <a
                          href={`tel:${student.guardianPhone}`}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Phone size={13} />
                          <span>কল করুন</span>
                        </a>
                      ) : (
                        <div className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs text-center">
                          নম্বর নেই
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Marks Entry */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0" />
                <span className="font-semibold">অনুমোদিত বিষয়ের নম্বর এন্ট্রি করুন। অ্যাডমিন mehedihasansagor26@gmail.com থেকেও ব্যাকআপ এন্ট্রি দেওয়া যাবে।</span>
              </div>
            </div>
            <MarksEntry />
          </div>
        )}

        {/* Tab 4: Results View */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            <ResultGenerator />
          </div>
        )}
      </main>

      {/* Bottom Navigation Dock for Mobile Screens */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around py-1.5 px-1 shadow-lg">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'attendance' ? 'text-emerald-600 font-extrabold scale-105' : 'text-slate-500'
          }`}
        >
          <Calendar size={18} />
          <span>হাজিরা</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'students' ? 'text-emerald-600 font-extrabold scale-105' : 'text-slate-500'
          }`}
        >
          <Users size={18} />
          <span>শিক্ষার্থী</span>
        </button>

        <button
          onClick={() => setActiveTab('marks')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'marks' ? 'text-emerald-600 font-extrabold scale-105' : 'text-slate-500'
          }`}
        >
          <PenTool size={18} />
          <span>নম্বর</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
            activeTab === 'results' ? 'text-emerald-600 font-extrabold scale-105' : 'text-slate-500'
          }`}
        >
          <FileSpreadsheet size={18} />
          <span>রেজাল্ট</span>
        </button>
      </div>
    </div>
  );
};
