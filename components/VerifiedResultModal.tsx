import React, { useRef } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Printer, 
  Download, 
  X, 
  GraduationCap, 
  Award, 
  Calendar, 
  Building, 
  User, 
  Hash, 
  ExternalLink,
  QrCode,
  FileCheck
} from 'lucide-react';
import { Student, Exam, SchoolProfile, Subject, MarkRecord } from '../types';
import { calculateGrade, calculateTotalGPA, formatBanglaNumber, getConsolidatedMark } from '../services/utils';
import { QRCodeSVG } from 'qrcode.react';
import { generateVerificationHash, getVerificationUrl } from './ResultVerificationQR';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface VerifiedResultModalProps {
  student: Student;
  exam: Exam;
  schoolProfile: SchoolProfile;
  subjects: Subject[];
  marks: MarkRecord[];
  exams: Exam[];
  language?: string;
  onClose: () => void;
}

export const VerifiedResultModal: React.FC<VerifiedResultModalProps> = ({
  student,
  exam,
  schoolProfile,
  subjects,
  marks,
  exams,
  language = 'bn',
  onClose
}) => {
  const isBn = language === 'bn';
  const certRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Filter subjects for the student's class
  const classSubjects = subjects
    .filter(s => s.classLevel === student.classLevel && (!s.examIds || s.examIds.length === 0 || s.examIds.includes(exam.id)))
    .sort((a, b) => a.order - b.order);

  // Calculate GPA & Summary
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(
    classSubjects,
    marks,
    student.id,
    exam.id,
    student.group,
    exams
  );

  const verificationHash = generateVerificationHash(student, exam, schoolProfile);
  const verificationUrl = getVerificationUrl(student, exam, schoolProfile);
  const totalFullMarks = classSubjects.reduce((acc, s) => acc + s.fullMarks, 0);
  const verificationTimestamp = new Date().toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleDownloadPDF = async () => {
    if (!certRef.current) return;
    setIsDownloading(true);
    try {
      if (typeof document !== 'undefined' && (document as any).fonts) {
        await (document as any).fonts.ready.catch(() => {});
      }

      const canvas = await html2canvas(certRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: document.documentElement.offsetWidth
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
      pdf.save(`Verified_Result_${student.roll || student.studentId || student.name}_${exam.name}.pdf`);
    } catch (err) {
      console.error('Failed to generate verification PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{isBn ? 'ডিজিটাল ফলাফল যাচাইকরণ সনদ' : 'Official Verified Result Certificate'}</span>
                <span className="bg-emerald-500/30 text-emerald-200 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-400/40">
                  AUTHENTICATED
                </span>
              </h2>
              <p className="text-[11px] text-emerald-100/80">
                {isBn ? 'ইনস্টিটিউশনাল ডাটাবেস দ্বারা যাচাইকৃত ও অনুমোদিত' : 'Live Institutional Verification Record'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors text-xs font-semibold flex items-center gap-1 px-2.5"
              title={isBn ? 'প্রিন্ট করুন' : 'Print Certificate'}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{isBn ? 'প্রিন্ট' : 'Print'}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors text-xs font-semibold flex items-center gap-1 px-2.5 shadow-xs"
              title={isBn ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isDownloading ? (isBn ? 'তৈরি হচ্ছে...' : 'Exporting...') : (isBn ? 'পিডিএফ' : 'PDF')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable Target) */}
        <div className="overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
          <div 
            ref={certRef}
            className="bg-white rounded-xl border-2 border-emerald-700/80 p-6 shadow-sm relative overflow-hidden text-slate-900 font-sans"
          >
            {/* Top Ornamental Ribbon */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700" />
            
            {/* Background Watermark Seal */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <ShieldCheck className="w-80 h-80 text-emerald-950" />
            </div>

            {/* Institution Header */}
            <div className="text-center pb-4 border-b border-slate-200 relative">
              <div className="flex items-center justify-center gap-3 mb-1">
                {schoolProfile.logoUrl ? (
                  <img 
                    src={schoolProfile.logoUrl} 
                    alt="Logo" 
                    className="w-12 h-12 object-contain rounded-full border border-slate-200"
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-sm">
                    🏛️
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {isBn ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
                  </h1>
                  <p className="text-[11px] text-slate-600">
                    {isBn ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}
                  </p>
                </div>
              </div>

              {/* Certificate Title Badge */}
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold mt-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isBn ? 'অনলাইন একাডেমিক ফলাফল সত্যতা যাচাই সনদ' : 'ACADEMIC RESULT AUTHENTICITY CERTIFICATE'}</span>
              </div>
            </div>

            {/* Student & Exam Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4 border-b border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">{isBn ? 'শিক্ষার্থীর নাম' : 'Student Name'}</span>
                <p className="font-bold text-slate-900 text-sm">{isBn ? (student.nameBn || student.name) : student.name}</p>
                {student.fatherName && (
                  <p className="text-[11px] text-slate-600">
                    <span className="text-slate-400">{isBn ? 'পিতা: ' : 'Father: '}</span>
                    {isBn ? (student.fatherNameBn || student.fatherName) : student.fatherName}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">{isBn ? 'আইডি ও রোল' : 'Student ID & Roll'}</span>
                <p className="font-bold text-slate-900">
                  {isBn ? 'আইডি: ' : 'ID: '} 
                  <span className="font-mono">{student.studentId || '—'}</span>
                </p>
                <p className="text-slate-700">
                  {isBn ? 'রোল: ' : 'Roll: '}
                  <span className="font-bold font-mono">{isBn ? formatBanglaNumber(student.roll || '—') : student.roll || '—'}</span>
                </p>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">{isBn ? 'শ্রেণি ও পরীক্ষা' : 'Class & Examination'}</span>
                <p className="font-bold text-slate-900">{student.classLevel}</p>
                <p className="text-emerald-800 font-semibold">
                  {isBn ? (exam.nameBn || exam.name) : exam.name} ({schoolProfile.academicYear || exam.academicYear})
                </p>
              </div>
            </div>

            {/* GPA & Result Summary Cards */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  {isBn ? 'জিপিএ (GPA)' : 'Grade Point (GPA)'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
                  {isBn ? formatBanglaNumber(gpa.toFixed(2)) : gpa.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  {isBn ? 'লেটার গ্রেড' : 'Letter Grade'}
                </span>
                <span className={`text-xl sm:text-2xl font-black font-mono mt-0.5 block ${isFail ? 'text-rose-600' : 'text-slate-900'}`}>
                  {grade}
                </span>
              </div>

              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">
                  {isBn ? 'ফলাফল অবস্থা' : 'Result Status'}
                </span>
                <span className={`text-sm sm:text-base font-bold mt-1 block ${isFail ? 'text-rose-600' : 'text-teal-900'}`}>
                  {isFail ? (isBn ? 'অকৃতকার্য (Fail)' : 'Failed') : (isBn ? 'কৃতকার্য (Passed)' : 'Passed')}
                </span>
              </div>
            </div>

            {/* Marks Breakdown Table */}
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isBn ? 'বিষয়ভিত্তিক প্রাপ্ত নম্বর বিবরণী' : 'Subject-wise Marks Details'}</span>
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-2.5">{isBn ? 'বিষয়' : 'Subject'}</th>
                      <th className="py-2 px-2 text-center">{isBn ? 'পূর্ণমান' : 'Full'}</th>
                      <th className="py-2 px-2 text-center">{isBn ? 'প্রাপ্ত' : 'Obtained'}</th>
                      <th className="py-2 px-2 text-center">{isBn ? 'গ্রেড' : 'Grade'}</th>
                      <th className="py-2 px-2 text-center">{isBn ? 'জিপি' : 'GP'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    {classSubjects.map((sub) => {
                      const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
                      const obtained = markRecord ? markRecord.obtained : 0;
                      let { grade: subGrade, gpa: subGpa } = calculateGrade(obtained, sub.fullMarks);
                      if (markRecord?.isAbsent || obtained < sub.passMarks) {
                        subGrade = 'F';
                        subGpa = 0.0;
                      }

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80">
                          <td className="py-1.5 px-2.5">
                            {isBn ? (sub.nameBn || sub.name) : sub.name}
                            {sub.isOptional && <span className="ml-1 text-[10px] text-slate-400">({isBn ? 'ঐচ্ছিক' : 'Opt'})</span>}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono">{isBn ? formatBanglaNumber(sub.fullMarks) : sub.fullMarks}</td>
                          <td className="py-1.5 px-2 text-center font-bold font-mono">
                            {markRecord?.isAbsent ? (isBn ? 'অনুপস্থিত' : 'Absent') : (isBn ? formatBanglaNumber(obtained) : obtained)}
                          </td>
                          <td className={`py-1.5 px-2 text-center font-bold font-mono ${subGrade === 'F' ? 'text-rose-600' : 'text-slate-900'}`}>
                            {subGrade}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono">{isBn ? formatBanglaNumber(subGpa.toFixed(2)) : subGpa.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/80 font-bold border-t border-slate-200 text-slate-900">
                      <td className="py-2 px-2.5">{isBn ? 'মোট প্রাপ্ত নম্বর' : 'Total Marks'}</td>
                      <td className="py-2 px-2 text-center font-mono">{isBn ? formatBanglaNumber(totalFullMarks) : totalFullMarks}</td>
                      <td className="py-2 px-2 text-center font-black font-mono text-emerald-800">
                        {isBn ? formatBanglaNumber(totalMarks) : totalMarks}
                      </td>
                      <td className="py-2 px-2 text-center font-black font-mono">{grade}</td>
                      <td className="py-2 px-2 text-center font-black font-mono text-emerald-800">
                        {isBn ? formatBanglaNumber(gpa.toFixed(2)) : gpa.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Bottom Verification Seal & Security Hash */}
            <div className="pt-3 border-t-2 border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              {/* Left QR & Hash */}
              <div className="flex items-center gap-3">
                <div className="p-1 bg-white border border-slate-300 rounded shadow-xs">
                  <QRCodeSVG value={verificationUrl} size={54} level="M" />
                </div>
                <div className="text-[10px] space-y-0.5">
                  <span className="font-bold text-emerald-800 flex items-center gap-1 uppercase">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isBn ? 'ডিজিটাল সিকিউরিটি কোড' : 'Digital Verification Hash'}</span>
                  </span>
                  <p className="font-mono font-bold text-slate-800">{verificationHash}</p>
                  <p className="text-slate-500">{isBn ? 'যাচাইয়ের তারিখ: ' : 'Verified on: '}{verificationTimestamp}</p>
                </div>
              </div>

              {/* Right Institutional Seal & Authority Signature */}
              <div className="text-center sm:text-right space-y-1">
                <div className="h-7 flex items-end justify-center sm:justify-end">
                  {schoolProfile.signatureUrl ? (
                    <img 
                      src={schoolProfile.signatureUrl} 
                      alt="Signature" 
                      className="h-7 object-contain" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 italic">Digitally Verified</span>
                  )}
                </div>
                <div className="border-t border-slate-400 pt-1 min-w-[140px]">
                  <p className="font-bold text-slate-900 text-[11px]">
                    {isBn ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'সুপার / প্রধান শিক্ষক') : (schoolProfile.headMasterName || 'Superintendent / Principal')}
                  </p>
                  <p className="text-[9.5px] text-slate-500 font-semibold">{isBn ? 'কর্তৃপক্ষের স্বাক্ষর ও সিল' : 'Authorized Signature'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isBn ? 'এই ফলাফল রেকর্ডটি ডাটাবেসে অক্ষত ও অনুমোদিত রয়েছে' : 'This result record is authentic & recorded'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs transition-colors"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
