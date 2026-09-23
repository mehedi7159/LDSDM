import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Receipt, 
  Check, 
  Search, 
  Sparkles, 
  Printer, 
  Layers, 
  UserCheck, 
  Calendar,
  CreditCard,
  Percent,
  Plus
} from 'lucide-react';
import { 
  FinanceTransaction, 
  ClassFeeStructure, 
  Student, 
  SchoolClass 
} from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { Button } from '../ui/Button';

interface StudentFeeCollectionProps {
  students: Student[];
  classes: SchoolClass[];
  feeStructures: ClassFeeStructure[];
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const StudentFeeCollection: React.FC<StudentFeeCollectionProps> = ({
  students,
  classes,
  feeStructures,
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || 'Play');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [feeMonth, setFeeMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [feeDate, setFeeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('অফিস সহকারী');
  const [notes, setNotes] = useState<string>('');

  // Current fee structure for this class
  const currentStructure = useMemo(() => {
    return feeStructures.find(f => f.classLevel === selectedClass) || {
      classLevel: selectedClass,
      monthlyTuition: 700,
      admissionFee: 1500,
      examFee: 400,
      boardingFee: 2600,
      bookFee: 800,
    };
  }, [feeStructures, selectedClass]);

  // Fee Heads
  const [feeItems, setFeeItems] = useState<{
    tuition: { enabled: boolean; amount: number };
    boarding: { enabled: boolean; amount: number };
    exam: { enabled: boolean; amount: number };
    admission: { enabled: boolean; amount: number };
    book: { enabled: boolean; amount: number };
    session: { enabled: boolean; amount: number };
    other: { enabled: boolean; amount: number; label: string };
    waiver: number;
  }>({
    tuition: { enabled: true, amount: 700 },
    boarding: { enabled: false, amount: 2600 },
    exam: { enabled: false, amount: 400 },
    admission: { enabled: false, amount: 1500 },
    book: { enabled: false, amount: 800 },
    session: { enabled: false, amount: 500 },
    other: { enabled: false, amount: 0, label: 'বিবিধ' },
    waiver: 0,
  });

  // Handle Class Switch
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    setSelectedStudentId('');
    setStudentSearch('');
    const str = feeStructures.find(f => f.classLevel === newClass);
    if (str) {
      setFeeItems(prev => ({
        ...prev,
        tuition: { ...prev.tuition, amount: str.monthlyTuition },
        boarding: { ...prev.boarding, amount: str.boardingFee || 0 },
        exam: { ...prev.exam, amount: str.examFee || 0 },
        admission: { ...prev.admission, amount: str.admissionFee || 0 },
        book: { ...prev.book, amount: str.bookFee || 0 },
      }));
    }
  };

  // Filtered student list for this class
  const classStudents = useMemo(() => {
    return students.filter(s => {
      if (s.classLevel !== selectedClass) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.nameBn?.includes(q) ||
          s.studentId?.toLowerCase().includes(q) ||
          s.guardianPhone?.includes(q)
        );
      }
      return true;
    });
  }, [students, selectedClass, studentSearch]);

  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Quick Preset Handlers
  const applyPreset = (type: 'ALL' | 'TUITION_ONLY' | 'TUITION_AND_FOOD' | 'ADMISSION_ONLY' | 'EXAM_ONLY') => {
    setFeeItems(prev => {
      switch (type) {
        case 'ALL':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: Boolean(currentStructure.boardingFee), amount: currentStructure.boardingFee || 0 },
            exam: { ...prev.exam, enabled: Boolean(currentStructure.examFee), amount: currentStructure.examFee || 0 },
            admission: { ...prev.admission, enabled: Boolean(currentStructure.admissionFee), amount: currentStructure.admissionFee || 0 },
            book: { ...prev.book, enabled: Boolean(currentStructure.bookFee), amount: currentStructure.bookFee || 0 },
            session: { ...prev.session, enabled: false, amount: 0 },
          };
        case 'TUITION_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        case 'TUITION_AND_FOOD':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: true, amount: currentStructure.boardingFee || 2600 },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        case 'ADMISSION_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: false },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: true, amount: currentStructure.admissionFee || 1500 },
            book: { ...prev.book, enabled: true, amount: currentStructure.bookFee || 800 },
            session: { ...prev.session, enabled: false },
          };
        case 'EXAM_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: false },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: true, amount: currentStructure.examFee || 400 },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        default:
          return prev;
      }
    });
  };

  // Computed Totals
  const computedTotal = useMemo(() => {
    let gross = 0;
    if (feeItems.tuition.enabled) gross += Number(feeItems.tuition.amount) || 0;
    if (feeItems.boarding.enabled) gross += Number(feeItems.boarding.amount) || 0;
    if (feeItems.exam.enabled) gross += Number(feeItems.exam.amount) || 0;
    if (feeItems.admission.enabled) gross += Number(feeItems.admission.amount) || 0;
    if (feeItems.book.enabled) gross += Number(feeItems.book.amount) || 0;
    if (feeItems.session.enabled) gross += Number(feeItems.session.amount) || 0;
    if (feeItems.other.enabled) gross += Number(feeItems.other.amount) || 0;

    const discount = Number(feeItems.waiver) || 0;
    const net = Math.max(0, gross - discount);
    return { gross, discount, net };
  }, [feeItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert(isBn ? 'দয়া করে একজন ছাত্র নির্বাচন করুন!' : 'Please select a student!');
      return;
    }
    if (computedTotal.net <= 0) {
      alert(isBn ? 'মোট ফি এর পরিমাণ ০ এর বেশি হতে হবে!' : 'Total fee must be greater than 0!');
      return;
    }

    const nextVoucher = generateVoucherNo('INCOME', transactions);
    const breakdown: { name: string; nameBn: string; amount: number }[] = [];

    if (feeItems.tuition.enabled && feeItems.tuition.amount > 0) {
      breakdown.push({ name: 'Monthly Tuition', nameBn: 'মাসিক বেতন', amount: Number(feeItems.tuition.amount) });
    }
    if (feeItems.boarding.enabled && feeItems.boarding.amount > 0) {
      breakdown.push({ name: 'Boarding & Food Fee', nameBn: 'বোর্ডিং ও খাবার ফি', amount: Number(feeItems.boarding.amount) });
    }
    if (feeItems.exam.enabled && feeItems.exam.amount > 0) {
      breakdown.push({ name: 'Exam Fee', nameBn: 'পরীক্ষার ফি', amount: Number(feeItems.exam.amount) });
    }
    if (feeItems.admission.enabled && feeItems.admission.amount > 0) {
      breakdown.push({ name: 'Admission Fee', nameBn: 'ভর্তি ও সেশন চার্জ', amount: Number(feeItems.admission.amount) });
    }
    if (feeItems.book.enabled && feeItems.book.amount > 0) {
      breakdown.push({ name: 'Books & Stationery', nameBn: 'কিতাব ও পাঠাগার ফি', amount: Number(feeItems.book.amount) });
    }
    if (feeItems.session.enabled && feeItems.session.amount > 0) {
      breakdown.push({ name: 'Session Charge', nameBn: 'বার্ষিক সেশন ফি', amount: Number(feeItems.session.amount) });
    }
    if (feeItems.other.enabled && feeItems.other.amount > 0) {
      breakdown.push({ name: feeItems.other.label || 'Other', nameBn: feeItems.other.label || 'অন্যান্য', amount: Number(feeItems.other.amount) });
    }
    if (feeItems.waiver > 0) {
      breakdown.push({ name: 'Scholarship / Waiver', nameBn: 'বিশেষ ছাড় / এতিম বৃত্তি', amount: -Number(feeItems.waiver) });
    }

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'INCOME',
      category: 'STUDENT_TUITION',
      categoryName: isBn ? 'ছাত্র ফি ও বেতন' : 'Student Fees',
      fundType: 'GENERAL',
      amount: computedTotal.net,
      date: feeDate,
      paymentMethod,
      referenceNo,
      studentId: selectedStudent?.id,
      studentCode: selectedStudent?.studentId,
      studentName: selectedStudent?.name,
      studentNameBn: selectedStudent?.nameBn,
      classLevel: selectedClass,
      feeMonth,
      feeBreakdown: breakdown,
      payerOrPayee: selectedStudent?.guardianName ? `${selectedStudent.guardianName} (অভিভাবক)` : (selectedStudent?.nameBn || selectedStudent?.name || ''),
      contactNo: selectedStudent?.guardianPhone || '',
      description: notes || `${feeMonth} মাসের ফি পরিশোধ`,
      collectedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `রসিদ নং ${nextVoucher} সফলভাবে জমা হয়েছে!` : `Receipt ${nextVoucher} created!`);
    onShowReceipt(created);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isBn ? 'ছাত্র ফি আদায় ও মানি রসিদ তৈরি' : 'Student Fee Collection'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? 'সকল ধরনের ফি আদায় করুন এবং ইনস্ট্যান্ট ২-কপি রসিদ প্রিন্ট করুন' : 'Collect fees and print verified 2-copy receipts'}
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => applyPreset('TUITION_ONLY')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-blue-700"
            >
              {isBn ? 'শুধু বেতন' : 'Tuition'}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('TUITION_AND_FOOD')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-blue-700"
            >
              {isBn ? 'বেতন + খাবার' : 'Tuition+Food'}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('ALL')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-blue-700"
            >
              {isBn ? 'সব ফি' : 'All Fees'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Jamat & Student */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'শ্রেণি / জামাত নির্বাচন করুন *' : 'Select Jamat / Class *'}
              </label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>
                    {isBn ? (c.nameBn || c.name) : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'ছাত্র নির্বাচন করুন *' : 'Select Student *'}
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">{isBn ? '-- ছাত্র নির্বাচন করুন --' : '-- Select Student --'}</option>
                {classStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.studentId ? `[আইডি: ${s.studentId}] ` : ''}{s.nameBn || s.name} {s.guardianName ? `(পিতা: ${s.guardianName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Student Banner */}
          {selectedStudent && (
            <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {selectedStudent.studentId || 'ID'}
                </span>
                <div>
                  <span className="font-bold text-blue-950">{selectedStudent.nameBn || selectedStudent.name}</span>
                  <span className="text-blue-700 ml-2">জামাত: {selectedStudent.classLevel}</span>
                </div>
              </div>
              <div className="text-blue-800 font-medium">
                <span>পিতা/অভিভাবক: {selectedStudent.guardianName || 'N/A'}</span>
                {selectedStudent.guardianPhone && <span className="ml-2 font-mono">({selectedStudent.guardianPhone})</span>}
              </div>
            </div>
          )}

          {/* Row 2: Month & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'বেতনের মাস *' : 'Fee Month *'}
              </label>
              <input
                type="month"
                value={feeMonth}
                onChange={(e) => setFeeMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'আদায়ের তারিখ *' : 'Date of Collection *'}
              </label>
              <input
                type="date"
                value={feeDate}
                onChange={(e) => setFeeDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Fee Breakdown Checklist */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-800">
                {isBn ? 'ফি এর খাতসমূহ নির্বাচন ও টাকার পরিমাণ:' : 'Fee Heads & Amounts:'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {isBn ? 'টিক দিয়ে সক্রিয় / পরিবর্তন করুন' : 'Check to enable'}
              </span>
            </div>

            {/* 1. Monthly Tuition */}
            <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeItems.tuition.enabled}
                  onChange={(e) => setFeeItems({ ...feeItems, tuition: { ...feeItems.tuition, enabled: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{isBn ? 'মাসিক বেতন (Monthly Tuition Fee)' : 'Monthly Tuition'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">৳</span>
                <input
                  type="number"
                  disabled={!feeItems.tuition.enabled}
                  value={feeItems.tuition.amount}
                  onChange={(e) => setFeeItems({ ...feeItems, tuition: { ...feeItems.tuition, amount: Number(e.target.value) } })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 2. Boarding & Food Fee */}
            <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeItems.boarding.enabled}
                  onChange={(e) => setFeeItems({ ...feeItems, boarding: { ...feeItems.boarding, enabled: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{isBn ? 'বোর্ডিং ও খাবার ফি (Boarding Mess Fee)' : 'Boarding Food Fee'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">৳</span>
                <input
                  type="number"
                  disabled={!feeItems.boarding.enabled}
                  value={feeItems.boarding.amount}
                  onChange={(e) => setFeeItems({ ...feeItems, boarding: { ...feeItems.boarding, amount: Number(e.target.value) } })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 3. Admission / Session Fee */}
            <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeItems.admission.enabled}
                  onChange={(e) => setFeeItems({ ...feeItems, admission: { ...feeItems.admission, enabled: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{isBn ? 'ভর্তি ও সেশন চার্জ (Admission / Session)' : 'Admission Fee'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">৳</span>
                <input
                  type="number"
                  disabled={!feeItems.admission.enabled}
                  value={feeItems.admission.amount}
                  onChange={(e) => setFeeItems({ ...feeItems, admission: { ...feeItems.admission, amount: Number(e.target.value) } })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 4. Exam Fee */}
            <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeItems.exam.enabled}
                  onChange={(e) => setFeeItems({ ...feeItems, exam: { ...feeItems.exam, enabled: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{isBn ? 'পরীক্ষার ফি (Examination Fee)' : 'Exam Fee'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">৳</span>
                <input
                  type="number"
                  disabled={!feeItems.exam.enabled}
                  value={feeItems.exam.amount}
                  onChange={(e) => setFeeItems({ ...feeItems, exam: { ...feeItems.exam, amount: Number(e.target.value) } })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 5. Book & Library */}
            <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/60">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feeItems.book.enabled}
                  onChange={(e) => setFeeItems({ ...feeItems, book: { ...feeItems.book, enabled: e.target.checked } })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>{isBn ? 'কিতাব ও খাতা ফি (Books & Library)' : 'Books / Kitab'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">৳</span>
                <input
                  type="number"
                  disabled={!feeItems.book.enabled}
                  value={feeItems.book.amount}
                  onChange={(e) => setFeeItems({ ...feeItems, book: { ...feeItems.book, amount: Number(e.target.value) } })}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                />
              </div>
            </div>

            {/* 6. Special Waiver / Discount */}
            <div className="flex items-center justify-between gap-3 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-700" />
                <span>{isBn ? 'বিশেষ ছাড় / এতিম ও দরিদ্র বৃত্তি (Waiver)' : 'Scholarship / Discount'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-amber-800 font-bold">- ৳</span>
                <input
                  type="number"
                  value={feeItems.waiver}
                  onChange={(e) => setFeeItems({ ...feeItems, waiver: Number(e.target.value) })}
                  className="w-24 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-right font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Payment Method, TrxID & Collector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="ROCKET">{isBn ? 'রকেট (Rocket)' : 'Rocket'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'ট্রানজেকশন / রেফারেন্স নং' : 'TrxID / Reference'}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isBn ? 'যেমন: TRX87652' : 'e.g. TRX1234'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'আদায়কারী কর্মকর্তা' : 'Collected By'}
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-800">
              <span>{isBn ? 'সর্বমোট প্রদেয় ফি: ' : 'Net Payable: '}</span>
              <span className="text-xl sm:text-2xl text-blue-700 font-black font-mono">
                ৳{isBn ? formatBanglaNumber(computedTotal.net) : computedTotal.net.toLocaleString()}
              </span>
            </div>

            <Button
              type="submit"
              size="md"
              variant="primary"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-7 font-bold text-xs"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'আদায় করুন ও রসিদ প্রিন্ট' : 'Collect & Print Receipt'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Column (4 Cols): Summary & Class Structure */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-blue-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            {isBn ? 'লাইভ রসিদ প্রিভিউ' : 'Live Receipt Preview'}
          </h3>

          <div className="mt-4 space-y-2 text-xs text-blue-100/90 border-t border-blue-500/50 pt-3">
            <div className="flex justify-between">
              <span>{isBn ? 'জামাত:' : 'Class:'}</span>
              <span className="font-bold text-white">{selectedClass}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'ছাত্রের নাম:' : 'Student:'}</span>
              <span className="font-bold text-white">{selectedStudent ? (selectedStudent.nameBn || selectedStudent.name) : '---'}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'বেতনের মাস:' : 'Month:'}</span>
              <span className="font-bold text-white">{feeMonth}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'মোট ফি:' : 'Total Gross:'}</span>
              <span className="font-semibold text-white">৳{computedTotal.gross}</span>
            </div>
            {computedTotal.discount > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>{isBn ? 'বৃত্তি / ছাড়:' : 'Waiver:'}</span>
                <span className="font-bold">- ৳{computedTotal.discount}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-blue-500/40">
              <span className="font-bold text-white">{isBn ? 'নিট আদায়যোগ্য:' : 'Net Due:'}</span>
              <span className="font-black text-amber-300 text-base font-mono">
                ৳{isBn ? formatBanglaNumber(computedTotal.net) : computedTotal.net.toLocaleString()}
              </span>
            </div>
          </div>

          <p className="mt-4 pt-3 border-t border-blue-500/50 text-[11px] text-blue-200 leading-relaxed">
            {isBn 
              ? '💡 রসিদ কাটলে সাথে সাথে হিসাবের খাতা আপডেট হবে এবং অভিভাবক কপি ও মাদ্রাসা অফিস কপি স্বয়ংক্রিয়ভাবে তৈরি হবে।' 
              : '💡 Submitting generates a dual-copy receipt and updates the central cashbook.'}
          </p>
        </div>

        {/* Current Class Standard Fee */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center justify-between">
            <span>{isBn ? `"${selectedClass}" এর আদর্শ ফি কাঠামো:` : `Standard Rates for ${selectedClass}:`}</span>
          </h4>
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>মাসিক বেতন:</span>
              <span className="font-bold text-slate-800 font-mono">৳{currentStructure.monthlyTuition}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>বোর্ডিং খাবার ফি:</span>
              <span className="font-bold text-slate-800 font-mono">৳{currentStructure.boardingFee || 0}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>ভর্তি ও সেশন চার্জ:</span>
              <span className="font-bold text-slate-800 font-mono">৳{currentStructure.admissionFee || 0}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>পরীক্ষার ফি:</span>
              <span className="font-bold text-slate-800 font-mono">৳{currentStructure.examFee || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
