import { SchoolClass, Student, Subject, Exam, MarkRecord } from '../types';

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
