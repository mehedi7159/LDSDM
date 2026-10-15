import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Student } from '../types';
import { 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Users, 
  AlertCircle, 
  Sparkles, 
  RotateCcw,
  CheckSquare,
  Square,
  ShieldCheck,
  TrendingUp,
  Award
} from 'lucide-react';
import { Button } from './ui/Button';
import { recordStudentAuditEvent } from '../services/studentService';

interface StudentPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClass?: string;
}

export const StudentPromotionModal: React.FC<StudentPromotionModalProps> = ({
  isOpen,
  onClose,
  initialClass
}) => {
  const { 
    students, 
    updateStudent, 
    classes, 
    language, 
    authUser, 
    isSuperAdmin, 
    authClaims,
    schoolProfile 
  } = useApp();

  const [fromClass, setFromClass] = useState<string>(() => {
    if (initialClass && initialClass !== 'All') return initialClass;
    return classes[0]?.name || '';
  });

  const [toClass, setToClass] = useState<string>(() => {
    const currentIndex = classes.findIndex(c => c.name === fromClass);
    if (currentIndex >= 0 && currentIndex + 1 < classes.length) {
      return classes[currentIndex + 1].name;
    }
    return classes[1]?.name || 'GRADUATED';
  });

  const [targetAcademicYear, setTargetAcademicYear] = useState<string>(() => {
    const currentYear = parseInt(schoolProfile?.academicYear || '2026', 10);
    return isNaN(currentYear) ? '2027' : String(currentYear + 1);
  });

  const [rollAssignmentMode, setRollAssignmentMode] = useState<'keep' | 'reorder' | 'custom'>('keep');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [customRolls, setCustomRolls] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Eligible students in 'fromClass' (Active & non-former)
  const eligibleStudents = useMemo(() => {
    return students
      .filter(s => s.classLevel === fromClass && s.status === 'Active' && !s.isFormer)
      .sort((a, b) => {
        const rollA = parseInt(a.roll || '0', 10);
        const rollB = parseInt(b.roll || '0', 10);
        return rollA - rollB;
      });
  }, [students, fromClass]);

  // Sync selected students when fromClass changes
  React.useEffect(() => {
    setSelectedStudentIds(new Set(eligibleStudents.map(s => s.id)));
    // Auto suggest next class
    const currentIndex = classes.findIndex(c => c.name === fromClass);
    if (currentIndex >= 0 && currentIndex + 1 < classes.length) {
      setToClass(classes[currentIndex + 1].name);
    } else {
      setToClass('GRADUATED');
    }
  }, [fromClass, classes, eligibleStudents]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === eligibleStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleStudents.map(s => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleCustomRollChange = (studentId: string, value: string) => {
    setCustomRolls(prev => ({ ...prev, [studentId]: value }));
  };

  const handlePromote = async () => {
    if (selectedStudentIds.size === 0) {
      setErrorMessage(language === 'bn' ? 'দয়া করে কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন।' : 'Please select at least one student.');
      return;
    }

    if (!toClass) {
      setErrorMessage(language === 'bn' ? 'উত্তীর্ণের পরবর্তী শ্রেণি নির্বাচন করুন।' : 'Please select the target class.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPromotionSuccess(null);

    try {
      const isGraduation = toClass === 'GRADUATED';
      let promotedCount = 0;

      // Process students in their sorted order
      eligibleStudents.forEach((student, index) => {
        if (!selectedStudentIds.has(student.id)) return;

        let newRoll = student.roll || '';
        if (rollAssignmentMode === 'reorder') {
          newRoll = String(index + 1);
        } else if (rollAssignmentMode === 'custom') {
          newRoll = customRolls[student.id] || student.roll || String(index + 1);
        }

        const updatedStudent: Student = isGraduation
          ? {
              ...student,
              status: 'Former',
              isFormer: true,
              leavingReason: language === 'bn' ? 'কোর্স সম্পন্ন / উত্তীর্ণ (Graduated)' : 'Graduated / Course Completed',
              leavingDate: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
              updatedBy: authUser?.email || 'admin'
            }
          : {
              ...student,
              classLevel: toClass,
              roll: newRoll,
              rollNumber: newRoll,
              academicYearId: targetAcademicYear,
              updatedAt: new Date().toISOString(),
              updatedBy: authUser?.email || 'admin'
            };

        updateStudent(updatedStudent);
        promotedCount++;

        if (authUser) {
          recordStudentAuditEvent({
            action: isGraduation ? 'STUDENT_ARCHIVED' : 'STUDENT_UPDATED',
            student: updatedStudent,
            actor: {
              uid: authUser.uid,
              email: authUser.email || '',
              role: isSuperAdmin ? 'superadmin' : (authClaims?.role || 'admin')
            },
            before: {
              classLevel: fromClass,
              roll: student.roll,
              status: student.status
            }
          });
        }
      });

      setPromotionSuccess(
        language === 'bn'
          ? `আলহামদুলিল্লাহ! ${promotedCount} জন শিক্ষার্থী সফলভাবে "${toClass === 'GRADUATED' ? 'উত্তীর্ণ ও কোর্স সম্পন্ন' : toClass}" শ্রেণিতে প্রমোশন পেয়েছে।`
          : `Successfully promoted ${promotedCount} students to "${toClass === 'GRADUATED' ? 'Graduated' : toClass}".`
      );

      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    } catch (err: any) {
      console.error('Promotion error:', err);
      setErrorMessage(err?.message || 'Error occurred while promoting students.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-amber-300 shadow-md">
              <GraduationCap size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {language === 'bn' ? 'শিক্ষার্থী শ্রেণি প্রমোশন (Student Promotion)' : 'Student Promotion & Year Transition'}
              </h2>
              <p className="text-xs text-indigo-200 font-medium">
                {language === 'bn' 
                  ? 'শিক্ষাবর্ষ শেষে এক শ্রেণি থেকে পরবর্তী শ্রেণিতে শিক্ষার্থীদের স্বয়ংক্রিয় প্রমোশন দিন' 
                  : 'Batch promote students to the next grade level for the upcoming academic session'}
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

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Success Banner */}
          {promotionSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div className="flex-1 text-xs font-bold leading-relaxed">{promotionSuccess}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 animate-in fade-in">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <div className="flex-1 text-xs font-bold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Source & Destination Class Selector Card */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* From Class */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                {language === 'bn' ? 'বর্তমান শ্রেণি (From Class) *' : 'Current Class *'}
              </label>
              <select
                value={fromClass}
                onChange={(e) => setFromClass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Target Class */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                <span>{language === 'bn' ? 'উত্তীর্ণের শ্রেণি (Target Class) *' : 'Promote To *'}</span>
                <Sparkles size={13} className="text-amber-500" />
              </label>
              <select
                value={toClass}
                onChange={(e) => setToClass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-xl bg-indigo-50/50 font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="GRADUATED" className="text-amber-800 font-bold">
                  {language === 'bn' ? '🎓 কোর্স সম্পন্ন / উত্তীর্ণ (Graduate)' : '🎓 Graduated / Alum'}
                </option>
              </select>
            </div>

            {/* Target Academic Year */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                {language === 'bn' ? 'নতুন শিক্ষাবর্ষ (Academic Session)' : 'Next Academic Year'}
              </label>
              <input
                type="text"
                value={targetAcademicYear}
                onChange={(e) => setTargetAcademicYear(e.target.value)}
                placeholder="2027"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Roll Reassignment Strategy */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <TrendingUp size={15} />
              <span>{language === 'bn' ? 'নতুন শ্রেণিতে রোল নম্বর নির্ধারণ:' : 'Roll Assignment Mode:'}</span>
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="rollMode"
                  checked={rollAssignmentMode === 'keep'}
                  onChange={() => setRollAssignmentMode('keep')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>{language === 'bn' ? 'বর্তমান রোল রাখুন' : 'Retain Current'}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="rollMode"
                  checked={rollAssignmentMode === 'reorder'}
                  onChange={() => setRollAssignmentMode('reorder')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>{language === 'bn' ? 'ধারাবাহিক (১, ২, ৩...)' : 'Sequential 1..N'}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="rollMode"
                  checked={rollAssignmentMode === 'custom'}
                  onChange={() => setRollAssignmentMode('custom')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>{language === 'bn' ? 'কাস্টম ইনপুট' : 'Custom'}</span>
              </label>
            </div>
          </div>

          {/* Students List Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
                >
                  {selectedStudentIds.size === eligibleStudents.length ? (
                    <>
                      <CheckSquare size={14} className="text-indigo-600" />
                      <span>{language === 'bn' ? 'সব বাতিল করুন' : 'Deselect All'}</span>
                    </>
                  ) : (
                    <>
                      <Square size={14} />
                      <span>{language === 'bn' ? 'সবাইকে নির্বাচন করুন' : 'Select All'}</span>
                    </>
                  )}
                </button>
                <span className="text-slate-500 font-medium">
                  {language === 'bn'
                    ? `নির্বাচিত: ${selectedStudentIds.size} / ${eligibleStudents.length} জন`
                    : `Selected: ${selectedStudentIds.size} of ${eligibleStudents.length}`}
                </span>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                {fromClass} ➔ {toClass}
              </span>
            </div>

            {eligibleStudents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold">
                  {language === 'bn' 
                    ? `"${fromClass}" শ্রেণিতে কোনো সক্রিয় নিয়মিত শিক্ষার্থী নেই।` 
                    : `No active students found in "${fromClass}".`}
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">✓</th>
                      <th className="p-2.5">{language === 'bn' ? 'বর্তমান রোল' : 'Current Roll'}</th>
                      <th className="p-2.5">{language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name'}</th>
                      <th className="p-2.5">{language === 'bn' ? 'পিতার নাম / অভিভাবক' : 'Guardian'}</th>
                      <th className="p-2.5">{language === 'bn' ? 'প্রমোশন পরবর্তী রোল' : 'New Roll'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleStudents.map((student, idx) => {
                      const isSelected = selectedStudentIds.has(student.id);
                      let previewRoll = student.roll || '';
                      if (rollAssignmentMode === 'reorder') {
                        previewRoll = String(idx + 1);
                      } else if (rollAssignmentMode === 'custom') {
                        previewRoll = customRolls[student.id] || student.roll || String(idx + 1);
                      }

                      return (
                        <tr 
                          key={student.id}
                          onClick={() => toggleStudent(student.id)}
                          className={`hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/20' : 'opacity-60 bg-white'
                          }`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudent(student.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">
                            {student.roll || '-'}
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold text-slate-900 block">{student.name}</span>
                            <span className="text-[10px] text-slate-400">{student.studentId || student.id.slice(0, 8)}</span>
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {student.fatherName || student.guardianName || '-'}
                          </td>
                          <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                            {rollAssignmentMode === 'custom' ? (
                              <input
                                type="text"
                                value={customRolls[student.id] || student.roll || ''}
                                onChange={(e) => handleCustomRollChange(student.id, e.target.value)}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold"
                              />
                            ) : (
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                {previewRoll}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>

          <Button
            onClick={handlePromote}
            disabled={isProcessing || selectedStudentIds.size === 0 || eligibleStudents.length === 0}
            className="px-6 py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            <GraduationCap size={16} />
            <span>
              {isProcessing
                ? (language === 'bn' ? 'প্রমোশন প্রসেস হচ্ছে...' : 'Processing Promotion...')
                : (language === 'bn' 
                    ? `নির্বাচিত ${selectedStudentIds.size} জনকে প্রমোশন দিন` 
                    : `Promote Selected (${selectedStudentIds.size})`)}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
