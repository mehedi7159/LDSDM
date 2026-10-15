import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useApp } from '../context/AppContext';
import { calculateGrade, calculateTotalGPA, formatNumber, getAutoRemark, getConsolidatedMark } from '../services/utils';
import { Student, Exam } from '../types';
import { Download, FileText, FileSpreadsheet, User, Users, Loader2, ChevronDown, ShieldCheck, QrCode, MessageSquare } from 'lucide-react';
import { Button } from './ui/Button';
import { ResultVerificationQR } from './ResultVerificationQR';
import { VerifiedResultModal } from './VerifiedResultModal';
import { ResultSmsNotificationModal } from './ResultSmsNotificationModal';

// Declare html2pdf for TypeScript
declare const html2pdf: any;

const getFormattedRemarkWithAttendance = (
  baseRemark: string,
  existingRemark: any,
  language: 'en' | 'bn'
): string => {
  if (!existingRemark || existingRemark.workingDays === undefined || existingRemark.workingDays === null || existingRemark.totalPresent === undefined || existingRemark.totalPresent === null) {
    return baseRemark;
  }
  const workingDays = Number(existingRemark.workingDays);
  const totalPresent = Number(existingRemark.totalPresent);
  if (workingDays <= 0) return baseRemark;

  const attendancePct = (totalPresent / workingDays) * 100;
  if (attendancePct < 75) {
    const warning = language === 'bn'
      ? '(উপস্থিতি সন্তোষজনক নয়, নিয়মিত ক্লাসে উপস্থিতি প্রয়োজন।)'
      : '(Attendance is not up to mark, regular attendance is required.)';
    
    // Guard against repeating warnings
    if (baseRemark.includes('উপস্থিতি') || baseRemark.toLowerCase().includes('attendance')) {
      return baseRemark;
    }
    return baseRemark ? `${baseRemark} ${warning}` : warning;
  }
  return baseRemark;
};

export const MadrasahMonogram: React.FC<{ size?: number; estd?: string; eiin?: string }> = ({ size = 76, estd, eiin }) => (
  <div style={{ width: size, height: size }} className="flex items-center justify-center select-none">
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="47" fill="#ffffff" stroke="#001f3f" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="43.5" fill="none" stroke="#001f3f" strokeWidth="0.75" strokeDasharray="2 1.5" />
      <circle cx="50" cy="50" r="39.5" fill="none" stroke="#001f3f" strokeWidth="1.2" />
      
      <circle cx="16" cy="50" r="2" fill="#001f3f" />
      <circle cx="84" cy="50" r="2" fill="#001f3f" />

      <text x="50" y="22" textAnchor="middle" fontSize="6.8" fontWeight="bold" fill="#001f3f" fontFamily="serif">
        رَبِّ زِدْنِي عِلْمًا
      </text>

      <polygon points="50,45 34,60 38,62 50,50 62,62 66,60" fill="#001f3f" />
      <line x1="30" y1="62" x2="70" y2="62" stroke="#001f3f" strokeWidth="1.5" strokeLinecap="round" />

      <path d="M50 44 C43 38 33 39 28 41 C27 41.5 27 50 28 50 C33 48 43 47 50 51 Z" fill="#ffffff" stroke="#001f3f" strokeWidth="1.2" />
      <path d="M50 44 C57 38 67 39 72 41 C73 41.5 73 50 72 50 C67 48 57 47 50 51 Z" fill="#ffffff" stroke="#001f3f" strokeWidth="1.2" />
      
      <line x1="32" y1="43" x2="45" y2="42" stroke="#001f3f" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="32" y1="46" x2="44" y2="45" stroke="#001f3f" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="55" y1="42" x2="68" y2="43" stroke="#001f3f" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="56" y1="45" x2="68" y2="46" stroke="#001f3f" strokeWidth="0.8" strokeLinecap="round" />

      <line x1="50" y1="26" x2="50" y2="33" stroke="#001f3f" strokeWidth="1" strokeLinecap="round" />
      <line x1="43" y1="28" x2="45" y2="34" stroke="#001f3f" strokeWidth="0.9" strokeLinecap="round" />
      <line x1="57" y1="28" x2="55" y2="34" stroke="#001f3f" strokeWidth="0.9" strokeLinecap="round" />

      <text x="50" y="74" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#001f3f">
        {estd ? `স্থাপিত: ${estd}` : (eiin ? `EIIN: ${eiin}` : 'দাখিল মাদ্রাসা')}
      </text>
      {eiin && estd && (
        <text x="50" y="82" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#333333">
          EIIN: {eiin}
        </text>
      )}
    </svg>
  </div>
);

interface ResultViewProps {
  student: Student;
  exam: Exam;
}

export const TermResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const primaryColor = 'border-[#008080]';
  const bgColor = 'bg-[#f4f9f4]';
  const headerBg = 'bg-[#dceddc]';

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const fontClass = language === 'bn' ? 'font-bangla' : '';

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-[#f4f9f4] mx-auto text-sm leading-tight border-[4px] border-[#008080] p-1.5 w-full max-w-[200mm] h-[285mm] relative print:shadow-none ${fontClass} flex flex-col box-border`}
    >
      <div className="border border-[#008080] h-full w-full p-8 flex flex-col relative flex-grow">
      {/* Watermark */}
      {schoolProfile.showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0 overflow-hidden">
            {schoolProfile.watermarkUrl ? (
                <img src={schoolProfile.watermarkUrl} alt="Watermark" className="max-w-[80%] max-h-[80%] object-contain" />
            ) : (
                <div className="transform -rotate-45 text-9xl font-bold text-gray-900 whitespace-nowrap">
                    {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
                </div>
            )}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8 relative z-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-wide mb-1">{language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}</h1>
        <p className="text-gray-800 text-sm italic mb-4">{language === 'bn' ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}</p>
        <div className="inline-block px-8 pb-1">
            <h2 className="text-xl font-bold italic uppercase tracking-widest underline">{t('academicTranscript')}</h2>
        </div>
      </div>

      {/* Student Info Grid */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-2 mb-6 relative z-10 text-sm text-gray-900">
        <div className="space-y-2">
          <div className="flex"><span className="w-32 font-medium">{t('studentName')}</span><span>: {language === 'bn' ? (student.nameBn || student.name) : student.name}</span></div>
          <div className="flex"><span className="w-32 font-medium">{t('fatherName')}</span><span>: {language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName}</span></div>
          <div className="flex"><span className="w-32 font-medium">{t('studentId')}</span><span>: {student.studentId ? formatNumber(student.studentId, language) : '-'}</span></div>
        </div>
        <div className="space-y-2">
          <div className="flex"><span className="w-32 font-medium">{t('class')}</span><span>: {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span></div>
          <div className="flex"><span className="w-32 font-medium">{t('exam')}</span><span>: {language === 'bn' ? (exam.nameBn || (exam.name === 'Annual Examination' ? 'বার্ষিক পরীক্ষা' : exam.name)) : exam.name}</span></div>
          <div className="flex"><span className="w-32 font-medium">{t('yearSession')}</span><span>: {formatNumber(schoolProfile.academicYear, language)}</span></div>
        </div>
      </div>

      {/* Marks Table */}
      <div className="mb-6 relative z-10">
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className={headerBg + " text-black"}>
              <th className="border border-black px-2 py-3 text-left font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('nameOfSubject')}</div>
              </th>
              <th className="border border-black px-2 py-3 text-center font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('fullMarks')}</div>
              </th>
              <th className="border border-black px-2 py-3 text-center font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('highest')}</div>
              </th>
              <th className="border border-black px-2 py-1 text-center font-medium" colSpan={2}>{t('obtainingMarks')}</th>
              <th className="border border-black px-2 py-3 text-center font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('total')}</div>
              </th>
              <th className="border border-black px-2 py-3 text-center font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('grade')}</div>
              </th>
              <th className="border border-black px-2 py-3 text-center font-medium" rowSpan={2}>
                  <div style={{ position: 'relative', zIndex: 1, display: 'inline-block' }}>{t('gp')}</div>
              </th>
            </tr>
            <tr className={headerBg + " text-black"}>
              <th className="border border-black px-1 py-1 text-center font-medium">{t('cq')}</th>
              <th className="border border-black px-1 py-1 text-center font-medium">{t('mcq')}</th>
            </tr>
          </thead>
          <tbody>
            {classSubjects.map((sub) => {
              const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
              const obtained = markRecord ? markRecord.obtained : 0;
              let { grade, gpa } = calculateGrade(obtained, sub.fullMarks);
              
              const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
              const allMarksForThisSub = allClassStudents
                .map(s => getConsolidatedMark(s.id, sub.id, exam.id, exams, marks))
                .filter(Boolean);
              const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m!.obtained)) : 0;

              const isCQFail = sub.hasCQ && (markRecord?.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0);
              const isMCQFail = sub.hasMCQ && (markRecord?.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0);
              if (markRecord?.isAbsent || isCQFail || isMCQFail || obtained < sub.passMarks) {
                  grade = 'F';
                  gpa = 0.0;
              }

              return (
                <tr key={sub.id} className="font-medium text-gray-900">
                  <td className="border border-black px-3 py-2">{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</td>
                  <td className="border border-black px-3 py-2 text-center">{formatNumber(sub.fullMarks, language)}</td>
                  <td className="border border-black px-3 py-2 text-center">{formatNumber(highest, language)}</td>
                  <td className="border border-black px-3 py-2 text-center">{sub.hasCQ ? (markRecord?.isAbsent ? t('absent') : formatNumber(markRecord?.obtainedCQ ?? 0, language)) : '—'}</td>
                  <td className="border border-black px-3 py-2 text-center">{sub.hasMCQ ? (markRecord?.isAbsent ? t('absent') : formatNumber(markRecord?.obtainedMCQ ?? 0, language)) : '—'}</td>
                  <td className={`border border-black px-3 py-2 text-center ${grade === 'F' ? 'text-red-600' : 'text-black'}`}>{markRecord?.isAbsent ? t('absent') : formatNumber(obtained, language)}</td>
                  <td className={`border border-black px-3 py-2 text-center ${grade === 'F' ? 'text-red-600' : ''}`}>{grade}</td>
                  <td className="border border-black px-3 py-2 text-center">{formatNumber(gpa.toFixed(2), language)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-medium">
            <tr className={headerBg}>
              <td className="border border-black px-3 py-3 text-black">{t('totalExamMarks')}</td>
              <td className="border border-black px-3 py-3 text-center text-black">{formatNumber(classSubjects.reduce((acc, s) => acc + s.fullMarks, 0), language)}</td>
              <td className="border border-black px-3 py-3 text-right text-black" colSpan={2}>{t('obtainedMarksAndGpa')}</td>
              <td className="border border-black px-3 py-3 text-center text-black" colSpan={2}>{formatNumber(totalMarks, language)}</td>
              <td className="border border-black px-3 py-3 text-center" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary and Remarks */}
      <div className="grid grid-cols-3 gap-6 mb-8 relative z-10 flex-grow">
        <div className="col-span-1">
          <table className="w-full border border-black text-xs font-medium bg-[#f4f9f4]">
            <thead>
              <tr className={headerBg + " text-black"}>
                <th className="border border-black px-2 py-1 text-left" colSpan={2}>{t('resultStatus')}<span className="text-red-600 ml-1">{isFail ? t('st_Failed') : t('st_Passed')}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1">{t('position')}</td>
                <td className="border border-black px-2 py-1 text-center">{formatNumber(rank, language)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1">{t('gpaWithout4th')}</td>
                <td className="border border-black px-2 py-1 text-center">{formatNumber(gpa.toFixed(2), language)}</td>
              </tr>
              {failCount > 0 && (
                <tr>
                  <td className="border border-black px-2 py-1">{t('failedSubject')}</td>
                  <td className="border border-black px-2 py-1 text-center text-red-600">{formatNumber(failCount, language)}</td>
                </tr>
              )}
              <tr>
                <td className="border border-black px-2 py-1">{t('workingDays')}</td>
                <td className="border border-black px-2 py-1 text-center">{existingRemark?.workingDays !== undefined ? formatNumber(existingRemark.workingDays, language) : '—'}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1">{t('totalPresent')}</td>
                <td className="border border-black px-2 py-1 text-center">{existingRemark?.totalPresent !== undefined ? formatNumber(existingRemark.totalPresent, language) : '—'}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1">{t('totalAbsent')}</td>
                <td className="border border-black px-2 py-1 text-center">{existingRemark?.totalAbsent !== undefined ? formatNumber(existingRemark.totalAbsent, language) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-span-2">
          <div className="h-full">
            <span className="font-medium text-gray-900">{t('comments')}:</span>
            <span className="italic text-gray-800 ml-2">{displayRemark}</span>
          </div>
        </div>
      </div>

      {/* Footer Signatures & QR Verification */}
      <div className="mt-auto pt-8 relative z-10">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col items-start">
            {schoolProfile.showGuardianSignature !== false && (
              <div className="w-36 sm:w-44 border-t border-black pt-1.5 text-left">
                <p className="font-medium text-xs text-gray-900">{t('guardianSignature')}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center">
            <ResultVerificationQR
              student={student}
              exam={exam}
              schoolProfile={schoolProfile}
              language={language}
              size={50}
              onOpenVerification={() => setShowVerifyModal(true)}
            />
          </div>

          <div className="flex flex-col items-end">
            {schoolProfile.showHeadmasterSignature !== false && (
              <>
                <div className="h-10 flex items-end justify-center mb-1">
                  {schoolProfile.signatureUrl && <img src={schoolProfile.signatureUrl} alt="Signature" className="h-9 object-contain" referrerPolicy="no-referrer" />}
                </div>
                <div className="w-36 sm:w-44 border-t border-black pt-1.5 text-right">
                  <p className="font-medium text-xs text-gray-900">{language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName) : schoolProfile.headMasterName}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showVerifyModal && (
        <VerifiedResultModal
          student={student}
          exam={exam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
      </div>
    </div>
  );
};

export const BWTermResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const numRank = Number(rank);
  const rankStr = numRank === 1 ? '1st' : numRank === 2 ? '2nd' : numRank === 3 ? '3rd' : numRank + 'th';
  const average = classSubjects.length > 0 ? (totalMarks / classSubjects.length).toFixed(1) : '0';

  const fontClass = language === 'bn' ? 'font-bangla' : '';
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-white mx-auto text-sm leading-tight border-[1.5px] border-black p-1 w-full max-w-[200mm] ${isCompact ? 'h-[140mm]' : 'h-[285mm]'} relative print:shadow-none ${fontClass} flex flex-col box-border`}
    >
      <div className={`border border-black h-full w-full ${isCompact ? 'p-3' : 'p-6'} flex flex-col relative flex-grow overflow-hidden`}>
        {/* Header Section */}
        <div className={`flex justify-center items-center ${isCompact ? 'mb-2' : 'mb-4'}`}>
          <div className="text-center px-2">
            <h1 className={`${isCompact ? 'text-lg' : 'text-2xl'} font-bold font-serif mb-1`}>{language === 'bn' ? schoolProfile.nameBn || schoolProfile.name : schoolProfile.name}</h1>
            {!isCompact && (
              <p className="text-[9px] sm:text-[10px] mt-1 text-gray-800">
                {(language === 'bn' ? schoolProfile.addressBn || schoolProfile.address : schoolProfile.address)} {schoolProfile.eiin ? `| EIIN: ${formatNumber(schoolProfile.eiin, language)}` : ''} {schoolProfile.phone ? `| ${t('phone')}: ${formatNumber(schoolProfile.phone, language)}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Report Card Title */}
        <div className={`w-full border-2 border-black p-0.5 ${isCompact ? 'mb-3' : 'mb-6'}`}>
          <div className={`border border-black text-center ${isCompact ? 'py-1' : 'py-2'}`}>
            <h2 className={`${isCompact ? 'text-sm' : 'text-lg'} ${language === 'bn' ? 'tracking-normal font-bangla' : (isCompact ? 'tracking-wide' : 'tracking-[0.2em]')} font-bold font-serif uppercase`}>{t('academicProgressReportCard')}</h2>
          </div>
        </div>

        {/* Student Info */}
        <div className={`grid grid-cols-[1.5fr_1fr] gap-x-6 ${isCompact ? 'gap-y-1 mb-3 text-[11px]' : 'gap-y-2 mb-4 gap-x-8 text-[12.5px]'}`}>
          <div className="flex items-center border-b border-dashed border-gray-400 pb-1">
            <span className="font-semibold w-24 shrink-0 flex justify-between pr-2">
              <span>{t('studentName')}</span>
              <span>:</span>
            </span>
            <span className="flex-grow font-bold uppercase">{language === 'bn' ? (student.nameBn || student.name) : student.name}</span>
          </div>
          <div className="flex items-center border-b border-dashed border-gray-400 pb-1">
            <span className="font-semibold w-20 shrink-0 flex justify-between pr-2">
              <span>{t('class')}</span>
              <span>:</span>
            </span>
            <span className="flex-grow font-semibold">{language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span>
          </div>
          <div className="flex items-center border-b border-dashed border-gray-400 pb-1">
            <span className="font-semibold w-24 shrink-0 flex justify-between pr-2">
              <span>{t('fatherName')}</span>
              <span>:</span>
            </span>
            <span className="flex-grow">{language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName}</span>
          </div>
          <div className="flex items-center border-b border-dashed border-gray-400 pb-1">
            <span className="font-semibold w-20 shrink-0 flex justify-between pr-2">
              <span>{t('rollNo')}</span>
              <span>:</span>
            </span>
            <span className="flex-grow font-bold font-mono">{student.studentId ? formatNumber(student.studentId, language) : '-'}</span>
          </div>
          <div className="flex items-center border-b border-dashed border-gray-400 pb-1 col-span-2">
            <span className="font-semibold w-24 shrink-0 flex justify-between pr-2">
              <span>{t('exam')}</span>
              <span>:</span>
            </span>
            <span className="flex-grow font-bold">{language === 'bn' ? (exam.nameBn || exam.name) : exam.name}</span>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="flex-grow relative z-10 mb-6">
          <table className="w-full border-collapse text-left border border-black table-auto">
            <thead>
              <tr className="bg-gray-100 text-black font-bold border-b-2 border-black">
                <th className="border border-black px-2 py-2 text-center w-10">{t('sn')}</th>
                <th className="border border-black px-2 py-2">{t('subjectName')}</th>
                <th className="border border-black px-2 py-2 text-center w-20">{t('fullMarks')}</th>
                <th className="border border-black px-2 py-2 text-center w-16">{t('highest')}</th>
                <th className="border border-black px-2 py-2 text-center w-16">{language === 'bn' ? 'প্রাপ্ত নম্বর' : 'Number'}</th>
                <th className="border border-black px-2 py-2 text-center w-16">{t('grade')}</th>
                <th className="border border-black px-2 py-2 text-center w-16">{t('gpa')}</th>
                <th className="border border-black px-2 py-2 text-center w-20">{t('remark')}</th>
              </tr>
            </thead>
            <tbody>
              {classSubjects.map((sub, index) => {
                const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
                const obtained = markRecord && !markRecord.isAbsent ? (markRecord.obtained || 0) : 0;
                
                const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
                const allMarksForThisSub = allClassStudents
                  .map(s => getConsolidatedMark(s.id, sub.id, exam.id, exams, marks))
                  .filter(m => m && !m.isAbsent);
                const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m!.obtained)) : 0;

                let gradeObj: any = { grade: '', gpa: 0 };
                
                if (markRecord && !markRecord.isAbsent) {
                   gradeObj = calculateGrade(obtained, sub.fullMarks);
                } else if (markRecord?.isAbsent) {
                   gradeObj = { grade: 'F', gpa: 0 };
                } else {
                   gradeObj = { grade: '-', gpa: 0 };
                }

                // Check fail status for components
                let totalFail = false;
                if (markRecord && !markRecord.isAbsent && obtained < sub.passMarks) totalFail = true;
                if (sub.hasCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedCQ || 0) < (sub.cqPassMarks || 0)) { totalFail = true; }
                if (sub.hasMCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedMCQ || 0) < (sub.mcqPassMarks || 0)) { totalFail = true; }
                if (totalFail) {
                   gradeObj = { grade: 'F', gpa: 0 };
                }
                const grade = gradeObj.grade || '-';
                const point = gradeObj.gpa || 0;
                const isF = grade === 'F';

                return (
                  <tr key={sub.id}>
                    <td className="border border-black px-2 py-1.5 text-center">{formatNumber(index + 1, language)}</td>
                    <td className="border border-black px-2 py-1.5">{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</td>
                    <td className="border border-black px-2 py-1.5 text-center">{formatNumber(sub.fullMarks, language)}</td>
                    <td className="border border-black px-2 py-1.5 text-center">{formatNumber(highest, language)}</td>
                    <td className={`border border-black px-2 py-1.5 text-center ${isF ? 'text-red-600 font-bold' : ''}`}>{markRecord?.isAbsent ? t('absent') : formatNumber(obtained, language)}</td>
                    <td className={`border border-black px-2 py-1.5 text-center ${grade === 'A+' ? 'font-bold' : ''} ${isF ? 'text-red-600 font-bold' : ''}`}>{grade}</td>
                    <td className={`border border-black px-2 py-1.5 text-center ${isF ? 'text-red-600 font-bold' : ''}`}>{grade !== '-' ? formatNumber(point.toFixed(2), language) : '-'}</td>
                    <td className="border border-black px-2 py-1.5 text-center text-[11px]">
                       {grade === 'A+' ? t('excellent') : grade === 'A' || grade === 'A-' ? t('good') : grade === 'F' ? t('failShort') : t('averageShort')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Box */}
        <div className="w-full border-t border-b border-black py-1.5 mb-4">
          <div className="flex justify-between items-center text-center">
             <div className="flex-1 border-r border-black flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('totalMarks')}</div>
                <div className="text-[17px] font-bold font-serif">{formatNumber(totalMarks, language)}</div>
             </div>
             <div className="flex-1 border-r border-black flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('average')}</div>
                <div className="text-[17px] font-bold font-serif">{formatNumber(average, language)}</div>
             </div>
             <div className="flex-1 border-r border-black flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('gpa')}</div>
                <div className="text-[17px] font-bold font-serif">{formatNumber(gpa.toFixed(2), language)}</div>
             </div>
             <div className="flex-1 border-r border-black flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('grade')}</div>
                <div className="text-[17px] font-bold font-serif">{grade}</div>
             </div>
             <div className="flex-1 border-r border-black flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('result')}</div>
                <div className="text-[17px] font-bold font-serif uppercase">{isFail ? t('st_Failed') : t('st_Passed')}</div>
             </div>
             <div className="flex-1 flex flex-col justify-center">
                <div className="text-[11px] text-gray-600 mb-1">{t('position')}</div>
                <div className="text-[17px] font-bold font-serif">{isFail ? '—' : formatNumber(rank, language)}</div>
             </div>
          </div>
        </div>

        {/* Comments and Attendance */}
        <div className={`w-full ${isCompact ? 'text-[13px] mb-3' : 'text-[15px] mb-6'} leading-relaxed font-bangla`}>
           <p className="mb-2.5 border-b border-black pb-2">
             <span className="font-bold text-black">{t('comments')}:</span>{' '}
             <span className="font-semibold text-gray-900 ml-1">{displayRemark}</span>
           </p>
           <div className="flex justify-between items-center border border-black p-2.5 mt-2 bg-gray-50/50 rounded-sm font-bold text-black text-[12px]">
             <span><span className="font-bold">{t('workingDays')}:</span> <span className="ml-1 bg-white border border-black px-2 py-0.5 rounded shadow-sm">{existingRemark?.workingDays !== undefined ? formatNumber(existingRemark.workingDays, language) : '—'}</span></span>
             <span><span className="font-bold">{t('totalPresent')}:</span> <span className="ml-1 bg-white border border-black px-2 py-0.5 rounded shadow-sm">{existingRemark?.totalPresent !== undefined ? formatNumber(existingRemark.totalPresent, language) : '—'}</span></span>
             <span><span className="font-bold">{t('totalAbsent')}:</span> <span className="ml-1 bg-white border border-black px-2 py-0.5 rounded shadow-sm">{existingRemark?.totalAbsent !== undefined ? formatNumber(existingRemark.totalAbsent, language) : '—'}</span></span>
           </div>
        </div>

        {/* Signatures & Verification */}
        <div className="flex justify-between items-end mt-auto text-xs pb-1 select-none gap-2">
           {schoolProfile.showGuardianSignature !== false ? (
             <div className="w-32 text-center flex flex-col items-center">
               <div className="h-8 w-full" />
               <div className="w-full border-t-[1.5px] border-black pt-1 font-bold" style={{ borderTop: '1.5px solid #000000' }}>{t('guardian')}</div>
             </div>
           ) : <div className="w-32"></div>}
           {schoolProfile.showClassTeacherSignature !== false ? (
             <div className="w-32 text-center flex flex-col items-center">
               <div className="h-8 w-full" />
               <div className="w-full border-t-[1.5px] border-black pt-1 font-bold" style={{ borderTop: '1.5px solid #000000' }}>{t('classTeacher')}</div>
             </div>
           ) : <div className="w-32"></div>}
           
           <div className="flex items-center justify-center px-1">
             <ResultVerificationQR
               student={student}
               exam={exam}
               schoolProfile={schoolProfile}
               language={language}
               size={46}
               onOpenVerification={() => setShowVerifyModal(true)}
             />
           </div>

           {schoolProfile.showHeadmasterSignature !== false ? (
             <div className="w-40 text-center flex flex-col items-center">
               <div className="h-8 flex items-center justify-center relative w-full">
                 {schoolProfile.signatureUrl && (
                   <img src={schoolProfile.signatureUrl} className="h-7 object-contain" alt="Signature" referrerPolicy="no-referrer" />
                 )}
               </div>
               <div className="w-full border-t-[1.5px] border-black pt-1" style={{ borderTop: '1.5px solid #000000' }}>
                 <div className="font-bold text-[11px]">{language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'প্রধান শিক্ষক') : (schoolProfile.headMasterName || 'Headmaster')}</div>
                 <div className="text-[9px] text-gray-700 uppercase font-semibold">{t('headMaster')}</div>
               </div>
             </div>
           ) : <div className="w-40"></div>}
        </div>

        {showVerifyModal && (
          <VerifiedResultModal
            student={student}
            exam={exam}
            schoolProfile={schoolProfile}
            subjects={subjects}
            marks={marks}
            exams={exams}
            language={language}
            onClose={() => setShowVerifyModal(false)}
          />
        )}

      </div>
    </div>
  );
};

export const PremiumDakhilResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const numRank = Number(rank);
  const rankStr = numRank === 1 ? '1st' : numRank === 2 ? '2nd' : numRank === 3 ? '3rd' : numRank + 'th';
  const average = classSubjects.length > 0 ? (totalMarks / classSubjects.length).toFixed(1) : '0';

  const fontClass = language === 'bn' ? 'font-bangla' : '';
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');
  const subjectCount = classSubjects.length;

  // Dynamic vertical scaling to ensure full 1-page fit on standard A4 (297mm) even with 15+ subjects
  const isDense = subjectCount >= 14;
  const isMediumDense = subjectCount >= 10 && subjectCount < 14;

  const innerPad = isCompact ? 'p-2' : isDense ? 'p-2.5' : isMediumDense ? 'p-3' : 'p-3.5';
  const tablePadding = isDense ? 'py-0.5 px-1.5' : isMediumDense ? 'py-1 px-2' : 'py-1.5 px-2';
  const tableFontSize = isDense ? 'text-[10.5px]' : isMediumDense ? 'text-[11px]' : 'text-[11.5px]';
  const headerMb = isDense ? 'mb-1 pb-1 min-h-[82px]' : isMediumDense ? 'mb-1.5 pb-1 min-h-[88px]' : 'mb-2 pb-1.5 min-h-[94px]';
  const sectionGap = isDense ? 'mb-1' : isMediumDense ? 'mb-1.5' : 'mb-2';
  const sigH = isDense ? 'h-6' : isMediumDense ? 'h-7' : 'h-8';

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-white mx-auto text-[12px] leading-normal border-[3px] border-black p-1 w-full max-w-[200mm] ${isCompact ? 'h-[141mm]' : 'h-[285mm]'} relative print:shadow-none ${fontClass} flex flex-col box-border`}
    >
      <div className={`border-[1.5px] border-black h-full w-full ${innerPad} flex flex-col justify-between relative overflow-hidden`}>
        
        {/* Top Content Area */}
        <div className="flex flex-col w-full">
          {/* Header Section: Logo/Monogram on Left, Centered Title + Bismillah, and Grading Scale on Right */}
          <div className={`relative w-full ${headerMb} select-none border-b-2 border-black flex items-center justify-between`}>
            {/* Left logo / official monogram */}
            <div className="w-[130px] shrink-0 flex items-center justify-start">
              {schoolProfile.showLogoOnCard !== false ? (
                <div className={`flex flex-col items-center justify-center ${isDense ? 'h-16 w-16' : 'h-18 w-18'} border border-black rounded-full bg-white p-0.5`}>
                  {schoolProfile.logoUrl ? (
                    <img src={schoolProfile.logoUrl} className={`${isDense ? 'h-14 w-14' : 'h-16 w-16'} object-contain`} alt="School Logo" referrerPolicy="no-referrer" />
                  ) : (
                    <MadrasahMonogram 
                      size={isDense ? 58 : 68} 
                      estd={schoolProfile.established ? formatNumber(schoolProfile.established, language) : undefined} 
                      eiin={schoolProfile.eiin ? formatNumber(schoolProfile.eiin, language) : undefined} 
                    />
                  )}
                </div>
              ) : (
                <div className="w-[130px]" />
              )}
            </div>

            {/* Centered School info */}
            <div className="text-center flex-grow px-1 flex flex-col items-center justify-center">
              <span className="text-[12px] font-extrabold text-[#001f3f] tracking-wider mb-0.5 block">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
              <h1 className={`${isDense ? 'text-lg' : 'text-xl'} font-black text-black tracking-tight font-serif uppercase leading-tight`}>
                {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
              </h1>
              {schoolProfile.name && schoolProfile.nameBn && schoolProfile.name.trim() !== schoolProfile.nameBn.trim() && (
                <p className="text-[11px] text-gray-900 font-bold leading-normal">
                  {language === 'bn' ? schoolProfile.name : schoolProfile.nameBn}
                </p>
              )}
              <p className="text-[10px] text-gray-900 font-semibold leading-normal mt-0.5 max-w-[340px]">
                {language === 'bn' ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}
              </p>
              <div className="flex justify-center items-center flex-wrap gap-x-2 text-[9.5px] text-gray-900 mt-0.5 font-bold">
                {schoolProfile.eiin && <span>EIIN: {formatNumber(schoolProfile.eiin, language)}</span>}
                {schoolProfile.eiin && schoolProfile.phone && <span className="opacity-40">|</span>}
                {schoolProfile.phone && <span>{language === 'bn' ? 'ফোন' : 'Phone'}: {formatNumber(schoolProfile.phone, language)}</span>}
                {(schoolProfile.eiin || schoolProfile.phone) && schoolProfile.established && <span className="opacity-40">|</span>}
                {schoolProfile.established && <span>{language === 'bn' ? 'স্থাপিত' : 'Estd'}: {formatNumber(schoolProfile.established, language)}</span>}
              </div>
            </div>

            {/* Official Grading Scale Box on the right */}
            <div className={`border border-black p-0.5 bg-white text-[7.5px] leading-tight font-mono select-none w-[130px] shrink-0`}>
              <div className="text-center font-black border-b border-black pb-0.5 mb-0.5 text-[8px] text-black">
                {language === 'bn' ? 'গ্রেডিং তালিকা' : 'GRADING SYSTEM'}
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-black/20">
                    <td className="font-bold text-black text-left pl-0.5">{formatNumber('80', language)}%-{formatNumber('100', language)}%</td>
                    <td className="font-bold text-black text-center">A+</td>
                    <td className="font-bold text-black text-right pr-0.5">{formatNumber('5.00', language)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('70', language)}%-{formatNumber('79', language)}%</td>
                    <td className="font-medium text-black text-center">A</td>
                    <td className="font-medium text-black text-right pr-0.5">{formatNumber('4.00', language)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('60', language)}%-{formatNumber('69', language)}%</td>
                    <td className="font-medium text-black text-center">A-</td>
                    <td className="font-medium text-black text-right pr-0.5">{formatNumber('3.50', language)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('50', language)}%-{formatNumber('59', language)}%</td>
                    <td className="font-medium text-black text-center">B</td>
                    <td className="font-medium text-black text-right pr-0.5">{formatNumber('3.00', language)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('40', language)}%-{formatNumber('49', language)}%</td>
                    <td className="font-medium text-black text-center">C</td>
                    <td className="font-medium text-black text-right pr-0.5">{formatNumber('2.00', language)}</td>
                  </tr>
                  <tr className="border-b border-black/20">
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('33', language)}%-{formatNumber('39', language)}%</td>
                    <td className="font-medium text-black text-center">D</td>
                    <td className="font-medium text-black text-right pr-0.5">{formatNumber('1.00', language)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium text-black text-left pl-0.5">{formatNumber('00', language)}%-{formatNumber('32', language)}%</td>
                    <td className="font-bold text-red-700 text-center">F</td>
                    <td className="text-red-700 font-bold text-right pr-0.5">{formatNumber('0.00', language)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Transcript Title */}
          <div className={`w-full border-y-2 border-black py-0.5 text-center ${sectionGap} bg-gray-50/50`}>
            <h2 className="text-[13px] font-black tracking-wider text-[#001f3f]">
              {language === 'bn' ? 'একাডেমিক ট্রান্সক্রিপ্ট (পরীক্ষার প্রগতিপত্র)' : 'ACADEMIC PROGRESS REPORT CARD'}
            </h2>
          </div>

          {/* Student Details Table with Dedicated Cells for Label, Colon, and Value */}
          <table className={`w-full border-collapse border-[1.5px] border-black table-fixed text-[11px] ${sectionGap} bg-white select-none`}>
            <tbody>
              {/* Row 1: Student Name & Class */}
              <tr className="border-b border-black">
                <td className="w-1/2 border-r border-black p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-black text-black uppercase overflow-hidden whitespace-nowrap text-ellipsis">
                      {language === 'bn' ? (student.nameBn || student.name) : student.name}
                    </span>
                  </div>
                </td>
                <td className="w-1/2 p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'শ্রেণি' : 'Class'}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-bold text-black overflow-hidden whitespace-nowrap text-ellipsis">
                      {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}
                      {student.group ? ` (${student.group === 'Science' ? 'বিজ্ঞান' : student.group === 'General' ? 'সাধারণ' : student.group})` : ''}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 2: Father's Name & Roll No */}
              <tr className="border-b border-black">
                <td className="w-1/2 border-r border-black p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'পিতার নাম' : "Father's Name"}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-semibold text-black overflow-hidden whitespace-nowrap text-ellipsis">
                      {(language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName) || '—'}
                    </span>
                  </div>
                </td>
                <td className="w-1/2 p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'রোল নং' : 'Roll No'}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-black text-black font-mono text-[11.5px]">
                      {student.studentId ? formatNumber(student.studentId, language) : '—'}
                    </span>
                  </div>
                </td>
              </tr>

              {/* Row 3: Academic Year & Exam */}
              <tr>
                <td className="w-1/2 border-r border-black p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'শিক্ষা বর্ষ' : 'Academic Year'}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-bold text-black font-mono">{formatNumber(schoolProfile.academicYear, language)}</span>
                  </div>
                </td>
                <td className="w-1/2 p-0">
                  <div className="flex items-center px-2 py-1">
                    <span className="font-bold text-gray-800 w-[78px] shrink-0 text-left">
                      {language === 'bn' ? 'পরীক্ষা' : 'Exam'}
                    </span>
                    <span className="font-bold text-gray-800 w-3 shrink-0 text-center mr-1.5">:</span>
                    <span className="font-bold text-black overflow-hidden whitespace-nowrap text-ellipsis">
                      {language === 'bn' ? (exam.nameBn || exam.name) : exam.name}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Main Transcript Table */}
          <div className={`relative z-10 ${sectionGap} overflow-hidden`}>
            {schoolProfile.showWatermark && (
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none z-0">
                {schoolProfile.logoUrl ? (
                  <img src={schoolProfile.logoUrl} className="w-72 h-72 object-contain" alt="Watermark Logo" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-center font-serif text-black border-4 border-dashed border-black p-8 rounded-full text-4xl font-extrabold rotate-[15deg]">
                    {schoolProfile.name.substring(0, 15)}
                  </div>
                )}
              </div>
            )}

            <table className={`w-full border-collapse text-left border-2 border-black table-fixed relative z-10 ${tableFontSize} leading-tight`}>
              <thead>
                <tr className="bg-gray-100 text-black font-extrabold border-b-[2px] border-black select-none">
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[6%]">
                    {language === 'bn' ? 'ক্রমিক' : 'SL'}
                  </th>
                  <th className="border border-black px-2.5 py-1.5 text-left align-middle w-[36%]">
                    {language === 'bn' ? 'বিষয়' : 'SUBJECT'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[10%]">
                    {language === 'bn' ? 'পূর্ণমান' : 'FULL'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[10%]">
                    {language === 'bn' ? 'পাস নম্বর' : 'PASS'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[10%] text-[#001f3f]">
                    {language === 'bn' ? 'সর্বোচ্চ' : 'HIGHEST'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[12%]">
                    {language === 'bn' ? 'প্রাপ্ত নম্বর' : 'OBTAINED'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[8%]">
                    {language === 'bn' ? 'গ্রেড' : 'GRADE'}
                  </th>
                  <th className="border border-black px-1 py-1.5 text-center align-middle w-[8%]">
                    {language === 'bn' ? 'পয়েন্ট' : 'POINT'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {classSubjects.map((sub, index) => {
                  const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
                  const obtained = markRecord && !markRecord.isAbsent ? (markRecord.obtained || 0) : 0;
                  
                  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
                  const allMarksForThisSub = allClassStudents
                     .map(s => getConsolidatedMark(s.id, sub.id, exam.id, exams, marks))
                     .filter(m => m && !m.isAbsent);
                  const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m!.obtained)) : 0;

                  let gradeObj: any = { grade: '', gpa: 0 };
                  
                  if (markRecord && !markRecord.isAbsent) {
                     gradeObj = calculateGrade(obtained, sub.fullMarks);
                  } else if (markRecord?.isAbsent) {
                     gradeObj = { grade: 'F', gpa: 0 };
                  } else {
                     gradeObj = { grade: '-', gpa: 0 };
                  }

                  // Check fail status
                  let totalFail = false;
                  if (markRecord && !markRecord.isAbsent && obtained < sub.passMarks) totalFail = true;
                  if (sub.hasCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedCQ || 0) < (sub.cqPassMarks || 0)) { totalFail = true; }
                  if (sub.hasMCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedMCQ || 0) < (sub.mcqPassMarks || 0)) { totalFail = true; }
                  if (totalFail) {
                     gradeObj = { grade: 'F', gpa: 0 };
                  }
                  const grade = gradeObj.grade || '-';
                  const point = gradeObj.gpa || 0;
                  const isF = grade === 'F';

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50">
                      <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold`}>{formatNumber(index + 1, language)}</td>
                      <td className={`border border-black ${tablePadding} px-2.5 text-left align-middle font-bold text-black overflow-hidden whitespace-nowrap text-ellipsis`}>
                        {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                        {sub.isOptional && <span className="text-[9px] text-teal-700 font-extrabold ml-1">({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span>}
                      </td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-mono`}>{formatNumber(sub.fullMarks, language)}</td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-mono text-gray-700`}>{formatNumber(sub.passMarks, language)}</td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold text-[#001f3f] bg-slate-50/30`}>{formatNumber(highest, language)}</td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-black font-mono ${isF ? 'text-red-700 font-black bg-red-50/40' : 'text-black'}`}>
                        {markRecord?.isAbsent ? (language === 'bn' ? 'অনুপস্থিত' : 'Absent') : formatNumber(obtained, language)}
                      </td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-black ${grade === 'A+' ? 'text-green-800' : ''} ${isF ? 'text-red-700' : ''}`}>{grade}</td>
                      <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold ${isF ? 'text-red-700' : ''}`}>{grade !== '-' ? formatNumber(point.toFixed(2), language) : '-'}</td>
                    </tr>
                  );
                })}
                {/* Grand Total Row */}
                <tr className="bg-gray-100 font-extrabold border-t-2 border-black select-none">
                  <td colSpan={2} className={`border border-black ${tablePadding} text-center align-middle font-black text-black`}>
                    {language === 'bn' ? 'সর্বমোট / ফলাফল' : 'GRAND TOTAL / RESULT'}
                  </td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold`}>
                    {formatNumber(classSubjects.reduce((acc, s) => acc + s.fullMarks, 0), language)}
                  </td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold text-gray-700`}>
                    —
                  </td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold text-[#001f3f]`}>—</td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-black ${isFail ? 'text-red-700' : 'text-black'}`}>
                    {formatNumber(totalMarks, language)}
                  </td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-black ${isFail ? 'text-red-700' : 'text-green-800'}`}>
                    {grade}
                  </td>
                  <td className={`border border-black ${tablePadding} text-center align-middle font-mono font-bold ${isFail ? 'text-red-700' : 'text-black'}`}>
                    {formatNumber(gpa.toFixed(2), language)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Results Overview Ribbons */}
          <div className={`grid grid-cols-[3fr_2fr] gap-2 ${sectionGap} select-none`}>
            
            {/* Main Grade Details / Position */}
            <div className="border border-black p-1.5 rounded-sm bg-gray-50/40 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-1 text-center divide-x divide-black">
                <div>
                  <div className="text-[9px] uppercase font-black text-gray-800">
                    {language === 'bn' ? 'মোট নম্বর' : 'TOTAL MARKS'}
                  </div>
                  <div className="text-[14px] font-black font-mono text-black">{formatNumber(totalMarks, language)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-black text-gray-800">
                    {language === 'bn' ? 'গড় নম্বর' : 'AVERAGE'}
                  </div>
                  <div className="text-[14px] font-black font-mono text-black">{formatNumber(average, language)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-black text-gray-800">
                    {language === 'bn' ? 'মেধা স্থান' : 'CLASS RANK'}
                  </div>
                  <div className="text-[14px] font-black font-mono text-blue-900">
                    {isFail ? '—' : formatNumber(rank, language)}
                  </div>
                </div>
              </div>
            </div>

            {/* Big GPA & Pass/Fail Stamp Box (Guaranteed Symmetrical Layout) */}
            <div className="border border-black p-1.5 bg-gray-100/30 rounded-sm flex flex-col justify-center items-center text-center select-none">
              <div className="text-[9px] font-black text-gray-800 tracking-wider uppercase mb-0.5">
                {language === 'bn' ? 'জিপিএ (গ্রেড পয়েন্ট গড়)' : 'GPA (GRADE POINT AVERAGE)'}
              </div>
              
              <div className="my-0.5 flex items-center justify-center gap-1.5">
                <span className="text-[20px] font-black leading-none font-mono text-black tracking-tight">
                  {formatNumber(gpa.toFixed(2), language)}
                </span>
                <span className="text-[9.5px] font-bold font-mono text-gray-600">
                  ({language === 'bn' ? 'স্কেল: ৫.০০' : 'Scale: 5.00'})
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 mt-0.5">
                <div className="text-[9.5px] font-bold text-gray-800 flex items-center gap-1">
                  <span>{language === 'bn' ? 'লেটার গ্রেড:' : 'Grade:'}</span>
                  <span className={`text-[11px] font-black px-1.5 py-0.2 bg-white border border-black shadow-xs ${isFail ? 'text-red-700' : 'text-green-800'}`}>
                    {grade}
                  </span>
                </div>
                <div className={`border ${isFail ? 'border-red-600 text-red-600 bg-red-50' : 'border-emerald-700 text-emerald-800 bg-emerald-50'} px-2 py-0.2 font-black text-[9.5px] rounded-xs uppercase tracking-wide`}>
                  {isFail ? (language === 'bn' ? 'অকৃতকার্য' : 'FAILED') : (language === 'bn' ? 'কৃতকার্য' : 'PASSED')}
                </div>
              </div>
            </div>

          </div>

          {/* Dedicated Teacher Remarks Box (Crisp, Non-Italic Bengali) */}
          <div className={`border border-black px-2.5 py-1 ${sectionGap} bg-gray-50/30 rounded-sm flex items-center text-[10.5px]`}>
            <span className="font-black text-black shrink-0 mr-2">
              {language === 'bn' ? 'শ্রেণী শিক্ষকের মন্তব্য:' : 'Teacher Remarks:'}
            </span>
            <span className="font-semibold text-gray-900">{displayRemark}</span>
          </div>

          {/* Co-curricular & Attendance Assessment Grid */}
          {!isCompact && (
            <div className={`border border-black p-1.5 ${sectionGap} bg-gray-50/20 text-[10px] select-none`}>
              <div className="grid grid-cols-2 gap-2 divide-x divide-black">
                {/* Attendance Record */}
                <div className="pr-1.5">
                  <div className="font-extrabold text-[9.5px] text-black border-b border-black pb-0.5 mb-0.5 flex justify-between items-center">
                    <span>{language === 'bn' ? 'উপস্থিতি বিবরণী' : 'Attendance Record'}</span>
                    <span className="text-[8.5px] font-mono text-gray-700 font-bold">
                      {language === 'bn' ? 'উপস্থিতির হার' : 'Rate'}: {existingRemark?.workingDays && existingRemark?.totalPresent ? `${formatNumber(((existingRemark.totalPresent / existingRemark.workingDays) * 100).toFixed(1), language)}%` : '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 text-center divide-x divide-black/20 text-[9px] font-semibold text-gray-800 pt-0.5">
                    <div>
                      <span className="block text-gray-600 text-[8px]">{language === 'bn' ? 'মোট কর্মদিবস' : 'Working Days'}</span>
                      <strong className="text-black font-mono text-[10px]">{existingRemark?.workingDays !== undefined ? formatNumber(existingRemark.workingDays, language) : '—'}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-600 text-[8px]">{language === 'bn' ? 'উপস্থিতি' : 'Present'}</span>
                      <strong className="text-black font-mono text-[10px]">{existingRemark?.totalPresent !== undefined ? formatNumber(existingRemark.totalPresent, language) : '—'}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-600 text-[8px]">{language === 'bn' ? 'অনুপস্থিতি' : 'Absent'}</span>
                      <strong className="text-black font-mono text-[10px]">{existingRemark?.totalAbsent !== undefined ? formatNumber(existingRemark.totalAbsent, language) : '—'}</strong>
                    </div>
                  </div>
                </div>
                {/* Conduct Assessment */}
                <div className="pl-2">
                  <div className="font-extrabold text-[9.5px] text-black border-b border-black pb-0.5 mb-0.5">
                    {language === 'bn' ? 'চারিত্রিক ও সহ-শিক্ষা মূল্যায়ন' : 'Moral & Co-Curricular Assessment'}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px] font-semibold text-gray-800 pt-0.5">
                    <div className="flex items-center justify-between border-b border-black/10 pb-0.5">
                      <span>{language === 'bn' ? 'শৃঙ্খলা ও নিয়মানুবর্তিতা' : 'Discipline'}</span>
                      <span className="text-black font-bold font-mono">{language === 'bn' ? 'উত্তম' : 'Good'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-black/10 pb-0.5">
                      <span>{language === 'bn' ? 'পরিষ্কার-পরিচ্ছন্নতা' : 'Cleanliness'}</span>
                      <span className="text-black font-bold font-mono">{language === 'bn' ? 'উত্তম' : 'Good'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{language === 'bn' ? 'আচরণ ও শিষ্টাচার' : 'Conduct'}</span>
                      <span className="text-black font-bold font-mono">{language === 'bn' ? 'উত্তম' : 'Good'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{language === 'bn' ? 'সহ-শিক্ষা কার্যক্রম' : 'Activities'}</span>
                      <span className="text-black font-bold font-mono">{language === 'bn' ? 'সন্তোষজনক' : 'Active'}</span>
                    </div>
                  </div>
                </div>

                {/* QR Verification Seal */}
                <div className="pl-1 flex items-center justify-center">
                  <ResultVerificationQR
                    student={student}
                    exam={exam}
                    schoolProfile={schoolProfile}
                    language={language}
                    size={44}
                    onOpenVerification={() => setShowVerifyModal(true)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Guaranteed Fully Visible Signatures with Solid Rule Lines */}
        <div className="grid grid-cols-3 gap-2 w-full mt-auto items-end text-[10.5px] pb-0.5 relative z-10 select-none">
          {/* Guardian Signature */}
          <div className="text-center flex flex-col items-center justify-end">
            {schoolProfile.showGuardianSignature !== false ? (
              <div className="w-full flex flex-col items-center">
                <div className={`${sigH} w-full`} />
                <div className="w-32 h-[1.5px] bg-black my-1" />
                <span className="font-bold text-black text-[10.5px] whitespace-nowrap">{language === 'bn' ? 'অভিভাবকের স্বাক্ষর' : 'Guardian Signature'}</span>
              </div>
            ) : <div className="w-full" />}
          </div>

          {/* Class Teacher Signature */}
          <div className="text-center flex flex-col items-center justify-end">
            {schoolProfile.showClassTeacherSignature !== false ? (
              <div className="w-full flex flex-col items-center">
                <div className={`${sigH} w-full`} />
                <div className="w-32 h-[1.5px] bg-black my-1" />
                <span className="font-bold text-black text-[10.5px] whitespace-nowrap">{language === 'bn' ? 'শ্রেণী শিক্ষকের স্বাক্ষর' : 'Class Teacher Signature'}</span>
              </div>
            ) : <div className="w-full" />}
          </div>

          {/* Headmaster Signature */}
          <div className="text-center flex flex-col items-center justify-end">
            {schoolProfile.showHeadmasterSignature !== false ? (
              <div className="w-full flex flex-col items-center">
                <div className={`${sigH} flex items-center justify-center relative w-full`}>
                  {schoolProfile.signatureUrl && (
                    <img src={schoolProfile.signatureUrl} className="h-6 object-contain" alt="Signature" referrerPolicy="no-referrer" />
                  )}
                </div>
                <div className="w-36 h-[1.5px] bg-black my-1" />
                <span className="font-extrabold text-black uppercase text-[10.5px] leading-tight block whitespace-nowrap">
                  {language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'সুপার / প্রধান শিক্ষক') : (schoolProfile.headMasterName || 'Headmaster')}
                </span>
                <span className="text-[9px] text-gray-700 font-bold leading-tight block whitespace-nowrap">
                  {language === 'bn' ? 'সুপার / অধ্যক্ষ' : 'Superintendent'}
                </span>
              </div>
            ) : <div className="w-full" />}
          </div>
        </div>

        {showVerifyModal && (
          <VerifiedResultModal
            student={student}
            exam={exam}
            schoolProfile={schoolProfile}
            subjects={subjects}
            marks={marks}
            exams={exams}
            language={language}
            onClose={() => setShowVerifyModal(false)}
          />
        )}

      </div>
    </div>
  );
};

export const PremiumColoredResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const numRank = Number(rank);
  const rankStr = numRank === 1 ? '1st' : numRank === 2 ? '2nd' : numRank === 3 ? '3rd' : numRank + 'th';
  const average = classSubjects.length > 0 ? (totalMarks / classSubjects.length).toFixed(1) : '0';

  const fontClass = language === 'bn' ? 'font-bangla' : '';
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-white mx-auto text-[13px] leading-normal border-[3px] border-[#1e3a8a] p-1.5 w-full max-w-[200mm] ${isCompact ? 'h-[141mm]' : 'h-[285mm]'} relative print:shadow-none ${fontClass} flex flex-col box-border`}
    >
      <div className={`border-[1.5px] border-[#1e3a8a]/40 h-full w-full ${isCompact ? 'p-3' : 'p-4'} flex flex-col relative flex-grow overflow-hidden`}>
        
        {/* Header Section: Logo, Centered Title + Bismillah, and grading scale */}
        <div className="flex items-center justify-between min-h-[96px] mb-3 w-full select-none border-b-2 border-[#1e3a8a]/60 pb-2">
          {/* Left wrapper */}
          <div className="w-[145px] shrink-0 flex items-center justify-start">
            {schoolProfile.showLogoOnCard !== false && (
              <div className="flex flex-col items-center justify-center h-20 w-20 border border-indigo-200 rounded-full bg-indigo-50/50 p-1">
                {schoolProfile.logoUrl ? (
                  <img src={schoolProfile.logoUrl} className="h-16 w-16 object-contain" alt="School Logo" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-center text-indigo-400">
                    <svg className="w-12 h-12 mx-auto text-indigo-505" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {schoolProfile.eiin && <span className="text-[8px] font-bold block uppercase leading-none mt-1">EIIN: {schoolProfile.eiin}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Centered School info */}
          <div className="text-center flex-grow px-2 flex flex-col items-center justify-center">
            <span className="text-[12px] font-extrabold text-[#d97706] tracking-wider mb-0.5 block">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
            <h1 className="text-xl font-black text-[#1e3a8a] tracking-tight font-serif uppercase leading-tight">
              {language === 'bn' ? schoolProfile.nameBn || schoolProfile.name : schoolProfile.name}
            </h1>
            {schoolProfile.name && schoolProfile.nameBn && schoolProfile.name.trim() !== schoolProfile.nameBn.trim() && (
              <p className="text-[12px] text-indigo-900 font-bold leading-normal mt-0.5">
                {language === 'bn' ? schoolProfile.name : schoolProfile.nameBn}
              </p>
            )}
            <p className="text-[10.5px] text-gray-700 font-semibold leading-normal mt-1 max-w-[340px]">
              {language === 'bn' ? schoolProfile.addressBn || schoolProfile.address : schoolProfile.address}
            </p>
            <div className="flex justify-center items-center flex-wrap gap-x-2 text-[10px] text-indigo-950 mt-1 font-bold">
              {schoolProfile.eiin && <span className="bg-indigo-50 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-100">EIIN: {schoolProfile.eiin}</span>}
              {schoolProfile.eiin && schoolProfile.phone && <span className="opacity-40">|</span>}
              {schoolProfile.phone && <span>{language === 'bn' ? 'ফোন' : 'Phone'}: {schoolProfile.phone}</span>}
              {(schoolProfile.eiin || schoolProfile.phone) && schoolProfile.established && <span className="opacity-40">|</span>}
              {schoolProfile.established && <span>{language === 'bn' ? 'স্থাপিত' : 'Estd'}: {schoolProfile.established}</span>}
            </div>
          </div>

          {/* Official Grading Scale Box on the right */}
          <div className="border border-[#1e3a8a]/40 p-1 bg-indigo-50/10 text-[8.5px] leading-tight font-mono select-none w-[145px] shrink-0 rounded">
            <div className="text-center font-black border-b border-[#1e3a8a]/30 pb-0.5 mb-1 text-[9px] text-[#1e3a8a]">
              {language === 'bn' ? 'গ্রেডিং তালিকা' : 'GRADING SYSTEM'}
            </div>
            <table className="w-full text-center">
              <tbody>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-bold text-gray-800">80%-100%</td>
                  <td className="font-bold text-emerald-800">A+</td>
                  <td className="font-bold text-emerald-800">5.00</td>
                </tr>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-medium text-gray-800">70%-79%</td>
                  <td className="font-medium text-indigo-900">A</td>
                  <td className="font-medium text-indigo-900">4.00</td>
                </tr>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-medium text-gray-800">60%-69%</td>
                  <td className="font-medium text-indigo-800">A-</td>
                  <td className="font-medium text-indigo-800">3.50</td>
                </tr>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-medium text-gray-800">50%-59%</td>
                  <td className="font-medium text-gray-800">B</td>
                  <td className="font-medium text-gray-800">3.00</td>
                </tr>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-medium text-gray-800">40%-49%</td>
                  <td className="font-medium text-gray-700">C</td>
                  <td className="font-medium text-gray-700">2.00</td>
                </tr>
                <tr className="border-b border-[#1e3a8a]/10">
                  <td className="font-medium text-gray-800">33%-39%</td>
                  <td className="font-medium text-orange-700">D</td>
                  <td className="font-medium text-orange-700">1.00</td>
                </tr>
                <tr>
                  <td className="font-medium text-gray-800">00%-32%</td>
                  <td className="font-medium text-red-600">F</td>
                  <td className="text-red-600 font-bold">0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Academic Transcript Title */}
        <div className={`w-full bg-gradient-to-r from-indigo-900 via-[#1e3a8a] to-indigo-900 py-1.5 text-center ${isCompact ? 'mb-2' : 'mb-4'} rounded shadow-sm border border-amber-600/30`}>
          <h2 className="text-[14px] font-black tracking-wider text-amber-400">
            {language === 'bn' ? 'একাডেমিক ট্রান্সক্রিপ্ট (পরীক্ষার প্রগতিপত্র)' : 'ACADEMIC PROGRESS REPORT CARD'}
          </h2>
        </div>

        {/* Student Details Grid (Board Registration Style) */}
        <div className="border border-[#1e3a8a]/30 grid grid-cols-2 text-[12px] leading-relaxed mb-4 bg-indigo-50/20 rounded">
          <div className="border-r border-b border-[#1e3a8a]/20 p-2 flex gap-2">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{t('studentName') || 'Student Name'}:</span>
            <span className="font-extrabold text-indigo-900 uppercase">{language === 'bn' ? (student.nameBn || student.name) : student.name}</span>
          </div>
          <div className="border-b border-[#1e3a8a]/20 p-2 flex gap-2">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{t('class') || 'Class'}:</span>
            <span className="font-semibold text-gray-900">{language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span>
          </div>

          <div className="border-r border-b border-[#1e3a8a]/20 p-2 flex gap-2">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{t('fatherName') || "Father's Name"}:</span>
            <span className="font-semibold text-gray-900">{language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName}</span>
          </div>
          <div className="border-b border-[#1e3a8a]/20 p-2 flex gap-2 items-center">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{t('rollNo') || 'Roll No'}:</span>
            <span className="font-bold text-[#1e3a8a] font-mono text-[12px] uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200 tracking-widest leading-none">
              {student.studentId || '-'}
            </span>
          </div>

          <div className="border-r border-[#1e3a8a]/20 p-2 flex gap-2">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{language === 'bn' ? 'শিক্ষা বর্ষ' : 'Academic Year'}:</span>
            <span className="font-bold text-gray-900 font-mono">{schoolProfile.academicYear}</span>
          </div>
          <div className="p-2 flex gap-2">
            <span className="font-bold text-indigo-950 w-28 shrink-0">{t('exam') || 'Exam'}:</span>
            <span className="font-bold text-indigo-950">{language === 'bn' ? (exam.nameBn || exam.name) : exam.name}</span>
          </div>
        </div>

        {/* Main Transcript Table */}
        <div className="flex-grow relative z-10 mb-4 overflow-hidden">
          {schoolProfile.showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none z-0">
              {schoolProfile.logoUrl ? (
                <img src={schoolProfile.logoUrl} className="w-80 h-80 object-contain" alt="Watermark Logo" referrerPolicy="no-referrer" />
              ) : (
                <div className="text-center font-serif text-[#1e3a8a] border-4 border-dashed border-[#1e3a8a] p-8 rounded-full text-4xl font-extrabold rotate-[15deg]">
                  {schoolProfile.name.substring(0, 15)}
                </div>
              )}
            </div>
          )}

          <table className="w-full border-collapse text-left border border-[#1e3a8a]/40 table-auto relative z-10 text-[12px] leading-tight rounded overflow-hidden">
            <thead>
              <tr className="bg-[#1e3a8a] text-white font-extrabold border-b border-indigo-950 select-none">
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-12 shrink-0">
                  {language === 'bn' ? 'ক্রমিক' : 'SL NO'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2">
                  {language === 'bn' ? 'বিষয়' : 'SUBJECT'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-20 shrink-0">
                  {language === 'bn' ? 'পূর্ণমান' : 'FULL MARKS'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-20 shrink-0">
                  {language === 'bn' ? 'পাস নম্বর' : 'PASS MARKS'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-20 text-text-white shrink-0">
                  {language === 'bn' ? 'সর্বোচ্চ' : 'HIGHEST'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-20 shrink-0">
                  {language === 'bn' ? 'প্রাপ্ত নম্বর' : 'OBTAINED'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-16 shrink-0">
                  {language === 'bn' ? 'গ্রেড' : 'GRADE'}
                </th>
                <th className="border border-indigo-900/40 px-3 py-2 text-center w-18 shrink-0">
                  {language === 'bn' ? 'পয়েন্ট' : 'POINT'}
                </th>
              </tr>
            </thead>
            <tbody>
              {classSubjects.map((sub, index) => {
                const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
                const obtained = markRecord && !markRecord.isAbsent ? (markRecord.obtained || 0) : 0;
                
                const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
                const allMarksForThisSub = allClassStudents
                   .map(s => getConsolidatedMark(s.id, sub.id, exam.id, exams, marks))
                   .filter(m => m && !m.isAbsent);
                const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m!.obtained)) : 0;

                let gradeObj: any = { grade: '', gpa: 0 };
                
                if (markRecord && !markRecord.isAbsent) {
                   gradeObj = calculateGrade(obtained, sub.fullMarks);
                } else if (markRecord?.isAbsent) {
                   gradeObj = { grade: 'F', gpa: 0 };
                } else {
                   gradeObj = { grade: '-', gpa: 0 };
                }

                // Check fail status
                let totalFail = false;
                if (markRecord && !markRecord.isAbsent && obtained < sub.passMarks) totalFail = true;
                if (sub.hasCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedCQ || 0) < (sub.cqPassMarks || 0)) { totalFail = true; }
                if (sub.hasMCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedMCQ || 0) < (sub.mcqPassMarks || 0)) { totalFail = true; }
                if (totalFail) {
                   gradeObj = { grade: 'F', gpa: 0 };
                }
                const grade = gradeObj.grade || '-';
                const point = gradeObj.gpa || 0;
                const isF = grade === 'F';

                // Soft background styling alternating
                const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-indigo-50/15';

                return (
                  <tr key={sub.id} className={`${rowBg} hover:bg-indigo-50/30 transition-colors`}>
                    <td className="border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-mono font-bold text-gray-700">{String(index + 1)}</td>
                    <td className="border border-[#1e3a8a]/20 px-3 py-1.5 font-bold text-indigo-950">
                      {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                      {sub.isOptional && <span className="text-[9px] text-[#d97706] font-extrabold ml-1">({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span>}
                    </td>
                    <td className="border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-mono text-gray-800">{String(sub.fullMarks ?? '')}</td>
                    <td className="border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-mono text-gray-600">{String(sub.passMarks ?? '')}</td>
                    <td className="border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-mono font-bold text-amber-800 bg-amber-50/40">{String(highest ?? 0)}</td>
                    <td className={`border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-black font-mono ${isF ? 'text-red-600 underline' : 'text-gray-950'}`}>
                      {markRecord?.isAbsent ? (language === 'bn' ? 'অনুপস্থিত' : 'Absent') : String(obtained ?? 0)}
                    </td>
                    <td className={`border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-black ${grade === 'A+' ? 'text-emerald-700 font-extrabold' : ''} ${isF ? 'text-red-600' : 'text-indigo-900'}`}>{grade}</td>
                    <td className={`border border-[#1e3a8a]/20 px-3 py-1.5 text-center font-mono font-bold ${isF ? 'text-red-600' : 'text-gray-800'}`}>{grade !== '-' ? point.toFixed(2) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Results Overview Ribbons */}
        <div className="grid grid-cols-[3fr_2fr] gap-4 mb-4 select-none animate-fade-in animate-duration-300">
          
          {/* Main Grade Details / Position */}
          <div className="border border-[#1e3a8a]/35 p-2.5 rounded bg-indigo-50/10 flex flex-col justify-between">
            <div className="grid grid-cols-3 gap-1 text-center divide-x divide-[#1e3a8a]/30">
              <div>
                <div className="text-[9.5px] uppercase font-black text-indigo-900">
                  {language === 'bn' ? 'মোট নম্বর' : 'TOTAL MARKS'}
                </div>
                <div className="text-[16px] font-extrabold font-mono text-indigo-950">{String(totalMarks ?? 0)}</div>
              </div>
              <div>
                <div className="text-[9.5px] uppercase font-black text-indigo-900">
                  {language === 'bn' ? 'গড় নম্বর' : 'AVERAGE'}
                </div>
                <div className="text-[16px] font-extrabold font-mono text-indigo-950">{average}</div>
              </div>
              <div>
                <div className="text-[9.5px] uppercase font-black text-indigo-900">
                  {language === 'bn' ? 'মেধা স্থান' : 'CLASS RANK'}
                </div>
                <div className="text-[16px] font-extrabold font-mono text-amber-700">{rank ? String(rank) : '—'}</div>
              </div>
            </div>

            <div className="border-t border-dashed border-[#1e3a8a]/30 mt-2 pt-2 text-[12px] leading-relaxed">
              <div>
                <span className="font-black text-indigo-950">
                  {language === 'bn' ? 'মন্তব্য:' : 'Comments:'}
                </span>{' '}
                <span className="font-bold text-gray-800 italic ml-1">{displayRemark}</span>
              </div>
              
              {/* Extra student presence row */}
              <div className="flex gap-x-4 border-t border-indigo-100 mt-1.5 pt-1 text-[11px] text-indigo-950 font-bold">
                <span>{language === 'bn' ? 'কর্মদিবস' : 'Working Days'}: <span className="font-extrabold text-[#1e3a8a] font-mono">{existingRemark?.workingDays !== undefined ? String(existingRemark.workingDays) : '—'}</span></span>
                <span>{language === 'bn' ? 'উপস্থিতি' : 'Present'}: <span className="font-extrabold text-emerald-800 font-mono">{existingRemark?.totalPresent !== undefined ? String(existingRemark.totalPresent) : '—'}</span></span>
                <span>{language === 'bn' ? 'অনুপস্থিতি' : 'Absent'}: <span className="font-extrabold text-red-700 font-mono">{existingRemark?.totalAbsent !== undefined ? String(existingRemark.totalAbsent) : '—'}</span></span>
              </div>
            </div>
          </div>

          {/* Big GPA & Pass/Fail Stamp Box */}
          <div className="border border-[#1e3a8a]/40 p-2 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 rounded flex flex-col justify-center items-center text-center relative overflow-hidden shadow-sm">
            <div className="text-[9.5px] font-black text-indigo-900 tracking-wider uppercase">
              {language === 'bn' ? 'জিপিএ (গ্রেড পয়েন্ট গড়)' : 'GPA (GRADE POINT AVERAGE)'}
            </div>
            
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-[28px] font-black leading-none font-mono text-[#1e3a8a]">{gpa.toFixed(2)}</span>
              <span className="text-[10px] font-black font-mono text-indigo-900/60">/ 5.00</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9.5px] uppercase font-black text-indigo-900">
                {language === 'bn' ? 'লেটার গ্রেড:' : 'LETTER GRADE:'}
              </span>
              <span className={`text-[13px] font-black px-2 py-0.5 bg-white border border-[#1e3a8a]/40 shadow-sm rounded ${isFail ? 'text-red-600' : 'text-emerald-700'}`}>
                {grade}
              </span>
            </div>

            {/* Stamp styled Badge */}
            <div className="mt-2">
              <div className={`border-2 ${isFail ? 'border-red-500 text-red-600' : 'border-emerald-600 text-emerald-700'} px-3 py-0.5 font-black text-[11px] rounded tracking-widest uppercase rotate-[-2deg] bg-white inline-block shadow-sm`}>
                {isFail ? (language === 'bn' ? 'অকৃতকার্য' : 'FAILED') : (language === 'bn' ? 'কৃতকার্য' : 'PASSED')}
              </div>
            </div>
          </div>

        </div>

        {/* Clear Signatures with official dotted line labels and Headmaster seal area */}
        <div className="flex justify-between mt-6 items-end text-[11px] pb-1 relative z-10 select-none gap-2">
          {/* Guardian Signature */}
          <div className="w-40 text-center flex flex-col items-center">
            {schoolProfile.showGuardianSignature !== false ? (
              <>
                <div className="h-10" />
                <div className="w-11/12 border-t border-[#1e3a8a]/40 pb-1" />
                <span className="font-extrabold text-indigo-950 uppercase">{t('guardian') || 'Guardian Signature'}</span>
                <span className="text-[9.5px] text-gray-500 font-bold font-bangla leading-none">অভিভাবকের স্বাক্ষর</span>
              </>
            ) : <div className="w-40" />}
          </div>

          {/* Class Teacher Signature */}
          <div className="w-36 text-center flex flex-col items-center">
            {schoolProfile.showClassTeacherSignature !== false ? (
              <>
                <div className="h-10" />
                <div className="w-11/12 border-t border-[#1e3a8a]/40 pb-1" />
                <span className="font-extrabold text-indigo-950 uppercase">{t('classTeacher') || 'Class Teacher'}</span>
                <span className="text-[9.5px] text-gray-500 font-bold font-bangla leading-none">শ্রেণী শিক্ষকের স্বাক্ষর</span>
              </>
            ) : <div className="w-36" />}
          </div>

          {/* QR Verification Seal */}
          <div className="flex items-center justify-center px-1">
            <ResultVerificationQR
              student={student}
              exam={exam}
              schoolProfile={schoolProfile}
              language={language}
              size={48}
              onOpenVerification={() => setShowVerifyModal(true)}
            />
          </div>

          {/* Headmaster Signature */}
          <div className="w-48 text-center flex flex-col items-center flex-grow-0 shrink-0">
            {schoolProfile.showHeadmasterSignature !== false ? (
              <div className="relative flex flex-col items-center w-full">
                <div className="h-10 flex items-center justify-center relative w-full">
                  {schoolProfile.signatureUrl && (
                    <img src={schoolProfile.signatureUrl} className="absolute bottom-0.5 h-9 object-contain animate-fade-in shadow-sm" alt="Signature" referrerPolicy="no-referrer" />
                  )}
                </div>
                
                <div className="w-11/12 border-t border-[#1e3a8a]/40 pb-1" />
                <span className="font-extrabold text-indigo-950 uppercase">
                  {language === 'bn' ? schoolProfile.headMasterNameBn || schoolProfile.headMasterName : schoolProfile.headMasterName || t('headMaster')}
                </span>
                <span className="text-[9.5px] text-gray-500 font-bold uppercase leading-tight select-none">
                  {language === 'bn' ? 'সুপার' : 'Super'}
                </span>
              </div>
            ) : <div className="w-48" />}
          </div>
        </div>

        {showVerifyModal && (
          <VerifiedResultModal
            student={student}
            exam={exam}
            schoolProfile={schoolProfile}
            subjects={subjects}
            marks={marks}
            exams={exams}
            language={language}
            onClose={() => setShowVerifyModal(false)}
          />
        )}

      </div>
    </div>
  );
};

export const PremiumRoyalResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const numRank = Number(rank);

  const getRankStr = (r: number | undefined | null, lang: string) => {
    if (!r) return '—';
    if (lang === 'bn') {
      const banglaNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const rbn = String(r).split('').map(digit => banglaNums[parseInt(digit)] || digit).join('');
      return rbn + (r === 1 ? 'ম' : r === 2 ? 'য়' : r === 3 ? 'য়' : 'তম');
    }
    return r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : r + 'th';
  };

  const getBanglaNumberStr = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const banglaNums: { [key: string]: string } = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    return String(num).split('').map(digit => banglaNums[digit] || digit).join('');
  };

  const rankStr = getRankStr(numRank, language);
  const average = classSubjects.length > 0 ? (totalMarks / classSubjects.length).toFixed(1) : '0';
  const displayAverage = language === 'bn' ? getBanglaNumberStr(average) : average;
  const displayTotalMarks = language === 'bn' ? getBanglaNumberStr(totalMarks) : String(totalMarks ?? 0);

  const fontClass = language === 'bn' ? 'font-bangla' : '';
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');
  const totalPossibleFullMarks = classSubjects.reduce((acc, curr) => acc + (curr.fullMarks || 0), 0);
  const displayPossibleMarks = language === 'bn' ? getBanglaNumberStr(totalPossibleFullMarks) : String(totalPossibleFullMarks ?? 0);

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-[#fdfcf7] mx-auto text-[12px] leading-normal w-full max-w-[210mm] ${isCompact ? 'h-[141mm]' : 'h-[285mm]'} relative shadow-2xl print:shadow-none ${fontClass} flex flex-col box-border`}
      style={{ 
        border: '12px double #5c0612', 
        outline: '2.5px solid #cf9c34', 
        outlineOffset: '-7px' 
      }}
    >
      {/* Absolute Filigree Corner Crest Ornaments */}
      <div className="absolute top-1 left-1 pointer-events-none select-none text-[#cf9c34] opacity-85 z-20">
        <svg width="42" height="42" viewBox="0 0 100 100" fill="currentColor">
          <path d="M0,0 L40,0 C20,10 10,20 0,40 Z" />
          <circle cx="15" cy="15" r="5" />
          <line x1="0" y1="0" x2="35" y2="35" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <div className="absolute top-1 right-1 pointer-events-none select-none text-[#cf9c34] opacity-85 z-20 transform rotate-90">
        <svg width="42" height="42" viewBox="0 0 100 100" fill="currentColor">
          <path d="M0,0 L40,0 C20,10 10,20 0,40 Z" />
          <circle cx="15" cy="15" r="5" />
          <line x1="0" y1="0" x2="35" y2="35" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <div className="absolute bottom-1 left-1 pointer-events-none select-none text-[#cf9c34] opacity-85 z-20 transform -rotate-90">
        <svg width="42" height="42" viewBox="0 0 100 100" fill="currentColor">
          <path d="M0,0 L40,0 C20,10 10,20 0,40 Z" />
          <circle cx="15" cy="15" r="5" />
          <line x1="0" y1="0" x2="35" y2="35" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <div className="absolute bottom-1 right-1 pointer-events-none select-none text-[#cf9c34] opacity-85 z-20 transform rotate-180">
        <svg width="42" height="42" viewBox="0 0 100 100" fill="currentColor">
          <path d="M0,0 L40,0 C20,10 10,20 0,40 Z" />
          <circle cx="15" cy="15" r="5" />
          <line x1="0" y1="0" x2="35" y2="35" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* Decorative Gold Inner Filigree Border Line */}
      <div className="border border-[#cf9c34]/45 m-2.5 p-4 flex flex-col flex-grow relative overflow-hidden bg-gradient-to-b from-[#fcfbf7] via-white to-[#faf7ed]">
        
        {/* Subtle Diagonal Watermark Lines Background */}
        {schoolProfile.showWatermark && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none z-0">
            {schoolProfile.logoUrl ? (
              <img src={schoolProfile.logoUrl} className="w-88 h-88 object-contain" alt="Watermark Logo" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-center font-serif text-[#5c0612] border-8 border-double border-[#5c0612] p-12 rounded-full text-5xl font-black rotate-[14deg]">
                {schoolProfile.name}
              </div>
            )}
          </div>
        )}

        {/* TOP COMPONENT: Centered Highly Finished Royal Header */}
        <div className="relative z-10 flex flex-col items-center justify-center border-b-2 border-[#5c0612]/30 pb-3 mb-4 select-none">
          <span className="text-[11px] font-black tracking-widest text-[#cf9c34] uppercase mb-1">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
          
          <div className="flex items-center gap-6 w-full px-4 justify-between">
            {/* Left side: Premium Circular Crest */}
            <div className="w-[120px] shrink-0 flex items-center justify-start">
              {schoolProfile.showLogoOnCard !== false && (
                <div className="h-20 w-20 rounded-full border-2 border-[#cf9c34] bg-[#5c0612]/5 p-1 relative flex items-center justify-center shadow-md">
                  {/* Circular Crest Outer Gold Rings */}
                  <div className="absolute inset-0 rounded-full border border-dashed border-[#cf9c34]/50 m-0.5" />
                  {schoolProfile.logoUrl ? (
                    <img src={schoolProfile.logoUrl} className="h-16 w-16 object-contain rounded-full bg-white p-0.5" alt="Institution Logo" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-[#cf9c34] w-12 h-12 flex items-center justify-center">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Centered Primary Institution Details */}
            <div className="text-center flex-grow flex flex-col items-center">
              <h1 className="text-[21px] font-black tracking-tight text-[#5c0612] leading-tight uppercase font-serif pb-0.5">
                {language === 'bn' ? schoolProfile.nameBn || schoolProfile.name : schoolProfile.name}
              </h1>
              {schoolProfile.name && schoolProfile.nameBn && schoolProfile.name.trim() !== schoolProfile.nameBn.trim() && (
                <p className="text-[12px] text-gray-800 font-bold tracking-normal mt-0.5">
                  {language === 'bn' ? schoolProfile.name : schoolProfile.nameBn}
                </p>
              )}
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-600 mt-1 max-w-[400px]">
                {language === 'bn' ? schoolProfile.addressBn || schoolProfile.address : schoolProfile.address}
              </p>
              
              {/* EIIN and Meta row */}
              <div className="flex gap-x-2.5 items-center justify-center mt-2 text-[9.5px]">
                {schoolProfile.eiin && (
                  <span className="bg-[#5c0612] text-white px-2 py-0.5 rounded font-bold font-mono tracking-wider">
                    EIIN: {schoolProfile.eiin}
                  </span>
                )}
                {schoolProfile.phone && (
                  <span className="text-[#cf9c34] font-bold">
                    {language === 'bn' ? 'মোবাইল: ' : 'PHONE: '}<span className="text-gray-700">{schoolProfile.phone}</span>
                  </span>
                )}
                {schoolProfile.established && (
                  <span className="text-gray-500 font-bold">
                    ● {language === 'bn' ? 'স্থাপিত: ' : 'ESTD: '}{schoolProfile.established}
                  </span>
                )}
              </div>
            </div>

            {/* Right side: Prestige Gold-Leaf Box with official document category */}
            <div className="w-[120px] bg-[#5c0612]/[0.02] border-2 border-[#cf9c34]/70 rounded p-1.5 text-center shadow-inner relative shrink-0">
              <div className="absolute top-0.5 left-0.5 right-0.5 border border-dashed border-[#cf9c34]/30 rounded h-[calc(100%-4px)] pointer-events-none" />
              <span className="text-[8px] font-black uppercase text-[#5c0612] block tracking-widest">{language === 'bn' ? 'অনুমোদিত' : 'OFFICIAL'}</span>
              <span className="text-[12px] font-black text-amber-800 font-serif leading-none mt-1 block truncate">
                {language === 'bn' ? 'প্রগতিপত্র' : 'REGISTRY'}
              </span>
              <div className="text-[8.5px] font-bold text-gray-600 mt-1 font-mono tracking-tight">
                {schoolProfile.academicYear}
              </div>
            </div>
          </div>

          {/* Symmetrical Gold/Crimson Ribbon Banner */}
          <div className="w-full bg-gradient-to-r from-[#5c0612] via-[#851121] to-[#5c0612] h-7.5 flex items-center justify-center rounded shadow-md border-y border-[#cf9c34]/50 px-6 mt-1">
            <h2 className="text-[13px] font-black tracking-widest text-[#f5db9a] uppercase font-serif">
              {language === 'bn' ? 'একাডেমিক অগ্রগতি বিবরণী ও গ্রেড প্রগতিপত্র' : 'ACADEMIC PERFORMANCE REPORT CARD'}
            </h2>
          </div>
        </div>

        {/* HIGH FINISHED STUDENT INFORMATION BOX (Grid Mapping Enclosed in Delicate Lines) */}
        <div className="relative z-10 border border-[#cf9c34]/40 bg-white shadow-sm p-3 rounded mb-4 select-text">
          <div className="grid grid-cols-3 gap-y-3 gap-x-5 text-[11.5px] leading-relaxed">
            <div className="flex flex-col">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{t('studentName') || 'Student Name'}</span>
              <span className="text-[13px] font-black text-[#5c0612] uppercase leading-none mt-0.5">
                {language === 'bn' ? (student.nameBn || student.name) : student.name}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{t('fatherName') || "Father's Name"}</span>
              <span className="text-[11.5px] font-bold text-gray-800 leading-none mt-0.5">
                {language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{t('class') || 'Class Level'}</span>
              <span className="text-[12px] font-extrabold text-gray-900 leading-none mt-0.5">
                {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}
              </span>
            </div>

            <div className="flex flex-col pt-1 border-t border-gray-100">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{t('rollNo') || 'Roll Number'}</span>
              <span className="text-[12.5px] font-black text-gray-900 font-mono tracking-wider mt-0.5">
                {student.studentId || '-'}
              </span>
            </div>
            <div className="flex flex-col pt-1 border-t border-gray-100">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{t('exam') || 'Examination'}</span>
              <span className="text-[12px] font-extrabold text-[#5c0612] leading-none mt-0.5">
                {language === 'bn' ? (exam.nameBn || exam.name) : exam.name}
              </span>
            </div>
            <div className="flex flex-col pt-1 border-t border-gray-100">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-gray-500">{language === 'bn' ? 'শিক্ষা শ্রেনী গ্রুপ' : 'Group / Track'}</span>
              <span className="text-[11px] font-bold text-gray-800 leading-none mt-0.5">
                {student.group || 'All'}
              </span>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT RESULTS GRADE SHEET (Symmetrical Clean Grid with Soft Crimson Headers) */}
        <div className="flex-grow relative z-10 mb-4 overflow-hidden">
          <table className="w-full border-collapse border border-[#cf9c34]/30 text-[11px] leading-tight text-left table-auto">
            <thead>
              <tr className="bg-gradient-to-r from-[#4d0711] to-[#7f1322] text-white text-[10px] uppercase font-black select-none border-b border-[#cf9c34]/40">
                <th className="py-2.5 px-3 text-center w-12 border-r border-[#cf9c34]/20">SL</th>
                <th className="py-2.5 px-3 border-r border-[#cf9c34]/20">{language === 'bn' ? 'বিষয় সমূহ' : 'SUBJECT & COMPONENTS'}</th>
                <th className="py-2.5 px-2 text-center w-20 border-r border-[#cf9c34]/20">{language === 'bn' ? 'পূর্ণমান' : 'FULL'}</th>
                <th className="py-2.5 px-2 text-center w-20 border-r border-[#cf9c34]/20">{language === 'bn' ? 'পাস' : 'PASS'}</th>
                <th className="py-2.5 px-2 text-center w-20 bg-[#3f030a] border-r border-[#cf9c34]/20">{language === 'bn' ? 'সর্বোচ্চ' : 'CLASS MAX'}</th>
                <th className="py-2.5 px-2 text-center w-24 bg-[#5c0612] border-r border-[#cf9c34]/30 font-black text-amber-200">{language === 'bn' ? 'প্রাপ্ত নম্বর' : 'OBTAINED'}</th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-[#cf9c34]/20">{language === 'bn' ? 'গ্রেড' : 'GRADE'}</th>
                <th className="py-2.5 px-2 text-center w-16">POINT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {classSubjects.map((sub, index) => {
                const markRecord = getConsolidatedMark(student.id, sub.id, exam.id, exams, marks);
                const obtained = markRecord && !markRecord.isAbsent ? (markRecord.obtained || 0) : 0;
                
                const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
                const allMarksForThisSub = allClassStudents
                   .map(s => getConsolidatedMark(s.id, sub.id, exam.id, exams, marks))
                   .filter(m => m && !m.isAbsent);
                const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m!.obtained)) : 0;

                let gradeObj: any = { grade: '', gpa: 0 };
                
                if (markRecord && !markRecord.isAbsent) {
                   gradeObj = calculateGrade(obtained, sub.fullMarks);
                } else if (markRecord?.isAbsent) {
                   gradeObj = { grade: 'F', gpa: 0 };
                } else {
                   gradeObj = { grade: '-', gpa: 0 };
                }

                // Check fail status
                let totalFail = false;
                if (markRecord && !markRecord.isAbsent && obtained < sub.passMarks) totalFail = true;
                if (sub.hasCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedCQ || 0) < (sub.cqPassMarks || 0)) { totalFail = true; }
                if (sub.hasMCQ && markRecord && !markRecord.isAbsent && (markRecord.obtainedMCQ || 0) < (sub.mcqPassMarks || 0)) { totalFail = true; }
                if (totalFail) {
                   gradeObj = { grade: 'F', gpa: 0 };
                }
                const grade = gradeObj.grade || '-';
                const point = gradeObj.gpa || 0;
                const isF = grade === 'F';

                // Soft alternating premium background styling
                const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-[#5c0612]/[0.015]';

                return (
                  <tr key={sub.id} className={`${rowBg} hover:bg-[#cf9c34]/10 transition-colors text-[11px] font-medium`}>
                    <td className="py-2 px-3 text-center border-r border-[#cf9c34]/10 font-mono font-bold text-gray-500">
                      {language === 'bn' ? getBanglaNumberStr(index + 1) : String(index + 1)}
                    </td>
                    <td className="py-2 px-3 border-r border-[#cf9c34]/10 font-bold text-[#5c0612] text-[11.5px] font-serif">
                      <div>
                        {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                        {sub.isOptional && <span className="text-[8.5px] tracking-wider text-amber-700 ml-1">({language === 'bn' ? 'ঐচ্ছিক' : 'Optional'})</span>}
                      </div>

                      {/* CQ / MCQ split breakdown representation inside row */}
                      {markRecord && !markRecord.isAbsent && (sub.hasCQ || sub.hasMCQ) && (
                        <div className="text-[8px] text-gray-400 font-sans tracking-tight space-x-1 px-1 py-0.5 leading-none select-none font-normal">
                          {sub.hasCQ && <span>CQ: {language === 'bn' ? getBanglaNumberStr(markRecord.obtainedCQ || 0) : (markRecord.obtainedCQ || 0)}/{language === 'bn' ? getBanglaNumberStr(sub.cqMarks || 0) : (sub.cqMarks || 0)}</span>}
                          {sub.hasMCQ && <span>MCQ: {language === 'bn' ? getBanglaNumberStr(markRecord.obtainedMCQ || 0) : (markRecord.obtainedMCQ || 0)}/{language === 'bn' ? getBanglaNumberStr(sub.mcqMarks || 0) : (sub.mcqMarks || 0)}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-[#cf9c34]/10 font-mono text-gray-600">
                      {language === 'bn' ? getBanglaNumberStr(sub.fullMarks) : String(sub.fullMarks ?? '')}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-[#cf9c34]/10 font-mono text-gray-600">
                      {language === 'bn' ? getBanglaNumberStr(sub.passMarks) : String(sub.passMarks ?? '')}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-[#cf9c34]/10 font-mono font-bold text-[#7f1d1d] bg-red-50/10">
                      {language === 'bn' ? getBanglaNumberStr(highest) : String(highest ?? 0)}
                    </td>
                    <td className={`py-2 px-2 text-center border-r border-[#cf9c34]/20 font-black font-mono text-[12px] ${isF ? 'text-red-700 bg-red-100/30 line-through' : 'text-gray-950 font-black'}`}>
                      {markRecord?.isAbsent ? (language === 'bn' ? 'অনুপস্থিত' : 'ABS') : (language === 'bn' ? getBanglaNumberStr(obtained) : String(obtained ?? 0))}
                    </td>
                    <td className="py-2 px-2 text-center border-r border-[#cf9c34]/10 font-sans">
                      <span className={`text-[11px] font-black inline-block px-1.5 py-0.5 rounded ${grade === 'A+' ? 'bg-amber-100 text-amber-800 font-extrabold border border-amber-500/30' : (isF ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800')}`}>
                        {grade}
                      </span>
                    </td>
                    <td className={`py-2 px-2 text-center font-mono font-bold ${isF ? 'text-red-600' : 'text-gray-800'}`}>
                      {grade !== '-' ? (language === 'bn' ? getBanglaNumberStr(point.toFixed(2)) : point.toFixed(2)) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PERFORMANCE SUMMARY CARD ROW (Left: Scoreboard Stats & Remarks, Right: Crest/Appraisal Medal Seal) */}
        <div className="grid grid-cols-[3.2fr_1.8fr] gap-4 mb-4 items-stretch select-none relative z-10">
          
          {/* Symmetrical Left Stats Block for official registry indicators */}
          <div className="border border-[#cf9c34]/30 rounded bg-white p-3 flex flex-col justify-between shadow-sm">
            <div className="grid grid-cols-3 gap-1.5 text-center divide-x divide-gray-200">
              <div>
                <dt className="text-[8.5px] uppercase font-black tracking-wide text-gray-500">{language === 'bn' ? 'সর্বমোট প্রাপ্ত নম্বর' : 'AGGREGATE MARKS'}</dt>
                <dd className="text-[15px] font-black font-mono text-[#5c0612] mt-0.5">{displayTotalMarks}<span className="text-[9.5px] font-bold text-gray-400">/{displayPossibleMarks}</span></dd>
              </div>
              <div>
                <dt className="text-[8.5px] uppercase font-black tracking-wide text-gray-500">{language === 'bn' ? 'শতকরা গড়ভাগ' : 'AVERAGE PERCENT'}</dt>
                <dd className="text-[15px] font-black font-mono text-gray-900 mt-0.5">{displayAverage}%</dd>
              </div>
              <div>
                <dt className="text-[8.5px] uppercase font-black tracking-wide text-gray-500">{language === 'bn' ? 'মেধাক্রম স্থিতি' : 'ACADEMIC RANK'}</dt>
                <dd className="text-[15px] font-black font-mono text-amber-700 mt-0.5">{rankStr}</dd>
              </div>
            </div>

            {/* Symmetrical Quote formatted Feedback Box */}
            <div className="border-t border-[#cf9c34]/20 mt-3 pt-3">
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-black tracking-wider text-[#5c0612] uppercase shrink-0 mt-0.5">{language === 'bn' ? 'মন্তব্য ও সুপারিশ:' : 'OFFICIAL ASSESSMENT:'}</span>
                <span className="text-[11.5px] italic text-gray-700 font-serif leading-normal font-semibold">
                  “{displayRemark}”
                </span>
              </div>

              {/* Styled Compact Student Calendar Presence details */}
              <div className="flex gap-x-4 border-t border-gray-100/50 mt-2.5 pt-1.5 text-[9.5px] text-gray-600 font-semibold font-serif">
                <span>{language === 'bn' ? 'মোট কর্মদিবস' : 'Total Working Days'}: <span className="font-bold text-gray-900 font-mono">{existingRemark?.workingDays !== undefined ? (language === 'bn' ? getBanglaNumberStr(existingRemark.workingDays) : String(existingRemark.workingDays)) : '—'}</span></span>
                <span>{language === 'bn' ? 'মোট উপস্থিতি' : 'Days Present'}: <span className="font-bold text-green-700 font-mono">{existingRemark?.totalPresent !== undefined ? (language === 'bn' ? getBanglaNumberStr(existingRemark.totalPresent) : String(existingRemark.totalPresent)) : '—'}</span></span>
                <span>{language === 'bn' ? 'মোট অনুপস্থিতি' : 'Days Absent'}: <span className="font-bold text-red-700 font-mono">{existingRemark?.totalAbsent !== undefined ? (language === 'bn' ? getBanglaNumberStr(existingRemark.totalAbsent) : String(existingRemark.totalAbsent)) : '—'}</span></span>
              </div>
            </div>
          </div>

          {/* Right side: Luxurious appraisal gold seal medallion */}
          <div className="border border-[#cf9c34] p-2.5 bg-gradient-to-br from-[#faf8f2] to-[#f4ecd2] rounded shadow-md flex flex-col justify-center items-center text-center relative overflow-hidden">
            {/* Elegant Background Circular Seal design vector */}
            <div className="absolute inset-0 opacity-[0.035] pointer-events-none stroke-[#5c0612] flex items-center justify-center">
              <svg className="w-24 h-24 stroke-current fill-none" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="38" strokeWidth="0.5" />
              </svg>
            </div>

            <dt className="text-[8px] font-black text-[#5c0612] tracking-widest uppercase leading-none">
              {language === 'bn' ? 'গ্রেড পয়েন্ট গড় (জিপিএ)' : 'GRADE POINT AVERAGE'}
            </dt>

            <dd className="my-1.5 flex items-baseline gap-1 relative z-10 select-all">
              <span className="text-[29px] font-black leading-none font-mono text-[#5c0612]">{language === 'bn' ? getBanglaNumberStr(gpa.toFixed(2)) : gpa.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-[#5c0612]/60 font-mono">/ {language === 'bn' ? '৫.০০' : '5.00'}</span>
            </dd>

            <div className="flex gap-x-1.5 items-center relative z-10 select-none pb-2">
              <span className="text-[8.5px] font-extrabold uppercase text-gray-500">{language === 'bn' ? 'প্রাপ্ত লেটার গ্রেড:' : 'FINAL GRADE:'}</span>
              <span className={`text-[12px] font-black px-2 py-0.5 rounded leading-none border shadow-inner ${isFail ? 'text-red-700 bg-red-100 border-red-300' : 'text-amber-900 bg-white border-amber-300'}`}>
                {grade}
              </span>
            </div>

            {/* Crest Official Medal Ribbon */}
            <div className="relative z-10 w-full mt-1 flex justify-center">
              <div className={`border-2 ${isFail ? 'border-red-500 text-red-700 bg-red-50' : 'border-[#cf9c34] text-amber-900 bg-white'} px-4 py-0.5 font-black text-[10px] rounded shadow-sm tracking-widest uppercase inline-block`}>
                {isFail ? (language === 'bn' ? 'অকৃতকার্য' : 'FAILED') : (language === 'bn' ? 'কৃতকার্য' : 'PASSED')}
              </div>
            </div>
          </div>

        </div>

        {/* FULL SYMMETRICAL CLEAN SIGNATURE SECTION (Perfect alignment across page footer) */}
        <div className="flex justify-between mt-auto items-end text-[10.5px] pb-1 border-t border-gray-100 pt-3 relative z-10 select-none gap-2">
          
          {/* Guardian Signature block */}
          <div className="w-36 text-center flex flex-col items-center">
            {schoolProfile.showGuardianSignature !== false ? (
              <>
                <div className="h-9" />
                <div className="w-11/12 border-t border-stone-300 pb-0.5 mt-1" />
                <span className="font-extrabold text-gray-800 uppercase">{t('guardian') || 'Guardian'}</span>
                <span className="text-[8.5px] text-gray-500 font-bold font-bangla leading-none">অভিভাবকের স্বাক্ষর</span>
              </>
            ) : <div className="w-36" />}
          </div>

          {/* Class Teacher Signature block */}
          <div className="w-36 text-center flex flex-col items-center">
            {schoolProfile.showClassTeacherSignature !== false ? (
              <>
                <div className="h-9" />
                <div className="w-11/12 border-t border-stone-300 pb-0.5 mt-1" />
                <span className="font-extrabold text-gray-800 uppercase">{t('classTeacher') || 'Class Teacher'}</span>
                <span className="text-[8.5px] text-gray-500 font-bold font-bangla leading-none">শ্রেণী শিক্ষকের স্বাক্ষর</span>
              </>
            ) : <div className="w-36" />}
          </div>

          {/* QR Verification Seal */}
          <div className="flex items-center justify-center px-1">
            <ResultVerificationQR
              student={student}
              exam={exam}
              schoolProfile={schoolProfile}
              language={language}
              size={48}
              onOpenVerification={() => setShowVerifyModal(true)}
            />
          </div>

          {/* Symmetrical Headmaster / Super Signature block */}
          <div className="w-48 text-center flex flex-col items-center">
            {schoolProfile.showHeadmasterSignature !== false ? (
              <div className="flex flex-col items-center w-full">
                <div className="h-9 flex items-center justify-center relative w-full select-none">
                  {schoolProfile.signatureUrl && (
                    <img src={schoolProfile.signatureUrl} className="absolute bottom-0 h-8 object-contain animate-fade-in" alt="Signature Seal" referrerPolicy="no-referrer" />
                  )}
                </div>
                
                <div className="w-11/12 border-t border-[#cf9c34]/50 pb-0.5 mt-1" />
                <span className="font-extrabold text-[#5c0612] uppercase truncate max-w-full select-all">
                  {language === 'bn' ? schoolProfile.headMasterNameBn || schoolProfile.headMasterName : schoolProfile.headMasterName || t('headMaster')}
                </span>
                <span className="text-[8.5px] text-gray-500 font-bold uppercase leading-none select-none">
                  {language === 'bn' ? 'অধ্যক্ষ / সুপার' : 'PRINCIPAL / HEADMASTER'}
                </span>
              </div>
            ) : <div className="w-48" />}
          </div>

        </div>

        {showVerifyModal && (
          <VerifiedResultModal
            student={student}
            exam={exam}
            schoolProfile={schoolProfile}
            subjects={subjects}
            marks={marks}
            exams={exams}
            language={language}
            onClose={() => setShowVerifyModal(false)}
          />
        )}

      </div>
    </div>
  );
};

export const MonthlyResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const primaryColor = 'border-blue-600';

  // Filter subjects
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(exam.id);
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const classSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => ({ 
      id: s.id, 
      ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
  })).sort((a, b) => {
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
      if (a.isFail && b.isFail) {
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          return b.totalMarks - a.totalMarks;
      }
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');
  const fontClass = language === 'bn' ? 'font-bangla' : '';

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-white mx-auto text-sm leading-tight border-4 ${primaryColor} p-6 w-full max-w-[210mm] ${isCompact ? 'h-[140mm]' : 'h-[290mm]'} relative shadow-md print:shadow-none ${fontClass} flex flex-col box-border`}
    >
      {/* Header */}
      <div className="text-center mb-4 relative z-10">
        <h1 className="text-2xl font-bold text-gray-900 uppercase">{language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}</h1>
        <p className="text-gray-600 text-[10px]">{language === 'bn' ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}</p>
        <div className="mt-2 border-b border-blue-600 inline-block px-4 pb-0.5">
           <h2 className="text-blue-600 font-bold uppercase text-sm">{t('academicTranscript')}</h2>
        </div>
        <h3 className="text-gray-800 font-bold uppercase text-xs mt-1">{language === 'bn' ? (exam.nameBn || (exam.name === 'Annual Examination' ? 'বার্ষিক পরীক্ষা' : exam.name)) : exam.name}</h3>
        <p className="text-xs mt-1">{t('yearSession')}: {formatNumber(schoolProfile.academicYear, language)}</p>
      </div>

      {/* Student Info Bar */}
      <div className="flex justify-between items-center border-y-2 border-gray-300 py-1 mb-4 text-xs font-bold">
        <span>{t('name')}: {language === 'bn' ? (student.nameBn || student.name) : student.name}</span>
        <div className="flex gap-8">
          <span>{t('studentId')}: {student.studentId ? formatNumber(student.studentId, language) : '-'}</span>
          <span>{t('class')}: {language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span>
        </div>
      </div>

      {/* Marks Table */}
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-blue-50">
              <th className="border border-gray-400 px-2 py-1 text-center w-10">{t('sn')}</th>
              <th className="border border-gray-400 px-2 py-1 text-left">{t('subject')}</th>
              <th className="border border-gray-400 px-2 py-1 text-center w-16">{t('fullMarks')}</th>
              <th className="border border-gray-400 px-2 py-1 text-center w-16">{t('highest')}</th>
              <th className="border border-gray-400 px-2 py-1 text-center w-16">{t('obtained')}</th>
              <th className="border border-gray-400 px-2 py-1 text-center w-16">{t('grade')}</th>
              <th className="border border-gray-400 px-2 py-1 text-center w-16">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {classSubjects.map((sub, idx) => {
              const markRecord = marks.find(m => m.studentId === student.id && m.subjectId === sub.id && m.examId === exam.id);
              const obtained = markRecord ? markRecord.obtained : 0;
              let { grade } = calculateGrade(obtained, sub.fullMarks);
              const isSubFail = markRecord?.isAbsent || obtained < sub.passMarks || (sub.hasCQ && (markRecord?.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0)) || (sub.hasMCQ && (markRecord?.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0));
              if (isSubFail) grade = 'F';

              const allMarksForThisSub = marks.filter(m => m.subjectId === sub.id && m.examId === exam.id);
              const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m.obtained)) : 0;

              return (
                <tr key={sub.id}>
                  <td className="border border-gray-400 px-2 py-1 text-center">{formatNumber(idx + 1, language)}</td>
                  <td className="border border-gray-400 px-2 py-1">{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{formatNumber(sub.fullMarks, language)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{formatNumber(highest, language)}</td>
                  <td className={`border border-gray-400 px-2 py-1 text-center font-bold ${isSubFail ? 'text-red-600' : 'text-black'}`}>{markRecord?.isAbsent ? t('absent') : formatNumber(obtained, language)}</td>
                  <td className={`border border-gray-400 px-2 py-1 text-center font-bold ${grade === 'F' ? 'text-red-600' : ''}`}>{markRecord ? grade : '-'}</td>
                  <td className={`border border-gray-400 px-2 py-1 text-center font-bold ${isSubFail ? 'text-red-600' : 'text-blue-600'}`}>{markRecord?.isAbsent ? t('absent') : (isSubFail ? t('st_Failed') : t('st_Passed'))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-bold bg-blue-50">
            <tr className="text-black">
              <td className="border border-gray-400 px-2 py-1 text-left" colSpan={2}>{t('total')}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{formatNumber(classSubjects.reduce((acc, s) => acc + s.fullMarks, 0), language)}</td>
              <td className="border border-gray-400 px-2 py-1 text-center"></td>
              <td className="border border-gray-400 px-2 py-1 text-center">{formatNumber(totalMarks, language)}</td>
              <td className="border border-gray-400 px-2 py-1 text-center"></td>
              <td className="border border-gray-400 px-2 py-1 text-center uppercase">{isFail ? t('st_Failed') : t('st_Passed')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 text-[10px]">
        <p className="mb-2"><span className="font-bold">{t('comments')}:</span> <span className="italic">{displayRemark}</span></p>
        <div className="flex justify-between items-center border-y border-gray-300 py-1 mb-4">
          <span className="font-bold">{t('position')}: {formatNumber(rank, language)}</span>
          {failCount > 0 && <span className="font-bold text-red-600">{t('failedSubject')}: {formatNumber(failCount, language)}</span>}
        </div>
        {(schoolProfile.showGuardianSignature !== false || schoolProfile.showHeadmasterSignature !== false) && (
          <div className="flex justify-between items-end mt-4 gap-2">
            <div className="flex flex-col items-center w-28">
                {schoolProfile.showGuardianSignature !== false && (
                  <div className="w-full border-t border-gray-800 pt-1 font-bold text-center">{t('guardianSignature')}</div>
                )}
            </div>

            <div className="flex items-center justify-center">
              <ResultVerificationQR
                student={student}
                exam={exam}
                schoolProfile={schoolProfile}
                language={language}
                size={40}
                onOpenVerification={() => setShowVerifyModal(true)}
              />
            </div>

            <div className="flex flex-col items-center w-36">
               {schoolProfile.showHeadmasterSignature !== false && (
                 <>
                   {schoolProfile.signatureUrl && <img src={schoolProfile.signatureUrl} alt="Signature" className="h-6 object-contain mb-1" referrerPolicy="no-referrer" />}
                   <div className="w-full border-t border-gray-800 pt-1 font-bold truncate text-center">
                     {language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName) : schoolProfile.headMasterName}
                   </div>
                 </>
               )}
            </div>
          </div>
        )}
      </div>

      {showVerifyModal && (
        <VerifiedResultModal
          student={student}
          exam={exam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </div>
  );
};


export const ResultCard: React.FC<ResultViewProps> = ({ student, exam }) => {
  const { schoolProfile, students, subjects, marks, remarks, language, t, exams } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter subjects for this student's class and exam
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === student.classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const allClassSubjects = classSubjectsInThisClass
    .filter(s => {
        // If any subject in this class is assigned to THIS specific exam, we use strict assignment
        if (anySubjectAssignedToThisExam) {
            return s.examIds && s.examIds.includes(exam.id);
        }
        // Otherwise, show all subjects for all exams (backward compatibility)
        return true;
    })
    .sort((a, b) => a.order - b.order);

  // Filter subjects for this student's group
  const classSubjects = allClassSubjects
    .filter(s => !s.group || s.group === 'All' || s.group === student.group);

  // Check if any subject in this class has CQ or MCQ to determine table layout
  const showCQ = classSubjects.some(s => s.hasCQ);
  const showMCQ = classSubjects.some(s => s.hasMCQ);

  const { totalMarks, gpa, grade, isFail, failCount } = calculateTotalGPA(classSubjects, marks, student.id, exam.id, student.group, exams);
  
  const existingRemark = remarks.find(r => r.studentId === student.id && r.examId === exam.id);
  const displayRemark = getFormattedRemarkWithAttendance(
    existingRemark?.remark?.trim() ? existingRemark.remark : getAutoRemark(gpa, isFail, failCount, language),
    existingRemark,
    language
  );

  // Calculate Rank
  const allClassStudents = students.filter(s => s.classLevel === student.classLevel && s.status === 'Active');
  const rankedStudents = allClassStudents.map(s => {
      // Need to re-calculate GPA for everyone to sort. 
      // allClassSubjects contains all subjects for this classLevel.
      return { 
          id: s.id, 
          ...calculateTotalGPA(allClassSubjects, marks, s.id, exam.id, s.group, exams) 
      };
  }).sort((a, b) => {
      // 1. Passers first, Failers last
      if (a.isFail && !b.isFail) return 1;
      if (!a.isFail && b.isFail) return -1;
  
      // 2. If both failed
      if (a.isFail && b.isFail) {
          // Less fail count is better (ranked higher)
          if (a.failCount !== b.failCount) return a.failCount - b.failCount;
          // If fail count same, Higher Total Marks is better
          return b.totalMarks - a.totalMarks;
      }
  
      // 3. If both passed
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return b.totalMarks - a.totalMarks;
  });

  const rank = rankedStudents.findIndex(s => s.id === student.id) + 1;
  
  const isCompact = (exam.category === 'Monthly' || exam.category === 'Model');
  const fontClass = language === 'bn' ? 'font-bangla' : '';

  return (
    <div 
      id={`result-${student.id}`} 
      ref={cardRef} 
      className={`bg-white mx-auto text-sm leading-relaxed border border-gray-200 print:border-none print:shadow-none relative ${fontClass} ${isCompact ? 'p-4 w-full max-w-[200mm] h-[140mm]' : 'p-8 w-full max-w-[200mm] h-[285mm]'} box-border`}
    >
      {/* Watermark */}
      {schoolProfile.showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0 overflow-hidden">
            {schoolProfile.watermarkUrl ? (
                <img src={schoolProfile.watermarkUrl} alt="Watermark" className="max-w-[80%] max-h-[80%] object-contain" />
            ) : (
                <div className="transform -rotate-45 text-9xl font-bold text-gray-900 whitespace-nowrap">
                    {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
                </div>
            )}
        </div>
      )}

      {/* Header */}
      <div className={`text-center border-b-2 border-gray-800 pb-4 mb-6 relative z-10 ${isCompact ? 'mb-4 pb-2' : 'mb-6 pb-4'}`}>
        <div className="flex items-center justify-center gap-4 mb-2">
            {schoolProfile.logoUrl && schoolProfile.showLogoOnCard !== false && <img src={schoolProfile.logoUrl} alt="Logo" className={`${isCompact ? 'w-12 h-12' : 'w-16 h-16'} object-contain`} />}
            <div>
                <h1 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 uppercase tracking-wide`}>{language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}</h1>
                <p className="text-gray-600 text-xs sm:text-sm truncate max-w-[400px] mx-auto">{language === 'bn' ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{t('est')}: {formatNumber(schoolProfile.established || '2000', language)} | {t('phone')}: {formatNumber(schoolProfile.phone, language)}</p>
            </div>
        </div>
        <div className={`mt-2 bg-gray-800 text-white inline-block px-4 py-0.5 rounded-full font-bold uppercase ${isCompact ? 'text-[10px]' : 'text-sm'}`}>
            {t('academicTranscript')}
        </div>
        <h2 className={`mt-1 font-semibold ${isCompact ? 'text-sm' : 'text-lg'}`}>{language === 'bn' ? (exam.nameBn || (exam.name === 'Annual Examination' ? 'বার্ষিক পরীক্ষা' : exam.name)) : exam.name} - {formatNumber(schoolProfile.academicYear, language)}</h2>
      </div>

      {/* Student Details */}
      <div className={`grid grid-cols-2 gap-x-4 gap-y-1 relative z-10 border border-gray-300 rounded bg-gray-50/50 ${isCompact ? 'mb-3 p-2 text-xs' : 'mb-5 p-3.5 text-sm'}`}>
        <div className="flex items-center overflow-hidden">
            <span className="font-semibold text-gray-700 w-24 shrink-0 flex justify-between pr-2">
                <span>{t('studentId')}</span>
                <span>:</span>
            </span> 
            <span className="font-mono font-bold truncate">
                {student.studentId ? formatNumber(student.studentId, language) : '-'}
            </span>
        </div>
        <div className="flex items-center overflow-hidden">
            <span className="font-semibold text-gray-700 w-20 shrink-0 flex justify-between pr-2">
                <span>{t('class')}</span>
                <span>:</span>
            </span> 
            <span className="font-bold truncate">{language === 'bn' ? (t(`cls_${student.classLevel.replace(' ', '')}` as any) || student.classLevel) : student.classLevel}</span>
        </div>
        {(student.classLevel === 'Class 9' || student.classLevel === 'Class 10') && student.group && (
            <div className="flex items-center overflow-hidden">
                <span className="font-semibold text-gray-700 w-24 shrink-0 flex justify-between pr-2">
                    <span>{t('group')}</span>
                    <span>:</span>
                </span> 
                <span className="font-semibold truncate">{language === 'bn' ? (t(student.group.toLowerCase() as any) || student.group) : student.group}</span>
            </div>
        )}
        <div className="flex items-center overflow-hidden">
            <span className="font-semibold text-gray-700 w-24 shrink-0 flex justify-between pr-2">
                <span>{t('name')}</span>
                <span>:</span>
            </span> 
            <span className="font-bold truncate">{language === 'bn' ? (student.nameBn || student.name) : student.name}</span>
        </div>
        <div className="flex items-center overflow-hidden">
            <span className="font-semibold text-gray-700 w-20 shrink-0 flex justify-between pr-2">
                <span>{t('fatherName')}</span>
                <span>:</span>
            </span> 
            <span className="truncate">{language === 'bn' ? (student.fatherNameBn || student.fatherName) : student.fatherName}</span>
        </div>
        <div className="flex items-center overflow-hidden col-span-2 sm:col-span-1 pt-1 border-t border-gray-200 mt-1">
            <span className="font-semibold text-gray-700 w-24 shrink-0 flex justify-between pr-2">
                <span>{t('position')}</span>
                <span>:</span>
            </span> 
            <span className="font-bold font-mono text-blue-900">{formatNumber(rank, language)}</span>
        </div>
      </div>

      {/* Marks Table */}
      <div className="mb-6 relative z-10">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-center w-12">{t('no')}</th>
              <th className="border border-gray-300 px-3 py-2 text-left">{t('subject')}</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-20">{t('fullMarks')}</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-20">{t('highest')}</th>
              {showCQ && <th className="border border-gray-300 px-3 py-2 text-center w-16">{t('cqMarks')}</th>}
              {showMCQ && <th className="border border-gray-300 px-3 py-2 text-center w-16">{t('mcqMarks')}</th>}
              <th className="border border-gray-300 px-3 py-2 text-center w-20">{t('obtained')}</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-16">{t('grade')}</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-16">{t('gpa')}</th>
            </tr>
          </thead>
          <tbody>
            {classSubjects.map((sub, idx) => {
              const markRecord = marks.find(m => m.studentId === student.id && m.subjectId === sub.id && m.examId === exam.id);
              const obtained = markRecord ? markRecord.obtained : 0;
              let { grade, gpa } = calculateGrade(obtained, sub.fullMarks);
              const isSubFail = markRecord?.isAbsent || obtained < sub.passMarks;

              const allMarksForThisSub = marks.filter(m => m.subjectId === sub.id && m.examId === exam.id);
              const highest = allMarksForThisSub.length > 0 ? Math.max(...allMarksForThisSub.map(m => m.obtained)) : 0;

              // Specific Fail checks
              let specificFail = markRecord?.isAbsent || false;
              let isCQFail = false;
              let isMCQFail = false;

              if (markRecord?.isAbsent) {
                  specificFail = true;
              } else {
                  if (sub.hasCQ && (markRecord?.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0)) {
                      specificFail = true;
                      isCQFail = true;
                  }
                  if (sub.hasMCQ && (markRecord?.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0)) {
                      specificFail = true;
                      isMCQFail = true;
                  }
              }

              // Force Grade F if component failed
              if (specificFail) {
                  grade = 'F';
                  gpa = 0.0;
              }

              return (
                <tr key={sub.id}>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatNumber(idx + 1, language)}</td>
                  <td className="border border-gray-300 px-3 py-2">
                    {language === 'bn' ? (sub.nameBn || sub.name) : sub.name} {sub.isOptional && <span className="text-[10px] text-gray-500">({t('optional')})</span>}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatNumber(sub.fullMarks, language)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{formatNumber(highest, language)}</td>
                  
                  {showCQ && (
                    <td className={`border border-gray-300 px-3 py-2 text-center ${isCQFail ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                      {sub.hasCQ ? (markRecord?.isAbsent ? t('absent') : (markRecord?.obtainedCQ !== undefined ? formatNumber(markRecord.obtainedCQ, language) : '-')) : '-'}
                    </td>
                  )}
                  {showMCQ && (
                    <td className={`border border-gray-300 px-3 py-2 text-center ${isMCQFail ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                      {sub.hasMCQ ? (markRecord?.isAbsent ? t('absent') : (markRecord?.obtainedMCQ !== undefined ? formatNumber(markRecord.obtainedMCQ, language) : '-')) : '-'}
                    </td>
                  )}

                  <td className={`border border-gray-300 px-3 py-2 text-center font-medium ${isSubFail || specificFail ? 'text-red-600 underline' : 'text-black'}`}>
                    {markRecord ? (markRecord.isAbsent ? t('absent') : formatNumber(obtained, language)) : '-'}
                  </td>
                  <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${grade === 'F' ? 'text-red-600' : ''}`}>{markRecord ? grade : '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{markRecord ? formatNumber(gpa.toFixed(2), language) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              <td colSpan={2 + (showCQ ? 1 : 0) + (showMCQ ? 1 : 0) + 2} className="border border-gray-300 px-3 py-2 text-right">{t('totalResult')}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-black">{formatNumber(totalMarks, language)}</td>
              <td className={`border border-gray-300 px-3 py-2 text-center ${isFail ? 'text-red-600' : 'text-green-600'}`}>{grade}</td>
              <td className="border border-gray-300 px-3 py-2 text-center">{formatNumber(gpa.toFixed(2), language)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* Remarks Section */}
      <div className="mb-12 relative z-10 border border-gray-300 p-4 rounded bg-gray-50 min-h-[80px]">
        <h4 className="font-bold text-gray-700 underline mb-1">{t('remark')}:</h4>
        <p className="text-gray-800 italic">{displayRemark}</p>
      </div>

      {/* Footer */}
      {(schoolProfile.showGuardianSignature !== false || schoolProfile.showHeadmasterSignature !== false) && (
        <div className={`flex justify-between items-end mt-12 text-center relative z-10 gap-4 ${isCompact ? 'mt-6' : 'mt-12'}`}>
          <div className="flex flex-col items-center">
               <div className="h-[85px] mb-1 flex flex-col items-center justify-end">
                  <div className="h-12" /> {/* Spacer to match Headmaster's signature image */}
                  {schoolProfile.showGuardianSignature !== false && (
                    <div className="w-36 border-t border-gray-400 pt-1">
                        <p className="font-bold text-gray-800 text-xs">{t('guardianSignature')}</p>
                        <p className="text-[10px]">&nbsp;</p> {/* Spacer to match Headmaster's title */}
                    </div>
                  )}
               </div>
          </div>

          <div className="flex items-center justify-center mb-2">
            <ResultVerificationQR
              student={student}
              exam={exam}
              schoolProfile={schoolProfile}
              language={language}
              size={52}
              onOpenVerification={() => setShowVerifyModal(true)}
            />
          </div>

          <div className="flex flex-col items-center">
               <div className="h-[85px] mb-1 flex flex-col items-center justify-end">
                    {schoolProfile.showHeadmasterSignature !== false && (
                      <>
                        {schoolProfile.signatureUrl ? <img src={schoolProfile.signatureUrl} alt="Signature" className="h-12 object-contain mb-1" referrerPolicy="no-referrer" /> : <div className="h-12" />}
                        <div className="w-40 border-t border-gray-400 pt-1">
                          <p className="font-bold text-gray-800 truncate max-w-[160px] text-xs">{language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName) : schoolProfile.headMasterName}</p>
                          <p className="text-[10px] text-gray-500 font-semibold uppercase">{t('headMaster')}</p>
                        </div>
                      </>
                    )}
               </div> 
          </div>
        </div>
      )}

      {showVerifyModal && (
        <VerifiedResultModal
          student={student}
          exam={exam}
          schoolProfile={schoolProfile}
          subjects={subjects}
          marks={marks}
          exams={exams}
          language={language}
          onClose={() => setShowVerifyModal(false)}
        />
      )}
    </div>
  );
};

export const ResultGenerator = () => {
    const { students, exams, subjects, marks, classes, t, language, schoolProfile } = useApp();
    const [mode, setMode] = useState<'individual' | 'whole_class'>('individual');
    const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<string>('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [showPreviewVerifyModal, setShowPreviewVerifyModal] = useState(false);
    const [showSmsModal, setShowSmsModal] = useState(false);

    // Filter students
    const classStudents = students
        .filter(s => s.classLevel === selectedClass && s.status === 'Active' && !s.isFormer)
        .sort((a, b) => {
            if (a.studentId && b.studentId) return a.studentId.localeCompare(b.studentId);
            return a.name.localeCompare(b.name);
        });
    
    // Calculate results and filter/sort for whole class
    const classSubjectsInThisClass = subjects.filter(s => s.classLevel === selectedClass);
    const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(selectedExamId));
    const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;
    const allClassSubjects = classSubjectsInThisClass.filter(s => {
        if (anySubjectAssignedToThisExam) return s.examIds && s.examIds.includes(selectedExamId);
        return true;
    });

    const studentsWithResults = classStudents.map(student => {
        const studentSubjects = allClassSubjects.filter(s => !s.group || s.group === 'All' || s.group === student.group);
        const result = calculateTotalGPA(studentSubjects, marks, student.id, selectedExamId, student.group, exams);
        
        // Check if absent in all subjects
        const studentMarks = marks.filter(m => m.studentId === student.id && m.examId === selectedExamId);
        const isAbsentAll = studentSubjects.length > 0 && studentSubjects.every(sub => {
            const m = studentMarks.find(mark => mark.subjectId === sub.id);
            return m && m.isAbsent;
        });

        return { student, result, isAbsentAll };
    });

    // For Whole Class: Filter out those absent in all subjects and sort by rank
    const wholeClassStudents = studentsWithResults
        .filter(s => !s.isAbsentAll)
        .sort((a, b) => {
            const ra = a.result;
            const rb = b.result;
            if (ra.isFail && !rb.isFail) return 1;
            if (!ra.isFail && rb.isFail) return -1;
            if (ra.isFail && rb.isFail) {
                if (ra.failCount !== rb.failCount) return ra.failCount - rb.failCount;
                return rb.totalMarks - ra.totalMarks;
            }
            if (rb.gpa !== ra.gpa) return rb.gpa - ra.gpa;
            return rb.totalMarks - ra.totalMarks;
        })
        .map(s => s.student);

    // For Individual mode, filter to single student or all when batch downloading
    const displayedStudents = mode === 'individual' 
        ? (isBatchDownloading ? classStudents : classStudents.filter(s => s.id === selectedStudentId))
        : wholeClassStudents;

    const selectedExam = exams.find(e => e.id === selectedExamId);

    const handleBatchDownloadAllCards = async () => {
        if (!selectedExam || classStudents.length === 0) return;
        setIsBatchDownloading(true);
        await new Promise(resolve => setTimeout(resolve, 250));

        const container = document.querySelector('.print-container') as HTMLElement;
        if (container) {
            await generatePDF(container, `All_Student_Result_Cards_${selectedClass}_${selectedExam.name}.pdf`);
        }
        setIsBatchDownloading(false);
    };

    // Helper to generate PDF with clean, isolated off-screen staging to prevent scroll-clipping, shadows, or border glitches
    const generatePDF = async (elementId: string | HTMLElement, filename: string) => {
        let element: HTMLElement | null = null;
        if (typeof elementId === 'string') {
            element = document.getElementById(elementId);
        } else {
            element = elementId;
        }

        if (!element) {
            console.error('Element not found for PDF generation');
            return;
        }

        setIsGenerating(true);
        setGenerationProgress('...');

        // Create dedicated off-screen stage
        const stage = document.createElement('div');
        stage.id = 'pdf-render-stage';
        stage.style.position = 'absolute';
        stage.style.left = '-9999px';
        stage.style.top = '0';
        stage.style.zIndex = '0';
        stage.style.width = '794px'; // Exactly 210mm at 96 DPI
        stage.style.height = '1123px'; // Exactly 297mm at 96 DPI
        stage.style.backgroundColor = '#ffffff';
        stage.style.margin = '0';
        stage.style.padding = '0';
        stage.style.overflow = 'hidden';
        stage.style.boxSizing = 'border-box';
        document.body.appendChild(stage);

        try {
            if (typeof document !== 'undefined' && (document as any).fonts) {
                await (document as any).fonts.ready.catch(() => {});
            }
            // Give DOM time to stabilize styles
            await new Promise(resolve => setTimeout(resolve, 200));

            // Look for individual A4 page wrappers
            const pageElements = Array.from(element.querySelectorAll<HTMLElement>('.a4-page-wrapper'));
            const targets = pageElements.length > 0 ? pageElements : [element];

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });

            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                setGenerationProgress(`${i + 1}/${targets.length}`);

                stage.innerHTML = '';
                const clone = target.cloneNode(true) as HTMLElement;
                clone.style.width = '794px';
                clone.style.height = '1123px';
                clone.style.margin = '0';
                clone.style.padding = '0';
                clone.style.boxShadow = 'none';
                clone.style.border = 'none';
                clone.style.backgroundColor = '#ffffff';
                clone.style.display = 'flex';
                clone.style.flexDirection = 'column';
                clone.style.justifyContent = 'center';
                clone.style.alignItems = 'center';

                // Strip any drop-shadows, outlines, or buggy CSS properties from all cloned children
                clone.querySelectorAll('*').forEach((el: any) => {
                    if (el.style) {
                        el.style.boxShadow = 'none';
                        if (el.style.borderStyle === 'double') el.style.borderStyle = 'solid';
                        if (el.style.outline) el.style.outline = 'none';
                    }
                    el.classList.remove('shadow-2xl', 'shadow-xl', 'shadow-lg', 'shadow-md', 'shadow-sm', 'shadow');
                });

                stage.appendChild(clone);
                // Allow rendering to settle
                await new Promise(resolve => setTimeout(resolve, 60));

                const canvas = await html2canvas(stage, {
                    scale: 2.2, // ~210 DPI, crisp text and clean lines
                    useCORS: true,
                    logging: false,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    x: 0,
                    y: 0,
                    width: 794,
                    height: 1123
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.96);
                if (i > 0) {
                    pdf.addPage('a4', 'portrait');
                }
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            }

            setGenerationProgress('Saving');
            pdf.save(filename);
        } catch (err) {
            console.error('PDF Generation failed, falling back to window.print()', err);
            window.print();
        } finally {
            if (document.body.contains(stage)) {
                document.body.removeChild(stage);
            }
            setIsGenerating(false);
            setGenerationProgress('');
        }
    };

    const handleDownloadWholeClassPDF = () => {
        const container = document.querySelector('.print-container') as HTMLElement;
        if (!container) return;
        generatePDF(container, `Results_${selectedClass}_${selectedExam?.name}.pdf`);
    };

    const handleDownloadIndividualPDF = () => {
        if (!selectedExam || displayedStudents.length === 0) return;
        const student = displayedStudents[0];
        const filename = `Result_${student.studentId || student.name}.pdf`;
        const container = document.querySelector('.print-container') as HTMLElement;
        if (container) {
            generatePDF(container, filename);
        } else {
            generatePDF(`result-${student.id}`, filename);
        }
    };

    const handleDownloadWord = () => {
        if (!selectedExam) return;
        setShowExportMenu(false);
        
        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>{t('results')}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; font-size: 12pt; }
                    .page-break { page-break-after: always; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    td, th { border: 1px solid #000; padding: 6px; text-align: center; }
                    .text-left { text-align: left; }
                    .text-right { text-align: right; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .no-border { border: none !important; }
                </style>
            </head>
            <body>
        `;
        const footer = "</body></html>";
        let sourceHTML = header;
        
        displayedStudents.forEach(student => {
             const element = document.getElementById(`result-${student.id}`);
             if(element) {
                 const clone = element.cloneNode(true) as HTMLElement;
                 // Remove print specific classes if any that might hide content
                 sourceHTML += clone.outerHTML + "<br class='page-break' />";
             }
        });
        
        sourceHTML += footer;
        
        const blob = new Blob(['\ufeff', sourceHTML], {
            type: 'application/msword'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Results_${selectedClass}_${mode}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadExcel = () => {
        setShowExportMenu(false);
        let csvContent = "Student ID,Name,Class,Exam,Total Marks,GPA,Grade\n";
        
        const classSubjectsInThisClass = subjects.filter(s => s.classLevel === selectedClass);
        const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(selectedExamId));
        const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

        displayedStudents.forEach(student => {
             const classSubjects = classSubjectsInThisClass
                .filter(s => {
                    if (anySubjectAssignedToThisExam) {
                        return s.examIds && s.examIds.includes(selectedExamId);
                    }
                    return true;
                })
                .filter(s => !s.group || s.group === 'All' || s.group === student.group);
             
             const { totalMarks, gpa, grade } = calculateTotalGPA(classSubjects, marks, student.id, selectedExamId, student.group, exams);
             const safeName = student.name.replace(/"/g, '""');
             csvContent += `"${student.studentId || ''}","${safeName}",${student.classLevel},"${selectedExam?.name}",${totalMarks},${gpa},${grade}\n`;
        });

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Results_${selectedClass}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{t('resultGen')}</h2>
                    <p className="text-gray-500 text-sm">{t('resultGenDesc')}</p>
                </div>
            </div>

            {/* Mode Selection Tabs */}
            <div className="flex gap-4 border-b border-gray-200 print:hidden">
                <button
                    onClick={() => setMode('individual')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'individual' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <User size={16}/> {t('individualCards')}
                </button>
                <button
                    onClick={() => setMode('whole_class')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'whole_class' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16}/> {t('wholeClassResults')}
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('exam')}</label>
                    <select 
                        className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                    >
                        <option value="">{t('selectExam')}...</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name} ({formatNumber(e.academicYear, language)})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('class')}</label>
                    <select 
                        className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value);
                            setSelectedStudentId('');
                        }}
                    >
                        {classes.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                    </select>
                </div>

                {mode === 'individual' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('students')}</label>
                        <select 
                            className="w-full border border-gray-300 rounded-md p-2 bg-white text-gray-900"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                        >
                            <option value="">{t('selectStudent')}...</option>
                            {classStudents.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.studentId ? `${formatNumber(s.studentId, language)} - ` : ''}
                                    {language === 'bn' ? (s.nameBn || s.name) : s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            
            {/* Action Bar */}
            <div className="flex justify-end gap-2 print:hidden z-20 relative">
                {mode === 'individual' && classStudents.length > 0 && (
                    <Button 
                        onClick={handleBatchDownloadAllCards} 
                        variant="secondary" 
                        disabled={isGenerating || !selectedExamId}
                        className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 flex items-center gap-2"
                        title={t('batchDownloadAllCardsDesc')}
                    >
                        {isGenerating && isBatchDownloading ? (
                            <Loader2 size={16} className="animate-spin"/>
                        ) : (
                            <Download size={16}/>
                        )}
                        {isGenerating && isBatchDownloading ? (generationProgress ? `${t('generating') || 'Generating...'} (${generationProgress})` : (t('generating') || 'Generating...')) : t('batchDownloadAllCards')}
                    </Button>
                )}
                {mode === 'individual' && selectedStudentId && (
                    <Button 
                        onClick={() => setShowPreviewVerifyModal(true)} 
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5"
                        title={language === 'bn' ? 'ডিজিটাল কিউআর কোড ফলাফল যাচাই সনদ প্রিভিউ' : 'Preview Digital QR Verification Record'}
                    >
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <span>{language === 'bn' ? 'QR যাচাই সনদ' : 'Verify QR Record'}</span>
                    </Button>
                )}
                {mode === 'individual' && selectedStudentId && (
                    <Button onClick={handleDownloadIndividualPDF} disabled={isGenerating}>
                        {isGenerating ? (
                            <Loader2 size={16} className="mr-2 animate-spin"/>
                        ) : (
                            <Download size={16} className="mr-2"/>
                        )}
                        {isGenerating ? (generationProgress ? `${t('generating') || 'Generating...'} (${generationProgress})` : (t('generating') || 'Generating...')) : (t('downloadPDF') || 'Print / Save PDF')}
                    </Button>
                )}
                {/* Replaced Print with Download PDF for Whole Class */}
                {mode === 'whole_class' && (
                    <Button onClick={handleDownloadWholeClassPDF} disabled={isGenerating}>
                        {isGenerating ? (
                            <Loader2 size={16} className="mr-2 animate-spin"/>
                        ) : (
                            <Download size={16} className="mr-2"/>
                        )}
                        {isGenerating ? (generationProgress ? `${t('generating') || 'Generating...'} (${generationProgress})` : (t('generating') || 'Generating...')) : 'Print / Save All (PDF)'}
                    </Button>
                )}
                
                {selectedExam && (
                    <Button
                        onClick={() => setShowSmsModal(true)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        title={language === 'bn' ? 'অভিভাবকদের মোবাইল নম্বরে ফলাফলের স্বয়ংক্রিয় এসএমএস পাঠান' : 'Send automated Result SMS to parents'}
                    >
                        <MessageSquare size={16} />
                        <span>{language === 'bn' ? 'ফলাফল এসএমএস' : 'Result SMS'}</span>
                    </Button>
                )}

                <div className="relative">
                    <Button 
                        variant="secondary" 
                        className="flex items-center gap-2"
                        onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                        <Download size={18} /> {t('export')} <ChevronDown size={14} />
                    </Button>
                    
                    {showExportMenu && (
                        <>
                            <div 
                                className="fixed inset-0 z-10 cursor-default" 
                                onClick={() => setShowExportMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                                <button onClick={handleDownloadWord} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                                    <FileText size={16} /> Export to Word
                                </button>
                                <button onClick={handleDownloadExcel} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                                    <FileSpreadsheet size={16} /> Export to Excel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {selectedExam && displayedStudents.length > 0 ? (
                <div className="print-container overflow-x-auto max-w-full pb-6 print:overflow-visible">
                    {(() => {
                        const isCompact = (selectedExam.category === 'Monthly' || selectedExam.category === 'Model');
                        const chunkSize = isCompact ? 2 : 1;
                        const pages = [];
                        for (let i = 0; i < displayedStudents.length; i += chunkSize) {
                            pages.push(displayedStudents.slice(i, i + chunkSize));
                        }

                        return pages.map((pageStudents, pageIndex) => (
                            <div 
                                key={`page-${pageIndex}`} 
                                className={`a4-page-wrapper ${isGenerating ? 'p-0 m-0' : 'mb-8 shadow-xl border border-gray-200'}`}
                                style={{ 
                                    width: '210mm', 
                                    height: isGenerating ? '296.5mm' : '297mm', 
                                    pageBreakAfter: pageIndex === pages.length - 1 ? 'auto' : 'always', 
                                    pageBreakInside: 'avoid',
                                    position: 'relative',
                                    margin: isGenerating ? '0' : '0 auto',
                                    backgroundColor: 'white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {pageStudents.map((student, studentIndex) => (
                                    <React.Fragment key={student.id}>
                                        <div style={{ height: isCompact ? '148.2mm' : (isGenerating ? '296.5mm' : '297mm'), width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ transform: isCompact ? 'scale(0.95)' : 'scale(1)', transformOrigin: 'center center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {schoolProfile.resultCardTemplate === 'Premium_Royal' ? (
                                                    <PremiumRoyalResultCard student={student} exam={selectedExam} />
                                                ) : schoolProfile.resultCardTemplate === 'Premium_Colored' ? (
                                                    <PremiumColoredResultCard student={student} exam={selectedExam} />
                                                ) : schoolProfile.resultCardTemplate === 'Premium_Dakhil' ? (
                                                    <PremiumDakhilResultCard student={student} exam={selectedExam} />
                                                ) : schoolProfile.resultCardTemplate === 'BW_Term' ? (
                                                    <BWTermResultCard student={student} exam={selectedExam} />
                                                ) : schoolProfile.resultCardTemplate === 'Term' ? (
                                                    <TermResultCard student={student} exam={selectedExam} />
                                                ) : schoolProfile.resultCardTemplate === 'Monthly' ? (
                                                    <MonthlyResultCard student={student} exam={selectedExam} />
                                                ) : (
                                                    <ResultCard student={student} exam={selectedExam} />
                                                )}
                                            </div>
                                        </div>
                                        {isCompact && studentIndex === 0 && pageStudents.length > 1 && (
                                            <div style={{ 
                                                width: '100%', 
                                                borderTop: '1px dashed #ccc', 
                                                position: 'absolute', 
                                                top: '50%', 
                                                left: 0, 
                                                zIndex: 50,
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ backgroundColor: 'white', padding: '0 10px', color: '#999', fontSize: '10px', marginTop: '-6px' }}>✂ Cut Here ✂</span>
                                            </div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        ));
                    })()}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 print:hidden">
                    <p className="text-gray-500">
                        {mode === 'individual' && !selectedStudentId ? 'Please select a student to view result.' : t('noData')}
                    </p>
                </div>
            )}

            {showPreviewVerifyModal && selectedExam && displayedStudents.length > 0 && (
                <VerifiedResultModal
                    student={displayedStudents[0]}
                    exam={selectedExam}
                    schoolProfile={schoolProfile}
                    subjects={subjects}
                    marks={marks}
                    exams={exams}
                    language={language}
                    onClose={() => setShowPreviewVerifyModal(false)}
                />
            )}

            {showSmsModal && selectedExam && (
                <ResultSmsNotificationModal
                    isOpen={showSmsModal}
                    onClose={() => setShowSmsModal(false)}
                    exam={selectedExam}
                    classLevel={selectedClass}
                    selectedStudent={mode === 'individual' && selectedStudentId ? classStudents.find(s => s.id === selectedStudentId) : null}
                />
            )}
        </div>
    );
};