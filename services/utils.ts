import { GradingSystem, DEFAULT_GRADING_SYSTEM, MarkRecord, Student, Subject, Exam } from '../types';
import { translations, Language } from './translations';

export const calculateGrade = (marks: number, fullMarks: number = 100): { grade: string; gpa: number } => {
  const percentage = (marks / fullMarks) * 100;
  
  for (const range of DEFAULT_GRADING_SYSTEM) {
    if (percentage >= range.min) {
      return { grade: range.grade, gpa: range.gpa };
    }
  }
  return { grade: 'F', gpa: 0.0 };
};

export const getConsolidatedMark = (
  studentId: string,
  subjectId: string,
  examId: string,
  exams: Exam[],
  marks: MarkRecord[]
): MarkRecord | undefined => {
  const currentExam = exams.find(e => e.id === examId);
  const currentMark = marks.find(
    m => m.studentId === studentId && m.subjectId === subjectId && m.examId === examId
  );

  if (!currentExam) return currentMark;
  if (!currentExam.enableContributions || !currentExam.contributions || currentExam.contributions.length === 0) {
    return currentMark;
  }

  const contribSum = currentExam.contributions.reduce((sum, c) => sum + c.percentage, 0);
  const currentWeight = Math.max(0, 100 - contribSum);

  let totalObtained = 0;
  let totalCQ = 0;
  let totalMCQ = 0;
  let isAbsent = currentMark?.isAbsent ?? false;
  let hasCQ = false;
  let hasMCQ = false;
  let hasAnyMarks = false;

  // Add current exam's weighted marks
  if (currentWeight > 0) {
    if (currentMark) {
      hasAnyMarks = true;
      totalObtained += (currentMark.obtained || 0) * (currentWeight / 100);
      if (currentMark.obtainedCQ !== undefined) {
        totalCQ += currentMark.obtainedCQ * (currentWeight / 100);
        hasCQ = true;
      }
      if (currentMark.obtainedMCQ !== undefined) {
        totalMCQ += currentMark.obtainedMCQ * (currentWeight / 100);
        hasMCQ = true;
      }
    }
  }

  // Add contributor exams' weighted marks
  for (const contrib of currentExam.contributions) {
    const contribMark = marks.find(
      m => m.studentId === studentId && m.subjectId === subjectId && m.examId === contrib.examId
    );
    if (contribMark) {
      hasAnyMarks = true;
      totalObtained += (contribMark.obtained || 0) * (contrib.percentage / 100);
      if (contribMark.obtainedCQ !== undefined) {
        totalCQ += contribMark.obtainedCQ * (contrib.percentage / 100);
        hasCQ = true;
      }
      if (contribMark.obtainedMCQ !== undefined) {
        totalMCQ += contribMark.obtainedMCQ * (contrib.percentage / 100);
        hasMCQ = true;
      }
    }
  }

  if (!hasAnyMarks) return undefined;

  return {
    id: `consolidated-${studentId}-${subjectId}-${examId}`,
    studentId,
    subjectId,
    examId,
    obtained: Math.round(totalObtained),
    obtainedCQ: hasCQ ? Math.round(totalCQ) : undefined,
    obtainedMCQ: hasMCQ ? Math.round(totalMCQ) : undefined,
    isAbsent,
    total: currentMark?.total || 100
  };
};

export const calculateTotalGPA = (subjects: Subject[], marks: MarkRecord[], studentId: string, examId: string, studentGroup?: string, exams?: Exam[]): { totalMarks: number; gpa: number; grade: string; isFail: boolean; failCount: number } => {
  let totalMarks = 0;
  let totalGPA = 0;
  let count = 0;
  let isFail = false;
  let failCount = 0;
  
  // Filter subjects by student group
  const studentSubjects = subjects.filter(s => !s.group || s.group === 'All' || s.group === studentGroup);
  
  let optionalSubject: Subject | undefined = studentSubjects.find(s => s.isOptional);
  
  const coreSubjects = studentSubjects.filter(s => !s.isOptional);
  
  for (const sub of coreSubjects) {
    let mark = marks.find(m => m.studentId === studentId && m.subjectId === sub.id && m.examId === examId);
    if (exams) {
      const consolidated = getConsolidatedMark(studentId, sub.id, examId, exams, marks);
      if (consolidated) mark = consolidated;
    }
    let obtained = 0;
    let isSubjectFail = false;

    if (mark) {
        obtained = mark.obtained;
        if (mark.isAbsent) isSubjectFail = true;
        // Check separated pass marks
        if (sub.hasCQ && (mark.obtainedCQ ?? 0) < (sub.cqPassMarks ?? 0)) isSubjectFail = true;
        if (sub.hasMCQ && (mark.obtainedMCQ ?? 0) < (sub.mcqPassMarks ?? 0)) isSubjectFail = true;
        // Fallback or simple subject check
        if (!sub.hasCQ && !sub.hasMCQ && obtained < sub.passMarks) isSubjectFail = true;
    } else {
        // No marks entry counts as fail/absent in strict mode, currently treating as 0 marks
        if (!sub.hasCQ && !sub.hasMCQ && sub.passMarks > 0) isSubjectFail = true;
        else if (sub.hasCQ || sub.hasMCQ) isSubjectFail = true;
    }

    totalMarks += obtained;
    
    if (isSubjectFail) {
      isFail = true;
      failCount++;
    }

    const { gpa } = calculateGrade(obtained, sub.fullMarks);
    totalGPA += isSubjectFail ? 0 : gpa;
    count++;
  }

  if (optionalSubject) {
     let mark = marks.find(m => m.studentId === studentId && m.subjectId === optionalSubject.id && m.examId === examId);
     if (exams) {
        const consolidated = getConsolidatedMark(studentId, optionalSubject.id, examId, exams, marks);
        if (consolidated) mark = consolidated;
     }
     if (mark) {
        totalMarks += mark.obtained;
        // Optional subject doesn't cause fail if marks low, but adds to GPA if high
        const { gpa } = calculateGrade(mark.obtained, optionalSubject.fullMarks);
        if (gpa > 2.0) {
            totalGPA += (gpa - 2.0);
        }
     }
  }

  const finalGPA = count > 0 ? (totalGPA / count) : 0;
  const cappedGPA = finalGPA > 5.0 ? 5.0 : finalGPA;
  
  let finalGrade = 'F';
  if (isFail) {
      return { totalMarks, gpa: 0, grade: 'F', isFail: true, failCount };
  } else {
      if (cappedGPA >= 5.0) finalGrade = 'A+';
      else if (cappedGPA >= 4.0) finalGrade = 'A';
      else if (cappedGPA >= 3.5) finalGrade = 'A-';
      else if (cappedGPA >= 3.0) finalGrade = 'B';
      else if (cappedGPA >= 2.0) finalGrade = 'C';
      else if (cappedGPA >= 1.0) finalGrade = 'D';
      else finalGrade = 'F';
  }

  return { 
    totalMarks, 
    gpa: parseFloat(cappedGPA.toFixed(2)), 
    grade: finalGrade,
    isFail,
    failCount
  };
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const toBengali = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null) return '';
  const str = String(num);
  const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bengali = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.split('').map(c => {
    const index = english.indexOf(c);
    return index > -1 ? bengali[index] : c;
  }).join('');
};

export const formatNumber = (num: number | string | undefined | null, lang: Language): string => {
    if (num === undefined || num === null) return '';
    if (lang === 'bn') return toBengali(num);
    return String(num);
};

export const getAutoRemark = (gpa: number, isFail: boolean, failCount: number, lang: Language): string => {
    const t = translations[lang];
    if (isFail) {
        if (failCount > 1) return t.remarkFailMany;
        return t.remarkFailOne;
    }
    if (gpa >= 5.0) return t.remarkExcellent;
    if (gpa >= 4.0) return t.remarkGood;
    if (gpa >= 3.0) return t.remarkAverage;
    return t.remarkNeedsImprovement;
};

export const shortenSubjectName = (name: string): string => {
  if (!name) return '';
  let s = name.trim();

  // 1. Common long Bangladeshi madrasah and school subject names
  const specificMap: [RegExp, string][] = [
    [/আল-কুরআনুল\s*কারীম\s*ও\s*তাজবীদ/g, 'কুরআন'],
    [/আল-কুরআন\s*ও\s*তাজবীদ/g, 'কুরআন'],
    [/আল[\s-]কুরআনুল\s*কারীম/g, 'কুরআন'],
    [/আল[\s-]কুরআন/g, 'কুরআন'],
    [/কোরআন\s*মাজীদ|কোরআন\s*মাজিদ|আল[\s-]কোরআন/g, 'কুরআন'],
    [/হাদিস\s*শরীফ|হাদীস\s*শরীফ/g, 'হাদিস'],
    [/কাওয়াইদুল\s*লুগাতিল\s*আরাবিয়্যাহ/g, 'আরবি ২য়'],
    [/কাওয়াইদুল\s*লুগাহ/g, 'আরবি ২য়'],
    [/আদ-দুরূসুল\s*আরাবিয়্যাহ/g, 'আরবি ১ম'],
    [/আদ[\s-]দুরূস/g, 'আরবি ১ম'],
    [/আল-আকাইদ\s*ওয়াল\s*ফিকহ/g, 'আকাইদ'],
    [/আল\s*আকাঈদ\s*ওয়াল\s*ফিকহ্?/g, 'আকাইদ'],
    [/আকাইদ\s*ফিকাহ|আকাইদ\s*ফিকহ্?/g, 'আকাইদ'],
    [/আল-ফিকহ\s*ওয়াল\s*উসূল/g, 'ফিকহ'],
    [/ইসলাম\s*ও\s*নৈতিক\s*শিক্ষা/g, 'ইসলাম শিক্ষা'],
    [/ইসলামের\s*ইতিহাস/g, 'ইতিহাস'],
    [/তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি/g, 'আইসিটি'],
    [/বাংলাদেশ\s*ও\s*বিশ্ব\s*পরিচ[য়য়]/g, 'বি ও বিশ্ব'],
    [/শারীরিক\s*শিক্ষা[,\s]*স্বাস্থ্য\s*ও\s*খেলাধুলা/g, 'শারীরিক'],
    [/শারীরিক\s*শিক্ষা/g, 'শারীরিক'],
    [/কর্ম\s*ও\s*জীবনমুখী\s*শিক্ষা/g, 'কর্ম শিক্ষা'],
    [/উচ্চতর\s*গণিত/g, 'উচ্চতর গণিত'],
    [/সাধারণ\s*গণিত/g, 'গণিত'],
    [/সাধারণ\s*বিজ্ঞান/g, 'বিজ্ঞান'],
    [/পদার্থবিজ্ঞান|পদার্থ\s*বিজ্ঞান/g, 'পদার্থ'],
    [/রসায়ন|রসায়ন/g, 'রসায়ন'],
    [/জীববিজ্ঞান|জীব\s*বিজ্ঞান/g, 'জীব'],
    [/গার্হস্থ্য\s*বিজ্ঞান/g, 'গার্হস্থ্য'],
    [/কৃষি\s*শিক্ষা/g, 'কৃষি'],
    [/পৌরনীতি\s*ও\s*নাগরিকতা/g, 'পৌরনীতি'],
    [/বাংলাদেশের\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা/g, 'ইতিহাস'],
    [/ভূগোল\s*ও\s*পরিবেশ/g, 'ভূগোল'],
    [/ইসলাম\s*শিক্ষা/g, 'ইসলাম শিক্ষা'],
    [/ইংরেজি|ইংরেজী/g, 'ইংরেজি'],
    [/Information\s*&\s*Communication\s*Technology/gi, 'ICT'],
    [/Bangladesh\s*&\s*Global\s*Studies/gi, 'BGS'],
    [/Physical\s*Education/gi, 'P.E.'],
    [/General\s*Science/gi, 'Science'],
    [/General\s*Mathematics/gi, 'Math'],
    [/Higher\s*Mathematics/gi, 'H.Math'],
    [/Islamic\s*Studies/gi, 'Islam']
  ];

  for (const [pattern, replacement] of specificMap) {
    s = s.replace(pattern, replacement);
  }

  // 2. Paper name simplification (e.g., 'বাংলা ১ম পত্র' -> 'বাংলা ১ম', 'English 1st Paper' -> 'English 1st')
  s = s.replace(/\s*১ম\s*পত্র/g, ' ১ম');
  s = s.replace(/\s*২[য়য়]\s*পত্র/g, ' ২য়');
  s = s.replace(/\s*৩[য়য়]\s*পত্র/g, ' ৩য়');
  s = s.replace(/\s*৪র্থ\s*পত্র/g, ' ৪র্থ');
  s = s.replace(/\s*পত্র\b/g, '');

  s = s.replace(/\s*1st\s*Paper/gi, ' 1st');
  s = s.replace(/\s*2nd\s*Paper/gi, ' 2nd');
  s = s.replace(/\s*3rd\s*Paper/gi, ' 3rd');
  s = s.replace(/\s*Paper\b/gi, '');

  return s.trim();
};

/**
 * Converts a numeric amount to Bengali words (e.g. 5250 -> "পাঁচ হাজার দুই শত পঞ্চাশ টাকা মাত্র")
 */
export const amountToBengaliWords = (amount: number): string => {
  if (isNaN(amount) || amount === 0) return 'শূন্য টাকা মাত্র';
  
  const ones = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 
    'এগারো', 'বারো', 'তেরো', 'চোদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
    'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ', 'ত্রিশ',
    'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ',
    'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ',
    'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট',
    'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর',
    'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনাশি', 'আশি',
    'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'ঊননব্বই', 'নব্বই',
    'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    if (n < 100) return ones[n];
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${ones[h]} শত ${rest > 0 ? ones[rest] : ''}`.trim();
  };

  const integerPart = Math.floor(Math.abs(amount));
  
  const crore = Math.floor(integerPart / 10000000);
  let remainder = integerPart % 10000000;
  
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  
  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  
  const hundredAndRest = remainder;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertGroup(crore)} কোটি`);
  if (lakh > 0) parts.push(`${convertGroup(lakh)} লক্ষ`);
  if (thousand > 0) parts.push(`${convertGroup(thousand)} হাজার`);
  if (hundredAndRest > 0) parts.push(convertGroup(hundredAndRest));

  const words = parts.join(' ').trim();
  return words ? `${words} টাকা মাত্র` : 'শূন্য টাকা মাত্র';
};

/**
 * Converts a numeric amount to English words
 */
export const amountToEnglishWords = (amount: number): string => {
  if (isNaN(amount) || amount === 0) return 'Zero Taka only';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    return `${b[Math.floor(n / 10)]}${digit ? '-' + a[digit] : ''}`;
  };

  const inWords = (n: number): string => {
    if (n === 0) return '';
    let str = '';
    if (n >= 10000000) {
      str += `${inWords(Math.floor(n / 10000000))} Crore `;
      n %= 10000000;
    }
    if (n >= 100000) {
      str += `${inWords(Math.floor(n / 100000))} Lakh `;
      n %= 100000;
    }
    if (n >= 1000) {
      str += `${inWords(Math.floor(n / 1000))} Thousand `;
      n %= 1000;
    }
    if (n >= 100) {
      str += `${inWords(Math.floor(n / 100))} Hundred `;
      n %= 100;
    }
    if (n > 0) {
      str += numToWords(n);
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(amount));
  const res = inWords(integerPart);
  return res ? `${res} Taka Only` : 'Zero Taka Only';
};

/**
 * Format number into Bengali digits
 */
export const formatBanglaNumber = (num: number | string | undefined | null): string => {
  return toBengali(num);
};

/**
 * Generates an auto-incrementing voucher / receipt number
 */
export const generateVoucherNo = (type: 'INCOME' | 'EXPENSE', existingData: any[] | number = 0): string => {
  const prefix = type === 'INCOME' ? 'MR' : 'DV';
  const year = new Date().getFullYear();
  const count = typeof existingData === 'number' ? existingData : (Array.isArray(existingData) ? existingData.length : 0);
  const serial = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${serial}`;
};