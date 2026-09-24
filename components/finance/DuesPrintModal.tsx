import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Loader2, 
  Users,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatBanglaNumber } from '../../services/utils';
import { Button } from '../ui/Button';

interface DuesItem {
  student: {
    id: string;
    studentId?: string;
    rollNo?: string;
    name: string;
    nameBn?: string;
    classLevel: string;
    guardianPhone?: string;
  };
  monthlyExpected: number;
  paidThisMonth: number;
  dueThisMonth: number;
  behaviorBadge: string;
  behaviorLabelBn: string;
  behaviorLabelEn: string;
}

interface DuesPrintModalProps {
  dueList: DuesItem[];
  classFilter: string;
  behaviorFilter: string;
  schoolProfile: {
    name: string;
    nameBn?: string;
    address: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
    headMasterName?: string;
    headMasterNameBn?: string;
    academicYear?: string;
  };
  language: 'en' | 'bn';
  onClose: () => void;
}

export const DuesPrintModal: React.FC<DuesPrintModalProps> = ({
  dueList,
  classFilter,
  behaviorFilter,
  schoolProfile,
  language,
  onClose,
}) => {
  const isBn = language === 'bn';
  const printContentRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Totals
  const totalStudents = dueList.length;
  const totalExpected = dueList.reduce((sum, item) => sum + item.monthlyExpected, 0);
  const totalPaid = dueList.reduce((sum, item) => sum + item.paidThisMonth, 0);
  const totalDue = dueList.reduce((sum, item) => sum + item.dueThisMonth, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printContentRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);

    try {
      const element = printContentRef.current;
      const originalScrollTop = element.scrollTop;
      element.scrollTop = 0;

      const canvas = await html2canvas(element, {
        scale: 2.0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
      });

      element.scrollTop = originalScrollTop;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = 297;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const classStr = classFilter === 'ALL' ? 'AllClasses' : classFilter.replace(/\s+/g, '_');
      pdf.save(`Madrasah_Dues_Statement_${classStr}_${dateStr}.pdf`);
    } catch (err) {
      console.error('Dues PDF download error, fallback to print:', err);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      
      {/* Modal Box */}
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:w-full">
        
        {/* Sticky Toolbar (Hidden in print) */}
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs print:hidden gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{isBn ? 'ছাত্র বকেয়া শিট ও রিপোর্ট' : 'Student Dues & Statement'}</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">
                  {classFilter === 'ALL' ? (isBn ? 'সকল শ্রেণি' : 'All Classes') : classFilter}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? '১-ক্লিকে সরাসরি পিডিএফ ডাউনলোড ও প্রিন্ট সুবিধা' : '1-Click crisp PDF download & A4 print'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              size="sm"
              variant="secondary"
              className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 text-xs font-bold"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              <span>{isDownloadingPdf ? (isBn ? 'পিডিএফ তৈরি হচ্ছে...' : 'Generating...') : (isBn ? 'পিডিএফ ডাউনলোড' : 'Download PDF')}</span>
            </Button>

            <Button
              onClick={handlePrint}
              size="sm"
              variant="primary"
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>{isBn ? 'প্রিন্ট শিট' : 'Print Sheet'}</span>
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
              title={isBn ? 'বন্ধ করুন' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content (Class: print-container) */}
        <div className="print-container bg-white">
          <div 
            ref={printContentRef} 
            className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white max-w-[800px] mx-auto print:p-2 print:space-y-4 print:max-w-none"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-slate-900">
              <div className="text-xs font-serif font-bold text-slate-700 tracking-widest mb-1">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {schoolProfile.address}
                {schoolProfile.phone && ` • ফোন: ${schoolProfile.phone}`}
              </p>
              
              <div className="inline-block mt-2 px-4 py-1 rounded-full border border-slate-900 text-xs font-extrabold bg-slate-100 text-slate-900 uppercase tracking-wide">
                {isBn ? 'ছাত্র বকেয়া খতিয়ান ও ফি বিবরণী' : 'STUDENT DUES & FEE STATEMENT'}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mt-3 pt-2 border-t border-slate-200">
                <span>{isBn ? 'শ্রেণি / জামাত:' : 'Class:'} <strong className="text-slate-900">{classFilter === 'ALL' ? (isBn ? 'সকল শ্রেণি' : 'All Classes') : classFilter}</strong></span>
                <span>{isBn ? 'তারিখ:' : 'Date:'} <strong className="text-slate-900">{new Date().toLocaleDateString('bn-BD')}</strong></span>
                <span>{isBn ? 'শিক্ষাবর্ষ:' : 'Year:'} <strong className="text-slate-900">{schoolProfile.academicYear || new Date().getFullYear()}</strong></span>
              </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <span className="text-[11px] font-bold text-slate-500 block">{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {isBn ? formatBanglaNumber(totalStudents) : totalStudents} জন
                </span>
              </div>
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5">
                <span className="text-[11px] font-bold text-blue-800 block">{isBn ? 'মোট প্রদেয়' : 'Total Expected'}</span>
                <span className="text-base font-black text-blue-950 font-mono">
                  ৳{isBn ? formatBanglaNumber(totalExpected) : totalExpected.toLocaleString()}
                </span>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                <span className="text-[11px] font-bold text-emerald-800 block">{isBn ? 'মোট আদায়' : 'Total Paid'}</span>
                <span className="text-base font-black text-emerald-950 font-mono">
                  ৳{isBn ? formatBanglaNumber(totalPaid) : totalPaid.toLocaleString()}
                </span>
              </div>
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-2.5">
                <span className="text-[11px] font-bold text-rose-800 block">{isBn ? 'মোট বকেয়া' : 'Total Due'}</span>
                <span className="text-base font-black text-rose-950 font-mono">
                  ৳{isBn ? formatBanglaNumber(totalDue) : totalDue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Dues Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center w-8">ক্রম</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">শিক্ষার্থীর নাম ও জামাত</th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200 text-center w-20">রোল / আইডি</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">মোবাইল নম্বর</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">প্রদেয়</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">পরিশোধ</th>
                    <th className="py-2.5 px-3 text-right">বকেয়া</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dueList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        {isBn ? 'কোনো বকেয়া রেকর্ড পাওয়া যায়নি।' : 'No dues records found.'}
                      </td>
                    </tr>
                  ) : (
                    dueList.map((item, idx) => {
                      const s = item.student;
                      const hasDue = item.dueThisMonth > 0;
                      return (
                        <tr key={s.id} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-center font-mono font-semibold">
                            {isBn ? formatBanglaNumber(idx + 1) : idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900">{s.nameBn || s.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{s.classLevel}</div>
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-center font-mono font-bold text-slate-700">
                            {s.studentId || s.rollNo || '---'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-700">
                            {s.guardianPhone || '---'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                            ৳{isBn ? formatBanglaNumber(item.monthlyExpected) : item.monthlyExpected.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                            ৳{isBn ? formatBanglaNumber(item.paidThisMonth) : item.paidThisMonth.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black">
                            {hasDue ? (
                              <span className="text-rose-700">
                                ৳{isBn ? formatBanglaNumber(item.dueThisMonth) : item.dueThisMonth.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[11px]">পরিশোধিত</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 border-r border-slate-200 text-right uppercase">
                      {isBn ? 'সর্বমোট যোগফল:' : 'Total Aggregate:'}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-black">
                      ৳{isBn ? formatBanglaNumber(totalExpected) : totalExpected.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-black text-emerald-700">
                      ৳{isBn ? formatBanglaNumber(totalPaid) : totalPaid.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700">
                      ৳{isBn ? formatBanglaNumber(totalDue) : totalDue.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Signature Area */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="w-44 border-t border-slate-900 mx-auto mb-1" />
                <span className="font-bold text-slate-800">{isBn ? 'হিসাবরক্ষক / দায়িত্বশীল' : 'Accountant'}</span>
              </div>
              <div>
                <div className="w-44 border-t border-slate-900 mx-auto mb-1" />
                <span className="font-bold text-slate-800">{schoolProfile.headMasterNameBn || schoolProfile.headMasterName || (isBn ? 'মুহতামিম / অধ্যক্ষ' : 'Principal')}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              {isBn ? 'সফটওয়্যার জেনারেটেড ডিজিটাল বকেয়া রিপোর্ট • মাদ্রাসা ম্যানেজমেন্ট সিস্টেম' : 'Software Generated Report • Madrasah Management System'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
