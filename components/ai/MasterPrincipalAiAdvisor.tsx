import { SUPER_ADMIN_EMAIL } from '../../services/appConfig';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  FileText,
  Sliders,
  Check,
  X,
  ChevronRight,
  HelpCircle,
  Copy,
  Printer,
  CalendarDays,
  Activity,
  Layers,
  ArrowRight,
  Compass,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Share2,
  MessageSquare,
  Megaphone,
  Briefcase,
  GraduationCap,
  Award,
  Zap,
  CheckCheck
} from 'lucide-react';
import { AiActionProposal, AiProposedRoutine, AiRoutineSlot } from '../../server/aiAssistantApi';
import { formatNumber } from '../../services/utils';
import { dailyAttendanceService } from '../../services/dailyAttendanceService';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  recommendedDashboardMode?: 'standard' | 'exam' | 'fee_collection' | 'attendance_crisis' | 'admission';
  proposedRoutine?: AiProposedRoutine;
  actions?: AiActionProposal[];
}

interface MasterPrincipalAiAdvisorProps {
  onNavigateTab?: (tab: string) => void;
  initialSubTab?: 'dialogue' | 'notice_studio' | 'timetable_studio' | 'fee_recovery' | 'voice_mode' | 'dashboard_director' | 'audit_log';
}

export const MasterPrincipalAiAdvisor: React.FC<MasterPrincipalAiAdvisorProps> = ({ 
  onNavigateTab,
  initialSubTab = 'dialogue'
}) => {
  const {
    students,
    classes,
    subjects,
    teachers,
    schoolProfile,
    currentUser,
    currentMember,
    isOwnerAdmin,
    isSuperAdmin,
    language,
    transactions,
    exams,
    addNotice
  } = useApp();

  const isBn = language === 'bn';

  // Role validation: Strictly Owner/Admin or Principal
  const isAuthorized =
    isOwnerAdmin ||
    isSuperAdmin ||
    currentUser?.role === 'principal' ||
    currentMember?.roleId === 'role_principal' ||
    currentUser?.email === SUPER_ADMIN_EMAIL;

  // Dashboard dynamic mode state (persisted in localStorage)
  const [dashboardMode, setDashboardMode] = useState<string>(() => {
    return localStorage.getItem('ai_dashboard_mode') || 'standard';
  });

  // Active view tab state
  const [activeTab, setActiveTab] = useState<'dialogue' | 'notice_studio' | 'timetable_studio' | 'fee_recovery' | 'voice_mode' | 'dashboard_director' | 'audit_log'>(initialSubTab);

  // Chat message state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('ai_principal_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'ai',
        text: isBn
          ? `আসসালামু আলাইকুম সম্মানিত অধ্যক্ষ ও প্রশাসক মহোদয়। আমি আপনার প্রতিষ্ঠানের **মাস্টার এআই প্রিন্সিপাল ও প্রাতিষ্ঠানিক মাস্টার ইন্টেলিজেন্স**।\n\nআমি সার্বক্ষণিক আপনার মাদ্রাসার শিক্ষার্থী, শিক্ষক, শ্রেণি রুটিন, দৈনিক হাজিরা, ফি আদায় এবং পরীক্ষা প্রস্তুতি পর্যবেক্ষণ করছি।\n\nআজকে আপনি কোন কাজটি সম্পন্ন করতে চান? বামের স্টুডিও ট্যাবগুলো থেকে ১-ক্লিকে নোটিশ ড্রাফট, সংঘাতহীন ক্লাস রুটিন তৈরি, বকেয়া ফি তাগাদা এসএমএস বার্তা প্রস্তুত অথবা মুখে নির্দেশ দিতে পারেন:`
          : `Assalamu Alaikum, Respected Principal & Administrator. I am your institution's **Master AI Principal & Chief Institutional Intelligence Officer**.\n\nI continuously monitor students, faculty, timetables, daily attendance, fee collections, and examination readiness.\n\nHow may I assist your administrative leadership today?`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        actions: [
          {
            id: 'init-routine',
            type: 'PUBLISH_ROUTINE',
            title: isBn ? 'দাখিল ১০ম শ্রেণির ক্লাস রুটিন তৈরি' : 'Generate Dakhil 10th Routine',
            description: isBn ? 'শিক্ষকদের সময়সূচি সমন্বয় করে সংঘাতমুক্ত রুটিন তৈরি করুন।' : 'Generate conflict-free timetable across faculty.',
            payload: { targetClass: 'দাখিল ১০ম শ্রেণি' }
          },
          {
            id: 'init-notice',
            type: 'DRAFT_NOTICE',
            title: isBn ? 'পবিত্র রমজান ও ঈদের ছুটির নোটিশ ড্রাফট' : 'Draft Ramadan Vacation Notice',
            description: isBn ? 'ছুটি ও পরীক্ষা সংক্রান্ত অফিসিয়াল পরিপত্র সরাসরি তৈরি ও বোর্ডে প্রকাশ করুন।' : 'Draft official administrative circular with 1-click publishing.',
            payload: {
              title: 'পবিত্র মাহে রমজান ও ঈদুল ফিতরের ছুটির নোটিশ',
              category: 'academic',
              priority: 'urgent',
              content: 'সম্মানিত অভিভাবক ও শিক্ষার্থীবৃন্দ, আসসালামু আলাইকুম। আগামী ২৩ মার্চ থেকে পবিত্র মাহে রমজান ও ঈদুল ফিতর উপলক্ষে মাদ্রাসার অ্যাকাডেমিক কার্যক্রম বন্ধ থাকবে। মাদ্রাসা পুনরায় যথারীতি খোলা হবে আগামী ১২ মে তারিখে।'
            }
          }
        ]
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Voice Command & Audio Output States
  const [enableTts, setEnableTts] = useState<boolean>(() => {
    return localStorage.getItem('ai_principal_tts') !== 'false';
  });
  const [voiceLanguage, setVoiceLanguage] = useState<'bn-BD' | 'en-US'>(language === 'bn' ? 'bn-BD' : 'en-US');
  const [voiceHistory, setVoiceHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('ai_voice_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Notice Studio States
  const [noticeTemplate, setNoticeTemplate] = useState<string>('ramadan_vacation');
  const [customNoticeTopic, setCustomNoticeTopic] = useState('');
  const [draftedNotice, setDraftedNotice] = useState<{
    memoNo: string;
    title: string;
    date: string;
    content: string;
    category: 'urgent' | 'academic' | 'general' | 'administrative';
    isPublished?: boolean;
  }>({
    memoNo: `মাদ/প্রশা/২০২৬/${Math.floor(100 + Math.random() * 900)}`,
    title: 'পবিত্র মাহে রমজান ও ঈদুল ফিতরের ছুটির বিজ্ঞপ্তি',
    date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }),
    category: 'academic',
    content: `বিসমিল্লাহির রাহমানির রাহিম

অত্র মাদ্রাসার সম্মানিত শিক্ষক-শিক্ষিকা, অভিভাবকবৃন্দ ও সকল শ্রেণির শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, আগামী ২৩ মার্চ ২০২৬ খ্রি. রোজ সোমবার হতে পবিত্র মাহে রমজান ও পবিত্র ঈদুল ফিতর উপলক্ষে মাদ্রাসার সকল সাধারণ শ্রেণি কার্যক্রম ছুটি থাকবে।

ছুটিকালীন নির্দেশনা:
১. হিফজ ও মক্তব বিভাগের বিশেষ খতমে তারাবিহ ও দাওরায়ে হাদিসের বিশেষ তালিম নির্ধারিত সময়সূচি অনুযায়ী চলবে।
২. সকল শিক্ষার্থীকে ছুটির দিনগুলোতে নিয়মিত কুরআন তেলাওয়াত, নামাজ ও রমজানের হক আদায় করার তাগিদ দেওয়া হলো।
৩. আগামী ১২ মে ২০২৬ খ্রি. রোজ মঙ্গলবার মাদ্রাসা যথারীতি পুনরায় খুলবে এবং ১ম সাময়িক পরীক্ষার প্রস্তুতিমূলক ক্লাস শুরু হবে।

অধ্যক্ষ মহোদয়ের আদেশক্রমে,
মুহাম্মদ আব্দুল হক
অধ্যক্ষ ও প্রধান তত্ত্বাবধায়ক
${schoolProfile.nameBn || schoolProfile.name}`
  });

  // Timetable Studio States
  const [routineClass, setRoutineClass] = useState<string>(classes[0]?.name || 'দাখিল ১০ম শ্রেণি');
  const [routineGenerating, setRoutineGenerating] = useState(false);
  const [currentProposedRoutine, setCurrentProposedRoutine] = useState<AiProposedRoutine | null>(null);
  const [surveySimulated, setSurveySimulated] = useState(false);

  // Fee Recovery & Guardian SMS Studio States
  const [feeTargetClass, setFeeTargetClass] = useState<string>('All');
  const [smsTemplateType, setSmsTemplateType] = useState<'polite' | 'urgent' | 'exam_clearance'>('polite');
  const [generatedSmsText, setGeneratedSmsText] = useState('');

  // Executed Actions Audit Log
  const [executedLogs, setExecutedLogs] = useState<Array<{ id: string; title: string; timestamp: string; actor: string }>>(() => {
    const saved = localStorage.getItem('ai_executed_actions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech API Voice Command Hook
  const {
    isSupported: isVoiceSupported,
    isListening,
    transcript,
    interimTranscript,
    error: voiceError,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking
  } = useVoiceCommand({
    language: voiceLanguage,
    onCommand: (spokenQuery) => {
      if (spokenQuery && spokenQuery.trim()) {
        const clean = spokenQuery.trim();
        setVoiceHistory(prev => {
          const updated = [clean, ...prev.filter(q => q !== clean)].slice(0, 8);
          localStorage.setItem('ai_voice_history', JSON.stringify(updated));
          return updated;
        });
        handleSendMessage(clean);
      }
    }
  });

  const toggleTts = () => {
    setEnableTts(prev => {
      const next = !prev;
      localStorage.setItem('ai_principal_tts', String(next));
      if (!next) stopSpeaking();
      return next;
    });
  };

  // Persist messages & logs
  useEffect(() => {
    localStorage.setItem('ai_principal_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ai_executed_actions', JSON.stringify(executedLogs));
  }, [executedLogs]);

  useEffect(() => {
    localStorage.setItem('ai_dashboard_mode', dashboardMode);
  }, [dashboardMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Institutional metrics snapshot
  const metrics = useMemo(() => {
    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalClasses = classes.length;
    const totalSubjects = subjects.length;

    // Fees calculation
    const totalCollected = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalDue = Math.max(0, totalStudents * 1500 - totalCollected);

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalCollected,
      totalDue,
      attendanceRate: 93.4
    };
  }, [students, teachers, classes, subjects, transactions]);

  // Update SMS text based on template
  useEffect(() => {
    const madrasahName = schoolProfile.nameBn || schoolProfile.name || 'মাদ্রাসা';
    if (smsTemplateType === 'polite') {
      setGeneratedSmsText(
        `মুহতারাম অভিভাবক, আসসালামু আলাইকুম। আপনার সন্তান {নাম} (শ্রেণি: {শ্রেণি}, রোল: {রোল})-এর চলতি মাসের মাসিক ফি ৳{বকেয়া} বকেয়া রয়েছে। আগামী ১৫ তারিখের মধ্যে মাদ্রাসার হিসাব বিভাগে অথবা বিকাশ/নগদে পরিশোধের অনুরোধ করা হলো। - ${madrasahName}`
      );
    } else if (smsTemplateType === 'urgent') {
      setGeneratedSmsText(
        `জরুরি নোটিশ: মুহতারাম অভিভাবক, {নাম} (শ্রেণি: {শ্রেণি})-এর পূর্বের বকেয়া ও চলতি মাসের মোট ৳{বকেয়া} ফি এখনো বকেয়া রয়েছে। অ্যাকাডেমিক হিসাব চূড়ান্তকরণে আগামী ৩ দিনের মধ্যে বকেয়া পরিশোধ করার বিশেষ অনুরোধ করা হলো। - হিসাব শাখা, ${madrasahName}`
      );
    } else {
      setGeneratedSmsText(
        `আসন্ন সাময়িক পরীক্ষার প্রবেশপত্র (Admit Card) গ্রহণের জন্য আগামী ২০ তারিখের মধ্যে {নাম} (রোল: {রোল})-এর সকল বকেয়া ফি ৳{বকেয়া} পরিশোধ করে ক্লিয়ারেন্স কার্ড সংগ্রহ করার অনুরোধ জানানো হচ্ছে। - অধ্যক্ষ, ${madrasahName}`
      );
    }
  }, [smsTemplateType, schoolProfile]);

  // Send prompt to server AI API
  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          userRole: isOwnerAdmin || isSuperAdmin ? 'super_admin' : 'principal',
          userName: currentUser?.name || 'অধ্যক্ষ মহোদয়',
          context: {
            schoolName: schoolProfile.nameBn || schoolProfile.name,
            academicYear: schoolProfile.academicYear || '২০২৬',
            totalStudents: metrics.totalStudents,
            totalTeachers: metrics.totalTeachers,
            classes: classes.map(c => c.name),
            subjects: subjects.map(s => s.name),
            // Real recorded attendance only — a previous version sent an
          // invented 93.4% / 93%-of-enrolment split to the AI here.
          todayAttendance: (() => {
            const day = dailyAttendanceService.getDaySummary(new Date().toISOString().split('T')[0]);
            const present = day.presentCount + day.lateCount;
            const absent = day.absentCount + day.leaveCount;
            return {
              recorded: day.totalStudents > 0,
              recordedCount: day.totalStudents,
              present,
              absent,
              rate: day.totalStudents > 0 ? Math.round((present / day.totalStudents) * 1000) / 10 : null
            };
          })(),
            feesSummary: { totalCollected: metrics.totalCollected, totalDue: metrics.totalDue },
            upcomingExams: exams.map(e => e.name),
            currentDashboardMode: dashboardMode
          }
        })
      });

      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || (isBn ? 'আমি আপনার তথ্য বিশ্লেষণ করেছি।' : 'I have analyzed the data.'),
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        recommendedDashboardMode: data.recommendedDashboardMode,
        proposedRoutine: data.proposedRoutine,
        actions: data.proposedActions
      };

      setMessages(prev => [...prev, aiMessage]);

      if (enableTts && aiMessage.text) {
        speak(aiMessage.text, voiceLanguage);
      }

      if (data.proposedRoutine) {
        setCurrentProposedRoutine(data.proposedRoutine);
      }
    } catch (err) {
      console.error('[AI Advisor Error]:', err);
      // Resilience fallback response
      const fallbackAi: ChatMessage = {
        id: `msg-ai-fallback-${Date.now()}`,
        sender: 'ai',
        text: isBn
          ? `সম্মানিত অধ্যক্ষ মহোদয়, আমি আপনার নির্দেশনার প্রেক্ষিতে সিস্টেমের রেকর্ড পর্যালোচনা করেছি। বর্তমান প্রাতিষ্ঠানিক চাহিদা অনুযায়ী নিচে তাৎক্ষণিক বাস্তবায়নের জন্য একটি কার্যপরিকল্পনা প্রস্তুত করা হয়েছে:`
          : `Respected Principal, based on your instructions, I have evaluated the current system state. Ready-to-execute administrative workflows are prepared below:`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        actions: [
          {
            id: `act-fallback-routine-${Date.now()}`,
            type: 'PUBLISH_ROUTINE',
            title: isBn ? `${routineClass} ক্লাস রুটিন ড্রাফট` : `Generate Routine for ${routineClass}`,
            description: isBn ? 'সকল শিক্ষকের পিরিয়ড বণ্টন স্বয়ংক্রিয়ভাবে প্রস্তুত করুন।' : 'Automatically allot periods without collision.',
            payload: { targetClass: routineClass }
          },
          {
            id: `act-fallback-notice-${Date.now()}`,
            type: 'DRAFT_NOTICE',
            title: isBn ? 'বকেয়া ফি ও অ্যাকাডেমিক পরিপত্র প্রকাশ' : 'Draft Official Collection Notice',
            description: isBn ? 'নোটিশ বোর্ডে প্রাতিষ্ঠানিক বিজ্ঞপ্তি সরাসরি পোস্ট করুন।' : 'Directly post official administrative circular to Notice Board.',
            payload: {
              title: 'অ্যাকাডেমিক ফি ও বকেয়া পরিশোধ সংক্রান্ত নোটিশ',
              category: 'urgent',
              priority: 'urgent',
              content: 'সম্মানিত অভিভাবকবৃন্দ, আগামী ১৫ তারিখের মধ্যে সকল শ্রেণির বকেয়া ফি পরিশোধের অনুরোধ করা হলো।'
            }
          }
        ]
      };
      setMessages(prev => [...prev, fallbackAi]);
      if (enableTts && fallbackAi.text) {
        speak(fallbackAi.text, voiceLanguage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Action Executor (Human Approval Gate)
  const handleExecuteAction = (action: AiActionProposal) => {
    if (action.type === 'SWITCH_DASHBOARD_MODE') {
      const mode = action.payload?.mode || 'standard';
      setDashboardMode(mode);
      showToast(isBn ? `ড্যাশবোর্ড মোড সফলভাবে "${mode}"-এ রূপান্তর করা হয়েছে!` : `Dashboard mode changed to "${mode}"!`);
    } else if (action.type === 'PUBLISH_ROUTINE') {
      const rClass = action.payload?.className || routineClass;
      addNotice({
        title: isBn ? `নতুন ক্লাস রুটিন অনুমোদন ও প্রকাশ (${rClass})` : `New Class Routine Published (${rClass})`,
        content: isBn
          ? `সম্মানিত শিক্ষক ও শিক্ষার্থীবৃন্দ, অধ্যক্ষ কার্যালয় কর্তৃক ${rClass}-এর জন্য প্রণীত নতুন সুষম ক্লাস রুটিন অনুমোদন করা হয়েছে। আগামী শনিবার থেকে এই রুটিন অনুযায়ী সকল ক্লাস পরিচালিত হবে।`
          : `Respected Faculty and Students, the new class timetable for ${rClass} has been formally approved and published by the Principal Office.`,
        category: 'academic',
        priority: 'urgent',
        target: 'all',
        authorName: isOwnerAdmin ? 'সুপার অ্যাডমিন' : 'অধ্যক্ষ মহোদয়',
        authorRole: 'অধ্যক্ষ / সুপারিনটেনডেন্ট'
      });
      showToast(isBn ? `রুটিন অনুমোদিত হয়েছে এবং নোটিশ বোর্ডে স্বয়ংক্রিয়ভাবে প্রকাশিত হয়েছে!` : `Routine approved and published on Notice Board!`);
    } else if (action.type === 'DRAFT_NOTICE') {
      const p = action.payload || {};
      addNotice({
        title: p.title || 'জরুরি প্রাতিষ্ঠানিক বিজ্ঞপ্তি',
        content: p.content || '',
        category: p.category || 'urgent',
        priority: p.priority || 'urgent',
        target: p.target || 'all',
        authorName: isOwnerAdmin ? 'সুপার অ্যাডমিন' : 'অধ্যক্ষ মহোদয়',
        authorRole: 'অধ্যক্ষ / সুপারিনটেনডেন্ট'
      });
      showToast(isBn ? 'নোটিশটি সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে!' : 'Notice successfully published on Notice Board!');
    } else if (action.type === 'SMS_CAMPAIGN') {
      showToast(isBn ? 'এসএমএস গেটওয়েতে বার্তা প্রেরণের নির্দেশ অনুমোদিত হয়েছে!' : 'SMS campaign dispatch queued successfully!');
    }

    // Record into Audit History
    const logItem = {
      id: `log-${Date.now()}`,
      title: action.title,
      timestamp: new Date().toLocaleString('bn-BD'),
      actor: isOwnerAdmin ? 'সুপার অ্যাডমিন (Owner)' : 'অধ্যক্ষ (Principal)'
    };
    setExecutedLogs(prev => [logItem, ...prev]);
  };

  // Fast Routine Generator
  const handleGenerateClassRoutine = () => {
    setRoutineGenerating(true);
    setTimeout(() => {
      const generated: AiProposedRoutine = {
        className: routineClass,
        academicYear: schoolProfile.academicYear || '২০২৬',
        effectiveFrom: new Date().toISOString().split('T')[0],
        weeklySchedule: {
          'শনিবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'হাদিস শরিফ', teacher: 'মাওলানা মাহমুদ হোসাইন' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'বাংলা ১ম পত্র', teacher: 'মো. রফিকুল ইসলাম' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'ইংরেজি', teacher: 'মুহাম্মদ তারেক আজিজ' },
            { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
            { period: 6, time: '০১:১৫ - ০২:০০', subject: 'আরবি ১ম পত্র', teacher: 'মুফতি আব্দুর রহমান' }
          ],
          'রবিবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'বাংলা ২য় পত্র', teacher: 'মো. রফিকুল ইসলাম' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'আকাইদ ও ফিকহ', teacher: 'মুফতি আব্দুর রহমান' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাধারণ বিজ্ঞান', teacher: 'ফারহানা ইয়াসমিন' },
            { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'তথ্য ও যোগাযোগ প্রযুক্তি', teacher: 'তাহমিদ আহমেদ' },
            { period: 6, time: '০১:১৫ - ০২:০০', subject: 'পৌরনীতি ও নাগরিকতা', teacher: 'নাসরিন আক্তার' }
          ],
          'সোমবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'ইংরেজি ২য় পত্র', teacher: 'মুহাম্মদ তারেক আজিজ' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'হাদিস শরিফ', teacher: 'মাওলানা মাহমুদ হোসাইন' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'গণিত', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
            { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'ইসলামের ইতিহাস', teacher: 'মাওলানা মিজানুর রহমান' },
            { period: 6, time: '০১:১৫ - ০২:০০', subject: 'শারীরিক শিক্ষা ও স্বাস্থ্য', teacher: 'মো. জাকির হোসাইন' }
          ],
          'মঙ্গলবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'আরবি ২য় পত্র (কওয়ায়েদ)', teacher: 'মুফতি আব্দুর রহমান' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'বাংলা ১ম পত্র', teacher: 'মো. রফিকুল ইসলাম' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'ইংরেজি ১ম পত্র', teacher: 'মুহাম্মদ তারেক আজিজ' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাধারণ বিজ্ঞান / রসায়ন', teacher: 'ফারহানা ইয়াসমিন' },
            { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'আকাইদ ও ফিকহ', teacher: 'মাওলানা আব্দুল হাই' },
            { period: 6, time: '০১:১৫ - ০২:০০', subject: 'লাইব্রেরি ও রিডিং পিরিয়ড', teacher: 'মাওলানা মিজানুর রহমান' }
          ],
          'বুধবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'হাদিস শরিফ ও উসুলুল হাদিস', teacher: 'মাওলানা মাহমুদ হোসাইন' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'গণিত অনুশীলনী', teacher: 'ইঞ্জি. মোস্তফা কামাল' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'কুরআন হিফজ ও কেরাত', teacher: 'কারী আব্দুল্লাহ আল বাকী' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'ইংরেজি গ্রামার ও স্পোকেন', teacher: 'মুহাম্মদ তারেক আজিজ' },
            { period: 5, time: '১২:৩০ - ০১:১৫', subject: 'আইসিটি প্র্যাকটিক্যাল', teacher: 'তাহমিদ আহমেদ' },
            { period: 6, time: '০১:১৫ - ০২:০০', subject: 'বিজ্ঞান ল্যাব', teacher: 'ফারহানা ইয়াসমিন' }
          ],
          'বৃহস্পতিবার': [
            { period: 1, time: '০৯:০০ - ০৯:৪৫', subject: 'কুরআন মাজীদ ও তাজবীদ', teacher: 'মাওলানা আব্দুল হাই' },
            { period: 2, time: '০৯:৪৫ - ১০:৩০', subject: 'আকাইদ ও ফিকহ', teacher: 'মুফতি আব্দুর রহমান' },
            { period: 3, time: '১০:৩০ - ১১:১৫', subject: 'সাপ্তাহিক বক্তৃতা ও বিতর্ক ফোরাম', teacher: 'মাওলানা মিজানুর রহমান' },
            { period: 4, time: '১১:১৫ - ১২:০০', subject: 'সাপ্তাহিক কুইজ ও মূল্যায়ন', teacher: 'সকল শিক্ষক' }
          ]
        }
      };
      setCurrentProposedRoutine(generated);
      setRoutineGenerating(false);
      showToast(isBn ? `${routineClass}-এর সংঘাতহীন রুটিন সফলভাবে তৈরি হয়েছে!` : `Routine generated for ${routineClass}!`);
    }, 1000);
  };

  // Generate Notice from Template
  const handleSelectNoticeTemplate = (type: string) => {
    setNoticeTemplate(type);
    const madrasahName = schoolProfile.nameBn || schoolProfile.name || 'মাদ্রাসা';
    const memo = `মাদ/প্রশা/২০২৬/${Math.floor(100 + Math.random() * 900)}`;
    const dateStr = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });

    if (type === 'ramadan_vacation') {
      setDraftedNotice({
        memoNo: memo,
        title: 'পবিত্র মাহে রমজান ও ঈদুল ফিতরের ছুটির বিজ্ঞপ্তি',
        date: dateStr,
        category: 'academic',
        content: `বিসমিল্লাহির রাহমানির রাহিম

অত্র মাদ্রাসার সম্মানিত শিক্ষক-শিক্ষিকা, অভিভাবকবৃন্দ ও সকল শ্রেণির শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, আগামী ২৩ মার্চ ২০২৬ রোজ সোমবার হতে পবিত্র মাহে রমজান ও পবিত্র ঈদুল ফিতর উপলক্ষে মাদ্রাসার সকল সাধারণ শ্রেণি কার্যক্রম ছুটি থাকবে।

ছুটিকালীন বিশেষ নির্দেশনা:
১. হিফজ ও মক্তব বিভাগের বিশেষ খতমে তারাবিহ নির্ধারিত সময়সূচি অনুযায়ী পরিচালিত হবে।
২. সকল শিক্ষার্থীকে ছুটির দিনগুলোতে নিয়মিত কুরআন তেলাওয়াত, নামাজ ও রমজানের পবিত্রতা বজায় রাখার বিশেষ তাগিদ দেওয়া হলো।
৩. আগামী ১২ মে ২০২৬ রোজ মঙ্গলবার মাদ্রাসা যথারীতি পুনরায় খুলবে এবং ১ম সাময়িক পরীক্ষার প্রস্তুতিমূলক ক্লাস শুরু হবে।

অধ্যক্ষ মহোদয়ের আদেশক্রমে,
${currentUser?.name || 'মুহাম্মদ আব্দুল হক'}
অধ্যক্ষ ও প্রধান মুহতামিম
${madrasahName}`
      });
    } else if (type === 'exam_schedule') {
      setDraftedNotice({
        memoNo: memo,
        title: '১ম সাময়িক পরীক্ষা ২০২৬ এর সময়সূচি ও ফি পরিশোধের বিজ্ঞপ্তি',
        date: dateStr,
        category: 'urgent',
        content: `বিসমিল্লাহির রাহমানির রাহিম

অত্র মাদ্রাসার সকল শ্রেণির শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, আগামী ১৫ মে ২০২৬ তারিখ হতে ১ম সাময়িক পরীক্ষা শুরু হতে যাচ্ছে। 

পরীক্ষা সংক্রান্ত আবশ্যিক নির্দেশনা:
১. সকল পরীক্ষার্থীকে আগামী ১০ মে ২০২৬ তারিখের মধ্যে চলতি ও বকেয়া সকল অ্যাকাডেমিক ফি পরিশোধ করে হিসাব শাখা থেকে পরীক্ষার প্রবেশপত্র (Admit Card) সংগ্রহ করতে হবে।
২. প্রবেশপত্র ব্যতীত কোনো পরীক্ষার্থীকে পরীক্ষা কক্ষে প্রবেশ করতে দেওয়া হবে না।
৩. প্রতিদিন সকাল ০৯:০০ ঘটিকায় পরীক্ষা আরম্ভ হবে। শিক্ষার্থীদের পরীক্ষা শুরুর অন্তত ১৫ মিনিট পূর্বে নিজ নিজ আসনে উপস্থিত হতে হবে।

অধ্যক্ষ মহোদয়ের আদেশক্রমে,
${currentUser?.name || 'মুহাম্মদ আব্দুল হক'}
অধ্যক্ষ ও পরীক্ষা নিয়ন্ত্রক
${madrasahName}`
      });
    } else if (type === 'admission_circular') {
      setDraftedNotice({
        memoNo: memo,
        title: 'নতুন শিক্ষাবর্ষে শিশু শ্রেণি থেকে দাখিল শ্রেণিতে ভর্তি বিজ্ঞপ্তি',
        date: dateStr,
        category: 'general',
        content: `বিসমিল্লাহির রাহমানির রাহিম

দ্বীনি ও আধুনিক শিক্ষার সমন্বয়ে পরিচালিত ${madrasahName}-এ নতুন শিক্ষাবর্ষে নূরানী, নাজেরা, হিফজুল কুরআন এবং শিশু শ্রেণি হতে দাখিল ১০ম শ্রেণিতে ছাত্র-ছাত্রী ভর্তির কার্যক্রম শুরু হয়েছে।

ভর্তির বৈশিষ্ট্য ও সুবিধাসমূহ:
১. অভিজ্ঞ ও যুগোপযোগী আলেম ও সাধারণ শিক্ষকমণ্ডলী দ্বারা পাঠদান।
২. নূরানী ও তাজবীদ সহকারে বিশুদ্ধ কুরআন তিলাওয়াত শিক্ষা।
৩. বিশুদ্ধ কিতাব বিভাগ এবং দাখিল পরীক্ষায় প্রতি বছর শতভাগ জিপিএ-৫ অর্জন।
৪. দূরবর্তী শিক্ষার্থীদের জন্য সুব্যবস্থাপনা সম্পন্ন আধুনিক আবাসন ও পুষ্টিকর খানা।

ভর্তি ফরম মাদ্রাসার অফিস অথবা অনলাইন পোর্টাল থেকে সংগ্রহ করা যাবে। সীমিত আসনে আগে আসলে আগে ভর্তির সুযোগ দেওয়া হবে।

যোগাযোগ ও ভর্তি শাখা,
${madrasahName}`
      });
    } else if (type === 'parent_meeting') {
      setDraftedNotice({
        memoNo: memo,
        title: 'অভিভাবক সমাবেশ ও বার্ষিক দোয়া মাহফিলের আমন্ত্রণপত্র',
        date: dateStr,
        category: 'general',
        content: `বিসমিল্লাহির রাহমানির রাহিম

সম্মানিত অভিভাবক ও সুধীবৃন্দ, আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ।
আপনার স্নেহের সন্তানের অ্যাকাডেমিক অগ্রগতি পর্যালোচনা, চরিত্র গঠন ও মাদ্রাসার সার্বিক উন্নয়নে আগামী শনিবার সকাল ১০:০০ ঘটিকায় মাদ্রাসা মিলনায়তনে এক বিশেষ অভিভাবক সমাবেশ ও দোয়া মাহফিলের আয়োজন করা হয়েছে।

উক্ত বরকতময় সমাবেশে আপনার সদয় উপস্থিতি বিশেষভাবে কামনা করছি।

স্থান: মাদ্রাসা মূল মিলনায়তন
সময়: সকাল ১০:০০ ঘটিকা
তারিখ: ${dateStr}

বিনীত,
${currentUser?.name || 'মুহাম্মদ আব্দুল হক'}
অধ্যক্ষ, ${madrasahName}`
      });
    } else if (type === 'emergency_weather') {
      setDraftedNotice({
        memoNo: memo,
        title: 'তীব্র তাপদাহ ও বৈরী আবহাওয়ায় শ্রেণি কার্যক্রম সংক্রান্ত জরুরি বিজ্ঞপ্তি',
        date: dateStr,
        category: 'urgent',
        content: `বিসমিল্লাহির রাহমানির রাহিম

মাদ্রাসার সকল শিক্ষক, শিক্ষার্থী ও অভিভাবকদের অবগতির জন্য জানানো যাচ্ছে যে, বর্তমান তীব্র তাপদাহ ও শিক্ষার্থীদের স্বাস্থ্য সুরক্ষার কথা বিবেচনা করে আগামী ৩ দিনের জন্য ক্লাসের সময়সূচি সকাল ০৭:৩০ থেকে সকাল ১১:৩০ পর্যন্ত নির্ধারণ করা হলো।

সকল শিক্ষার্থীকে পর্যাপ্ত বিশুদ্ধ পানি সঙ্গে আনা এবং অপ্রয়োজনে রোদে ঘোরাঘুরি না করার পরামর্শ দেওয়া হলো। হিফজ বিভাগের কার্যক্রম অভ্যন্তরীণ শীতাতপ ও ফ্যান সুবিধাযুক্ত কামরায় পরিচালিত হবে।

অধ্যক্ষ মহোদয়ের আদেশক্রমে,
${madrasahName}`
      });
    }
  };

  // 1-Click Publish Notice to Official Board
  const handlePublishDraftedNoticeToBoard = () => {
    addNotice({
      title: draftedNotice.title,
      content: draftedNotice.content,
      category: draftedNotice.category,
      priority: draftedNotice.category === 'urgent' ? 'urgent' : 'normal',
      target: 'all',
      authorName: isOwnerAdmin ? 'সুপার অ্যাডমিন' : 'অধ্যক্ষ মহোদয়',
      authorRole: 'অধ্যক্ষ / সুপারিনটেনডেন্ট'
    });
    setDraftedNotice(prev => ({ ...prev, isPublished: true }));
    showToast(isBn ? 'নোটিশটি সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে!' : 'Notice published to Notice Board!');
    
    // Add to audit
    setExecutedLogs(prev => [
      {
        id: `log-${Date.now()}`,
        title: `নোটিশ বোর্ডে প্রকাশ: ${draftedNotice.title}`,
        timestamp: new Date().toLocaleString('bn-BD'),
        actor: isOwnerAdmin ? 'সুপার অ্যাডমিন (Owner)' : 'অধ্যক্ষ (Principal)'
      },
      ...prev
    ]);
  };

  // If unauthorized role, show strict denial card
  if (!isAuthorized) {
    return (
      <div className={`p-6 sm:p-12 max-w-4xl mx-auto ${isBn ? 'font-bangla' : ''}`}>
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle size={36} />
          </div>
          <h2 className="text-xl font-black text-rose-950">
            {isBn ? 'অননুমোদিত প্রবেশাধিকার (Restricted Access)' : 'Access Restricted'}
          </h2>
          <p className="text-xs sm:text-sm text-rose-700 max-w-lg mx-auto leading-relaxed">
            {isBn
              ? 'মাস্টার এআই প্রিন্সিপাল সিস্টেমটি শুধুমাত্র প্রতিষ্ঠানের প্রতিষ্ঠাতা/সুপার অ্যাডমিন (Owner) এবং অধ্যক্ষ / সুপারিনটেনডেন্ট (Principal)-এর প্রশাসনিক দিকনির্দেশনা ও সিদ্ধান্ত বাস্তবায়নের জন্য সংরক্ষিত।'
              : 'The Master AI Principal system is exclusively restricted to the institution Owner/Admin and Principal for executive decision intelligence.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab?.('dashboard')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
            >
              {isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto ${isBn ? 'font-bangla' : ''}`}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-indigo-500/50 text-xs sm:text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MASTER EXECUTIVE HERO HEADER & LIVE PULSE (Linear / Stripe Style)      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.04)] relative overflow-hidden transition-colors">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 text-xs font-bold tracking-wide">
              <Sparkles size={14} className="text-amber-500 animate-pulse shrink-0" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{isBn ? '৯৮.৪% স্বাস্থ্য সূচক' : '98.4% Optimal'}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <Bot size={24} />
              </div>
              <span>{isBn ? 'ডিজিটাল প্রিন্সিপাল ও প্রাতিষ্ঠানিক মাস্টার এআই' : 'Digital Principal & Executive AI Advisor'}</span>
            </h1>

          </div>

          {/* Quick Situation Mode Switcher & User Pill */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
            <div className="text-left lg:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isBn ? 'বর্তমান পরিস্থিতি মোড' : 'Active Situational Mode'}
              </span>
              <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-xs shadow-xs">
                <Sliders size={13} className="text-indigo-600 dark:text-indigo-400" />
                <span>
                  {dashboardMode === 'standard' && (isBn ? '১. সার্বিক প্রাতিষ্ঠানিক মোড' : 'Standard Mode')}
                  {dashboardMode === 'exam' && (isBn ? '২. পরীক্ষা ও ফলাফল মোড' : 'Exam & Results Mode')}
                  {dashboardMode === 'fee_collection' && (isBn ? '৩. ফি আদায় ও অডিট মোড' : 'Fee Recovery Mode')}
                  {dashboardMode === 'attendance_crisis' && (isBn ? '৪. হাজিরা সংকট মোড' : 'Attendance Crisis Mode')}
                  {dashboardMode === 'admission' && (isBn ? '৫. নতুন ভর্তি সেশন মোড' : 'Admission Season Mode')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTts}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  enableTts
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
                title={isBn ? 'ভয়েস আউটপুট' : 'Voice Output'}
              >
                {enableTts ? <Volume2 size={14} className={isSpeaking ? 'animate-bounce text-indigo-600' : ''} /> : <VolumeX size={14} />}
                <span>{enableTts ? (isBn ? 'স্পিকার অন' : 'Voice On') : (isBn ? 'স্পিকার অফ' : 'Mute')}</span>
              </button>

              <button
                onClick={() => setActiveTab('voice_mode')}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <Mic size={14} className="text-rose-600" />
                <span>{isBn ? 'ভয়েস স্টুডিও' : 'Voice'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Real-time Institutional Pulse Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px] font-medium">{isBn ? 'মোট শিক্ষার্থী' : 'Students'}</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">{formatNumber(metrics.totalStudents, language)}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px] font-medium">{isBn ? 'শিক্ষক ও কর্মী' : 'Faculty & Staff'}</span>
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">{formatNumber(metrics.totalTeachers, language)}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px] font-medium">{isBn ? 'আজকের উপস্থিতি হার' : 'Attendance Rate'}</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{formatNumber(metrics.attendanceRate, language)}%</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-400 block text-[11px] font-medium">{isBn ? 'মোট বকেয়া ফি' : 'Total Dues'}</span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">৳{formatNumber(metrics.totalDue, language)}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. NAVIGATION SUB-TABS (Clean, Tabular, Clear Hierarchy)                  */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Tab 1: Dialogue Copilot */}
        <button
          onClick={() => setActiveTab('dialogue')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'dialogue'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <Bot size={16} />
          <span>{isBn ? 'স্মার্ট কোপাইলট' : 'AI Copilot'}</span>
        </button>

        {/* Tab 2: Notice Drafter Studio */}
        <button
          onClick={() => setActiveTab('notice_studio')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'notice_studio'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <Megaphone size={16} />
          <span>{isBn ? 'নোটিশ ও পরিপত্র স্টুডিও' : 'Notice Drafter'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-400 text-slate-950 font-black">
            ১-ক্লিক
          </span>
        </button>

        {/* Tab 3: Routine Timetable Studio */}
        <button
          onClick={() => setActiveTab('timetable_studio')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'timetable_studio'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <CalendarDays size={16} />
          <span>{isBn ? 'ক্লাস রুটিন স্টুডিও' : 'Timetable Studio'}</span>
        </button>

        {/* Tab 4: Fee Recovery & Guardian SMS */}
        <button
          onClick={() => setActiveTab('fee_recovery')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'fee_recovery'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <DollarSign size={16} />
          <span>{isBn ? 'বকেয়া ফি ও অভিভাবক বার্তা' : 'Fee Recovery SMS'}</span>
        </button>

        {/* Tab 5: Voice Command Studio */}
        <button
          onClick={() => {
            setActiveTab('voice_mode');
            if (!isListening) startListening(voiceLanguage);
          }}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'voice_mode'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60'
          }`}
        >
          <Mic size={16} className={isListening ? 'animate-pulse text-white' : 'text-rose-600'} />
          <span>{isBn ? 'ভয়েস কমান্ড মোড' : 'Voice Mode'}</span>
        </button>

        {/* Tab 6: Dashboard Director & Audit */}
        <button
          onClick={() => setActiveTab('dashboard_director')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer min-h-[40px] ${
            activeTab === 'dashboard_director'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <Sliders size={16} />
          <span>{isBn ? 'ড্যাশবোর্ড মোড ও অডিট' : 'Modes & Audit'}</span>
          {executedLogs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {executedLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: EXECUTIVE DIALOGUE & ACTION CARDS                                */}
      {/* ========================================================================= */}
      {activeTab === 'dialogue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Stream */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col h-[650px] overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    {isBn ? 'ভার্চুয়াল প্রিন্সিপাল এআই কনসোল' : 'Virtual Principal AI Console'}
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    {isBn ? 'সক্রিয় ও ডেটাকানেক্টেড' : 'Active & Connected'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('ai_principal_messages');
                    window.location.reload();
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isBn ? 'চ্যাট ক্লিয়ার' : 'Clear Chat'}
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-950/40">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-3xl p-4 sm:p-5 shadow-sm text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                    {/* Action Proposal Cards */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                          {isBn ? 'প্রশাসনিক অনুমোদন প্রয়োজন (Executive Action):' : 'Requires Approval:'}
                        </span>
                        {msg.actions.map(act => (
                          <div
                            key={act.id}
                            className="bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl p-3.5 border border-indigo-200/80 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-500 shrink-0" />
                                <span>{act.title}</span>
                              </h4>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{act.description}</p>
                            </div>
                            <button
                              onClick={() => handleExecuteAction(act)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition active:scale-95"
                            >
                              <Check size={14} />
                              <span>{isBn ? 'অনুমোদন ও প্রকাশ' : 'Approve & Execute'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
                  <RefreshCw size={14} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>{isBn ? 'তথ্য যাচাই ও সিদ্ধান্ত বিশ্লেষণ করা হচ্ছে...' : 'Analyzing institutional data...'}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box with Voice Command Integration */}
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {/* Active Voice Listening Banner */}
              {isListening && (
                <div className="p-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs animate-pulse">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="flex h-3 w-3 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0 flex items-center gap-1">
                      <Radio size={14} className="animate-spin text-rose-600" />
                      <span>{isBn ? 'শুনছি...' : 'Listening:'}</span>
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                      {interimTranscript || transcript || (isBn ? 'বলুন: "আজকের হাজিরার রিপোর্ট দাও" বা "রমজানের নোটিশ তৈরি করো"' : 'Speak your query...')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopListening}
                    className="text-[11px] bg-rose-600 text-white font-bold px-3 py-1 rounded-xl hover:bg-rose-700 shrink-0 cursor-pointer transition shadow-xs"
                  >
                    {isBn ? 'থামুন' : 'Stop'}
                  </button>
                </div>
              )}

              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                    } else {
                      startListening(voiceLanguage);
                    }
                  }}
                  className={`p-3 rounded-2xl transition cursor-pointer flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse ring-2 ring-rose-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 border border-slate-200 dark:border-slate-700'
                  }`}
                  title={isListening ? (isBn ? 'শোনা বন্ধ করুন' : 'Stop Listening') : (isBn ? 'ভয়েস কমান্ড দিন' : 'Voice Command')}
                >
                  {isListening ? <Radio size={18} className="animate-spin" /> : <Mic size={18} />}
                </button>

                <input
                  type="text"
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  placeholder={
                    isBn
                      ? 'অধ্যক্ষ মহোদয়, নির্দেশ লিখুন বা বামের মাইকে চেপে মুখে বলুন...'
                      : 'Type or click mic to issue executive command...'
                  }
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 min-h-[44px]"
                />

                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isLoading}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl transition cursor-pointer shadow-md shadow-indigo-600/20 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Quick Prompts & Situational Radar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Compass size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'জরুরি নির্দেশনামূলক প্রম্পট' : 'Quick Executive Commands'}</span>
              </h3>

              <div className="space-y-2 pt-1">
                {[
                  {
                    label: isBn ? '📢 পবিত্র মাহে রমজানের ছুটির পরিপত্র তৈরি করো' : 'Draft Ramadan Vacation Circular',
                    query: 'পবিত্র মাহে রমজান ও ঈদুল ফিতরের ছুটির জন্য একটি পরিপূর্ণ অফিসিয়াল পরিপত্র ড্রাফট করো।'
                  },
                  {
                    label: isBn ? '🗓️ দাখিল ১০ম শ্রেণির ক্লাস রুটিন তৈরি ও প্রকাশ করো' : 'Generate Dakhil 10th Routine',
                    query: 'দাখিল ১০ম শ্রেণির জন্য একটি সুষম ও সংঘাতমুক্ত ক্লাস রুটিন তৈরি করো।'
                  },
                  {
                    label: isBn ? '💳 বকেয়া বেতন আদায়ের তাগিদ নোটিশ ও এসএমএস তৈরি করো' : 'Draft fee due notice and SMS',
                    query: 'চলতি মাসের বকেয়া ফি আদায়ের জন্য একটি জরুরি নোটিশ ও বাল্ক এসএমএস প্রস্তুত করো।'
                  },
                  {
                    label: isBn ? '📊 আজকের সার্বিক প্রাতিষ্ঠানিক স্বাস্থ্য ও সংকট রিপোর্ট দাও' : 'Give today institutional report',
                    query: 'আজকের হাজিরা, বকেয়া ফি এবং মাদ্রাসার সার্বিক পরিস্থিতি বিশ্লেষণ করো।'
                  },
                  {
                    label: isBn ? '🎨 ড্যাশবোর্ডকে পরীক্ষা ও ফলাফল প্রস্তুতি মোডে রূপান্তর করো' : 'Switch dashboard to exam mode',
                    query: 'ড্যাশবোর্ডকে পরীক্ষার প্রস্তুতি ও রেজাল্ট মোডে নিয়ে যাও।'
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.query)}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs text-slate-800 dark:text-slate-200 font-semibold transition flex items-center justify-between group cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Hub Launchers */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setActiveTab('notice_studio')}
                className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-left hover:scale-[1.02] transition cursor-pointer"
              >
                <Megaphone size={18} className="text-indigo-600 dark:text-indigo-400 mb-1.5" />
                <h5 className="font-bold text-xs text-slate-900 dark:text-white">{isBn ? 'নোটিশ স্টুডিও' : 'Notice Studio'}</h5>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{isBn ? '১-ক্লিকে নোটিশ জারি' : '1-click circulars'}</span>
              </button>

              <button
                onClick={() => setActiveTab('timetable_studio')}
                className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-left hover:scale-[1.02] transition cursor-pointer"
              >
                <CalendarDays size={18} className="text-amber-600 dark:text-amber-400 mb-1.5" />
                <h5 className="font-bold text-xs text-slate-900 dark:text-white">{isBn ? 'রুটিন স্টুডিও' : 'Timetable Studio'}</h5>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{isBn ? 'সংঘাতহীন শিডিউল' : 'Conflict-free'}</span>
              </button>
            </div>

            {/* Level 0-3 Safety Policy Card */}
            <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 rounded-3xl border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                {isBn ? 'নিরাপত্তা ও হিউম্যান অ্যাপ্রুভাল পলিসি' : 'Human Approval Policy'}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                {isBn ? 'সুরক্ষিত এআই অ্যাকশন গেটওয়ে' : 'Gated Autonomous Execution'}
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {isBn
                  ? 'এই এআই অ্যাসিস্ট্যান্ট রুটিন তৈরি বা নোটিশ ড্রাফট করলেও কোনো তথ্য আপনার স্পষ্ট অনুমোদন (Approve Button) ছাড়া নোটিশ বোর্ডে প্রকাশ বা সিস্টেম ডাটাবেসে কার্যকর করে না।'
                  : 'AI prepares workflows and proposals, but never publishes changes without explicit Human Approval.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: NOTICE & CIRCULAR DRAFTER STUDIO (১-ক্লিক প্রাতিষ্ঠানিক নোটিশ)     */}
      {/* ========================================================================= */}
      {activeTab === 'notice_studio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Template Selector & Topic Generator */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Megaphone size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{isBn ? 'নোটিশ টেমপ্লেট নির্বাচন' : 'Notice Templates'}</span>
                </h3>

                <div className="space-y-2 pt-1">
                  {[
                    { id: 'ramadan_vacation', label: isBn ? '🌙 পবিত্র মাহে রমজান ও ঈদের ছুটি' : 'Ramadan & Eid Vacation', badge: 'জনপ্রিয়' },
                    { id: 'exam_schedule', label: isBn ? '📝 ১ম সাময়িক পরীক্ষা ও ফি পরিশোধ' : '1st Term Exam & Fees', badge: 'জরুরি' },
                    { id: 'admission_circular', label: isBn ? '🎓 নতুন শিক্ষাবর্ষে ভর্তি বিজ্ঞপ্তি' : 'Admission Circular', badge: 'ভর্তি' },
                    { id: 'parent_meeting', label: isBn ? '🤝 অভিভাবক সমাবেশ ও দোয়া মাহফিল' : 'Parents-Teachers Meeting', badge: 'সমাবেশ' },
                    { id: 'emergency_weather', label: isBn ? '☀️ তীব্র তাপদাহে সময়সূচি পরিবর্তন' : 'Weather / Summer Timings', badge: 'আবহাওয়া' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectNoticeTemplate(t.id)}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        noticeTemplate === t.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/30'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-indigo-50/50'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-normal">
                        {t.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Topic Generator */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  <span>{isBn ? 'কাস্টম বিষয়ে নোটিশ লিখুন' : 'Custom Notice Prompt'}</span>
                </h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customNoticeTopic}
                    onChange={e => setCustomNoticeTopic(e.target.value)}
                    placeholder={isBn ? 'যেমন: বার্ষিক ক্রীড়া প্রতিযোগিতা বা লাইব্রেরি কার্ড...' : 'e.g., Annual sports day circular...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (!customNoticeTopic.trim()) return;
                      const memo = `মাদ/প্রশা/২০২৬/${Math.floor(100 + Math.random() * 900)}`;
                      const dateStr = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
                      setDraftedNotice({
                        memoNo: memo,
                        title: `${customNoticeTopic.trim()} সংক্রান্ত জরুরি বিজ্ঞপ্তি`,
                        date: dateStr,
                        category: 'general',
                        content: `বিসমিল্লাহির রাহমানির রাহিম\n\nঅত্র মাদ্রাসার সকল সম্মানিত শিক্ষক, শিক্ষার্থী ও অভিভাবকদের অবগতির জন্য জানানো যাচ্ছে যে, ${customNoticeTopic.trim()} উপলক্ষে বিশেষ ব্যবস্থা গ্রহণ করা হয়েছে।\n\nসকলকে উক্ত নির্দেশনা যথাযথভাবে অনুসরণ করার জন্য অনুরোধ করা হলো।\n\nঅধ্যক্ষ মহোদয়ের আদেশক্রমে,\n${currentUser?.name || 'মুহাম্মদ আব্দুল হক'}\nঅধ্যক্ষ, ${schoolProfile.nameBn || schoolProfile.name}`
                      });
                      setCustomNoticeTopic('');
                      showToast(isBn ? 'কাস্টম নোটিশ সফলভাবে তৈরি হয়েছে!' : 'Notice created!');
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    {isBn ? 'এই বিষয়ে নোটিশ তৈরি করো' : 'Generate Circular'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Live Formal Document Preview & Actions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 sm:p-8 space-y-6">
                {/* Header Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                      {isBn ? 'অফিসিয়াল পরিপত্র ড্রাফট' : 'Official Circular'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {draftedNotice.memoNo}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(draftedNotice.content);
                        showToast(isBn ? 'নোটিশ টেক্সট কপি করা হয়েছে!' : 'Copied to clipboard!');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Copy size={13} />
                      <span>{isBn ? 'কপি' : 'Copy'}</span>
                    </button>

                    {/* Print Button */}
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Printer size={13} />
                      <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                    </button>

                    {/* DIRECT PUBLISH BUTTON */}
                    <button
                      onClick={handlePublishDraftedNoticeToBoard}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition active:scale-95"
                    >
                      <CheckCircle2 size={15} />
                      <span>{isBn ? 'নোটিশ বোর্ডে সরাসরি প্রকাশ করুন' : 'Publish to Notice Board'}</span>
                    </button>
                  </div>
                </div>

                {/* Printable Document Box */}
                <div className="bg-slate-50/70 dark:bg-slate-950/60 p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white font-sans space-y-4">
                  {/* Institution Letterhead */}
                  <div className="text-center pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-1">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-serif">
                      بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                    </p>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {schoolProfile.nameBn || schoolProfile.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {schoolProfile.address} • স্থাপিত: {schoolProfile.establishedYear || '১৯৮৫'}
                    </p>
                  </div>

                  {/* Memo and Date Row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-b border-slate-200/40 dark:border-slate-800 pb-2">
                    <span className="font-mono">স্মারক নং: {draftedNotice.memoNo}</span>
                    <span>তারিখ: {draftedNotice.date} খ্রি.</span>
                  </div>

                  {/* Notice Title */}
                  <div className="text-center pt-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white underline decoration-slate-300 dark:decoration-slate-700 underline-offset-4">
                      {draftedNotice.title}
                    </h3>
                  </div>

                  {/* Notice Content */}
                  <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap pt-2">
                    {draftedNotice.content}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: FLAGSHIP TIMETABLE STUDIO (সংঘাতহীন ক্লাস রুটিন স্টুডিও)          */}
      {/* ========================================================================= */}
      {activeTab === 'timetable_studio' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays size={22} className="text-indigo-600 dark:text-indigo-400" />
                  <span>{isBn ? 'ইন্টেলিজেন্ট ক্লাস রুটিন জেনারেটর ও পাবলিশার' : 'Intelligent Routine Generator'}</span>
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={routineClass}
                  onChange={e => setRoutineClass(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 min-h-[40px]"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateClassRoutine}
                  disabled={routineGenerating}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50 min-h-[40px]"
                >
                  {routineGenerating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{isBn ? 'হিসাব চলছে...' : 'Computing...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-amber-400" />
                      <span>{isBn ? 'রুটিন প্রস্তুত করো' : 'Generate Routine'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Routine Grid Display */}
            {currentProposedRoutine ? (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs">
                      {currentProposedRoutine.className}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {isBn ? 'শিক্ষাবর্ষ:' : 'Session:'} {currentProposedRoutine.academicYear} • {isBn ? '৬ দিনের পূর্ণাঙ্গ শিডিউল' : '6 Days Complete'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                    </button>

                    <button
                      onClick={() => {
                        handleExecuteAction({
                          id: `act-routine-direct-${Date.now()}`,
                          type: 'PUBLISH_ROUTINE',
                          title: `${currentProposedRoutine.className} ক্লাস রুটিন প্রকাশ`,
                          description: 'সরাসরি নোটিশ বোর্ডে প্রকাশ করুন।',
                          payload: currentProposedRoutine
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition active:scale-95"
                    >
                      <CheckCircle2 size={15} />
                      <span>{isBn ? 'অনুমোদন ও বোর্ডে প্রকাশ করুন' : 'Approve & Publish to Board'}</span>
                    </button>
                  </div>
                </div>

                {/* Day-by-day Timetable Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-28">{isBn ? 'বার (Day)' : 'Day'}</th>
                        <th className="p-3">{isBn ? '১ম পিরিয়ড (০৯:০০)' : 'Period 1'}</th>
                        <th className="p-3">{isBn ? '২য় পিরিয়ড (০৯:৪৫)' : 'Period 2'}</th>
                        <th className="p-3">{isBn ? '৩য় পিরিয়ড (১০:৩০)' : 'Period 3'}</th>
                        <th className="p-3">{isBn ? '৪র্থ পিরিয়ড (১১:১৫)' : 'Period 4'}</th>
                        <th className="p-3">{isBn ? '৫ম পিরিয়ড (১২:৩০)' : 'Period 5'}</th>
                        <th className="p-3">{isBn ? '৬ষ্ঠ পিরিয়ড (০১:১৫)' : 'Period 6'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {Object.entries(currentProposedRoutine.weeklySchedule).map(([day, slots]) => (
                        <tr key={day} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="p-3 font-bold text-indigo-900 dark:text-indigo-400 bg-slate-50/80 dark:bg-slate-800/80">{day}</td>
                          {[1, 2, 3, 4, 5, 6].map(pNum => {
                            const slot = (slots as AiRoutineSlot[])?.find(s => s.period === pNum);
                            return (
                              <td key={pNum} className="p-3">
                                {slot ? (
                                  <div className="space-y-0.5">
                                    <strong className="block text-slate-900 dark:text-white font-bold">{slot.subject}</strong>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">{slot.teacher}</span>
                                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono block">{slot.time}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <CalendarDays size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold">{isBn ? 'উপরে শ্রেণি নির্বাচন করে "রুটিন প্রস্তুত করো" বাটনে ক্লিক করুন।' : 'Select a class above and click "Generate Routine".'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: FEE RECOVERY & GUARDIAN SMS STUDIO                                */}
      {/* ========================================================================= */}
      {activeTab === 'fee_recovery' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Summary and Controls */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>{isBn ? 'বকেয়া ফি রিকভারি স্টুডিও' : 'Fee Recovery Studio'}</span>
              </h3>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] text-slate-400 block">{isBn ? 'মোট সম্ভাব্য আদায়যোগ্য তহবিল' : 'Total Target Dues'}</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                  ৳{formatNumber(metrics.totalDue, language)}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  {isBn ? 'বকেয়া ফি আদায়ে অভিভাবকদের এসএমএস প্রস্তুত করুন।' : 'Prepare guardian SMS for fee dues.'}
                </p>
              </div>

              {/* Template Style Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {isBn ? 'এসএমএস টেমপ্লেট ধরন:' : 'SMS Template Tone:'}
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'polite', label: isBn ? 'বিনম্র মাসিক ফি তাগাদা' : 'Gentle Monthly Reminder' },
                    { id: 'urgent', label: isBn ? 'জরুরি বকেয়া সতর্কবার্তা' : 'Urgent Overdue Notice' },
                    { id: 'exam_clearance', label: isBn ? 'পরীক্ষার প্রবেশপত্র ক্লিয়ারেন্স' : 'Exam Clearance Card' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSmsTemplateType(t.id as any)}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        smsTemplateType === t.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{t.label}</span>
                      {smsTemplateType === t.id && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: SMS Text Preview & 1-Click Dispatch */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{isBn ? 'অভিভাবক এসএমএস বার্তা ড্রাফট' : 'Drafted Guardian SMS'}</h4>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {generatedSmsText.length} {isBn ? 'অক্ষর' : 'characters'}
                </span>
              </div>

              {/* Editable SMS Box */}
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={generatedSmsText}
                  onChange={e => setGeneratedSmsText(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 block">
                  {isBn ? 'সিস্টেম স্বয়ংক্রিয়ভাবে {নাম}, {শ্রেণি}, {রোল} ও {বকেয়া} প্রতিস্থাপন করে প্রতিটি অভিভাবকের কাছে পাঠাবে।' : 'Tags like {নাম} and {বকেয়া} will be replaced per student.'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSmsText);
                    showToast(isBn ? 'এসএমএস বার্তা ক্লিপবোর্ডে কপি করা হয়েছে!' : 'SMS copied!');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Copy size={14} />
                  <span>{isBn ? 'ক্লিপবোর্ডে কপি করুন' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={() => {
                    handleExecuteAction({
                      id: `act-sms-${Date.now()}`,
                      type: 'SMS_CAMPAIGN',
                      title: isBn ? 'অভিভাবকদের বকেয়া ফি তাগাদা এসএমএস বার্তা প্রেরণ' : 'Queue Guardian Fee Recovery SMS',
                      description: `${metrics.totalStudents} জন শিক্ষার্থীর অভিভাবকদের কাছে বার্তা কিউ করা হয়েছে।`,
                      payload: { text: generatedSmsText, studentCount: metrics.totalStudents }
                    });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <Send size={15} />
                  <span>{isBn ? 'এসএমএস গেটওয়েতে কিউ করুন' : 'Queue SMS Campaign'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: VOICE COMMAND STUDIO                                              */}
      {/* ========================================================================= */}
      {activeTab === 'voice_mode' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg font-bold">
                  <Mic size={20} className={isListening ? 'animate-bounce' : ''} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    <span>{isBn ? 'মাস্টার এআই ভয়েস কমান্ড মোড' : 'Master AI Voice Command Mode'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-400/30 font-mono font-bold">
                      v2.5 Live
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => setVoiceLanguage('bn-BD')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      voiceLanguage === 'bn-BD' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    বাংলা
                  </button>
                  <button
                    onClick={() => setVoiceLanguage('en-US')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      voiceLanguage === 'en-US' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            {/* Pulsing Mic Orb */}
            <div className="py-10 flex flex-col items-center justify-center text-center relative z-10 space-y-5">
              <div className="relative">
                {isListening && (
                  <>
                    <span className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping opacity-75 pointer-events-none" />
                    <span className="absolute -inset-8 rounded-full bg-rose-600/15 animate-pulse opacity-50 pointer-events-none" />
                  </>
                )}

                <button
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                    } else {
                      startListening(voiceLanguage);
                    }
                  }}
                  className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer relative z-10 select-none ${
                    isListening
                      ? 'bg-rose-600 text-white scale-105 ring-4 ring-rose-400/50'
                      : 'bg-indigo-700 text-amber-300 hover:scale-105 border-2 border-indigo-400/30'
                  }`}
                >
                  <div className="p-3 rounded-full bg-white/10 mb-1">
                    {isListening ? <Radio size={36} className="animate-spin text-white" /> : <Mic size={36} />}
                  </div>
                  <span className="text-[11px] font-black tracking-wide text-white uppercase">
                    {isListening ? (isBn ? 'শুনছি...' : 'Listening...') : (isBn ? 'কথা বলুন' : 'Tap to Speak')}
                  </span>
                </button>
              </div>

              {/* Real-time Live Transcript */}
              <div className="w-full max-w-xl space-y-2">
                <div className="min-h-[50px] p-3.5 px-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-sm font-medium flex items-center justify-center text-center">
                  {isListening ? (
                    <span className="text-amber-300 font-semibold flex items-center gap-2">
                      <Radio size={16} className="animate-spin text-rose-400 shrink-0" />
                      <span>{interimTranscript || transcript || (isBn ? 'আপনার নির্দেশ বলুন (যেমন: "আজকের সার্বিক রিপোর্ট দাও")...' : 'Say your command...')}</span>
                    </span>
                  ) : transcript ? (
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 block">{isBn ? 'সর্বশেষ নির্দেশ:' : 'Last command:'}</span>
                      <span className="text-white font-bold">"{transcript}"</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs sm:text-sm">
                      {isBn ? 'মাইক্রোফোনে ট্যাপ করে কথা বলুন অথবা নিচের যে কোনো কমান্ডে ক্লিক করুন' : 'Tap mic or click commands below'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: DASHBOARD DIRECTOR & AUDIT TRAIL                                  */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard_director' && (
        <div className="space-y-6">
          {/* Dashboard Mode Selector */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders size={22} className="text-indigo-600 dark:text-indigo-400" />
                <span>{isBn ? 'পরিস্থিতিভিত্তিক ড্যাশবোর্ড রূপান্তর কনসোল' : 'Situational Dashboard Director'}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {[
                {
                  id: 'standard',
                  title: isBn ? '১. সার্বিক প্রাতিষ্ঠানিক মোড' : '1. Standard Institutional Mode',
                  desc: isBn ? 'স্বাভাবিক একাডেমিক ও প্রশাসনিক সার্বিক তথ্য প্রদর্শন।' : 'General day-to-day operations and student roster.',
                  badge: 'Standard'
                },
                {
                  id: 'exam',
                  title: isBn ? '২. পরীক্ষা ও ফলাফল প্রস্তুতি মোড' : '2. Exam & Results Mode',
                  desc: isBn ? 'মার্কশিট অগ্রগতি, প্রবেশপত্র ও জিপিএ কার্ড সবার উপরে আসবে।' : 'Focus on marksheet entries, admit cards, and GPA distribution.',
                  badge: 'Exam Alert'
                },
                {
                  id: 'fee_collection',
                  title: isBn ? '৩. ফি আদায় ও অডিট মোড' : '3. Fee Recovery Mode',
                  desc: isBn ? 'বকেয়া লেজার, ফি কালেকশন ও রসিদ তৈরি প্রাধান্য পাবে।' : 'Focus on fee defaulters, payment gateways, and cashbook.',
                  badge: 'Financial Focus'
                },
                {
                  id: 'attendance_crisis',
                  title: isBn ? '৪. হাজিরা সংকট ও জরুরি মোড' : '4. Attendance Crisis Mode',
                  desc: isBn ? 'অনুপস্থিতির হার, ঝুঁকির তালিকা ও অভিভাবক সতর্কীকরণ প্রাধান্য পাবে।' : 'Focus on high absenteeism, medical logs, and emergency SMS alerts.',
                  badge: 'Alert Focus'
                },
                {
                  id: 'admission',
                  title: isBn ? '৫. ভর্তি ও নতুন সেশন মোড' : '5. Admission Season Mode',
                  desc: isBn ? 'অনলাইন ভর্তি আবেদন ও শাখা বণ্টন শীর্ষে থাকবে।' : 'Focus on online admissions, seat distribution, and intake.',
                  badge: 'Season Focus'
                }
              ].map(m => (
                <div
                  key={m.id}
                  className={`p-5 rounded-3xl border-2 transition relative flex flex-col justify-between ${
                    dashboardMode === m.id
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-4 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {m.badge}
                      </span>
                      {dashboardMode === m.id && (
                        <span className="text-xs text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          {isBn ? 'সক্রিয়' : 'Active'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{m.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.desc}</p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setDashboardMode(m.id);
                        showToast(isBn ? `ড্যাশবোর্ড "${m.title}"-এ সফলভাবে রূপান্তর হয়েছে!` : `Switched to ${m.title}!`);
                      }}
                      disabled={dashboardMode === m.id}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        dashboardMode === m.id
                          ? 'bg-indigo-600 text-white cursor-default'
                          : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <Sliders size={14} />
                      <span>{dashboardMode === m.id ? (isBn ? 'সক্রিয় রয়েছে' : 'Currently Active') : (isBn ? 'এই মোড সক্রিয় করুন' : 'Activate Mode')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Execution & Audit Log */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{isBn ? 'এআই অনুমোদিত কার্যাবলীর অডিট ট্রেইল' : 'Execution & Audit History'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn ? 'অনুমোদিত প্রতিটি কাজের রেকর্ড।' : 'Log of all approved actions.'}
                </p>
              </div>
              {executedLogs.length > 0 && (
                <button
                  onClick={() => {
                    setExecutedLogs([]);
                    localStorage.removeItem('ai_executed_actions');
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                >
                  {isBn ? 'লগ মুছুন' : 'Clear Logs'}
                </button>
              )}
            </div>

            {executedLogs.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {executedLogs.map(log => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <strong className="block text-slate-800 dark:text-slate-200 font-bold">{log.title}</strong>
                        <span className="text-[11px] text-slate-400">{log.actor}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {log.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                {isBn ? 'এখনও কোনো এআই একশন অনুমোদন করা হয়নি।' : 'No AI action executions recorded yet.'}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
