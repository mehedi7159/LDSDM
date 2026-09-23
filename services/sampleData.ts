import { SchoolClass, Student, Subject, Exam, MarkRecord, FinanceTransaction, ClassFeeStructure } from '../types';

export const defaultFeeStructures: ClassFeeStructure[] = [
  { id: 'fs-1', classLevel: 'Play', monthlyTuition: 500, admissionFee: 1500, examFee: 300, boardingFee: 2500, bookFee: 600 },
  { id: 'fs-2', classLevel: 'Class 1', monthlyTuition: 600, admissionFee: 1500, examFee: 350, boardingFee: 2500, bookFee: 700 },
  { id: 'fs-3', classLevel: 'Class 2', monthlyTuition: 650, admissionFee: 1600, examFee: 350, boardingFee: 2600, bookFee: 750 },
  { id: 'fs-4', classLevel: 'Class 3', monthlyTuition: 700, admissionFee: 1700, examFee: 400, boardingFee: 2600, bookFee: 800 },
  { id: 'fs-5', classLevel: 'Class 5', monthlyTuition: 800, admissionFee: 1800, examFee: 450, boardingFee: 2800, bookFee: 900 },
  { id: 'fs-6', classLevel: 'Class 6', monthlyTuition: 900, admissionFee: 2000, examFee: 500, boardingFee: 3000, bookFee: 1000 },
  { id: 'fs-7', classLevel: 'Class 7', monthlyTuition: 950, admissionFee: 2000, examFee: 500, boardingFee: 3000, bookFee: 1100 },
  { id: 'fs-8', classLevel: 'Class 8', monthlyTuition: 1000, admissionFee: 2200, examFee: 550, boardingFee: 3200, bookFee: 1200 },
  { id: 'fs-9', classLevel: 'Class 9', monthlyTuition: 1100, admissionFee: 2500, examFee: 600, boardingFee: 3300, bookFee: 1300 },
  { id: 'fs-10', classLevel: 'Class 10', monthlyTuition: 1200, admissionFee: 2500, examFee: 600, boardingFee: 3300, bookFee: 1400 },
];

export const generateSampleFinanceData = (students: Student[] = []): FinanceTransaction[] => {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const todayStr = new Date().toISOString().split('T')[0];

  const sampleTransactions: FinanceTransaction[] = [
    {
      id: 'tx-init-1',
      voucherNo: `MR-${currentYear}-0001`,
      type: 'INCOME',
      category: 'GENERAL_DONATION',
      categoryName: 'সাধারণ দান ও অনুদান',
      fundType: 'GENERAL',
      amount: 25000,
      date: `${currentYear}-${currentMonth}-02`,
      paymentMethod: 'BANK_TRANSFER',
      referenceNo: 'IBBL-98241',
      payerOrPayee: 'আলহাজ্ব রফিকুল ইসলাম (যুক্তরাজ্য প্রবাসী)',
      contactNo: '01711223344',
      description: 'মাদ্রাসার সাধারণ ফান্ডে এককালীন দান',
      collectedBy: 'মাওলানা আব্দুল করিম (সুপার)',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-2',
      voucherNo: `MR-${currentYear}-0002`,
      type: 'INCOME',
      category: 'ZAKAT_FITRA',
      categoryName: 'যাকাত ও ফিতরা ফান্ড',
      fundType: 'ZAKAT',
      amount: 50000,
      date: `${currentYear}-${currentMonth}-05`,
      paymentMethod: 'CASH',
      referenceNo: '',
      payerOrPayee: 'হাজী মো. নূরুল হক',
      contactNo: '01819887766',
      description: 'লিল্লাহ ও এতিম ছাত্রদের জন্য বাৎসরিক যাকাত',
      collectedBy: 'মুহাদ্দিস সাহেব',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-3',
      voucherNo: `MR-${currentYear}-0003`,
      type: 'INCOME',
      category: 'STUDENT_TUITION',
      categoryName: 'মাসিক ছাত্র বেতন',
      fundType: 'GENERAL',
      amount: 3900,
      date: `${currentYear}-${currentMonth}-08`,
      paymentMethod: 'CASH',
      referenceNo: '',
      studentId: students[0]?.id || 'st-1',
      studentCode: students[0]?.studentId || '101',
      studentName: students[0]?.name || 'Abdullah Al Mamun',
      studentNameBn: students[0]?.nameBn || 'আব্দুল্লাহ আল মামুন',
      classLevel: students[0]?.classLevel || 'Class 6',
      feeMonth: `${currentYear}-${currentMonth}`,
      feeBreakdown: [
        { name: 'Monthly Tuition', nameBn: 'মাসিক বেতন', amount: 900 },
        { name: 'Boarding Fee', nameBn: 'বোর্ডিং খাবার ফি', amount: 3000 },
      ],
      payerOrPayee: 'মোহাম্মদ রফিক (অভিভাবক)',
      contactNo: '01912345678',
      description: 'চলতি মাসের বেতন ও বোর্ডিং ফি পরিশোধ',
      collectedBy: 'অফিস সহকারী',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-4',
      voucherNo: `MR-${currentYear}-0004`,
      type: 'INCOME',
      category: 'MONTHLY_DONOR',
      categoryName: 'দাতা সদস্য মাসিক চাঁদা',
      fundType: 'DEVELOPMENT',
      amount: 10000,
      date: `${currentYear}-${currentMonth}-10`,
      paymentMethod: 'BKASH',
      referenceNo: 'TRX9876251',
      payerOrPayee: 'ইঞ্জিনিয়ার জহিরুল ইসলাম',
      contactNo: '01715678901',
      description: 'নতুন মসজিদ ও মাদ্রাসার বহুতল ভবন নির্মাণ ফান্ড',
      collectedBy: 'সুপার',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-5',
      voucherNo: `DV-${currentYear}-0001`,
      type: 'EXPENSE',
      category: 'STAFF_SALARY',
      categoryName: 'উস্তাদ ও স্টাফদের বেতন / হাদিয়া',
      fundType: 'GENERAL',
      amount: 38000,
      date: `${currentYear}-${currentMonth}-07`,
      paymentMethod: 'CASH',
      referenceNo: 'Sal-01',
      payerOrPayee: 'মাদ্রাসার শিক্ষক ও কর্মচারীগণ (৫ জন)',
      contactNo: '',
      description: 'উস্তাদ ও স্টাফদের মাসিক হাদিয়া ও বেতন পরিশোধ',
      collectedBy: 'হিসাবরক্ষক',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-6',
      voucherNo: `DV-${currentYear}-0002`,
      type: 'EXPENSE',
      category: 'BOARDING_MESS',
      categoryName: 'বোর্ডিং ও মেস বাজার খরচ',
      fundType: 'ORPHAN_AID',
      amount: 14500,
      date: `${currentYear}-${currentMonth}-09`,
      paymentMethod: 'CASH',
      referenceNo: '',
      payerOrPayee: 'মেসার্স ভাই ভাই রাইস এজেন্সি ও কাঁচাবাজার',
      contactNo: '01612344556',
      description: 'বোর্ডিংয়ের চাল, ডাল, তেল ও সাপ্তাহিক তরিতরকারি ক্রয়',
      collectedBy: 'বাবুর্চি ও মেস ইনচার্জ',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-7',
      voucherNo: `DV-${currentYear}-0003`,
      type: 'EXPENSE',
      category: 'UTILITY_BILL',
      categoryName: 'বিদ্যুৎ, গ্যাস ও পানির বিল',
      fundType: 'GENERAL',
      amount: 4200,
      date: `${currentYear}-${currentMonth}-12`,
      paymentMethod: 'BKASH',
      referenceNo: 'BPDB-098231',
      payerOrPayee: 'পল্লী বিদ্যুৎ সমিতি (মিটার নং: ৩৮৪২১)',
      contactNo: '',
      description: 'মাদ্রাসা ও হেফজখানার চলতি মাসের বিদ্যুৎ বিল',
      collectedBy: 'অফিস সহকারী',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-init-8',
      voucherNo: `DV-${currentYear}-0004`,
      type: 'EXPENSE',
      category: 'BOOKS_LIBRARY',
      categoryName: 'কিতাব ও লাইব্রেরি খরচ',
      fundType: 'BOOK_BANK',
      amount: 6500,
      date: todayStr,
      paymentMethod: 'CASH',
      referenceNo: 'Memo-441',
      payerOrPayee: 'ইসলামিয়া কুতুবখানা, বাংলাবাজার',
      contactNo: '01712009988',
      description: 'নতুন শিক্ষাবর্ষের দারসে নেজামী কিতাব ও খাতা ক্রয়',
      collectedBy: 'নাজেমে তালিমাত',
      createdAt: new Date().toISOString(),
    }
  ];

  return sampleTransactions;
};

export const generateSampleMadrashaData = (
  classes: SchoolClass[],
  existingExams: Exam[]
): {
  sampleStudents: Student[];
  sampleSubjects: Subject[];
  sampleMarks: MarkRecord[];
  sampleExams: Exam[];
} => {
  const defaultExams: Exam[] = [
    { id: '1', name: '1st Term Evaluation', nameBn: '১ম সাময়িক পরীক্ষা', academicYear: '2024', category: 'Term' },
    { id: '2', name: '2nd Term Evaluation', nameBn: '২য় সাময়িক পরীক্ষা', academicYear: '2024', category: 'Term' },
    { id: '3', name: 'Annual Examination', nameBn: 'বার্ষিক পরীক্ষা', academicYear: '2024', category: 'Term' },
  ];

  // Merge existing exams or ensure 3 exams exist for multi-term trajectory analysis
  const examsToUse: Exam[] = [...existingExams];
  defaultExams.forEach(defEx => {
    if (!examsToUse.some(e => e.id === defEx.id || e.name === defEx.name)) {
      examsToUse.push(defEx);
    }
  });

  const targetClasses = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

  const subjectTemplates = [
    { name: 'Quran Majeed & Tajweed', nameBn: 'কুরআন মাজীদ ও তাজভীদ', code: '101', fullMarks: 100, passMarks: 33, strong: true },
    { name: 'Aqaid & Fiqh', nameBn: 'আকাইদ ও ফিকাহ', code: '102', fullMarks: 100, passMarks: 33, strong: true },
    { name: 'Bangla', nameBn: 'বাংলা ১ম পত্র', code: '103', fullMarks: 100, passMarks: 33, moderate: true },
    { name: 'English', nameBn: 'ইংরেজি ১ম পত্র', code: '104', fullMarks: 100, passMarks: 33, weak: true },
    { name: 'Mathematics', nameBn: 'গণিত', code: '105', fullMarks: 100, passMarks: 33, weak: true },
    { name: 'Arabic 1st Paper', nameBn: 'আরবি ১ম পত্র', code: '106', fullMarks: 100, passMarks: 33, moderate: true },
    { name: 'Arabic 2nd Paper (Qawaid)', nameBn: 'আরবি ২য় পত্র (কাওয়াইদ)', code: '107', fullMarks: 100, passMarks: 33, weak: true },
    { name: 'General Science', nameBn: 'সাধারণ বিজ্ঞান', code: '108', fullMarks: 100, passMarks: 33, moderate: true },
    { name: 'Bangladesh & Global Studies', nameBn: 'বাংলাদেশ ও বিশ্বপরিচয়', code: '109', fullMarks: 100, passMarks: 33, strong: true },
  ];

  const studentNames = [
    { name: 'Abdullah Al Mamun', nameBn: 'আব্দুল্লাহ আল মামুন' },
    { name: 'Fatima Tuz Zohra', nameBn: 'ফাতিমা তুজ জোহরা' },
    { name: 'Muhammad Hasan', nameBn: 'মুহাম্মদ হাসান' },
    { name: 'Ayesha Siddiqua', nameBn: 'আয়েশা সিদ্দিকা' },
    { name: 'Mahmudur Rahman', nameBn: 'মাহমুদুর রহমান' },
    { name: 'Tanzila Akter', nameBn: 'তানজিলা আক্তার' },
    { name: 'Ibrahim Khalil', nameBn: 'ইব্রাহিম খলিল' },
    { name: 'Sumaiya Islam', nameBn: 'সুমাইয়া ইসলাম' },
  ];

  const sampleStudents: Student[] = [];
  const sampleSubjects: Subject[] = [];
  const sampleMarks: MarkRecord[] = [];

  let studentSeq = 1;

  targetClasses.forEach((clsName, cIdx) => {
    // Generate subjects for this class
    const classSubjects: Subject[] = subjectTemplates.map((tpl, sIdx) => {
      const subId = `demo-sub-${cIdx}-${sIdx + 1}`;
      const sub: Subject = {
        id: subId,
        name: tpl.name,
        nameBn: tpl.nameBn,
        code: tpl.code,
        classLevel: clsName,
        fullMarks: tpl.fullMarks,
        passMarks: tpl.passMarks,
        isOptional: false,
        order: sIdx + 1
      };
      sampleSubjects.push(sub);
      return sub;
    });

    // Generate students for this class
    studentNames.forEach((sName, sIdx) => {
      const studentId = `demo-std-${studentSeq}`;
      const studentCode = `${2024000 + studentSeq}`;
      const rollStr = `${sIdx + 1}`;
      const student: Student = {
        id: studentId,
        studentId: studentCode,
        roll: rollStr,
        name: sName.name,
        nameBn: sName.nameBn,
        classLevel: clsName,
        status: 'Active',
        group: 'General'
      };
      sampleStudents.push(student);
      studentSeq++;

      // Generate marks across exams (up to 3 exams for realistic progress tracking)
      examsToUse.slice(0, 3).forEach((exam, examIdx) => {
        classSubjects.forEach((sub, subIdx) => {
          const tpl = subjectTemplates[subIdx];
          let baseMark = 65;

          // Strong subjects (Quran, Aqaid, BGS): high scores (72 - 95), zero/rare fails
          if (tpl.strong) {
            baseMark = 74 + ((sIdx * 3 + subIdx * 2) % 20);
          } 
          // Moderate subjects (Bangla, Arabic 1st, Science): scores (55 - 85)
          else if (tpl.moderate) {
            if (sIdx === 7 && cIdx % 2 === 0 && examIdx === 0) {
              baseMark = 28; // Occasional early fail
            } else {
              baseMark = 58 + ((sIdx * 4 + subIdx * 3) % 26);
            }
          } 
          // Weak subjects (Math, English, Arabic 2nd)
          else if (tpl.weak) {
            if (sIdx === 4 || sIdx === 6 || (sIdx === 7 && cIdx > 1)) {
              baseMark = 20 + ((sIdx + subIdx) % 12); // Struggling/Failing
            } else if (sIdx === 2 || sIdx === 5) {
              baseMark = 38 + ((sIdx * 2 + subIdx) % 12); // Borderline
            } else {
              baseMark = 54 + ((sIdx * 3 + subIdx) % 25);
            }
          }

          // Dynamic Progression / Decline trends across exams:
          // Students 0 & 1: Clear improvement trend ↗️
          // Students 5 & 7: Moderate decline trend ↘️
          // Student 2: Consistent high performer ➡️
          // Others: realistic fluctuations
          let examDelta = 0;
          if (sIdx === 0 || sIdx === 1) {
            examDelta = examIdx === 0 ? -6 : examIdx === 1 ? 0 : 8; // Clear improvement
          } else if (sIdx === 5 || sIdx === 7) {
            examDelta = examIdx === 0 ? 6 : examIdx === 1 ? 1 : -7; // Decline
          } else if (sIdx === 3) {
            examDelta = examIdx === 0 ? -4 : examIdx === 1 ? 3 : 5; // Recovery
          } else {
            examDelta = (examIdx === 1 ? 2 : examIdx === 2 ? -1 : 0);
          }

          let finalObtained = Math.min(sub.fullMarks, Math.max(12, baseMark + examDelta));

          sampleMarks.push({
            id: `demo-mark-${studentId}-${sub.id}-${exam.id}`,
            studentId: student.id,
            subjectId: sub.id,
            examId: exam.id,
            obtained: finalObtained,
            total: sub.fullMarks,
            isAbsent: false
          });
        });
      });
    });
  });

  return {
    sampleStudents,
    sampleSubjects,
    sampleMarks,
    sampleExams: examsToUse
  };
};
