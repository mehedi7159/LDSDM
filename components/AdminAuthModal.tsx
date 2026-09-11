import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Lock, ShieldCheck, Mail, KeyRound, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { language, loginAdmin, loginWithGoogle } = useApp();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'google' | 'pin'>('google');

  if (!isOpen) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(pinInput)) {
      setPinError(null);
      setPinInput('');
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setPinError(language === 'bn' ? 'ভুল পিন কোড! আপনার সেট করা সঠিক এডমিন পিন দিন।' : 'Invalid PIN Code! Please enter your valid Admin PIN.');
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoggingIn(true);
    setPinError(null);
    try {
      const success = await loginWithGoogle();
      if (success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        // Fallback to quick PIN
        setActiveMethod('pin');
        setPinError(language === 'bn' 
          ? 'ব্রাউজার পপআপ কাজ না করলে আপনার এডমিন পিন ব্যবহার করে লগইন করুন।' 
          : 'Popup restricted? Please use your Admin PIN to sign in.');
      }
    } catch (err: any) {
      setActiveMethod('pin');
      setPinError(language === 'bn' 
        ? 'এডমিন পিন দিয়ে লগইন সম্পন্ন করুন।' 
        : 'Please use your Admin PIN to log in.');
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Decorative subtle gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {language === 'bn' ? 'এডমিন অ্যাক্সেস প্রমাণীকরণ' : 'Admin Mode Authentication'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'bn' 
                ? 'ডেটা ম্যানেজমেন্ট ও ক্লাউড নিয়ন্ত্রণের জন্য লগইন করুন' 
                : 'Sign in to edit, add marks, and manage data'}
            </p>
          </div>
        </div>

        {/* Method selector tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMethod('google')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeMethod === 'google' 
                ? 'bg-white text-blue-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={14} />
            <span>{language === 'bn' ? 'জিমেইল / গুগল লগইন' : 'Google / Gmail'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMethod('pin')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeMethod === 'pin' 
                ? 'bg-white text-blue-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound size={14} />
            <span>{language === 'bn' ? 'এডমিন পিন কোড' : 'Admin PIN'}</span>
          </button>
        </div>

        {/* Error notice */}
        {pinError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{pinError}</span>
          </div>
        )}

        {activeMethod === 'google' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100/80 text-xs text-blue-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <Sparkles size={14} className="text-blue-600" />
                <span>{language === 'bn' ? 'অ্যাডমিন অ্যাকাউন্ট' : 'Primary Admin Email'}</span>
              </div>
              <p className="font-mono text-[11px] font-semibold text-blue-700 bg-white/80 p-2 rounded-lg border border-blue-200/60 truncate">
                mehedihasansagor26@gmail.com
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {language === 'bn'
                  ? 'গুগল দিয়ে লগইন করলে সমস্ত পরিবর্তন স্বয়ংক্রিয়ভাবে আপনার ফায়ারবেস ক্লাউডে রিয়েল-টাইমে সংরক্ষিত হবে।'
                  : 'Logging in with Google syncs all modifications across AI Studio & Vercel live.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-bold flex items-center justify-center gap-3 shadow-md shadow-slate-900/10 transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGoogleLoggingIn ? (language === 'bn' ? 'লগইন হচ্ছে...' : 'Signing in...') : (language === 'bn' ? 'Google / Gmail দিয়ে এক ক্লিকে লগইন' : 'Sign in with Google Account')}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {language === 'bn' ? 'সিকিউরিটি পিন কোড দিন' : 'Security PIN Code'}
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="******"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-center text-xl tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors"
              >
                {language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                {language === 'bn' ? 'আনলক করুন' : 'Unlock Admin'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
