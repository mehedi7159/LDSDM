import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, ShieldAlert, Sparkles, FileSpreadsheet } from 'lucide-react';
import { AdminAuthModal } from './AdminAuthModal';

interface AccessRestrictedViewProps {
  moduleName?: string;
  onGoToResults?: () => void;
}

export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({ moduleName, onGoToResults }) => {
  const { language } = useApp();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/90 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert size={32} />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/70 text-amber-900 border border-amber-200">
            <Lock size={12} />
            {language === 'bn' ? 'এডমিন অনুমতি প্রয়োজন' : 'Admin Permission Required'}
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {moduleName ? (language === 'bn' ? `${moduleName} সুরক্ষিত` : `${moduleName} Protected`) : (language === 'bn' ? 'সুরক্ষিত এডমিন প্যানেল' : 'Protected Admin Panel')}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {language === 'bn'
              ? 'এই সেকশনে ডেটা এন্ট্রি, এডিট বা পরিবর্তনের জন্য মাদ্রাসা কর্তৃপক্ষের এডমিন লগইন প্রয়োজন। সাধারণ ব্যবহারকারীরা শুধুমাত্র রেজাল্ট ও মার্কশিট দেখতে পারবেন।'
              : 'Administrative login is required to modify students, subjects, marks, or settings. Viewers can view and search published results.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-left space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles size={14} className="text-blue-600" />
            <span>{language === 'bn' ? 'অনুমোদিত এডমিন ইমেইল:' : 'Authorized Administrator:'}</span>
          </div>
          <p className="font-mono text-[11px] font-semibold text-blue-700 bg-white p-2 rounded-lg border border-slate-200 truncate">
            mehedihasansagor26@gmail.com
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Lock size={14} />
            <span>{language === 'bn' ? 'এডমিন মোডে লগইন করুন' : 'Login as Admin'}</span>
          </button>

          {onGoToResults && (
            <button
              onClick={onGoToResults}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <FileSpreadsheet size={14} />
              <span>{language === 'bn' ? 'ফলাফল অনুসন্ধান' : 'Go to Results'}</span>
            </button>
          )}
        </div>
      </div>

      <AdminAuthModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </div>
  );
};
