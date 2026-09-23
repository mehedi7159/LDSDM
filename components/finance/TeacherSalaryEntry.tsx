import React, { useState } from 'react';
import { 
  CreditCard, 
  Sparkles, 
  Printer, 
  UserCheck, 
  ShieldCheck, 
  Coins, 
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { FinanceTransaction } from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { Button } from '../ui/Button';

interface TeacherSalaryEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const TeacherSalaryEntry: React.FC<TeacherSalaryEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [staffName, setStaffName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('মুদাররিস (শিক্ষক)');
  const [phone, setPhone] = useState<string>('');
  const [salaryMonth, setSalaryMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Salary Components
  const [basicSalary, setBasicSalary] = useState<number>(12000);
  const [allowance, setAllowance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'BANK_TRANSFER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('মুহতামিম সাহেব');

  // Common designations in Madrasah
  const commonDesignations = [
    'মুহতামিম (Principal)',
    'শায়খুল হাদিস (Head of Hadith)',
    'নায়েবে মুহতামিম (Vice Principal)',
    'সিনিয়র মুদাররিস (Senior Teacher)',
    'মুদাররিস / শিক্ষক (Teacher)',
    'হাফেজ / ক্বারী সাহেব (Hifz Teacher)',
    'নাজেরা শিক্ষক (Nazera Teacher)',
    'হিসাবরক্ষক (Accountant)',
    'বাবুর্চি / খাদের (Staff / Cook)',
    'অফিস সহকারী (Office Assistant)'
  ];

  const netPayable = Math.max(0, (Number(basicSalary) || 0) + (Number(allowance) || 0) - (Number(deduction) || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) {
      alert(isBn ? 'দয়া করে উস্তাদ বা স্টাফের নাম লিখুন!' : 'Please enter staff name!');
      return;
    }
    if (netPayable <= 0) {
      alert(isBn ? 'বেতনের পরিমাণ সঠিক নয়!' : 'Net salary must be greater than 0!');
      return;
    }

    const nextVoucher = generateVoucherNo('EXPENSE', transactions);

    const desc = `${salaryMonth} মাসের বেতন/হাদিয়া পরিশোধ (মূল: ৳${basicSalary}${allowance > 0 ? `, ভাতা: ৳${allowance}` : ''}${deduction > 0 ? `, কর্তন: ৳${deduction}` : ''}) ${notes ? `— ${notes}` : ''}`;

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'EXPENSE',
      category: 'STAFF_SALARY',
      categoryName: isBn ? 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া' : 'Staff Salary & Allowance',
      fundType: 'GENERAL',
      amount: netPayable,
      date: payDate,
      paymentMethod,
      referenceNo,
      payerOrPayee: `${staffName} [${designation}]`,
      contactNo: phone,
      description: desc,
      collectedBy: approvedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `বেতন ভাউচার নং ${nextVoucher} সফলভাবে পরিশোধ হয়েছে!` : `Salary voucher ${nextVoucher} created!`);
    onShowReceipt(created);

    // Reset fields
    setStaffName('');
    setNotes('');
    setReferenceNo('');
    setAllowance(0);
    setDeduction(0);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isBn ? 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া প্রদান' : 'Teacher & Staff Salary Disbursement'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isBn ? 'মাসিক হাদিয়া, ভাতাসমূহ ও কর্তনের হিসাব সহ ডেবিট ভাউচার তৈরি' : 'Disburse monthly salaries with automated debit voucher'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Teacher Name & Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'উস্তাদ / স্টাফের নাম *' : 'Teacher / Staff Name *'}
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder={isBn ? 'যেমন: মাওলানা মাহমুদুল হাসান' : 'e.g. Maulana Mahmudul Hasan'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'পদবি / দায়িত্ব *' : 'Designation *'}
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                {commonDesignations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Month, Date & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'বেতনের মাস *' : 'Salary Month *'}
              </label>
              <input
                type="month"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'প্রদানের তারিখ *' : 'Payment Date *'}
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone Number'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Salary Breakdown Block */}
          <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold text-rose-950 block">
              {isBn ? 'হাদিয়া ও ভাতার বিস্তারিত বিভাজন:' : 'Salary Breakdown:'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-rose-200/80">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isBn ? 'মূল হাদিয়া / বেতন *' : 'Basic Salary *'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={basicSalary || ''}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-rose-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200/80">
                <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                  {isBn ? '+ অন্যান্য ভাতা / মেহমানদারি' : '+ Allowances / Bonus'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={allowance || ''}
                    onChange={(e) => setAllowance(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                <label className="block text-[11px] font-bold text-amber-800 mb-1">
                  {isBn ? '- অগ্রিম / ঋণ কর্তন' : '- Deduction / Advance'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
                  <input
                    type="number"
                    value={deduction || ''}
                    onChange={(e) => setDeduction(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-amber-300 rounded-lg pl-6 pr-2 py-1.5 text-xs text-right font-black font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার' : 'Bank Transfer'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'চেক / ট্রানজেকশন আইডি' : 'TrxID / Cheque'}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isBn ? 'অনুমোদনকারী' : 'Approved By'}
              </label>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-800">
              <span>{isBn ? 'নিট পরিশোধযোগ্য হাদিয়া: ' : 'Net Payable: '}</span>
              <span className="text-xl sm:text-2xl text-rose-700 font-black font-mono">
                ৳{isBn ? formatBanglaNumber(netPayable) : netPayable.toLocaleString()}
              </span>
            </div>

            <Button
              type="submit"
              size="md"
              variant="primary"
              className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-8 font-bold text-xs"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'বেতন পরিশোধ করুন ও ভাউচার প্রিন্ট' : 'Disburse & Print Voucher'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Column (4 Cols): Summary */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-gradient-to-br from-slate-900 to-rose-950 text-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-rose-400" />
            {isBn ? 'পে-রোল ও হাদিয়া ভাউচার' : 'Payroll Voucher Status'}
          </h3>

          <div className="mt-4 space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
            <div className="flex justify-between">
              <span>{isBn ? 'উস্তাদের নাম:' : 'Name:'}</span>
              <span className="font-bold text-white">{staffName || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'পদবি:' : 'Designation:'}</span>
              <span className="font-semibold text-rose-200">{designation}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'বেতনের মাস:' : 'Month:'}</span>
              <span className="font-bold text-white">{salaryMonth}</span>
            </div>
            <div className="flex justify-between">
              <span>{isBn ? 'মূল হাদিয়া:' : 'Basic:'}</span>
              <span className="font-semibold text-white">৳{basicSalary || 0}</span>
            </div>
            {allowance > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>{isBn ? 'ভাতা:' : 'Allowance:'}</span>
                <span>+ ৳{allowance}</span>
              </div>
            )}
            {deduction > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>{isBn ? 'কর্তন:' : 'Deduction:'}</span>
                <span>- ৳{deduction}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-800">
              <span className="font-bold text-white">{isBn ? 'সর্বমোট প্রদেয়:' : 'Net Paid:'}</span>
              <span className="font-black text-rose-400 text-base font-mono">
                ৳{isBn ? formatBanglaNumber(netPayable) : netPayable.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
