import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  Mail, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  LogOut, 
  ArrowRight, 
  Copy, 
  Check, 
  User as UserIcon,
  Key,
  ChevronDown,
  ChevronUp,
  FileJson,
  Zap,
  Lock
} from 'lucide-react';
import { db } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { 
    language, 
    loginWithGoogle, 
    logoutAdmin, 
    refreshAdminClaims, 
    authUser, 
    authClaims, 
    authRole,
    isAdmin, 
    adminEmail, 
    mode 
  } = useApp();
  
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessNotice, setAuthSuccessNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showKeyAccordion, setShowKeyAccordion] = useState(false);
  const [writeTestStatus, setWriteTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setIsProcessing(true);
    setAuthError(null);
    setAuthSuccessNotice(null);
    try {
      const success = await loginWithGoogle();
      if (!success) {
        setAuthError(
          language === 'bn' 
            ? 'গুগল সাইন-ইন সম্পন্ন হয়নি বা পপআপ উইন্ডো বন্ধ করা হয়েছে।' 
            : 'Google sign-in was cancelled or the pop-up was closed.'
        );
      }
    } catch (err: any) {
      setAuthError(
        language === 'bn' 
          ? `লগইন ত্রুটি: ${err?.message || 'অজানা সমস্যা'}` 
          : `Authentication error: ${err?.message || 'Unknown error'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshClaims = async () => {
    setIsRefreshing(true);
    setAuthError(null);
    try {
      const hasAdmin = await refreshAdminClaims();
      if (hasAdmin) {
        setAuthSuccessNotice(
          language === 'bn' 
            ? '✓ সফল! { role: "admin" } ক্লেইম ভেরিফাই হয়েছে এবং এডমিন মোড সক্রিয় হয়েছে।' 
            : '✓ Success! Custom claim { role: "admin" } verified.'
        );
        runWriteTest();
        if (onSuccess) onSuccess();
      } else {
        setAuthError(
          language === 'bn'
            ? '⚠️ এডমিন ক্লেইমস এখনও অনুপস্থিত: এই অ্যাকাউন্টে { role: "admin" } কাস্টম ক্লেইম পাওয়া যায়নি।'
            : '⚠️ ADMIN CLAIM MISSING: The account does not have custom claim { role: "admin" }.'
        );
      }
    } catch (e: any) {
      setAuthError(e?.message || 'Failed to refresh token claims.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBootstrapOwner = async () => {
    if (!authUser) return;
    setIsBootstrapping(true);
    setAuthError(null);
    setAuthSuccessNotice(null);

    try {
      const idToken = await authUser.getIdToken(true);
      const payload = { idToken };

      const res = await fetch('/api/admin/bootstrap-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        setAuthSuccessNotice(
          language === 'bn' 
            ? '✓ অভিনন্দন! সফলভাবে আপনার অ্যাকাউন্টে { role: "admin" } পারমিশন যুক্ত করা হয়েছে।' 
            : '✓ Success! Role: "admin" has been successfully assigned.'
        );
        setShowKeyAccordion(false);
        // Refresh token from Firebase Auth servers
        await refreshAdminClaims();
        runWriteTest();
      } else {
        if (data.code === 'SERVICE_ACCOUNT_REQUIRED') {
          setShowKeyAccordion(true);
          setAuthError(
            language === 'bn'
              ? 'সার্ভার এনভায়রনমেন্টে Firebase Admin SDK সার্ভিস অ্যাকাউন্ট কনফিগার করা প্রয়োজন।'
              : 'Firebase Admin SDK service account is required in server environment.'
          );
        } else {
          setAuthError(data.message || 'Bootstrap setup failed.');
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to contact admin bootstrap server.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  const runWriteTest = async () => {
    setWriteTestStatus('testing');
    try {
      const docRef = doc(db, 'institution', 'main_store');
      await updateDoc(docRef, {
        lastAdminVerifiedAt: new Date().toISOString()
      });
      setWriteTestStatus('success');
    } catch (err: any) {
      console.warn('Write test check:', err);
      setWriteTestStatus('failed');
    }
  };

  const handleSwitchAccount = async () => {
    setIsProcessing(true);
    setAuthError(null);
    try {
      await logoutAdmin();
      await loginWithGoogle();
    } catch (e: any) {
      setAuthError(e?.message || 'Failed to switch account.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyUidToClipboard = () => {
    if (authUser?.uid) {
      navigator.clipboard.writeText(authUser.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const isOwnerEmail = authUser?.email?.toLowerCase() === (adminEmail || 'mehedihasansagor26@gmail.com').toLowerCase();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Decorative subtle gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {language === 'bn' ? 'এডমিন অ্যাক্সেস ও ওনার সেটআপ' : 'Admin Access & Owner Setup'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'bn' 
                ? 'Firebase Auth + Custom Claim { role: "admin" }' 
                : 'Server-Enforced Custom Claims (role: "admin")'}
            </p>
          </div>
        </div>

        {/* Success Notice */}
        {authSuccessNotice && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{authSuccessNotice}</span>
          </div>
        )}

        {/* Error / Missing Claim Notice */}
        {authError && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{authError}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Configured Admin Target */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <Sparkles size={14} className="text-blue-600" />
                <span>{language === 'bn' ? 'অনুমোদিত ওনার অ্যাকাউন্ট' : 'Designated Owner Account'}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/70 text-blue-800">
                Primary Owner
              </span>
            </div>
            <p className="font-mono text-[11px] font-semibold text-blue-700 bg-white/90 p-2 rounded-xl border border-blue-200/60 truncate">
              {adminEmail || 'mehedihasansagor26@gmail.com'}
            </p>
          </div>

          {/* Current Auth & Diagnostic Session Card */}
          {authUser ? (
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'bn' ? 'বর্তমান অথেনটিকেশন স্ট্যাটাস' : 'Current Auth Status'}
                </span>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    {language === 'bn' ? 'এডমিন ক্লেইম ভেরিফাইড' : 'Admin Role Verified'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertCircle size={12} className="text-amber-600" />
                    {language === 'bn' ? 'এডমিন ক্লেইম অনুপস্থিত' : 'Admin Claim Missing'}
                  </span>
                )}
              </div>

              {/* Safe Diagnostic Info Grid */}
              <div className="bg-white rounded-xl p-3 border border-slate-200/80 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mail size={13} className="text-blue-500 shrink-0" />
                    <span>Email:</span>
                  </span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">{authUser.email}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Key size={13} className="text-purple-500 shrink-0" />
                    <span>Firebase UID:</span>
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                    <span className="truncate max-w-[150px]">{authUser.uid}</span>
                    <button
                      type="button"
                      onClick={copyUidToClipboard}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                      title="Copy UID"
                    >
                      {copiedUid ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <UserIcon size={13} className="text-emerald-500 shrink-0" />
                    <span>Custom Claim Role:</span>
                  </span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    authRole === 'admin' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {authRole ? `role: "${authRole}"` : 'None (Claim Missing)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100 text-[11px]">
                  <span>Firestore Write Access:</span>
                  <span className={`font-bold ${isAdmin ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isAdmin ? 'GRANTED (Write Allowed)' : 'RESTRICTED (Read-Only)'}
                  </span>
                </div>

                {writeTestStatus !== 'idle' && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Live Write Test:</span>
                    <span className={`font-bold ${
                      writeTestStatus === 'success' 
                        ? 'text-emerald-600' 
                        : writeTestStatus === 'testing' 
                        ? 'text-blue-600' 
                        : 'text-rose-600'
                    }`}>
                      {writeTestStatus === 'testing' ? 'Testing Firestore write...' : writeTestStatus === 'success' ? '✓ Write Test PASSED' : '✖ Write Test BLOCKED'}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions & Setup options */}
              {isAdmin ? (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSuccess) onSuccess();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span>{language === 'bn' ? 'এডমিন প্যানেলে প্রবেশ করুন' : 'Continue to Admin Panel'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {/* Option 1: 1-Click Auto Setup */}
                  {isOwnerEmail && (
                    <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Zap size={14} className="text-indigo-600" />
                          <span>{language === 'bn' ? 'সহজ ওয়ান-ক্লিক ওনার অ্যাক্টিভেশন' : 'One-Click Owner Activation'}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700 leading-relaxed">
                        {language === 'bn'
                          ? 'আপনার Gmail অনুমোদিত ওনার তালিকার সাথে মিলেছে। সার্ভার থেকে সরাসরি role: "admin" সক্রিয় করতে নিচের বাটনে ক্লিক করুন:'
                          : 'Your Gmail matches the designated owner. Click below to activate role: "admin":'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleBootstrapOwner()}
                        disabled={isBootstrapping}
                        className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <Zap size={13} className={isBootstrapping ? 'animate-spin' : ''} />
                        <span>
                          {isBootstrapping 
                            ? (language === 'bn' ? 'সেটআপ হচ্ছে...' : 'Setting up...') 
                            : (language === 'bn' ? '⚡ ওনার এডমিন রোল সক্রিয় করুন' : '⚡ Activate Owner Admin Role')}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Option 2: Trusted Setup Guide */}
                  <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowKeyAccordion(!showKeyAccordion)}
                      className="w-full p-3 text-left flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileJson size={15} className="text-slate-500" />
                        <span>{language === 'bn' ? '📋 ট্রাস্টেড ওনার প্রভিশনিং গাইড' : '📋 Trusted Owner Provisioning Guide'}</span>
                      </div>
                      {showKeyAccordion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showKeyAccordion && (
                      <div className="p-3.5 pt-0 border-t border-slate-100 text-xs space-y-3 bg-slate-50/50">
                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-[11px] text-slate-700 space-y-2">
                          <p className="font-bold text-slate-900">
                            {language === 'bn' ? 'অ্যাডমিন অ্যাকাউন্ট প্রভিশন করার নিয়ম:' : 'Authoritative Admin Provisioning Steps:'}
                          </p>
                          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                            <li>Firebase Console-এ যান: <span className="font-mono text-blue-600 select-all">console.firebase.google.com</span></li>
                            <li><strong>Authentication ➜ Users</strong> ট্যাবে <span className="font-mono text-slate-800">mehedihasansagor26@gmail.com</span> অ্যাকাউন্টটি রয়েছে কিনা নিশ্চিত করুন।</li>
                            <li>সার্ভার এনভায়রনমেন্ট ভ্যারিয়েবলে <span className="font-mono text-blue-700">FIREBASE_SERVICE_ACCOUNT</span> কনফিগার করুন (অথবা সার্ভার ফাইলে serviceAccountKey.json রাখুন)।</li>
                            <li>সার্ভার থেকে role কাস্টম ক্লেইম অ্যাসাইন হলে উপরের <strong>"ক্লেইমস রিফ্রেশ করুন"</strong> বাটনে ক্লিক করুন।</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Claim Refresh & Switch Account */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRefreshClaims}
                      disabled={isRefreshing}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>{language === 'bn' ? 'ক্লেইমস রিফ্রেশ করুন' : 'Refresh Claims'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>{language === 'bn' ? 'অন্য অ্যাকাউন্ট' : 'Switch Account'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-bold flex items-center justify-center gap-3 shadow-md shadow-slate-900/10 transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>
                {isProcessing 
                  ? (language === 'bn' ? 'গুগলে লগইন হচ্ছে...' : 'Signing in...') 
                  : (language === 'bn' ? 'Google / Gmail দিয়ে এক ক্লিকে লগইন' : 'Sign in with Google Account')}
              </span>
            </button>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-500 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
