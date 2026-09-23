import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Receipt, 
  Check, 
  Search, 
  Sparkles, 
  Printer, 
  Layers, 
  UserCheck, 
  Calendar,
  CreditCard,
  Percent,
  Plus,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  Clock,
  Phone,
  Copy,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FileText,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Scale
} from 'lucide-react';
import { 
  FinanceTransaction, 
  ClassFeeStructure, 
  Student, 
  SchoolClass 
} from '../../types';
import { formatBanglaNumber, generateVoucherNo, amountToBengaliWords } from '../../services/utils';
import { Button } from '../ui/Button';

// Payment Behavioral Profile Types
export type PaymentBehaviorType = 'REGULAR' | 'DELAYED' | 'PARTIAL' | 'CHRONIC_DUE' | 'SCHOLARSHIP';

interface StudentFeeCollectionProps {
  students: Student[];
  classes: SchoolClass[];
  feeStructures: ClassFeeStructure[];
  transactions: FinanceTransaction[];
  language: 'en' | 'bn';
  onAddTransaction: (tx: Omit<FinanceTransaction, 'id' | 'createdAt'>) => FinanceTransaction;
  onShowReceipt: (tx: FinanceTransaction) => void;
  showToast: (msg: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const StudentFeeCollection: React.FC<StudentFeeCollectionProps> = ({
  students,
  classes,
  feeStructures,
  transactions,
  language,
  onAddTransaction,
  onShowReceipt,
  showToast,
  onNavigateTab,
}) => {
  const isBn = language === 'bn';

  // Active Sub-Tab View
  const [activeSubTab, setActiveSubTab] = useState<
    'collect' | 'dues' | 'salary-bridge' | 'class-breakdown' | 'history'
  >('collect');

  // Form State for Quick Collection
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || 'Play');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [feeMonth, setFeeMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [feeDate, setFeeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER'>('CASH');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('অফিস সহকারী');
  const [notes, setNotes] = useState<string>('');

  // Dues Directory Filter State
  const [dueClassFilter, setDueClassFilter] = useState<string>('ALL');
  const [dueSearchQuery, setDueSearchQuery] = useState<string>('');
  const [dueBehaviorFilter, setDueBehaviorFilter] = useState<string>('ALL');

  const currentMonthStr = feeMonth;
  const todayStr = feeDate;

  // Active Students List
  const activeStudents = useMemo(() => {
    return students.filter(s => s.status === 'Active' || !s.status);
  }, [students]);

  // Current fee structure for selected class
  const currentStructure = useMemo(() => {
    return feeStructures.find(f => f.classLevel === selectedClass) || {
      classLevel: selectedClass,
      monthlyTuition: 700,
      admissionFee: 1500,
      examFee: 400,
      boardingFee: 2600,
      bookFee: 800,
    };
  }, [feeStructures, selectedClass]);

  // Fee Heads in Collection Wizard
  const [feeItems, setFeeItems] = useState<{
    tuition: { enabled: boolean; amount: number };
    boarding: { enabled: boolean; amount: number };
    exam: { enabled: boolean; amount: number };
    admission: { enabled: boolean; amount: number };
    book: { enabled: boolean; amount: number };
    session: { enabled: boolean; amount: number };
    other: { enabled: boolean; amount: number; label: string };
    waiver: number;
  }>({
    tuition: { enabled: true, amount: 700 },
    boarding: { enabled: false, amount: 2600 },
    exam: { enabled: false, amount: 400 },
    admission: { enabled: false, amount: 1500 },
    book: { enabled: false, amount: 800 },
    session: { enabled: false, amount: 500 },
    other: { enabled: false, amount: 0, label: 'বিবিধ' },
    waiver: 0,
  });

  // Handle Class Switch in Form
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    setSelectedStudentId('');
    setStudentSearch('');
    const str = feeStructures.find(f => f.classLevel === newClass);
    if (str) {
      setFeeItems(prev => ({
        ...prev,
        tuition: { ...prev.tuition, amount: str.monthlyTuition },
        boarding: { ...prev.boarding, amount: str.boardingFee || 0 },
        exam: { ...prev.exam, amount: str.examFee || 0 },
        admission: { ...prev.admission, amount: str.admissionFee || 0 },
        book: { ...prev.book, amount: str.bookFee || 0 },
      }));
    }
  };

  // Filtered student list for the collection form
  const classStudents = useMemo(() => {
    return activeStudents.filter(s => {
      if (s.classLevel !== selectedClass) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.nameBn?.includes(q) ||
          s.studentId?.toLowerCase().includes(q) ||
          s.guardianPhone?.includes(q)
        );
      }
      return true;
    });
  }, [activeStudents, selectedClass, studentSearch]);

  const selectedStudent = useMemo(() => {
    return activeStudents.find(s => s.id === selectedStudentId) || null;
  }, [activeStudents, selectedStudentId]);

  // =========================================================================
  // 1. ADVANCED STUDENT DUE & BEHAVIORAL PROFILING CALCULATION
  // =========================================================================
  const studentFeeProfiles = useMemo(() => {
    // Map of student payments in current month
    const currentMonthPaidMap: Record<string, number> = {};
    const totalLifetimePaidMap: Record<string, number> = {};
    const transactionCountMap: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type === 'INCOME' && tx.studentId) {
        totalLifetimePaidMap[tx.studentId] = (totalLifetimePaidMap[tx.studentId] || 0) + tx.amount;
        transactionCountMap[tx.studentId] = (transactionCountMap[tx.studentId] || 0) + 1;

        if (tx.feeMonth === currentMonthStr || (tx.date && tx.date.startsWith(currentMonthStr))) {
          currentMonthPaidMap[tx.studentId] = (currentMonthPaidMap[tx.studentId] || 0) + tx.amount;
        }
      }
    });

    return activeStudents.map(student => {
      const struct = feeStructures.find(f => f.classLevel === student.classLevel);
      const monthlyExpected = (struct?.monthlyTuition || 700) + (struct?.boardingFee || 0);
      const paidThisMonth = currentMonthPaidMap[student.id] || 0;
      const totalPaidAllTime = totalLifetimePaidMap[student.id] || 0;
      const countTx = transactionCountMap[student.id] || 0;

      const dueThisMonth = Math.max(0, monthlyExpected - paidThisMonth);
      const hasPaidFull = paidThisMonth >= monthlyExpected;
      const hasPaidPartial = paidThisMonth > 0 && paidThisMonth < monthlyExpected;

      // Determine Payment Behavior Profile
      let behavior: PaymentBehaviorType = 'REGULAR';
      let behaviorLabelBn = 'নিয়মিত (পরিশোধিত)';
      let behaviorLabelEn = 'Regular & Paid';
      let behaviorColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      let behaviorBadge = '🟢';

      if (hasPaidFull) {
        behavior = 'REGULAR';
        behaviorLabelBn = 'নিয়মিত (পরিশোধিত)';
        behaviorLabelEn = 'Regular & Paid';
        behaviorColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        behaviorBadge = '🟢';
      } else if (hasPaidPartial) {
        behavior = 'PARTIAL';
        behaviorLabelBn = 'আংশিক পরিশোধকারী';
        behaviorLabelEn = 'Partial Payer';
        behaviorColor = 'bg-blue-50 text-blue-700 border-blue-200';
        behaviorBadge = '🔵';
      } else if (countTx === 0) {
        behavior = 'CHRONIC_DUE';
        behaviorLabelBn = 'ক্রনিক বকেয়া / উচ্চ ঝুঁকি';
        behaviorLabelEn = 'Chronic Defaulter';
        behaviorColor = 'bg-rose-50 text-rose-700 border-rose-200';
        behaviorBadge = '🔴';
      } else {
        behavior = 'DELAYED';
        behaviorLabelBn = 'দেরিতে প্রদান / বকেয়া';
        behaviorLabelEn = 'Delayed / Due';
        behaviorColor = 'bg-amber-50 text-amber-700 border-amber-200';
        behaviorBadge = '🟡';
      }

      return {
        student,
        monthlyExpected,
        paidThisMonth,
        dueThisMonth,
        totalPaidAllTime,
        behavior,
        behaviorLabelBn,
        behaviorLabelEn,
        behaviorColor,
        behaviorBadge,
        hasPaidFull,
      };
    });
  }, [activeStudents, feeStructures, transactions, currentMonthStr]);

  // Aggregate Stats across all students
  const aggregateMetrics = useMemo(() => {
    let totalExpectedFees = 0;
    let totalCollectedFees = 0;
    let totalDueFees = 0;
    let totalPaidStudentsCount = 0;
    let totalDueStudentsCount = 0;
    let chronicDefaulterCount = 0;

    studentFeeProfiles.forEach(p => {
      totalExpectedFees += p.monthlyExpected;
      totalCollectedFees += p.paidThisMonth;
      totalDueFees += p.dueThisMonth;

      if (p.hasPaidFull) totalPaidStudentsCount++;
      else totalDueStudentsCount++;

      if (p.behavior === 'CHRONIC_DUE') chronicDefaulterCount++;
    });

    const collectionRate = totalExpectedFees > 0 
      ? Math.round((totalCollectedFees / totalExpectedFees) * 100) 
      : 0;

    return {
      totalExpectedFees,
      totalCollectedFees,
      totalDueFees,
      totalPaidStudentsCount,
      totalDueStudentsCount,
      chronicDefaulterCount,
      collectionRate,
      activeStudentCount: activeStudents.length,
    };
  }, [studentFeeProfiles, activeStudents]);

  // =========================================================================
  // 2. TEACHER SALARY BRIDGE & LIQUIDITY RUNWAY CALCULATION
  // =========================================================================
  const salaryBridgeMetrics = useMemo(() => {
    // 1. Calculate Teacher Salaries paid this month
    let teacherSalariesPaidThisMonth = 0;
    let lastMonthTeacherSalaries = 0;

    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const lastMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    transactions.forEach(tx => {
      if (tx.type === 'EXPENSE' && (tx.category === 'STAFF_SALARY' || tx.category === 'TEACHER_SALARY')) {
        if (tx.date && tx.date.startsWith(currentMonthStr)) {
          teacherSalariesPaidThisMonth += tx.amount;
        } else if (tx.date && tx.date.startsWith(lastMonthStr)) {
          lastMonthTeacherSalaries += tx.amount;
        }
      }
    });

    // Monthly Teacher Salary Payroll Obligation
    // If recorded this month or last month, use that; otherwise estimate based on reasonable benchmark
    const monthlySalaryObligation = Math.max(teacherSalariesPaidThisMonth, lastMonthTeacherSalaries, 65000);
    const studentFeeInflow = aggregateMetrics.totalCollectedFees;

    // Coverage Ratio (%)
    const coverageRatio = monthlySalaryObligation > 0 
      ? Math.min(100, Math.round((studentFeeInflow / monthlySalaryObligation) * 100))
      : 100;

    // Remaining required student fees to safely disburse all teacher salaries
    const salaryGap = Math.max(0, monthlySalaryObligation - studentFeeInflow);
    const salarySurplus = Math.max(0, studentFeeInflow - monthlySalaryObligation);

    // Readiness Status
    let readinessStatus: 'READY' | 'PARTIAL' | 'CRITICAL' = 'CRITICAL';
    let readinessTitleBn = 'বেতন প্রদানে ঘাটতি (বকেয়া আদায় জরুরি)';
    let readinessBadgeColor = 'bg-rose-100 text-rose-800 border-rose-300';

    if (coverageRatio >= 100) {
      readinessStatus = 'READY';
      readinessTitleBn = '১০০% উস্তাদ বেতন সম্পূর্ণ সুরক্ষিত ও প্রস্তুত';
      readinessBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (coverageRatio >= 60) {
      readinessStatus = 'PARTIAL';
      readinessTitleBn = 'আংশিক বেতন প্রদানের সক্ষমতা তৈরি হয়েছে';
      readinessBadgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      monthlySalaryObligation,
      teacherSalariesPaidThisMonth,
      studentFeeInflow,
      coverageRatio,
      salaryGap,
      salarySurplus,
      readinessStatus,
      readinessTitleBn,
      readinessBadgeColor,
    };
  }, [transactions, currentMonthStr, aggregateMetrics.totalCollectedFees]);

  // =========================================================================
  // 3. CLASS-WISE INFLOW & SALARY CONTRIBUTION BREAKDOWN
  // =========================================================================
  const classBreakdowns = useMemo(() => {
    const classMap: Record<string, { expected: number; collected: number; due: number; students: number }> = {};

    classes.forEach(c => {
      classMap[c.name] = { expected: 0, collected: 0, due: 0, students: 0 };
    });

    studentFeeProfiles.forEach(p => {
      const cName = p.student.classLevel || 'Play';
      if (!classMap[cName]) {
        classMap[cName] = { expected: 0, collected: 0, due: 0, students: 0 };
      }
      classMap[cName].students += 1;
      classMap[cName].expected += p.monthlyExpected;
      classMap[cName].collected += p.paidThisMonth;
      classMap[cName].due += p.dueThisMonth;
    });

    return Object.entries(classMap).map(([className, data]) => {
      const rate = data.expected > 0 ? Math.round((data.collected / data.expected) * 100) : 0;
      const salaryContributionShare = aggregateMetrics.totalCollectedFees > 0
        ? Math.round((data.collected / aggregateMetrics.totalCollectedFees) * 100)
        : 0;
      return {
        className,
        ...data,
        rate,
        salaryContributionShare,
      };
    });
  }, [classes, studentFeeProfiles, aggregateMetrics.totalCollectedFees]);

  // =========================================================================
  // 4. RECENT STUDENT FEE TRANSACTIONS LIST
  // =========================================================================
  const recentFeeTransactions = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'INCOME' && (tx.category === 'STUDENT_TUITION' || tx.studentId))
      .slice(0, 30);
  }, [transactions]);

  // Filtered Dues Directory
  const filteredDueList = useMemo(() => {
    return studentFeeProfiles.filter(item => {
      if (dueClassFilter !== 'ALL' && item.student.classLevel !== dueClassFilter) return false;
      if (dueBehaviorFilter === 'DUE_ONLY' && item.dueThisMonth <= 0) return false;
      if (dueBehaviorFilter === 'REGULAR' && item.behavior !== 'REGULAR') return false;
      if (dueBehaviorFilter === 'CHRONIC' && item.behavior !== 'CHRONIC_DUE') return false;

      if (dueSearchQuery.trim()) {
        const q = dueSearchQuery.toLowerCase().trim();
        return (
          item.student.name?.toLowerCase().includes(q) ||
          item.student.nameBn?.includes(q) ||
          item.student.studentId?.toLowerCase().includes(q) ||
          item.student.guardianPhone?.includes(q)
        );
      }
      return true;
    });
  }, [studentFeeProfiles, dueClassFilter, dueBehaviorFilter, dueSearchQuery]);

  // =========================================================================
  // QUICK PRESETS & SUBMIT HANDLERS
  // =========================================================================
  const applyPreset = (type: 'ALL' | 'TUITION_ONLY' | 'TUITION_AND_FOOD' | 'ADMISSION_ONLY' | 'EXAM_ONLY') => {
    setFeeItems(prev => {
      switch (type) {
        case 'ALL':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: Boolean(currentStructure.boardingFee), amount: currentStructure.boardingFee || 0 },
            exam: { ...prev.exam, enabled: Boolean(currentStructure.examFee), amount: currentStructure.examFee || 0 },
            admission: { ...prev.admission, enabled: Boolean(currentStructure.admissionFee), amount: currentStructure.admissionFee || 0 },
            book: { ...prev.book, enabled: Boolean(currentStructure.bookFee), amount: currentStructure.bookFee || 0 },
            session: { ...prev.session, enabled: false, amount: 0 },
          };
        case 'TUITION_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        case 'TUITION_AND_FOOD':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: true, amount: currentStructure.monthlyTuition },
            boarding: { ...prev.boarding, enabled: true, amount: currentStructure.boardingFee || 2600 },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        case 'ADMISSION_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: false },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: false },
            admission: { ...prev.admission, enabled: true, amount: currentStructure.admissionFee || 1500 },
            book: { ...prev.book, enabled: true, amount: currentStructure.bookFee || 800 },
            session: { ...prev.session, enabled: false },
          };
        case 'EXAM_ONLY':
          return {
            ...prev,
            tuition: { ...prev.tuition, enabled: false },
            boarding: { ...prev.boarding, enabled: false },
            exam: { ...prev.exam, enabled: true, amount: currentStructure.examFee || 400 },
            admission: { ...prev.admission, enabled: false },
            book: { ...prev.book, enabled: false },
            session: { ...prev.session, enabled: false },
          };
        default:
          return prev;
      }
    });
  };

  // Select a student from Dues Directory directly into Fee Collection
  const handleSelectStudentForPayment = (student: Student) => {
    setSelectedClass(student.classLevel);
    setSelectedStudentId(student.id);
    setActiveSubTab('collect');
    const str = feeStructures.find(f => f.classLevel === student.classLevel);
    if (str) {
      setFeeItems(prev => ({
        ...prev,
        tuition: { ...prev.tuition, amount: str.monthlyTuition, enabled: true },
        boarding: { ...prev.boarding, amount: str.boardingFee || 0, enabled: Boolean(str.boardingFee) },
      }));
    }
    showToast(isBn ? `${student.nameBn || student.name}-এর ফি গ্রহণের ফর্ম লোড হয়েছে` : `Loaded fee form for ${student.name}`);
  };

  // Copy Reminder SMS to clipboard
  const handleCopyReminderSMS = (item: typeof studentFeeProfiles[0]) => {
    const s = item.student;
    const msg = `সম্মানিত অভিভাবক, আপনার সন্তান ${s.nameBn || s.name} (শ্রেণি: ${s.classLevel})-এর ${feeMonth} মাসের ফি বাবদ ৳${item.dueThisMonth.toLocaleString()} বকেয়া রয়েছে। মাদ্রাসার পরিচালনা ও উস্তাদদের বেতন নিয়মিত রাখতে দ্রুত ফি পরিশোধের অনুরোধ করা হচ্ছে। ধন্যবাদ।`;
    navigator.clipboard.writeText(msg);
    showToast(isBn ? 'তাগাদা মেসেজ ক্লিপবোর্ডে কপি হয়েছে!' : 'Reminder notice copied to clipboard!');
  };

  // Computed Totals for Form
  const computedTotal = useMemo(() => {
    let gross = 0;
    if (feeItems.tuition.enabled) gross += Number(feeItems.tuition.amount) || 0;
    if (feeItems.boarding.enabled) gross += Number(feeItems.boarding.amount) || 0;
    if (feeItems.exam.enabled) gross += Number(feeItems.exam.amount) || 0;
    if (feeItems.admission.enabled) gross += Number(feeItems.admission.amount) || 0;
    if (feeItems.book.enabled) gross += Number(feeItems.book.amount) || 0;
    if (feeItems.session.enabled) gross += Number(feeItems.session.amount) || 0;
    if (feeItems.other.enabled) gross += Number(feeItems.other.amount) || 0;

    const discount = Number(feeItems.waiver) || 0;
    const net = Math.max(0, gross - discount);
    return { gross, discount, net };
  }, [feeItems]);

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert(isBn ? 'দয়া করে একজন ছাত্র নির্বাচন করুন!' : 'Please select a student!');
      return;
    }
    if (computedTotal.net <= 0) {
      alert(isBn ? 'মোট ফি এর পরিমাণ ০ এর বেশি হতে হবে!' : 'Total fee must be greater than 0!');
      return;
    }

    const nextVoucher = generateVoucherNo('INCOME', transactions);
    const breakdown: { name: string; nameBn: string; amount: number }[] = [];

    if (feeItems.tuition.enabled && feeItems.tuition.amount > 0) {
      breakdown.push({ name: 'Monthly Tuition', nameBn: 'মাসিক বেতন', amount: Number(feeItems.tuition.amount) });
    }
    if (feeItems.boarding.enabled && feeItems.boarding.amount > 0) {
      breakdown.push({ name: 'Boarding & Food Fee', nameBn: 'বোর্ডিং ও খাবার ফি', amount: Number(feeItems.boarding.amount) });
    }
    if (feeItems.exam.enabled && feeItems.exam.amount > 0) {
      breakdown.push({ name: 'Exam Fee', nameBn: 'পরীক্ষার ফি', amount: Number(feeItems.exam.amount) });
    }
    if (feeItems.admission.enabled && feeItems.admission.amount > 0) {
      breakdown.push({ name: 'Admission Fee', nameBn: 'ভর্তি ও সেশন চার্জ', amount: Number(feeItems.admission.amount) });
    }
    if (feeItems.book.enabled && feeItems.book.amount > 0) {
      breakdown.push({ name: 'Books & Stationery', nameBn: 'কিতাব ও পাঠাগার ফি', amount: Number(feeItems.book.amount) });
    }
    if (feeItems.session.enabled && feeItems.session.amount > 0) {
      breakdown.push({ name: 'Session Charge', nameBn: 'বার্ষিক সেশন ফি', amount: Number(feeItems.session.amount) });
    }
    if (feeItems.other.enabled && feeItems.other.amount > 0) {
      breakdown.push({ name: feeItems.other.label || 'Other', nameBn: feeItems.other.label || 'অন্যান্য', amount: Number(feeItems.other.amount) });
    }
    if (feeItems.waiver > 0) {
      breakdown.push({ name: 'Scholarship / Waiver', nameBn: 'বিশেষ ছাড় / এতিম বৃত্তি', amount: -Number(feeItems.waiver) });
    }

    const newTx: Omit<FinanceTransaction, 'id' | 'createdAt'> = {
      voucherNo: nextVoucher,
      type: 'INCOME',
      category: 'STUDENT_TUITION',
      categoryName: isBn ? 'ছাত্র ফি ও বেতন' : 'Student Fees',
      fundType: 'GENERAL',
      amount: computedTotal.net,
      date: feeDate,
      paymentMethod,
      referenceNo,
      studentId: selectedStudent?.id,
      studentCode: selectedStudent?.studentId,
      studentName: selectedStudent?.name,
      studentNameBn: selectedStudent?.nameBn,
      classLevel: selectedClass,
      feeMonth,
      feeBreakdown: breakdown,
      payerOrPayee: selectedStudent?.guardianName ? `${selectedStudent.guardianName} (অভিভাবক)` : (selectedStudent?.nameBn || selectedStudent?.name || ''),
      contactNo: selectedStudent?.guardianPhone || '',
      description: notes || `${feeMonth} মাসের ফি পরিশোধ`,
      collectedBy,
    };

    const created = onAddTransaction(newTx);
    showToast(isBn ? `রসিদ নং ${nextVoucher} সফলভাবে জমা হয়েছে!` : `Receipt ${nextVoucher} created!`);
    onShowReceipt(created);
  };

  return (
    <div className="space-y-5">
      
      {/* ========================================================================= */}
      {/* 🚀 HIGH-IMPACT METRIC HERO: INFLOW, DUES & TEACHER SALARY COVERAGE */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* 1. Collected Fees */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between border border-emerald-700/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
              {isBn ? 'ছাত্র ফি থেকে মোট আদায়' : 'Collected Fees'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              {aggregateMetrics.collectionRate}% {isBn ? 'আদায়' : 'Paid'}
            </span>
          </div>

          <div className="my-2.5">
            <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline gap-1 font-mono">
              <span className="text-emerald-300 font-sans">৳</span>
              <span>{isBn ? formatBanglaNumber(aggregateMetrics.totalCollectedFees) : aggregateMetrics.totalCollectedFees.toLocaleString()}</span>
            </div>
            <p className="text-xs text-emerald-200/90 mt-0.5 flex items-center gap-1">
              <span>{isBn ? 'পরিশোধ করেছে:' : 'Paid:'}</span>
              <strong className="text-white">{isBn ? formatBanglaNumber(aggregateMetrics.totalPaidStudentsCount) : aggregateMetrics.totalPaidStudentsCount}</strong>
              <span>/ {isBn ? formatBanglaNumber(aggregateMetrics.activeStudentCount) : aggregateMetrics.activeStudentCount} {isBn ? 'জন ছাত্র' : 'students'}</span>
            </p>
          </div>

          <div className="w-full bg-emerald-950/60 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-300 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, aggregateMetrics.collectionRate)}%` }}
            />
          </div>
        </div>

        {/* 2. Remaining Dues */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              {isBn ? 'মোট বকেয়া / আসা বাকি' : 'Total Pending Dues'}
            </span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
              {isBn ? `${formatBanglaNumber(aggregateMetrics.totalDueStudentsCount)} জনের বাকি` : `${aggregateMetrics.totalDueStudentsCount} Due`}
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 flex items-baseline gap-1 font-mono">
              <span className="text-slate-700 font-sans">৳</span>
              <span>{isBn ? formatBanglaNumber(aggregateMetrics.totalDueFees) : aggregateMetrics.totalDueFees.toLocaleString()}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn ? 'প্রদেয় মোট বাজেট:' : 'Total Expected:'} <strong className="text-slate-800 font-mono">৳{isBn ? formatBanglaNumber(aggregateMetrics.totalExpectedFees) : aggregateMetrics.totalExpectedFees.toLocaleString()}</strong>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{isBn ? 'ক্রনিক বকেয়াদার:' : 'Chronic Defaulters:'} <strong className="text-rose-600">{isBn ? formatBanglaNumber(aggregateMetrics.chronicDefaulterCount) : aggregateMetrics.chronicDefaulterCount}</strong></span>
            <button 
              onClick={() => { setActiveSubTab('dues'); setDueBehaviorFilter('CHRONIC'); }}
              className="text-blue-600 hover:text-blue-700 font-bold text-[11px] flex items-center gap-0.5"
            >
              <span>{isBn ? 'তালিকা দেখুন' : 'View List'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 3. Teacher Salary Bridge & Runway Meter */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between border border-slate-700/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-400" />
              {isBn ? 'উস্তাদ বেতন কভারেজ' : 'Teacher Salary Bridge'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              salaryBridgeMetrics.coverageRatio >= 100 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {salaryBridgeMetrics.coverageRatio}% {isBn ? 'সুরক্ষিত' : 'Covered'}
            </span>
          </div>

          <div className="my-2.5">
            <div className="text-xl sm:text-2xl font-black text-white flex items-baseline gap-1">
              <span className="text-amber-400">{salaryBridgeMetrics.coverageRatio >= 100 ? '✅' : '⏳'}</span>
              <span className="text-xs sm:text-sm font-bold text-slate-200">{salaryBridgeMetrics.readinessTitleBn}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {salaryBridgeMetrics.salaryGap > 0 
                ? (isBn ? `বেতন ছাড়তে আরও প্রয়োজন ৳${formatBanglaNumber(salaryBridgeMetrics.salaryGap)}` : `Need ৳${salaryBridgeMetrics.salaryGap.toLocaleString()} more for salary`)
                : (isBn ? `উদ্বৃত্ত তহবিল সংরক্ষিত আছে ৳${formatBanglaNumber(salaryBridgeMetrics.salarySurplus)}` : `Surplus ৳${salaryBridgeMetrics.salarySurplus.toLocaleString()}`)}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
            <span>{isBn ? 'মাসিক বেতন বাজেট:' : 'Salary Obligation:'} <strong className="text-amber-300 font-mono">৳{isBn ? formatBanglaNumber(salaryBridgeMetrics.monthlySalaryObligation) : salaryBridgeMetrics.monthlySalaryObligation.toLocaleString()}</strong></span>
            <button
              onClick={() => setActiveSubTab('salary-bridge')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
            >
              <span>{isBn ? 'বিশ্লেষণ' : 'Analyze'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 4. Payment Characteristics Ratio */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              {isBn ? 'পেমেন্ট প্যাটার্ন ও আচরণ' : 'Payment Behavior'}
            </span>
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              {isBn ? 'প্রোফাইলিং' : 'Profiling'}
            </span>
          </div>

          <div className="my-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {isBn ? 'নিয়মিত ও সময়মতো:' : 'Regular Payers:'}
              </span>
              <span className="font-bold font-mono text-emerald-700">
                {isBn ? formatBanglaNumber(aggregateMetrics.totalPaidStudentsCount) : aggregateMetrics.totalPaidStudentsCount} {isBn ? 'জন' : ''}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {isBn ? 'বকেয়াদার / অনিয়মিত:' : 'Defaulters:'}
              </span>
              <span className="font-bold font-mono text-rose-700">
                {isBn ? formatBanglaNumber(aggregateMetrics.totalDueStudentsCount) : aggregateMetrics.totalDueStudentsCount} {isBn ? 'জন' : ''}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500">{isBn ? 'তাগাদা নোটিশ পাঠাতে:' : 'For auto notices:'}</span>
            <button 
              onClick={() => setActiveSubTab('dues')} 
              className="text-purple-600 hover:text-purple-700 font-bold text-[11px] flex items-center gap-0.5"
            >
              <span>{isBn ? 'বকেয়া ডিরেক্টরি' : 'Due Directory'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 🧭 SUB-NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setActiveSubTab('collect')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'collect'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Receipt className={`w-4 h-4 ${activeSubTab === 'collect' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>{isBn ? '📝 ফি গ্রহণ ও রসিদ তৈরি' : 'Collect Fee & Voucher'}</span>
          </button>

          <button
            onClick={() => setActiveSubTab('dues')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'dues'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Users className={`w-4 h-4 ${activeSubTab === 'dues' ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>{isBn ? '👥 ছাত্র বকেয়া ও পেমেন্ট প্রোফাইল' : 'Student Dues & Profiles'}</span>
            {aggregateMetrics.totalDueStudentsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeSubTab === 'dues' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {isBn ? formatBanglaNumber(aggregateMetrics.totalDueStudentsCount) : aggregateMetrics.totalDueStudentsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('salary-bridge')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'salary-bridge'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Scale className={`w-4 h-4 ${activeSubTab === 'salary-bridge' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{isBn ? '⚖️ উস্তাদ বেতন কভারেজ ব্রিজ' : 'Teacher Salary Bridge'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {salaryBridgeMetrics.coverageRatio}%
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('class-breakdown')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'class-breakdown'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${activeSubTab === 'class-breakdown' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>{isBn ? '📊 জামাতভিত্তিক আদায় চিত্র' : 'Class Breakdown'}</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeSubTab === 'history' ? 'text-purple-400' : 'text-slate-500'}`} />
            <span>{isBn ? '📜 সাম্প্রতিক আদায় হিস্ট্রি' : 'Recent Inflow History'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📌 TAB 1: QUICK FEE COLLECTION WIZARD */}
      {/* ========================================================================= */}
      {activeSubTab === 'collect' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isBn ? 'ছাত্র ফি গ্রহণ ও তাৎক্ষণিক মানি রসিদ' : 'Student Fee Collection Wizard'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {isBn ? 'ছাত্র নির্বাচন করুন, ফি টিক দিয়ে ১-ক্লিকে রসিদ প্রিন্ট বা পিডিএফ করুন' : 'Select student, check fee heads & generate 2-copy receipt'}
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => applyPreset('TUITION_ONLY')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-emerald-700"
                >
                  {isBn ? 'শুধু মাসিক বেতন' : 'Tuition Only'}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('TUITION_AND_FOOD')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-emerald-700"
                >
                  {isBn ? 'বেতন + খাবার' : 'Tuition + Food'}
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('ADMISSION_ONLY')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white text-slate-800 shadow-2xs hover:text-emerald-700"
                >
                  {isBn ? 'ভর্তি ও সেশন' : 'Admission'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Class & Student Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isBn ? 'শ্রেণি / জামাত নির্বাচন করুন *' : 'Select Class / Jamat *'}
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {isBn ? 'শিক্ষার্থী নির্বাচন করুন *' : 'Select Student *'}
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">{isBn ? '-- ছাত্র নির্বাচন করুন --' : '-- Select Student --'}</option>
                    {classStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.studentId ? `[${s.studentId}] ` : ''}{s.nameBn || s.name} {s.rollNo ? `(রোল: ${s.rollNo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Student Quick Card if selected */}
              {selectedStudent && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {selectedStudent.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <div className="font-bold text-emerald-950">
                        {selectedStudent.nameBn || selectedStudent.name}
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        আইডি: {selectedStudent.studentId || 'N/A'} • অভিভাবক: {selectedStudent.guardianName || 'N/A'} ({selectedStudent.guardianPhone || 'N/A'})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 font-mono">
                      মাসিক প্রদেয়: ৳{isBn ? formatBanglaNumber(currentStructure.monthlyTuition + (currentStructure.boardingFee || 0)) : (currentStructure.monthlyTuition + (currentStructure.boardingFee || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Date, Month & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'বেতনের মাস *' : 'Fee Month *'}
                  </label>
                  <input
                    type="month"
                    value={feeMonth}
                    onChange={(e) => setFeeMonth(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'আদায়ের তারিখ *' : 'Payment Date *'}
                  </label>
                  <input
                    type="date"
                    value={feeDate}
                    onChange={(e) => setFeeDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isBn ? 'পরিশোধের মাধ্যম *' : 'Payment Method *'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="CASH">{isBn ? 'নগদ ক্যাশ (Cash)' : 'Cash'}</option>
                    <option value="BKASH">{isBn ? 'বিকাশ (bKash)' : 'bKash'}</option>
                    <option value="NAGAD">{isBn ? 'নগদ (Nagad)' : 'Nagad'}</option>
                    <option value="ROCKET">{isBn ? 'রকেট (Rocket)' : 'Rocket'}</option>
                    <option value="BANK_TRANSFER">{isBn ? 'ব্যাংক ট্রান্সফার / চেক' : 'Bank Transfer'}</option>
                  </select>
                </div>
              </div>

              {/* Fee Heads Selection Grid */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {isBn ? 'আদায়কৃত ফি এর খাতসমূহ নির্বাচন করুন:' : 'Select Fee Heads:'}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Monthly Tuition */}
                  <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    feeItems.tuition.enabled ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={feeItems.tuition.enabled}
                        onChange={(e) => setFeeItems(p => ({ ...p, tuition: { ...p.tuition, enabled: e.target.checked } }))}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{isBn ? 'মাসিক বেতন (Tuition)' : 'Monthly Tuition'}</span>
                    </label>
                    <input
                      type="number"
                      disabled={!feeItems.tuition.enabled}
                      value={feeItems.tuition.amount}
                      onChange={(e) => setFeeItems(p => ({ ...p, tuition: { ...p.tuition, amount: Number(e.target.value) } }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold"
                    />
                  </div>

                  {/* Boarding / Food */}
                  <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    feeItems.boarding.enabled ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={feeItems.boarding.enabled}
                        onChange={(e) => setFeeItems(p => ({ ...p, boarding: { ...p.boarding, enabled: e.target.checked } }))}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{isBn ? 'খাবার ও বোর্ডিং ফি' : 'Boarding / Food'}</span>
                    </label>
                    <input
                      type="number"
                      disabled={!feeItems.boarding.enabled}
                      value={feeItems.boarding.amount}
                      onChange={(e) => setFeeItems(p => ({ ...p, boarding: { ...p.boarding, amount: Number(e.target.value) } }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold"
                    />
                  </div>

                  {/* Exam Fee */}
                  <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    feeItems.exam.enabled ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={feeItems.exam.enabled}
                        onChange={(e) => setFeeItems(p => ({ ...p, exam: { ...p.exam, enabled: e.target.checked } }))}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{isBn ? 'পরীক্ষার ফি' : 'Exam Fee'}</span>
                    </label>
                    <input
                      type="number"
                      disabled={!feeItems.exam.enabled}
                      value={feeItems.exam.amount}
                      onChange={(e) => setFeeItems(p => ({ ...p, exam: { ...p.exam, amount: Number(e.target.value) } }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold"
                    />
                  </div>

                  {/* Admission Fee */}
                  <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    feeItems.admission.enabled ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={feeItems.admission.enabled}
                        onChange={(e) => setFeeItems(p => ({ ...p, admission: { ...p.admission, enabled: e.target.checked } }))}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{isBn ? 'ভর্তি ফি / সেশন চার্জ' : 'Admission Fee'}</span>
                    </label>
                    <input
                      type="number"
                      disabled={!feeItems.admission.enabled}
                      value={feeItems.admission.amount}
                      onChange={(e) => setFeeItems(p => ({ ...p, admission: { ...p.admission, amount: Number(e.target.value) } }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Special Waiver / Discount */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-900">
                    {isBn ? 'বিশেষ ছাড় / এতিম বৃত্তি / ওয়েভার (টাকা):' : 'Scholarship / Waiver Discount (৳):'}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={feeItems.waiver || ''}
                  onChange={(e) => setFeeItems(p => ({ ...p, waiver: Number(e.target.value) || 0 }))}
                  className="w-28 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-amber-950"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md py-3"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  <span>{isBn ? `ফি জমা করুন ও রসিদ তৈরি করুন (মোট: ৳${formatBanglaNumber(computedTotal.net)})` : `Collect Fee & Print Receipt (৳${computedTotal.net.toLocaleString()})`}</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Right Summary Panel (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Amount Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {isBn ? 'মোট আদায়ের হিসাব' : 'Fee Calculation'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  {feeMonth}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>{isBn ? 'মোট ফি (Gross):' : 'Gross Total:'}</span>
                  <span className="font-mono font-bold">৳ {isBn ? formatBanglaNumber(computedTotal.gross) : computedTotal.gross.toLocaleString()}</span>
                </div>
                {computedTotal.discount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>{isBn ? 'বিশেষ ছাড় (Waiver):' : 'Waiver Discount:'}</span>
                    <span className="font-mono font-bold">- ৳ {isBn ? formatBanglaNumber(computedTotal.discount) : computedTotal.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-white">{isBn ? 'মোট প্রদেয় (Net):' : 'Net Total:'}</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    ৳ {isBn ? formatBanglaNumber(computedTotal.net) : computedTotal.net.toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 italic pt-1">
                  কথায়: {amountToBengaliWords(computedTotal.net)}
                </div>
              </div>
            </div>

            {/* Quick Link to Dues */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-rose-600" />
                  {isBn ? 'বকেয়াদার ছাত্র তালিকা' : 'Pending Defaulters'}
                </span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                  {aggregateMetrics.totalDueStudentsCount} {isBn ? 'জন' : ''}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                {isBn ? 'কোন ছাত্রের কত টাকা বকেয়া আছে দেখতে এবং এসএমএস পাঠাতে বকেয়া ডিরেক্টরি ব্যবহার করুন।' : 'View student-wise dues and copy reminder notices.'}
              </p>

              <Button
                onClick={() => setActiveSubTab('dues')}
                size="sm"
                variant="secondary"
                className="w-full text-xs font-bold"
              >
                <span>{isBn ? 'বকেয়া তালিকা ওপেন করুন' : 'Open Dues Directory'}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📌 TAB 2: STUDENT DUES & BEHAVIORAL DIRECTORY */}
      {/* ========================================================================= */}
      {activeSubTab === 'dues' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
          
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-600" />
                <span>{isBn ? 'ছাত্র বকেয়া খতিয়ান ও পেমেন্ট আচরণ ডিরেক্টরি' : 'Student Dues & Behavioral Directory'}</span>
              </h2>
              <p className="text-xs text-slate-500">
                {isBn ? 'প্রতিটি ছাত্রের প্রদেয় ফি, পরিশোধের রেকর্ড, বকেয়া এবং পেমেন্ট প্যাটার্ন ট্র্যাক করুন' : 'Track student-wise dues, payment history, and behavioral tags'}
              </p>
            </div>

            {/* Print Dues Sheet */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.print()}
                size="sm"
                variant="secondary"
                className="text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                <span>{isBn ? 'বকেয়া শিট প্রিন্ট' : 'Print Due Sheet'}</span>
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-12 gap-3">
            {/* Search */}
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dueSearchQuery}
                onChange={(e) => setDueSearchQuery(e.target.value)}
                placeholder={isBn ? 'ছাত্রের নাম, রোল, আইডি বা মোবাইল নম্বর খুঁজুন...' : 'Search name, roll, phone...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Class Filter */}
            <div className="lg:col-span-3">
              <select
                value={dueClassFilter}
                onChange={(e) => setDueClassFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ALL">{isBn ? 'সকল শ্রেণি / জামাত' : 'All Classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Behavior Filter */}
            <div className="lg:col-span-4">
              <select
                value={dueBehaviorFilter}
                onChange={(e) => setDueBehaviorFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ALL">{isBn ? 'সকল শিক্ষার্থী (All)' : 'All Students'}</option>
                <option value="DUE_ONLY">{isBn ? '🚨 শুধু বকেয়া আছে যাদের (Due Only)' : 'Due Only'}</option>
                <option value="CHRONIC">{isBn ? '🔴 ক্রনিক বকেয়া / উচ্চ ঝুঁকি (Defaulters)' : 'Chronic Defaulters'}</option>
                <option value="REGULAR">{isBn ? '🟢 নিয়মিত ও পরিশোধিত (Paid)' : 'Regular / Paid'}</option>
              </select>
            </div>
          </div>

          {/* Dues Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">শিক্ষার্থীর নাম ও জামাত</th>
                  <th className="py-3 px-3 text-center">আইডি / রোল</th>
                  <th className="py-3 px-3 text-center">পেমেন্ট প্যাটার্ন</th>
                  <th className="py-3 px-3 text-right">প্রদেয় ফি</th>
                  <th className="py-3 px-3 text-right">পরিশোধিত</th>
                  <th className="py-3 px-3 text-right">চলতি বকেয়া</th>
                  <th className="py-3 px-3 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDueList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isBn ? 'কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।' : 'No students matching filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredDueList.map(item => {
                    const s = item.student;
                    const hasDue = item.dueThisMonth > 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{s.nameBn || s.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>শ্রেণি: {s.classLevel}</span>
                            {s.guardianPhone && (
                              <span className="font-mono text-slate-400">📞 {s.guardianPhone}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                          {s.studentId || s.rollNo || '---'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.behaviorColor}`}>
                            <span>{item.behaviorBadge}</span>
                            <span>{isBn ? item.behaviorLabelBn : item.behaviorLabelEn}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          ৳{isBn ? formatBanglaNumber(item.monthlyExpected) : item.monthlyExpected.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          ৳{isBn ? formatBanglaNumber(item.paidThisMonth) : item.paidThisMonth.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black">
                          {hasDue ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ৳{isBn ? formatBanglaNumber(item.dueThisMonth) : item.dueThisMonth.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">
                              {isBn ? 'পরিশোধিত ✅' : 'Paid ✅'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {hasDue && (
                              <>
                                <button
                                  onClick={() => handleSelectStudentForPayment(s)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                                  title={isBn ? 'ফি গ্রহণ করুন' : 'Collect Fee'}
                                >
                                  {isBn ? 'ফি গ্রহণ' : 'Collect'}
                                </button>
                                <button
                                  onClick={() => handleCopyReminderSMS(item)}
                                  className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={isBn ? 'তাগাদা এসএমএস টেক্সট কপি করুন' : 'Copy Reminder SMS'}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📌 TAB 3: TEACHER SALARY BRIDGE & LIQUIDITY RUNWAY */}
      {/* ========================================================================= */}
      {activeSubTab === 'salary-bridge' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isBn ? 'ছাত্র ফি বনাম উস্তাদ বেতন কভারেজ ইঞ্জিন (Salary Bridge)' : 'Student Fee ➔ Teacher Salary Bridge'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {isBn ? 'ছাত্রদের থেকে সংগৃহীত ফি দিয়ে উস্তাদদের বেতন নিশ্চিত করার লাইভ ব্যালেন্সিং ও রিকমেন্ডেশন' : 'Real-time liquidity bridge ensuring teacher salary payroll is backed by student fee inflows'}
                  </p>
                </div>
              </div>

              {onNavigateTab && (
                <Button
                  onClick={() => onNavigateTab('salary')}
                  size="sm"
                  variant="primary"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                  <span>{isBn ? 'উস্তাদ বেতন প্রদান ভাউচারে যান' : 'Go to Salary Voucher'}</span>
                </Button>
              )}
            </div>

            {/* Coverage Meter Hero Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {isBn ? 'চলতি মাসের বেতন সুরক্ষা ইনডেক্স' : 'Monthly Payroll Coverage Status'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${salaryBridgeMetrics.readinessBadgeColor}`}>
                  {salaryBridgeMetrics.readinessTitleBn}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>{isBn ? 'বেতন কভারেজ প্রোগ্রেস:' : 'Coverage Progress:'}</span>
                  <span className="font-mono text-amber-400 text-sm">{salaryBridgeMetrics.coverageRatio}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      salaryBridgeMetrics.coverageRatio >= 100 ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, salaryBridgeMetrics.coverageRatio)}%` }}
                  />
                </div>
              </div>

              {/* 3 Metric Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white/10 rounded-xl p-3 text-center border border-white/10">
                  <span className="text-[11px] text-slate-300 block">{isBn ? 'মোট উস্তাদ বেতন বাজেট' : 'Monthly Salary Budget'}</span>
                  <span className="text-lg font-black text-white font-mono">
                    ৳ {isBn ? formatBanglaNumber(salaryBridgeMetrics.monthlySalaryObligation) : salaryBridgeMetrics.monthlySalaryObligation.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-3 text-center border border-white/10">
                  <span className="text-[11px] text-emerald-300 block">{isBn ? 'ছাত্র ফি থেকে আদায়কৃত' : 'Student Inflow Collected'}</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    + ৳ {isBn ? formatBanglaNumber(salaryBridgeMetrics.studentFeeInflow) : salaryBridgeMetrics.studentFeeInflow.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-3 text-center border border-white/10">
                  <span className="text-[11px] text-amber-300 block">{isBn ? 'বেতন পরিশোধে আরও প্রয়োজন' : 'Remaining Gap to Collect'}</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    ৳ {isBn ? formatBanglaNumber(salaryBridgeMetrics.salaryGap) : salaryBridgeMetrics.salaryGap.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Class-wise Contribution to Salary Pool */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isBn ? 'কোন জামাত উস্তাদ বেতনের কত শতাংশ জোগাড় করছে (Class Contribution):' : 'Class-wise Contribution to Teacher Salary Pool:'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {classBreakdowns.map(c => (
                  <div key={c.className} className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <strong className="text-slate-900">{c.className}</strong>
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {c.salaryContributionShare}% {isBn ? 'বেতন শেয়ার' : 'Share'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>{isBn ? 'সংগৃহীত ফি:' : 'Collected:'}</span>
                      <span className="font-bold text-emerald-700 font-mono">৳{isBn ? formatBanglaNumber(c.collected) : c.collected.toLocaleString()}</span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, c.salaryContributionShare * 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📌 TAB 4: CLASS-WISE BREAKDOWN */}
      {/* ========================================================================= */}
      {activeSubTab === 'class-breakdown' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>{isBn ? 'জামাতভিত্তিক ফি আদায় ও বকেয়ার সামগ্রিক চিত্র' : 'Class-wise Fee & Due Breakdown'}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {isBn ? 'প্রতিটি শ্রেণির মোট ছাত্র, প্রদেয় ফি, আদায় ও আদায়ের হার' : 'Performance and collection rate across each class'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classBreakdowns.map(c => (
              <div key={c.className} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-black text-slate-900">{c.className}</h3>
                  <span className="text-xs font-bold text-slate-500">
                    {isBn ? `${formatBanglaNumber(c.students)} জন ছাত্র` : `${c.students} Students`}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{isBn ? 'প্রদেয় মোট ফি:' : 'Expected Fee:'}</span>
                    <span className="font-mono font-bold text-slate-800">৳{isBn ? formatBanglaNumber(c.expected) : c.expected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>{isBn ? 'আদায় হয়েছে:' : 'Collected:'}</span>
                    <span className="font-mono font-bold">+ ৳{isBn ? formatBanglaNumber(c.collected) : c.collected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>{isBn ? 'আদায় বাকি (বকেয়া):' : 'Pending Dues:'}</span>
                    <span className="font-mono font-bold">৳{isBn ? formatBanglaNumber(c.due) : c.due.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-600">{isBn ? 'আদায়ের অগ্রগতি:' : 'Collection Rate:'}</span>
                    <span className="text-blue-700 font-mono">{c.rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, c.rate)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📌 TAB 5: RECENT INFLOW HISTORY */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <span>{isBn ? 'সাম্প্রতিক ছাত্র ফি আদায়ের খতিয়ান' : 'Recent Fee Transactions'}</span>
              </h2>
              <p className="text-xs text-slate-500">
                {isBn ? 'সর্বশেষ আদায়কৃত ছাত্র ফির তালিকা ও মানি রসিদ পুনরায় প্রিন্ট করার সুবিধা' : 'Latest student fee receipts with instant reprint'}
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">ভাউচার নং</th>
                  <th className="py-3 px-3">তারিখ</th>
                  <th className="py-3 px-3">শিক্ষার্থী ও শ্রেণি</th>
                  <th className="py-3 px-3">বেতনের মাস</th>
                  <th className="py-3 px-3">মাধ্যম</th>
                  <th className="py-3 px-3 text-right">আদায়ের পরিমাণ</th>
                  <th className="py-3 px-3 text-center">রসিদ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentFeeTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {isBn ? 'কোনো সাম্প্রতিক লেনদেন নেই।' : 'No recent transactions.'}
                    </td>
                  </tr>
                ) : (
                  recentFeeTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{tx.voucherNo}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono">{tx.date}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900">{tx.studentNameBn || tx.studentName || tx.payerOrPayee}</span>
                        {tx.classLevel && <span className="ml-1 text-[11px] text-slate-500">[{tx.classLevel}]</span>}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{tx.feeMonth || '---'}</td>
                      <td className="py-3 px-3 text-slate-600">{tx.paymentMethod}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                        + ৳{isBn ? formatBanglaNumber(tx.amount) : tx.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onShowReceipt(tx)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={isBn ? 'রসিদ প্রিন্ট করুন' : 'Print Receipt'}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
