import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { STUDENTS_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../../services/cloudConfirm';
import { Button } from '../ui/Button';
import {
  FileText,
  Printer,
  X,
  Award,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  User,
  GraduationCap,
  Sparkles
} from 'lucide-react';

interface TransferCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onTcIssued?: (student: Student, tcData: TcRecord) => void;
}

export interface TcRecord {
  tcNumber: string;
  issueDate: string;
  leavingReason: string;
  characterRemark: string;
  academicPerformance: string;
  duesCleared: boolean;
  notes?: string;
}

export const TransferCertificateModal: React.FC<TransferCertificateModalProps> = ({
  isOpen,
  onClose,
  student
  // NOTE (7 Nov 2026 Job 7): onTcIssued is deliberately NOT called
  // anymore. It re-ran updateStudent and closed this modal, which
  // would destroy the sync state + Retry below. The modal now applies
  // the Former update itself (updateStudent) and stays open on an
  // honest issued state with Print + Close. The parent's handleTcIssued
  // (StudentManager) is therefore unused for this flow — the
  // coordinator can remove it. Its STUDENT_ARCHIVED audit event no
  // longer fires; updateStudent's own STUDENT_UPDATED audit entry
  // still records the same change (status → Former, same actor).
}) => {
  const { schoolProfile, language, updateStudent, confirmStudentsCloudSync } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  const [tcNumber, setTcNumber] = useState<string>(() => `TC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leavingReason, setLeavingReason] = useState<string>('উচ্চ শিক্ষার উদ্দেশ্যে / স্থান পরিবর্তন');
  const [characterRemark, setCharacterRemark] = useState<string>('উত্তম ও প্রশংসনীয় (Good & Commendable)');
  const [academicPerformance, setAcademicPerformance] = useState<string>('সন্তোষজনক ও নিয়মিত (Satisfactory)');
  const [duesCleared, setDuesCleared] = useState<boolean>(true);
  const [nextSchool, setNextSchool] = useState<string>('');
  const [conductStatus, setConductStatus] = useState<string>('তিনি মাদ্রাসার কোনো নিয়ম ভঙ্গ করেননি');

  // 7 Nov 2026 Job 7 — TC finding: issuing a TC WRITES data. The TC
  // paper itself is print-only and is never stored anywhere, but the
  // student row changes: status → Former, isFormer, leavingDate and
  // leavingReason (which carries the TC number). That student write is
  // what confirmStudentsCloudSync below covers.
  const [issuedRecord, setIssuedRecord] = useState<TcRecord | null>(null);
  const [pendingTcStudents, setPendingTcStudents] = useState<Student[] | null>(null);
  const [tcConfirmError, setTcConfirmError] = useState<string | null>(null);
  const [tcCloudConfirmed, setTcCloudConfirmed] = useState(false);
  const [isRetryingTc, setIsRetryingTc] = useState(false);
  const [tcIssueError, setTcIssueError] = useState<string | null>(null);

  // A fresh open (or a different student) starts clean — the issued
  // state belongs to the previous TC only.
  useEffect(() => {
    if (isOpen) {
      setIssuedRecord(null);
      setPendingTcStudents(null);
      setTcConfirmError(null);
      setTcCloudConfirmed(false);
      setTcIssueError(null);
    }
  }, [isOpen, student?.id]);

  if (!isOpen || !student) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmIssue = () => {
    // Double-issue guard: one TC per open.
    if (issuedRecord) return;
    const record: TcRecord = {
      tcNumber,
      issueDate,
      leavingReason,
      characterRemark,
      academicPerformance,
      duesCleared,
      notes: nextSchool ? `পরবর্তী প্রতিষ্ঠান: ${nextSchool}` : undefined
    };

    // The local write, applied at once: the student becomes Former.
    // updateStudent returns the authoritative next list (builder
    // applies updatedAt/updatedBy + validation) — that exact list is
    // what the background confirm re-confirms.
    const saved = updateStudent({
      ...student,
      status: 'Former',
      isFormer: true,
      leavingDate: record.issueDate,
      leavingReason: `ছাড়পত্র নং: ${record.tcNumber} (${record.leavingReason})`
    });
    if (saved.student.status !== 'Former') {
      // The builder refused the update — nothing was saved.
      setTcIssueError(language === 'bn' ? 'ছাড়পত্র সংরক্ষণ হয়নি — শিক্ষার্থীর তথ্য যাচাই করুন।' : 'TC was not saved — check the student record.');
      return;
    }
    setTcIssueError(null);
    setIssuedRecord(record);
    setTcCloudConfirmed(false);
    setPendingTcStudents(saved.students);
    setTcConfirmError(null);
    // The modal stays open on the honest issued state below (Print +
    // Close) instead of closing at once — the cloud confirm runs in
    // the BACKGROUND and its failure stays visible here with Retry.
    confirmTcStudentsInBackground(saved.students);
  };

  const isBn = language === 'bn';

  // Plain-language confirm failure: a timeout (slow connection) says
  // so explicitly instead of the generic cloud message.
  const tcConfirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || STUDENTS_CLOUD_FAILURE_MESSAGE));

  const confirmTcStudentsInBackground = (nextStudents: Student[]) => {
    void confirmStudentsCloudSync(nextStudents).then((confirmResult) => {
      if (confirmResult.success) {
        setPendingTcStudents(null);
        setTcConfirmError(null);
        setTcCloudConfirmed(true);
      } else {
        setTcConfirmError(tcConfirmErrorMessage(confirmResult));
      }
    }).catch((err) => {
      console.error('Background TC cloud confirm failed:', err);
      setTcConfirmError(STUDENTS_CLOUD_FAILURE_MESSAGE);
    });
  };

  // Retry re-confirms the SAME students list — never a second issue
  // (which would be harmless but pointless) and never a second write.
  const retryTcSave = async () => {
    if (!pendingTcStudents || isRetryingTc) return;
    setIsRetryingTc(true);
    try {
      const result = await confirmStudentsCloudSync(pendingTcStudents);
      if (result.success) {
        setPendingTcStudents(null);
        setTcConfirmError(null);
        setTcCloudConfirmed(true);
      } else {
        setTcConfirmError(tcConfirmErrorMessage(result));
      }
    } finally {
      setIsRetryingTc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-teal-800 text-white p-5 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
              <FileText className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {isBn ? 'শিক্ষার্থী ছাড়পত্র ও প্রশংসাপত্র (TC)' : 'Transfer Certificate (TC)'}
              </h3>
              <p className="text-xs text-teal-200 font-medium">
                {student.name} ({student.nameBn || student.name}) • রোল: {student.roll || student.rollNumber || '—'} • শ্রেণি: {student.classLevel}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-teal-200 hover:text-white hover:bg-white/15 rounded-xl transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Controls & Certificate Preview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">

          {/* Job 7: honest TC save state — issuing writes the student
              row (Former); the paper itself is print-only. The green
              confirmation appears only when the cloud confirm lands. */}
          {tcIssueError && (
            <div className="no-print p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{tcIssueError}</span>
            </div>
          )}
          {issuedRecord && !tcIssueError && (
            tcConfirmError ? (
              <div className="no-print p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 leading-relaxed">
                  <p className="font-semibold">{tcConfirmError}</p>
                  <p className="text-amber-800">{isBn ? 'ছাড়পত্রটি এই ডিভাইসে সংরক্ষিত আছে — cloud-এ যায়নি। শিক্ষার্থী সাবেক তালিকায় আছে।' : 'The TC is saved on this device — it has not reached the cloud yet. The student is in the former list.'}</p>
                </div>
                <button type="button" onClick={retryTcSave} disabled={isRetryingTc} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
              </div>
            ) : tcCloudConfirmed ? (
              <div className="no-print p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{isBn ? 'ছাড়পত্র cloud-এ সংরক্ষিত হয়েছে ✓ — শিক্ষার্থী এখন সাবেক তালিকায়।' : 'TC saved to cloud ✓ — the student is now in the former list.'}</span>
              </div>
            ) : (
              <div className="no-print p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে… শিক্ষার্থী সাবেক তালিকায় স্থানান্তরিত হয়েছে।' : 'Saved on this device — syncing to cloud… The student has moved to the former list.'}</span>
              </div>
            )
          )}
          
          {/* Form Options (Hidden in print) */}
          <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-teal-600" />
              <span>{isBn ? 'ছাড়পত্রের বিবরণ ও তথ্য নির্ধারণ' : 'Certificate Parameters'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-semibold">
              <div>
                <label className="text-slate-600 block mb-1">{isBn ? 'ছাড়পত্র ক্রমিক নং (TC No.)' : 'TC Number'}</label>
                <input 
                  type="text"
                  value={tcNumber}
                  disabled={!!issuedRecord}
                  onChange={(e) => setTcNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">{isBn ? 'ইস্যুর তারিখ (Issue Date)' : 'Issue Date'}</label>
                <input 
                  type="date"
                  value={issueDate}
                  disabled={!!issuedRecord}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">{isBn ? 'মাদ্রাসা ত্যাগের কারণ' : 'Reason for Leaving'}</label>
                <input 
                  type="text"
                  value={leavingReason}
                  disabled={!!issuedRecord}
                  onChange={(e) => setLeavingReason(e.target.value)}
                  placeholder="উচ্চ শিক্ষার উদ্দেশ্যে..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">{isBn ? 'আচরণ ও চরিত্র' : 'Conduct & Character'}</label>
                <input 
                  type="text"
                  value={characterRemark}
                  disabled={!!issuedRecord}
                  onChange={(e) => setCharacterRemark(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">{isBn ? 'শিক্ষাগত অগ্রগতি' : 'Academic Progress'}</label>
                <input 
                  type="text"
                  value={academicPerformance}
                  disabled={!!issuedRecord}
                  onChange={(e) => setAcademicPerformance(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={duesCleared} 
                    disabled={!!issuedRecord}
                    onChange={(e) => setDuesCleared(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500"
                  />
                  <span className="text-slate-700 font-bold">{isBn ? 'সকল বকেয়া ফি পরিশোধিত' : 'All Dues Cleared'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Certificate Document (Printable Paper) */}
          <div 
            ref={printRef}
            id="transfer-certificate-printable"
            className="bg-white p-8 sm:p-12 rounded-2xl border-2 border-emerald-900/40 max-w-3xl mx-auto relative overflow-hidden print:p-0 print:border-0 print:shadow-none"
            style={{ minHeight: '620px' }}
          >
            {/* Watermark / Background Accent */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
              <Building2 size={400} className="text-emerald-950" />
            </div>

            {/* Inner Border Frame */}
            <div className="border border-emerald-900/30 p-6 sm:p-8 rounded-xl h-full flex flex-col justify-between">
              
              {/* Header */}
              <div className="text-center border-b-2 border-emerald-900/20 pb-4">
                <p className="text-xs font-serif text-emerald-800 tracking-wider mb-1">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                <h1 className="text-2xl sm:text-3xl font-black text-emerald-950 font-serif tracking-tight">
                  {schoolProfile.nameBn || schoolProfile.name}
                </h1>
                <p className="text-xs text-slate-600 mt-1 font-medium">{schoolProfile.addressBn || schoolProfile.address}</p>
                <p className="text-[11px] text-slate-500">ফোন: {schoolProfile.phone} • ইমেইল: {schoolProfile.email}</p>
                
                <div className="inline-block mt-4 px-6 py-1.5 bg-emerald-900 text-white rounded-full font-bold text-sm tracking-widest">
                  {isBn ? 'শিক্ষার্থী ছাড়পত্র ও প্রশংসাপত্র' : 'TRANSFER & TESTIMONIAL CERTIFICATE'}
                </div>
              </div>

              {/* Meta strip */}
              <div className="flex justify-between items-center text-xs text-slate-700 py-3 font-semibold border-b border-dashed border-slate-200">
                <span>স্মারক নং: <strong className="font-mono text-emerald-900">{tcNumber}</strong></span>
                <span>তারিখ: <strong className="text-emerald-900">{formatSafeDate(issueDate, isBn)}</strong></span>
              </div>

              {/* Certificate Body Paragraphs */}
              <div className="my-6 space-y-4 text-sm sm:text-base leading-relaxed text-slate-800 text-justify">
                <p>
                  এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <strong className="text-emerald-950 text-base">{student.nameBn || student.name}</strong>, 
                  পিতা: <strong className="text-emerald-950">{student.fatherNameBn || student.fatherName || 'উল্লেখ নেই'}</strong>, 
                  মাতা: <strong className="text-emerald-950">{student.motherNameBn || student.motherName || 'উল্লেখ নেই'}</strong>, 
                  ঠিকানা: {student.address || 'রেকর্ডে অন্তর্ভুক্ত'}।
                </p>
                <p>
                  তিনি এই প্রতিষ্ঠানে <strong className="text-emerald-950">{student.classLevel}</strong> শ্রেণিতে 
                  রোল নম্বর <strong className="font-mono text-emerald-950">{student.roll || student.rollNumber || '—'}</strong> 
                  (আইডি: <span className="font-mono">{student.studentId || student.id}</span>) নিয়ে অধ্যয়নরত ছিলেন। 
                  {student.admissionDate ? `তিনি ${formatSafeDate(student.admissionDate, isBn)} তারিখে অত্র প্রতিষ্ঠানে ভর্তি হন। ` : ''}
                </p>
                <p>
                  মাদ্রাসা ত্যাগের কারণ: <strong className="text-emerald-900">{leavingReason}</strong>। 
                  আমাদের জানামতে তিনি অত্র প্রতিষ্ঠানে অধ্যয়নকালে উত্তম চরিত্র ও আচার-ব্যবহারের অধিকারী ছিলেন। 
                  তাঁর শিক্ষাগত অগ্রগতি <strong className="text-emerald-900">{academicPerformance}</strong> এবং 
                  চরিত্রগত মান <strong className="text-emerald-900">{characterRemark}</strong>। 
                  {conductStatus}।
                </p>
                <p>
                  {duesCleared ? (
                    <span className="text-emerald-900 font-bold">
                      ✓ অত্র মাদ্রাসার যাবতীয় পাওনা ও বেতন পরিশোধিত আছে।
                    </span>
                  ) : (
                    <span className="text-amber-800 font-bold">
                      ⚠ মাদ্রাসায় প্রযোজ্য বকেয়া পরিশোধ সাপেক্ষে ছাড়পত্র কার্যকর হবে।
                    </span>
                  )}
                </p>
                <p className="text-center font-serif text-emerald-950 font-bold pt-2">
                  আমরা তাঁর জীবনের সর্বাঙ্গীন সাফল্য ও উজ্জ্বল ভবিষ্যৎ কামনা করি।
                </p>
              </div>

              {/* Signatures Footer */}
              <div className="pt-10 grid grid-cols-3 gap-4 text-center text-xs font-bold text-slate-700">
                <div>
                  <div className="border-b border-slate-400 mx-auto w-32 h-10 mb-1"></div>
                  <p>হিসাবরক্ষক / কেরানী</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 mx-auto w-32 h-10 mb-1"></div>
                  <p>শ্রেণি শিক্ষক</p>
                </div>
                <div>
                  <div className="border-b border-emerald-800 mx-auto w-36 h-10 mb-1 flex items-end justify-center">
                    {schoolProfile.signatureUrl && (
                      <img src={schoolProfile.signatureUrl} alt="Signature" className="h-8 max-w-full object-contain pb-1" />
                    )}
                  </div>
                  <p className="text-emerald-950">{schoolProfile.headMasterNameBn || schoolProfile.headMasterName || 'অধ্যক্ষ / সুপারিনটেনডেন্ট'}</p>
                  <p className="text-[10px] text-slate-500">প্রতিষ্ঠানের প্রধান ও সিলমোহর</p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 size={16} className="text-teal-600" />
            <span>{isBn ? 'প্রিন্ট করার পর এটি অফিসিয়াল সিল ও স্বাক্ষরের জন্য প্রস্তুত হবে।' : 'Ready to print and apply official seal.'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </Button>
            <Button 
              onClick={handlePrint}
              className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2 font-bold"
            >
              <Printer size={16} />
              <span>{isBn ? 'ছাড়পত্র প্রিন্ট করুন' : 'Print TC'}</span>
            </Button>
            <Button 
              onClick={handleConfirmIssue}
              disabled={!!issuedRecord}
              className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} />
              <span>{issuedRecord ? (isBn ? 'ছাড়পত্র ইস্যু হয়েছে ✓' : 'TC Issued ✓') : (isBn ? 'সংরক্ষণ ও সাবেক তালিকায় স্থানান্তর' : 'Issue & Archive')}</span>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
