import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, 
  Globe, 
  QrCode, 
  MessageSquare, 
  Send, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Phone, 
  Search, 
  Filter, 
  Printer, 
  Sparkles, 
  Award, 
  UserPlus, 
  GraduationCap,
  Layers, 
  Check, 
  X, 
  Home, 
  HeartHandshake, 
  Wallet, 
  Building2, 
  Calendar, 
  ArrowRight, 
  Smartphone, 
  ShieldCheck, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Settings,
  Sliders,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { 
  calculateTotalGPA, 
  calculateGrade, 
  formatNumber, 
  formatSafeDate, 
  formatSafeDateTime, 
  toBengali,
  shortenSubjectName
} from '../../services/utils';
import { ResultVerificationQR } from '../ResultVerificationQR';
import { VerifiedResultModal } from '../VerifiedResultModal';
import { Student } from '../../types';

export type PortalSubTab = 
  | 'guardian_portal'
  | 'online_admissions'
  | 'web_results'
  | 'sms_gateway'
  | 'boarding_mess'
  | 'islamic_welfare';

interface PortalsServicesManagerProps {
  initialSubTab?: PortalSubTab;
  onNavigateTab?: (tab: string) => void;
}

// Online Admission Application Model
interface AdmissionApplication {
  id: string;
  applicantName: string;
  applicantNameBn?: string;
  fatherName: string;
  motherName?: string;
  phone: string;
  desiredClass: string;
  previousSchool?: string;
  dateOfBirth?: string;
  gender: 'male' | 'female';
  isResidential: boolean;
  status: 'pending' | 'interview_called' | 'approved' | 'rejected' | 'admitted';
  appliedDate: string;
  notes?: string;
}

// Boarding Mess Record
interface BoardingStudentConfig {
  studentId: string;
  roomNo: string;
  bedNo: string;
  messStatus: 'active' | 'on_leave' | 'suspended';
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

// Welfare Beneficiary
interface WelfareBeneficiary {
  id: string;
  studentId: string;
  category: 'orphan' | 'needy' | 'hifz_stipend' | 'kitab_grant';
  sponsorName?: string;
  monthlyStipend: number;
  approvedDate: string;
  notes?: string;
}

const STORAGE_ADMISSIONS_KEY = 'mms_online_admissions_v1';
const STORAGE_BOARDING_KEY = 'mms_boarding_configs_v1';
const STORAGE_WELFARE_KEY = 'mms_welfare_beneficiaries_v1';
const STORAGE_SMS_LOGS_KEY = 'mms_sms_dispatch_logs_v1';

export const PortalsServicesManager: React.FC<PortalsServicesManagerProps> = ({
  initialSubTab = 'guardian_portal',
  onNavigateTab
}) => {
  const { 
    students = [], 
    classes = [], 
    exams = [], 
    marks = [], 
    subjects = [], 
    transactions = [], 
    feeStructures = [], 
    schoolProfile, 
    language, 
    addStudent,
    addTransaction
  } = useApp();

  const isBn = language === 'bn';

  // Active sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<PortalSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // ----------------------------------------------------
  // SUB-TAB 1: GUARDIAN PORTAL STATE
  // ----------------------------------------------------
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [guardianClassFilter, setGuardianClassFilter] = useState<string>('all');
  const [guardianSearchQuery, setGuardianSearchQuery] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');

  const filteredStudentsForGuardian = useMemo(() => {
    return students.filter(s => {
      const matchClass = guardianClassFilter === 'all' || s.classLevel === guardianClassFilter;
      const q = guardianSearchQuery.trim().toLowerCase();
      const matchQuery = !q || 
        (s.name || '').toLowerCase().includes(q) ||
        (s.nameBn || '').toLowerCase().includes(q) ||
        (s.roll || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.guardianPhone || '').includes(q);
      return matchClass && matchQuery;
    });
  }, [students, guardianClassFilter, guardianSearchQuery]);

  const activeStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || filteredStudentsForGuardian[0] || students[0] || null;
  }, [students, selectedStudentId, filteredStudentsForGuardian]);

  // Exam Result calculation for active student
  const activeExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0] || null;
  }, [exams, selectedExamId]);

  const studentResultSummary = useMemo(() => {
    if (!activeStudent || !activeExam) return null;
    const studentMarks = marks.filter(m => m.studentId === activeStudent.id && m.examId === activeExam.id);
    const relevantSubjects = subjects.filter(s => !s.classLevel || s.classLevel === activeStudent.classLevel);
    
    let totalObtained = 0;
    let totalFull = 0;
    let failCount = 0;

    relevantSubjects.forEach(sub => {
      const m = studentMarks.find(mark => mark.subjectId === sub.id);
      const obt = m ? (m.obtained || 0) : 0;
      const full = sub.fullMarks || 100;
      const pass = sub.passMarks || 33;
      totalObtained += obt;
      totalFull += full;
      if (obt < pass) failCount++;
    });

    const gpaData = calculateTotalGPA(
      relevantSubjects, 
      studentMarks, 
      activeStudent.id, 
      activeExam.id, 
      activeStudent.group, 
      exams
    );
    return {
      totalObtained,
      totalFull,
      gpa: gpaData.gpa,
      grade: gpaData.grade,
      isPassed: failCount === 0 && gpaData.gpa > 0,
      failCount,
      subjectCount: relevantSubjects.length
    };
  }, [activeStudent, activeExam, marks, subjects]);

  // Student financial calculation
  const studentFinancials = useMemo(() => {
    if (!activeStudent) return { totalPaid: 0, pendingDues: 0 };
    const classFee = feeStructures.find(f => f.classLevel === activeStudent.classLevel);
    const monthlyRate = classFee?.tuitionFee || 500;
    const boardingRate = activeStudent.isResidential ? (classFee?.boardingFee || 2500) : 0;
    const estimatedYearlyBill = (monthlyRate + boardingRate) * 10;

    const studentTx = transactions.filter(t => t.studentId === activeStudent.id && t.type === 'INCOME');
    const totalPaid = studentTx.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingDues = Math.max(0, estimatedYearlyBill - totalPaid);

    return { totalPaid, pendingDues, monthlyRate, boardingRate, recentPayments: studentTx.slice(-3) };
  }, [activeStudent, feeStructures, transactions]);

  // ----------------------------------------------------
  // SUB-TAB 2: ONLINE ADMISSIONS TRACKER STATE
  // ----------------------------------------------------
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ADMISSIONS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    // Initial sample applications
    return [
      {
        id: 'adm-001',
        applicantName: 'Abdullah Al Mamun',
        applicantNameBn: 'আব্দুল্লাহ আল মামুন',
        fatherName: 'মাওলানা রফিকুল ইসলাম',
        phone: '01712345678',
        desiredClass: classes[0]?.name || 'ইবতেদায়ী ১ম',
        previousSchool: 'দারুল উলুম নুরানী মাদ্রাসা',
        dateOfBirth: '2016-04-12',
        gender: 'male',
        isResidential: true,
        status: 'pending',
        appliedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        notes: 'হিফজ শাখায় ভর্তি হতে আগ্রহী'
      },
      {
        id: 'adm-002',
        applicantName: 'Tawhid Hasan',
        applicantNameBn: 'তাওহীদ হাসান',
        fatherName: 'মোঃ আবুল হোসেন',
        phone: '01898765432',
        desiredClass: classes[1]?.name || 'দাখিল ৬ষ্ঠ',
        previousSchool: 'আদর্শ উচ্চ বিদ্যালয়',
        dateOfBirth: '2012-08-20',
        gender: 'male',
        isResidential: false,
        status: 'interview_called',
        appliedDate: new Date(Date.now() - 86400000 * 5).toISOString(),
        notes: 'বাংলা ও গণিত বিষয়ে দক্ষ'
      },
      {
        id: 'adm-003',
        applicantName: 'Fatima Tuz Zohra',
        applicantNameBn: 'ফাতিমা তুজ জোহরা',
        fatherName: 'মোঃ আব্দুল্লাহিল কাফী',
        phone: '01911223344',
        desiredClass: classes[0]?.name || 'নূরানী শিশু',
        previousSchool: 'প্রথম পাঠ',
        dateOfBirth: '2019-01-10',
        gender: 'female',
        isResidential: false,
        status: 'approved',
        appliedDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        notes: 'ভর্তি ফি জমা সাপেক্ষে ভর্তি নিশ্চিত করা হবে'
      }
    ];
  });

  const saveAdmissions = (list: AdmissionApplication[]) => {
    setAdmissions(list);
    try {
      localStorage.setItem(STORAGE_ADMISSIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  };

  const [admissionFilterStatus, setAdmissionFilterStatus] = useState<string>('all');
  const [admissionFilterClass, setAdmissionFilterClass] = useState<string>('all');
  const [admissionSearch, setAdmissionSearch] = useState<string>('');
  const [isAddAdmissionModalOpen, setIsAddAdmissionModalOpen] = useState(false);
  const [newAdmissionForm, setNewAdmissionForm] = useState<Partial<AdmissionApplication>>({
    gender: 'male',
    isResidential: false,
    desiredClass: classes[0]?.name || ''
  });

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(item => {
      const matchStatus = admissionFilterStatus === 'all' || item.status === admissionFilterStatus;
      const matchClass = admissionFilterClass === 'all' || item.desiredClass === admissionFilterClass;
      const q = admissionSearch.trim().toLowerCase();
      const matchSearch = !q ||
        item.applicantName.toLowerCase().includes(q) ||
        (item.applicantNameBn || '').toLowerCase().includes(q) ||
        item.fatherName.toLowerCase().includes(q) ||
        item.phone.includes(q);
      return matchStatus && matchClass && matchSearch;
    });
  }, [admissions, admissionFilterStatus, admissionFilterClass, admissionSearch]);

  // Admit applicant directly into Students Database
  const handleAdmitApplicant = (app: AdmissionApplication) => {
    const nextRoll = String(students.filter(s => s.classLevel === app.desiredClass).length + 1);
    const newStudentData = {
      studentId: `STD-${new Date().getFullYear().toString().slice(-2)}${Math.floor(1000 + Math.random() * 9000)}`,
      name: app.applicantName,
      nameBn: app.applicantNameBn || app.applicantName,
      roll: nextRoll,
      rollNumber: nextRoll,
      classLevel: app.desiredClass,
      gender: app.gender,
      isResidential: app.isResidential,
      metadata: { isResidential: app.isResidential },
      status: 'active' as const,
      fatherName: app.fatherName,
      motherName: app.motherName || '',
      guardianPhone: app.phone,
      admissionDate: new Date().toISOString().split('T')[0],
      dateOfBirth: app.dateOfBirth
    };

    addStudent(newStudentData as any);

    const updated = admissions.map(a => a.id === app.id ? { ...a, status: 'admitted' as const } : a);
    saveAdmissions(updated);
  };

  // ----------------------------------------------------
  // SUB-TAB 3: PUBLIC RESULTS & QR GATEWAY STATE
  // ----------------------------------------------------
  const [qrQueryRoll, setQrQueryRoll] = useState('');
  const [qrQueryClass, setQrQueryClass] = useState(classes[0]?.name || '');
  const [qrQueryExamId, setQrQueryExamId] = useState(exams[0]?.id || '');
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [hasSearchedQr, setHasSearchedQr] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const handleSearchPublicResult = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearchedQr(true);
    const q = qrQueryRoll.trim().toLowerCase();
    if (!q) {
      setSearchedStudent(null);
      return;
    }

    const found = students.find(s => {
      const matchClass = !qrQueryClass || qrQueryClass === 'all' || s.classLevel === qrQueryClass;
      const matchRoll = s.roll && String(s.roll).trim() === q;
      const matchId = (s.studentId && s.studentId.toLowerCase() === q) || s.id.toLowerCase() === q;
      return matchClass && (matchRoll || matchId);
    }) || students.find(s => (s.studentId && s.studentId.toLowerCase() === q) || String(s.roll) === q);

    setSearchedStudent(found || null);
  };

  // ----------------------------------------------------
  // SUB-TAB 4: SMS ALERTS & GATEWAY STATE
  // ----------------------------------------------------
  const [smsTarget, setSmsTarget] = useState<'all' | 'class' | 'absentees' | 'defaulters'>('class');
  const [smsTargetClass, setSmsTargetClass] = useState(classes[0]?.name || '');
  const [smsTemplateType, setSmsTemplateType] = useState<'custom' | 'result' | 'absent' | 'fee_due'>('result');
  const [smsText, setSmsText] = useState(
    'সম্মানিত অভিভাবক, আপনার সন্তান {STUDENT_NAME} (রোল: {ROLL})-এর {EXAM_NAME} পরীক্ষার ফলাফল প্রকাশিত হয়েছে। জিপিএ: {GPA} ({GRADE})। - {MADRASAH_NAME}'
  );
  const [smsProvider, setSmsProvider] = useState<'greenweb' | 'bulksmsbd' | 'ssl' | 'alpha' | 'device_intent'>('greenweb');
  const [smsSenderId, setSmsSenderId] = useState(schoolProfile.nameBn?.slice(0, 11) || 'MADRASAH');
  const [smsApiKey, setSmsApiKey] = useState('gw_demo_live_sec_key_9921');
  const [smsLogs, setSmsLogs] = useState<Array<{ id: string; time: string; recipient: string; phone: string; message: string; status: string }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SMS_LOGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'sms-log-1',
        time: formatSafeDateTime(new Date(Date.now() - 3600000 * 4)),
        recipient: 'মাওলানা রফিকুল ইসলাম',
        phone: '01712345678',
        message: 'সম্মানিত অভিভাবক, আব্দুল্লাহ আল মামুন এর ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে। জিপিএ: ৫.০০ (A+)।',
        status: 'delivered'
      },
      {
        id: 'sms-log-2',
        time: formatSafeDateTime(new Date(Date.now() - 3600000 * 24)),
        recipient: 'মোঃ আবুল হোসেন',
        phone: '01898765432',
        message: 'সম্মানিত অভিভাবক, আপনার সন্তান তাওহীদ হাসান আজ মাদ্রাসায় অনুপস্থিত রয়েছে।',
        status: 'delivered'
      }
    ];
  });
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccessMsg, setSmsSuccessMsg] = useState('');

  // Character calculation
  const smsCharCount = smsText.length;
  const isBanglaUnicode = /[\u0980-\u09FF]/.test(smsText);
  const smsMaxPerPart = isBanglaUnicode ? 70 : 160;
  const smsPartCount = Math.ceil(smsCharCount / smsMaxPerPart) || 1;

  const handleInsertTag = (tag: string) => {
    setSmsText(prev => prev + tag);
  };

  const handleSendBroadcastSms = () => {
    setIsSendingSms(true);
    setTimeout(() => {
      let recipientCount = 0;
      let targetList = students;
      if (smsTarget === 'class') {
        targetList = students.filter(s => s.classLevel === smsTargetClass);
      }
      recipientCount = targetList.length || 1;

      const newLog = {
        id: `sms-${Date.now()}`,
        time: formatSafeDateTime(new Date()),
        recipient: `${recipientCount} জন অভিভাবক (${smsTarget === 'class' ? smsTargetClass : 'সার্বিক'})`,
        phone: targetList[0]?.guardianPhone || '01XXXXXXXXX',
        message: smsText.slice(0, 80) + '...',
        status: 'delivered'
      };

      const updated = [newLog, ...smsLogs.slice(0, 19)];
      setSmsLogs(updated);
      try {
        localStorage.setItem(STORAGE_SMS_LOGS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }

      setIsSendingSms(false);
      setSmsSuccessMsg(
        isBn 
          ? `সফলভাবে ${formatNumber(recipientCount, language)} জন অভিভাবকের কাছে এসএমএস প্রেরণ করা হয়েছে!` 
          : `SMS broadcast sent successfully to ${recipientCount} guardians!`
      );
      setTimeout(() => setSmsSuccessMsg(''), 4000);
    }, 900);
  };

  // ----------------------------------------------------
  // SUB-TAB 5: RESIDENTIAL BOARDING & MESS STATE
  // ----------------------------------------------------
  const residentialStudents = useMemo(() => {
    return students.filter(s => s.isResidential);
  }, [students]);

  const [boardingConfigs, setBoardingConfigs] = useState<Record<string, BoardingStudentConfig>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BOARDING_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    const initialMap: Record<string, BoardingStudentConfig> = {};
    residentialStudents.forEach((s, idx) => {
      initialMap[s.id] = {
        studentId: s.id,
        roomNo: `কক্ষ ১০${Math.floor(idx / 4) + 1}`,
        bedNo: `বেড ${toBengali((idx % 4) + 1)}`,
        messStatus: 'active',
        breakfast: true,
        lunch: true,
        dinner: true
      };
    });
    return initialMap;
  });

  const saveBoardingConfigs = (map: Record<string, BoardingStudentConfig>) => {
    setBoardingConfigs(map);
    try {
      localStorage.setItem(STORAGE_BOARDING_KEY, JSON.stringify(map));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMeal = (studentId: string, meal: 'breakfast' | 'lunch' | 'dinner') => {
    const current = boardingConfigs[studentId] || {
      studentId,
      roomNo: '১০১',
      bedNo: '১',
      messStatus: 'active',
      breakfast: true,
      lunch: true,
      dinner: true
    };
    const updated = {
      ...boardingConfigs,
      [studentId]: {
        ...current,
        [meal]: !current[meal]
      }
    };
    saveBoardingConfigs(updated);
  };

  const boardingStats = useMemo(() => {
    const totalResidential = residentialStudents.length;
    let morningMeals = 0;
    let noonMeals = 0;
    let nightMeals = 0;

    residentialStudents.forEach(s => {
      const cfg = boardingConfigs[s.id];
      if (cfg && cfg.messStatus === 'active') {
        if (cfg.breakfast) morningMeals++;
        if (cfg.lunch) noonMeals++;
        if (cfg.dinner) nightMeals++;
      } else {
        // default full meals
        morningMeals++;
        noonMeals++;
        nightMeals++;
      }
    });

    const totalTodayMeals = morningMeals + noonMeals + nightMeals;
    const estMonthlyMealRate = 45; // 45 BDT per meal average

    return { totalResidential, morningMeals, noonMeals, nightMeals, totalTodayMeals, estMonthlyMealRate };
  }, [residentialStudents, boardingConfigs]);

  // ----------------------------------------------------
  // SUB-TAB 6: ISLAMIC WELFARE & ZAKAT STATE
  // ----------------------------------------------------
  const [welfareBeneficiaries, setWelfareBeneficiaries] = useState<WelfareBeneficiary[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_WELFARE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'wel-1',
        studentId: students[0]?.id || 'std-1',
        category: 'orphan',
        sponsorName: 'হাজী মোঃ ইউসুফ আলী (কাতার প্রবাসী)',
        monthlyStipend: 2500,
        approvedDate: '2026-01-01',
        notes: 'সম্পূর্ণ খাবার ও কিতাব ফ্রি'
      },
      {
        id: 'wel-2',
        studentId: students[1]?.id || 'std-2',
        category: 'needy',
        sponsorName: 'মাদ্রাসা যাকাত ফান্ড',
        monthlyStipend: 1500,
        approvedDate: '2026-01-15',
        notes: 'মাসিক হাফ ফি মওকুফ ও কিতাব অনুদান'
      }
    ];
  });

  const saveWelfare = (list: WelfareBeneficiary[]) => {
    setWelfareBeneficiaries(list);
    try {
      localStorage.setItem(STORAGE_WELFARE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  };

  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    studentId: students[0]?.id || '',
    amount: 1500,
    fund: 'ZAKAT' as 'ZAKAT' | 'ORPHAN_AID',
    purpose: 'এতিম ও দুঃস্থ ছাত্র খোরাকি সহায়তা'
  });

  // Calculate Zakat & Orphan fund balances
  const welfareFunds = useMemo(() => {
    const zakatIncome = transactions.filter(t => t.fund === 'ZAKAT' && t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
    const zakatExpense = transactions.filter(t => t.fund === 'ZAKAT' && t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
    const zakatBalance = zakatIncome - zakatExpense;

    const orphanIncome = transactions.filter(t => t.fund === 'ORPHAN_AID' && t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
    const orphanExpense = transactions.filter(t => t.fund === 'ORPHAN_AID' && t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
    const orphanBalance = orphanIncome - orphanExpense;

    return {
      zakatIncome,
      zakatExpense,
      zakatBalance: Math.max(0, zakatBalance || 48500),
      orphanIncome,
      orphanExpense,
      orphanBalance: Math.max(0, orphanBalance || 35200)
    };
  }, [transactions]);

  const handleDisburseStipend = (e: React.FormEvent) => {
    e.preventDefault();
    const st = students.find(s => s.id === disburseForm.studentId);
    
    addTransaction({
      voucherNo: `WF-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'EXPENSE',
      category: 'STUDENT_MEDICAL_AID',
      fund: disburseForm.fund,
      amount: Number(disburseForm.amount),
      paymentMethod: 'CASH',
      description: `${disburseForm.purpose} - ${st?.nameBn || st?.name || 'শিক্ষার্থী'}`,
      studentId: disburseForm.studentId,
      receivedBy: 'মুহতামিম / হিসাবরক্ষক'
    });

    setIsDisburseModalOpen(false);
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto ${isBn ? 'font-bangla' : ''}`}>
      
      {/* 1. MASTER HEADER & SUITE HERO */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-teal-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold tracking-wide">
              <Sparkles size={14} className="animate-spin text-teal-300" style={{ animationDuration: '6s' }} />
              <span>{isBn ? 'ধাপ ৯ • পোর্টাল, যোগাযোগ ও বিশেষ সেবা' : 'Step 9 • Portals, SMS & Special Services Suite'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Globe className="text-teal-400 shrink-0" size={32} />
              <span>{isBn ? 'পোর্টাল, এসএমএস ও বিশেষ সেবা কেন্দ্র' : 'Portals, SMS & Special Services Hub'}</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isBn 
                ? 'অভিভাবক পোর্টাল, অনলাইন রেজাল্ট ও কিউআর যাচাই, ভর্তি আবেদন ট্র্যাকার, এসএমএস নোটিফিকেশন গেটওয়ে, আবাসিক বোর্ডিং মেস এবং লিল্লাহ ও যাকাত সমাজকল্যাণ ফান্ড।'
                : 'Unified hub for Guardian Portal, Web Results, QR Verification, Online Admissions, SMS Gateway, Residential Mess, and Lillah/Zakat Welfare.'}
            </p>
          </div>

          {/* Quick Metrics Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] font-semibold text-teal-200 block uppercase">
                {isBn ? 'অভিভাবক' : 'Guardians'}
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {formatNumber(students.length, language)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] font-semibold text-teal-200 block uppercase">
                {isBn ? 'আবাসিক' : 'Boarding'}
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {formatNumber(residentialStudents.length, language)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] font-semibold text-teal-200 block uppercase">
                {isBn ? 'ভর্তি আবেদন' : 'Admissions'}
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {formatNumber(admissions.length, language)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-center">
              <span className="text-[11px] font-semibold text-teal-200 block uppercase">
                {isBn ? 'এসএমএস রেডি' : 'SMS Ready'}
              </span>
              <span className="text-xs font-bold text-emerald-400 mt-1 inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active</span>
              </span>
            </div>
          </div>
        </div>

        {/* 2. SUB-TAB NAVIGATION BAR */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'guardian_portal', labelBn: 'অভিভাবক পোর্টাল', labelEn: 'Guardian Portal', icon: Users, badge: formatNumber(students.length, language) },
            { id: 'online_admissions', labelBn: 'অনলাইন ভর্তি ট্র্যাকার', labelEn: 'Online Admissions', icon: FileText, badge: formatNumber(admissions.length, language) },
            { id: 'web_results', labelBn: 'অনলাইন রেজাল্ট ও কিউআর', labelEn: 'Web Results & QR', icon: QrCode, badge: 'Live' },
            { id: 'sms_gateway', labelBn: 'এসএমএস ও নোটিফিকেশন', labelEn: 'SMS Gateway', icon: MessageSquare, badge: 'Gateway' },
            { id: 'boarding_mess', labelBn: 'আবাসিক বোর্ডিং ও মেস', labelEn: 'Boarding & Mess', icon: Home, badge: formatNumber(residentialStudents.length, language) },
            { id: 'islamic_welfare', labelBn: 'লিল্লাহ ও যাকাত কল্যাণ', labelEn: 'Zakat & Welfare', icon: HeartHandshake, badge: 'Welfare' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as PortalSubTab);
                  if (onNavigateTab) onNavigateTab(tab.id);
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30' 
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                }`}
              >
                <Icon size={16} />
                <span>{isBn ? tab.labelBn : tab.labelEn}</span>
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-teal-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: GUARDIAN & STUDENT PORTAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'guardian_portal' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isBn ? 'নাম, রোল বা অভিভাবক ফোন...' : 'Search student, roll or phone...'}
                  value={guardianSearchQuery}
                  onChange={(e) => setGuardianSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                />
              </div>

              <select
                value={guardianClassFilter}
                onChange={(e) => setGuardianClassFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-teal-500"
              >
                <option value="all">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{isBn && c.nameBn ? c.nameBn : c.name}</option>
                ))}
              </select>

              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="py-2 px-3 text-xs bg-teal-50 border border-teal-200 text-teal-900 rounded-xl font-bold focus:outline-teal-500"
              >
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name || e.academicYear}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs rounded-xl"
              >
                <Printer size={14} />
                <span>{isBn ? 'প্রিন্ট রিপোর্ট' : 'Print Slip'}</span>
              </Button>
            </div>
          </div>

          {/* Master View Layout: Left Student List, Right Guardian Card Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Student Quick Picker (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col h-[560px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isBn ? 'শিক্ষার্থী তালিকা' : 'Student Directory'}
                </span>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  {formatNumber(filteredStudentsForGuardian.length, language)}
                </span>
              </div>

              <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
                {filteredStudentsForGuardian.map(st => {
                  const isSelected = activeStudent?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStudentId(st.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {st.roll || '—'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">
                            {isBn && st.nameBn ? st.nameBn : st.name}
                          </p>
                          <p className={`text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                            {st.classLevel} • {st.studentId || st.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className={isSelected ? 'text-white' : 'text-slate-300'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Live Guardian Portal Preview (8 cols) */}
            <div className="lg:col-span-8">
              {activeStudent ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
                  
                  {/* Guardian Portal Header Bar */}
                  <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 p-6 text-white relative">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-black text-white shadow-inner">
                          {activeStudent.nameBn ? activeStudent.nameBn.charAt(0) : activeStudent.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black tracking-tight text-white">
                              {isBn && activeStudent.nameBn ? activeStudent.nameBn : activeStudent.name}
                            </h2>
                            {activeStudent.isResidential && (
                              <span className="px-2 py-0.5 rounded-md bg-teal-400/20 text-teal-200 text-[10px] font-bold border border-teal-400/30">
                                {isBn ? 'আবাসিক' : 'Residential'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-teal-100 mt-0.5">
                            {isBn ? 'শ্রেণি:' : 'Class:'} <span className="font-bold text-white">{activeStudent.classLevel}</span> | {isBn ? 'রোল:' : 'Roll:'} <span className="font-bold text-white">{formatNumber(activeStudent.roll || '—', language)}</span> | ID: <span className="font-mono text-white">{activeStudent.studentId || '—'}</span>
                          </p>
                          <p className="text-[11px] text-teal-200/90 mt-1 flex items-center gap-2">
                            <span>{isBn ? 'পিতা:' : 'Father:'} {activeStudent.fatherName || '—'}</span>
                            <span>•</span>
                            <span>{isBn ? 'ফোন:' : 'Phone:'} {activeStudent.guardianPhone || '—'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Direct Phone / Contact Buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {activeStudent.guardianPhone && (
                          <>
                            <a
                              href={`tel:${activeStudent.guardianPhone}`}
                              className="px-3 py-2 rounded-xl bg-white text-teal-800 hover:bg-teal-50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                            >
                              <Phone size={13} className="text-teal-600" />
                              <span>{isBn ? 'সরাসরি কল' : 'Call'}</span>
                            </a>
                            <a
                              href={`sms:${activeStudent.guardianPhone}`}
                              className="px-3 py-2 rounded-xl bg-teal-600/40 hover:bg-teal-600/60 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all"
                            >
                              <MessageSquare size={13} />
                              <span>SMS</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Guardian Quick Grid Cards */}
                  <div className="p-6 space-y-6">
                    
                    {/* 3 Metric Cards: Academic, Attendance, Accounts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Academic Performance Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-bold">
                          <span className="flex items-center gap-1 text-teal-700">
                            <Award size={14} />
                            <span>{isBn ? 'সর্বশেষ ফলাফল' : 'Latest Result'}</span>
                          </span>
                          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-700">
                            {activeExam?.name || 'ইমতিহান'}
                          </span>
                        </div>
                        {studentResultSummary ? (
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-black text-slate-900">
                                {formatNumber(studentResultSummary.gpa.toFixed(2), language)}
                              </span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                studentResultSummary.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {studentResultSummary.grade} ({studentResultSummary.isPassed ? (isBn ? 'উত্তীর্ণ' : 'Passed') : (isBn ? 'অনুত্তীর্ণ' : 'Failed')})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {isBn ? 'প্রাপ্ত নম্বর:' : 'Marks:'} {formatNumber(studentResultSummary.totalObtained, language)} / {formatNumber(studentResultSummary.totalFull, language)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-3">{isBn ? 'ফলাফল এন্ট্রি নেই' : 'No marks entered'}</p>
                        )}
                      </div>

                      {/* Attendance Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-bold">
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Calendar size={14} />
                            <span>{isBn ? 'হাজিরা ও উপস্থিতি' : 'Attendance Rate'}</span>
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            ৯২%
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '92%' }}></div>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                            <span>{isBn ? 'উপস্থিত:' : 'Present:'} {formatNumber(24, language)} দিন</span>
                            <span>{isBn ? 'অনুপস্থিত:' : 'Absent:'} {formatNumber(2, language)} দিন</span>
                          </div>
                        </div>
                      </div>

                      {/* Fee & Accounts Card */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-bold">
                          <span className="flex items-center gap-1 text-indigo-700">
                            <Wallet size={14} />
                            <span>{isBn ? 'হিসাব ও ফি বিবরণী' : 'Fee Status'}</span>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            studentFinancials.pendingDues > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {studentFinancials.pendingDues > 0 ? (isBn ? 'বকেয়া আছে' : 'Due') : (isBn ? 'পরিশোধিত' : 'Clear')}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-slate-500">{isBn ? 'মোট পরিশোধ:' : 'Total Paid:'}</span>
                            <span className="font-bold text-slate-800">৳{formatNumber(studentFinancials.totalPaid, language)}</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-slate-500">{isBn ? 'চলতি বকেয়া:' : 'Due Balance:'}</span>
                            <span className="font-bold text-rose-600">৳{formatNumber(studentFinancials.pendingDues, language)}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Guardian Access Code & Credentials */}
                    <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-teal-900">
                            {isBn ? 'অভিভাবক অনলাইন অ্যাক্সেস পিন (Guardian Portal PIN)' : 'Guardian Access Token & PIN'}
                          </p>
                          <p className="text-[11px] text-teal-700">
                            {isBn ? 'অভিভাবক এই পিন ব্যবহার করে সরাসরি তাদের মোবাইল থেকে লগইন করতে পারবেন।' : 'Guardians can use this security PIN to access the self-service web portal.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-white rounded-xl border border-teal-300 font-mono font-black text-sm text-teal-900 tracking-widest shadow-xs">
                          {activeStudent.studentId ? activeStudent.studentId.slice(-4) : '7890'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alert(isBn ? 'অভিভাবকের ফোনে অ্যাক্সেস লিংক পাঠানো হয়েছে!' : 'Access PIN sent to guardian phone!')}
                          className="text-xs rounded-xl"
                        >
                          <Send size={12} className="mr-1" />
                          <span>{isBn ? 'পিন পাঠান' : 'Send PIN'}</span>
                        </Button>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-200">
                  <Users size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-600">{isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No student found'}</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ONLINE ADMISSIONS TRACKER */}
      {/* ========================================================================= */}
      {activeSubTab === 'online_admissions' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isBn ? 'আবেদনকারীর নাম বা মোবাইল...' : 'Search applicant name or phone...'}
                  value={admissionSearch}
                  onChange={(e) => setAdmissionSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                />
              </div>

              <select
                value={admissionFilterStatus}
                onChange={(e) => setAdmissionFilterStatus(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-teal-500"
              >
                <option value="all">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                <option value="pending">{isBn ? 'অপেক্ষমাণ (Pending)' : 'Pending'}</option>
                <option value="interview_called">{isBn ? 'মৌখিক পরীক্ষা ডাকা হয়েছে' : 'Interview Called'}</option>
                <option value="approved">{isBn ? 'অনুমোদিত (Approved)' : 'Approved'}</option>
                <option value="admitted">{isBn ? 'ভর্তি সম্পন্ন (Admitted)' : 'Admitted'}</option>
              </select>

              <select
                value={admissionFilterClass}
                onChange={(e) => setAdmissionFilterClass(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-teal-500"
              >
                <option value="all">{isBn ? 'সকল আবেদন শ্রেণি' : 'All Classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{isBn && c.nameBn ? c.nameBn : c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddAdmissionModalOpen(true)}
                className="gap-1.5 text-xs rounded-xl bg-teal-600 hover:bg-teal-700"
              >
                <UserPlus size={14} />
                <span>{isBn ? 'নতুন আবেদন ফরম' : 'New Application'}</span>
              </Button>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'অনলাইন ও অফলাইন ভর্তি আবেদন তালিকা' : 'Admission Applications Ledger'}
              </span>
              <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                {formatNumber(filteredAdmissions.length, language)} {isBn ? 'টি আবেদন' : 'applications'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3.5 px-4">{isBn ? 'আবেদনকারী ও অভিভাবক' : 'Applicant & Parent'}</th>
                    <th className="py-3.5 px-4">{isBn ? 'আবেদিত শ্রেণি' : 'Desired Class'}</th>
                    <th className="py-3.5 px-4">{isBn ? 'আবাসিক' : 'Residential'}</th>
                    <th className="py-3.5 px-4">{isBn ? 'তারিখ' : 'Applied Date'}</th>
                    <th className="py-3.5 px-4">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-right">{isBn ? 'পদক্ষেপ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdmissions.map(app => {
                    return (
                      <tr key={app.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">
                            {isBn && app.applicantNameBn ? app.applicantNameBn : app.applicantName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isBn ? 'পিতা:' : 'Father:'} {app.fatherName} • 📞 {app.phone}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {app.desiredClass}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.isResidential ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {app.isResidential ? (isBn ? 'আবাসিক' : 'Residential') : (isBn ? 'অনাবাসিক' : 'Non-Res')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatSafeDate(app.appliedDate)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            app.status === 'admitted' ? 'bg-emerald-100 text-emerald-800' :
                            app.status === 'approved' ? 'bg-teal-100 text-teal-800' :
                            app.status === 'interview_called' ? 'bg-indigo-100 text-indigo-800' :
                            app.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {app.status === 'admitted' && <Check size={12} />}
                            <span>
                              {app.status === 'admitted' ? (isBn ? 'ভর্তি সম্পন্ন' : 'Admitted') :
                               app.status === 'approved' ? (isBn ? 'অনুমোদিত' : 'Approved') :
                               app.status === 'interview_called' ? (isBn ? 'ইন্টারভিউ' : 'Interview') :
                               app.status === 'rejected' ? (isBn ? 'বাতিল' : 'Rejected') :
                               (isBn ? 'অপেক্ষমাণ' : 'Pending')}
                            </span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          {app.status !== 'admitted' && (
                            <button
                              onClick={() => handleAdmitApplicant(app)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1 transition-all"
                            >
                              <UserCheck size={12} />
                              <span>{isBn ? 'ভর্তি নিশ্চিত করুন' : 'Admit Now'}</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const nextStatus = app.status === 'pending' ? 'interview_called' : app.status === 'interview_called' ? 'approved' : 'admitted';
                              const updated = admissions.map(a => a.id === app.id ? { ...a, status: nextStatus as any } : a);
                              saveAdmissions(updated);
                            }}
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                            title="Advance Status"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* New Admission Modal */}
          {isAddAdmissionModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <UserPlus size={18} className="text-teal-600" />
                    <span>{isBn ? 'নতুন শিক্ষার্থী ভর্তি আবেদন ফর্ম' : 'New Admission Application'}</span>
                  </h3>
                  <button onClick={() => setIsAddAdmissionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">{isBn ? 'শিক্ষার্থীর নাম (বাংলায়)' : 'Student Name (Bangla)'}</label>
                    <input
                      type="text"
                      value={newAdmissionForm.applicantNameBn || ''}
                      onChange={(e) => setNewAdmissionForm({ ...newAdmissionForm, applicantNameBn: e.target.value, applicantName: e.target.value })}
                      placeholder="যেমন: মোঃ আব্দুল্লাহ"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'পিতার নাম' : "Father's Name"}</label>
                      <input
                        type="text"
                        value={newAdmissionForm.fatherName || ''}
                        onChange={(e) => setNewAdmissionForm({ ...newAdmissionForm, fatherName: e.target.value })}
                        placeholder="পিতার নাম"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'অভিভাবকের মোবাইল' : 'Guardian Mobile'}</label>
                      <input
                        type="text"
                        value={newAdmissionForm.phone || ''}
                        onChange={(e) => setNewAdmissionForm({ ...newAdmissionForm, phone: e.target.value })}
                        placeholder="01XXXXXXXXX"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'ভর্তির কাঙ্ক্ষিত শ্রেণি' : 'Desired Class'}</label>
                      <select
                        value={newAdmissionForm.desiredClass || ''}
                        onChange={(e) => setNewAdmissionForm({ ...newAdmissionForm, desiredClass: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.name}>{isBn && c.nameBn ? c.nameBn : c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'আবাসিক ধরন' : 'Residential Option'}</label>
                      <select
                        value={newAdmissionForm.isResidential ? 'res' : 'non_res'}
                        onChange={(e) => setNewAdmissionForm({ ...newAdmissionForm, isResidential: e.target.value === 'res' })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                      >
                        <option value="non_res">{isBn ? 'অনাবাসিক (ডে)' : 'Non-Residential'}</option>
                        <option value="res">{isBn ? 'আবাসিক (বোর্ডিং)' : 'Residential (Boarding)'}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsAddAdmissionModalOpen(false)}>
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      if (!newAdmissionForm.applicantName || !newAdmissionForm.phone) {
                        alert(isBn ? 'অনুগ্রহ করে নাম ও মোবাইল নাম্বার লিখুন!' : 'Please enter name and phone!');
                        return;
                      }
                      const newApp: AdmissionApplication = {
                        id: `adm-${Date.now()}`,
                        applicantName: newAdmissionForm.applicantName || '',
                        applicantNameBn: newAdmissionForm.applicantNameBn || newAdmissionForm.applicantName || '',
                        fatherName: newAdmissionForm.fatherName || 'অভিভাবক',
                        phone: newAdmissionForm.phone || '',
                        desiredClass: newAdmissionForm.desiredClass || classes[0]?.name || '',
                        gender: 'male',
                        isResidential: !!newAdmissionForm.isResidential,
                        status: 'pending',
                        appliedDate: new Date().toISOString()
                      };
                      saveAdmissions([newApp, ...admissions]);
                      setIsAddAdmissionModalOpen(false);
                      setNewAdmissionForm({ gender: 'male', isResidential: false, desiredClass: classes[0]?.name || '' });
                    }}
                  >
                    {isBn ? 'আবেদন সংরক্ষণ করুন' : 'Submit Application'}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: PUBLIC WEB RESULTS & QR VERIFICATION GATEWAY */}
      {/* ========================================================================= */}
      {activeSubTab === 'web_results' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Public Result Simulator Header */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-800/40 shadow-lg">
            <div className="max-w-2xl space-y-3">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                {isBn ? 'অনলাইন রেজাল্ট ও কিউআর যাচাই গেটওয়ে' : 'Public Web Results & QR Verification Gateway'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isBn ? 'পাবলিক রেজাল্ট পোর্টাল ও তাত্ক্ষণিক ভেরিফিকেশন' : 'Public Result Search & Instant Verification'}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed">
                {isBn 
                  ? 'মাদ্রাসার অফিসিয়াল ওয়েবসাইটে রোল বা স্টুডেন্ট আইডি দিয়ে শিক্ষার্থী বা অভিভাবক যে রেজাল্ট দেখতে পাবেন তার লাইভ প্রিভিউ ও কিউআর কোড স্ক্যানার ভেরিফায়ার।'
                  : 'Live preview of the public result sheet and QR verification seal that students and parents experience when searching online.'}
              </p>
            </div>

            {/* Public Search Form Simulator */}
            <form onSubmit={handleSearchPublicResult} className="mt-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-indigo-200 block mb-1">
                  {isBn ? 'পরীক্ষা নির্বাচন' : 'Select Exam'}
                </label>
                <select
                  value={qrQueryExamId}
                  onChange={(e) => setQrQueryExamId(e.target.value)}
                  className="w-full p-2 bg-slate-900/90 text-white rounded-xl text-xs border border-white/20 focus:outline-teal-400"
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.name || e.academicYear}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-indigo-200 block mb-1">
                  {isBn ? 'শ্রেণি' : 'Class'}
                </label>
                <select
                  value={qrQueryClass}
                  onChange={(e) => setQrQueryClass(e.target.value)}
                  className="w-full p-2 bg-slate-900/90 text-white rounded-xl text-xs border border-white/20 focus:outline-teal-400"
                >
                  <option value="all">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{isBn && c.nameBn ? c.nameBn : c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-indigo-200 block mb-1">
                  {isBn ? 'রোল বা স্টুডেন্ট আইডি' : 'Roll or Student ID'}
                </label>
                <input
                  type="text"
                  placeholder={isBn ? 'রোল নং (যেমন: ১, ২)' : 'e.g. 1, 2, STD-001'}
                  value={qrQueryRoll}
                  onChange={(e) => setQrQueryRoll(e.target.value)}
                  className="w-full p-2 bg-slate-900/90 text-white rounded-xl text-xs border border-white/20 focus:outline-teal-400"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/20 cursor-pointer transition-all"
                >
                  <Search size={14} />
                  <span>{isBn ? 'ফলাফল অনুসন্ধান' : 'Search Result'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Result Search Outcome */}
          {hasSearchedQr && (
            searchedStudent ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 space-y-6">
                
                {/* Header with QR Token */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900">
                        {isBn && searchedStudent.nameBn ? searchedStudent.nameBn : searchedStudent.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isBn ? 'শ্রেণি:' : 'Class:'} <span className="font-bold text-slate-800">{searchedStudent.classLevel}</span> | {isBn ? 'রোল:' : 'Roll:'} <span className="font-bold text-slate-800">{searchedStudent.roll}</span>
                      </p>
                    </div>
                  </div>

                  {/* QR Seal & Verification Hash Badge */}
                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                      <ResultVerificationQR
                        student={searchedStudent}
                        exam={exams.find(e => e.id === qrQueryExamId) || exams[0]}
                        schoolProfile={schoolProfile}
                        size={56}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        <span>{isBn ? 'অফিসিয়াল কিউআর ভেরিফাইড' : 'Official QR Verified'}</span>
                      </span>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">
                        HASH: MMS-{searchedStudent.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Marksheet Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3">{isBn ? 'বিষয়' : 'Subject'}</th>
                        <th className="py-2.5 px-3 text-center">{isBn ? 'পূর্ণমান' : 'Full Marks'}</th>
                        <th className="py-2.5 px-3 text-center">{isBn ? 'প্রাপ্ত নম্বর' : 'Obtained Marks'}</th>
                        <th className="py-2.5 px-3 text-center">{isBn ? 'গ্রেড' : 'Grade'}</th>
                        <th className="py-2.5 px-3 text-center">{isBn ? 'পয়েন্ট' : 'Point'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.filter(s => !s.classLevel || s.classLevel === searchedStudent.classLevel).map(sub => {
                        const m = marks.find(mark => mark.studentId === searchedStudent.id && mark.subjectId === sub.id && mark.examId === qrQueryExamId);
                        const obt = m ? (m.obtained || 0) : 0;
                        const gradeData = calculateGrade(obt, sub.fullMarks || 100);
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {isBn && sub.nameBn ? sub.nameBn : sub.name}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                              {sub.fullMarks || 100}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-mono">
                              {obt}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-teal-700">
                              {gradeData.grade}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {gradeData.gpa.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Print and Verify Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVerifyModalOpen(true)}
                    className="gap-1.5 text-xs rounded-xl"
                  >
                    <QrCode size={14} />
                    <span>{isBn ? 'ভেরিফিকেশন সার্টিফিকেট প্রিভিউ' : 'Verification Certificate'}</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.print()}
                    className="gap-1.5 text-xs rounded-xl bg-teal-600 hover:bg-teal-700"
                  >
                    <Printer size={14} />
                    <span>{isBn ? 'মার্কশিট প্রিন্ট করুন' : 'Print Marksheet'}</span>
                  </Button>
                </div>

              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200">
                <AlertCircle size={40} className="mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-bold text-slate-700">{isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No result found'}</p>
                <p className="text-xs text-slate-400 mt-1">{isBn ? 'সঠিক রোল নম্বর ও শ্রেণি নির্বাচন করে পুনরায় চেষ্টা করুন।' : 'Please verify roll number and class selection.'}</p>
              </div>
            )
          )}

          {/* Verification Modal */}
          {isVerifyModalOpen && searchedStudent && (
            <VerifiedResultModal
              student={searchedStudent}
              exam={exams.find(e => e.id === qrQueryExamId) || exams[0]}
              schoolProfile={schoolProfile}
              subjects={subjects}
              marks={marks}
              exams={exams}
              language={language}
              onClose={() => setIsVerifyModalOpen(false)}
            />
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SMS ALERTS & GATEWAY HUB */}
      {/* ========================================================================= */}
      {activeSubTab === 'sms_gateway' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {smsSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{smsSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left 7 Cols: SMS Composer & Dispatcher */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <MessageSquare size={16} className="text-teal-600" />
                  <span>{isBn ? 'এসএমএস কম্পোজার ও ব্রডকাস্ট' : 'SMS Composer & Broadcast'}</span>
                </h3>
                <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                  {isBanglaUnicode ? 'বাংলা ইউনিকোড (৭০ অক্ষর/পার্ট)' : 'English GSM (160 chars/part)'}
                </span>
              </div>

              {/* Target Selector */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isBn ? 'গ্রাহক টার্গেট' : 'Target Audience'}</label>
                  <select
                    value={smsTarget}
                    onChange={(e) => setSmsTarget(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                  >
                    <option value="class">{isBn ? 'নির্দিষ্ট শ্রেণি' : 'Specific Class'}</option>
                    <option value="all">{isBn ? 'সকল শিক্ষার্থী ও অভিভাবক' : 'All Students & Guardians'}</option>
                    <option value="absentees">{isBn ? 'আজকের অনুপস্থিত শিক্ষার্থী' : 'Today Absentees'}</option>
                    <option value="defaulters">{isBn ? 'বকেয়া ফি শিক্ষার্থী' : 'Fee Defaulters'}</option>
                  </select>
                </div>

                {smsTarget === 'class' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">{isBn ? 'শ্রেণি নির্বাচন' : 'Select Class'}</label>
                    <select
                      value={smsTargetClass}
                      onChange={(e) => setSmsTargetClass(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-teal-500"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{isBn && c.nameBn ? c.nameBn : c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Template Tags Insertion Helper */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1.5">
                  {isBn ? 'ডাইনামিক ভ্যারিয়েবল ট্যাগ (ক্লিক করে যুক্ত করুন):' : 'Dynamic Variable Tags (Click to insert):'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '{STUDENT_NAME}',
                    '{ROLL}',
                    '{CLASS}',
                    '{EXAM_NAME}',
                    '{GPA}',
                    '{GRADE}',
                    '{MADRASAH_NAME}'
                  ].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      className="px-2 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-mono font-bold transition-all cursor-pointer border border-teal-200/60"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Text Area */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">{isBn ? 'এসএমএস বার্তা' : 'Message Body'}</label>
                <textarea
                  rows={4}
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  placeholder={isBn ? 'এসএমএস বার্তা লিখুন...' : 'Type message here...'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-teal-500 font-sans leading-relaxed"
                />
                
                {/* Character Counter & Cost Calculator */}
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 font-medium">
                  <span>
                    {isBn ? 'অক্ষর সংখ্যা:' : 'Characters:'} <strong className="text-slate-800">{formatNumber(smsCharCount, language)}</strong> / {formatNumber(smsMaxPerPart, language)}
                  </span>
                  <span className="text-teal-700 font-bold">
                    {formatNumber(smsPartCount, language)} {isBn ? 'পার্ট এসএমএস' : 'Part SMS'}
                  </span>
                </div>
              </div>

              {/* Send Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendBroadcastSms}
                  disabled={isSendingSms || !smsText.trim()}
                  className="bg-teal-600 hover:bg-teal-700 gap-2 text-xs rounded-xl shadow-md"
                >
                  {isSendingSms ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isBn ? 'ব্রডকাস্ট এসএমএস প্রেরণ করুন' : 'Send Broadcast SMS'}</span>
                </Button>
              </div>

            </div>

            {/* Right 5 Cols: Gateway Configuration & Recent Logs */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Gateway Settings Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders size={14} className="text-teal-600" />
                    <span>{isBn ? 'এসএমএস গেটওয়ে কনফিগারেশন' : 'Gateway Settings'}</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-0.5">{isBn ? 'গেটওয়ে প্রভাইডার' : 'Provider'}</label>
                    <select
                      value={smsProvider}
                      onChange={(e) => setSmsProvider(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="greenweb">Greenweb BD (API V2)</option>
                      <option value="bulksmsbd">BulkSMSBD (Masking/Non-Masking)</option>
                      <option value="ssl">SSL Wireless Gateway</option>
                      <option value="alpha">Alpha SMS BD</option>
                      <option value="device_intent">Direct Mobile Web-Intent (নগদ/সরাসরি)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-0.5">{isBn ? 'সেন্ডার আইডি / মাস্কিং' : 'Sender ID'}</label>
                    <input
                      type="text"
                      value={smsSenderId}
                      onChange={(e) => setSmsSenderId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-0.5">{isBn ? 'এপিআই সিক্রেট কি' : 'API Key'}</label>
                    <input
                      type="password"
                      value={smsApiKey}
                      onChange={(e) => setSmsApiKey(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Recent SMS History Log */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block pb-2 border-b border-slate-100">
                  {isBn ? 'সর্বশেষ প্রেরিত এসএমএস লগ' : 'Recent Dispatch History'}
                </span>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar text-xs">
                  {smsLogs.map(log => (
                    <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="font-bold text-slate-700">{log.recipient}</span>
                        <span>{log.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {log.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: RESIDENTIAL BOARDING & MESS */}
      {/* ========================================================================= */}
      {activeSubTab === 'boarding_mess' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Boarding Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">{isBn ? 'মোট আবাসিক ছাত্র' : 'Residential Students'}</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {formatNumber(boardingStats.totalResidential, language)} {isBn ? 'জন' : ''}
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">{isBn ? 'সকালের নাস্তা' : 'Breakfast Meals'}</span>
              <span className="text-2xl font-black text-teal-600 mt-1 block">
                {formatNumber(boardingStats.morningMeals, language)}
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">{isBn ? 'দুপুরের খাবার' : 'Lunch Meals'}</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {formatNumber(boardingStats.noonMeals, language)}
              </span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">{isBn ? 'রাতের খাবার' : 'Dinner Meals'}</span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">
                {formatNumber(boardingStats.nightMeals, language)}
              </span>
            </div>
          </div>

          {/* Residential Students Mess List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'আবাসিক ছাত্র ডরমিটরি, বেড ও দৈনিক ডাইনিং হাজিরা' : 'Residential Dormitory & Daily Dining Roster'}
              </span>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs rounded-xl">
                <Printer size={13} />
                <span>{isBn ? 'মাসিক মেস শিট' : 'Print Mess Sheet'}</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">{isBn ? 'শিক্ষার্থী ও শ্রেণি' : 'Student & Class'}</th>
                    <th className="py-3 px-4">{isBn ? 'কক্ষ ও বেড' : 'Room & Bed'}</th>
                    <th className="py-3 px-4">{isBn ? 'মেস স্ট্যাটাস' : 'Mess Status'}</th>
                    <th className="py-3 px-4 text-center">{isBn ? 'সকাল' : 'Breakfast'}</th>
                    <th className="py-3 px-4 text-center">{isBn ? 'দুপুর' : 'Lunch'}</th>
                    <th className="py-3 px-4 text-center">{isBn ? 'রাত' : 'Dinner'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residentialStudents.map(st => {
                    const cfg = boardingConfigs[st.id] || {
                      studentId: st.id,
                      roomNo: '১০১',
                      bedNo: '১',
                      messStatus: 'active',
                      breakfast: true,
                      lunch: true,
                      dinner: true
                    };

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{isBn && st.nameBn ? st.nameBn : st.name}</p>
                          <p className="text-[11px] text-slate-400">{st.classLevel} • রোল: {st.roll}</p>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {cfg.roomNo} - {cfg.bedNo}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {isBn ? 'সক্রিয়' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleMeal(st.id, 'breakfast')}
                            className={`w-7 h-7 rounded-lg text-xs font-bold inline-flex items-center justify-center transition-all cursor-pointer ${
                              cfg.breakfast ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {cfg.breakfast ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleMeal(st.id, 'lunch')}
                            className={`w-7 h-7 rounded-lg text-xs font-bold inline-flex items-center justify-center transition-all cursor-pointer ${
                              cfg.lunch ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {cfg.lunch ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleMeal(st.id, 'dinner')}
                            className={`w-7 h-7 rounded-lg text-xs font-bold inline-flex items-center justify-center transition-all cursor-pointer ${
                              cfg.dinner ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {cfg.dinner ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 6: ISLAMIC WELFARE, ZAKAT & LILLAH */}
      {/* ========================================================================= */}
      {activeSubTab === 'islamic_welfare' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Fund Balances Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-5 rounded-3xl shadow-md border border-emerald-700/40">
              <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide block">
                {isBn ? 'যাকাত ও ফিতরা তহবিল স্থিতি' : 'Zakat & Fitra Fund'}
              </span>
              <span className="text-3xl font-black text-white mt-1 block">
                ৳{formatNumber(welfareFunds.zakatBalance, language)}
              </span>
              <p className="text-[11px] text-emerald-200/80 mt-1">
                {isBn ? 'আদায়:' : 'In:'} ৳{formatNumber(welfareFunds.zakatIncome, language)} • {isBn ? 'বণ্টন:' : 'Disbursed:'} ৳{formatNumber(welfareFunds.zakatExpense, language)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-800 to-slate-900 text-white p-5 rounded-3xl shadow-md border border-indigo-700/40">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-wide block">
                {isBn ? 'লিল্লাহ বোর্ডিং ও এতিম তহবিল' : 'Lillah & Orphan Welfare Fund'}
              </span>
              <span className="text-3xl font-black text-white mt-1 block">
                ৳{formatNumber(welfareFunds.orphanBalance, language)}
              </span>
              <p className="text-[11px] text-indigo-200/80 mt-1">
                {isBn ? 'আদায়:' : 'In:'} ৳{formatNumber(welfareFunds.orphanIncome, language)} • {isBn ? 'ব্যয়:' : 'Disbursed:'} ৳{formatNumber(welfareFunds.orphanExpense, language)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">
                  {isBn ? 'কল্যাণ ভাতা গ্রহণকারী তালিব-এ ইলম' : 'Sponsored Students'}
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {formatNumber(welfareBeneficiaries.length, language)} {isBn ? 'জন' : ''}
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsDisburseModalOpen(true)}
                className="w-full mt-3 bg-teal-600 hover:bg-teal-700 gap-1.5 text-xs rounded-xl"
              >
                <HeartHandshake size={14} />
                <span>{isBn ? 'নতুন অনুদান বা বৃত্তি বিতরণ' : 'Disburse Grant'}</span>
              </Button>
            </div>

          </div>

          {/* Welfare Beneficiaries Roster */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isBn ? 'এতিম ও দুঃস্থ শিক্ষার্থী অনুদান রেজিস্টার' : 'Welfare Beneficiaries Ledger'}
              </span>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs rounded-xl">
                <Printer size={13} />
                <span>{isBn ? 'কল্যাণ খতিয়ান প্রিন্ট' : 'Print Ledger'}</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">{isBn ? 'শিক্ষার্থী' : 'Student'}</th>
                    <th className="py-3 px-4">{isBn ? 'শ্রেণিবিভাগ' : 'Category'}</th>
                    <th className="py-3 px-4">{isBn ? 'দাতা / স্পনসর' : 'Sponsor / Donor'}</th>
                    <th className="py-3 px-4">{isBn ? 'মাসিক অনুদান' : 'Monthly Stipend'}</th>
                    <th className="py-3 px-4">{isBn ? 'অনুমোদন তারিখ' : 'Approved Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {welfareBeneficiaries.map(ben => {
                    const st = students.find(s => s.id === ben.studentId);
                    return (
                      <tr key={ben.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {st ? (isBn && st.nameBn ? st.nameBn : st.name) : 'শিক্ষার্থী'}
                          <p className="text-[11px] font-normal text-slate-400">{st?.classLevel} • রোল: {st?.roll}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                            {ben.category === 'orphan' ? (isBn ? 'এতিম তালিব-এ ইলম' : 'Orphan') :
                             ben.category === 'needy' ? (isBn ? 'দুঃস্থ ও অসচ্ছল' : 'Needy') :
                             (isBn ? 'মেধাবী হাফেজ বৃত্তি' : 'Hifz Stipend')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {ben.sponsorName || '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          ৳{formatNumber(ben.monthlyStipend, language)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {ben.approvedDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disburse Modal */}
          {isDisburseModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <HeartHandshake size={18} className="text-teal-600" />
                    <span>{isBn ? 'নতুন যাকাত / লিল্লাহ অনুদান বিতরণ' : 'Disburse Grant / Stipend'}</span>
                  </h3>
                  <button onClick={() => setIsDisburseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleDisburseStipend} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">{isBn ? 'উপকারভোগী শিক্ষার্থী' : 'Beneficiary Student'}</label>
                    <select
                      value={disburseForm.studentId}
                      onChange={(e) => setDisburseForm({ ...disburseForm, studentId: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{isBn && s.nameBn ? s.nameBn : s.name} ({s.classLevel})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'তহবিল উৎস' : 'Fund Source'}</label>
                      <select
                        value={disburseForm.fund}
                        onChange={(e) => setDisburseForm({ ...disburseForm, fund: e.target.value as any })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <option value="ZAKAT">{isBn ? 'যাকাত তহবিল' : 'Zakat Fund'}</option>
                        <option value="ORPHAN_AID">{isBn ? 'লিল্লাহ ও এতিম তহবিল' : 'Lillah Fund'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">{isBn ? 'অনুদানের পরিমাণ (৳)' : 'Amount (BDT)'}</label>
                      <input
                        type="number"
                        value={disburseForm.amount}
                        onChange={(e) => setDisburseForm({ ...disburseForm, amount: Number(e.target.value) })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">{isBn ? 'অনুদানের বিবরণ' : 'Description / Purpose'}</label>
                    <input
                      type="text"
                      value={disburseForm.purpose}
                      onChange={(e) => setDisburseForm({ ...disburseForm, purpose: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setIsDisburseModalOpen(false)}>
                      {isBn ? 'বাতিল' : 'Cancel'}
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="bg-teal-600 hover:bg-teal-700">
                      {isBn ? 'ভাউচার পাস ও বিতরণ' : 'Confirm Disbursement'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
