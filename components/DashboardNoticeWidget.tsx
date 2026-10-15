import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NoticeItem, NoticeCategory, NoticePriority, NoticeTarget } from '../types';
import { 
  Megaphone, 
  Pin, 
  Calendar, 
  Clock, 
  Users, 
  AlertCircle, 
  Plus, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  Printer, 
  X,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Button } from './ui/Button';

interface DashboardNoticeWidgetProps {
  onNavigateToNotices?: () => void;
}

export const DashboardNoticeWidget: React.FC<DashboardNoticeWidgetProps> = ({ onNavigateToNotices }) => {
  const { notices = [], addNotice, isAdmin, isSuperAdmin, authUser, language, classes = [] } = useApp();
  const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === 'mehedihasansagor26@gmail.com'.toLowerCase();
  const canManage = isOwnerAdmin || isAdmin;

  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent' | 'diary' | 'holiday'>('all');
  const [selectedNoticeForModal, setSelectedNoticeForModal] = useState<NoticeItem | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);

  // Form states for quick notice creation
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('general');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [target, setTarget] = useState<NoticeTarget>('all');
  const [targetClass, setTargetClass] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [authorName, setAuthorName] = useState(authUser?.displayName || 'মুহতামিম কার্যালয়');

  // Filter notices
  const filteredNotices = useMemo(() => {
    let list = [...notices];

    // Priority sorting: Pinned first, then newest date
    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
    });

    if (activeFilter === 'urgent') {
      list = list.filter(n => n.priority === 'urgent' || n.category === 'urgent');
    } else if (activeFilter === 'diary') {
      list = list.filter(n => n.category === 'diary');
    } else if (activeFilter === 'holiday') {
      list = list.filter(n => n.category === 'holiday' || n.category === 'exam');
    }

    return list;
  }, [notices, activeFilter]);

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    addNotice({
      title: title.trim(),
      content: content.trim(),
      category,
      priority,
      target,
      targetClass: target === 'class' ? targetClass : undefined,
      date: new Date().toISOString().split('T')[0],
      isPinned,
      authorName: authorName.trim() || 'প্রশাসন',
      authorRole: 'অধ্যক্ষ'
    });

    // Reset and close
    setTitle('');
    setContent('');
    setCategory('general');
    setPriority('normal');
    setIsPinned(false);
    setIsComposeModalOpen(false);
  };

  const getCategoryBadge = (cat: NoticeCategory) => {
    switch (cat) {
      case 'diary':
        return { label: language === 'bn' ? 'দৈনিক ডায়েরি' : 'Daily Diary', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'urgent':
        return { label: language === 'bn' ? 'জরুরি বিজ্ঞপ্তি' : 'Urgent Notice', style: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'exam':
        return { label: language === 'bn' ? 'পরীক্ষা সংক্রান্ত' : 'Examination', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'holiday':
        return { label: language === 'bn' ? 'ছুটির নোটিশ' : 'Holiday', style: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'event':
        return { label: language === 'bn' ? 'অনুষ্ঠান / মাহফিল' : 'Event', style: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: language === 'bn' ? 'সাধারণ নোটিশ' : 'General', style: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Megaphone size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {language === 'bn' ? 'নোটিশ বোর্ড ও দৈনিক ডায়েরি' : 'Notice Board & Daily Diary'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
                {notices.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {language === 'bn' 
                ? 'মাদ্রাসার গুরুত্বপূর্ণ ঘোষণা, ছুটির নোটিশ ও ক্লাসের দৈনিক বাড়ির কাজ' 
                : 'Important institutional notices, holidays and daily class activities'}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <button
              onClick={() => setIsComposeModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>{language === 'bn' ? 'নতুন নোটিশ' : 'Post Notice'}</span>
            </button>
          )}

          {onNavigateToNotices && (
            <button
              onClick={onNavigateToNotices}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'bn' ? 'সবগুলো দেখুন' : 'View All'}</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'bn' ? 'সব নোটিশ' : 'All'}
        </button>
        <button
          onClick={() => setActiveFilter('urgent')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'urgent' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          {language === 'bn' ? '🚨 জরুরি' : 'Urgent'}
        </button>
        <button
          onClick={() => setActiveFilter('diary')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'diary' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {language === 'bn' ? '📖 দৈনিক ডায়েরি' : 'Daily Diary'}
        </button>
        <button
          onClick={() => setActiveFilter('holiday')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'holiday' ? 'bg-purple-600 text-white shadow-2xs' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          {language === 'bn' ? '📅 পরীক্ষা ও ছুটি' : 'Exam & Holidays'}
        </button>
      </div>

      {/* Notices Preview Grid */}
      {filteredNotices.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
          <BookOpen size={24} className="mx-auto text-slate-300 mb-1.5" />
          <p className="font-bold">{language === 'bn' ? 'বর্তমানে কোনো নোটিশ নেই' : 'No notices currently available'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotices.slice(0, 3).map((notice) => {
            const badge = getCategoryBadge(notice.category);
            const isUrgent = notice.priority === 'urgent';

            return (
              <div
                key={notice.id}
                onClick={() => setSelectedNoticeForModal(notice)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md group ${
                  isUrgent 
                    ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-400' 
                    : 'bg-slate-50/50 border-slate-200/80 hover:border-indigo-300 hover:bg-white'
                }`}
              >
                <div>
                  {/* Notice Meta Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.style}`}>
                        {badge.label}
                      </span>
                      {notice.isPinned && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <Pin size={10} className="fill-amber-600" />
                          <span>{language === 'bn' ? 'পিন করা' : 'Pinned'}</span>
                        </span>
                      )}
                      {notice.targetClass && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {notice.targetClass}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {notice.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {notice.title}
                  </h3>

                  {/* Content snippet */}
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {notice.content}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[150px]">✍️ {notice.authorName || 'প্রশাসন'}</span>
                  <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
                    <span>{language === 'bn' ? 'বিস্তারিত' : 'Read'}</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Read Full Notice Modal */}
      {selectedNoticeForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold tracking-tight">
                  {language === 'bn' ? 'বিজ্ঞপ্তি বিবরণী' : 'Notice Details'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNoticeForModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getCategoryBadge(selectedNoticeForModal.category).style}`}>
                  {getCategoryBadge(selectedNoticeForModal.category).label}
                </span>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar size={13} /> {selectedNoticeForModal.date}
                </span>
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-900 leading-snug">
                  {selectedNoticeForModal.title}
                </h2>
                {selectedNoticeForModal.targetClass && (
                  <p className="text-xs text-indigo-600 font-bold mt-1">
                    শ্রেণি/বিভাগ: {selectedNoticeForModal.targetClass}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-bangla">
                {selectedNoticeForModal.content}
              </div>

              <div className="pt-2 flex justify-between items-center text-xs text-slate-500">
                <div>
                  <span>কর্তৃপক্ষ: </span>
                  <strong className="text-slate-800">{selectedNoticeForModal.authorName || 'মুহতামিম'}</strong>
                </div>
                {selectedNoticeForModal.authorRole && (
                  <span className="text-slate-400">({selectedNoticeForModal.authorRole})</span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button
                onClick={() => setSelectedNoticeForModal(null)}
                className="px-4 py-2 text-xs font-bold"
              >
                {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Compose New Notice Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-900 to-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold tracking-tight">
                  {language === 'bn' ? 'নতুন নোটিশ বা দৈনিক ডায়েরি এন্ট্রি' : 'Post Notice or Daily Activity'}
                </h3>
              </div>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'বিজ্ঞপ্তি / ডায়েরির শিরোনাম *' : 'Notice Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'bn' ? 'যেমন: পবিত্র শবে বরাত উপলক্ষে মাদ্রাসা ছুটি' : 'e.g. Ramadan Holiday Announcement'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="general">{language === 'bn' ? 'সাধারণ নোটিশ' : 'General Notice'}</option>
                    <option value="diary">{language === 'bn' ? 'দৈনিক ডায়েরি / সবক' : 'Daily Diary'}</option>
                    <option value="urgent">{language === 'bn' ? 'জরুরি বিজ্ঞপ্তি' : 'Urgent Notice'}</option>
                    <option value="exam">{language === 'bn' ? 'পরীক্ষা সংক্রান্ত' : 'Examination'}</option>
                    <option value="holiday">{language === 'bn' ? 'ছুটির নোটিশ' : 'Holiday Notice'}</option>
                    <option value="event">{language === 'bn' ? 'অনুষ্ঠান / মাহফিল' : 'Event'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'অগ্রাধিকার (Priority)' : 'Priority'}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as NoticePriority)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="normal">{language === 'bn' ? 'সাধারণ (Normal)' : 'Normal'}</option>
                    <option value="important">{language === 'bn' ? 'গুরুত্বপূর্ণ (Important)' : 'Important'}</option>
                    <option value="urgent">{language === 'bn' ? 'সর্বোচ্চ জরুরি (Urgent)' : 'Urgent'}</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {language === 'bn' ? 'প্রাপক (Audience)' : 'Audience'}
                  </label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value as NoticeTarget)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="all">{language === 'bn' ? 'সকলের জন্য (All)' : 'Everyone'}</option>
                    <option value="students">{language === 'bn' ? 'শিক্ষার্থী ও অভিভাবক' : 'Students & Guardians'}</option>
                    <option value="teachers">{language === 'bn' ? 'উস্তাদবৃন্দ (Teachers)' : 'Teachers'}</option>
                    <option value="class">{language === 'bn' ? 'নির্দিষ্ট শ্রেণি' : 'Specific Class'}</option>
                  </select>
                </div>

                {target === 'class' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {language === 'bn' ? 'শ্রেণি নির্বাচন' : 'Select Class'}
                    </label>
                    <select
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                    >
                      <option value="">{language === 'bn' ? 'শ্রেণি বাছুন' : 'Select'}</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'bn' ? 'বিস্তারিত নোটিশ বা সবক বিবরণী *' : 'Notice Body *'}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={language === 'bn' ? 'বিজ্ঞপ্তির বিস্তারিত বা ডায়েরির বাড়ির কাজ এখানে লিখুন...' : 'Write the detailed announcement or homework activity here...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bangla"
                />
              </div>

              {/* Author & Pinned Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    placeholder="ঘোষণাকারীর নাম (যেমন: মুহতামিম)"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 shrink-0">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{language === 'bn' ? 'উপরে পিন করুন' : 'Pin to top'}</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <Button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  {language === 'bn' ? 'বিজ্ঞপ্তি প্রকাশ করুন' : 'Publish Notice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
