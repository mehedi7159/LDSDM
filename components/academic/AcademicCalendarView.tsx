import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AcademicCalendarEvent } from '../../types/academic';
import { academicScheduleService } from '../../services/academicScheduleService';
import { formatNumber, formatSafeDate } from '../../services/utils';
import { Button } from '../ui/Button';
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
  const { language } = useApp();
  const isBn = language === 'bn';

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

  // Save Event
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.titleBn.trim() && !formState.title.trim()) return;

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

    academicScheduleService.saveCalendarEvent(payload);
    setIsModalOpen(false);
    setVersion(v => v + 1);
  };

  // Delete
  const handleDelete = (id: string) => {
    if (confirm(isBn ? 'এই ইভেন্টটি ক্যালেন্ডার থেকে মুছে ফেলতে চান?' : 'Delete this calendar event?')) {
      academicScheduleService.deleteCalendarEvent(id);
      setVersion(v => v + 1);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  const getEventBadge = (type: string, isHoliday: boolean) => {
    if (isHoliday) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          <PartyPopper size={11} />
          <span>{isBn ? 'ছুটি' : 'Holiday'}</span>
        </span>
      );
    }
    switch (type) {
      case 'EXAM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <BookOpen size={11} />
            <span>{isBn ? 'পরীক্ষা' : 'Exam'}</span>
          </span>
        );
      case 'ACADEMIC_TERM':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            <Clock size={11} />
            <span>{isBn ? 'শিক্ষাবর্ষ/টার্ম' : 'Term'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <CalendarCheck size={11} />
            <span>{isBn ? 'ইভেন্ট' : 'Event'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider mb-1">
            <Calendar size={16} />
            <span>{isBn ? 'বাৎসরিক একাডেমিক ও ছুটির দিনপঞ্জি' : 'Annual Academic & Holiday Calendar'}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isBn ? 'একাডেমিক ক্যালেন্ডার ও ছুটির তালিকা' : 'Academic Calendar & Holidays'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn 
              ? 'ইসলামিক ও জাতীয় সাধারণ ছুটি, সাময়িক ও বার্ষিক পরীক্ষার সময়রেখা এবং প্রাতিষ্ঠানিক অনুষ্ঠানসূচি।'
              : 'Official holidays, Islamic dates, examination timeline and institutional events.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5 py-2 px-3 border-slate-300"
          >
            <Printer size={14} />
            <span>{isBn ? 'প্রিন্ট ক্যালেন্ডার' : 'Print'}</span>
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 py-2 px-3.5 shadow-xs"
          >
            <Plus size={15} />
            <span>{isBn ? 'নতুন ইভেন্ট / ছুটি যুক্ত করুন' : 'Add Event'}</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards & Next Upcoming Alert */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Next Event Banner */}
        <div className="md:col-span-2 bg-gradient-to-r from-teal-800 to-emerald-800 text-white p-4.5 rounded-2xl shadow-xs flex items-center justify-between">
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
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
            🕌
          </div>
        </div>

        {/* Holiday Stats */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
            <PartyPopper size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{isBn ? 'মোট সাধারণ ছুটি' : 'Holidays'}</div>
            <div className="text-lg font-black text-slate-800">{formatNumber(stats.totalHolidayDays, 'bn')} দিন</div>
            <div className="text-[10px] text-slate-400 font-semibold">{formatNumber(stats.holidayCount, 'bn')} টি উপলক্ষ</div>
          </div>
        </div>

        {/* Exams Stats */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{isBn ? 'নির্ধারিত পরীক্ষা টার্ম' : 'Exam Terms'}</div>
            <div className="text-lg font-black text-purple-800">{formatNumber(stats.examEvents, 'bn')} টি</div>
            <div className="text-[10px] text-slate-400 font-semibold">{isBn ? '১ম, ২য় ও বার্ষিক' : 'Term exams'}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-2xs overflow-x-auto gap-1">
        {[
          { id: 'ALL', label: isBn ? 'সকল ইভেন্ট ও ছুটি' : 'All Events' },
          { id: 'HOLIDAY_ALL', label: isBn ? 'শুধুমাত্র ছুটির তালিকা' : 'Holidays Only' },
          { id: 'EXAM', label: isBn ? 'পরীক্ষার সময়সূচি' : 'Exams Only' },
          { id: 'EVENT', label: isBn ? 'অনুষ্ঠান ও সমাবেশ' : 'Institutional Events' },
          { id: 'ACADEMIC_TERM', label: isBn ? 'একাডেমিক টার্ম' : 'Academic Terms' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              filterType === tab.id
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {new Date(event.startDate).toLocaleString('en', { month: 'short' })}
                </span>
                <span className="text-base font-black text-slate-800 leading-tight">
                  {new Date(event.startDate).getDate()}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {getEventBadge(event.type, event.isHoliday)}
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {formatSafeDate(event.startDate, isBn)} 
                    {event.startDate !== event.endDate ? ` – ${formatSafeDate(event.endDate, isBn)}` : ''}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    ({formatNumber(event.totalDays, 'bn')} দিন)
                  </span>
                </div>

                <h3 className="font-bold text-slate-800 text-sm">{event.titleBn || event.title}</h3>
                {event.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 self-end md:self-center">
              <button
                type="button"
                onClick={() => handleOpenEdit(event)}
                className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                title="সম্পাদনা"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(event.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'ইভেন্ট বা ছুটির নাম (বাংলা) *' : 'Title (Bangla) *'}</label>
                <input
                  type="text"
                  value={formState.titleBn}
                  onChange={e => setFormState({ ...formState, titleBn: e.target.value })}
                  required
                  placeholder="যেমন: পবিত্র ঈদুল ফিতর"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'ইভেন্টের ধরন' : 'Event Type'}</label>
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'শুরুর তারিখ' : 'Start Date'}</label>
                  <input
                    type="date"
                    value={formState.startDate}
                    onChange={e => setFormState({ ...formState, startDate: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'সমাপ্তির তারিখ' : 'End Date'}</label>
                  <input
                    type="date"
                    value={formState.endDate}
                    onChange={e => setFormState({ ...formState, endDate: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHolidayCheck"
                  checked={formState.isHoliday}
                  onChange={e => setFormState({ ...formState, isHoliday: e.target.checked })}
                  className="rounded text-teal-700 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isHolidayCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  {isBn ? 'মাদ্রাসা বা পাঠদান বন্ধ থাকবে (অফিসিয়াল ছুটি)' : 'Off Day / Institutional Holiday'}
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{isBn ? 'বিবরণ বা নোটিশ' : 'Description'}</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={e => setFormState({ ...formState, description: e.target.value })}
                  placeholder="ছুটি বা ইভেন্টের অতিরিক্ত তথ্য..."
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
                  {editingEvent ? (isBn ? 'আপডেট করুন' : 'Update') : (isBn ? 'সংরক্ষণ করুন' : 'Save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
