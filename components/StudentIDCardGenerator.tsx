import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Exam } from '../types';
import { formatNumber } from '../services/utils';
import { 
  CreditCard, 
  Printer, 
  Search, 
  Award, 
  Users, 
  Calendar, 
  GraduationCap, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  Phone,
  Droplet,
  User
} from 'lucide-react';
import { Button } from './ui/Button';

type CardDocType = 'id_card' | 'admit_card' | 'testimonial';

export const StudentIDCardGenerator: React.FC = () => {
  const { students, classes, exams, schoolProfile, language } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  const [docType, setDocType] = useState<CardDocType>('id_card');
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all'); // 'all' or specific student id
  const [validUntil, setValidUntil] = useState<string>('December 2026');

  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0];
  }, [exams, selectedExamId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    return (students || [])
      .filter(s => (s.class === selectedClass || s.classLevel === selectedClass) && s.status === 'active' && !s.isFormer)
      .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [students, selectedClass]);

  // Filtered by student search or selection
  const targetStudents = useMemo(() => {
    let list = classStudents;
    if (selectedStudentId !== 'all') {
      list = list.filter(s => s.id === selectedStudentId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.nameBn && s.nameBn.includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        String(s.roll || '').includes(q)
      );
    }
    return list;
  }, [classStudents, selectedStudentId, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Control Panel (Hidden during Print) */}
      <div className="print:hidden space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-500/20">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
              <CreditCard size={16} className="text-amber-400" />
              <span>{language === 'bn' ? 'ডকুমেন্ট ও কার্ড জেনারেটর' : 'Student Cards & Documents'}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              {language === 'bn' ? 'আইডি কার্ড, প্রবেশপত্র ও প্রশংসাপত্র' : 'ID Cards, Admit Cards & Testimonials'}
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              {language === 'bn' 
                ? 'এক ক্লিকেই শিক্ষার্থীদের ডিজিটাল আইডি কার্ড, পরীক্ষার প্রবেশপত্র বা প্রত্যয়নপত্র তৈরি ও প্রিন্ট করুন।'
                : 'Instantly generate and print official student ID cards, exam admit cards, and character certificates.'}
            </p>
          </div>

          <Button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Printer size={16} />
            <span>{language === 'bn' ? 'প্রিন্ট করুন (Print)' : 'Print Documents'}</span>
          </Button>
        </div>

        {/* Toolbar Filters */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          {/* Doc Type Selector */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setDocType('id_card')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                docType === 'id_card' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard size={14} />
              <span>{language === 'bn' ? 'আইডি কার্ড' : 'ID Card'}</span>
            </button>

            <button
              onClick={() => setDocType('admit_card')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                docType === 'admit_card' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award size={14} />
              <span>{language === 'bn' ? 'প্রবেশপত্র (Admit)' : 'Admit Card'}</span>
            </button>

            <button
              onClick={() => setDocType('testimonial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                docType === 'testimonial' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>{language === 'bn' ? 'প্রশংসাপত্র' : 'Testimonial'}</span>
            </button>
          </div>

          {/* Class, Exam & Student Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">
                {language === 'bn' ? 'শ্রেণি:' : 'Class:'}
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudentId('all');
                }}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>
                    {language === 'bn' ? (c.displayName || c.nameBn || c.name) : c.name}
                  </option>
                ))}
              </select>
            </div>

            {docType === 'admit_card' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">
                  {language === 'bn' ? 'পরীক্ষা:' : 'Exam:'}
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {language === 'bn' ? (e.nameBn || e.name) : e.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">
                {language === 'bn' ? 'শিক্ষার্থী:' : 'Student:'}
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 max-w-[200px] truncate"
              >
                <option value="all">
                  {language === 'bn' ? `সকল শিক্ষার্থী (${classStudents.length} জন)` : `All Students (${classStudents.length})`}
                </option>
                {classStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    রোল {s.roll} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Stage */}
      <div ref={printRef} className="space-y-6">
        {targetStudents.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400 print:hidden">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-bold">{language === 'bn' ? 'এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found in this class'}</p>
          </div>
        ) : (
          <>
            {/* TYPE 1: ID CARDS GRID */}
            {docType === 'id_card' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {targetStudents.map(student => (
                  <div 
                    key={student.id} 
                    className="w-full max-w-sm mx-auto bg-white rounded-2xl border-2 border-indigo-900 shadow-md overflow-hidden flex flex-col justify-between relative print:break-inside-avoid print:shadow-none"
                    style={{ minHeight: '320px' }}
                  >
                    {/* ID Card Top Header */}
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 text-center relative border-b-2 border-amber-400">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {schoolProfile.logoUrl ? (
                          <img src={schoolProfile.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-full bg-white p-0.5" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-400 text-indigo-950 font-black flex items-center justify-center text-xs">M</div>
                        )}
                        <h3 className="font-black text-xs leading-tight tracking-tight uppercase max-w-[220px]">
                          {schoolProfile.name}
                        </h3>
                      </div>
                      <p className="text-[9px] text-indigo-200 truncate">{schoolProfile.address}</p>
                      <span className="inline-block px-2 py-0.5 mt-1 rounded-full bg-amber-400 text-indigo-950 text-[9px] font-black uppercase tracking-wider">
                        {language === 'bn' ? 'শিক্ষার্থী পরিচয়পত্র' : 'STUDENT ID CARD'}
                      </span>
                    </div>

                    {/* ID Card Body */}
                    <div className="p-4 flex gap-4 items-center">
                      {/* Avatar */}
                      <div className="w-20 h-24 rounded-xl bg-slate-100 border-2 border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0 overflow-hidden shadow-2xs">
                        <User size={36} className="text-slate-300" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Photo</span>
                      </div>

                      {/* Info Fields */}
                      <div className="flex-1 space-y-1 text-xs text-slate-700">
                        <h4 className="font-black text-sm text-indigo-950 leading-tight">{student.name}</h4>
                        {student.nameBn && <p className="text-[10px] text-slate-500 font-semibold">{student.nameBn}</p>}
                        
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-[11px]">
                          <div><span className="text-slate-400 font-semibold">শ্রেণি:</span> <strong>{student.classLevel}</strong></div>
                          <div><span className="text-slate-400 font-semibold">রোল:</span> <strong className="font-mono text-indigo-700">{student.roll}</strong></div>
                          <div className="col-span-2"><span className="text-slate-400 font-semibold">আইডি:</span> <strong className="font-mono">{student.studentId}</strong></div>
                          {student.bloodGroup && (
                            <div className="col-span-2 flex items-center gap-1 text-rose-600 font-bold">
                              <Droplet size={11} /> <span>রক্তের গ্রুপ: {student.bloodGroup}</span>
                            </div>
                          )}
                          {student.guardianPhone && (
                            <div className="col-span-2 text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                              <Phone size={10} /> {student.guardianPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ID Card Footer & Signature */}
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                      <div>
                        <span>মেয়াদ: <strong>{validUntil}</strong></span>
                      </div>
                      <div className="text-center">
                        <div className="w-16 border-b border-slate-400 pb-0.5 font-bold text-slate-700">
                          {schoolProfile.signatureUrl ? (
                            <img src={schoolProfile.signatureUrl} alt="Sig" className="h-4 mx-auto object-contain" />
                          ) : (
                            'অধ্যক্ষ'
                          )}
                        </div>
                        <span className="text-[8px]">মুহতামিম / অধ্যক্ষ</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TYPE 2: ADMIT CARDS */}
            {docType === 'admit_card' && (
              <div className="space-y-6">
                {targetStudents.map(student => (
                  <div 
                    key={student.id} 
                    className="bg-white rounded-3xl border-2 border-slate-300 p-6 shadow-sm relative print:break-inside-avoid print:border-slate-800"
                  >
                    <div className="text-center pb-4 border-b-2 border-indigo-900">
                      <h2 className="text-lg font-black text-slate-900 uppercase">{schoolProfile.name}</h2>
                      <p className="text-xs text-slate-500">{schoolProfile.address}</p>
                      <div className="inline-block px-3 py-1 mt-2 rounded-xl bg-indigo-900 text-white text-xs font-black uppercase tracking-wider">
                        {selectedExam?.name || 'পরীক্ষার প্রবেশপত্র'} • ADMIT CARD
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 text-xs">
                      <div><span className="text-slate-400 font-semibold">নাম:</span> <strong className="block text-slate-900 text-sm font-bold">{student.name}</strong></div>
                      <div><span className="text-slate-400 font-semibold">শ্রেণি:</span> <strong className="block text-slate-900 font-bold">{student.classLevel}</strong></div>
                      <div><span className="text-slate-400 font-semibold">রোল:</span> <strong className="block text-indigo-700 font-black text-sm font-mono">{student.roll}</strong></div>
                      <div><span className="text-slate-400 font-semibold">আইডি:</span> <strong className="block text-slate-900 font-bold font-mono">{student.studentId}</strong></div>
                    </div>

                    <div className="py-3 text-xs text-slate-600 space-y-1">
                      <p className="font-bold text-slate-800">পরীক্ষার্থীদের সাধারণ নিয়মাবলী:</p>
                      <p className="text-[11px] text-slate-500">১. পরীক্ষা শুরুর কমপক্ষে ১৫ মিনিট পূর্বে পরীক্ষার হলে উপস্থিত হতে হবে।</p>
                      <p className="text-[11px] text-slate-500">২. প্রবেশপত্র ব্যতিরেকে কোনো শিক্ষার্থীকে পরীক্ষায় অংশগ্রহণ করতে দেওয়া হবে না।</p>
                      <p className="text-[11px] text-slate-500">৩. পরীক্ষার হলে মোবাইল ফোন বা কোনো অবৈধ কাগজপত্র আনা সম্পূর্ণ নিষিদ্ধ।</p>
                    </div>

                    <div className="pt-6 flex justify-between items-end text-xs">
                      <div className="text-center">
                        <div className="w-24 border-b border-slate-400 pb-1 font-bold text-slate-600">শ্রেণি শিক্ষক</div>
                        <span className="text-[10px] text-slate-400">স্বাক্ষর</span>
                      </div>
                      <div className="text-center">
                        <div className="w-28 border-b border-slate-400 pb-1 font-bold text-slate-900">
                          {schoolProfile.signatureUrl ? (
                            <img src={schoolProfile.signatureUrl} alt="Sig" className="h-6 mx-auto object-contain" />
                          ) : (
                            'মুহতামিম'
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">মুহতামিম / অধ্যক্ষের স্বাক্ষর</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TYPE 3: TESTIMONIALS / CERTIFICATES */}
            {docType === 'testimonial' && (
              <div className="space-y-8">
                {targetStudents.map(student => (
                  <div 
                    key={student.id} 
                    className="bg-white rounded-3xl border-8 border-double border-amber-600/40 p-8 sm:p-12 shadow-md relative print:break-inside-avoid"
                  >
                    <div className="text-center pb-6 border-b border-slate-200">
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">{schoolProfile.name}</h1>
                      <p className="text-xs text-slate-500 mt-1">{schoolProfile.address}</p>
                      <div className="inline-block px-4 py-1.5 mt-3 rounded-full bg-amber-100 text-amber-900 text-sm font-black border border-amber-300">
                        {language === 'bn' ? 'প্রশংসাপত্র / চরিত্র সনদ' : 'TESTIMONIAL CERTIFICATE'}
                      </div>
                    </div>

                    <div className="py-8 text-sm leading-loose text-slate-800 text-justify font-bangla">
                      এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <strong className="text-indigo-900 text-base">{student.name}</strong>, পিতা: <strong>{student.fatherName || '—'}</strong>, মাতা: <strong>{student.motherName || '—'}</strong>, রোল: <strong>{student.roll}</strong>, শিক্ষার্থী আইডি: <strong>{student.studentId}</strong>, অত্র প্রতিষ্ঠানের <strong>{student.classLevel}</strong> শ্রেণির একজন নিয়মিত শিক্ষার্থী ছিলেন। অত্র মাদ্রাসায় অধ্যয়নকালে তিনি উত্তম চরিত্রের অধিকারী ছিলেন এবং প্রতিষ্ঠানের কোনো নিয়ম-শৃঙ্খলা ভঙ্গ করেননি। 
                      <p className="mt-4">আমি তার ইহলৌকিক ও পরলৌকিক জীবনের সর্বাঙ্গীন উন্নতি ও সাফল্য কামনা করি।</p>
                    </div>

                    <div className="pt-10 flex justify-between items-end text-xs">
                      <div>
                        <p className="text-slate-500">তারিখ: <strong className="text-slate-800 font-mono">{new Date().toLocaleDateString('bn-BD')}</strong></p>
                      </div>
                      <div className="text-center">
                        <div className="w-36 border-b-2 border-slate-700 pb-1">
                          {schoolProfile.signatureUrl ? (
                            <img src={schoolProfile.signatureUrl} alt="Sig" className="h-8 mx-auto object-contain" />
                          ) : (
                            <span className="font-bold text-slate-900">মুহতামিম / অধ্যক্ষ</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">স্বাক্ষর ও প্রাতিষ্ঠানিক সিল</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
