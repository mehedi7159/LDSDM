import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SchoolClass, Student } from '../../types';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { 
  Layers, 
  Users, 
  UserCheck, 
  UserX, 
  GraduationCap, 
  Printer, 
  Eye, 
  ArrowRight,
  BookOpen,
  Calendar
} from 'lucide-react';

interface ClassSectionMatrixViewProps {
  onSelectClass: (className: string) => void;
  onOpenPromotion: (className: string) => void;
}

export const ClassSectionMatrixView: React.FC<ClassSectionMatrixViewProps> = ({
  onSelectClass,
  onOpenPromotion
}) => {
  const { classes = [], students = [], teachers = [], language } = useApp();
  const isBn = language === 'bn';

  // Compute breakdown for each class
  const classBreakdowns = useMemo(() => {
    return classes.map(cls => {
      const clsStudents = students.filter(s => 
        (s.classLevel === cls.name || s.classId === cls.id) && !s.isFormer && s.status !== 'Former'
      );

      const activeCount = clsStudents.filter(s => s.status === 'Active' || (s as any).status === 'active').length;
      const inactiveCount = clsStudents.filter(s => s.status === 'Inactive' || (s as any).status === 'inactive').length;
      const maleCount = clsStudents.filter(s => s.gender === 'male' || !s.gender).length;
      const femaleCount = clsStudents.filter(s => s.gender === 'female').length;

      return {
        cls,
        total: clsStudents.length,
        activeCount,
        inactiveCount,
        maleCount,
        femaleCount,
        students: clsStudents
      };
    });
  }, [classes, students]);

  const totalCurrentStudents = useMemo(() => {
    return students.filter(s => !s.isFormer && s.status !== 'Former').length;
  }, [students]);

  return (
    <div className="space-y-6">
      
      {/* Top Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{isBn ? 'মোট শ্রেণি / জামাত' : 'Total Classes'}</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{formatNumber(classes.length, language)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-teal-200 dark:border-teal-800 shadow-2xs bg-teal-50/30">
          <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase">{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</p>
          <p className="text-2xl font-black text-teal-900 dark:text-teal-200 mt-1">{formatNumber(totalCurrentStudents, language)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-2xs bg-emerald-50/30">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">{isBn ? 'গড় শিক্ষার্থী প্রতি শ্রেণি' : 'Average / Class'}</p>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">
            {formatNumber(classes.length > 0 ? Math.round(totalCurrentStudents / classes.length) : 0, language)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-2xs bg-indigo-50/30">
          <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase">{isBn ? 'সর্বোচ্চ শিক্ষার্থী শ্রেণি' : 'Largest Class'}</p>
          <p className="text-lg font-black text-indigo-900 dark:text-indigo-200 mt-1 truncate">
            {(() => {
              if (classBreakdowns.length === 0) return '—';
              const maxCls = [...classBreakdowns].sort((a, b) => b.total - a.total)[0];
              return maxCls ? `${maxCls.cls.name} (${formatNumber(maxCls.total, language)})` : '—';
            })()}
          </p>
        </div>
      </div>

      {/* Class Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classBreakdowns.map(({ cls, total, activeCount, inactiveCount, maleCount, femaleCount }) => (
          <div 
            key={cls.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-800 dark:text-teal-300 font-bold">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">{cls.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{cls.nameBn || cls.name}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg">
                  {formatNumber(total, language)} {isBn ? 'জন' : 'students'}
                </span>
              </div>

              {/* Progress/Ratio Bar */}
              <div className="my-3 space-y-1.5">
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>{isBn ? 'সক্রিয়' : 'Active'}: {formatNumber(activeCount, language)}</span>
                  <span>{isBn ? 'অনিয়মিত' : 'Inactive'}: {formatNumber(inactiveCount, language)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                  <div 
                    className="bg-emerald-600 h-full"
                    style={{ width: `${total > 0 ? (activeCount / total) * 100 : 0}%` }}
                    title={`${activeCount} Active`}
                  />
                  <div 
                    className="bg-amber-400 h-full"
                    style={{ width: `${total > 0 ? (inactiveCount / total) * 100 : 0}%` }}
                    title={`${inactiveCount} Inactive`}
                  />
                </div>
              </div>

              {/* Demographics */}
              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  {isBn ? 'ছাত্র:' : 'Boys:'} <strong className="text-slate-800 dark:text-slate-100 font-mono">{formatNumber(maleCount, language)}</strong>
                </div>
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  {isBn ? 'ছাত্রী:' : 'Girls:'} <strong className="text-slate-800 dark:text-slate-100 font-mono">{formatNumber(femaleCount, language)}</strong>
                </div>
              </div>
            </div>

            {/* Class Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={() => onSelectClass(cls.name)}
                className="flex-1 py-2 px-3 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-800 dark:text-teal-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users size={14} />
                <span>{isBn ? 'শিক্ষার্থী তালিকা দেখুন' : 'View Roster'}</span>
              </button>
              <button
                onClick={() => onOpenPromotion(cls.name)}
                className="py-2 px-3 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                title={isBn ? 'পরবর্তী শ্রেণিতে প্রমোশন' : 'Promote Class'}
              >
                <GraduationCap size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
