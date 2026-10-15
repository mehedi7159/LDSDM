import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Lock, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ArrowLeft, 
  Sparkles, 
  UserCheck, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle,
  UserPlus,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserRole } from '../types';

interface AuthPortalProps {
  onBackToLanding: () => void;
  onSuccess?: () => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onBackToLanding, onSuccess }) => {
  const { 
    loginWithGoogle, 
    loginWithEmailOrPhone, 
    signUpUser, 
    classes, 
    students,
    schoolProfile,
    language 
  } = useApp();

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Login Form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sign Up Form
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('teacher');
  const [signupDesignation, setSignupDesignation] = useState('');
  const [signupStudentId, setSignupStudentId] = useState('');
  const [signupStudentClass, setSignupStudentClass] = useState(classes[0]?.name || 'Class 6');

  // Status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      setErrorMsg('মোবাইল নম্বর অথবা ইমেইল দিন।');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg('পাসওয়ার্ড লিখুন।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await loginWithEmailOrPhone(loginIdentifier, loginPassword);
      if (res.success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.message || 'লগইন ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ত্রুটি ঘটেছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim()) {
      setErrorMsg('আপনার সম্পূর্ণ নাম লিখুন।');
      return;
    }
    if (!signupPhone.trim()) {
      setErrorMsg('মোবাইল নম্বর লিখুন।');
      return;
    }
    if (!signupPassword.trim() || signupPassword.length < 3) {
      setErrorMsg('পাসওয়ার্ড কমপক্ষে ৩ সংখ্যার হতে হবে।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await signUpUser({
        name: signupName.trim(),
        nameBn: signupName.trim(),
        phone: signupPhone.trim(),
        email: signupEmail.trim() || undefined,
        password: signupPassword.trim(),
        role: signupRole,
        designation: signupDesignation.trim() || (signupRole === 'teacher' ? 'মুয়াল্লিম' : signupRole === 'guardian' ? 'অভিভাবক' : signupRole === 'accountant' ? 'হিসাবরক্ষক' : 'স্টাফ'),
        studentId: signupRole === 'guardian' ? signupStudentId.trim() : undefined,
        studentClass: signupRole === 'guardian' ? signupStudentClass : undefined
      });

      if (res.success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.message || 'নিবন্ধন সম্পন্ন করা যায়নি।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ত্রুটি ঘটেছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await loginWithGoogle();
      if (ok) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg('গুগল সাইন ইন উইন্ডো বন্ধ করা হয়েছে। প্রয়োজনে মোবাইল বা ইমেইল দিয়ে লগইন করুন।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'গুগল সাইন ইন সমস্যা।');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Quick Demo Account Auto-Fill
  const handleQuickDemoFill = (role: UserRole) => {
    setErrorMsg(null);
    if (role === 'super_admin') {
      setLoginIdentifier('mehedihasansagor26@gmail.com');
      setLoginPassword('admin');
    } else if (role === 'teacher') {
      setLoginIdentifier('01811223344');
      setLoginPassword('123');
    } else if (role === 'accountant') {
      setLoginIdentifier('01911223344');
      setLoginPassword('123');
    } else if (role === 'staff') {
      setLoginIdentifier('01611223344');
      setLoginPassword('123');
    } else if (role === 'guardian') {
      setLoginIdentifier('01711223344');
      setLoginPassword('123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>মূল পাতায় ফিরে যান</span>
          </button>

          <div className="text-right">
            <span className="text-xs font-bold text-slate-800 block">{schoolProfile.nameBn || schoolProfile.name}</span>
            <span className="text-[10px] text-slate-400 block">দাখিল মাদ্রাসা ম্যানেজমেন্ট সিস্টেম</span>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-xl border border-slate-200/90 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Top Gradient */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600" />

          {/* Heading */}
          <div className="text-center space-y-1.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-xs border border-emerald-100">
              <ShieldCheck size={26} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {authMode === 'login' ? 'মাদ্রাসা পোর্টাল লগইন' : 'নতুন একাউন্ট নিবন্ধন'}
            </h2>
            <p className="text-xs text-slate-500">
              {authMode === 'login' 
                ? 'আপনার নির্দিষ্ট রোলের ড্যাশবোর্ডে প্রবেশ করুন' 
                : 'শিক্ষক, স্টাফ বা অভিভাবক হিসেবে অ্যাকাউন্ট তৈরি করুন'}
            </p>
          </div>

          {/* Mode Tabs (Login vs SignUp) */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-5 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setErrorMsg(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                authMode === 'login' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              লগইন (Login)
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setErrorMsg(null); }}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                authMode === 'signup' 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              নিবন্ধন (Sign Up)
            </button>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
          )}

          {/* 1-Click Google Login Button */}
          <div className="space-y-3 mb-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleSubmitting}
              className="w-full py-3 px-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-3 shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGoogleSubmitting ? 'গুগল কানেক্ট হচ্ছে...' : 'Google / Gmail দিয়ে এক ক্লিকে প্রবেশ'}</span>
            </button>

            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-semibold">
              <span className="flex-1 h-px bg-slate-200"></span>
              <span>অথবা মোবাইল / পাসওয়ার্ড</span>
              <span className="flex-1 h-px bg-slate-200"></span>
            </div>
          </div>

          {/* Form */}
          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোবাইল নম্বর অথবা ইমেইল (Mobile or Email)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="যেমন: 01712345678"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <Phone size={15} className="absolute left-3.5 top-3 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="******"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'যাচাই করা হচ্ছে...' : 'লগইন করুন'}</span>
                <ChevronRight size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সম্পূর্ণ নাম (Full Name) *
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="যেমন: হাফেজ মাওলানা মোঃ আব্দুল্লাহ"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    পাসওয়ার্ড *
                  </label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="******"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  আপনার ভূমিকা / রোল (User Role) *
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="teacher">মুয়াল্লিম / শিক্ষক (Teacher)</option>
                  <option value="guardian">অভিভাবক (Guardian / Parent)</option>
                  <option value="accountant">হিসাবরক্ষক (Accountant / Cashier)</option>
                  <option value="staff">অফিস স্টাফ / সহকারী (Office Staff)</option>
                </select>
              </div>

              {signupRole === 'guardian' && (
                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-purple-900 block">শিক্ষার্থীর তথ্য লিংক করুন:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={signupStudentId}
                      onChange={(e) => setSignupStudentId(e.target.value)}
                      placeholder="শিক্ষার্থী আইডি বা রোল"
                      className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-xs"
                    />
                    <select
                      value={signupStudentClass}
                      onChange={(e) => setSignupStudentClass(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-xs"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.nameBn || c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পদবী / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={signupDesignation}
                  onChange={(e) => setSignupDesignation(e.target.value)}
                  placeholder="যেমন: আরবি প্রভাষক / অভিভাবক"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'অ্যাকাউন্ট তৈরি হচ্ছে...' : 'নিবন্ধন সম্পন্ন করুন'}</span>
              </button>
            </form>
          )}

          {/* Quick Demo Credentials Switcher */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              এক ক্লিকে ডেমো রোল টেস্ট করুন:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoFill('super_admin')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold hover:bg-black transition-colors cursor-pointer"
              >
                সুপার অ্যাডমিন
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('teacher')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                শিক্ষক
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('accountant')}
                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold hover:bg-blue-100 transition-colors cursor-pointer"
              >
                হিসাবরক্ষক
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('guardian')}
                className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold hover:bg-purple-100 transition-colors cursor-pointer"
              >
                অভিভাবক
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} {schoolProfile.nameBn || schoolProfile.name} • সকল ডাটা ক্লাউডে সুরক্ষিত</p>
      </footer>
    </div>
  );
};
