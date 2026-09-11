import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { SchoolProfile, Student, Subject, Exam, MarkRecord, RemarkRecord, SchoolClass } from '../types';
import { generateId } from '../services/utils';
import { translations, Language } from '../services/translations';
import { generateSampleMadrashaData } from '../services/sampleData';
import { db, auth, googleProvider } from '../services/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

export interface TrashItem {
  id: string;
  type: 'student' | 'subject' | 'exam' | 'class';
  data: any;
  deletedAt: string;
}

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';
export type AppMode = 'admin' | 'viewer';

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
  cloudStatus: CloudSyncStatus;
  cloudLastSynced: string;
  mode: AppMode;
  isAdmin: boolean;
  authUser: User | null;
  adminEmail: string;
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
  loginAdmin: (pin: string) => boolean;
  loginWithGoogle: () => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  setAdminPinCode: (newPin: string) => void;
  setMode: (mode: AppMode) => void;
  forcePushToCloud: () => Promise<void>;
  forcePullFromCloud: () => Promise<void>;
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
  { id: '5', name: 'Class 5', order: 5 },
  { id: '6', name: 'Class 6', order: 6 },
  { id: '7', name: 'Class 7', order: 7 },
  { id: '8', name: 'Class 8', order: 8 },
  { id: '9', name: 'Class 9', order: 9 },
  { id: '10', name: 'Class 10', order: 10 },
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

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('students');
    return saved ? JSON.parse(saved) : [];
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('subjects');
    return saved ? JSON.parse(saved) : [];
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

  // Cloud Sync & Security State
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('syncing');
  const [cloudLastSynced, setCloudLastSynced] = useState<string>('Initializing...');
  
  // Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem('madrasha_admin_email') || 'mehedihasansagor26@gmail.com';
  });
  const [adminPin, setAdminPin] = useState<string>(() => {
    return localStorage.getItem('madrasha_admin_pin') || '';
  });
  const [mode, setModeState] = useState<AppMode>(() => {
    const saved = localStorage.getItem('madrasha_app_mode');
    return (saved === 'admin' || saved === 'viewer') ? saved : 'admin';
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('madrasha_admin_authenticated') === 'true';
  });

  const isRemoteUpdateRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor Firebase Auth changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
        setIsAdmin(true);
        setModeState('admin');
        if (user.email) {
          setAdminEmail(user.email);
          localStorage.setItem('madrasha_admin_email', user.email);
        }
        localStorage.setItem('madrasha_admin_authenticated', 'true');
        localStorage.setItem('madrasha_app_mode', 'admin');
      } else {
        setAuthUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Load from and Listen to Firebase Firestore in real-time
  useEffect(() => {
    const docRef = doc(db, 'institution', 'main_store');
    
    setCloudStatus('syncing');

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          isRemoteUpdateRef.current = true;

          if (data.schoolProfile) {
            setSchoolProfile(data.schoolProfile);
            localStorage.setItem('schoolProfile', JSON.stringify(data.schoolProfile));
          }
          if (data.students && Array.isArray(data.students)) {
            setStudents(data.students);
            localStorage.setItem('students', JSON.stringify(data.students));
          }
          if (data.subjects && Array.isArray(data.subjects)) {
            setSubjects(data.subjects);
            localStorage.setItem('subjects', JSON.stringify(data.subjects));
          }
          if (data.exams && Array.isArray(data.exams)) {
            setExams(data.exams);
            localStorage.setItem('exams', JSON.stringify(data.exams));
          }
          if (data.marks && Array.isArray(data.marks)) {
            setMarks(data.marks);
            localStorage.setItem('marks', JSON.stringify(data.marks));
          }
          if (data.remarks && Array.isArray(data.remarks)) {
            setRemarks(data.remarks);
            localStorage.setItem('remarks', JSON.stringify(data.remarks));
          }
          if (data.classes && Array.isArray(data.classes)) {
            setClasses(data.classes);
            localStorage.setItem('classes', JSON.stringify(data.classes));
          }
          if (data.trashBin && Array.isArray(data.trashBin)) {
            setTrashBin(data.trashBin);
            localStorage.setItem('madrasha_trash_bin', JSON.stringify(data.trashBin));
          }
          if (data.adminPin && typeof data.adminPin === 'string') {
            setAdminPin(data.adminPin);
            localStorage.setItem('madrasha_admin_pin', data.adminPin);
          }

          setCloudStatus('connected');
          const timeStr = new Date().toLocaleTimeString();
          setCloudLastSynced(timeStr);

          setTimeout(() => {
            isRemoteUpdateRef.current = false;
          }, 300);
        } else {
          // Document does not exist in Firestore yet: Perform initial seed migration from current local state
          const initialPayload = {
            schoolProfile,
            students,
            subjects,
            exams,
            marks,
            remarks,
            classes,
            trashBin,
            updatedAt: new Date().toISOString()
          };

          setDoc(docRef, initialPayload)
            .then(() => {
              setCloudStatus('connected');
              setCloudLastSynced(new Date().toLocaleTimeString());
            })
            .catch((err) => {
              console.error('Initial Firestore migration failed', err);
              setCloudStatus('offline');
            });
        }
      },
      (error) => {
        console.error('Firestore snapshot listener error', error);
        setCloudStatus('offline');
      }
    );

    return () => unsubscribe();
  }, []);

  // Background debounced auto-sync to Firebase Firestore on local state changes (when in Admin mode)
  useEffect(() => {
    if (isRemoteUpdateRef.current) return;
    if (!isAdmin) return; // Only sync writes when in Admin mode

    setCloudStatus('syncing');

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          schoolProfile,
          students,
          subjects,
          exams,
          marks,
          remarks,
          classes,
          trashBin,
          adminPin: adminPin || localStorage.getItem('madrasha_admin_pin') || '123456',
          updatedBy: adminEmail || 'mehedihasansagor26@gmail.com',
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'institution', 'main_store'), payload, { merge: true });
        setCloudStatus('connected');
        setCloudLastSynced(new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Failed to sync changes to Firestore', err);
        setCloudStatus('offline');
      }
    }, 800);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [schoolProfile, students, subjects, exams, marks, remarks, classes, trashBin, isAdmin, adminEmail]);

  // Offline LocalStorage updates
  useEffect(() => {
    localStorage.setItem('schoolProfile', JSON.stringify(schoolProfile));
  }, [schoolProfile]);

  useEffect(() => {
    localStorage.setItem('classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('madrasha_trash_bin', JSON.stringify(trashBin));
  }, [trashBin]);

  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('marks', JSON.stringify(marks));
  }, [marks]);

  useEffect(() => {
    localStorage.setItem('remarks', JSON.stringify(remarks));
  }, [remarks]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Force Push/Pull functions
  const forcePushToCloud = async () => {
    setCloudStatus('syncing');
    try {
      const payload = {
        schoolProfile,
        students,
        subjects,
        exams,
        marks,
        remarks,
        classes,
        trashBin,
        adminPin: adminPin || localStorage.getItem('madrasha_admin_pin') || '123456',
        updatedBy: adminEmail || 'mehedihasansagor26@gmail.com',
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'institution', 'main_store'), payload);
      setCloudStatus('connected');
      setCloudLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      setCloudStatus('error');
      throw e;
    }
  };

  const forcePullFromCloud = async () => {
    setCloudStatus('syncing');
    try {
      const snap = await getDoc(doc(db, 'institution', 'main_store'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.schoolProfile) setSchoolProfile(data.schoolProfile);
        if (data.students) setStudents(data.students);
        if (data.subjects) setSubjects(data.subjects);
        if (data.exams) setExams(data.exams);
        if (data.marks) setMarks(data.marks);
        if (data.remarks) setRemarks(data.remarks);
        if (data.classes) setClasses(data.classes);
        if (data.trashBin) setTrashBin(data.trashBin);
        if (data.adminPin && typeof data.adminPin === 'string') {
          setAdminPin(data.adminPin);
          localStorage.setItem('madrasha_admin_pin', data.adminPin);
        }
        setCloudStatus('connected');
        setCloudLastSynced(new Date().toLocaleTimeString());
      }
    } catch (e) {
      setCloudStatus('error');
      throw e;
    }
  };

  // Mode switching
  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('madrasha_app_mode', newMode);
  };

  // Google Login Auth
  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setAuthUser(result.user);
        setIsAdmin(true);
        setModeState('admin');
        if (result.user.email) {
          setAdminEmail(result.user.email);
          localStorage.setItem('madrasha_admin_email', result.user.email);
        }
        localStorage.setItem('madrasha_admin_authenticated', 'true');
        localStorage.setItem('madrasha_app_mode', 'admin');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Google sign-in popup notice:', err);
      // If popup is blocked in preview or iframe, fall back to email / PIN auth
      return false;
    }
  };

  // PIN code login
  const loginAdmin = (pin: string): boolean => {
    const activePin = (adminPin || localStorage.getItem('madrasha_admin_pin') || '123456').trim();
    if (pin && pin.trim() === activePin) {
      setIsAdmin(true);
      setModeState('admin');
      setAdminEmail('mehedihasansagor26@gmail.com');
      localStorage.setItem('madrasha_admin_authenticated', 'true');
      localStorage.setItem('madrasha_app_mode', 'admin');
      localStorage.setItem('madrasha_admin_email', 'mehedihasansagor26@gmail.com');
      return true;
    }
    return false;
  };

  const logoutAdmin = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setIsAdmin(false);
    setAuthUser(null);
    setModeState('viewer');
    localStorage.setItem('madrasha_admin_authenticated', 'false');
    localStorage.setItem('madrasha_app_mode', 'viewer');
  };

  const setAdminPinCode = async (newPin: string) => {
    const cleanPin = newPin.trim();
    setAdminPin(cleanPin);
    localStorage.setItem('madrasha_admin_pin', cleanPin);
    try {
      await setDoc(doc(db, 'institution', 'main_store'), { adminPin: cleanPin }, { merge: true });
    } catch (err) {
      console.error('Failed to sync new PIN to Firestore', err);
    }
  };

  // State manipulation handlers
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
    setStudents(prev => [...prev, rawStudent]);
  };

  const updateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
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
    setSubjects(prev => [...prev, rawSubject]);
  };

  const updateSubject = (updatedSubject: Subject) => {
    setSubjects(prev => prev.map(s => s.id === updatedSubject.id ? updatedSubject : s));
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
        return prev.map(m => m.id === existing.id ? { ...existing, ...markData } : m);
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
      cloudStatus,
      cloudLastSynced,
      mode,
      isAdmin,
      authUser,
      adminEmail,
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
      loginAdmin,
      loginWithGoogle,
      logoutAdmin,
      setAdminPinCode,
      setMode,
      forcePushToCloud,
      forcePullFromCloud,
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
