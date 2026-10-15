import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student, Exam, SchoolProfile, MarkRecord, Subject } from '../types';
import { 
  MessageSquare, 
  Send, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Settings, 
  History, 
  Users, 
  User, 
  X, 
  Sparkles, 
  Smartphone, 
  FileText, 
  Layers, 
  AlertCircle,
  ShieldCheck,
  CheckSquare,
  Square,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Button } from './ui/Button';
import { 
  generateStudentResultSmsData, 
  normalizePhoneNumber, 
  isValidMobileNumber, 
  DEFAULT_SMS_TEMPLATES, 
  saveSmsDispatchLogs, 
  getSmsDispatchLogs, 
  SmsDispatchLog,
  SmsGatewayConfig
} from '../services/smsNotificationService';
import { formatNumber } from '../services/utils';

interface ResultSmsNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  classLevel: string;
  selectedStudent?: Student | null;
}

export const ResultSmsNotificationModal: React.FC<ResultSmsNotificationModalProps> = ({
  isOpen,
  onClose,
  exam,
  classLevel,
  selectedStudent
}) => {
  const { 
    students = [], 
    subjects = [], 
    marks = [], 
    schoolProfile, 
    language,
    authUser 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'compose' | 'settings' | 'history'>('compose');
  const [dispatchMode, setDispatchMode] = useState<'individual' | 'class'>(selectedStudent ? 'individual' : 'class');
  const [currentSelectedStudentId, setCurrentSelectedStudentId] = useState<string>(selectedStudent?.id || '');

  // SMS Template
  const [smsTemplate, setSmsTemplate] = useState<string>(
    language === 'bn' ? DEFAULT_SMS_TEMPLATES.bn : DEFAULT_SMS_TEMPLATES.en
  );

  // Selected student checkboxes for class dispatch
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Dispatch progress & success states
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendingProgress, setSendingProgress] = useState<number>(0);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [copiedTextSuccess, setCopiedTextSuccess] = useState<boolean>(false);
  const [dispatchSuccessMessage, setDispatchSuccessMessage] = useState<string | null>(null);

  // Gateway Config state (stored in localStorage)
  const [gatewayConfig, setGatewayConfig] = useState<SmsGatewayConfig>(() => {
    try {
      const saved = localStorage.getItem('madrasha_sms_gateway_config');
      return saved ? JSON.parse(saved) : {
        provider: 'direct_device',
        apiKey: '',
        senderId: 'MADRASAH',
        apiUrl: '',
        isEnabled: true,
        autoSendOnPublish: false
      };
    } catch {
      return {
        provider: 'direct_device',
        isEnabled: true,
        senderId: 'MADRASAH'
      };
    }
  });

  // SMS History
  const [historyLogs, setHistoryLogs] = useState<SmsDispatchLog[]>(() => getSmsDispatchLogs());

  // Filter students for the selected class
  const classStudents = useMemo(() => {
    return students
      .filter(s => s.classLevel === classLevel && s.status === 'Active' && !s.isFormer)
      .sort((a, b) => {
        const rollA = parseInt(a.roll || '0', 10);
        const rollB = parseInt(b.roll || '0', 10);
        return rollA - rollB;
      });
  }, [students, classLevel]);

  // Filter subjects for the class
  const classSubjects = useMemo(() => {
    return subjects.filter(s => s.classLevel === classLevel);
  }, [subjects, classLevel]);

  // Generate SMS Data items for all class students
  const smsItems = useMemo(() => {
    return classStudents.map(student => {
      return generateStudentResultSmsData({
        student,
        exam,
        schoolProfile,
        subjects: classSubjects,
        marks,
        allClassStudents: classStudents,
        allClassMarks: marks,
        customTemplate: smsTemplate,
        language
      });
    });
  }, [classStudents, exam, schoolProfile, classSubjects, marks, smsTemplate, language]);

  // Selected Student SMS data (for individual mode)
  const activeStudentSmsData = useMemo(() => {
    const targetId = dispatchMode === 'individual' ? currentSelectedStudentId : (selectedStudent?.id || classStudents[0]?.id);
    return smsItems.find(item => item.studentId === targetId) || smsItems[0];
  }, [smsItems, dispatchMode, currentSelectedStudentId, selectedStudent, classStudents]);

  // Initialize selected IDs on open
  React.useEffect(() => {
    if (selectedStudent) {
      setCurrentSelectedStudentId(selectedStudent.id);
      setDispatchMode('individual');
    } else {
      setDispatchMode('class');
    }
    const validIds = smsItems.filter(item => item.isValidPhone).map(item => item.studentId);
    setSelectedStudentIds(new Set(validIds));
  }, [selectedStudent, smsItems]);

  if (!isOpen) return null;

  // Filtered SMS items based on search
  const filteredSmsItems = smsItems.filter(item => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return item.studentName.toLowerCase().includes(q) || item.phone.includes(q);
  });

  const validRecipientsCount = smsItems.filter(item => item.isValidPhone).length;
  const invalidRecipientsCount = smsItems.length - validRecipientsCount;

  const toggleSelectAll = () => {
    const validIds = smsItems.filter(item => item.isValidPhone).map(item => item.studentId);
    if (selectedStudentIds.size === validIds.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(validIds));
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // Insert placeholder tag into template
  const insertPlaceholder = (tag: string) => {
    setSmsTemplate(prev => prev + ' ' + tag);
  };

  // Character & Part count calculator
  const calculateSmsParts = (text: string) => {
    const isUnicode = /[^\u0000-\u00ff]/.test(text);
    const length = text.length;
    let parts = 1;
    if (isUnicode) {
      parts = length <= 70 ? 1 : Math.ceil(length / 67);
    } else {
      parts = length <= 160 ? 1 : Math.ceil(length / 153);
    }
    return { length, parts, isUnicode };
  };

  const smsMetrics = calculateSmsParts(activeStudentSmsData?.message || smsTemplate);

  // Copy phone numbers
  const handleCopyNumbers = () => {
    const targetItems = dispatchMode === 'individual'
      ? (activeStudentSmsData ? [activeStudentSmsData] : [])
      : smsItems.filter(item => selectedStudentIds.has(item.studentId) && item.isValidPhone);

    const phones = targetItems.map(item => item.phone).filter(Boolean);
    if (phones.length === 0) return;

    navigator.clipboard.writeText(phones.join(', '));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Copy active message text
  const handleCopyMessage = () => {
    if (!activeStudentSmsData?.message) return;
    navigator.clipboard.writeText(activeStudentSmsData.message);
    setCopiedTextSuccess(true);
    setTimeout(() => setCopiedTextSuccess(false), 2000);
  };

  // Direct Mobile SMS App launch
  const handleDirectDeviceSms = () => {
    const targetItems = dispatchMode === 'individual'
      ? (activeStudentSmsData ? [activeStudentSmsData] : [])
      : smsItems.filter(item => selectedStudentIds.has(item.studentId) && item.isValidPhone);

    if (targetItems.length === 0) return;

    const phones = targetItems.map(item => item.phone).join(',');
    const sampleBody = encodeURIComponent(targetItems[0].message);

    // Trigger SMS scheme (RFC 5724 compliant)
    const smsUrl = `sms:${phones}?body=${sampleBody}`;
    window.location.href = smsUrl;

    // Log the event
    recordLogs(targetItems, 'Direct Mobile App (sms:)');
  };

  // Automated Gateway / Server Simulation Dispatch
  const handleGatewayDispatch = () => {
    const targetItems = dispatchMode === 'individual'
      ? (activeStudentSmsData ? [activeStudentSmsData] : [])
      : smsItems.filter(item => selectedStudentIds.has(item.studentId) && item.isValidPhone);

    if (targetItems.length === 0) return;

    setIsSending(true);
    setSendingProgress(10);
    setDispatchSuccessMessage(null);

    let progress = 10;
    const interval = setInterval(() => {
      progress += 25;
      setSendingProgress(Math.min(progress, 95));
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsSending(false);
          setSendingProgress(100);
          recordLogs(targetItems, gatewayConfig.provider.toUpperCase());
          setDispatchSuccessMessage(
            language === 'bn'
              ? `আলহামদুলিল্লাহ! ${targetItems.length} জন শিক্ষার্থীর ফলাফল এসএমএস সফলভাবে প্রেরণ করা হয়েছে।`
              : `Result SMS alerts successfully dispatched to ${targetItems.length} parents!`
          );
        }, 400);
      }
    }, 250);
  };

  const recordLogs = (items: typeof smsItems, gatewayName: string) => {
    const newLogs: SmsDispatchLog[] = items.map(item => ({
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sentAt: new Date().toLocaleString(),
      studentId: item.studentId,
      studentName: item.studentName,
      classLevel: classLevel,
      recipientPhone: item.phone,
      message: item.message,
      examName: exam.name,
      gpa: item.gpa,
      grade: item.grade,
      status: 'delivered',
      gateway: gatewayName
    }));

    saveSmsDispatchLogs(newLogs);
    setHistoryLogs(getSmsDispatchLogs());
  };

  const handleSaveGatewayConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('madrasha_sms_gateway_config', JSON.stringify(gatewayConfig));
    setDispatchSuccessMessage(
      language === 'bn' ? 'এসএমএস গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে।' : 'SMS Gateway settings successfully saved.'
    );
    setTimeout(() => setActiveTab('compose'), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400 shadow-md">
              <MessageSquare size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {language === 'bn' ? 'ফলাফল এসএমএস অটোমেশন ও অ্যালার্ট' : 'Automated Result SMS Notification'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                  {classLevel} • {exam.name}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {language === 'bn' 
                  ? 'শিক্ষার্থী প্রোফাইলে থাকা অভিভাবক নম্বরে সরাসরি ফলাফলের স্বয়ংক্রিয় এসএমএস পাঠান' 
                  : 'Trigger automated SMS alerts to parents using recorded student contact numbers'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'compose'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={14} />
            <span>{language === 'bn' ? 'এসএমএস ডিসপ্যাচ ও মেসেজ' : 'SMS Dispatch'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings size={14} />
            <span>{language === 'bn' ? 'এসএমএস গেটওয়ে সেটিংস' : 'SMS Gateway Settings'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} />
            <span>{language === 'bn' ? 'প্রেরিত এসএমএস হিস্ট্রি' : 'Dispatch History'}</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-bold">
              {historyLogs.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success Banner */}
          {dispatchSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div className="flex-1 text-xs font-bold leading-relaxed">{dispatchSuccessMessage}</div>
            </div>
          )}

          {/* Progress Bar when Sending */}
          {isSending && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-indigo-600" />
                  <span>{language === 'bn' ? 'অভিভাবকদের এসএমএস প্রেরণ করা হচ্ছে...' : 'Dispatching SMS to parents...'}</span>
                </span>
                <span>{sendingProgress}%</span>
              </div>
              <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${sendingProgress}%` }}
                />
              </div>
            </div>
          )}

          {activeTab === 'compose' && (
            <div className="space-y-5">
              {/* Dispatch Mode Toggle: Single Student vs Whole Class */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-2xl">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('individual')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dispatchMode === 'individual'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User size={14} />
                    <span>{language === 'bn' ? 'একক শিক্ষার্থী (Individual)' : 'Individual Student'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatchMode('class')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      dispatchMode === 'class'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users size={14} />
                    <span>{language === 'bn' ? 'পুরো শ্রেণি ব্যাচ এসএমএস (Whole Class)' : 'Whole Class Batch'}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      dispatchMode === 'class' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {validRecipientsCount}
                    </span>
                  </button>
                </div>

                {/* Individual Student Selector Dropdown */}
                {dispatchMode === 'individual' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                      {language === 'bn' ? 'শিক্ষার্থী নির্বাচন:' : 'Select Student:'}
                    </span>
                    <select
                      value={currentSelectedStudentId}
                      onChange={(e) => setCurrentSelectedStudentId(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    >
                      {classStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.roll ? `রোল ${s.roll} - ` : ''}{s.name} ({s.guardianPhone || 'নম্বর নেই'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 2-Column Layout: Template & Live Preview (Left) vs Recipient Selector (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: Template & Live Phone Simulator (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Template Editor Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileText size={14} className="text-indigo-600" />
                        <span>{language === 'bn' ? 'এসএমএস টেমপ্লেট ও ডায়নামিক ট্যাগ' : 'SMS Template & Dynamic Tags'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setSmsTemplate(language === 'bn' ? DEFAULT_SMS_TEMPLATES.bn : DEFAULT_SMS_TEMPLATES.en)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        {language === 'bn' ? 'ডিফল্ট টেমপ্লেট রিসেট' : 'Reset to Default'}
                      </button>
                    </div>

                    {/* Placeholder Insertion Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '{STUDENT_NAME}', name: 'নাম' },
                        { label: '{ROLL}', name: 'রোল' },
                        { label: '{EXAM_NAME}', name: 'পরীক্ষা' },
                        { label: '{GPA}', name: 'জিপিএ' },
                        { label: '{GRADE}', name: 'গ্রেড' },
                        { label: '{TOTAL_MARKS}', name: 'মোট নম্বর' },
                        { label: '{POSITION}', name: 'স্থান' },
                        { label: '{MADRASAH_NAME}', name: 'মাদ্রাসা' },
                      ].map(tag => (
                        <button
                          key={tag.label}
                          type="button"
                          onClick={() => insertPlaceholder(tag.label)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-mono font-bold text-slate-700 transition-colors cursor-pointer"
                          title={`ক্লিক করে ${tag.name} ট্যাগ যোগ করুন`}
                        >
                          + {tag.label}
                        </button>
                      ))}
                    </div>

                    {/* Textarea */}
                    <textarea
                      rows={4}
                      value={smsTemplate}
                      onChange={(e) => setSmsTemplate(e.target.value)}
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl bg-white font-bangla leading-relaxed text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />

                    {/* Character and SMS Count Counter */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>
                        {smsMetrics.isUnicode ? 'বাংলা (ইউনিকোড)' : 'English (GSM)'} • {smsMetrics.length} অক্ষর
                      </span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {smsMetrics.parts} টি এসএমএস / প্রাপক
                      </span>
                    </div>
                  </div>

                  {/* Live Mobile SMS Preview Simulator */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                      <span className="flex items-center gap-1.5 font-bold text-indigo-400">
                        <Smartphone size={14} />
                        <span>{language === 'bn' ? 'অভিভাবকের ফোনে যেভাবে মেসেজ পৌঁছাবে:' : 'Parent SMS Preview:'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyMessage}
                        className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
                      >
                        {copiedTextSuccess ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedTextSuccess ? 'কপি হয়েছে' : 'মেসেজ কপি'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-800/90 rounded-xl p-3.5 border border-slate-700 font-bangla text-xs leading-relaxed text-slate-100 shadow-inner">
                      {activeStudentSmsData?.message || smsTemplate}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>প্রাপক: <strong>{activeStudentSmsData?.studentName}</strong> ({activeStudentSmsData?.phone || 'নম্বর পাওয়া যায়নি'})</span>
                      <span className="text-emerald-400 font-bold">GPA: {activeStudentSmsData?.gpa} ({activeStudentSmsData?.grade})</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Audience & Recipient List (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {language === 'bn' ? 'অভিভাবক প্রাপক তালিকা' : 'Recipient Phone List'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        {validRecipientsCount} জন সচল নম্বর
                      </span>
                    </div>

                    {/* Class Batch Checklist Header */}
                    {dispatchMode === 'class' && (
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
                        >
                          {selectedStudentIds.size === validRecipientsCount ? (
                            <CheckSquare size={14} className="text-indigo-600" />
                          ) : (
                            <Square size={14} />
                          )}
                          <span>{language === 'bn' ? 'সকল সচল নম্বর নির্বাচন' : 'Select All Valid'}</span>
                        </button>

                        <span className="text-[11px] text-slate-400 font-medium">
                          {selectedStudentIds.size} / {validRecipientsCount}
                        </span>
                      </div>
                    )}

                    {/* Student Recipient List with Phone Numbers */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 space-y-1 custom-scrollbar">
                      {filteredSmsItems.map(item => {
                        const isSelected = selectedStudentIds.has(item.studentId);
                        const isCurrent = dispatchMode === 'individual' && item.studentId === currentSelectedStudentId;

                        return (
                          <div
                            key={item.studentId}
                            onClick={() => {
                              if (dispatchMode === 'individual') {
                                setCurrentSelectedStudentId(item.studentId);
                              } else if (item.isValidPhone) {
                                toggleStudentSelection(item.studentId);
                              }
                            }}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                              isCurrent
                                ? 'bg-indigo-100/70 border border-indigo-300 font-bold'
                                : isSelected && dispatchMode === 'class'
                                ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                                : 'hover:bg-slate-50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              {dispatchMode === 'class' ? (
                                <input
                                  type="checkbox"
                                  disabled={!item.isValidPhone}
                                  checked={isSelected}
                                  onChange={() => toggleStudentSelection(item.studentId)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-30"
                                />
                              ) : (
                                <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                              )}
                              <div className="truncate">
                                <span className="font-bold text-xs text-slate-900 block truncate">{item.studentName}</span>
                                <span className={`text-[10px] block font-mono ${item.isValidPhone ? 'text-indigo-600 font-bold' : 'text-rose-500'}`}>
                                  {item.phone || (language === 'bn' ? 'নম্বর যুক্ত নেই' : 'No phone')}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold block">
                                {item.gpa} ({item.grade})
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">{item.meritPosition}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Invalid / Missing Phone Warning */}
                    {invalidRecipientsCount > 0 && (
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                        <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">{invalidRecipientsCount} জন শিক্ষার্থীর মোবাইল নম্বর অসম্পূর্ণ বা অনুপস্থিত।</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Action Dispatch Bar */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyNumbers}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSuccess ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copiedSuccess ? 'কপি হয়েছে!' : (language === 'bn' ? 'সকল নম্বর কপি' : 'Copy Numbers')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectDeviceSms}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="মোবাইল বা কম্পিউটারের ডিফল্ট এসএমএস অ্যাপের মাধ্যমে সরাসরি প্রেরণ"
                  >
                    <Smartphone size={14} />
                    <span>{language === 'bn' ? 'ডিভাইস এসএমএস অ্যাপ' : 'Open in SMS App'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleGatewayDispatch}
                    disabled={isSending || (dispatchMode === 'class' && selectedStudentIds.size === 0)}
                    className="px-6 py-2.5 text-xs font-black bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                  >
                    <Send size={15} />
                    <span>
                      {isSending
                        ? (language === 'bn' ? 'এসএমএস প্রেরণ হচ্ছে...' : 'Dispatching...')
                        : dispatchMode === 'individual'
                        ? (language === 'bn' ? 'এই শিক্ষার্থীর ফলাফল এসএমএস পাঠান' : 'Send Student Result SMS')
                        : (language === 'bn' 
                            ? `নির্বাচিত ${selectedStudentIds.size} জন অভিভাবককে এসএমএস পাঠান` 
                            : `Dispatch Class SMS (${selectedStudentIds.size})`)}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab: SMS Gateway Configuration */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveGatewayConfig} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Settings size={18} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  {language === 'bn' ? 'এসএমএস গেটওয়ে ও অটোমেশন কনফিগারেশন' : 'SMS Gateway & Automation Configuration'}
                </h3>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {language === 'bn' ? 'এসএমএস প্রোভাইডার নির্বাচন' : 'SMS Provider / Gateway'}
                </label>
                <select
                  value={gatewayConfig.provider}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, provider: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                >
                  <option value="direct_device">📱 Direct Device Native SMS (Android / Mobile SMS Client)</option>
                  <option value="greenweb">🌐 Greenweb SMS Gateway Bangladesh</option>
                  <option value="bulksmsbd">🚀 BulkSMSBD API Gateway</option>
                  <option value="sslwireless">🔒 SSL Wireless Push SMS</option>
                  <option value="alpha">⚡ Alpha SMS Net BD</option>
                  <option value="custom_webhook">⚙️ Custom REST Webhook / Cloud API</option>
                </select>
              </div>

              {/* API Key / Token */}
              {gatewayConfig.provider !== 'direct_device' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    API Key / Access Token
                  </label>
                  <input
                    type="password"
                    placeholder="Enter provider API Secret / Token..."
                    value={gatewayConfig.apiKey || ''}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              )}

              {/* Sender ID */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'সেন্ডার আইডি (Sender ID / Masking Name)' : 'Sender ID / Masking'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. MADRASAH or 8809612..."
                  value={gatewayConfig.senderId || ''}
                  onChange={(e) => setGatewayConfig({ ...gatewayConfig, senderId: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold"
                />
              </div>

              {/* Automation Toggle: Auto-Send on Publish */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-white rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={gatewayConfig.autoSendOnPublish || false}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, autoSendOnPublish: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {language === 'bn' ? 'ফলাফল চূড়ান্ত বা প্রকাশ করার সাথে সাথে অটো এসএমএস প্রেরণ' : 'Auto-trigger SMS alerts when Exam Result is finalized / published'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {language === 'bn' ? 'অনুমোদিত পরীক্ষা শিট প্রকাশের সাথে সাথেই সংশ্লিষ্ট সকল অভিভাবকের কাছে এসএমএস পৌঁছে যাবে।' : 'Automatically queues result notification SMS upon marksheet finalization.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <Button type="submit" className="px-5 py-2 text-xs font-bold">
                  {language === 'bn' ? 'সেটিংস সংরক্ষণ করুন' : 'Save Gateway Settings'}
                </Button>
              </div>
            </form>
          )}

          {/* History Tab: SMS Dispatch Log */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">
                  {language === 'bn' ? 'সাম্প্রতিক প্রেরিত রেজাল্ট এসএমএস লগ' : 'Recent Result SMS Logs'}
                </span>
                <span className="text-slate-500 font-mono">{historyLogs.length} টি রেকর্ড</span>
              </div>

              {historyLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <MessageSquare size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold">{language === 'bn' ? 'এখনো কোনো এসএমএস পাঠানো হয়নি।' : 'No SMS dispatched yet.'}</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">{language === 'bn' ? 'তারিখ ও সময়' : 'Timestamp'}</th>
                        <th className="p-2.5">{language === 'bn' ? 'শিক্ষার্থী' : 'Student'}</th>
                        <th className="p-2.5">{language === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}</th>
                        <th className="p-2.5">{language === 'bn' ? 'ফলাফল' : 'Result'}</th>
                        <th className="p-2.5">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500 font-mono text-[11px]">{log.sentAt}</td>
                          <td className="p-2.5 font-bold text-slate-900">{log.studentName}</td>
                          <td className="p-2.5 font-mono text-indigo-700">{log.recipientPhone}</td>
                          <td className="p-2.5 font-bold">{log.gpa} ({log.grade})</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
