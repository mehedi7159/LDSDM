import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SyllabusItem } from '../../types/academic';
import { academicScheduleService } from '../../services/academicScheduleService';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  Search, 
  Filter, 
  BookOpen, 
  Download,
  Calendar,
  X,
  Sparkles,
  BarChart3
} from 'lucide-react';

export const SyllabusPlannerView: React.FC = () => {
  const { classes, subjects, language } = useApp();
  const isBn = language === 'bn';

  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '১ম শ্রেণি');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedTerm, setSelectedTerm] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [version, setVersion] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SyllabusItem | null>(null);

  const [formState, setFormState] = useState<{
    classLevel: string;
    subjectId: string;
    termName: string;
    chapterNo: string;
    title: string;
    topics: string;
    totalPeriods: number;
    completedPeriods: number;
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
    teacherNotes: string;
    targetDate: string;
  }>({
    classLevel: selectedClass,
    subjectId: '',
    termName: '১ম সাময়িক',
    chapterNo: 'অধ্যায় ১',
    title: '',
    topics: '',
    totalPeriods: 10,
    completedPeriods: 0,
    status: 'PLANNED',
    teacherNotes: '',
    targetDate: ''
  });

  // Filtered syllabus items
  const syllabusList = useMemo(() => {
    let items = academicScheduleService.getSyllabusByClassAndSubject(selectedClass, selectedSubjectId, selectedTerm);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => 
        i.title.toLowerCase().includes(q) || 
        (i.topics && i.topics.toLowerCase().includes(q)) ||
        (i.chapterNo && i.chapterNo.toLowerCase().includes(q)) ||
        (i.subjectName && i.subjectName.toLowerCase().includes(q))
      );
    }
    return items;
  }, [selectedClass, selectedSubjectId, selectedTerm, searchQuery, version]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalChapters = syllabusList.length;
    const completedChapters = syllabusList.filter(s => s.status === 'COMPLETED').length;
    const inProgressChapters = syllabusList.filter(s => s.status === 'IN_PROGRESS').length;
    const totalPeriods = syllabusList.reduce((acc, s) => acc + (s.totalPeriods || 0), 0);
    const completedPeriods = syllabusList.reduce((acc, s) => acc + (s.completedPeriods || 0), 0);
    const completionRate = totalPeriods > 0 ? Math.round((completedPeriods / totalPeriods) * 100) : 0;

    return {
      totalChapters,
      completedChapters,
      inProgressChapters,
      totalPeriods,
      completedPeriods,
      completionRate
    };
  }, [syllabusList]);

  // Open Add Modal
  const handleOpenAdd = () => {
    const defaultSub = subjects.find(s => s.classLevel === selectedClass) || subjects[0];
    setEditingItem(null);
    setFormState({
      classLevel: selectedClass,
      subjectId: defaultSub?.id || '',
      termName: selectedTerm === 'ALL' ? '১ম সাময়িক' : selectedTerm,
      chapterNo: `অধ্যায় ${syllabusList.length + 1}`,
      title: '',
      topics: '',
      totalPeriods: 12,
      completedPeriods: 0,
      status: 'PLANNED',
      teacherNotes: '',
      targetDate: ''
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: SyllabusItem) => {
    setEditingItem(item);
    setFormState({
      classLevel: item.classLevel,
      subjectId: item.subjectId,
      termName: item.termName,
      chapterNo: item.chapterNo || '',
      title: item.title,
      topics: item.topics || '',
      totalPeriods: item.totalPeriods || 10,
      completedPeriods: item.completedPeriods || 0,
      status: item.status,
      teacherNotes: item.teacherNotes || '',
      targetDate: item.targetDate || ''
    });
    setIsModalOpen(true);
  };

  // Save Syllabus Item
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim()) return;

    const sub = subjects.find(s => s.id === formState.subjectId);
    const payload: SyllabusItem = {
      id: editingItem ? editingItem.id : '',
      classLevel: formState.classLevel,
      subjectId: formState.subjectId,
      subjectName: sub?.nameBn || sub?.name || 'বিষয়',
      termName: formState.termName,
      chapterNo: formState.chapterNo,
      title: formState.title.trim(),
      topics: formState.topics.trim(),
      totalPeriods: Number(formState.totalPeriods),
      completedPeriods: Number(formState.completedPeriods),
      status: formState.status,
      teacherNotes: formState.teacherNotes.trim(),
      targetDate: formState.targetDate || undefined
    };

    academicScheduleService.saveSyllabusItem(payload);
    setIsModalOpen(false);
    setVersion(v => v + 1);
  };

  // Quick Period Progress Update
  const handleQuickProgress = (item: SyllabusItem, delta: number) => {
    const total = item.totalPeriods || 1;
    const nextCompleted = Math.max(0, Math.min(total, (item.completedPeriods || 0) + delta));
    let nextStatus: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' = item.status;
    if (nextCompleted === 0) nextStatus = 'PLANNED';
    else if (nextCompleted >= total) nextStatus = 'COMPLETED';
    else nextStatus = 'IN_PROGRESS';

    academicScheduleService.updateLessonProgress(item.id, nextCompleted, nextStatus);
    setVersion(v => v + 1);
  };

  // Delete
  const handleDelete = (id: string) => {
    if (confirm(isBn ? 'এই সিলেবাস অধ্যায়টি মুছে ফেলতে চান?' : 'Delete this syllabus topic?')) {
      academicScheduleService.deleteSyllabusItem(id);
      setVersion(v => v + 1);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider mb-1">
            <FileText size={16} />
            <span>{isBn ? 'পাঠ পরিকল্পনা ও কারিকুলাম ট্র্যাকার' : 'Lesson Plan & Syllabus Tracker'}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isBn ? 'সিলেবাস ও পাঠ পরিকল্পনা' : 'Syllabus & Lesson Planning'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn 
              ? 'টার্মভিত্তিক অধ্যায় রূপরেখা, পিরিয়ড সমাপ্তি অগ্রগতি ও শিক্ষক পাঠ নোট ট্র্যাকিং।'
              : 'Term-wise syllabus breakdown with period progress and lesson plan tracking.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট সিলেবাস' : 'Print'}</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
          >
            <Plus size={15} />
            <span>{isBn ? 'নতুন অধ্যায় যুক্ত করুন' : 'Add Chapter'}</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{isBn ? 'মোট অধ্যায়/টপিক' : 'Total Topics'}</div>
            <div className="text-lg font-black text-slate-800">{formatNumber(stats.totalChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{isBn ? 'সম্পন্ন অধ্যায়' : 'Completed'}</div>
            <div className="text-lg font-black text-emerald-700">{formatNumber(stats.completedChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{isBn ? 'চলমান অধ্যায়' : 'In Progress'}</div>
            <div className="text-lg font-black text-amber-700">{formatNumber(stats.inProgressChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <BarChart3 size={20} />
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-500 flex justify-between">
              <span>{isBn ? 'সামগ্রিক অগ্রগতি' : 'Progress'}</span>
              <span className="font-bold text-indigo-700">{formatNumber(stats.completionRate, 'bn')}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{isBn ? 'শ্রেণি:' : 'Class:'}</span>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 shadow-2xs"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{isBn ? 'বিষয়:' : 'Subject:'}</span>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 shadow-2xs max-w-[200px]"
            >
              <option value="ALL">{isBn ? 'সকল বিষয়' : 'All Subjects'}</option>
              {subjects
                .filter(s => s.classLevel === selectedClass || !s.classLevel)
                .map(s => (
                  <option key={s.id} value={s.id}>{s.nameBn || s.name}</option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{isBn ? 'টার্ম/পর্ব:' : 'Term:'}</span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 shadow-2xs"
            >
              <option value="ALL">{isBn ? 'সকল টার্ম' : 'All Terms'}</option>
              <option value="১ম সাময়িক">১ম সাময়িক</option>
              <option value="২য় সাময়িক">২য় সাময়িক</option>
              <option value="বার্ষিক">বার্ষিক</option>
            </select>
          </div>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={isBn ? 'অধ্যায় বা টপিক খুঁজুন...' : 'Search topic...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Syllabus Cards / List */}
      <div className="space-y-3">
        {syllabusList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-700">{isBn ? 'কোনো পাঠ পরিকল্পনা পাওয়া যায়নি' : 'No syllabus topics found'}</h4>
            <p className="text-xs text-slate-400 mt-1">
              {isBn ? 'নির্বাচিত শ্রেণি ও বিষয়ের জন্য নতুন অধ্যায় যুক্ত করুন।' : 'Add a new chapter for selected class & subject.'}
            </p>
            <Button
              onClick={handleOpenAdd}
              className="mt-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold"
            >
              <Plus size={14} />
              <span>{isBn ? 'প্রথম অধ্যায় যুক্ত করুন' : 'Add First Chapter'}</span>
            </Button>
          </div>
        ) : (
          syllabusList.map((item, idx) => {
            const pct = item.totalPeriods && item.totalPeriods > 0 
              ? Math.round(((item.completedPeriods || 0) / item.totalPeriods) * 100) 
              : 0;

            return (
              <div 
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {item.chapterNo || `অধ্যায় ${idx + 1}`}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {item.subjectName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      • {item.termName}
                    </span>

                    {item.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={11} />
                        <span>{isBn ? 'সম্পন্ন' : 'Completed'}</span>
                      </span>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Clock size={11} />
                        <span>{isBn ? 'চলমান' : 'In Progress'}</span>
                      </span>
                    )}
                    {item.status === 'PLANNED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        <Calendar size={11} />
                        <span>{isBn ? 'পরিকল্পিত' : 'Planned'}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-slate-800 text-sm">{item.title}</h3>

                  {item.topics && (
                    <p className="text-xs text-slate-600 line-clamp-2">{item.topics}</p>
                  )}

                  {item.teacherNotes && (
                    <div className="text-[11px] text-teal-800 bg-teal-50/70 p-2 rounded-lg border border-teal-100 mt-2">
                      <span className="font-bold">{isBn ? 'শিক্ষক নোট: ' : 'Teacher Note: '}</span>
                      <span>{item.teacherNotes}</span>
                    </div>
                  )}
                </div>

                {/* Progress Controls & Actions */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  {/* Period Progress Bar */}
                  <div className="w-36 text-right">
                    <div className="text-[11px] text-slate-500 flex justify-between mb-1">
                      <span>{isBn ? 'ক্লাস/পিরিয়ড' : 'Periods'}</span>
                      <span className="font-bold text-slate-700 font-mono">
                        {formatNumber(item.completedPeriods || 0, 'bn')}/{formatNumber(item.totalPeriods || 0, 'bn')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full ${
                          pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-teal-600' : 'bg-slate-300'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Increment/Decrement Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQuickProgress(item, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                      title="১ ক্লাস কমান"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickProgress(item, 1)}
                      className="w-7 h-7 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-xs"
                      title="১ ক্লাস সম্পন্ন"
                    >
                      +
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                      title="সম্পাদনা"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h3 className="font-bold text-sm">
                  {editingItem ? (isBn ? 'সিলেবাস অধ্যায় সম্পাদনা' : 'Edit Syllabus Topic') : (isBn ? 'নতুন অধ্যায় ও পাঠ পরিকল্পনা' : 'Add Syllabus Topic')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শ্রেণি' : 'Class'}</label>
                  <select
                    value={formState.classLevel}
                    onChange={e => setFormState({ ...formState, classLevel: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'বিষয়' : 'Subject'}</label>
                  <select
                    value={formState.subjectId}
                    onChange={e => setFormState({ ...formState, subjectId: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="">{isBn ? '-- বিষয় নির্বাচন করুন --' : '-- Select Subject --'}</option>
                    {subjects
                      .filter(s => s.classLevel === formState.classLevel || !s.classLevel)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.nameBn || s.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'টার্ম / পর্ব' : 'Term'}</label>
                  <select
                    value={formState.termName}
                    onChange={e => setFormState({ ...formState, termName: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="১ম সাময়িক">১ম সাময়িক</option>
                    <option value="২য় সাময়িক">২য় সাময়িক</option>
                    <option value="বার্ষিক">বার্ষিক</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'অধ্যায় নং / ক্রম' : 'Chapter'}</label>
                  <input
                    type="text"
                    value={formState.chapterNo}
                    onChange={e => setFormState({ ...formState, chapterNo: e.target.value })}
                    placeholder="অধ্যায় ১ / দারস ১"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'অধ্যায়ের নাম বা মূল শিরোনাম *' : 'Chapter Title *'}</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={e => setFormState({ ...formState, title: e.target.value })}
                  required
                  placeholder="যেমন: হরফ চেনা, নুকতা ও হরকত পরিচয়"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'বিস্তারিত বিষয়বস্তু ও টপিক' : 'Topics / Syllabus Details'}</label>
                <textarea
                  rows={2}
                  value={formState.topics}
                  onChange={e => setFormState({ ...formState, topics: e.target.value })}
                  placeholder="এই অধ্যায়ে যেসব বিষয় শেখানো হবে..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'মোট পিরিয়ড' : 'Total Periods'}</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.totalPeriods}
                    onChange={e => setFormState({ ...formState, totalPeriods: Number(e.target.value) })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'সম্পন্ন পিরিয়ড' : 'Completed'}</label>
                  <input
                    type="number"
                    min="0"
                    value={formState.completedPeriods}
                    onChange={e => setFormState({ ...formState, completedPeriods: Number(e.target.value) })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'অবস্থা' : 'Status'}</label>
                  <select
                    value={formState.status}
                    onChange={e => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                  >
                    <option value="PLANNED">পরিকল্পিত</option>
                    <option value="IN_PROGRESS">চলমান</option>
                    <option value="COMPLETED">সম্পন্ন</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শিক্ষক নোট বা দিকনির্দেশনা' : 'Teacher Notes'}</label>
                <input
                  type="text"
                  value={formState.teacherNotes}
                  onChange={e => setFormState({ ...formState, teacherNotes: e.target.value })}
                  placeholder="দুর্বল ছাত্রদের জন্য অতিরিক্ত সময়..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-bold"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold"
                >
                  {editingItem ? (isBn ? 'আপডেট করুন' : 'Update') : (isBn ? 'সংরক্ষণ করুন' : 'Save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
