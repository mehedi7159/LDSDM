import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { SyllabusItem } from '../../types/academic';
import { academicScheduleService } from '../../services/academicScheduleService';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SCHEDULE_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../../services/cloudConfirm';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
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
  Download,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';

export const SyllabusPlannerView: React.FC = () => {
  const { classes, subjects, language, confirmScheduleCloudSync, isRecordUnconfirmed } = useApp();
  const isBn = language === 'bn';

  // 7 Nov 2026 Job 7 (instant save, Job 0 pattern): the local mutation
  // applies and the modal closes at once; the cloud confirm runs in the
  // BACKGROUND. On failure the payload is queued, the saved chapter shows
  // the amber 'cloud-এ যায়নি' badge, and the banner below offers Retry
  // (re-confirm only — never a second local write). Closing the modal
  // means 'saved on this device, syncing' — never a false 'saved to cloud'.
  // The service swallows localStorage write errors, so every local save
  // is verified by re-reading; a save that did not land keeps the modal
  // open with a real message instead of claiming a save.
  const [pendingSchedule, setPendingSchedule] = useState<{ field: string; id: string | null; error: string; localFailure?: boolean } | null>(null);
  const [isRetryingSchedule, setIsRetryingSchedule] = useState(false);
  const [scheduleSaveNote, setScheduleSaveNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  // Form-level error shown in the modal (empty title / local save failure).
  const [formError, setFormError] = useState<string | null>(null);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message.
  const confirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (isBn ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || SCHEDULE_CLOUD_FAILURE_MESSAGE));

  const LOCAL_SAVE_FAILURE_MESSAGE = isBn
    ? 'এই ডিভাইসে সংরক্ষণ হয়নি — ব্রাউজার স্টোরেজে জায়গা নেই বা বন্ধ আছে। কিছু জায়গা খালি করে আবার চেষ্টা করুন।'
    : 'Could not save on this device — browser storage is full or unavailable. Free some space and try again.';
  const LOCAL_DELETE_FAILURE_MESSAGE = isBn
    ? 'এই ডিভাইসে মোছা হয়নি — ব্রাউজার স্টোরেজে সমস্যা। কিছু জায়গা খালি করে আবার চেষ্টা করুন।'
    : 'Could not delete on this device — browser storage has a problem. Free some space and try again.';

  const confirmScheduleInBackground = (savedId: string | null) => {
    void confirmScheduleCloudSync().then((result) => {
      if (result.success) setPendingSchedule(null);
      else setPendingSchedule({ field: 'syllabusItems', id: savedId, error: confirmErrorMessage(result) });
    }).catch((err) => {
      console.error('Background schedule cloud confirm failed:', err);
      setPendingSchedule({ field: 'syllabusItems', id: savedId, error: SCHEDULE_CLOUD_FAILURE_MESSAGE });
    });
  };

  // Retry re-confirms the still-local save (no re-save needed). The
  // Diagnostics queue Retry covers the same payload, so whichever path
  // lands first clears the badge.
  const retryScheduleSave = async () => {
    if (isRetryingSchedule) return;
    setIsRetryingSchedule(true);
    try {
      const result = await confirmScheduleCloudSync();
      if (result.success) setPendingSchedule(null);
      else setPendingSchedule((prev) => (prev ? { ...prev, error: confirmErrorMessage(result) } : { field: 'syllabusItems', id: null, error: confirmErrorMessage(result) }));
    } finally {
      setIsRetryingSchedule(false);
    }
  };

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
    setFormError(null);
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
    setFormError(null);
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

  // Save Syllabus Item — instant/optimistic: the local mutation applies
  // and the modal closes at once; the cloud confirm runs in the
  // background (never block-awaited here).
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    // 7 Nov 2026 Job 7: an empty title used to return silently — show
    // the message instead of dropping the save without a word.
    if (!formState.title.trim()) {
      setFormError(isBn ? 'অধ্যায়ের নাম দিন — খালি শিরোনাম সংরক্ষণ হবে না।' : 'Enter a chapter title — an empty title cannot be saved.');
      return;
    }

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

    savingRef.current = true;
    setIsSaving(true);
    try {
      const saved = academicScheduleService.saveSyllabusItem(payload);
      // The service swallows localStorage write errors — verify the save
      // actually landed by re-reading; if it did not, keep the modal open
      // with a real message instead of claiming a save.
      const landed = academicScheduleService.getSyllabusItems().some(s => s.id === saved.id && s.title === saved.title);
      if (!landed) {
        setFormError(LOCAL_SAVE_FAILURE_MESSAGE);
        return;
      }
      setIsModalOpen(false);
      setFormError(null);
      setVersion(v => v + 1);
      setScheduleSaveNote(true);
      setTimeout(() => setScheduleSaveNote(false), 2000);
      confirmScheduleInBackground(saved.id);
    } catch (err) {
      console.error('Syllabus local save failed:', err);
      setFormError(LOCAL_SAVE_FAILURE_MESSAGE);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Quick Period Progress Update — same background confirm as the form
  // save; the list updates at once, no blocking wait.
  const handleQuickProgress = (item: SyllabusItem, delta: number) => {
    const total = item.totalPeriods || 1;
    const nextCompleted = Math.max(0, Math.min(total, (item.completedPeriods || 0) + delta));
    let nextStatus: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' = item.status;
    if (nextCompleted === 0) nextStatus = 'PLANNED';
    else if (nextCompleted >= total) nextStatus = 'COMPLETED';
    else nextStatus = 'IN_PROGRESS';

    try {
      academicScheduleService.updateLessonProgress(item.id, nextCompleted, nextStatus);
      const landed = academicScheduleService.getSyllabusItems().find(s => s.id === item.id);
      if (!landed || (landed.completedPeriods || 0) !== nextCompleted) {
        setPendingSchedule({ field: 'syllabusItems', id: null, error: LOCAL_SAVE_FAILURE_MESSAGE, localFailure: true });
        return;
      }
      setVersion(v => v + 1);
      confirmScheduleInBackground(item.id);
    } catch (err) {
      console.error('Syllabus progress update failed:', err);
      setPendingSchedule({ field: 'syllabusItems', id: null, error: LOCAL_SAVE_FAILURE_MESSAGE, localFailure: true });
    }
  };

  // Delete
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setTopicToDelete(id);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Job 7 (instant save): the background cloud confirm failed for
          the just-saved chapter — it sits queued with its amber badge.
          This banner offers Retry (re-confirm only, never a second local
          write); it hides itself once the payload lands (here or via the
          Diagnostics queue retry). A delete has no surviving row, so its
          failure shows on the error alone (id null). */}
      {pendingSchedule && (pendingSchedule.id === null || isRecordUnconfirmed(pendingSchedule.field, pendingSchedule.id)) && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold flex flex-col gap-2">
          <span>{pendingSchedule.error}</span>
          {!pendingSchedule.localFailure && (
            <span>{isBn ? 'তথ্যটি এই ডিভাইসে সংরক্ষিত আছে — cloud-এ যায়নি।' : 'The record is saved on this device — it has not reached the cloud yet.'}</span>
          )}
          <button type="button" onClick={retryScheduleSave} disabled={isRetryingSchedule} className="self-start px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
        </div>
      )}
      {/* Job 7: the modal closed at once — the chapter is saved on this
          device and syncing to the cloud in the background. */}
      {scheduleSaveNote && !pendingSchedule && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
        </div>
      )}
      {/* Top Header */}
      <PageHeader
        icon={FileText}
        title={isBn ? 'সিলেবাস ও পাঠ পরিকল্পনা' : 'Syllabus & Lesson Planning'}
      >

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300 dark:border-slate-600"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট সিলেবাস' : 'Print'}</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5"
          >
            <Plus size={15} />
            <span>{isBn ? 'নতুন অধ্যায় যুক্ত করুন' : 'Add Chapter'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'মোট অধ্যায়/টপিক' : 'Total Topics'}</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{formatNumber(stats.totalChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'সম্পন্ন অধ্যায়' : 'Completed'}</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">{formatNumber(stats.completedChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'চলমান অধ্যায়' : 'In Progress'}</div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-400">{formatNumber(stats.inProgressChapters, 'bn')} টি</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
              <span>{isBn ? 'সামগ্রিক অগ্রগতি' : 'Progress'}</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-400">{formatNumber(stats.completionRate, 'bn')}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-1.5 overflow-hidden">
              <div 
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'শ্রেণি:' : 'Class:'}</span>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'বিষয়:' : 'Subject:'}</span>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 max-w-[200px]"
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
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'টার্ম/পর্ব:' : 'Term:'}</span>
            <select
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">{isBn ? 'সকল টার্ম' : 'All Terms'}</option>
              <option value="১ম সাময়িক">১ম সাময়িক</option>
              <option value="২য় সাময়িক">২য় সাময়িক</option>
              <option value="বার্ষিক">বার্ষিক</option>
            </select>
          </div>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={isBn ? 'অধ্যায় বা টপিক খুঁজুন...' : 'Search topic...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Syllabus Cards / List */}
      <div className="space-y-3">
        {syllabusList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{isBn ? 'কোনো পাঠ পরিকল্পনা পাওয়া যায়নি' : 'No syllabus topics found'}</h4>
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
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                      {item.chapterNo || `অধ্যায় ${idx + 1}`}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {item.subjectName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      • {item.termName}
                    </span>

                    {item.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={11} />
                        <span>{isBn ? 'সম্পন্ন' : 'Completed'}</span>
                      </span>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <Clock size={11} />
                        <span>{isBn ? 'চলমান' : 'In Progress'}</span>
                      </span>
                    )}
                    {item.status === 'PLANNED' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                        <Calendar size={11} />
                        <span>{isBn ? 'পরিকল্পিত' : 'Planned'}</span>
                      </span>
                    )}
                    {isRecordUnconfirmed('syllabusItems', item.id) && <UnconfirmedBadge isBn={isBn} />}
                  </div>

                  <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">{item.title}</h3>

                  {item.topics && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.topics}</p>
                  )}

                  {item.teacherNotes && (
                    <div className="text-[11px] text-teal-800 dark:text-teal-300 bg-teal-50/70 p-2 rounded-lg border border-teal-100 dark:border-teal-900/60 mt-2">
                      <span className="font-bold">{isBn ? 'শিক্ষক নোট: ' : 'Teacher Note: '}</span>
                      <span>{item.teacherNotes}</span>
                    </div>
                  )}
                </div>

                {/* Progress Controls & Actions */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                  {/* Period Progress Bar */}
                  <div className="w-36 text-right">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between mb-1">
                      <span>{isBn ? 'ক্লাস/পিরিয়ড' : 'Periods'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                        {formatNumber(item.completedPeriods || 0, 'bn')}/{formatNumber(item.totalPeriods || 0, 'bn')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
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
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs"
                      title="১ ক্লাস কমান"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickProgress(item, 1)}
                      className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/50 hover:bg-teal-200 text-teal-800 dark:text-teal-300 flex items-center justify-center font-bold text-xs"
                      title="১ ক্লাস সম্পন্ন"
                    >
                      +
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                      title="সম্পাদনা"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>{formError}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শ্রেণি' : 'Class'}</label>
                  <select
                    value={formState.classLevel}
                    onChange={e => setFormState({ ...formState, classLevel: e.target.value })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'বিষয়' : 'Subject'}</label>
                  <select
                    value={formState.subjectId}
                    onChange={e => setFormState({ ...formState, subjectId: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'টার্ম / পর্ব' : 'Term'}</label>
                  <select
                    value={formState.termName}
                    onChange={e => setFormState({ ...formState, termName: e.target.value })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                  >
                    <option value="১ম সাময়িক">১ম সাময়িক</option>
                    <option value="২য় সাময়িক">২য় সাময়িক</option>
                    <option value="বার্ষিক">বার্ষিক</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'অধ্যায় নং / ক্রম' : 'Chapter'}</label>
                  <input
                    type="text"
                    value={formState.chapterNo}
                    onChange={e => setFormState({ ...formState, chapterNo: e.target.value })}
                    placeholder="অধ্যায় ১ / দারস ১"
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'অধ্যায়ের নাম বা মূল শিরোনাম *' : 'Chapter Title *'}</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={e => { setFormState({ ...formState, title: e.target.value }); setFormError(null); }}
                  required
                  placeholder="যেমন: হরফ চেনা, নুকতা ও হরকত পরিচয়"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'বিস্তারিত বিষয়বস্তু ও টপিক' : 'Topics / Syllabus Details'}</label>
                <textarea
                  rows={2}
                  value={formState.topics}
                  onChange={e => setFormState({ ...formState, topics: e.target.value })}
                  placeholder="এই অধ্যায়ে যেসব বিষয় শেখানো হবে..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'মোট পিরিয়ড' : 'Total Periods'}</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.totalPeriods}
                    onChange={e => setFormState({ ...formState, totalPeriods: Number(e.target.value) })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'সম্পন্ন পিরিয়ড' : 'Completed'}</label>
                  <input
                    type="number"
                    min="0"
                    value={formState.completedPeriods}
                    onChange={e => setFormState({ ...formState, completedPeriods: Number(e.target.value) })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'অবস্থা' : 'Status'}</label>
                  <select
                    value={formState.status}
                    onChange={e => setFormState({ ...formState, status: e.target.value as any })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                  >
                    <option value="PLANNED">পরিকল্পিত</option>
                    <option value="IN_PROGRESS">চলমান</option>
                    <option value="COMPLETED">সম্পন্ন</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শিক্ষক নোট বা দিকনির্দেশনা' : 'Teacher Notes'}</label>
                <input
                  type="text"
                  value={formState.teacherNotes}
                  onChange={e => setFormState({ ...formState, teacherNotes: e.target.value })}
                  placeholder="দুর্বল ছাত্রদের জন্য অতিরিক্ত সময়..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  disabled={isSaving}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingItem ? (isBn ? 'আপডেট করুন' : 'Update') : (isBn ? 'সংরক্ষণ করুন' : 'Save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!topicToDelete}
        onClose={() => setTopicToDelete(null)}
        onConfirm={() => {
          if (topicToDelete) {
            const id = topicToDelete;
            academicScheduleService.deleteSyllabusItem(id);
            setVersion(v => v + 1);
            setTopicToDelete(null);
            // The service swallows localStorage write errors — verify the
            // delete actually landed before confirming it to the cloud.
            if (academicScheduleService.getSyllabusItems().some(s => s.id === id)) {
              setPendingSchedule({ field: 'syllabusItems', id: null, error: LOCAL_DELETE_FAILURE_MESSAGE, localFailure: true });
              return;
            }
            confirmScheduleInBackground(null);
          }
        }}
        title={isBn ? 'অধ্যায় ডিলিট নিশ্চিতকরণ' : 'Confirm Topic Deletion'}
        message={isBn ? 'এই সিলেবাস অধ্যায়টি মুছে ফেলতে চান?' : 'Delete this syllabus topic?'}
        confirmLabel={isBn ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

    </div>
  );
};
