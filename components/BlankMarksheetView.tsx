import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Subject, Student, Exam } from '../types';
import { formatNumber, toBengali } from '../services/utils';
import { Button } from './ui/Button';
import { Printer, Download, Eye, FileText, CheckCircle2, Scissors, ArrowLeft, Loader2, LayoutGrid, Columns } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface BlankMarksheetViewProps {
  initialClass?: string;
  initialSubjectId?: string;
  onBack?: () => void;
}

export const BlankMarksheetView: React.FC<BlankMarksheetViewProps> = ({
  initialClass,
  initialSubjectId,
  onBack
}) => {
  const { schoolProfile, classes, subjects, students, exams, language, t } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>(initialClass || classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'ALL');
  const [layoutMode, setLayoutMode] = useState<'auto' | '2_per_page' | '4_per_page'>('auto');
  const [extraBlankRows, setExtraBlankRows] = useState<number>(2);
  const [showDetailedColumns, setShowDetailedColumns] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Selected Exam object
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Filter subjects for the selected class
  const classSubjects = subjects
    .filter(s => s.classLevel === selectedClass)
    .filter(s => {
      if (!selectedExamId) return true;
      if (s.examIds && s.examIds.length > 0) {
        return s.examIds.includes(selectedExamId);
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  // Selected subjects to print (all or specific one)
  const activeSubjectsToRender = selectedSubjectId === 'ALL'
    ? classSubjects
    : classSubjects.filter(s => s.id === selectedSubjectId);

  // Filter active students for selected class and sort by Student ID naturally
  // Students with valid IDs are sorted ascending; students WITHOUT an ID are placed at the bottom
  const classStudents = students
    .filter(s => s.classLevel === selectedClass && s.status === 'Active' && !s.isFormer)
    .sort((a, b) => {
      const idA = (a.studentId || '').trim();
      const idB = (b.studentId || '').trim();

      const hasIdA = idA !== '';
      const hasIdB = idB !== '';

      if (hasIdA && !hasIdB) return -1; // Student with ID comes first
      if (!hasIdA && hasIdB) return 1;  // Student without ID goes to bottom
      if (!hasIdA && !hasIdB) {
        // Both have no ID: sort by roll number or name
        const rollA = a.rollNumber ?? 999999;
        const rollB = b.rollNumber ?? 999999;
        if (rollA !== rollB) return rollA - rollB;
        return (a.name || '').localeCompare(b.name || '');
      }

      return idA.localeCompare(idB, undefined, { numeric: true });
    });

  // Determine effective layout: if auto and student count <= 10, use 4 per page
  const effectiveLayout = layoutMode === 'auto'
    ? (classStudents.length <= 10 ? '4_per_page' : '2_per_page')
    : layoutMode;

  const chunkSize = effectiveLayout === '4_per_page' ? 4 : 2;

  // Group subjects into pages based on chunkSize
  const subjectPages: Subject[][] = [];
  for (let i = 0; i < activeSubjectsToRender.length; i += chunkSize) {
    subjectPages.push(activeSubjectsToRender.slice(i, i + chunkSize));
  }

  // Filter students for a specific subject (taking group into account e.g. Science/General)
  const getStudentsForSubject = (subject: Subject): Student[] => {
    if (!subject.group || subject.group === 'All') {
      return classStudents;
    }
    return classStudents.filter(s => !s.group || s.group === subject.group || s.group === '');
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  // 1-Click Multi-page PDF Download
  const handleDownloadPDF = async () => {
    if (!printContainerRef.current) return;
    setIsGeneratingPdf(true);

    const stage = document.createElement('div');
    stage.id = 'marksheet-pdf-stage';
    stage.style.position = 'fixed';
    stage.style.left = '0';
    stage.style.top = '0';
    stage.style.zIndex = '-99999';
    stage.style.backgroundColor = '#ffffff';
    stage.style.width = '794px'; // Exactly 210mm at 96 DPI
    stage.style.margin = '0';
    stage.style.padding = '0';
    stage.style.boxSizing = 'border-box';
    stage.style.overflow = 'visible';

    try {
      if (typeof document !== 'undefined' && (document as any).fonts) {
        await (document as any).fonts.ready.catch(() => {});
      }

      document.body.appendChild(stage);

      // Clone each A4 page element
      const pages = printContainerRef.current.querySelectorAll('.a4-sheet-page');
      if (pages.length === 0) {
        alert('No marksheets to generate.');
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let idx = 0; idx < pages.length; idx++) {
        const pageEl = pages[idx] as HTMLElement;
        stage.innerHTML = '';
        const clone = pageEl.cloneNode(true) as HTMLElement;
        clone.style.width = '794px';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        clone.style.border = 'none';
        stage.appendChild(clone);

        await new Promise(r => setTimeout(r, 120));

        const canvas = await html2canvas(stage, {
          scale: 2.2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123 // 297mm at 96 DPI
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        if (idx > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const examNameStr = currentExam?.name || 'Exam';
      pdf.save(`Marksheet_${selectedClass.replace(/\s+/g, '_')}_${examNameStr.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Failed to generate marksheet PDF:', error);
      alert('PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে ব্রাউজারের Print অপশন ব্যবহার করুন।');
    } finally {
      if (document.body.contains(stage)) {
        document.body.removeChild(stage);
      }
      setIsGeneratingPdf(false);
    }
  };

  // Render a Single Subject Marksheet Slip (2 per page or 4 per page)
  const renderSingleSlip = (subject: Subject, isCompact: boolean = false) => {
    const studentList = getStudentsForSubject(subject);
    const subNameBn = subject.nameBn || subject.name;
    const subNameEn = subject.name;
    const hasBreakdown = showDetailedColumns && (subject.hasCQ || subject.hasMCQ);

    return (
      <div 
        key={subject.id} 
        className={`w-[48.5%] flex flex-col justify-between bg-white text-black border-2 border-black rounded-xs shadow-none font-bangla print:border-2 print:border-black ${
          isCompact ? 'p-1.5 text-[10px] min-h-[490px]' : 'p-2.5 text-xs min-h-[960px]'
        }`}
        style={{ boxSizing: 'border-box' }}
      >
        <div>
          {/* Slip Header */}
          <div className={`text-center border-b-2 border-black ${isCompact ? 'pb-1 mb-1' : 'pb-1.5 mb-2'}`}>
            <div className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} font-bold text-gray-800 tracking-wide mb-0.5 leading-normal`}>
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
            <h2 className={`${isCompact ? 'text-[13px]' : 'text-base'} font-black uppercase text-black leading-snug`}>
              {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
            </h2>
            <div className={`${isCompact ? 'text-[9.5px]' : 'text-[11px]'} font-bold text-gray-900 mt-0.5 leading-normal`}>
              {language === 'bn' ? (currentExam?.nameBn || currentExam?.name) : currentExam?.name} - {formatNumber(schoolProfile.academicYear, language)}
            </div>
            <div className={`inline-block bg-black text-white px-2 py-0.5 mt-0.5 font-black ${isCompact ? 'text-[9px]' : 'text-[10px]'} tracking-wider rounded-xs uppercase leading-none`}>
              নম্বর ফর্দ
            </div>

            {/* Class, Subject, Full Marks Info */}
            <div className={`grid grid-cols-2 gap-1 ${isCompact ? 'text-[9.5px] mt-1 pt-0.5' : 'text-[11px] mt-1.5 pt-1'} font-bold text-gray-950 border-t border-black text-left`}>
              <div>
                <span className="font-semibold text-gray-700">শ্রেণি: </span>
                <span className="font-black">{language === 'bn' ? (t(`cls_${selectedClass.replace(' ', '')}` as any) || selectedClass) : selectedClass}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-gray-700">পূর্ণমান: </span>
                <span className="font-black">{formatNumber(subject.fullMarks, language)}</span>
                {subject.hasCQ && <span className="text-[9px] ml-1 text-gray-800">(CQ: {formatNumber(subject.cqMarks || 0, language)})</span>}
                {subject.hasMCQ && <span className="text-[9px] ml-1 text-gray-800">(MCQ: {formatNumber(subject.mcqMarks || 0, language)})</span>}
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-gray-700">বিষয়: </span>
                <span className={`font-black ${isCompact ? 'text-[11px]' : 'text-[12px]'}`}>{language === 'bn' ? subNameBn : subNameEn}</span>
                {subject.group && subject.group !== 'All' && (
                  <span className="ml-1 text-[9px] bg-gray-200 px-1 py-0.2 rounded font-bold">
                    ({subject.group})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Student Marks Table with Perfect Vertical and Horizontal Centering */}
          <table className={`w-full border-collapse border-2 border-black font-bangla table-fixed ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
            <thead>
              <tr className={`bg-gray-100 text-black border-b-2 border-black font-extrabold text-center ${isCompact ? 'h-6' : 'h-7'}`}>
                <th className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle ${hasBreakdown ? 'w-[28%]' : 'w-[32%]'}`} style={{ verticalAlign: 'middle' }}>
                  <span className="block leading-normal text-center">আইডি</span>
                </th>
                <th className={`border border-black px-1.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle ${hasBreakdown ? 'w-[42%]' : 'w-[48%]'}`} style={{ verticalAlign: 'middle' }}>
                  <span className="block leading-normal text-center">শিক্ষার্থীর নাম</span>
                </th>
                {hasBreakdown ? (
                  <>
                    {subject.hasCQ && (
                      <th className={`border border-black px-0.5 ${isCompact ? 'py-1 text-[9px]' : 'py-1.5 text-[10px]'} w-[10%] text-center align-middle`} style={{ verticalAlign: 'middle' }}>
                        <span className="block leading-normal text-center">CQ</span>
                      </th>
                    )}
                    {subject.hasMCQ && (
                      <th className={`border border-black px-0.5 ${isCompact ? 'py-1 text-[9px]' : 'py-1.5 text-[10px]'} w-[10%] text-center align-middle`} style={{ verticalAlign: 'middle' }}>
                        <span className="block leading-normal text-center">MCQ</span>
                      </th>
                    )}
                    <th className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} w-[10%] text-center align-middle font-black`} style={{ verticalAlign: 'middle' }}>
                      <span className="block leading-normal text-center">মোট</span>
                    </th>
                  </>
                ) : (
                  <th className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} w-[20%] text-center align-middle font-black`} style={{ verticalAlign: 'middle' }}>
                    <span className="block leading-normal text-center">নম্বর</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {studentList.map((student) => (
                <tr key={student.id} className={`border-b border-black hover:bg-gray-50 ${isCompact ? 'h-6.5' : 'h-7.5'}`}>
                  <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold text-gray-950 font-mono tracking-tight whitespace-nowrap`} style={{ verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center min-h-[16px] leading-normal">
                      {student.studentId?.trim() ? formatNumber(student.studentId.trim(), language) : '-'}
                    </div>
                  </td>
                  <td className={`border border-black px-1.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold text-gray-900`} style={{ verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center min-h-[16px] leading-normal text-center">
                      {language === 'bn' ? (student.nameBn || student.name) : student.name}
                    </div>
                  </td>
                  {hasBreakdown ? (
                    <>
                      {subject.hasCQ && <td className={`border border-black px-0.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle bg-gray-50/40`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]"></span></td>}
                      {subject.hasMCQ && <td className={`border border-black px-0.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle bg-gray-50/40`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]"></span></td>}
                      <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold bg-white`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]"></span></td>
                    </>
                  ) : (
                    <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold bg-white`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]"></span></td>
                  )}
                </tr>
              ))}

              {/* Extra blank rows for manual addition (Exact same height and style as student rows) */}
              {Array.from({ length: extraBlankRows }).map((_, idx) => (
                <tr key={`blank-${idx}`} className={`border-b border-black ${isCompact ? 'h-6.5' : 'h-7.5'}`}>
                  <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle text-gray-400 font-mono`} style={{ verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center min-h-[16px] leading-normal text-gray-300">
                      &nbsp;
                    </div>
                  </td>
                  <td className={`border border-black px-1.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle`} style={{ verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center min-h-[16px] leading-normal">
                      &nbsp;
                    </div>
                  </td>
                  {hasBreakdown ? (
                    <>
                      {subject.hasCQ && <td className={`border border-black px-0.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle bg-gray-50/40`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]">&nbsp;</span></td>}
                      {subject.hasMCQ && <td className={`border border-black px-0.5 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle bg-gray-50/40`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]">&nbsp;</span></td>}
                      <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold bg-white`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]">&nbsp;</span></td>
                    </>
                  ) : (
                    <td className={`border border-black px-1 ${isCompact ? 'py-1' : 'py-1.5'} text-center align-middle font-bold bg-white`} style={{ verticalAlign: 'middle' }}><span className="block min-h-[16px]">&nbsp;</span></td>
                  )}
                </tr>
              ))}

              {studentList.length === 0 && (
                <tr>
                  <td colSpan={hasBreakdown ? 5 : 3} className="border border-black py-6 text-center text-gray-500 font-medium align-middle" style={{ verticalAlign: 'middle' }}>
                    <div className="flex items-center justify-center py-2 leading-normal">
                      এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Signature and Date */}
        <div className={`mt-2 pt-1.5 border-t border-dashed border-black grid grid-cols-2 gap-2 font-bold text-gray-900 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
          <div>
            <div className="border-b border-black w-20 mb-0.5"></div>
            <div className="leading-tight">বিষয় শিক্ষকের স্বাক্ষর</div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="border-b border-black w-16 mb-0.5"></div>
            <div className="leading-tight">তারিখ: ______________</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                title="Back to Subjects"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={22} />
                নম্বর ফর্দ (Blank Mark Sheet for Teachers)
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                শিক্ষকদের হাতে নম্বর বসানোর জন্য ১টি A4 পাতায় ২টি বা ৪টি বিষয়ের ফর্দ প্রিন্ট / PDF ডাউনলোড করুন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              onClick={handlePrint} 
              variant="secondary"
              className="flex items-center gap-1.5 shadow-xs text-xs font-semibold py-2 px-3.5"
            >
              <Printer size={16} />
              সরাসরি প্রিন্ট (Print All)
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={isGeneratingPdf || activeSubjectsToRender.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-semibold py-2 px-4"
            >
              {isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              ১ ক্লিকে PDF ডাউনলোড
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">শ্রেণি (Class)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>
                  {language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষা (Exam)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {language === 'bn' ? (e.nameBn || e.name) : e.name} ({formatNumber(e.academicYear, language)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">লেআউট (Page Layout)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as any)}
            >
              <option value="auto">
                অটো (≤ ১০ জন হলে ৪টি, বেশি হলে ২টি)
              </option>
              <option value="4_per_page">১ পাতায় ৪টি বিষয় (২x২ গ্রিড)</option>
              <option value="2_per_page">১ পাতায় ২টি বিষয় (ডান-বাম)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">বিষয় নির্ধারণ (Subject)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none font-bangla"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              <option value="ALL">সকল বিষয় এক সাথে ({classSubjects.length} টি বিষয়)</option>
              {classSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {language === 'bn' ? (s.nameBn || s.name) : s.name} ({s.fullMarks})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">খালি সারি (Blank Rows)</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={extraBlankRows}
              onChange={(e) => setExtraBlankRows(parseInt(e.target.value))}
            >
              <option value={0}>০টি খালি সারি</option>
              <option value={2}>২টি খালি সারি</option>
              <option value={3}>৩টি খালি সারি</option>
              <option value={5}>৫টি খালি সারি</option>
            </select>
          </div>

          <div className="flex items-center pb-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={showDetailedColumns}
                onChange={(e) => setShowDetailedColumns(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              CQ ও MCQ কলাম
            </label>
          </div>
        </div>

        {/* Quick summary badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
          <span className="font-bold text-blue-700">ℹ️ তথ্য:</span>
          <span>মোট শিক্ষার্থী: <b className="text-slate-900">{formatNumber(classStudents.length, language)} জন</b></span>
          <span>•</span>
          <span>প্রিন্ট হবে: <b className="text-slate-900">{formatNumber(activeSubjectsToRender.length, language)} টি বিষয়</b></span>
          <span>•</span>
          <span>লেআউট: <b className="text-blue-700">{effectiveLayout === '4_per_page' ? '১টি পাতায় ৪টি বিষয়ের ফর্দ (২x২)' : '১টি পাতায় ২টি বিষয়ের ফর্দ (ডান-বাম)'}</b></span>
          <span>•</span>
          <span>মোট A4 পাতা লাগবে: <b className="text-emerald-700">{formatNumber(subjectPages.length, language)} টি</b></span>
        </div>
      </div>

      {/* Marksheet Sheets Container (Print & Preview) */}
      <div ref={printContainerRef} className="print-container space-y-8 print:space-y-0">
        {subjectPages.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-500 border border-slate-200 print:hidden font-bangla">
            এই শ্রেণির জন্য কোনো বিষয় বা শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে বিষয় তালিকায় বিষয় যুক্ত করুন।
          </div>
        ) : effectiveLayout === '4_per_page' ? (
          /* 4-Subjects-Per-A4-Page Layout (2x2 Grid) */
          subjectPages.map((pageChunk, pageIndex) => (
            <div
              key={`page-4-${pageIndex}`}
              className="a4-sheet-page bg-white mx-auto shadow-md print:shadow-none border border-slate-300 print:border-none p-3 mb-8 print:mb-0"
              style={{
                width: '100%',
                maxWidth: '794px',
                minHeight: '1123px',
                boxSizing: 'border-box',
                pageBreakAfter: 'always',
                breakAfter: 'page'
              }}
            >
              {/* Page Number indicator for screen view */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1 pb-1 border-b border-slate-100 print:hidden">
                <span>A4 Page #{pageIndex + 1} of {subjectPages.length}</span>
                <span className="text-emerald-700 font-bold">(৪টি বিষয়ের ২x২ গ্রিড নম্বর ফর্দ)</span>
              </div>

              <div className="flex flex-col justify-between min-h-[1050px] gap-2">
                {/* Top Row: Left & Right */}
                <div className="flex justify-between items-stretch gap-2 flex-1">
                  {pageChunk[0] ? renderSingleSlip(pageChunk[0], true) : <div className="w-[48.5%] border-2 border-dashed border-gray-200 rounded-xs"></div>}
                  
                  {/* Vertical Cutting Line Top */}
                  <div className="flex flex-col items-center justify-between py-2 text-gray-400 select-none w-3">
                    <Scissors size={12} className="transform rotate-90 text-gray-500" />
                    <div className="w-0.5 flex-1 border-r border-dashed border-gray-400 my-1"></div>
                    <Scissors size={12} className="transform rotate-90 text-gray-500" />
                  </div>

                  {pageChunk[1] ? renderSingleSlip(pageChunk[1], true) : <div className="w-[48.5%] border-2 border-dashed border-gray-200 rounded-xs"></div>}
                </div>

                {/* Horizontal Center Cutting Line */}
                <div className="flex items-center justify-between px-4 py-1 text-gray-400 select-none my-0.5">
                  <Scissors size={12} className="text-gray-500" />
                  <div className="flex-1 border-b border-dashed border-gray-400 mx-2"></div>
                  <span className="text-[9px] font-mono tracking-widest uppercase px-2 whitespace-nowrap text-gray-500 font-semibold">
                    ✂ কাটার দাগ (Horizontal Cut Line)
                  </span>
                  <div className="flex-1 border-b border-dashed border-gray-400 mx-2"></div>
                  <Scissors size={12} className="text-gray-500" />
                </div>

                {/* Bottom Row: Left & Right */}
                <div className="flex justify-between items-stretch gap-2 flex-1">
                  {pageChunk[2] ? renderSingleSlip(pageChunk[2], true) : <div className="w-[48.5%] border-2 border-dashed border-gray-200 rounded-xs"></div>}
                  
                  {/* Vertical Cutting Line Bottom */}
                  <div className="flex flex-col items-center justify-between py-2 text-gray-400 select-none w-3">
                    <Scissors size={12} className="transform rotate-90 text-gray-500" />
                    <div className="w-0.5 flex-1 border-r border-dashed border-gray-400 my-1"></div>
                    <Scissors size={12} className="transform rotate-90 text-gray-500" />
                  </div>

                  {pageChunk[3] ? renderSingleSlip(pageChunk[3], true) : <div className="w-[48.5%] border-2 border-dashed border-gray-200 rounded-xs"></div>}
                </div>
              </div>
            </div>
          ))
        ) : (
          /* 2-Subjects-Per-A4-Page Layout (Side by Side) */
          subjectPages.map((pair, pageIndex) => (
            <div
              key={`page-2-${pageIndex}`}
              className="a4-sheet-page bg-white mx-auto shadow-md print:shadow-none border border-slate-300 print:border-none p-4 mb-8 print:mb-0"
              style={{
                width: '100%',
                maxWidth: '794px', // Standard A4 width preview
                minHeight: '1123px', // Standard A4 height
                boxSizing: 'border-box',
                pageBreakAfter: 'always',
                breakAfter: 'page'
              }}
            >
              {/* Page Number indicator for screen view */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-2 pb-1 border-b border-slate-100 print:hidden">
                <span>A4 Page #{pageIndex + 1} of {subjectPages.length}</span>
                <span>(ডান-বাম ২টি বিষয়ের নম্বর ফর্দ)</span>
              </div>

              {/* 2 Slips Side-by-Side with Center Cutting Line */}
              <div className="flex justify-between items-stretch gap-2 relative min-h-[1050px]">
                {/* Left Subject Slip */}
                {renderSingleSlip(pair[0], false)}

                {/* Vertical Cutting Line with Scissor Indicator */}
                <div className="flex flex-col items-center justify-between py-4 text-gray-400 select-none w-4">
                  <Scissors size={14} className="transform rotate-90 text-gray-500" />
                  <div className="w-0.5 flex-1 border-r border-dashed border-gray-400 my-2"></div>
                  <span className="text-[9px] font-mono tracking-widest uppercase transform -rotate-90 py-2 whitespace-nowrap text-gray-500 font-semibold">
                    ✂ কাটার দাগ (Cut Line)
                  </span>
                  <div className="w-0.5 flex-1 border-r border-dashed border-gray-400 my-2"></div>
                  <Scissors size={14} className="transform rotate-90 text-gray-500" />
                </div>

                {/* Right Subject Slip (or empty placeholder if odd count) */}
                {pair[1] ? (
                  renderSingleSlip(pair[1], false)
                ) : (
                  <div className="w-[48.5%] border-2 border-dashed border-gray-300 rounded-xs p-8 flex flex-col items-center justify-center text-center text-gray-400 print:border-none">
                    <FileText size={32} className="opacity-40 mb-2" />
                    <p className="text-xs font-bangla font-medium">খালি পৃষ্ঠা (Blank)</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

