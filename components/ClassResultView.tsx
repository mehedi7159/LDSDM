import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Exam } from '../types';
import { calculateTotalGPA, formatNumber, shortenSubjectName, toBengali } from '../services/utils';

interface Props {
  exam: Exam;
  classLevel: string;
}

export const ClassResultView: React.FC<Props> = ({ exam, classLevel }) => {
  const { schoolProfile, students, subjects, marks, t, language, exams } = useApp();
  const [sortBy, setSortBy] = useState<'merit' | 'name' | 'id'>('merit');

  const classStudents = students
    .filter(s => s.classLevel === classLevel && s.status === 'Active' && !s.isFormer);
  
  const classSubjectsInThisClass = subjects.filter(s => s.classLevel === classLevel);
  const subjectsAssignedToThisExam = classSubjectsInThisClass.filter(s => s.examIds && s.examIds.includes(exam.id));
  const anySubjectAssignedToThisExam = subjectsAssignedToThisExam.length > 0;

  const classSubjects = classSubjectsInThisClass
    .filter(s => {
        if (anySubjectAssignedToThisExam) {
            return s.examIds && s.examIds.includes(exam.id);
        }
        return true;
    })
    .sort((a, b) => a.order - b.order);

  const calculateStats = (studentId: string, studentGroup?: string) => {
    return calculateTotalGPA(classSubjects, marks, studentId, exam.id, studentGroup, exams);
  };

  const processedStudents = classStudents.map(student => {
    const stats = calculateStats(student.id, student.group);
    return { ...student, ...stats };
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'id') return (a.studentId || '').localeCompare(b.studentId || '');
    
    // Default: Merit (Passers first, then GPA, then Marks)
    if (a.isFail && !b.isFail) return 1;
    if (!a.isFail && b.isFail) return -1;

    if (a.isFail && b.isFail) {
        if (a.failCount !== b.failCount) return a.failCount - b.failCount;
        return b.totalMarks - a.totalMarks;
    }

    if (b.gpa !== a.gpa) return b.gpa - a.gpa;
    return b.totalMarks - a.totalMarks;
  });

  // Calculate Class Statistics
  const totalStudents = processedStudents.length;
  const passedStudents = processedStudents.filter(s => !s.isFail).length;
  const failedStudents = totalStudents - passedStudents;
  const gpa5Count = processedStudents.filter(s => !s.isFail && s.gpa >= 5.0).length;
  const passRate = totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(2) : '0.00';

  const studentCount = processedStudents.length;
  const fontClass = language === 'bn' ? 'font-bangla' : '';
  const rowPaddingClass = studentCount <= 12 
    ? 'py-3 px-1.5' 
    : studentCount <= 18 
      ? 'py-2 px-1' 
      : studentCount <= 26 
        ? 'py-1.5 px-0.5' 
        : 'py-1 px-0.5';

  const baseTableFontSize = classSubjects.length > 12 
    ? 'text-[11px]' 
    : classSubjects.length > 8 
      ? 'text-[11.5px]' 
      : 'text-[12px]';

  return (
    <div 
      id="tabulation-sheet-inner" 
      className={`bg-white text-black print:border-none print:shadow-none p-3 sm:p-4 w-full ${fontClass}`}
      style={{ boxSizing: 'border-box' }}
    >
        {/* Official Header */}
        <div className="text-center mb-3 pb-2 border-b-2 border-black">
             <div className="text-[12px] font-bold text-[#001f3f] tracking-wider mb-0.5">
               بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
             </div>
             <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-serif uppercase leading-tight text-black">
               {language === 'bn' ? (schoolProfile.nameBn || schoolProfile.name) : schoolProfile.name}
             </h1>
             <p className="text-[11.5px] text-gray-800 font-semibold leading-normal mt-0.5">
               {language === 'bn' ? (schoolProfile.addressBn || schoolProfile.address) : schoolProfile.address}
               {schoolProfile.phone && ` | ${language === 'bn' ? 'ফোন' : 'Phone'}: ${formatNumber(schoolProfile.phone, language)}`}
               {schoolProfile.established && ` | ${language === 'bn' ? 'স্থাপিত' : 'Estd'}: ${formatNumber(schoolProfile.established, language)}`}
             </p>
             <div className="inline-block border border-black px-4 py-0.5 my-1.5 bg-gray-100 font-black text-[13px] tracking-wider uppercase">
               {language === 'bn' ? 'টেবুলেশন শীট' : 'TABULATION SHEET'}
             </div>
             <p className="text-[12.5px] font-bold text-gray-900">
               {language === 'bn' ? (exam.nameBn || exam.name) : exam.name} 
               {' — '} 
               {language === 'bn' ? (t(`cls_${classLevel.replace(' ', '')}` as any) || classLevel) : classLevel} 
               {' ('}
               {t('academicYear')}: {formatNumber(schoolProfile.academicYear, language)}
               {')'}
             </p>
             
             {/* Controls (Hidden in Print & PDF) */}
             <div className="mt-2 flex justify-center gap-4 print:hidden" data-html2canvas-ignore="true">
                <span className="text-xs font-semibold text-gray-600">বাছাই (Sort By):</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer font-medium">
                    <input type="radio" name="sortBy" value="merit" checked={sortBy === 'merit'} onChange={() => setSortBy('merit')} /> মেধা ক্রম (Merit)
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer font-medium">
                    <input type="radio" name="sortBy" value="id" checked={sortBy === 'id'} onChange={() => setSortBy('id')} /> রোল নং (Roll No)
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer font-medium">
                    <input type="radio" name="sortBy" value="name" checked={sortBy === 'name'} onChange={() => setSortBy('name')} /> নাম (Name)
                </label>
             </div>
        </div>

        {/* Master Tabulation Table */}
        <div className="w-full overflow-x-auto print:overflow-visible">
          <table className={`w-full border-collapse border-2 border-black text-black leading-tight table-auto ${baseTableFontSize}`}>
              <thead>
                  <tr className="bg-gray-200 text-black font-extrabold border-b border-black">
                      <th className="border border-black px-1.5 py-2.5 text-center align-middle w-9" rowSpan={2}>
                          {language === 'bn' ? 'ক্রম' : 'SL'}
                      </th>
                      <th className="border border-black px-1.5 py-2.5 text-center align-middle w-14" rowSpan={2}>
                          {language === 'bn' ? 'রোল' : 'Roll'}
                      </th>
                      <th className="border border-black px-3 py-2.5 text-left align-middle min-w-[130px]" rowSpan={2}>
                          {language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}
                      </th>
                      {classSubjects.map(sub => {
                          const rawName = language === 'bn' ? (sub.nameBn || sub.name) : sub.name;
                          const shortName = shortenSubjectName(rawName);
                          const subColumns = (sub.hasCQ ? 1 : 0) + (sub.hasMCQ ? 1 : 0) + 1;
                          return (
                              <th 
                                key={sub.id} 
                                className="border border-black px-1 py-2 text-center font-bold align-middle bg-gray-100" 
                                colSpan={subColumns}
                              >
                                  <div className="text-[11px] font-extrabold leading-snug px-0.5 text-center break-words whitespace-normal max-w-[75px] mx-auto">
                                      {shortName}
                                  </div>
                              </th>
                          );
                      })}
                      <th className="border border-black px-1.5 py-2.5 bg-gray-200 text-center align-middle w-12" rowSpan={2}>
                          {language === 'bn' ? 'মোট' : 'Total'}
                      </th>
                      <th className="border border-black px-1.5 py-2.5 bg-gray-200 text-center align-middle w-12" rowSpan={2}>
                          {language === 'bn' ? 'জিপিএ' : 'GPA'}
                      </th>
                      <th className="border border-black px-1.5 py-2.5 bg-gray-200 text-center align-middle w-11" rowSpan={2}>
                          {language === 'bn' ? 'গ্রেড' : 'Grade'}
                      </th>
                      <th className="border border-black px-1.5 py-2.5 bg-gray-200 text-center align-middle w-14" rowSpan={2}>
                          {language === 'bn' ? 'ফলাফল' : 'Result'}
                      </th>
                  </tr>
                  <tr className="bg-gray-100 text-black">
                      {classSubjects.map(sub => (
                          <React.Fragment key={`sub-header-${sub.id}`}>
                              {sub.hasCQ && <th className="border border-black px-0.5 py-1 text-[9.5px] text-gray-800 font-bold text-center min-w-[28px]">{t('cq') || 'CQ'}</th>}
                              {sub.hasMCQ && <th className="border border-black px-0.5 py-1 text-[9.5px] text-gray-800 font-bold text-center min-w-[28px]">{t('mcq') || 'MCQ'}</th>}
                              <th className="border border-black px-0.5 py-1 text-[10px] font-black text-center min-w-[32px]">{t('tot') || 'মোট'}</th>
                          </React.Fragment>
                      ))}
                  </tr>
              </thead>
              <tbody>
                  {processedStudents.map((student, idx) => {
                      const isPassing = !student.isFail;
                      return (
                          <tr 
                            key={student.id} 
                            className={`border-b border-black/70 hover:bg-yellow-50/40 ${idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}`}
                          >
                              {/* Position / SL */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-mono font-bold text-black`}>
                                  {formatNumber(idx + 1, language)}
                              </td>
                              {/* Roll No */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-mono font-bold text-black`}>
                                  {student.studentId ? formatNumber(student.studentId, language) : '—'}
                              </td>
                              {/* Student Name */}
                              <td className={`border border-black ${rowPaddingClass} px-2.5 font-bold text-black text-left whitespace-nowrap overflow-hidden text-ellipsis`}>
                                  <span className="text-[12px]">{language === 'bn' ? (student.nameBn || student.name) : student.name}</span>
                                  {student.group && (
                                    <span className="ml-1 text-[9.5px] font-normal text-gray-600">
                                      ({student.group === 'Science' ? 'বিজ্ঞান' : student.group === 'General' ? 'সাধারণ' : student.group})
                                    </span>
                                  )}
                              </td>
                              {/* Subject Marks */}
                              {classSubjects.map(sub => {
                                  const isApplicable = !sub.group || sub.group === 'All' || sub.group === student.group;
                                  if (!isApplicable) {
                                      return (
                                          <React.Fragment key={`sub-cell-${sub.id}-${student.id}`}>
                                              {sub.hasCQ && <td className={`border border-black ${rowPaddingClass} text-center text-gray-400 font-mono`}>—</td>}
                                              {sub.hasMCQ && <td className={`border border-black ${rowPaddingClass} text-center text-gray-400 font-mono`}>—</td>}
                                              <td className={`border border-black ${rowPaddingClass} text-center text-gray-400 font-mono`}>—</td>
                                          </React.Fragment>
                                      );
                                  }

                                  const mark = marks.find(m => m.studentId === student.id && m.subjectId === sub.id && m.examId === exam.id);
                                  const val = mark ? mark.obtained : 0;
                                  const isTotalFail = mark ? (mark.isAbsent || val < sub.passMarks) : (sub.passMarks > 0);
                                  
                                  const isCQFail = !mark?.isAbsent && sub.hasCQ && (mark?.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0);
                                  const isMCQFail = !mark?.isAbsent && sub.hasMCQ && (mark?.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0);
                                  const specificFail = isCQFail || isMCQFail || isTotalFail;

                                  return (
                                      <React.Fragment key={`sub-cell-${sub.id}-${student.id}`}>
                                          {sub.hasCQ && (
                                              <td className={`border border-black ${rowPaddingClass} text-center font-mono ${isCQFail || mark?.isAbsent ? 'text-red-700 font-bold bg-red-50/30' : 'text-gray-800'}`}>
                                                  {mark?.isAbsent ? 'অনুপ' : (mark?.obtainedCQ !== undefined ? formatNumber(mark.obtainedCQ, language) : '—')}
                                              </td>
                                          )}
                                          {sub.hasMCQ && (
                                              <td className={`border border-black ${rowPaddingClass} text-center font-mono ${isCQFail || mark?.isAbsent ? 'text-red-700 font-bold bg-red-50/30' : 'text-gray-800'}`}>
                                                  {mark?.isAbsent ? 'অনুপ' : (mark?.obtainedMCQ !== undefined ? formatNumber(mark.obtainedMCQ, language) : '—')}
                                              </td>
                                          )}
                                          <td className={`border border-black ${rowPaddingClass} text-center font-mono font-bold ${specificFail ? 'text-red-700 font-black bg-red-50/40' : 'text-black'}`}>
                                              {mark ? (mark.isAbsent ? (language === 'bn' ? 'অনুপ' : 'Abs') : formatNumber(val, language)) : '—'}
                                          </td>
                                      </React.Fragment>
                                  );
                              })}
                              {/* Total Marks */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-mono font-black bg-gray-50 text-black`}>
                                  {formatNumber(student.totalMarks, language)}
                              </td>
                              {/* GPA */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-mono font-black bg-gray-50 ${isPassing ? 'text-black' : 'text-red-700'}`}>
                                  {formatNumber(student.gpa.toFixed(2), language)}
                              </td>
                              {/* Letter Grade */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-black bg-gray-50 ${isPassing ? (student.grade === 'A+' ? 'text-emerald-800' : 'text-black') : 'text-red-700'}`}>
                                  {student.grade}
                              </td>
                              {/* Status */}
                              <td className={`border border-black ${rowPaddingClass} text-center font-bold text-[10.5px] whitespace-nowrap`}>
                                  {isPassing ? (
                                    <span className="text-emerald-800 font-extrabold">{language === 'bn' ? 'উত্তীর্ণ' : 'Passed'}</span>
                                  ) : (
                                    <span className="text-red-700 font-extrabold">{language === 'bn' ? 'অনুত্তীর্ণ' : 'Failed'}</span>
                                  )}
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
        </div>
        
        {/* Statistical Summary Bar */}
        <div className="mt-3 border-2 border-black bg-gray-100 p-2 text-[11px] font-bold text-black flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-1.5">
                <span>{language === 'bn' ? 'মোট পরীক্ষার্থী:' : 'Total Candidates:'}</span>
                <span className="font-mono font-black bg-white px-2 py-0.5 border border-black">{formatNumber(totalStudents, language)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-emerald-900">{language === 'bn' ? 'কৃতকার্য (উত্তীর্ণ):' : 'Passed:'}</span>
                <span className="font-mono font-black bg-white text-emerald-800 px-2 py-0.5 border border-black">{formatNumber(passedStudents, language)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-red-900">{language === 'bn' ? 'অকৃতকার্য (অনুত্তীর্ণ):' : 'Failed:'}</span>
                <span className="font-mono font-black bg-white text-red-700 px-2 py-0.5 border border-black">{formatNumber(failedStudents, language)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span>{language === 'bn' ? 'জিপিএ ৫.০০:' : 'GPA 5.00:'}</span>
                <span className="font-mono font-black bg-white px-2 py-0.5 border border-black">{formatNumber(gpa5Count, language)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-[#001f3f]">{language === 'bn' ? 'পাসের হার:' : 'Pass Rate:'}</span>
                <span className="font-mono font-black bg-white text-[#001f3f] px-2 py-0.5 border border-black">{formatNumber(passRate, language)}%</span>
            </div>
        </div>

        {/* Official 3-Column Signatures with guaranteed solid lines */}
        <div className="mt-6 flex justify-between items-end text-[11px] pt-2 break-inside-avoid">
             <div className="w-52 text-center flex flex-col items-center">
                 <div className="h-8 w-full" />
                 <div className="w-40 h-[1.5px] bg-black my-1" />
                 <div className="font-bold text-black uppercase">
                     {language === 'bn' ? 'প্রস্তুতকারী' : 'Prepared By'}
                 </div>
                 <div className="text-[9.5px] text-gray-700 font-semibold">
                     {language === 'bn' ? 'সহকারী শিক্ষক' : 'Assistant Teacher'}
                 </div>
             </div>
             <div className="w-52 text-center flex flex-col items-center">
                 <div className="h-8 w-full" />
                 <div className="w-40 h-[1.5px] bg-black my-1" />
                 <div className="font-bold text-black uppercase">
                     {language === 'bn' ? 'যাচাইকারী' : 'Verified By'}
                 </div>
                 <div className="text-[9.5px] text-gray-700 font-semibold">
                     {language === 'bn' ? 'পরীক্ষা নিয়ন্ত্রণ কমিটি' : 'Exam Committee'}
                 </div>
             </div>
             <div className="w-60 text-center flex flex-col items-center">
                 <div className="h-8 flex items-center justify-center">
                     {schoolProfile.signatureUrl && (
                         <img src={schoolProfile.signatureUrl} className="h-7 object-contain" alt="Signature" referrerPolicy="no-referrer" />
                     )}
                 </div>
                 <div className="w-44 h-[1.5px] bg-black my-1" />
                 <div className="font-bold text-black uppercase">
                     {language === 'bn' ? (schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'সুপার / প্রধান শিক্ষক') : (schoolProfile.headMasterName || 'Headmaster')}
                 </div>
                 <div className="text-[9.5px] text-gray-700 font-semibold uppercase">
                     {language === 'bn' ? 'সুপার / অধ্যক্ষ' : 'Superintendent / Principal'}
                 </div>
             </div>
        </div>
    </div>
  );
};
