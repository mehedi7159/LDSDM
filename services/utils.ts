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