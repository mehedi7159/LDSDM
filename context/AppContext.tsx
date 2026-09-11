import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SchoolProfile, Student, Subject, Exam, MarkRecord, RemarkRecord, SchoolClass } from '../types';
import { generateId } from '../services/utils';
import { translations, Language } from '../services/translations';
import { generateSampleMadrashaData } from '../services/sampleData';

export interface TrashItem {
  id: string;
  type: 'student' | 'subject' | 'exam' | 'class';
  data: any;
  deletedAt: string;
}

interface AppState {
  schoolProfile: SchoolProfile;
  students: Student[];
  subjects: Subject[];
  exams: Exam[];
  marks: MarkRecord[];
  remarks: RemarkRecord[];
  classes: SchoolClass[];
  language: Language;
  trashBin: TrashItem[];
}

interface AppContextType extends AppState {
  updateSchoolProfile: (profile: SchoolProfile) => void;
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (student: Student) => void;
  deleteStudent: (id: string) => void;
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  updateSubject: (subject: Subject) => void;
  deleteSubject: (id: string) => void;
  updateMark: (mark: Omit<MarkRecord, 'id'> & { id?: string }) => void;
  bulkUpdateMarks: (newMarks: (Omit<MarkRecord, 'id'> & { id?: string })[]) => void;
  setExams: (exams: Exam[]) => void;
  addExam: (name: string, category: Exam['category'], nameBn?: string) => void;
  updateExam: (exam: Exam) => void;
  deleteExam: (id: string) => void;
  updateRemark: (studentId: string, examId: string, data: Partial<RemarkRecord>) => void;
  addClass: (name: string, nameBn?: string) => void;
  updateClass: (cls: SchoolClass) => void;
  deleteClass: (id: string) => void;
  restoreFromTrash: (trashId: string) => void;
  emptyTrash: () => void;
  setLanguage: (lang: Language) => void;
  setStudents: (students: Student[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setClasses: (classes: SchoolClass[]) => void;
  setMarks: (marks: MarkRecord[]) => void;
  setRemarks: (remarks: RemarkRecord[]) => void;
  seedDemoMadrashaData: () => void;
  t: (key: keyof typeof translations['en']) => string;
}

const defaultSchoolProfile: SchoolProfile = {
  name: 'MADRASHA MANAGEMENT HIGH SCHOOL',
  address: '123 Education Road, Dhaka, Bangladesh',
  phone: '+880 1234 567890',
  email: 'info@madrasha.edu.bd',
  academicYear: new Date().getFullYear().toString(),
  headMasterName: 'Moulana Abdul Karim',
  resultCardTemplate: 'Classic',
  showHeadmasterSignature: true,
  showGuardianSignature: true,
  banglaFont: 'Hind Siliguri',
  banglaNumberFont: 'Hind Siliguri',
};

const defaultClasses: SchoolClass[] = [
    { id: '1', name: 'Play', order: 1 },
    { id: '2', name: 'Class 1', order: 2 },
    { id: '3', name: 'Class 2', order: 3 },
    { id: '4', name: 'Class 3', order: 4 },
    { id: '5', name: 'Class 4', order: 5 },
    { id: '6', name: 'Class 5', order: 6 },
    { id: '7', name: 'Class 6', order: 7 },
    { id: '8', name: 'Class 7', order: 8 },
    { id: '9', name: 'Class 8', order: 9 },
    { id: '10', name: 'Class 9', order: 10 },
    { id: '11', name: 'Class 10', order: 11 },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => {
    const saved = localStorage.getItem('schoolProfile');
    return saved ? JSON.parse(saved) : defaultSchoolProfile;
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
      const saved = localStorage.getItem('classes');
      return saved ? JSON.parse(saved) : defaultClasses;
  });

  const [trashBin, setTrashBin] = useState<TrashItem[]>(() => {
      const saved = localStorage.getItem('madrasha_trash_bin');
      return saved ? JSON.parse(saved) : [];
  });

  const applyStudentGroupRules = (s: Student): Student => {
    let status: 'Active' | 'Inactive' | 'Former' = 'Active';
    if (s.isFormer || s.status === 'Former') {
      status = 'Former';
    } else if (s.status === 'Inactive') {
      status = 'Inactive';
    } else {
      status = 'Active';
    }

    const updated: Student = {
      ...s,
      status,
      isFormer: status === 'Former',
    };

    if (s.classLevel === 'Class 9' || s.classLevel === '৯ম শ্রেণী') {
      if (s.studentId === '2609190' || s.studentId === '2609195') {
        return { ...updated, group: 'Science' };
      } else {
        return { ...updated, group: 'General' };
      }
    } else if (s.classLevel === 'Class 10' || s.classLevel === '১০ম শ্রেণী') {
      return { ...updated, group: 'General' };
    }
    return updated;
  };

  const applySubjectGroupRules = (s: Subject): Subject => {
    if (s.classLevel === 'Class 9' || s.classLevel === 'Class 10' || s.classLevel === '৯ম শ্রেণী' || s.classLevel === '১০ম শ্রেণী') {
      if (s.group && s.group !== 'All') {
        return s;
      }
      const isHistory = (s.name && s.name.toLowerCase().includes('history')) || 
                        (s.nameBn && s.nameBn.includes('ইতিহাস'));
      if (isHistory) {
        return { ...s, group: 'General' };
      }
      const isScience = (s.name && (
        s.name.toLowerCase().includes('physics') || 
        s.name.toLowerCase().includes('chemistry') || 
        s.name.toLowerCase().includes('biology') || 
        s.name.toLowerCase().includes('higher math')
      )) || (s.nameBn && (
        s.nameBn.includes('পদার্থ') || 
        s.nameBn.includes('রসায়ন') || 
        s.nameBn.includes('রসায়ন') || 
        s.nameBn.includes('জীব') || 
        s.nameBn.includes('উচ্চতর গণিত')
      ));
      if (isScience) {
        return { ...s, group: 'Science' };
      }
      return { ...s, group: s.group || 'All' };
    }
    return s;
  };

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('students');
    const parsed: Student[] = saved ? JSON.parse(saved) : [];
    return parsed.map(applyStudentGroupRules);
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('subjects');
    const parsed: Subject[] = saved ? JSON.parse(saved) : [];
    return parsed.map(applySubjectGroupRules);
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('exams');
    return saved ? JSON.parse(saved) : [{ id: '1', name: 'Annual Examination', academicYear: '2024', category: 'Term' }];
  });

  const [marks, setMarks] = useState<MarkRecord[]>(() => {
    const saved = localStorage.getItem('marks');
    return saved ? JSON.parse(saved) : [];
  });

  const [remarks, setRemarks] = useState<RemarkRecord[]>(() => {
    const saved = localStorage.getItem('remarks');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('schoolProfile', JSON.stringify(schoolProfile));
    } catch (e) {
      console.error('Failed to save schoolProfile to localStorage', e);
    }
  }, [schoolProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('classes', JSON.stringify(classes));
    } catch (e) {
      console.error('Failed to save classes to localStorage', e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem('madrasha_trash_bin', JSON.stringify(trashBin));
    } catch (e) {
      console.error('Failed to save trashBin', e);
    }
  }, [trashBin]);

  useEffect(() => {
    try {
      localStorage.setItem('students', JSON.stringify(students));
    } catch (e) {
      console.error('Failed to save students to localStorage', e);
    }
  }, [students]);

  useEffect(() => {
    try {
      localStorage.setItem('subjects', JSON.stringify(subjects));
    } catch (e) {
      console.error('Failed to save subjects to localStorage', e);
    }
  }, [subjects]);

  useEffect(() => {
    try {
      localStorage.setItem('exams', JSON.stringify(exams));
    } catch (e) {
      console.error('Failed to save exams to localStorage', e);
    }
  }, [exams]);

  useEffect(() => {
    try {
      localStorage.setItem('marks', JSON.stringify(marks));
    } catch (e) {
      console.error('Failed to save marks to localStorage', e);
    }
  }, [marks]);

  useEffect(() => {
    try {
      localStorage.setItem('remarks', JSON.stringify(remarks));
    } catch (e) {
      console.error('Failed to save remarks to localStorage', e);
    }
  }, [remarks]);

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch (e) {
      console.error('Failed to save language to localStorage', e);
    }
  }, [language]);

  const updateSchoolProfile = (profile: SchoolProfile) => {
    setSchoolProfile(profile);
    setExams(prev => prev.map(e => ({ ...e, academicYear: profile.academicYear })));
  };

  const addClass = (name: string, nameBn?: string) => {
      setClasses(prev => [...prev, { id: generateId(), name, nameBn, order: prev.length + 1 }]);
  };

  const updateClass = (updatedClass: SchoolClass) => {
      setClasses(prev => prev.map(c => c.id === updatedClass.id ? updatedClass : c));
  };

  const deleteClass = (id: string) => {
      const cls = classes.find(c => c.id === id);
      if (cls) {
          setTrashBin(prev => [{ id: generateId(), type: 'class', data: cls, deletedAt: new Date().toLocaleString() }, ...prev]);
          setClasses(prev => prev.filter(c => c.id !== id));
      }
  };

  const addStudent = (student: Omit<Student, 'id'>) => {
    const rawStudent = { ...student, id: generateId() } as Student;
    const newStudent = applyStudentGroupRules(rawStudent);
    setStudents(prev => [...prev, newStudent]);
  };

  const updateStudent = (updatedStudent: Student) => {
    const ruledStudent = applyStudentGroupRules(updatedStudent);
    setStudents(prev => prev.map(s => s.id === ruledStudent.id ? ruledStudent : s));
  };

  const deleteStudent = (id: string) => {
    const st = students.find(s => s.id === id);
    if (st) {
        setTrashBin(prev => [{ id: generateId(), type: 'student', data: st, deletedAt: new Date().toLocaleString() }, ...prev]);
        setStudents(prev => prev.filter(s => s.id !== id));
    }
  };

  const addSubject = (subject: Omit<Subject, 'id'>) => {
    const rawSubject = { ...subject, id: generateId() } as Subject;
    const newSubject = applySubjectGroupRules(rawSubject);
    setSubjects(prev => [...prev, newSubject]);
  };

  const updateSubject = (updatedSubject: Subject) => {
    const ruledSubject = applySubjectGroupRules(updatedSubject);
    setSubjects(prev => prev.map(s => s.id === ruledSubject.id ? ruledSubject : s));
  };

  const deleteSubject = (id: string) => {
    const sub = subjects.find(s => s.id === id);
    if (sub) {
        setTrashBin(prev => [{ id: generateId(), type: 'subject', data: sub, deletedAt: new Date().toLocaleString() }, ...prev]);
        setSubjects(prev => prev.filter(s => s.id !== id));
    }
  };

  const updateMark = (markData: Omit<MarkRecord, 'id'> & { id?: string }) => {
    setMarks(prev => {
      const existing = prev.find(m => m.studentId === markData.studentId && m.subjectId === markData.subjectId && m.examId === markData.examId);
      if (existing) {
        return prev.map(m => m.id === existing.id ? { ...existing, obtained: markData.obtained, obtainedCQ: markData.obtainedCQ, obtainedMCQ: markData.obtainedMCQ } : m);
      } else {
        return [...prev, { ...markData, id: generateId() }];
      }
    });
  };

  const bulkUpdateMarks = (newMarks: (Omit<MarkRecord, 'id'> & { id?: string })[]) => {
      setMarks(prev => {
          const marksMap = new Map();
          prev.forEach(m => marksMap.set(`${m.studentId}-${m.subjectId}-${m.examId}`, m));
          
          newMarks.forEach(newData => {
              const key = `${newData.studentId}-${newData.subjectId}-${newData.examId}`;
              const existing = marksMap.get(key);
              if (existing) {
                  marksMap.set(key, { ...existing, ...newData });
              } else {
                  marksMap.set(key, { ...newData, id: generateId() });
              }
          });
          
          return Array.from(marksMap.values());
      });
  };

  const addExam = (name: string, category: Exam['category'], nameBn?: string) => {
    setExams(prev => [...prev, { id: generateId(), name, nameBn, academicYear: schoolProfile.academicYear, category }]);
  };

  const updateExam = (updatedExam: Exam) => {
    setExams(prev => prev.map(e => e.id === updatedExam.id ? updatedExam : e));
  };

  const deleteExam = (id: string) => {
    const exam = exams.find(e => e.id === id);
    if (exam) {
        setTrashBin(prev => [{ id: generateId(), type: 'exam', data: exam, deletedAt: new Date().toLocaleString() }, ...prev]);
        setExams(prev => prev.filter(e => e.id !== id));
    }
  };

  const restoreFromTrash = (trashId: string) => {
      const item = trashBin.find(t => t.id === trashId);
      if (!item) return;

      if (item.type === 'student') {
          setStudents(prev => [...prev, item.data]);
      } else if (item.type === 'subject') {
          setSubjects(prev => [...prev, item.data]);
      } else if (item.type === 'exam') {
          setExams(prev => [...prev, item.data]);
      } else if (item.type === 'class') {
          setClasses(prev => [...prev, item.data]);
      }

      setTrashBin(prev => prev.filter(t => t.id !== trashId));
  };

  const emptyTrash = () => {
      if (confirm(language === 'bn' ? 'আপনি কি নিশ্চিত যে রিসাইকেল বিন স্থায়ীভাবে খালি করতে চান?' : 'Are you sure you want to permanently empty recycle bin?')) {
          setTrashBin([]);
      }
  };

  const updateRemark = (studentId: string, examId: string, data: Partial<RemarkRecord>) => {
    setRemarks(prev => {
        const existing = prev.find(r => r.studentId === studentId && r.examId === examId);
        if (existing) {
            return prev.map(r => r.studentId === studentId && r.examId === examId ? { ...r, ...data } : r);
        } else {
            return [...prev, { studentId, examId, remark: '', ...data }];
        }
    });
  };

  const seedDemoMadrashaData = () => {
    const { sampleStudents, sampleSubjects, sampleMarks, sampleExams } = generateSampleMadrashaData(classes, exams);
    if (sampleExams && sampleExams.length > exams.length) {
      setExams(sampleExams);
    }
    setStudents(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const toAdd = sampleStudents.filter(s => !existingIds.has(s.id));
      return [...prev, ...toAdd];
    });
    setSubjects(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const toAdd = sampleSubjects.filter(s => !existingIds.has(s.id));
      return [...prev, ...toAdd];
    });
    setMarks(prev => {
      const existingKeys = new Set(prev.map(m => `${m.studentId}-${m.subjectId}-${m.examId}`));
      const toAdd = sampleMarks.filter(m => !existingKeys.has(`${m.studentId}-${m.subjectId}-${m.examId}`));
      return [...prev, ...toAdd];
    });
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <AppContext.Provider value={{
      schoolProfile,
      students,
      subjects,
      exams,
      marks,
      remarks,
      classes,
      language,
      trashBin,
      updateSchoolProfile,
      addStudent,
      updateStudent,
      deleteStudent,
      addSubject,
      updateSubject,
      deleteSubject,
      updateMark,
      bulkUpdateMarks,
      setExams,
      addExam,
      updateExam,
      deleteExam,
      updateRemark,
      addClass,
      updateClass,
      deleteClass,
      restoreFromTrash,
      emptyTrash,
      setLanguage,
      setStudents,
      setSubjects,
      setClasses,
      setMarks,
      setRemarks,
      seedDemoMadrashaData,
      t
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
