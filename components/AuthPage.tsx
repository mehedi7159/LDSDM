import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  User, 
  Phone, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Search,
  LogIn,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  Download,
  Printer,
  ChevronRight,
  Shield,
  GraduationCap
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { calculateTotalGPA, calculateGrade, getConsolidatedMark } from '../services/utils';

interface AuthPageProps {
  initialView?: 'gateway' | 'results' | 'login';
  onBack?: () => void;
  onStudentProfile?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialView = 'gateway', onBack, onStudentProfile }) => {
  const { 
    schoolProfile, 
    language, 
    setLanguage,
    loginWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    resetPassword,
    students = [],
    classes = [],
    exams = [],
    subjects = [],
    marks = []
  } = useApp();

  // Active view: 'gateway' (2 options), 'login' (clean login), 'register' (clean signup), 'results' (public results)
  const [currentView, setCurrentView] = useState<'gateway' | 'login' | 'register' | 'results'>(initialView);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('সহকারী শিক্ষক (Teacher)');

  // Public Result Search State
  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset Password State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Bengali numerals converter
  const toBn = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    const str = String(num);
    if (language !== 'bn') return str;
    const bnDigits: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
    };
    return str.split('').map(c => bnDigits[c] || c).join('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMessage(language === 'bn' ? 'অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড প্রদান করুন।' : 'Please provide email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await signInWithEmail(loginEmail, loginPassword);
      if (!res.success) {
        setErrorMessage(res.error || (language === 'bn' ? 'লগইন ব্যর্থ হয়েছে। ইমেইল বা পাসওয়ার্ড সঠিক কিনা পরীক্ষা করুন।' : 'Login failed. Please check credentials.'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      setErrorMessage(language === 'bn' ? 'অনুগ্রহ করে নাম, ইমেইল ও পাসওয়ার্ড পূরণ করুন।' : 'Please fill all required fields.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await signUpWithEmail(regEmail, regPassword, regName, regRole, regPhone);
      if (res.success) {
        setSuccessMessage(language === 'bn' 
          ? 'অ্যাকাউন্ট নিবন্ধন সফল হয়েছে! অ্যাডমিন অনুমোদনের জন্য অপেক্ষা করুন।' 
          : 'Registration successful! Waiting for administrator approval.');
      } else {
        setErrorMessage(res.error || (language === 'bn' ? 'নিবন্ধন ব্যর্থ হয়েছে।' : 'Registration failed.'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const success = await loginWithGoogle();
      if (!success) {
        setErrorMessage(language === 'bn' ? 'গুগল সাইন-ইন সম্পন্ন হয়নি।' : 'Google Sign-In was not completed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Auth Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      const res = await resetPassword(resetEmail);
      if (res.success) {
        alert(language === 'bn' ? 'পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।' : 'Password reset link sent to your email.');
        setIsResetOpen(false);
        setResetEmail('');
      } else {
        alert(res.error || 'Reset error');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleResultSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchStudentQuery.trim().toLowerCase();
    if (!query) return;

    setHasSearched(true);
    const found = students.find(s => 
      (s.studentId && String(s.studentId).toLowerCase() === query) || 
      (s.roll != null && String(s.roll).toLowerCase() === query) ||
      (s.name && String(s.name).toLowerCase().includes(query)) ||
      (s.nameBn && s.nameBn.includes(query))
    );

    setSearchedStudent(found || null);
  };

  // Selected exam details for result rendering
  const activeExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Calculated results for searched student
  const studentResultData = React.useMemo(() => {
    if (!searchedStudent || !activeExam) return null;

    const studentClassSubjects = subjects.filter(s => 
      s.classLevel === searchedStudent.class || s.classLevel === searchedStudent.classLevel
    );

    const relevantSubjects = studentClassSubjects.filter(s => 
      !s.examIds || s.examIds.length === 0 || s.examIds.includes(activeExam.id)
    );

    const subjectBreakdown = relevantSubjects.map(sub => {
      const markRec = getConsolidatedMark(searchedStudent.id, sub.id, activeExam.id, exams, marks);
      const obtained = markRec?.obtained ?? 0;
      const full = sub.fullMarks || 100;
      const pass = sub.passMarks || Math.round(full * 0.33);
      const gradeInfo = calculateGrade(obtained, full);

      return {
        subject: sub,
        obtained,
        fullMarks: full,
        passMarks: pass,
        grade: gradeInfo.grade,
        gpa: gradeInfo.gpa,
        isPassed: gradeInfo.grade !== 'F'
      };
    });

    const gpaStats = calculateTotalGPA(
      relevantSubjects, 
      marks, 
      searchedStudent.id, 
      activeExam.id, 
      searchedStudent.group, 
      exams
    );

    return {
      student: searchedStudent,
      exam: activeExam,
      subjectBreakdown,
      gpaStats
    };
  }, [searchedStudent, activeExam, subjects, marks, exams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-600 selection:text-white relative">
      
      {/* Subtle Top Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-indigo-600/10 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div 
          onClick={() => { setCurrentView('gateway'); setErrorMessage(''); }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-white tracking-tight leading-tight">
              {schoolProfile.nameBn || schoolProfile.name}
            </h1>
            <p className="text-[11px] text-slate-400">
              {schoolProfile.addressBn || schoolProfile.address || 'স্মার্ট মাদ্রাসা ও শিক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <PWAInstallButton />

          <button
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            {language === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        
        {/* ========================================================================= */}
        {/* VIEW 1: GATEWAY (TWO MAIN CHOICES: RESULTS SEARCH vs ACCOUNT LOGIN)       */}
        {/* ========================================================================= */}
        {currentView === 'gateway' && (
          <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Header Text */}
            <div className="text-center space-y-2.5 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                <Sparkles size={13} className="text-indigo-400" />
                <span>দারুল উলুম মাদ্রাসা পোর্টাল</span>
              </div>
              
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {schoolProfile.nameBn || schoolProfile.name}
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-400">
                নিচের যেকোনো একটি অপশন নির্বাচন করুন: শিক্ষার্থী/অভিভাবক ফলাফল অনুসন্ধান অথবা প্রাতিষ্ঠানিক অ্যাকাউন্ট লগইন
              </p>
            </div>

            {/* 2 Primary Choice Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              
              {/* OPTION 1: RESULT SEARCH */}
              <div 
                onClick={() => setCurrentView('results')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-950/40 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Award size={28} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
                      <span>পরীক্ষার ফলাফল ও মার্কশিট</span>
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      শিক্ষার্থী বা অভিভাবকগণ রোল নম্বর ও পরীক্ষা নির্বাচন করে সরাসরি ফলাফল, বিষয়ভিত্তিক নম্বর ও ডিজিটাল মার্কশিট দেখুন।
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Search size={14} />
                    <span>লগইন ছাড়াই সরাসরি রেজাল্ট চেক</span>
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform">শুরু করুন →</span>
                </div>
              </div>

              {/* OPTION 2: ACCOUNT LOGIN */}
              <div 
                onClick={() => { setCurrentView('login'); setErrorMessage(''); }}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/40 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LogIn size={28} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
                      <span>অ্যাকাউন্ট লগইন / প্রবেশ</span>
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      মুহতামিম, শিক্ষক, হিসাবরক্ষক ও কর্মীদের জন্য ক্লাসরুম ম্যানেজমেন্ট, মার্কস এন্ট্রি, হাজিরা ও প্রাতিষ্ঠানিক পোর্টাল।
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                  <span className="flex items-center gap-1.5">
                    <Shield size={14} />
                    <span>সুরক্ষিত স্টাফ ও অভিভাবক পোর্টাল</span>
                  </span>
                  <span className="group-hover:translate-x-1 transition-transform">লগইন করুন →</span>
                </div>
              </div>

            </div>

            {/* Quick Helper Note */}
            <div className="text-center">
              <p className="text-xs text-slate-500">
                শিক্ষাবর্ষ: <strong className="text-slate-400">{toBn(schoolProfile.academicYear || '২০২৬')}</strong> · কোনো সহায়তার জন্য মাদ্রাসার অফিসে যোগাযোগ করুন।
              </p>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: CLEAN & DISTRACTION-FREE LOGIN CARD                               */}
        {/* ========================================================================= */}
        {(currentView === 'login' || currentView === 'register') && (
          <div className="w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/80">
              
              {/* Back to Gateway Button */}
              <button
                onClick={() => { if (onBack) onBack(); else setCurrentView('gateway'); setErrorMessage(''); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-5 font-medium transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>মূল অপশনে ফিরে যান</span>
              </button>

              {/* Title & Brand */}
              <div className="text-center space-y-1 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                  <Lock size={22} />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {currentView === 'login' ? 'অ্যাকাউন্টে প্রবেশ করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
                </h2>
                <p className="text-xs text-slate-400">
                  {currentView === 'login' ? 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন' : 'প্রয়োজনীয় তথ্য প্রদান করে নিবন্ধন সম্পন্ন করুন'}
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => { setCurrentView('login'); setErrorMessage(''); setSuccessMessage(''); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'login'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  লগইন
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentView('register'); setErrorMessage(''); setSuccessMessage(''); }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'register'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  নতুন অ্যাকাউন্ট
                </button>
              </div>

              {/* Alert Messages */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* LOGIN FORM */}
              {currentView === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      ইমেইল ঠিকানা (Email)
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="yourname@madrasha.edu.bd"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        পাসওয়ার্ড (Password)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsResetOpen(true)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        পাসওয়ার্ড ভুলে গেছেন?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>লগইন করুন</span>
                      </>
                    )}
                  </button>

                  {/* Google Sign-in */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 transition"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Google দিয়ে প্রবেশ করুন</span>
                    </button>
                  </div>
                </form>
              )}

              {/* REGISTER FORM */}
              {currentView === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      পূর্ণ নাম *
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="যেমন: মাওলানা মাহমুদুর রহমান"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      ইমেইল ঠিকানা *
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="teacher@madrasha.edu.bd"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        মোবাইল নম্বর
                      </label>
                      <input
                        type="tel"
                        placeholder="017XXXXXXXX"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        পাসওয়ার্ড *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="কমপক্ষে ৬ অক্ষর"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      আপনার ভূমিকা / পদবী *
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="সহকারী শিক্ষক (Teacher)">👨‍🏫 সহকারী শিক্ষক (Teacher)</option>
                      <option value="হিসাবরক্ষক / ক্যাশিয়ার (Accountant)">💼 হিসাবরক্ষক / ক্যাশিয়ার (Accountant)</option>
                      <option value="মুহতামিম / অধ্যক্ষ (Principal)">🎓 মুহতামিম / অধ্যক্ষ (Principal)</option>
                      <option value="অফিস সহকারী (Office Staff)">🏢 অফিস সহকারী (Office Staff)</option>
                      <option value="অভিভাবক (Guardian)">👨‍👩‍👧 অভিভাবক (Guardian)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <User size={15} />
                        <span>অ্যাকাউন্ট নিবন্ধন করুন</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Bottom Direct Switch to Results & Student Profile */}
              <div className="mt-6 pt-4 border-t border-slate-800 text-center space-y-2">
                {onStudentProfile && (
                  <div>
                    <button
                      type="button"
                      onClick={onStudentProfile}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center justify-center gap-1.5 mx-auto"
                    >
                      <GraduationCap size={14} />
                      <span>{language === 'bn' ? 'শিক্ষার্থী আইডি দিয়ে নিজস্ব সম্পূর্ণ প্রোফাইল দেখুন →' : 'Sign in to Student Profile Portal →'}</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentView('results')}
                  className="text-xs text-slate-400 hover:text-slate-300 font-medium"
                >
                  {language === 'bn' ? 'সরাসরি পাবলিক পরীক্ষার ফলাফল চেক করুন →' : 'Check Public Exam Results →'}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: PUBLIC RESULTS SEARCH & DIGITAL MARKSHEET CARD                    */}
        {/* ========================================================================= */}
        {currentView === 'results' && (
          <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Header & Back Button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { if (onBack) onBack(); else setCurrentView('gateway'); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>মূল অপশনে ফিরে যান</span>
              </button>

              <button
                onClick={() => { setCurrentView('login'); setErrorMessage(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                <LogIn size={13} />
                <span>অ্যাকাউন্ট লগইন</span>
              </button>
            </div>

            {/* Search Box Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Award size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">পরীক্ষার ফলাফল অনুসন্ধান</h2>
                  <p className="text-xs text-slate-400">পরীক্ষা নির্বাচন করুন এবং শিক্ষার্থীর রোল বা আইডি নম্বর লিখুন</p>
                </div>
              </div>

              <form onSubmit={handleResultSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">পরীক্ষা নির্বাচন</label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {exams.map(e => (
                      <option key={e.id} value={e.id}>{e.nameBn || e.name} ({toBn(e.academicYear || '২০২৬')})</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">রোল নম্বর অথবা স্টুডেন্ট আইডি</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: 101 বা S-001"
                    value={searchStudentQuery}
                    onChange={(e) => setSearchStudentQuery(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Search size={14} />
                    <span>খুঁজুন</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Results Display */}
            {hasSearched && !studentResultData && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-sm font-bold text-white">কোনো ফলাফল পাওয়া যায়নি</h3>
                <p className="text-xs text-slate-400">অনুগ্রহ করে রোল বা আইডি সঠিক কিনা যাচাই করে পুনরায় অনুসন্ধান করুন।</p>
              </div>
            )}

            {studentResultData && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                
                {/* Result Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                      {studentResultData.exam.nameBn || studentResultData.exam.name} · {toBn(studentResultData.exam.academicYear || '২০২৬')}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {studentResultData.student.nameBn || studentResultData.student.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>আইডি: <strong className="text-slate-200">{studentResultData.student.studentId}</strong></span>
                      <span>·</span>
                      <span>শ্রেণি: <strong className="text-slate-200">{studentResultData.student.class || studentResultData.student.classLevel}</strong></span>
                      <span>·</span>
                      <span>রোল: <strong className="text-slate-200">{toBn(studentResultData.student.roll)}</strong></span>
                      {studentResultData.student.section && (
                        <>
                          <span>·</span>
                          <span>শাখা: <strong className="text-slate-200">{studentResultData.student.section}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary GPA Box */}
                  <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                    studentResultData.gpaStats.isPassed
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  }`}>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">ফলাফল / GPA</div>
                      <div className="text-2xl font-black">{toBn(studentResultData.gpaStats.gpa)}</div>
                    </div>
                    <div className="text-right border-l border-white/10 pl-3">
                      <div className="text-xs font-extrabold">{studentResultData.gpaStats.grade}</div>
                      <div className="text-[11px] font-bold">
                        {studentResultData.gpaStats.isPassed ? 'উত্তীর্ণ (Passed)' : 'অনুত্তীর্ণ (Failed)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject-Wise Marks Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">বিষয়</th>
                        <th className="p-3 text-center">পূর্ণমান</th>
                        <th className="p-3 text-center">প্রাপ্ত নম্বর</th>
                        <th className="p-3 text-center">লেটার গ্রেড</th>
                        <th className="p-3 text-center">গ্রেড পয়েন্ট</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {studentResultData.subjectBreakdown.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-medium text-slate-200">
                            {row.subject.nameBn || row.subject.name}
                          </td>
                          <td className="p-3 text-center text-slate-400">{toBn(row.fullMarks)}</td>
                          <td className="p-3 text-center font-bold text-white">{toBn(row.obtained)}</td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${row.isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {row.grade}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-slate-300">{toBn(row.gpa)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-950/80 font-bold border-t border-slate-800">
                      <tr>
                        <td className="p-3 text-slate-300">সর্বমোট প্রাপ্ত নম্বর</td>
                        <td className="p-3 text-center text-slate-400">
                          {toBn(studentResultData.subjectBreakdown.reduce((sum, r) => sum + r.fullMarks, 0))}
                        </td>
                        <td className="p-3 text-center text-emerald-400 font-extrabold">
                          {toBn(studentResultData.gpaStats.totalMarks)}
                        </td>
                        <td className="p-3 text-center text-emerald-400">{studentResultData.gpaStats.grade}</td>
                        <td className="p-3 text-center font-mono text-emerald-400">{toBn(studentResultData.gpaStats.gpa)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Print Button */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    <Printer size={14} />
                    <span>প্রিন্ট মার্কশিট</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/80 py-3 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} {schoolProfile.nameBn || schoolProfile.name}. সর্বস্বত্ব সংরক্ষিত।
      </footer>

      {/* Forgot Password Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Lock size={16} className="text-indigo-400" />
              পাসওয়ার্ড রিসেট করুন
            </h3>
            <p className="text-xs text-slate-400">
              আপনার নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন। আমরা পাসওয়ার্ড পরিবর্তনের লিংক পাঠিয়ে দেব।
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                required
                placeholder="your-email@madrasha.edu.bd"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  {resetLoading ? 'পাঠানো হচ্ছে...' : 'রিসেট লিংক পাঠান'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connectivity & Offline Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
};
