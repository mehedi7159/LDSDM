import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PromotionHistoryRecord } from '../types/promotion';
import { formatNumber, formatSafeDate } from '../services/utils';
import { Button } from './ui/Button';
import { Printer, X, Award, CheckCircle2, AlertCircle, GraduationCap } from 'lucide-react';

interface PromotionGazetteModalProps {
  record: PromotionHistoryRecord;
  onClose: () => void;
}

export const PromotionGazetteModal: React.FC<PromotionGazetteModalProps> = ({ record, onClose }) => {
  const { schoolProfile, language, t } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const passRate = record.totalEvaluated > 0
    ? Math.round((record.totalPromoted / record.totalEvaluated) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Action Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {language === 'bn' ? 'শ্রেণি উত্তরণ গেজেট ও ফলাফল বিবরণী' : 'Class Promotion Gazette & Tabulation'}
              </h3>
              <p className="text-xs text-slate-300">
                {record.sourceClass} ➔ {record.targetClass} | {record.academicYear} ➔ {record.targetAcademicYear}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 px-4 py-2 text-sm shadow-sm"
            >
              <Printer size={16} />
              <span>{language === 'bn' ? 'গেজেট প্রিন্ট করুন' : 'Print Gazette'}</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Gazette Sheet */}
        <div 
          ref={printRef} 
          className="p-6 sm:p-10 overflow-y-auto print:overflow-visible print:p-8 space-y-6 text-gray-900 bg-white"
        >
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-slate-800 pb-5">
            {schoolProfile.logoUrl && (
              <img 
                src={schoolProfile.logoUrl} 
                alt="Logo" 
                className="w-16 h-16 mx-auto mb-2 object-contain" 
              />
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {language === 'bn' && schoolProfile.nameBn ? schoolProfile.nameBn : schoolProfile.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {language === 'bn' && schoolProfile.addressBn ? schoolProfile.addressBn : schoolProfile.address}
            </p>
            {schoolProfile.phone && (
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'bn' ? 'ফোন' : 'Phone'}: {schoolProfile.phone} | {language === 'bn' ? 'ইমেইল' : 'Email'}: {schoolProfile.email}
              </p>
            )}

            <div className="mt-4 inline-block bg-slate-900 text-white px-5 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase shadow-xs">
              {language === 'bn' ? 'বার্ষিক শ্রেণি উত্তরণ গেজেট ও মেধা তালিকা' : 'Official Class Promotion Gazette & Merit Sheet'}
            </div>
          </div>

          {/* Session & Class Meta Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">{language === 'bn' ? 'পূর্ববর্তী শ্রেণি' : 'Source Class'}</span>
              <span className="font-bold text-slate-800 text-base">{record.sourceClass}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">{language === 'bn' ? 'উত্তীর্ণ শ্রেণি' : 'Target (New) Class'}</span>
              <span className="font-bold text-emerald-700 text-base">{record.targetClass}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">{language === 'bn' ? 'পরীক্ষা সেশন' : 'Exam Session'}</span>
              <span className="font-semibold text-slate-800">{record.examName || (language === 'bn' ? 'বার্ষিক মূল্যায়ন' : 'Annual Evaluation')}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">{language === 'bn' ? 'শিক্ষাবর্ষ রূপান্তর' : 'Academic Year'}</span>
              <span className="font-semibold text-slate-800">{record.academicYear} ➔ {record.targetAcademicYear}</span>
            </div>
          </div>

          {/* Quick Statistics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 block">{language === 'bn' ? 'মূল্যায়নকৃত' : 'Evaluated'}</span>
              <span className="font-bold text-slate-800 text-base">{formatNumber(record.totalEvaluated, language)}</span>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block font-medium">{language === 'bn' ? 'উত্তীর্ণ' : 'Promoted'}</span>
              <span className="font-bold text-emerald-700 text-base">{formatNumber(record.totalPromoted, language)}</span>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <span className="text-amber-800 block font-medium">{language === 'bn' ? 'একই শ্রেণিতে বহাল' : 'Retained'}</span>
              <span className="font-bold text-amber-800 text-base">{formatNumber(record.totalRetained, language)}</span>
            </div>
            <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
              <span className="text-purple-700 block font-medium">{language === 'bn' ? 'সমাপনী সম্পন্ন' : 'Graduated'}</span>
              <span className="font-bold text-purple-700 text-base">{formatNumber(record.totalGraduated, language)}</span>
            </div>
            <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200 col-span-2 sm:col-span-1">
              <span className="text-blue-700 block font-medium">{language === 'bn' ? 'পাসের হার' : 'Pass Rate'}</span>
              <span className="font-bold text-blue-700 text-base">{formatNumber(passRate, language)}%</span>
            </div>
          </div>

          {/* Gazette Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3 border-r border-slate-700 w-12 text-center">
                    {language === 'bn' ? 'মেধা' : 'Rank'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700 w-16 text-center">
                    {language === 'bn' ? 'পূর্বের রোল' : 'Old Roll'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700">
                    {language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700 text-center w-20">
                    {language === 'bn' ? 'মোট নম্বর' : 'Total'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700 text-center w-16">
                    {language === 'bn' ? 'জিপিএ' : 'GPA'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700 text-center w-14">
                    {language === 'bn' ? 'গ্রেড' : 'Grade'}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-700 text-center">
                    {language === 'bn' ? 'উত্তরণ অবস্থা' : 'Promotion Status'}
                  </th>
                  <th className="py-2.5 px-3 text-center w-20 bg-emerald-900 text-emerald-100 font-bold">
                    {language === 'bn' ? 'নতুন রোল' : 'New Roll'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {record.students.map((st, index) => {
                  const isPromoted = st.action === 'PROMOTE';
                  const isRetained = st.action === 'RETAIN';
                  const isGraduated = st.action === 'GRADUATE';

                  return (
                    <tr 
                      key={st.studentId}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                    >
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-slate-700">
                        {st.meritRank ? formatNumber(st.meritRank, language) : formatNumber(index + 1, language)}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-medium text-slate-600">
                        {st.oldRoll ? formatNumber(st.oldRoll, language) : '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                        <div>
                          <span>{language === 'bn' && st.studentNameBn ? st.studentNameBn : st.studentName}</span>
                          {st.studentNameBn && language !== 'bn' && (
                            <span className="block text-xs text-slate-500 font-normal">{st.studentNameBn}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-semibold text-slate-700">
                        {st.totalMarks !== undefined ? formatNumber(st.totalMarks, language) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-bold text-slate-800">
                        {st.gpa !== undefined ? formatNumber(st.gpa.toFixed(2), language) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-bold">
                        <span className={`px-2 py-0.5 rounded-sm text-xs ${
                          st.grade === 'A+' ? 'bg-emerald-100 text-emerald-800' :
                          st.grade === 'F' ? 'bg-rose-100 text-rose-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {st.grade || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-medium">
                        {isPromoted && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>{language === 'bn' ? `${st.targetClass} এ উত্তীর্ণ` : `Promoted to ${st.targetClass}`}</span>
                          </span>
                        )}
                        {isRetained && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <AlertCircle size={14} className="text-amber-600" />
                            <span>{language === 'bn' ? 'একই শ্রেণিতে বহাল' : 'Retained in Class'}</span>
                          </span>
                        )}
                        {isGraduated && (
                          <span className="inline-flex items-center gap-1 text-purple-700 font-semibold">
                            <GraduationCap size={14} className="text-purple-600" />
                            <span>{language === 'bn' ? 'সমাপনী সম্পন্ন' : 'Graduated'}</span>
                          </span>
                        )}
                        {!isPromoted && !isRetained && !isGraduated && (
                          <span className="text-slate-400">{st.action}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-800 bg-emerald-50/50">
                        {st.newRoll ? formatNumber(st.newRoll, language) : (isRetained ? formatNumber(st.oldRoll || '', language) : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Signatures Area */}
          <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs sm:text-sm">
            <div>
              <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800">
                {language === 'bn' ? 'শ্রেণি শিক্ষক' : 'Class Teacher'}
              </div>
              <span className="text-xs text-slate-500">{language === 'bn' ? 'স্বাক্ষর ও তারিখ' : 'Signature & Date'}</span>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800">
                {language === 'bn' ? 'পরীক্ষা নিয়ন্ত্রক' : 'Exam Controller'}
              </div>
              <span className="text-xs text-slate-500">{language === 'bn' ? 'স্বাক্ষর ও তারিখ' : 'Signature & Date'}</span>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800">
                {language === 'bn' && schoolProfile.headMasterNameBn ? schoolProfile.headMasterNameBn : schoolProfile.headMasterName}
              </div>
              <span className="text-xs text-slate-500">{language === 'bn' ? 'মুহতামিম / অধ্যক্ষ' : 'Principal / Superintendent'}</span>
            </div>
          </div>

          {/* Gazette Metadata Footnote */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
            <span>
              {language === 'bn' ? 'কার্যকর তারিখ' : 'Executed on'}: {formatSafeDate(record.timestamp, language === 'bn' ? 'bn-BD' : 'en-US')} | {language === 'bn' ? 'কর্তৃপক্ষ' : 'Authorized by'}: {record.promotedBy}
            </span>
            <span>
              {schoolProfile.name} • {language === 'bn' ? 'ডিজিটাল শিক্ষা ব্যবস্থাপনা' : 'Digital Management System'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
