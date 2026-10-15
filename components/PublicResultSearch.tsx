import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  GraduationCap, 
  Award, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Printer, 
  ArrowLeft,
  Sparkles,
  QrCode,
  Building2,
  Calendar,
  Layers,
  UserCheck
} from 'lucide-react';
import { calculateTotalGPA, calculateGrade, formatBanglaNumber, shortenSubjectName } from '../services/utils';
import { ResultVerificationQR } from './ResultVerificationQR';
import { VerifiedResultModal } from './VerifiedResultModal';

interface PublicResultSearchProps {
  onBackToLanding?: () => void;
  onGoToLogin?: () => void;
}

export const PublicResultSearch: React.FC<PublicResultSearchProps> = ({ onBackToLanding, onGoToLogin }) => {
  const { students, subjects, exams, marks, classes, schoolProfile, language } = useApp();

  const [searchStudentId, setSearchStudentId] = useState('');
  const [selectedClass, setSelectedClass] = useState(classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
  const [searchedStudent, setSearchedStudent] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const query = searchStudentId.trim().toLowerCase();
    if (!query) {
      setSearchedStudent(null);
      return;
    }

    const found = students.find(s => {
      const matchId = (s.studentId && s.studentId.toLowerCase() === query) || (s.id && s.id.toLowerCase() === query);
      const matchRoll = s.roll && String(s.roll).trim() === query;
      const matchClass = selectedClass === 'All' || !selectedClass || s.classLevel === selectedClass;
      return (matchId || matchRoll) && matchClass;
    }) || students.find(s => {
      // Fallback matching just roll or ID without class filter
      const matchId = (s.studentId && s.studentId.toLowerCase() === query) || (s.id && s.id.toLowerCase() === query);
      const matchRoll = s.roll && String(s.roll).trim() === query;
      return matchId || matchRoll;
    });

    setSearchedStudent(found || null);
  };

  const selectedExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Calculate result details for found student
  const studentResultData = searchedStudent && selectedExam ? (() => {
    const studentSubjects = subjects.filter(s => s.classLevel === searchedStudent.classLevel);
    const studentMarks = marks.filter(m => m.studentId === searchedStudent.id && m.examId === selectedExam.id);
    const gpaSummary = calculateTotalGPA(studentSubjects, marks, searchedStudent.id, selectedExam.id, searchedStudent.group, exams);
    
    return {
      subjects: studentSubjects,
      marks: studentMarks,
      gpaSummary
    };
  })() : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">মূল পাতা</span>
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                দা
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h1>
                <p className="text-[10px] text-slate-500">অনলাইন রেজাল্ট ও গ্রেডশিট পোর্টাল</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onGoToLogin && (
              <button
                onClick={onGoToLogin}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>পোর্টাল লগইন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        
        {/* Search Header Banner */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <GraduationCap size={14} className="text-emerald-600" />
            <span>দাখিল ও ইবতেদায়ী ফলাফল প্রকাশনা</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            অনলাইন রেজাল্ট ও ট্রান্সক্রিপ্ট অনুসন্ধান
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            শিক্ষার্থীর রোল নম্বর অথবা স্টুডেন্ট আইডি দিয়ে তাৎক্ষণিক মার্কশিট ও ফলাফল দেখুন।
          </p>
        </div>

        {/* Search Box Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  পরীক্ষা নির্বাচন করুন
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.nameBn || ex.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  শ্রেণি (ঐচ্ছিক)
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">সকল শ্রেণি</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.nameBn || c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                শিক্ষার্থীর রোল নম্বর অথবা আইডি (Roll / Student ID)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchStudentId}
                  onChange={(e) => setSearchStudentId(e.target.value)}
                  placeholder="যেমন: 101 অথবা রোল 01"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-900 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                  autoFocus
                />
                <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search size={15} />
              <span>ফলাফল অনুসন্ধান করুন</span>
            </button>
          </form>
        </div>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-200">
            {searchedStudent && studentResultData ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden">
                {/* Result Card Header */}
                <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-600/60 pb-5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 block">
                        {schoolProfile.nameBn || schoolProfile.name}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black mt-1">
                        {selectedExam?.nameBn || selectedExam?.name} - {schoolProfile.academicYear}
                      </h3>
                      <p className="text-xs text-emerald-100/90 mt-0.5">অ্যাকাডেমিক ট্রান্সক্রিপ্ট ও মূল্যায়ন পত্র</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`px-4 py-2 rounded-2xl flex flex-col items-center justify-center border shadow-xs ${
                        studentResultData.gpaSummary.isFail 
                          ? 'bg-rose-500/20 border-rose-400/40 text-white' 
                          : 'bg-emerald-500/30 border-emerald-400/50 text-white'
                      }`}>
                        <span className="text-[10px] font-bold uppercase">গ্রেড / GPA</span>
                        <span className="text-xl font-black font-mono">
                          {studentResultData.gpaSummary.isFail ? 'F (0.00)' : `${studentResultData.gpaSummary.grade} (${studentResultData.gpaSummary.gpa.toFixed(2)})`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Info Meta Ribbon */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 text-xs">
                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl">
                      <span className="text-[10px] text-emerald-200 block">শিক্ষার্থীর নাম</span>
                      <span className="font-bold text-white block truncate">{searchedStudent.nameBn || searchedStudent.name}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl">
                      <span className="text-[10px] text-emerald-200 block">রোল ও আইডি</span>
                      <span className="font-bold text-white block">রোল: {formatBanglaNumber(searchedStudent.roll)} | ID: {searchedStudent.studentId || searchedStudent.id}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl">
                      <span className="text-[10px] text-emerald-200 block">শ্রেণি ও বিভাগ</span>
                      <span className="font-bold text-white block">{searchedStudent.classLevel} {searchedStudent.group ? `(${searchedStudent.group})` : ''}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl">
                      <span className="text-[10px] text-emerald-200 block">মোট প্রাপ্ত নম্বর</span>
                      <span className="font-bold text-white block font-mono">{formatBanglaNumber(studentResultData.gpaSummary.totalMarks)}</span>
                    </div>
                  </div>
                </div>

                {/* Subject-wise Marks Table */}
                <div className="p-6 space-y-5">
                  <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">বিষয় কোড ও নাম</th>
                          <th className="p-3 text-center">পূর্ণমান</th>
                          <th className="p-3 text-center">সৃজনশীল (CQ)</th>
                          <th className="p-3 text-center">MCQ/মৌখিক</th>
                          <th className="p-3 text-center">মোট নম্বর</th>
                          <th className="p-3 text-center">লেটার গ্রেড</th>
                          <th className="p-3 text-center">গ্রেড পয়েন্ট</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentResultData.subjects.map(subj => {
                          const mark = marks.find(m => m.studentId === searchedStudent.id && m.subjectId === subj.id && m.examId === selectedExam.id);
                          const obtained = mark?.obtained ?? 0;
                          const { grade, gpa } = calculateGrade(obtained, subj.fullMarks || 100);
                          const isSubjectFail = mark?.isAbsent || obtained < (subj.passMarks ?? 33);

                          return (
                            <tr key={subj.id} className={`hover:bg-slate-50/70 transition-colors ${isSubjectFail ? 'bg-rose-50/40' : ''}`}>
                              <td className="p-3 font-semibold text-slate-800">
                                <div>{subj.nameBn || subj.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">কোড: {subj.code || 'N/A'} {subj.isOptional ? '(৪র্থ বিষয়)' : ''}</div>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-600">{formatBanglaNumber(subj.fullMarks || 100)}</td>
                              <td className="p-3 text-center font-mono text-slate-600">{mark?.obtainedCQ !== undefined ? formatBanglaNumber(mark.obtainedCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono text-slate-600">{mark?.obtainedMCQ !== undefined ? formatBanglaNumber(mark.obtainedMCQ) : '-'}</td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900">{mark?.isAbsent ? 'অনুপস্থিত' : formatBanglaNumber(obtained)}</td>
                              <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                  grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                                  grade === 'F' ? 'bg-rose-100 text-rose-800' :
                                  'bg-blue-50 text-blue-800'
                                }`}>
                                  {grade}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono font-semibold text-slate-700">{gpa.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>প্রিন্ট করুন</span>
                      </button>

                      <button
                        onClick={() => setShowQrModal(true)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <QrCode size={14} />
                        <span>QR ভেরিফিকেশন</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      * এটি একটি অনলাইন কম্পিউটার জেনারেটেড সাময়িক মার্কশিট।
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertCircle size={26} />
                </div>
                <h4 className="text-base font-bold text-slate-800">কোনো ফলাফল পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  রোল নম্বর অথবা আইডি ও শ্রেণি পরীক্ষা সঠিকভাবে মিলিয়ে আবার সার্চ করুন। কোনো তথ্য না পেলে মাদ্রাসা অফিসের সাথে যোগাযোগ করুন।
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
          <p className="font-semibold text-slate-700">{schoolProfile.nameBn || schoolProfile.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{schoolProfile.address} | হেল্পলাইন: {schoolProfile.phone}</p>
        </div>
      </footer>

      {/* QR Code Verification Modal */}
      {showQrModal && searchedStudent && selectedExam && (
        <VerifiedResultModal
          student={searchedStudent}
          exam={selectedExam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
