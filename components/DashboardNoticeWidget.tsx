import { SUPER_ADMIN_EMAIL } from '../services/appConfig';
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { NoticeItem, NoticeCategory, NoticePriority, NoticeTarget } from '../types';
import {
  Megaphone,
  Pin,
  Calendar,
  Clock,
  Users,
  AlertCircle,
  ShieldAlert,
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
import { UnconfirmedBadge } from './ui/UnconfirmedBadge';
import { NOTICES_CLOUD_FAILURE_MESSAGE, RETRY_LABEL } from '../services/cloudConfirm';

interface DashboardNoticeWidgetProps {
  onNavigateToNotices?: () => void;
}

export const DashboardNoticeWidget: React.FC<DashboardNoticeWidgetProps> = ({ onNavigateToNotices }) => {
  const { notices = [], addNotice, confirmNoticesCloudSync, isRecordUnconfirmed, isAdmin, isSuperAdmin, authUser, language, mode, classes = [] } = useApp();
  const { showToast } = useTheme();
  const isOwnerAdmin = isSuperAdmin || (authUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const canManage = isOwnerAdmin || isAdmin;
  // Viewer Mode (read-only session, e.g. admin claim missing): the
  // new-notice button stays visible so the refusal is explained with a
  // message instead of failing silently — the modal never opens here.
  const isViewerMode = mode === 'viewer';

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
  const [authorName, setAuthorName] = useState(authUser?.displayName || 'অধ্যক্ষ কার্যালয়');

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

  // 7 Nov 2026 Job 2 (instant save): background-confirm state. The
  // pending list is what Retry re-confirms; the banner hides once
  // isRecordUnconfirmed turns false for the saved notice.
  const [pendingNoticeSave, setPendingNoticeSave] = useState<NoticeItem[] | null>(null);
  const [pendingNoticeId, setPendingNoticeId] = useState<string | null>(null);
  const [pendingNoticeError, setPendingNoticeError] = useState<string | null>(null);
  const [isRetryingNotice, setIsRetryingNotice] = useState(false);
  const [noticeSaveNote, setNoticeSaveNote] = useState(false);

  // Plain-language confirm failure: a timeout (slow connection) says so
  // explicitly instead of the generic cloud message.
  const noticeConfirmErrorMessage = (result: { message?: string; rawMessage?: string }) =>
    (result.rawMessage?.includes('timed out')
      ? (language === 'bn' ? 'সময় শেষ হয়েছে — ইন্টারনেট ধীর, সংরক্ষণ শেষ হয়নি। ভালো নেটে আবার চেষ্টা করুন।' : 'Timed out — slow internet, the save did not finish. Try again on a better connection.')
      : (result.message || NOTICES_CLOUD_FAILURE_MESSAGE));

  // Viewer Mode: a new notice cannot be added in a read-only session.
  // Refuse with a clear message (same toast ExamManager uses for a
  // refused save) instead of failing silently.
  const handleNewNoticeClick = () => {
    if (isViewerMode) {
      showToast({
        type: 'error',
        title: language === 'bn' ? 'নোটিশ যোগ করা যাবে না' : 'Cannot add a notice',
        message: language === 'bn' ? 'ভিউয়ার মোডে নোটিশ যোগ করা যাবে না। আপনি এখন শুধু দেখার মোডে আছেন — নোটিশ দিতে অ্যাডমিন অ্যাক্সেস প্রয়োজন।' : 'Notices cannot be added in Viewer Mode. You are in read-only mode — admin access is required to post a notice.'
      });
      return;
    }
    setIsComposeModalOpen(true);
  };

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    // Job 2 (instant save, Job 0 pattern): the notice applies locally
    // and the modal closes at once; the cloud confirm runs in the
    // BACKGROUND via confirmNoticesCloudSync. On failure the payload is
    // queued, the notice shows the amber 'cloud-এ যায়নি' badge, and
    // the banner below offers Retry. Closing the modal means 'saved on
    // this device, syncing' — never a false 'published to cloud'.
    const created = addNotice({
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

    const nextNotices = [created, ...notices];
    setNoticeSaveNote(true);
    setTimeout(() => setNoticeSaveNote(false), 2000);
    void confirmNoticesCloudSync(nextNotices).then((confirmResult) => {
      if (!confirmResult.success) {
        setPendingNoticeSave(nextNotices);
        setPendingNoticeId(created.id);
        setPendingNoticeError(noticeConfirmErrorMessage(confirmResult));
      }
    }).catch((err) => {
      console.error('Background notice cloud confirm failed:', err);
      setPendingNoticeSave(nextNotices);
      setPendingNoticeId(created.id);
      setPendingNoticeError(NOTICES_CLOUD_FAILURE_MESSAGE);
    });
  };

  // Retry re-confirms the still-local save (no re-save needed). The
  // Diagnostics queue Retry covers the same payload, so whichever path
  // lands first clears the badge.
  const retryNoticeSave = async () => {
    if (!pendingNoticeSave || isRetryingNotice) return;
    setIsRetryingNotice(true);
    try {
      const result = await confirmNoticesCloudSync(pendingNoticeSave);
      if (result.success) {
        setPendingNoticeSave(null);
        setPendingNoticeId(null);
        setPendingNoticeError(null);
      } else {
        setPendingNoticeError(noticeConfirmErrorMessage(result));
      }
    } finally {
      setIsRetryingNotice(false);
    }
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
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
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
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {(canManage || isViewerMode) && (
            <button
              onClick={handleNewNoticeClick}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
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

      {/* Job 2 (instant save): a failed background cloud confirm leaves
          the notice queued with its amber badge — Retry here re-confirms
          the still-local save. The banner hides once the payload lands. */}
      {pendingNoticeSave && pendingNoticeId && isRecordUnconfirmed('notices', pendingNoticeId) && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-2">
          <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 leading-relaxed">
            <p className="font-semibold">{pendingNoticeError || NOTICES_CLOUD_FAILURE_MESSAGE}</p>
            <p className="text-amber-800">{language === 'bn' ? 'তথ্যটি এই ডিভাইসে সংরক্ষিত আছে — cloud-এ যায়নি।' : 'The record is saved on this device — it has not reached the cloud yet.'}</p>
          </div>
          <button type="button" onClick={retryNoticeSave} disabled={isRetryingNotice} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">{RETRY_LABEL}</button>
        </div>
      )}
      {noticeSaveNote && !pendingNoticeSave && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{language === 'bn' ? 'এই ডিভাইসে সংরক্ষিত হয়েছে — cloud-এ যাচ্ছে…' : 'Saved on this device — syncing to cloud…'}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {language === 'bn' ? 'সব নোটিশ' : 'All'}
        </button>
        <button
          onClick={() => setActiveFilter('urgent')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'urgent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          {language === 'bn' ? '🚨 জরুরি' : 'Urgent'}
        </button>
        <button
          onClick={() => setActiveFilter('diary')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'diary' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {language === 'bn' ? '📖 দৈনিক ডায়েরি' : 'Daily Diary'}
        </button>
        <button
          onClick={() => setActiveFilter('holiday')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeFilter === 'holiday' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
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
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
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
                  {/* Job 2: background cloud confirm failed — local-only until retry. */}
                  {isRecordUnconfirmed('notices', notice.id) && (
                    <UnconfirmedBadge isBn={language === 'bn'} />
                  )}

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
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
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
                  <strong className="text-slate-800">{selectedNoticeForModal.authorName || 'অধ্যক্ষ'}</strong>
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
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
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
                    <option value="teachers">{language === 'bn' ? 'শিক্ষকবৃন্দ (Teachers)' : 'Teachers'}</option>
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
                    placeholder="ঘোষণাকারীর নাম (যেমন: অধ্যক্ষ / সুপারিনটেনডেন্ট)"
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
                  className="px-5 py-2 text-xs font-bold"
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
