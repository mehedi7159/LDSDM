import React, { useState } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  Printer, 
  ShieldCheck, 
  Coins, 
  User, 
  Phone, 
  Globe, 
  Building, 
  CheckCircle2, 
  CreditCard 
} from 'lucide-react';
import { FinanceTransaction, FundType, IncomeCategory } from '../../types';
import { formatBanglaNumber, generateVoucherNo } from '../../services/utils';
import { FUND_METAS } from './types';
import { Button } from '../ui/Button';

interface DonationEntryProps {
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
}

export const DonationEntry: React.FC<DonationEntryProps> = ({
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [donorName, setDonorName] = useState<string>('');
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorAddress, setDonorAddress] = useState<string>('');
  const [amount, setAmount] = useState<number>(1000);
  const [fundType, setFundType] = useState<FundType>('GENERAL');
  const [category, setCategory] = useState<IncomeCategory>('GENERAL_DONATION');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('মুহতামিম / হিসাবরক্ষক');

  // Quick Preset Amounts
  const presetAmounts = [500, 1000, 2000, 5000, 10000, 25000, 50000];

  const handleFundChange = (fund: FundType) => {
    setFundType(fund);
    if (fund === 'ZAKAT') {
      setCategory('ZAKAT_FITRA');
    } else if (fund === 'DEVELOPMENT') {
      setCategory('BUILDING_CONSTRUCTION');
    } else if (fund === 'ORPHAN_AID') {
      setCategory('ORPHAN_SPONSOR');
    } else if (fund === 'MAHFIL') {
      setCategory('MAHFIL_COLLECTION');
    } else {
      setCategory('GENERAL_DONATION');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim()) {
      showToast(isBn ? 'দয়া করে দানকারী / দাতার নাম লিখুন!' : 'Please enter donor name!');
      return;
    }
    if (!amount || amount <= 0) {
      showToast(isBn ? 'দানের পরিমাণ সঠিক নয়!' : 'Please enter a valid amount!');
      return;
    }

    const nextVoucher = generateVoucherNo('INCOME', transactions);
    const categoryLabels: Record<string, string> = {
      GENERAL_DONATION: 'সাধারণ দান ও হাদিয়া',
      ZAKAT_FITRA: 'যাকাত, ফিতরা ও সদকা',
      BUILDING_CONSTRUCTION: 'মসজিদ ও ভবন নির্মাণ অনুদান',
      MONTHLY_DONOR: 'আজীবন / দাতা সদস্য মাসিক অনুদান',
      QURBANI_LEATHER: 'কোরবানির চামড়া বাবদ দান',
      ORPHAN_SPONSOR: 'এতিম ও লিল্লাহ বোর্ডিং দান',
      MAHFIL_COLLECTION: 'বার্ষিক মাহফিল ও জলসা ফান্ড',
      MISC_INCOME: 'বিবিধ হাদিয়া',
    };

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'INCOME',
      category,
      categoryName: categoryLabels[category] || 'দান ও অনুদান',
      fundType,
      amount: Number(amount),
      date,
      paymentMethod,
      referenceNo,
      payerOrPayee: donorAddress ? `${donorName} (${donorAddress})` : donorName,
      contactNo: donorPhone,
      description: description || `${categoryLabels[category] || 'দান'} বাবদ এককালীন প্রাপ্তি`,
      collectedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `দান রসিদ নং ${nextVoucher} সফলভাবে তৈরি হয়েছে!` : `Donation receipt ${nextVoucher} created!`);
    onShowReceipt(created);

    // Reset Form
    setDonorName('');
    setDonorPhone('');
    setDonorAddress('');
    setDescription('');
    setReferenceNo('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Form (8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {isBn ? 'দান, সদকা, যাকাত ও অনুদান কাউন্টার' : 'Donations, Sadaqa & Grants Counter'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                {isBn ? 'সাধারণ দান, যাকাত, চামড়া ও দাতা সদস্যদের হাদিয়া এন্ট্রি ও রসিদ' : 'Record donations with instant printable receipt'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fund Selector Pills */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              {isBn ? 'দানের তহবিল ও ফান্ড নির্বাচন করুন *' : 'Select Target Fund *'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(Object.keys(FUND_METAS) as FundType[]).map(fund => {
                const info = FUND_METAS[fund];
                const isSelected = fundType === fund;
                return (
                  <button
                    key={fund}
                    type="button"
                    onClick={() => handleFundChange(fund)}
                    className={`text-left p-3 rounded-xl border text-sm font-bold transition-all duration-200 ${
                      isSelected 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs scale-[1.01]' 
                        : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{isBn ? info.nameBn : info.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Quick Amount Buttons */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              {isBn ? 'দানের পরিমাণ নির্বাচন বা টাইপ করুন (টাকা) *' : 'Donation Amount (BDT) *'}
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {presetAmounts.map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all ${
                    amount === val 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ৳{isBn ? formatBanglaNumber(val) : val.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">৳</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-lg text-slate-900 font-black font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Row: Donor Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'দানকারী / দাতার নাম *' : 'Donor Name *'}
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder={isBn ? 'যেমন: হাজী মো. আব্দুল হাই' : 'e.g. Haji Md. Abdul Hai'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'মোবাইল নম্বর' : 'Phone / Mobile'}
              </label>
              <input
                type="text"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Donor Address & Specific Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'ঠিকানা / পরিচিতি / দেশ' : 'Address / Organization / Country'}
              </label>
              <input
                type="text"
                value={donorAddress}
                onChange={(e) => setDonorAddress(e.target.value)}
                placeholder={isBn ? 'যেমন: যুক্তরাজ্য প্রবাসী / গ্রাম: মিরপুর' : 'e.g. UK Expatriate / Local'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'দানের নির্দিষ্ট খাত *' : 'Donation Category *'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="GENERAL_DONATION">{isBn ? 'সাধারণ দান ও হাদিয়া' : 'General Donation'}</option>
                <option value="ZAKAT_FITRA">{isBn ? 'যাকাত, ফিতরা ও সদকা' : 'Zakat & Fitra'}</option>
                <option value="BUILDING_CONSTRUCTION">{isBn ? 'মসজিদ ও ভবন নির্মাণ অনুদান' : 'Building Construction'}</option>
                <option value="MONTHLY_DONOR">{isBn ? 'আজীবন / দাতা সদস্য মাসিক অনুদান' : 'Monthly Donor'}</option>
                <option value="QURBANI_LEATHER">{isBn ? 'কোরবানির চামড়া বাবদ দান' : 'Qurbani Skin'}</option>
                <option value="ORPHAN_SPONSOR">{isBn ? 'লিল্লাহ ও এতিম প্রতিপালন দান' : 'Orphan Sponsor'}</option>
                <option value="MAHFIL_COLLECTION">{isBn ? 'বার্ষিক মাহফিল ও জলসা ফান্ড' : 'Mahfil Collection'}</option>
                <option value="MISC_INCOME">{isBn ? 'অন্যান্য অনুদান' : 'Other Donation'}</option>
              </select>
            </div>
          </div>

          {/* Payment Method, Date, Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'পরিশোধ মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক হিসাব' : 'Bank Transfer'}</option>
                <option value="CHEQUE">{isBn ? 'চেক (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'তারিখ *' : 'Date *'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'চেক / ট্রানজেকশন নং' : 'Reference / TrxID'}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isBn ? 'ঐচ্ছিক' : 'Optional'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description & Collector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'মন্তব্য / উদ্দেশ্য' : 'Description / Remarks'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isBn ? 'যেমন: মরহুম পিতার ইসালে সওয়াবের নিয়তে দান' : 'Remarks'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {isBn ? 'গ্রহণকারী কর্মকর্তা' : 'Received By'}
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <Button
              type="submit"
              size="md"
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 font-bold text-sm shadow-sm hover:shadow-md transition-all"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isBn ? 'দান গ্রহণ করুন ও রসিদ দিন' : 'Accept Donation & Print Receipt'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Column (4 Cols): Benefits & Shariah Note */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-gradient-to-br from-emerald-800 to-teal-950 text-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-emerald-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            {isBn ? 'স্বচ্ছ ও বরকতময় হিসাবরক্ষণ' : 'Shariah Fund Management'}
          </h3>

          <p className="mt-3 text-sm text-emerald-100/90 leading-relaxed font-medium">
            {isBn 
              ? 'মাদ্রাসার যাকাত, লিল্লাহ ও উন্নয়ন ফান্ড সম্পূর্ণ আলাদাভাবে সংরক্ষিত হয়। প্রতিটি দানের জন্য অফিস কপি ও দাতা কপি সহ রসিদ তৈরি হয়।'
              : 'Every donation is tagged with Shariah-compliant fund segregation and audited receipts.'}
          </p>

          <div className="mt-4 pt-4 border-t border-emerald-700/80 space-y-3 text-sm font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'যাকাত ও ফিতরা ফান্ড পৃথক সংরক্ষণ' : 'Strict Zakat Segregation'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'ডিজিটাল ভাউচার ও সিরিয়াল ট্র্যাকিং' : 'Sequential Voucher Generation'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{isBn ? 'দাতা সদস্যদের স্থায়ী ডাটাবেজ' : 'Permanent Donor Records'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
