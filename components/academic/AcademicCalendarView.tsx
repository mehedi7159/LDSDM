import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { AcademicCalendarEvent } from '../../types/academic';
import { academicScheduleService } from '../../services/academicScheduleService';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SCHEDULE_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../../services/cloudConfirm';
import { UnconfirmedBadge } from '../ui/UnconfirmedBadge';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  Sparkles, 
  Printer, 
  Filter, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  PartyPopper, 
  BookOpen, 
  X,
  MapPin,
  CalendarCheck
} from 'lucide-react';

export const AcademicCalendarView: React.FC = () => {
  const { language, confirmScheduleCloudSync, isRecordUnconfirmed } = useApp();
  const isBn = language === 'bn';

  // 7 Nov 2026 Job 7 (instant save, Job 0 pattern): the local mutation
  // applies and the modal closes at once; the cloud confirm runs in the
  // BACKGROUND. On failure the payload is queued, the saved event shows
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
      else setPendingSchedule({ field: 'calendarEvents', id: savedId, error: confirmErrorMessage(result) });
    }).catch((err) => {
      console.error('Background schedule cloud confirm failed:', err);
      setPendingSchedule({ field: 'calendarEvents', id: savedId, error: SCHEDULE_CLOUD_FAILURE_MESSAGE });
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
      else setPendingSchedule((prev) => (prev ? { ...prev, error: confirmErrorMessage(result) } : { field: 'calendarEvents', id: null, error: confirmErrorMessage(result) }));
    } finally {
      setIsRetryingSchedule(false);
    }
  };

  const [filterType, setFilterType] = useState<string>('ALL');
  const [version, setVersion] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);

  const [formState, setFormState] = useState<{
    title: string;
    titleBn: string;
    type: 'HOLIDAY' | 'EXAM' | 'EVENT' | 'VACATION' | 'ACADEMIC_TERM' | 'MEETING';
    startDate: string;
    endDate: string;
    isHoliday: boolean;
    description: string;
  }>({
    title: '',
    titleBn: '',
    type: 'HOLIDAY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isHoliday: true,
    description: ''
  });

  const events = useMemo(() => {
    let list = academicScheduleService.getCalendarEvents();
    if (filterType !== 'ALL') {
      list = list.filter(e => e.type === filterType || (filterType === 'HOLIDAY_ALL' && e.isHoliday));
    }
    // Sort chronologically
    return list.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [filterType, version]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const all = academicScheduleService.getCalendarEvents();
    const holidays = all.filter(e => e.isHoliday);
    const totalHolidayDays = holidays.reduce((acc, h) => acc + (h.totalDays || 1), 0);
    const examEvents = all.filter(e => e.type === 'EXAM').length;
    
    // Find next upcoming event
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = all
      .filter(e => e.startDate >= todayStr)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

    return {
      totalEvents: all.length,
      holidayCount: holidays.length,
      totalHolidayDays,
      examEvents,
      upcoming
    };
  }, [version]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingEvent(null);
    setFormError(null);
    const today = new Date().toISOString().split('T')[0];
    setFormState({
      title: '',
      titleBn: '',
      type: 'HOLIDAY',
      startDate: today,
      endDate: today,
      isHoliday: true,
      description: ''
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (event: AcademicCalendarEvent) => {
    setEditingEvent(event);
    setFormError(null);
    setFormState({
      title: event.title,
      titleBn: event.titleBn || event.title,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      isHoliday: !!event.isHoliday,
      description: event.description || ''
    });
    setIsModalOpen(true);
  };

  // Save Event — instant/optimistic: the local mutation applies and the
  // modal closes at once; the cloud confirm runs in the background
  // (never block-awaited here).
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    // 7 Nov 2026 Job 7: an empty title used to return silently — show
    // the message instead of dropping the save without a word.
    if (!formState.titleBn.trim() && !formState.title.trim()) {
      setFormError(isBn ? 'ইভেন্টের নাম দিন — খালি নাম সংরক্ষণ হবে না।' : 'Enter an event name — an empty name cannot be saved.');
      return;
    }

    const start = new Date(formState.startDate);
    const end = new Date(formState.endDate);
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const payload: AcademicCalendarEvent = {
      id: editingEvent ? editingEvent.id : '',
      title: formState.title.trim() || formState.titleBn.trim(),
      titleBn: formState.titleBn.trim() || formState.title.trim(),
      type: formState.type,
      startDate: formState.startDate,
      endDate: formState.endDate,
      totalDays,
      isHoliday: formState.isHoliday,
      description: formState.description.trim()
    };

    savingRef.current = true;
    setIsSaving(true);
    try {
      const saved = academicScheduleService.saveCalendarEvent(payload);
      // The service swallows localStorage write errors — verify the save
      // actually landed by re-reading; if it did not, keep the modal open
      // with a real message instead of claiming a save.
      const landed = academicScheduleService.getCalendarEvents().some(ev => ev.id === saved.id && (ev.titleBn || ev.title) === (saved.titleBn || saved.title));
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
      console.error('Calendar local save failed:', err);
      setFormError(LOCAL_SAVE_FAILURE_MESSAGE);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Delete
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setEventToDelete(id);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const getEventBadge = (type: string, isHoliday: boolean) => {
    if (isHoliday) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <PartyPopper size={11} />
          <span>{isBn ? 'ছুটি' : 'Holiday'}</span>
        </span>
      );
    }
    switch (type) {
      case 'EXAM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <BookOpen size={11} />
            <span>{isBn ? 'পরীক্ষা' : 'Exam'}</span>
          </span>
        );
      case 'ACADEMIC_TERM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
            <Clock size={11} />
            <span>{isBn ? 'শিক্ষাবর্ষ/টার্ম' : 'Term'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CalendarCheck size={11} />
            <span>{isBn ? 'ইভেন্ট' : 'Event'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Job 7 (instant save): the background cloud confirm failed for
          the just-saved event — it sits queued with its amber badge.
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
      {/* Job 7: the modal closed at once — the event is saved on this
          device and syncing to the cloud in the background. */}
      {scheduleSaveNote && !pendingSchedule && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{isBn ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
        </div>
      )}
      {/* Top Header */}
      <PageHeader
        icon={Calendar}
        title={isBn ? 'একাডেমিক ক্যালেন্ডার ও ছুটির তালিকা' : 'Academic Calendar & Holidays'}
      >

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300 dark:border-slate-600"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট ক্যালেন্ডার' : 'Print'}</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5"
          >
            <Plus size={15} />
            <span>{isBn ? 'নতুন ইভেন্ট / ছুটি যুক্ত করুন' : 'Add Event'}</span>
          </Button>
        </div>
      </PageHeader>

      {/* Overview Cards & Next Upcoming Alert */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Next Event Banner */}
        <div className="md:col-span-2 bg-teal-800 text-white p-4.5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-teal-200 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles size={14} />
              <span>{isBn ? 'আসন্ন পরবর্তী ইভেন্ট / ছুটি' : 'Next Upcoming Event'}</span>
            </div>
            {stats.upcoming ? (
              <div>
                <h3 className="text-lg font-black tracking-tight">{stats.upcoming.titleBn || stats.upcoming.title}</h3>
                <p className="text-xs text-teal-100 mt-0.5 flex items-center gap-2">
                  <span>📅 {formatSafeDate(stats.upcoming.startDate, isBn)}</span>
                  <span>({formatNumber(stats.upcoming.totalDays, 'bn')} দিন)</span>
                  {stats.upcoming.isHoliday && <span className="bg-rose-500/80 px-1.5 py-0.5 rounded text-[10px] font-bold">ছুটি</span>}
                </p>
              </div>
            ) : (
              <div className="text-xs text-teal-100">{isBn ? 'কোনো আসন্ন ইভেন্ট নেই' : 'No upcoming events'}</div>
            )}
          </div>
        </div>

        {/* Holiday Stats */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'মোট সাধারণ ছুটি' : 'Holidays'}</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{formatNumber(stats.totalHolidayDays, 'bn')} দিন</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{formatNumber(stats.holidayCount, 'bn')} টি উপলক্ষ</div>
          </div>
        </div>

        {/* Exams Stats */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'নির্ধারিত পরীক্ষা টার্ম' : 'Exam Terms'}</div>
            <div className="text-xl font-black text-purple-800 dark:text-purple-300">{formatNumber(stats.examEvents, 'bn')} টি</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{isBn ? '১ম, ২য় ও বার্ষিক' : 'Term exams'}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-1.5 gap-1">
        {[
          { id: 'ALL', label: isBn ? 'সকল' : 'All' },
          { id: 'HOLIDAY_ALL', label: isBn ? 'ছুটি' : 'Holidays' },
          { id: 'EXAM', label: isBn ? 'পরীক্ষা' : 'Exams' },
          { id: 'EVENT', label: isBn ? 'অনুষ্ঠান' : 'Events' },
          { id: 'ACADEMIC_TERM', label: isBn ? 'টার্ম' : 'Terms' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterType === tab.id
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Timeline / List */}
      <div className="space-y-3">
        {events.map((event, idx) => (
          <div
            key={event.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {new Date(event.startDate).toLocaleString('en', { month: 'short' })}
                </span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                  {new Date(event.startDate).getDate()}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {getEventBadge(event.type, event.isHoliday)}
                  {isRecordUnconfirmed('calendarEvents', event.id) && <UnconfirmedBadge isBn={isBn} />}
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    {formatSafeDate(event.startDate, isBn)} 
                    {event.startDate !== event.endDate ? ` – ${formatSafeDate(event.endDate, isBn)}` : ''}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    ({formatNumber(event.totalDays, 'bn')} দিন)
                  </span>
                </div>

                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{event.titleBn || event.title}</h3>
                {event.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{event.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 self-end md:self-center">
              <button
                type="button"
                onClick={() => handleOpenEdit(event)}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                title="সম্পাদনা"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(event.id)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="মুছে ফেলুন"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calendar size={18} />
                <h3 className="font-bold text-sm">
                  {editingEvent ? (isBn ? 'ইভেন্ট / ছুটি সম্পাদনা' : 'Edit Event') : (isBn ? 'নতুন ইভেন্ট বা ছুটি যোগ করুন' : 'Add Event')}
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
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ইভেন্ট বা ছুটির নাম (বাংলা) *' : 'Title (Bangla) *'}</label>
                <input
                  type="text"
                  value={formState.titleBn}
                  onChange={e => { setFormState({ ...formState, titleBn: e.target.value }); setFormError(null); }}
                  required
                  placeholder="যেমন: পবিত্র ঈদুল ফিতর"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'ইভেন্টের ধরন' : 'Event Type'}</label>
                <select
                  value={formState.type}
                  onChange={e => {
                    const val = e.target.value as any;
                    setFormState({ 
                      ...formState, 
                      type: val, 
                      isHoliday: val === 'HOLIDAY' || val === 'VACATION' 
                    });
                  }}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-semibold"
                >
                  <option value="HOLIDAY">সাধারণ ছুটি (Holiday)</option>
                  <option value="VACATION">দীর্ঘ অবকাশ (Vacation)</option>
                  <option value="EXAM">টার্ম পরীক্ষা (Examination)</option>
                  <option value="EVENT">অনুষ্ঠান ও ক্রীড়া (Event)</option>
                  <option value="ACADEMIC_TERM">একাডেমিক সেশন (Academic Term)</option>
                  <option value="MEETING">অভিভাবক/কমিটি সভা (Meeting)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'শুরুর তারিখ' : 'Start Date'}</label>
                  <input
                    type="date"
                    value={formState.startDate}
                    onChange={e => setFormState({ ...formState, startDate: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'সমাপ্তির তারিখ' : 'End Date'}</label>
                  <input
                    type="date"
                    value={formState.endDate}
                    onChange={e => setFormState({ ...formState, endDate: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-600 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHolidayCheck"
                  checked={formState.isHoliday}
                  onChange={e => setFormState({ ...formState, isHoliday: e.target.checked })}
                  className="rounded text-teal-700 dark:text-teal-400 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isHolidayCheck" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  {isBn ? 'মাদ্রাসা বা পাঠদান বন্ধ থাকবে (অফিসিয়াল ছুটি)' : 'Off Day / Institutional Holiday'}
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{isBn ? 'বিবরণ বা নোটিশ' : 'Description'}</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={e => setFormState({ ...formState, description: e.target.value })}
                  placeholder="ছুটি বা ইভেন্টের অতিরিক্ত তথ্য..."
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
                  {editingEvent ? (isBn ? 'আপডেট করুন' : 'Update') : (isBn ? 'সংরক্ষণ করুন' : 'Save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        onConfirm={() => {
          if (eventToDelete) {
            const id = eventToDelete;
            academicScheduleService.deleteCalendarEvent(id);
            setVersion(v => v + 1);
            setEventToDelete(null);
            // The service swallows localStorage write errors — verify the
            // delete actually landed before confirming it to the cloud.
            if (academicScheduleService.getCalendarEvents().some(ev => ev.id === id)) {
              setPendingSchedule({ field: 'calendarEvents', id: null, error: LOCAL_DELETE_FAILURE_MESSAGE, localFailure: true });
              return;
            }
            confirmScheduleInBackground(null);
          }
        }}
        title={isBn ? 'ইভেন্ট ডিলিট নিশ্চিতকরণ' : 'Confirm Event Deletion'}
        message={isBn ? 'এই ইভেন্টটি ক্যালেন্ডার থেকে মুছে ফেলতে চান?' : 'Delete this calendar event?'}
        confirmLabel={isBn ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}
        cancelLabel={isBn ? 'বাতিল' : 'Cancel'}
        variant="danger"
      />

    </div>
  );
};
