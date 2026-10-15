import React from 'react';
import { ShieldAlert, Clock, Mail, Phone, LogOut, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PendingApprovalViewProps {
  onLogout: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({ onLogout }) => {
  const { authUser, currentMember, schoolProfile, language } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header decoration */}
        <div className={`p-6 text-white text-center relative overflow-hidden ${
          currentMember?.status === 'suspended'
            ? 'bg-gradient-to-r from-rose-600 to-red-600'
            : currentMember?.status === 'inactive'
            ? 'bg-gradient-to-r from-slate-700 to-slate-800'
            : 'bg-gradient-to-r from-amber-500 to-orange-500'
        }`}>
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner">
            {currentMember?.status === 'suspended' ? (
              <ShieldAlert size={32} className="text-white animate-bounce" />
            ) : (
              <Clock size={32} className="text-white animate-pulse" />
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {currentMember?.status === 'suspended' 
              ? (language === 'bn' ? 'অ্যাকাউন্ট স্থগিত করা হয়েছে' : 'Account Suspended')
              : currentMember?.status === 'inactive'
              ? (language === 'bn' ? 'অ্যাকাউন্ট সাময়িকভাবে নিষ্ক্রিয়' : 'Account Inactive')
              : (language === 'bn' ? 'অ্যাকাউন্ট অনুমোদনের অপেক্ষায়' : 'Account Under Review')}
          </h2>
          <p className="text-xs text-white/90 mt-1">
            {currentMember?.status === 'suspended'
              ? (language === 'bn' ? 'আপনার অ্যাকাউন্টটি প্রশাসনিক কারণে স্থগিত করা হয়েছে। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'Your account has been suspended. Please contact the administrator.')
              : currentMember?.status === 'inactive'
              ? (language === 'bn' ? 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় অবস্থায় রয়েছে।' : 'Your account is currently inactive.')
              : (language === 'bn' 
                  ? 'আপনার নিবন্ধন সফল হয়েছে। অ্যাডমিনের অনুমোদনের পর অ্যাক্সেস সচল হবে।'
                  : 'Your registration is received and waiting for Admin approval.')}
          </p>
        </div>

        {/* Content Details */}
        <div className="p-6 space-y-5">
          {/* User Details Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">{language === 'bn' ? 'ব্যবহারকারী:' : 'Name:'}</span>
              <span className="font-bold text-slate-800">{authUser?.displayName || authUser?.email?.split('@')[0]}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">{language === 'bn' ? 'ইমেইল:' : 'Email:'}</span>
              <span className="font-mono text-slate-700">{authUser?.email}</span>
            </div>
            {currentMember?.requestedRole && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{language === 'bn' ? 'আবেদিত রোল:' : 'Requested Role:'}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                  {currentMember.requestedRole}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">{language === 'bn' ? 'বর্তমান স্ট্যাটাস:' : 'Current Status:'}</span>
              <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                currentMember?.status === 'suspended'
                  ? 'text-rose-600'
                  : currentMember?.status === 'inactive'
                  ? 'text-slate-600'
                  : 'text-amber-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  currentMember?.status === 'suspended'
                    ? 'bg-rose-500'
                    : currentMember?.status === 'inactive'
                    ? 'bg-slate-500'
                    : 'bg-amber-500 animate-ping'
                }`} />
                {currentMember?.status === 'suspended'
                  ? (language === 'bn' ? 'স্থগিত (Suspended)' : 'Suspended')
                  : currentMember?.status === 'inactive'
                  ? (language === 'bn' ? 'নিষ্ক্রিয় (Inactive)' : 'Inactive')
                  : (language === 'bn' ? 'পেন্ডিং (অপেক্ষমাণ)' : 'Pending Approval')}
              </span>
            </div>
          </div>

          {/* Info Instructions */}
          <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-blue-600" />
              {language === 'bn' ? 'পরবর্তী করণীয়:' : 'Next Steps:'}
            </p>
            <p>
              {language === 'bn'
                ? `প্রতিষ্ঠানের প্রধান (${schoolProfile.headMasterName || 'অ্যাডমিন'}) আপনার আবেদন যাচাই করে আপনার ক্লাসরুম, বিষয় বা হিসাবরক্ষণ দায়িত্ব বরাদ্দ করবেন।`
                : `The administrator will review your profile and assign your authorized classes, subjects, or role.`}
            </p>
            <div className="pt-2 border-t border-blue-100/80 flex flex-col gap-1 text-[11px] text-slate-500">
              {schoolProfile.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={12} className="text-blue-600" />
                  <span>{schoolProfile.phone}</span>
                </div>
              )}
              {schoolProfile.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={12} className="text-blue-600" />
                  <span>{schoolProfile.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut size={15} />
              <span>{language === 'bn' ? 'লগআউট করে ফিরে যান' : 'Sign Out & Return'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
