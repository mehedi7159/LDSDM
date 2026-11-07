import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ClassRoutineItem, DayOfWeek } from '../../types/academic';
import { 
  academicScheduleService, 
  DAYS_OF_WEEK, 
  STANDARD_PERIODS 
} from '../../services/academicScheduleService';
import { formatNumber } from '../../services/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SCHEDULE_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../../services/cloudConfirm';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  Printer, 
  Users, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Filter, 
  UserCheck, 
  Layers, 
  Sparkles,
  Download
} from 'lucide-react';

export const ClassRoutineBuilder: React.FC = () => {
  const { classes, subjects, teachers, language, confirmScheduleCloudSync, isRecordUnconfirmed } = useApp();
  const isBn = language === 'bn';
  const printRef = useRef<HTMLDivElement>(null);

  // 7 Nov 2026 Job 7 (instant save, Job 0 pattern): the local mutation
  // applies and the modal closes at once; the cloud confirm runs in the
  // BACKGROUND. On failure the payload is queued, the saved period shows
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
      else setPendingSchedule({ field: 'classRoutines', id: savedId, error: confirmErrorMessage(result) });
    }).catch((err) => {
      console.error('Background schedule cloud confirm failed:', err);
      setPendingSchedule({ field: 'classRoutines', id: savedId, error: SCHEDULE_CLOUD_FAILURE_MESSAGE });
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
      else setPendingSchedule((prev) => (prev ? { ...prev, error: confirmErrorMessage(result) } : { field: 'classRoutines', id: null, error: confirmErrorMessage(result) }));
    } finally {
      setIsRetryingSchedule(false);
    }
  };

  // The service's saveRoutineItem returns no id for a new period (it
  // generates one internally), so verify by re-reading: an edit must
  // still carry its id with the new subject; a create must have added
  // exactly this day/period/class/subject row (a conflict check already
  // rejects any pre-existing row for the slot, so the match is unique).
  const verifyRoutineSaved = (payload: ClassRoutineItem, wasEdit: boolean): string | null => {
    const list = academicScheduleService.getRoutines();
    if (wasEdit) {
      const found = list.find(r => r.id === payload.id);
      return found && found.subjectId === payload.subjectId ? found.id : null;
    }
    const found = list.find(r =>
      r.dayOfWeek === payload.dayOfWeek &&
      r.periodNumber === payload.periodNumber &&
      r.classLevel === payload.classLevel &&
      (r.sectionName || '') === (payload.sectionName || '') &&
      r.subjectId === payload.subjectId
    );
    return found ? found.id : null;
  };

  // Active View Mode: 'by_class' (Class view) or 'by_teacher' (Teacher view)
  const [viewMode, setViewMode] = useState<'by_class' | 'by_teacher'>('by_class');
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '১ম শ্রেণি');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');

  // Refresh trigger
  const [version, setVersion] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ClassRoutineItem | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Form State
  const [formState, setFormState] = useState<{
    classLevel: string;
    sectionName: string;
    dayOfWeek: DayOfWeek;
    periodNumber: number;
    periodName: string;
    startTime: string;
    endTime: string;
    subjectId: string;
    teacherId: string;
    roomNumber: string;
  }>({
    classLevel: selectedClass,
    sectionName: 'ক',
    dayOfWeek: 'Saturday',
    periodNumber: 1,
    periodName: '১ম ঘণ্টা',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    subjectId: '',
    teacherId: '',
    roomNumber: '১০১'
  });

  // Load routine items
  const routineItems = useMemo(() => {
    // Read from service
    if (viewMode === 'by_class') {
      return academicScheduleService.getRoutineByClass(selectedClass, selectedSection);
    } else {
      return academicScheduleService.getRoutineByTeacher(selectedTeacherId);
    }
  }, [viewMode, selectedClass, selectedSection, selectedTeacherId, version]);

  // Active days (Saturday - Thursday)
  const activeDays = DAYS_OF_WEEK.filter(d => d.en !== 'Friday');

  // Active periods excluding break
  const activePeriods = STANDARD_PERIODS.filter(p => !p.isBreak);

  // Helper to open Add modal
  const handleOpenAdd = (day: DayOfWeek, periodNum: number) => {
    const periodObj = STANDARD_PERIODS.find(p => p.number === periodNum) || STANDARD_PERIODS[0];
    const defaultSubject = subjects.find(s => s.classLevel === selectedClass) || subjects[0];
    const defaultTeacher = teachers[0];

    setEditingItem(null);
    setConflictError(null);
    setFormState({
      classLevel: selectedClass,
      sectionName: selectedSection === 'ALL' ? 'ক' : selectedSection,
      dayOfWeek: day,
      periodNumber: periodNum,
      periodName: periodObj.nameBn,
      startTime: periodObj.start,
      endTime: periodObj.end,
      subjectId: defaultSubject?.id || '',
      teacherId: defaultTeacher?.id || '',
      roomNumber: '১০১'
    });
    setIsModalOpen(true);
  };

  // Helper to open Edit modal
  const handleOpenEdit = (item: ClassRoutineItem) => {
    setEditingItem(item);
    setConflictError(null);
    setFormState({
      classLevel: item.classLevel,
      sectionName: item.sectionName || 'ক',
      dayOfWeek: item.dayOfWeek,
      periodNumber: item.periodNumber,
      periodName: item.periodName || `${item.periodNumber}ম ঘণ্টা`,
      startTime: item.startTime,
      endTime: item.endTime,
      subjectId: item.subjectId,
      teacherId: item.teacherId || '',
      roomNumber: item.roomNumber || ''
    });
    setIsModalOpen(true);
  };

  // Save routine period — instant/optimistic: the local mutation applies
  // and the modal closes at once; the cloud confirm runs in the
  // background (never block-awaited here).
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!formState.subjectId) {
      setConflictError(isBn ? 'অনুগ্রহ করে একটি বিষয় নির্বাচন করুন।' : 'Please select a subject.');
      return;
    }

    const sub = subjects.find(s => s.id === formState.subjectId);
    const tch = teachers.find(t => t.id === formState.teacherId);

    const payload: ClassRoutineItem = {
      id: editingItem ? editingItem.id : '',
      classLevel: formState.classLevel,
      sectionName: formState.sectionName,
      dayOfWeek: formState.dayOfWeek,
      periodNumber: Number(formState.periodNumber),
      periodName: formState.periodName,
      startTime: formState.startTime,
      endTime: formState.endTime,
      subjectId: formState.subjectId,
      subjectName: sub?.nameBn || sub?.name || 'বিষয়',
      teacherId: formState.teacherId || undefined,
      teacherName: tch?.nameBn || tch?.name || undefined,
      roomNumber: formState.roomNumber || undefined,
      status: 'ACTIVE'
    };

    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = academicScheduleService.saveRoutineItem(payload);
      if (!result.success) {
        setConflictError(result.conflictError || 'দ্বন্দ্বের কারণে সংরক্ষণ করা যায়নি।');
        return;
      }
      const savedId = verifyRoutineSaved(payload, !!editingItem);
      if (!savedId) {
        setConflictError(LOCAL_SAVE_FAILURE_MESSAGE);
        return;
      }

      setIsModalOpen(false);
      setConflictError(null);
      setVersion(v => v + 1);
      setScheduleSaveNote(true);
      setTimeout(() => setScheduleSaveNote(false), 2000);
      confirmScheduleInBackground(savedId);
    } catch (err) {
      console.error('Routine local save failed:', err);
      setConflictError(LOCAL_SAVE_FAILURE_MESSAGE);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Delete routine period
  const [periodToDelete, setPeriodToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setPeriodToDelete(id);
  };

  // Print Routine
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    const list = academicScheduleService.getRoutines();
    let csv = '\uFEFFDay,Period,Start,End,Class,Section,Subject,Teacher,Room\n';
    list.forEach(r => {
      csv += `"${r.dayOfWeek}","${r.periodName || r.periodNumber}","${r.startTime}","${r.endTime}","${r.classLevel}","${r.sectionName || ''}","${r.subjectName || ''}","${r.teacherName || ''}","${r.roomNumber || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-routine-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick stats
  const totalClassesInRoutine = routineItems.length;

  return (
    <div className="space-y-6">
      {/* Job 7 (instant save): the background cloud confirm failed for
          the just-saved period — it sits queued with its amber badge.
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
      {/* Job 7: the modal closed at once — the period is saved on this
          device and syncing to the cloud in the background. */}
      {scheduleSaveNote && !pendingSchedule && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
        </div>
      )}
      {/* Top Header & Mode Toggle */}
      <PageHeader
        icon={Clock}
        title={isBn ? 'ক্লাস রুটিন ও শিক্ষক পিরিয়ড প্ল্যানার' : 'Class Routine & Period Planner'}
      >

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('by_class')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'by_class'
                  ? 'bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers size={13} />
                <span>{isBn ? 'শ্রেণিভিত্তিক রুটিন' : 'By Class'}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_teacher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'by_teacher'
                  ? 'bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <UserCheck size={13} />
                <span>{isBn ? 'শিক্ষকভিত্তিক রুটিন' : 'By Teacher'}</span>
              </span>
            </button>
          </div>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300 dark:border-slate-600"
          >
            <Download size={14} />
            <span>{isBn ? 'CSV এক্সপোর্ট' : 'Export'}</span>
          </Button>

          <Button
            onClick={handlePrint}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট রুটিন' : 'Print Routine'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* Filter Strip */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        {viewMode === 'by_class' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'শ্রেণি নির্বাচন:' : 'Class:'}</span>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'শাখা:' : 'Section:'}</span>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">{isBn ? 'সকল শাখা' : 'All Sections'}</option>
                <option value="ক">শাখা ক</option>
                <option value="খ">শাখা খ</option>
                <option value="গ">শাখা গ</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{isBn ? 'শিক্ষক নির্বাচন:' : 'Teacher:'}</span>
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 min-w-[200px]"
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.nameBn || t.name} ({t.designation || 'শিক্ষক'})</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span>{isBn ? `মোট নির্ধারিত পিরিয়ড: ${formatNumber(totalClassesInRoutine, 'bn')}` : `Total Periods: ${totalClassesInRoutine}`}</span>
          </div>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{isBn ? 'শুক্রবার সাপ্তাহিক মাদ্রাসা বন্ধ' : 'Friday off'}</span>
        </div>
      </div>

      {/* Interactive Timetable Grid (Printable Area) */}
      <div ref={printRef} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 print:bg-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {viewMode === 'by_class' 
                ? (isBn ? `শ্রেণি: ${selectedClass} (${selectedSection === 'ALL' ? 'সকল শাখা' : selectedSection}) এর সাপ্তাহিক রুটিন` : `Timetable: ${selectedClass}`)
                : (isBn 
                    ? `শিক্ষক: ${teachers.find(t => t.id === selectedTeacherId)?.nameBn || teachers.find(t => t.id === selectedTeacherId)?.name || ''} এর ব্যক্তিগত সময়সূচি` 
                    : `Teacher Timetable`)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBn ? 'শিক্ষাবর্ষ: ২০২৬ • মাদ্রাসা ও শিক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম' : 'Academic Year: 2026'}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 hidden print:block">
            {new Date().toLocaleDateString('bn-BD')}
          </div>
        </div>

        {/* Timetable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-100/80 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-3 w-28 text-center border-r border-slate-200 dark:border-slate-800 bg-slate-200/50">
                  {isBn ? 'বার / দিন' : 'Day'}
                </th>
                {activePeriods.map(p => (
                  <th key={p.number} className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center min-w-[130px]">
                    <div className="font-black text-slate-800 dark:text-slate-100">{p.nameBn}</div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{p.start} - {p.end}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {activeDays.map(day => (
                <tr key={day.en} className="hover:bg-slate-50/50 transition-colors">
                  {/* Day Label */}
                  <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/60 text-center border-r border-slate-200 dark:border-slate-800 align-middle">
                    <div className="text-xs">{day.bn}</div>
                    <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{day.en}</div>
                  </td>

                  {/* Period Cells */}
                  {activePeriods.map(period => {
                    const match = routineItems.find(r => r.dayOfWeek === day.en && r.periodNumber === period.number);

                    return (
                      <td key={period.number} className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 align-top h-24">
                        {match ? (
                          <div className="bg-teal-50/80 border border-teal-200 dark:border-teal-800 rounded-xl p-2.5 h-full flex flex-col justify-between group hover:border-teal-400 transition-all">
                            <div>
                              <div className="font-bold text-teal-950 dark:text-teal-200 text-xs flex items-center justify-between">
                                <span className="truncate" title={match.subjectName}>
                                  {match.subjectName}
                                </span>
                                {match.roomNumber && (
                                  <span className="text-[10px] font-mono bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 px-1 rounded font-semibold ml-1 shrink-0">
                                    রুম {match.roomNumber}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-teal-800 dark:text-teal-300 mt-1 flex items-center gap-1 truncate" title={match.teacherName}>
                                <Users size={11} className="shrink-0 text-teal-600 dark:text-teal-400" />
                                <span className="truncate">{match.teacherName || (isBn ? 'শিক্ষক অপ্রাপ্ত' : 'No teacher')}</span>
                              </div>

                              {isRecordUnconfirmed('classRoutines', match.id) && <UnconfirmedBadge isBn={isBn} />}

                              {viewMode === 'by_teacher' && (
                                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1">
                                  {match.classLevel} {match.sectionName ? `(${match.sectionName})` : ''}
                                </div>
                              )}
                            </div>

                            {/* Action buttons (hidden on print) */}
                            <div className="flex items-center justify-end gap-1 mt-2 pt-1 border-t border-teal-100/80 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(match)}
                                className="p-1 text-teal-700 dark:text-teal-400 hover:text-teal-900 hover:bg-teal-100 rounded"
                                title="সম্পাদনা"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(match.id)}
                                className="p-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 hover:bg-rose-100 rounded"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:border-teal-300 hover:bg-teal-50/30 transition-all group cursor-pointer print:hidden"
                               onClick={() => handleOpenAdd(day.en, period.number)}>
                            <Plus size={14} className="text-slate-300 group-hover:text-teal-600 mb-0.5" />
                            <span className="text-[10px] font-bold group-hover:text-teal-700">
                              {isBn ? 'যোগ করুন' : 'Add'}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Timetable Notice Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            {isBn ? '⚠️ প্রতিটি পিরিয়ডের শুরু ও সমাপ্তি সময় অনুযায়ী ঘণ্টাধ্বনি বাজানো হবে।' : 'Standard madrasah periods.'}
          </span>
          <span className="font-mono text-slate-400 dark:text-slate-500">
            Madrasah Routine Management System • v3.0
          </span>
        </div>
      </div>

      {/* Routine Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <h3 className="font-bold text-sm">
                  {editingItem ? (isBn ? 'পিরিয়ড সম্পাদনা' : 'Edit Period') : (isBn ? 'নতুন পিরিয়ড যুক্ত করুন' : 'Add Routine Period')}
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
              {conflictError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <div className="font-bold">{isBn ? 'সময়সূচি দ্বন্দ্ব সনাক্ত হয়েছে!' : 'Schedule Conflict!'}</div>
                    <div>{conflictError}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'বার / দিন' : 'Day'}
                  </label>
                  <select
                    value={formState.dayOfWeek}
                    onChange={e => setFormState({ ...formState, dayOfWeek: e.target.value as DayOfWeek })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                  >
                    {activeDays.map(d => (
                      <option key={d.en} value={d.en}>{d.bn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'পিরিয়ড নং' : 'Period'}
                  </label>
                  <select
                    value={formState.periodNumber}
                    onChange={e => {
                      const num = Number(e.target.value);
                      const p = STANDARD_PERIODS.find(sp => sp.number === num);
                      setFormState({
                        ...formState,
                        periodNumber: num,
                        periodName: p?.nameBn || `${num}ম ঘণ্টা`,
                        startTime: p?.start || formState.startTime,
                        endTime: p?.end || formState.endTime
                      });
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                  >
                    {activePeriods.map(p => (
                      <option key={p.number} value={p.number}>{p.nameBn}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'শ্রেণি' : 'Class'}
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'শাখা' : 'Section'}
                  </label>
                  <input
                    type="text"
                    value={formState.sectionName}
                    onChange={e => setFormState({ ...formState, sectionName: e.target.value })}
                    placeholder="ক / খ / A"
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isBn ? 'বিষয় নির্বাচন *' : 'Subject *'}
                </label>
                <select
                  value={formState.subjectId}
                  onChange={e => setFormState({ ...formState, subjectId: e.target.value })}
                  required
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                >
                  <option value="">{isBn ? '-- বিষয় নির্বাচন করুন --' : '-- Select Subject --'}</option>
                  {subjects
                    .filter(s => !formState.classLevel || s.classLevel === formState.classLevel || !s.classLevel)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nameBn || s.name} {s.code ? `(${s.code})` : ''} - {s.classLevel || 'সকল'}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isBn ? 'নিয়োজিত শিক্ষক' : 'Assigned Teacher'}
                </label>
                <select
                  value={formState.teacherId}
                  onChange={e => setFormState({ ...formState, teacherId: e.target.value })}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                >
                  <option value="">{isBn ? '-- শিক্ষক নির্বাচন করুন (ঐচ্ছিক) --' : '-- Select Teacher --'}</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nameBn || t.name} ({t.designation || 'শিক্ষক'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'শুরু সময়' : 'Start'}
                  </label>
                  <input
                    type="text"
                    value={formState.startTime}
                    onChange={e => setFormState({ ...formState, startTime: e.target.value })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'সমাপ্তি সময়' : 'End'}
                  </label>
                  <input
                    type="text"
                    value={formState.endTime}
                    onChange={e => setFormState({ ...formState, endTime: e.target.value })}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {isBn ? 'কক্ষ নং' : 'Room'}
                  </label>
                  <input
                    type="text"
                    value={formState.roomNumber}
                    onChange={e => setFormState({ ...formState, roomNumber: e.target.value })}
                    placeholder="১০১"
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2"
                  />
                </div>
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
        isOpen={!!periodToDelete}
        onClose={() => setPeriodToDelete(null)}
        onConfirm={() => {
          if (periodToDelete) {
            const id = periodToDelete;
            academicScheduleService.deleteRoutineItem(id);
            setVersion(v => v + 1);
            setPeriodToDelete(null);
            // The service swallows localStorage write errors — verify the
            // delete actually landed before confirming it to the cloud.
            if (academicScheduleService.getRoutines().some(r => r.id === id)) {
              setPendingSchedule({ field: 'classRoutines', id: null, error: LOCAL_DELETE_FAILURE_MESSAGE, localFailure: true });
              return;
            }
            confirmScheduleInBackground(null);
          }
        }}
        title={isBn ? 'পিরিয়ড ডিলিট নিশ্চিতকরণ' : 'Confirm Period Deletion'}
        message={isBn ? 'আপনি কি এই পিরিয়ডটি রুটিন থেকে মুছে ফেলতে চান?' : 'Delete this routine period?'}
        confirmLabel={isBn ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

    </div>
  );
};
