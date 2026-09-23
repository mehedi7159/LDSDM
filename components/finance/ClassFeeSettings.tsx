import React, { useState } from 'react';
import { Settings, Save, Sparkles, Plus, GraduationCap } from 'lucide-react';
import { ClassFeeStructure, SchoolClass } from '../../types';
import { formatBanglaNumber } from '../../services/utils';
import { Button } from '../ui/Button';

interface ClassFeeSettingsProps {
  classes: SchoolClass[];
  feeStructures: ClassFeeStructure[];
  language: 'en' | 'bn';
  onUpdateFeeStructure: (structure: ClassFeeStructure) => void;
  showToast: (msg: string) => void;
}

export const ClassFeeSettings: React.FC<ClassFeeSettingsProps> = ({
  classes,
  feeStructures,
  language,
  onUpdateFeeStructure,
  showToast,
}) => {
  const isBn = language === 'bn';

  const [localStructures, setLocalStructures] = useState<Record<string, ClassFeeStructure>>(() => {
    const map: Record<string, ClassFeeStructure> = {};
    classes.forEach(c => {
      const existing = feeStructures.find(f => f.classLevel === c.name);
      if (existing) {
        map[c.name] = { ...existing };
      } else {
        map[c.name] = {
          id: `fs-${c.id}`,
          classLevel: c.name,
          monthlyTuition: 800,
          admissionFee: 1500,
          examFee: 400,
          boardingFee: 2600,
          bookFee: 800,
        };
      }
    });
    return map;
  });

  const handleChange = (className: string, field: keyof ClassFeeStructure, value: number) => {
    setLocalStructures(prev => ({
      ...prev,
      [className]: {
        ...prev[className],
        [field]: value,
      },
    }));
  };

  const handleSave = (className: string) => {
    const item = localStructures[className];
    if (item) {
      onUpdateFeeStructure(item);
      showToast(isBn ? `"${className}" শ্রেণির ফি কাঠামো সফলভাবে সংরক্ষিত হয়েছে!` : `Fee structure for ${className} saved!`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isBn ? 'শ্রেণিভিত্তিক নির্ধারিত ফি কাঠামো কনফিগারেশন' : 'Class-wise Standard Fee Structure'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBn ? 'প্রতিটি জামাতের মাসিক বেতন, খাবার ফি ও পরীক্ষার ফি সেট করে রাখুন' : 'Set standard default fee rates per jamat / class'}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="py-3 px-3.5 font-bold">{isBn ? 'শ্রেণি / জামাত' : 'Jamat / Class'}</th>
              <th className="py-3 px-3 font-bold">{isBn ? 'মাসিক বেতন (৳)' : 'Tuition (BDT)'}</th>
              <th className="py-3 px-3 font-bold">{isBn ? 'বোর্ডিং খাবার ফি (৳)' : 'Food Fee (BDT)'}</th>
              <th className="py-3 px-3 font-bold">{isBn ? 'ভর্তি ও সেশন ফি (৳)' : 'Admission (BDT)'}</th>
              <th className="py-3 px-3 font-bold">{isBn ? 'পরীক্ষার ফি (৳)' : 'Exam Fee (BDT)'}</th>
              <th className="py-3 px-3 font-bold">{isBn ? 'কিতাব ও পাঠাগার (৳)' : 'Book Fee (BDT)'}</th>
              <th className="py-3 px-3 font-bold text-center">{isBn ? 'সংরক্ষণ' : 'Save'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.map(c => {
              const item = localStructures[c.name] || {
                id: `fs-${c.id}`,
                classLevel: c.name,
                monthlyTuition: 800,
                admissionFee: 1500,
                examFee: 400,
                boardingFee: 2600,
                bookFee: 800,
              };

              return (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      <span>{isBn ? (c.nameBn || c.name) : c.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={item.monthlyTuition}
                      onChange={(e) => handleChange(c.name, 'monthlyTuition', Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={item.boardingFee}
                      onChange={(e) => handleChange(c.name, 'boardingFee', Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={item.admissionFee}
                      onChange={(e) => handleChange(c.name, 'admissionFee', Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={item.examFee}
                      onChange={(e) => handleChange(c.name, 'examFee', Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={item.bookFee}
                      onChange={(e) => handleChange(c.name, 'bookFee', Number(e.target.value))}
                      className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      onClick={() => handleSave(c.name)}
                      size="sm"
                      variant="secondary"
                      className="text-xs px-3"
                    >
                      <Save className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span>{isBn ? 'সেভ' : 'Save'}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
