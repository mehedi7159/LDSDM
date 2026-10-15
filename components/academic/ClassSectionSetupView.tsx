import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SchoolClass, Section } from '../../types';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  GraduationCap, 
  DoorClosed,
  Phone
} from 'lucide-react';

export const ClassSectionSetupView: React.FC = () => {
  const { 
    classes = [], 
    sections = [], 
    teachers = [], 
    students = [], 
    classTeacherAssignments = [],
    assignClassTeacher,
    addClass,
    updateClass,
    deleteClass,
    language 
  } = useApp();
  const isBn = language === 'bn';

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Local Section State (persists to local storage for instant responsiveness)
  const [localSections, setLocalSections] = useState<Record<string, { id: string; name: string; capacity: number; room: string; shift: string; teacherId?: string }[]>>(() => {
    try {
      const raw = localStorage.getItem('madrasha_class_sections_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    // Seed default sections
    const initial: Record<string, { id: string; name: string; capacity: number; room: string; shift: string; teacherId?: string }[]> = {};
    classes.forEach(c => {
      initial[c.id || c.name] = [
        { id: `sec_${c.id}_1`, name: 'ক (শাখা ১)', capacity: 45, room: '১০১', shift: 'দিবা', teacherId: teachers[0]?.id },
        { id: `sec_${c.id}_2`, name: 'খ (শাখা ২)', capacity: 45, room: '১০২', shift: 'দিবা', teacherId: teachers[1]?.id }
      ];
    });
    return initial;
  });

  const saveSections = (data: Record<string, any>) => {
    setLocalSections(data);
    try {
      localStorage.setItem('madrasha_class_sections_v1', JSON.stringify(data));
    } catch {}
  };

  // Modal State for Class
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classForm, setClassForm] = useState({ name: '', order: 1 });

  // Modal State for Section
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState({
    name: 'ক',
    capacity: 40,
    room: '১০১',
    shift: 'দিবা',
    teacherId: ''
  });

  // Current class sections
  const currentSections = useMemo(() => {
    if (!selectedClass) return [];
    return localSections[selectedClass.id] || localSections[selectedClass.name] || [];
  }, [localSections, selectedClass]);

  // Handle Class Add/Edit
  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim()) return;

    if (editingClass) {
      if (updateClass) {
        updateClass({ ...editingClass, name: classForm.name.trim(), order: Number(classForm.order) });
      }
    } else {
      if (addClass) {
        addClass({
          id: `cls_${Date.now()}`,
          name: classForm.name.trim(),
          order: Number(classForm.order)
        });
      }
    }
    setIsClassModalOpen(false);
  };

  // Handle Section Add/Edit
  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;

    const classKey = selectedClass.id;
    const list = [...(localSections[classKey] || [])];

    if (editingSectionIndex !== null && editingSectionIndex >= 0) {
      list[editingSectionIndex] = {
        ...list[editingSectionIndex],
        ...sectionForm,
        capacity: Number(sectionForm.capacity)
      };
    } else {
      list.push({
        id: `sec_${Date.now()}`,
        ...sectionForm,
        capacity: Number(sectionForm.capacity)
      });
    }

    const updated = { ...localSections, [classKey]: list };
    saveSections(updated);

    // If teacher selected, also sync with AppContext classTeacherAssignment if available
    if (sectionForm.teacherId && assignClassTeacher) {
      assignClassTeacher({
        academicYearId: 'current',
        teacherId: sectionForm.teacherId,
        classId: selectedClass.name,
        type: 'CLASS_TEACHER',
        status: 'ACTIVE'
      });
    }

    setIsSectionModalOpen(false);
  };

  const handleDeleteSection = (index: number) => {
    if (!selectedClass) return;
    if (confirm(isBn ? 'এই শাখাটি মুছে ফেলতে চান?' : 'Delete this section?')) {
      const classKey = selectedClass.id;
      const list = (localSections[classKey] || []).filter((_, i) => i !== index);
      saveSections({ ...localSections, [classKey]: list });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider mb-1">
            <Layers size={16} />
            <span>{isBn ? 'শ্রেণি, শাখা ও শ্রেণি শিক্ষক বিন্যাস' : 'Class, Section & Class Teacher Setup'}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isBn ? 'শ্রেণি ও শাখা সমন্বয়' : 'Classes & Sections Management'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn 
              ? 'মাদ্রাসার সকল জামাত/শ্রেণি, শাখা নির্ধারণ, আসন ধারণক্ষমতা, কক্ষ বরাদ্দ ও শ্রেণি শিক্ষক নির্বাচন।'
              : 'Configure classes, multiple sections, student capacity, classroom mapping and assign class teachers.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              setEditingClass(null);
              setClassForm({ name: '', order: classes.length + 1 });
              setIsClassModalOpen(true);
            }}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
          >
            <Plus size={15} />
            <span>{isBn ? 'নতুন শ্রেণি যুক্ত করুন' : 'Add Class'}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Class Tabs, Right Sections Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Classes List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={15} className="text-teal-700" />
              <span>{isBn ? 'বিদ্যমান শ্রেণি সমূহ' : 'All Classes'}</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {formatNumber(classes.length, 'bn')} টি
            </span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {classes.map(c => {
              const isSelected = selectedClass?.id === c.id;
              const countStudents = students.filter(s => (s.classLevel === c.name || s.classId === c.name) && s.status === 'Active' && !s.isFormer).length;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                    isSelected
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">{c.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                      {isBn ? `শিক্ষার্থী: ${formatNumber(countStudents, 'bn')} জন` : `Students: ${countStudents}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClass(c);
                        setClassForm({ name: c.name, order: c.order || 1 });
                        setIsClassModalOpen(true);
                      }}
                      className={`p-1 rounded ${isSelected ? 'hover:bg-teal-800 text-teal-100' : 'hover:bg-slate-200 text-slate-500'}`}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Sections & Class Teachers of Selected Class */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  {selectedClass ? selectedClass.name : (isBn ? 'শ্রেণি নির্বাচন করুন' : 'Select Class')}
                </h3>
                <p className="text-xs text-slate-500">
                  {isBn ? 'এই শ্রেণির অধীন শাখা, রুম নম্বর ও শ্রেণি শিক্ষক পরিচালনা করুন।' : 'Manage sections and assigned class teachers.'}
                </p>
              </div>

              <Button
                onClick={() => {
                  setEditingSectionIndex(null);
                  setSectionForm({
                    name: 'ক',
                    capacity: 45,
                    room: '১০১',
                    shift: 'দিবা',
                    teacherId: teachers[0]?.id || ''
                  });
                  setIsSectionModalOpen(true);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-1.5 px-3"
              >
                <Plus size={14} />
                <span>{isBn ? 'নতুন শাখা যুক্ত করুন' : 'Add Section'}</span>
              </Button>
            </div>

            {/* Sections Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentSections.length === 0 ? (
                <div className="col-span-2 p-8 border border-dashed border-slate-300 rounded-2xl text-center">
                  <Layers size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">{isBn ? 'এই শ্রেণির কোনো শাখা যোগ করা হয়নি' : 'No sections added'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{isBn ? 'উপরের বাটনে ক্লিক করে শাখা যুক্ত করুন।' : 'Click above to add a section.'}</p>
                </div>
              ) : (
                currentSections.map((sec, idx) => {
                  const teacher = teachers.find(t => t.id === sec.teacherId);

                  return (
                    <div 
                      key={sec.id || idx}
                      className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3 relative group hover:border-teal-300 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800">{sec.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                              {sec.shift} শিফট
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <DoorClosed size={12} className="text-slate-400" />
                              <span>রুম: {sec.room}</span>
                            </span>
                            <span>•</span>
                            <span>ধারণক্ষমতা: {formatNumber(sec.capacity, 'bn')} জন</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSectionIndex(idx);
                              setSectionForm({
                                name: sec.name,
                                capacity: sec.capacity || 40,
                                room: sec.room || '১০১',
                                shift: sec.shift || 'দিবা',
                                teacherId: sec.teacherId || ''
                              });
                              setIsSectionModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded"
                            title="সম্পাদনা"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Class Teacher Badge */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                            <UserCheck size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{isBn ? 'শ্রেণি শিক্ষক' : 'Class Teacher'}</div>
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {teacher ? (teacher.nameBn || teacher.name) : (isBn ? 'নিয়োগপ্রাপ্ত নয়' : 'Unassigned')}
                            </div>
                          </div>
                        </div>

                        {teacher?.phone && (
                          <a href={`tel:${teacher.phone}`} className="p-1 text-teal-600 hover:text-teal-800">
                            <Phone size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Class Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingClass ? (isBn ? 'শ্রেণি সম্পাদনা' : 'Edit Class') : (isBn ? 'নতুন শ্রেণি যুক্ত করুন' : 'Add Class')}
              </h3>
              <button type="button" onClick={() => setIsClassModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শ্রেণির নাম *' : 'Class Name *'}</label>
                <input
                  type="text"
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                  required
                  placeholder="যেমন: ৩য় শ্রেণি / হিফজ বিভাগ"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'ক্রমিক নং / লেভেল' : 'Order'}</label>
                <input
                  type="number"
                  min="1"
                  value={classForm.order}
                  onChange={e => setClassForm({ ...classForm, order: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsClassModalOpen(false)} className="text-xs font-bold">
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold">
                  {isBn ? 'সংরক্ষণ' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingSectionIndex !== null ? (isBn ? 'শাখা সম্পাদনা' : 'Edit Section') : (isBn ? 'নতুন শাখা যোগ করুন' : 'Add Section')}
              </h3>
              <button type="button" onClick={() => setIsSectionModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSection} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শাখার নাম *' : 'Section Name *'}</label>
                  <input
                    type="text"
                    value={sectionForm.name}
                    onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
                    required
                    placeholder="ক / খ / A / আবু বকর"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শিফট' : 'Shift'}</label>
                  <select
                    value={sectionForm.shift}
                    onChange={e => setSectionForm({ ...sectionForm, shift: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="দিবা">দিবা (Day)</option>
                    <option value="প্রভাতি">প্রভাতি (Morning)</option>
                    <option value="সান্ধ্য">সান্ধ্য (Evening)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'ধারণক্ষমতা (আসন)' : 'Capacity'}</label>
                  <input
                    type="number"
                    min="1"
                    value={sectionForm.capacity}
                    onChange={e => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'বরাদ্দকৃত রুম নং' : 'Room No'}</label>
                  <input
                    type="text"
                    value={sectionForm.room}
                    onChange={e => setSectionForm({ ...sectionForm, room: e.target.value })}
                    placeholder="১০১"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'দায়িত্বপ্রাপ্ত শ্রেণি শিক্ষক' : 'Class Teacher'}</label>
                <select
                  value={sectionForm.teacherId}
                  onChange={e => setSectionForm({ ...sectionForm, teacherId: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                >
                  <option value="">{isBn ? '-- শ্রেণি শিক্ষক নির্বাচন করুন --' : '-- Select Teacher --'}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.nameBn || t.name} ({t.designation || 'শিক্ষক'})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsSectionModalOpen(false)} className="text-xs font-bold">
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold">
                  {isBn ? 'সংরক্ষণ' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
